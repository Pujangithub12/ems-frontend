import React, { useMemo, useState } from "react";
import {
  Truck,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronDown,
  Eye,
  Download,
  PackageCheck,
  DollarSign,
  Users,
  CalendarClock,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "../../../context/AuthProvider";
import { useProjects } from "../../projects/hooks/useProjects";
import { ProcurementItem } from "../../../types";
import { formatCost, toNumber, computeItemCostBreakdown } from "../api/procurement.api";
import { useWorkspaceProcurementQuery } from "../hooks/useProcurement";
import { useWorkspaceVendorsQuery } from "../../inventory/hooks/useInventory";
import { getErrorMessage } from "../../../lib/errors";
import Pagination from "../../../components/Pagination";
import ProcurementItemDrawer from "../components/ProcurementItemDrawer";
import { CATEGORY_STYLES } from "../components/statusStyles";

type SortBy = "date" | "name" | "cost";

const CategoryPill: React.FC<{ category: ProcurementItem["category"] }> = ({ category }) => {
  const c = CATEGORY_STYLES[category];
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium" style={{ background: c.bg, color: c.fg }}>
      {c.label}
    </span>
  );
};

const KpiCard: React.FC<{ label: string; value: string; icon: React.ReactNode; iconBg: string }> = ({ label, value, icon, iconBg }) => (
  <div className="p-3 bg-white border rounded-lg border-slate-200">
    <div className="flex items-start justify-between">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <div className={`flex items-center justify-center flex-shrink-0 rounded-lg w-7 h-7 ${iconBg}`}>{icon}</div>
    </div>
    <div className="mt-2 text-[19px] font-bold leading-none tracking-tight text-slate-900">{value}</div>
  </div>
);

/**
 * Read-only view of purchase orders that have reached "delivered" status —
 * a filtered slice of the same procurement data shown on the Purchase Order
 * page, not a separate receiving workflow. Full status-history (incl. the
 * date it was marked delivered) lives in the shared ProcurementItemDrawer.
 */
const GoodsReceivedPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const { data: projects = [] } = useProjects();
  const itemsQuery = useWorkspaceProcurementQuery();
  const items = itemsQuery.data ?? [];
  const loading = itemsQuery.isLoading;
  const error = itemsQuery.isError
    ? getErrorMessage(itemsQuery.error, "Failed to load goods received.")
    : null;
  const [refreshing, setRefreshing] = useState(false);
  const vendorsQuery = useWorkspaceVendorsQuery();
  const vendors = vendorsQuery.data ?? [];

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<number | "all">("all");
  const [vendorFilter, setVendorFilter] = useState<number | "all">("all");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drawerItemId, setDrawerItemId] = useState<number | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    await itemsQuery.refetch();
    setRefreshing(false);
  };

  const receivedItems = useMemo(() => items.filter((it) => it.status === "delivered"), [items]);

  const filteredItems = useMemo(() => {
    let rows = receivedItems;
    if (projectFilter !== "all") rows = rows.filter((it) => it.projectId === projectFilter);
    if (vendorFilter !== "all") rows = rows.filter((it) => it.vendor?.id === vendorFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (it) =>
          it.itemName.toLowerCase().includes(q) ||
          (it.vendor?.name || it.vendorName || "").toLowerCase().includes(q) ||
          (it.poNumber || "").toLowerCase().includes(q) ||
          (it.projectName || "").toLowerCase().includes(q),
      );
    }
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (sortBy === "cost") return computeItemCostBreakdown(b).total - computeItemCostBreakdown(a).total;
      if (sortBy === "name") return a.itemName.localeCompare(b.itemName);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }, [receivedItems, search, projectFilter, vendorFilter, sortBy]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const kpis = useMemo(() => {
    const now = new Date();
    const thisMonth = receivedItems.filter((i) => {
      const d = new Date(i.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return {
      totalReceived: receivedItems.length,
      totalValue: receivedItems.reduce((sum, i) => sum + computeItemCostBreakdown(i).total, 0),
      thisMonth,
      totalVendors: new Set(receivedItems.map((i) => i.vendor?.id).filter(Boolean)).size,
    };
  }, [receivedItems]);

  const handleExport = (rows: ProcurementItem[]) => {
    const sheetRows = rows.map((it) => ({
      "Item Name": it.itemName,
      "PO Number": it.poNumber || "",
      Project: it.projectName || "",
      Quantity: it.quantity,
      "Unit Cost": toNumber(it.unitCost ?? it.estimatedCost),
      "Transport Cost": it.transportCost != null ? toNumber(it.transportCost) : "",
      "Customs Cost": it.customsCost != null ? toNumber(it.customsCost) : "",
      "Total Cost": computeItemCostBreakdown(it).total,
      Vendor: it.vendor?.name || it.vendorName || "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Goods Received");
    XLSX.writeFile(workbook, "goods-received-export.xlsx");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading goods received…</p>
      </div>
    );
  }

  return (
    <div className="w-full p-6">
      {error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <p className="text-[13px] text-slate-600">{error}</p>
          <button onClick={refresh} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded hover:bg-slate-50">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col w-full min-w-0 gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Items Received" value={String(kpis.totalReceived)} icon={<PackageCheck className="w-4 h-4 text-emerald-700" />} iconBg="bg-emerald-50" />
            <KpiCard label="Total Value Received" value={formatCost(kpis.totalValue)} icon={<DollarSign className="w-4 h-4 text-blue-700" />} iconBg="bg-blue-50" />
            <KpiCard label="Received This Month" value={String(kpis.thisMonth)} icon={<CalendarClock className="w-4 h-4 text-indigo-700" />} iconBg="bg-indigo-50" />
            <KpiCard label="Vendors" value={String(kpis.totalVendors)} icon={<Users className="w-4 h-4 text-teal-700" />} iconBg="bg-teal-50" />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search items, PO#, vendors..."
                  className="pl-8 pr-3 py-2 w-56 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
                />
              </div>
              <div className="relative">
                <select
                  value={projectFilter}
                  onChange={(e) => { setProjectFilter(e.target.value === "all" ? "all" : Number(e.target.value)); setPage(1); }}
                  className="pl-3 pr-8 py-2 text-[12px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors max-w-[160px]"
                >
                  <option value="all">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none right-2.5 top-1/2 text-slate-400" />
              </div>
              <div className="relative">
                <select
                  value={vendorFilter}
                  onChange={(e) => { setVendorFilter(e.target.value === "all" ? "all" : Number(e.target.value)); setPage(1); }}
                  className="pl-3 pr-8 py-2 text-[12px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors max-w-[150px]"
                >
                  <option value="all">All Vendors</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none right-2.5 top-1/2 text-slate-400" />
              </div>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="pl-3 pr-8 py-2 text-[12px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors"
                >
                  <option value="date">Sort: Newest</option>
                  <option value="name">Sort: Name</option>
                  <option value="cost">Sort: Cost</option>
                </select>
                <ChevronDown className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none right-2.5 top-1/2 text-slate-400" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                className="flex items-center justify-center w-8 h-8 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
                title="Refresh"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => handleExport(filteredItems)}
                className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50"
                title="Export current view to Excel"
              >
                <Download size={13} /> Export
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-lg border-slate-200">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
                  <Truck className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
                  No goods received{projectFilter !== "all" || vendorFilter !== "all" || search ? " matching your filters" : " yet"}
                </h3>
                <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                  Purchase orders show up here once they're marked "Delivered" on the Purchase Order page.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                      <th className="px-3 py-2 font-medium text-left">Item</th>
                      <th className="px-3 py-2 font-medium text-left">PO #</th>
                      <th className="px-3 py-2 font-medium text-left">Project</th>
                      <th className="px-3 py-2 font-medium text-left">Category</th>
                      <th className="px-3 py-2 font-medium text-left">Quantity</th>
                      <th className="px-3 py-2 font-medium text-left">Total Cost</th>
                      <th className="px-3 py-2 font-medium text-left">Vendor</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((it) => (
                      <tr key={it.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <button
                            onClick={() => setDrawerItemId(it.id)}
                            className="font-medium text-left text-slate-800 hover:text-blue-900 hover:underline"
                          >
                            {it.itemName}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{it.poNumber || `#${it.id}`}</td>
                        <td className="px-3 py-2 text-slate-600">{it.projectName || "--"}</td>
                        <td className="px-3 py-2"><CategoryPill category={it.category} /></td>
                        <td className="px-3 py-2 text-slate-600">
                          {it.quantity}
                          {it.unit ? ` ${it.unit}` : ""}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {formatCost(computeItemCostBreakdown(it).total)}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{it.vendor?.name || it.vendorName || "--"}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => setDrawerItemId(it.id)}
                            className="flex items-center gap-1 px-2 py-1 ml-auto rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Eye size={13} /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filteredItems.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      )}

      <ProcurementItemDrawer itemId={drawerItemId} onClose={() => setDrawerItemId(null)} isAdmin={isAdmin} />
    </div>
  );
};

export default GoodsReceivedPage;
