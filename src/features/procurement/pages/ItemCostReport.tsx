import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Search, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { useItemCostReportQuery } from "../hooks/useFinance";
import { formatCost } from "../../../lib/currency";
import { getErrorMessage } from "../../../lib/errors";

/**
 * Org-wide item cost report — flattens every PO's line items with their prorated share of that
 * PO's freight/LC charge/LC commission/VAT (allocated by each item's share of the PO's item-value
 * subtotal, mirroring how the Cost Sheet already spreads landedCostPerUnit). Read-only: these
 * figures are all derived from Shipment/Customs/Letter of Credit, edited from the PO's own
 * Shipment tab, not from this report.
 */
const ItemCostReportPage: React.FC = () => {
  const navigate = useNavigate();
  const organizationId = useOrganizationId();

  const reportQuery = useItemCostReportQuery();
  const rows = reportQuery.data ?? [];
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const refresh = async () => {
    setRefreshing(true);
    await reportQuery.refetch();
    setRefreshing(false);
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.itemName.toLowerCase().includes(q) ||
        (r.poNumber || "").toLowerCase().includes(q) ||
        (r.lcNumber || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  if (reportQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading item cost report…</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full p-6 bg-white lg:px-8 lg:py-8">
      {reportQuery.isError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex items-center justify-center w-12 h-12 mb-1 rounded-full bg-gradient-to-br from-red-50 to-red-100 ring-1 ring-red-100">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-[13px] text-slate-600">{getErrorMessage(reportQuery.error, "Failed to load the item cost report.")}</p>
          <button onClick={refresh} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col w-full min-w-0 gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search item, PO#, LC number..."
                className="pl-8 pr-3 py-2 w-64 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:bg-white transition-colors"
              />
            </div>
            <button
              onClick={refresh}
              className="flex items-center justify-center w-8 h-8 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
              title="Refresh"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
            {filteredRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
                  <Package className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
                  No items{search ? " match your search" : " yet"}
                </h3>
                <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                  {search ? "Try adjusting your search." : "Purchase order line items will show up here."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                      <th className="px-3 py-2 font-medium text-left">Item</th>
                      <th className="px-3 py-2 font-medium text-left">PO #</th>
                      <th className="px-3 py-2 font-medium text-right">Major Cost</th>
                      <th className="px-3 py-2 font-medium text-right">Freight</th>
                      <th className="px-3 py-2 font-medium text-left">LC Number</th>
                      <th className="px-3 py-2 font-medium text-right">LC Charge</th>
                      <th className="px-3 py-2 font-medium text-right">LC Commission</th>
                      <th className="px-3 py-2 font-medium text-right">VAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r, i) => (
                      <tr key={`${r.poId}-${i}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-800">{r.itemName}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => navigate(`/${organizationId}/purchase-orders/${r.poId}`)}
                            className="text-blue-900 hover:underline"
                          >
                            {r.poNumber || `#${r.poId}`}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatCost(r.majorCost)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.freight)}</td>
                        <td className="px-3 py-2 text-slate-600">{r.lcNumber || "--"}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.lcCharge)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.lcCommission)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.vat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemCostReportPage;
