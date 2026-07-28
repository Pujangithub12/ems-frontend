import React, { useMemo, useState } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  Trash2,
  ChevronDown,
  Check,
  FileCheck2,
  FileClock,
  FileX2,
  ArrowRightCircle,
  Radio,
  Paperclip,
  Upload,
} from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { useProjects } from "../../projects/hooks/useProjects";
import { useOrganizationVendorsQuery } from "../../inventory/hooks/useInventory";
import ItemNameField from "../../inventory/components/ItemNameField";
import VendorField from "../../inventory/components/VendorField";
import Drawer, { DrawerSection, DrawerRow } from "../../../components/Drawer";
import ConfirmationModal from "../../../components/ConfirmationModal";
import { getErrorMessage } from "../../../lib/errors";
import { PurchaseRequest, PurchaseRequestPriority, PurchaseRequestStatus } from "../../../types";
import {
  useOrganizationPurchaseRequestsQuery,
  useCreatePurchaseRequestMutation,
  useDeletePurchaseRequestMutation,
  usePurchaseRequestDetailQuery,
  useChangePurchaseRequestStatusMutation,
  useAddVendorQuoteMutation,
  useDeleteVendorQuoteMutation,
  useSelectVendorQuoteMutation,
  useGeneratePurchaseOrderMutation,
  useUploadPurchaseRequestAttachmentMutation,
  useDeletePurchaseRequestAttachmentMutation,
} from "../hooks/usePurchaseRequest";
import { PurchaseRequestItemInput } from "../api/purchaseRequest.api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const purchaseOrderPdfUrl = (id: number) => `${API_BASE}/api/purchase-orders/${id}/pdf`;

export const STATUS_STYLES: Record<PurchaseRequestStatus, { bg: string; fg: string; label: string }> = {
  draft: { bg: "#f1f5f9", fg: "#475569", label: "Draft" },
  submitted: { bg: "#fef9c3", fg: "#854d0e", label: "Submitted" },
  approved: { bg: "#dcfce7", fg: "#166534", label: "Approved" },
  rejected: { bg: "#fee2e2", fg: "#991b1b", label: "Rejected" },
  converted_to_po: { bg: "#dbeafe", fg: "#1e40af", label: "Converted to PO" },
};

export const PRIORITY_STYLES: Record<PurchaseRequestPriority, string> = {
  low: "text-slate-500",
  medium: "text-amber-600",
  high: "text-orange-600",
  urgent: "text-rose-600",
};

