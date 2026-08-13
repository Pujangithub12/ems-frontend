import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronDown,
  ClipboardCheck,
  Send,
  CheckCircle2,
  Ban,
  Flag,
} from "lucide-react";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { getErrorMessage } from "../../../lib/errors";
import { PurchaseOrderStatus, PurchaseType } from "../../../types";
import { useOrganizationPurchaseOrdersQuery } from "../hooks/usePurchaseOrder";

const STATUS_STYLES: Record<PurchaseOrderStatus, { bg: string; fg: string; label: string }> = {
  created: { bg: "#f1f5f9", fg: "#475569", label: "Created" },
  sent: { bg: "#fef9c3", fg: "#854d0e", label: "Sent" },
  accepted: { bg: "#dcfce7", fg: "#166534", label: "Accepted" },
  completed: { bg: "#dbeafe", fg: "#1e40af", label: "Completed" },
  cancelled: { bg: "#fee2e2", fg: "#991b1b", label: "Cancelled" },
};

const PURCHASE_TYPE_STYLES: Record<PurchaseType, { bg: string; fg: string; label: string }> = {
  local: { bg: "#f1f5f9", fg: "#475569", label: "Local" },
  international: { bg: "#e0e7ff", fg: "#3730a3", label: "International" },
};

const StatusPill: React.FC<{ status: PurchaseOrderStatus }> = ({ status }) => {
  const s = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
};

const PurchaseTypePill: React.FC<{ type: PurchaseType }> = ({ type }) => {
  const s = PURCHASE_TYPE_STYLES[type];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
};

const KpiCard: React.FC<{ label: string; value: string; icon: React.ReactNode; iconBg: string }> = ({
  label,
  value,
  icon,
  iconBg,
}) => (
  <div className="p-3 bg-white border rounded-xl shadow-md border-slate-200">
    <div className="flex items-start justify-between">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <div className={`flex items-center justify-center flex-shrink-0 rounded-lg w-7 h-7 ring-1 ring-black/5 ${iconBg}`}>{icon}</div>
    </div>
    <div className="mt-2 text-[19px] font-bold leading-none tracking-tight text-slate-900">{value}</div>
  </div>
);

/**
 * Purchase Orders (procurement pipeline v2, step 3) — org-wide list. There is
 * no create form here: POs are only ever generated from an approved Purchase
 * Request's "Generate Purchase Order" action (see PurchaseRequests.tsx), never
 * created directly. Matches Vendors.tsx's KPI strip -> toolbar -> table skeleton.
 */
