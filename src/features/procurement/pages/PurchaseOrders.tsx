import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronDown,
  Plus,
  Pencil,
  X,
} from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { getErrorMessage } from "../../../lib/errors";
import { PurchaseOrderStatus, PurchaseType } from "../../../types";
import {
  useOrganizationPurchaseOrdersQuery,
  useCreatePurchaseOrderMutation,
} from "../hooks/usePurchaseOrder";
import { useProjects } from "../../projects/hooks/useProjects";
import VendorField from "../../inventory/components/VendorField";
import VendorFormModal from "../../inventory/components/VendorFormModal";
import { useOrganizationVendorsQuery } from "../../inventory/hooks/useInventory";

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

/** Custom dropdown (not a native <select>) so the option list can be capped to 5 visible rows
 * and scroll for the rest — a native <select>'s option list ignores max-height/overflow CSS. */
const PROJECT_FILTER_ROW_H = 32;
const ProjectFilterDropdown: React.FC<{
  projects: { id: number; name: string }[];
  value: number | "";
  onChange: (value: number | "") => void;
}> = ({ projects, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedName = value === "" ? "All projects" : projects.find((p) => p.id === value)?.name || "All projects";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 pl-3 pr-8 py-2 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none cursor-pointer focus:border-blue-400 hover:bg-white transition-colors relative max-w-[180px]"
      >
        <span className="truncate">{selectedName}</span>
        <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-2.5 top-1/2 w-3.5 h-3.5 text-slate-400" />
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 overflow-y-auto bg-white border rounded-lg shadow-lg border-slate-200 min-w-[180px]"
          style={{ maxHeight: PROJECT_FILTER_ROW_H * 5 }}
        >
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            className={`block w-full px-3 py-2 text-[12px] text-left hover:bg-slate-50 truncate ${value === "" ? "font-medium text-blue-900" : "text-slate-700"}`}
          >
            All projects
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onChange(p.id); setOpen(false); }}
              className={`block w-full px-3 py-2 text-[12px] text-left hover:bg-slate-50 truncate ${value === p.id ? "font-medium text-blue-900" : "text-slate-700"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Modal for creating a Purchase Order directly — needs a project picker up front since this
 * page (unlike the project-scoped Procurement tab) has no project context of its own. */
const CreatePurchaseOrderModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({
  onClose,
  onCreated,
}) => {
  const { data: projects = [] } = useProjects();
  const createMutation = useCreatePurchaseOrderMutation();
  const vendorsQuery = useOrganizationVendorsQuery();

  const [projectId, setProjectId] = useState<number | "">("");
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (projectId === "") {
      setFormError("Select a project.");
      return;
    }

    setSubmitting(true);
    try {
      await createMutation.mutateAsync({
        projectId: String(projectId),
        input: { vendorId },
      });
      onCreated();
      onClose();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to create purchase order."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-[14px] font-semibold text-slate-900">New Purchase Order</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto">
          {formError && (
            <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-400"
              >
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Vendor</label>
              <VendorField vendorId={vendorId} onSelect={setVendorId} onAddNew={() => setVendorModalOpen(true)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-60">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Purchase Order
            </button>
          </div>
        </form>
      </div>
      {vendorModalOpen && (
        <VendorFormModal
          onClose={() => setVendorModalOpen(false)}
          onSaved={async (vendor) => {
            await vendorsQuery.refetch();
            setVendorId(vendor.id);
            setVendorModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

/**
 * Purchase Orders (procurement pipeline v2, step 3) — a single org-wide table.
 * Purchase Orders are created directly here (project + vendor picked up front, no
 * Purchase Request involved) — line items are added afterward from the detail page's
 * Overview tab. Creation is restricted to admin/finance/super_admin
 * (see roleMiddleware on the create route); there is no approval step.
 */
const PurchaseOrdersPage: React.FC = () => {
  const organizationId = useOrganizationId();
  const navigate = useNavigate();
  const { user } = useAuth();

  const ordersQuery = useOrganizationPurchaseOrdersQuery();
  const orders = ordersQuery.data ?? [];
  const { data: projects = [] } = useProjects();

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<PurchaseType | "">("");
  const [projectFilter, setProjectFilter] = useState<number | "">("");
  const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await ordersQuery.refetch();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (typeFilter && o.purchaseType !== typeFilter) return false;
      if (projectFilter && o.project?.id !== projectFilter) return false;
      if (!q) return true;
      return (
        (o.poNumber || "").toLowerCase().includes(q) ||
        (o.project?.name || "").toLowerCase().includes(q) ||
        (o.vendor?.name || "").toLowerCase().includes(q)
      );
    });
    result.sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return dateSort === "newest" ? -diff : diff;
    });
    return result;
  }, [orders, search, statusFilter, typeFilter, projectFilter, dateSort]);

  if (ordersQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading purchase orders…</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-white">
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
        <div className="p-6 lg:px-8 lg:py-8">
          <div className="flex flex-col w-full min-w-0 gap-4">
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
                <ProjectFilterDropdown projects={projects} value={projectFilter} onChange={setProjectFilter} />
                <div className="relative">
                  <select
                    value={dateSort}
                    onChange={(e) => setDateSort(e.target.value as "newest" | "oldest")}
                    className="appearance-none pl-3 pr-8 py-2 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none cursor-pointer focus:border-blue-400 focus:bg-white transition-colors"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
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
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 transition-colors"
                >
                  <Plus size={14} /> New Purchase Order
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
                      : 'Click "New Purchase Order" to create your first one.'}
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
                        <th className="px-3 py-2 font-medium text-right">Actions</th>
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
                          <td className="px-3 py-3 text-right">
                            {o.createdBy?.id === user?.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/${organizationId}/purchase-orders/${o.id}`);
                                }}
                                title="Edit"
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded text-slate-500 hover:bg-slate-100 hover:text-blue-900 transition-colors"
                              >
                                <Pencil size={12} /> Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreatePurchaseOrderModal onClose={() => setShowCreateModal(false)} onCreated={refresh} />
      )}

    </div>
  );
};

export default PurchaseOrdersPage;