export const StatusPill: React.FC<{ status: PurchaseRequestStatus }> = ({ status }) => {
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

const KpiCard: React.FC<{ label: string; value: string; icon: React.ReactNode; iconBg: string }> = ({
  label,
  value,
  icon,
  iconBg,
}) => (
  <div className="p-3 bg-white border rounded-lg border-slate-200">
    <div className="flex items-start justify-between">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <div className={`flex items-center justify-center flex-shrink-0 rounded-lg w-7 h-7 ${iconBg}`}>{icon}</div>
    </div>
    <div className="mt-2 text-[19px] font-bold leading-none tracking-tight text-slate-900">{value}</div>
  </div>
);

type ItemRow = { itemId: number | null; itemName: string; quantity: string; unit: string; estimatedPrice: string };
const emptyItemRow: ItemRow = { itemId: null, itemName: "", quantity: "1", unit: "", estimatedPrice: "" };

/**
 * Purchase Requests (procurement pipeline v2, step 1) — org-wide list + create form +
 * a detail drawer that doubles as the "Vendor Selection" screen from the spec (quote
 * comparison, select, and Generate Purchase Order), matching this codebase's existing
 * drawer-for-detail convention rather than a separate route.
 */
const PurchaseRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const requestsQuery = useOrganizationPurchaseRequestsQuery();
  const requests = requestsQuery.data ?? [];
  const { data: projects = [] } = useProjects();
  const vendorsQuery = useOrganizationVendorsQuery();
  const vendors = vendorsQuery.data ?? [];

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseRequestStatus | "">("");

  const refresh = async () => {
    setRefreshing(true);
    await requestsQuery.refetch();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.prNumber || "").toLowerCase().includes(q) ||
        (r.project?.name || "").toLowerCase().includes(q) ||
        (r.department || "").toLowerCase().includes(q) ||
        r.items.some((i) => i.itemName.toLowerCase().includes(q))
      );
    });
  }, [requests, search, statusFilter]);

  const kpis = useMemo(
    () => ({
      total: requests.length,
      draft: requests.filter((r) => r.status === "draft").length,
      pending: requests.filter((r) => r.status === "submitted").length,
      approved: requests.filter((r) => r.status === "approved").length,
      converted: requests.filter((r) => r.status === "converted_to_po").length,
    }),
    [requests],
  );

  // ---- Create form ----
  const [showForm, setShowForm] = useState(false);
  const [formProjectId, setFormProjectId] = useState<number | "">("");
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState<PurchaseRequestPriority>("medium");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ ...emptyItemRow }]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const createMutation = useCreatePurchaseRequestMutation();

  const openCreateForm = () => {
    setFormProjectId(projects[0]?.id ?? "");
    setDepartment("");
    setPriority("medium");
    setReason("");
    setItems([{ ...emptyItemRow }]);
    setFormError(null);
    setShowForm(true);
  };
  const closeForm = () => setShowForm(false);

  const updateItemRow = (index: number, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const addItemRow = () => setItems((prev) => [...prev, { ...emptyItemRow }]);
  const removeItemRow = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProjectId) {
      setFormError("Select a project.");
      return;
    }
    const payloadItems: PurchaseRequestItemInput[] = [];
    for (const row of items) {
      if (!row.itemName.trim() && !row.itemId) continue;
      const quantity = parseFloat(row.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setFormError("Every item needs a valid quantity.");
        return;
      }
      payloadItems.push({
        itemName: row.itemName.trim() || undefined,
        itemId: row.itemId,
        quantity,
        unit: row.unit.trim() || undefined,
        estimatedPrice: row.estimatedPrice ? parseFloat(row.estimatedPrice) : null,
      });
    }
    if (payloadItems.length === 0) {
      setFormError("Add at least one item.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        projectId: String(formProjectId),
        input: { department: department.trim() || undefined, priority, reason: reason.trim() || undefined, items: payloadItems },
      });
      await requestsQuery.refetch();
      closeForm();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to create purchase request."));
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Delete ----
  const deleteMutation = useDeletePurchaseRequestMutation();
  const [deleteTarget, setDeleteTarget] = useState<PurchaseRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      await requestsQuery.refetch();
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // ---- Detail / Vendor Selection drawer ----
  const [drawerId, setDrawerId] = useState<number | null>(null);

  if (requestsQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading purchase requests…</p>
      </div>
    );
  }

  return (
    <div className="w-full p-6">
      {requestsQuery.isError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <p className="text-[13px] text-slate-600">{getErrorMessage(requestsQuery.error, "Failed to load purchase requests.")}</p>
          <button onClick={refresh} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded hover:bg-slate-50">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col w-full min-w-0 gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <KpiCard label="Total Requests" value={String(kpis.total)} icon={<ClipboardList className="w-4 h-4 text-blue-700" />} iconBg="bg-blue-50" />
            <KpiCard label="Draft" value={String(kpis.draft)} icon={<FileClock className="w-4 h-4 text-slate-500" />} iconBg="bg-slate-100" />
            <KpiCard label="Pending Approval" value={String(kpis.pending)} icon={<FileClock className="w-4 h-4 text-amber-600" />} iconBg="bg-amber-50" />
            <KpiCard label="Approved" value={String(kpis.approved)} icon={<FileCheck2 className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50" />
            <KpiCard label="Converted to PO" value={String(kpis.converted)} icon={<ArrowRightCircle className="w-4 h-4 text-blue-700" />} iconBg="bg-blue-50" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search PR#, project, department, item..."
                  className="pl-8 pr-3 py-2 w-64 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
                />
              </div>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as PurchaseRequestStatus | "")}
                  className="appearance-none pl-3 pr-8 py-2 text-[12px] border border-slate-200 rounded-lg outline-none cursor-pointer focus:border-blue-400"
                >
                  <option value="">All statuses</option>
                  {(Object.keys(STATUS_STYLES) as PurchaseRequestStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_STYLES[s].label}</option>
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
              <button
                onClick={openCreateForm}
                className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg text-[12px] font-medium hover:bg-blue-800 transition-colors"
              >
                <Plus size={14} /> New Purchase Request
              </button>
            </div>
          </div>

          <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-lg border-slate-200">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
                  <ClipboardList className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
                  No purchase requests{search || statusFilter ? " match your filters" : " yet"}
                </h3>
                <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                  {!search && !statusFilter ? "Create a purchase request to start the procurement pipeline." : "Try adjusting your filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                      <th className="px-3 py-2 font-medium text-left">PR #</th>
                      <th className="px-3 py-2 font-medium text-left">Project</th>
                      <th className="px-3 py-2 font-medium text-left">Department</th>
                      <th className="px-3 py-2 font-medium text-left">Items</th>
                      <th className="px-3 py-2 font-medium text-left">Priority</th>
                      <th className="px-3 py-2 font-medium text-left">Requested By</th>
                      <th className="px-3 py-2 font-medium text-left">Status</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-800">{r.prNumber || `#${r.id}`}</td>
                        <td className="px-3 py-2 text-slate-600">{r.project?.name || "--"}</td>
                        <td className="px-3 py-2 text-slate-600">{r.department || "--"}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {r.items[0]?.itemName}
                          {r.items.length > 1 ? ` +${r.items.length - 1} more` : ""}
                        </td>
                        <td className={`px-3 py-2 font-medium capitalize ${PRIORITY_STYLES[r.priority]}`}>{r.priority}</td>
                        <td className="px-3 py-2 text-slate-600">{r.requestedBy?.fullName || "--"}</td>
                        <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setDrawerId(r.id)}
                              className="px-2 py-1 text-[11px] font-medium text-blue-900 rounded hover:bg-blue-50"
                            >
                              View
                            </button>
                            {r.status === "draft" && (
                              <button
                                onClick={() => setDeleteTarget(r)}
                                title="Delete"
                                className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">New Purchase Request</h3>
              <button onClick={closeForm} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmitForm} className="p-4 space-y-3 overflow-y-auto">
              {formError && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">{formError}</div>}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-900">Project</label>
                  <select
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  >
                    <option value="" disabled>Select project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-900">Department</label>
                  <input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-900">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PurchaseRequestPriority)}
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-900">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Why is this needed?"
                  className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none resize-none focus:border-blue-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-medium text-slate-900">Items</label>
                  <button type="button" onClick={addItemRow} className="flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline">
                    <Plus size={11} /> Add item
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((row, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 border rounded-lg border-slate-200">
                      <div className="flex-[2] min-w-0">
                        <ItemNameField
                          itemId={row.itemId}
                          currentName={row.itemName}
                          onSelect={(item) => updateItemRow(i, { itemId: item.id, itemName: item.name })}
                          className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-400"
                        />
                      </div>
                      <input
                        value={row.quantity}
                        onChange={(e) => updateItemRow(i, { quantity: e.target.value })}
                        placeholder="Qty"
                        type="number"
                        min="1"
                        className="w-16 px-2 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                      />
                      <input
                        value={row.unit}
                        onChange={(e) => updateItemRow(i, { unit: e.target.value })}
                        placeholder="Unit"
                        className="w-20 px-2 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                      />
                      <input
                        value={row.estimatedPrice}
                        onChange={(e) => updateItemRow(i, { estimatedPrice: e.target.value })}
                        placeholder="Est. price"
                        type="number"
                        min="0"
                        className="w-24 px-2 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                      />
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItemRow(i)} className="p-1.5 text-slate-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeForm} className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleting}
        title="Delete Purchase Request"
        message={`Delete "${deleteTarget?.prNumber || `#${deleteTarget?.id}`}"? This cannot be undone.`}
      />

      <PurchaseRequestDetailDrawer
        id={drawerId}
        isAdmin={isAdmin}
        vendors={vendors}
        onClose={() => setDrawerId(null)}
        onChanged={() => requestsQuery.refetch()}
      />
    </div>
  );
};

/** Detail drawer that doubles as the "Vendor Selection" screen: status actions, quote comparison, Generate PO. Exported so ProjectProcurementTab can reuse it for the project-scoped view. */
export const PurchaseRequestDetailDrawer: React.FC<{
  id: number | null;
  isAdmin: boolean;
  vendors: { id: number; name: string }[];
  onClose: () => void;
  onChanged: () => void;
}> = ({ id, isAdmin, vendors, onClose, onChanged }) => {
  const detailQuery = usePurchaseRequestDetailQuery(id);
  const detail = detailQuery.data;
  const [actionError, setActionError] = useState<string | null>(null);

  const changeStatusMutation = useChangePurchaseRequestStatusMutation();
  const addQuoteMutation = useAddVendorQuoteMutation();
  const deleteQuoteMutation = useDeleteVendorQuoteMutation();
  const selectQuoteMutation = useSelectVendorQuoteMutation();
  const generatePoMutation = useGeneratePurchaseOrderMutation();
  const uploadAttachmentMutation = useUploadPurchaseRequestAttachmentMutation();
  const deleteAttachmentMutation = useDeletePurchaseRequestAttachmentMutation();

  const [quoteVendorId, setQuoteVendorId] = useState<number | "">("");
  const [quotePrice, setQuotePrice] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const refetchAll = async () => {
    await detailQuery.refetch();
    onChanged();
  };

  const runAction = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await refetchAll();
    } catch (err) {
      setActionError(getErrorMessage(err, "Action failed."));
    } finally {
      setBusy(false);
    }
  };

  const pr = detail?.purchaseRequest;

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      title={pr?.prNumber || (id ? `PR #${id}` : "")}
      subtitle={pr?.project?.name}
      width={480}
    >
      {!detail ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        </div>
      ) : (
        <>
          {actionError && (
            <div className="flex items-center justify-between mx-5 mt-4 px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
              <span>{actionError}</span>
              <button onClick={() => setActionError(null)}><X size={14} /></button>
            </div>
          )}

          <DrawerSection title="Overview">
            <DrawerRow label="Status"><StatusPill status={pr!.status} /></DrawerRow>
            <DrawerRow label="Department">{pr!.department || "--"}</DrawerRow>
            <DrawerRow label="Priority">
              <span className={`capitalize ${PRIORITY_STYLES[pr!.priority]}`}>{pr!.priority}</span>
            </DrawerRow>
            <DrawerRow label="Requested By">{pr!.requestedBy?.fullName || "--"}</DrawerRow>
            {pr!.reason && <DrawerRow label="Reason">{pr!.reason}</DrawerRow>}
            {pr!.purchaseOrder && <DrawerRow label="Purchase Order">{pr!.purchaseOrder.poNumber}</DrawerRow>}
          </DrawerSection>

          <DrawerSection title="Items">
            {pr!.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-[12px]">
                <span className="text-slate-700">{item.itemName}</span>
                <span className="text-slate-500">
                  {item.quantity} {item.unit || ""}
                </span>
              </div>
            ))}
          </DrawerSection>

          {(pr!.status === "draft" || (isAdmin && pr!.status === "submitted")) && (
            <DrawerSection title="Actions">
              <div className="flex flex-wrap gap-2">
                {pr!.status === "draft" && (
                  <button
                    disabled={busy}
                    onClick={() => runAction(() => changeStatusMutation.mutateAsync({ id: pr!.id, status: "submitted" }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
                  >
                    <Check size={13} /> Submit for approval
                  </button>
                )}
                {isAdmin && pr!.status === "submitted" && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => runAction(() => changeStatusMutation.mutateAsync({ id: pr!.id, status: "approved" }))}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <Check size={13} /> Approve
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => runAction(() => changeStatusMutation.mutateAsync({ id: pr!.id, status: "rejected" }))}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 disabled:opacity-60"
                    >
                      <FileX2 size={13} /> Reject
                    </button>
                  </>
                )}
              </div>
            </DrawerSection>
          )}

          {(pr!.status === "approved" || pr!.status === "converted_to_po") && (
            <DrawerSection title="Vendor Selection">
              {pr!.vendorQuotes.length === 0 ? (
                <p className="text-[12px] text-slate-400">No vendor quotes yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {pr!.vendorQuotes.map((q) => (
                    <div
                      key={q.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-[12px] ${
                        q.isSelected ? "border-emerald-300 bg-emerald-50" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isAdmin && pr!.status === "approved" ? (
                          <button
                            disabled={busy}
                            onClick={() => runAction(() => selectQuoteMutation.mutateAsync({ id: pr!.id, quoteId: q.id }))}
                            title="Select this vendor"
                            className={q.isSelected ? "text-emerald-600" : "text-slate-300 hover:text-slate-500"}
                          >
                            <Radio size={14} fill={q.isSelected ? "currentColor" : "none"} />
                          </button>
                        ) : (
                          <Radio size={14} className={q.isSelected ? "text-emerald-600" : "text-slate-300"} fill={q.isSelected ? "currentColor" : "none"} />
                        )}
                        <span className="font-medium text-slate-800 truncate">{q.vendor?.name || "Unknown vendor"}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-medium text-slate-700">Rs {Number(q.price).toLocaleString()}</span>
                        {isAdmin && pr!.status === "approved" && (
                          <button
                            onClick={() => runAction(() => deleteQuoteMutation.mutateAsync({ id: pr!.id, quoteId: q.id }))}
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isAdmin && pr!.status === "approved" && (
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="flex-1 min-w-0">
                    <VendorField vendorId={quoteVendorId || null} onSelect={(vid) => setQuoteVendorId(vid ?? "")} />
                  </div>
                  <input
                    value={quotePrice}
                    onChange={(e) => setQuotePrice(e.target.value)}
                    placeholder="Price"
                    type="number"
                    className="w-24 px-2 py-2 text-[12px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                  <button
                    disabled={busy || !quoteVendorId || !quotePrice}
                    onClick={() =>
                      runAction(async () => {
                        await addQuoteMutation.mutateAsync({
                          id: pr!.id,
                          input: { vendorId: Number(quoteVendorId), price: Number(quotePrice), notes: quoteNotes.trim() || undefined },
                        });
                        setQuoteVendorId("");
                        setQuotePrice("");
                        setQuoteNotes("");
                      })
                    }
                    className="px-3 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              )}

              {isAdmin && pr!.status === "approved" && (
                <button
                  disabled={busy || !pr!.vendorQuotes.some((q) => q.isSelected)}
                  onClick={() =>
                    runAction(async () => {
                      const purchaseOrder = await generatePoMutation.mutateAsync(pr!.id);
                      // Auto-download the generated PO PDF — it's also saved as a PO
                      // attachment server-side, so it can be re-downloaded later too.
                      if (purchaseOrder?.id) {
                        window.open(purchaseOrderPdfUrl(purchaseOrder.id), "_blank");
                      }
                    })
                  }
                  className="flex items-center justify-center w-full gap-1.5 px-3 py-2 mt-3 text-[12px] font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  <ArrowRightCircle size={14} /> Generate Purchase Order
                </button>
              )}
            </DrawerSection>
          )}

          <DrawerSection
            title="Attachments"
            action={
              isAdmin ? (
                <label className="flex items-center gap-1 text-[11px] font-medium text-blue-700 cursor-pointer hover:underline">
                  <Upload size={11} /> Upload
                  <input
                    type="file"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      await runAction(() => uploadAttachmentMutation.mutateAsync({ id: pr!.id, file, documentType: "general" }));
                    }}
                  />
                </label>
              ) : undefined
            }
          >
            {detail.attachments.length === 0 ? (
              <p className="text-[12px] text-slate-400">No attachments yet.</p>
            ) : (
              detail.attachments.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-[12px]">
                  <span className="flex items-center gap-1.5 text-slate-700 truncate">
                    <Paperclip size={12} className="text-slate-400 flex-shrink-0" /> {a.fileName}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => runAction(() => deleteAttachmentMutation.mutateAsync({ id: pr!.id, attachmentId: a.id }))}
                      className="text-slate-400 hover:text-red-600 flex-shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))
            )}
          </DrawerSection>

          <DrawerSection title="Status History">
            {detail.statusHistory.map((h) => (
              <div key={h.id} className="py-1.5 border-b border-slate-100 last:border-0 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700">
                    {h.fromStatus ? `${STATUS_STYLES[h.fromStatus as PurchaseRequestStatus]?.label ?? h.fromStatus} → ` : ""}
                    {STATUS_STYLES[h.toStatus as PurchaseRequestStatus]?.label ?? h.toStatus}
                  </span>
                  <span className="text-slate-400">{new Date(h.createdAt).toLocaleDateString()}</span>
                </div>
                {h.changedBy && <span className="text-slate-400">{h.changedBy.fullName}</span>}
              </div>
            ))}
          </DrawerSection>
        </>
      )}
    </Drawer>
  );
};

export default PurchaseRequestsPage;