const PurchaseOrdersPage: React.FC = () => {
  const organizationId = useOrganizationId();
  const navigate = useNavigate();

  const ordersQuery = useOrganizationPurchaseOrdersQuery();
  const orders = ordersQuery.data ?? [];

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<PurchaseType | "">("");

  const refresh = async () => {
    setRefreshing(true);
    await ordersQuery.refetch();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (typeFilter && o.purchaseType !== typeFilter) return false;
      if (!q) return true;
      return (
        (o.poNumber || "").toLowerCase().includes(q) ||
        (o.project?.name || "").toLowerCase().includes(q) ||
        (o.vendor?.name || "").toLowerCase().includes(q)
      );
    });
  }, [orders, search, statusFilter, typeFilter]);

  const kpis = useMemo(
    () => ({
      total: orders.length,
      created: orders.filter((o) => o.status === "created").length,
      sent: orders.filter((o) => o.status === "sent").length,
      accepted: orders.filter((o) => o.status === "accepted").length,
      completed: orders.filter((o) => o.status === "completed").length,
      cancelled: orders.filter((o) => o.status === "cancelled").length,
    }),
    [orders],
  );

  if (ordersQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading purchase orders…</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full p-6 bg-white lg:px-8 lg:py-8">
      {ordersQuery.isError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex items-center justify-center w-12 h-12 mb-1 rounded-full bg-gradient-to-br from-red-50 to-red-100 ring-1 ring-red-100">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-[13px] text-slate-600">{getErrorMessage(ordersQuery.error, "Failed to load purchase orders.")}</p>
          <button onClick={refresh} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col w-full min-w-0 gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="Total POs" value={String(kpis.total)} icon={<Package className="w-4 h-4 text-blue-700" />} iconBg="bg-blue-50" />
            <KpiCard label="Created" value={String(kpis.created)} icon={<ClipboardCheck className="w-4 h-4 text-slate-500" />} iconBg="bg-slate-100" />
            <KpiCard label="Sent" value={String(kpis.sent)} icon={<Send className="w-4 h-4 text-amber-600" />} iconBg="bg-amber-50" />
            <KpiCard label="Accepted" value={String(kpis.accepted)} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50" />
            <KpiCard label="Completed" value={String(kpis.completed)} icon={<Flag className="w-4 h-4 text-blue-700" />} iconBg="bg-blue-50" />
            <KpiCard label="Cancelled" value={String(kpis.cancelled)} icon={<Ban className="w-4 h-4 text-red-700" />} iconBg="bg-red-50" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search PO#, project, vendor..."
                  className="pl-8 pr-3 py-2 w-64 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:bg-white transition-colors"
                />
              </div>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | "")}
                  className="appearance-none pl-3 pr-8 py-2 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none cursor-pointer focus:border-blue-400 focus:bg-white transition-colors"
                >
                  <option value="">All statuses</option>
                  {(Object.keys(STATUS_STYLES) as PurchaseOrderStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_STYLES[s].label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-2.5 top-1/2 w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as PurchaseType | "")}
                  className="appearance-none pl-3 pr-8 py-2 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none cursor-pointer focus:border-blue-400 focus:bg-white transition-colors"
                >
                  <option value="">All types</option>
                  {(Object.keys(PURCHASE_TYPE_STYLES) as PurchaseType[]).map((t) => (
                    <option key={t} value={t}>{PURCHASE_TYPE_STYLES[t].label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-2.5 top-1/2 w-3.5 h-3.5 text-slate-400" />
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
            </div>
          </div>

          <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
                  <Package className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
                  No purchase orders{search || statusFilter || typeFilter ? " match your filters" : " yet"}
                </h3>
                <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                  {search || statusFilter || typeFilter
                    ? "Try adjusting your filters."
                    : "Purchase orders are generated once a purchase request's vendor is selected and approved."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                      <th className="px-3 py-2 font-medium text-left">PO #</th>
                      <th className="px-3 py-2 font-medium text-left">Project</th>
                      <th className="px-3 py-2 font-medium text-left">Vendor</th>
                      <th className="px-3 py-2 font-medium text-left">Purchase Type</th>
                      <th className="px-3 py-2 font-medium text-left">Items</th>
                      <th className="px-3 py-2 font-medium text-left">Status</th>
                      <th className="px-3 py-2 font-medium text-left">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o) => (
                      <tr
                        key={o.id}
                        onClick={() => navigate(`/${organizationId}/purchase-orders/${o.id}`)}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="px-3 py-3 font-medium text-slate-800">{o.poNumber || `#${o.id}`}</td>
                        <td className="px-3 py-3 text-slate-600">{o.project?.name || "--"}</td>
                        <td className="px-3 py-3 text-slate-600">{o.vendor?.name || "--"}</td>
                        <td className="px-3 py-3"><PurchaseTypePill type={o.purchaseType} /></td>
                        <td className="px-3 py-3 text-slate-600">
                          {o.items[0]?.itemName}
                          {o.items.length > 1 ? ` +${o.items.length - 1} more` : ""}
                        </td>
                        <td className="px-3 py-3"><StatusPill status={o.status} /></td>
                        <td className="px-3 py-3 text-slate-500">{new Date(o.createdAt).toLocaleDateString()}</td>
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

export default PurchaseOrdersPage;
