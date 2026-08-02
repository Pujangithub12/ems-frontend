import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ClipboardList, Package, Plus, RefreshCw, Loader2, AlertCircle, X, Trash2 } from "lucide-react";
import { useAuth } from "../../../../context/AuthProvider";
import { Project, PurchaseRequestPriority } from "../../../../types";
import { getErrorMessage } from "../../../../lib/errors";
import ItemNameField from "../../../inventory/components/ItemNameField";
import {
  usePurchaseRequestsQuery,
  useCreatePurchaseRequestMutation,
  useChangePurchaseRequestStatusMutation,
} from "../../../procurement/hooks/usePurchaseRequest";
import { usePurchaseOrdersQuery } from "../../../procurement/hooks/usePurchaseOrder";
import { PurchaseRequestItemInput } from "../../../procurement/api/purchaseRequest.api";
import {
  StatusPill as PrStatusPill,
  PRIORITY_STYLES,
  PurchaseRequestDetailDrawer,
} from "../../../procurement/pages/PurchaseRequests";

interface ProjectProcurementTabProps {
  project: Project;
}

type ItemRow = { itemId: number | null; itemName: string; quantity: string; unit: string; estimatedPrice: string };
const emptyItemRow: ItemRow = { itemId: null, itemName: "", quantity: "1", unit: "", estimatedPrice: "" };

const PO_STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  created: { bg: "#f1f5f9", fg: "#475569", label: "Created" },
  sent: { bg: "#fef9c3", fg: "#854d0e", label: "Sent" },
  accepted: { bg: "#dbeafe", fg: "#1e40af", label: "Accepted" },
  cancelled: { bg: "#fee2e2", fg: "#991b1b", label: "Cancelled" },
  completed: { bg: "#dcfce7", fg: "#166534", label: "Completed" },
};

/**
 * Project-scoped view of the procurement pipeline v2 (Purchase Requests + Purchase Orders),
 * reusing the org-wide pages' detail drawer (PurchaseRequestDetailDrawer) and vendor-quote
 * selection UI rather than re-implementing it — matches the "reduced form vs. org-wide page"
 * pattern already used by this tab's sibling ProjectInventoryTab.
 */
const ProjectProcurementTab: React.FC<ProjectProcurementTabProps> = ({ project }) => {
  const projectId = String(project.id);
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const requestsQuery = usePurchaseRequestsQuery(projectId);
  const requests = requestsQuery.data ?? [];
  const ordersQuery = usePurchaseOrdersQuery(projectId);
  const orders = ordersQuery.data ?? [];

  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([requestsQuery.refetch(), ordersQuery.refetch()]);
    setRefreshing(false);
  };

  // ---- Create Purchase Request form ----
  // Same two-step review-before-submit flow as the org-wide Purchase Requests
  // page (see PurchaseRequests.tsx): fill the form, review everything
  // entered, then "Submit" both creates the PR and immediately moves it to
  // "submitted" in one action.
  const [showForm, setShowForm] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState<PurchaseRequestPriority>("medium");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ ...emptyItemRow }]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const createMutation = useCreatePurchaseRequestMutation();
  const createStatusMutation = useChangePurchaseRequestStatusMutation();

  const openCreateForm = () => {
    setDepartment("");
    setPriority("medium");
    setReason("");
    setItems([{ ...emptyItemRow }]);
    setFormError(null);
    setShowReview(false);
    setShowForm(true);
  };
  const closeForm = () => {
    setShowForm(false);
    setShowReview(false);
  };
  const updateItemRow = (index: number, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const addItemRow = () => setItems((prev) => [...prev, { ...emptyItemRow }]);
  const removeItemRow = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  /** Shared by both "Review" and the final "Submit". */
  const buildPayloadItems = (): PurchaseRequestItemInput[] | null => {
    const payloadItems: PurchaseRequestItemInput[] = [];
    for (const row of items) {
      if (!row.itemName.trim() && !row.itemId) continue;
      const quantity = parseFloat(row.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setFormError("Every item needs a valid quantity.");
        return null;
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
      return null;
    }
    return payloadItems;
  };

  /** Form step's submit — validates, then hands off to the review step instead of creating anything yet. */
  const handleReviewForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildPayloadItems()) return;
    setFormError(null);
    setShowReview(true);
  };

  /** Review step's "Submit" — creates the PR and immediately submits it for approval. */
  const handleConfirmSubmit = async () => {
    const payloadItems = buildPayloadItems();
    if (!payloadItems) {
      setShowReview(false);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await createMutation.mutateAsync({
        projectId,
        input: { department: department.trim() || undefined, priority, reason: reason.trim() || undefined, items: payloadItems },
      });
      await createStatusMutation.mutateAsync({ id: created.id, status: "submitted" });
      await requestsQuery.refetch();
      closeForm();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to submit purchase request."));
    } finally {
      setSubmitting(false);
    }
  };

  const [drawerId, setDrawerId] = useState<number | null>(null);

  const kpis = useMemo(
    () => ({
      requests: requests.length,
      pendingApproval: requests.filter((r) => r.status === "submitted").length,
      orders: orders.length,
      activeOrders: orders.filter((o) => o.status !== "completed" && o.status !== "cancelled").length,
    }),
    [requests, orders],
  );

  const loading = requestsQuery.isLoading || ordersQuery.isLoading;
  const error = requestsQuery.isError
    ? getErrorMessage(requestsQuery.error, "Failed to load purchase requests.")
    : ordersQuery.isError
      ? getErrorMessage(ordersQuery.error, "Failed to load purchase orders.")
      : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading procurement…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <AlertCircle className="w-6 h-6 text-red-600" />
        <p className="text-[13px] text-slate-600">{error}</p>
        <button onClick={refresh} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded hover:bg-slate-50">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={`grid grid-cols-2 gap-3 ${isAdmin ? "sm:grid-cols-4" : ""}`}>
        <div className="p-3 bg-white border rounded-lg border-slate-200">
          <span className="text-[11px] font-medium text-slate-500">Purchase Requests</span>
          <div className="mt-2 text-[19px] font-bold leading-none tracking-tight text-slate-900">{kpis.requests}</div>
        </div>
        <div className="p-3 bg-white border rounded-lg border-slate-200">
          <span className="text-[11px] font-medium text-slate-500">Pending Approval</span>
          <div className="mt-2 text-[19px] font-bold leading-none tracking-tight text-slate-900">{kpis.pendingApproval}</div>
        </div>
        {isAdmin && (
          <>
            <div className="p-3 bg-white border rounded-lg border-slate-200">
              <span className="text-[11px] font-medium text-slate-500">Purchase Orders</span>
              <div className="mt-2 text-[19px] font-bold leading-none tracking-tight text-slate-900">{kpis.orders}</div>
            </div>
            <div className="p-3 bg-white border rounded-lg border-slate-200">
              <span className="text-[11px] font-medium text-slate-500">Active Orders</span>
              <div className="mt-2 text-[19px] font-bold leading-none tracking-tight text-slate-900">{kpis.activeOrders}</div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
          <ClipboardList size={15} className="text-slate-400" /> Purchase Requests
        </h3>
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
            className="flex items-center gap-2 px-3 py-2 bg-blue-900 text-white rounded-lg text-[12px] font-medium hover:bg-blue-800 transition-colors"
          >
            <Plus size={14} /> New Purchase Request
          </button>
        </div>
      </div>

      <div className="overflow-hidden bg-white border rounded-lg border-slate-200">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-slate-500 text-[12px]">No purchase requests for this project yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium text-left">PR #</th>
                  <th className="px-3 py-2 font-medium text-left">Items</th>
                  <th className="px-3 py-2 font-medium text-left">Priority</th>
                  <th className="px-3 py-2 font-medium text-left">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{r.prNumber || `#${r.id}`}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.items[0]?.itemName}
                      {r.items.length > 1 ? ` +${r.items.length - 1} more` : ""}
                    </td>
                    <td className={`px-3 py-2 font-medium capitalize ${PRIORITY_STYLES[r.priority]}`}>{r.priority}</td>
                    <td className="px-3 py-2"><PrStatusPill status={r.status} /></td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setDrawerId(r.id)} className="px-2 py-1 text-[11px] font-medium text-blue-900 rounded hover:bg-blue-50">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAdmin && (
        <>
          <h3 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
            <Package size={15} className="text-slate-400" /> Purchase Orders
          </h3>
          <div className="overflow-hidden bg-white border rounded-lg border-slate-200">
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-slate-500 text-[12px]">
                  No purchase orders yet — generate one from an approved purchase request's Vendor Selection.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                      <th className="px-3 py-2 font-medium text-left">PO #</th>
                      <th className="px-3 py-2 font-medium text-left">Vendor</th>
                      <th className="px-3 py-2 font-medium text-left">Type</th>
                      <th className="px-3 py-2 font-medium text-left">Status</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const s = PO_STATUS_STYLES[o.status];
                      return (
                        <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-800">{o.poNumber || `#${o.id}`}</td>
                          <td className="px-3 py-2 text-slate-600">{o.vendor?.name || "--"}</td>
                          <td className="px-3 py-2 text-slate-600 capitalize">{o.purchaseType}</td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: s.bg, color: s.fg }}>
                              {s.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => navigate(`/${organizationId}/purchase-orders/${o.id}`)}
                              className="px-2 py-1 text-[11px] font-medium text-blue-900 rounded hover:bg-blue-50"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showForm && !showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">New Purchase Request</h3>
              <button onClick={closeForm} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleReviewForm} className="p-4 space-y-3 overflow-y-auto">
              {formError && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">{formError}</div>}
              <div className="grid grid-cols-2 gap-3">
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
                  className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800"
                >
                  Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review step — everything just entered, read-only, before it's actually created+submitted. */}
      {showForm && showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">Review Purchase Request</h3>
              <button onClick={closeForm} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              {formError && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">{formError}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] font-medium text-slate-500">Department</div>
                  <div className="text-[13px] font-medium text-slate-900">{department.trim() || "--"}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-500">Priority</div>
                  <div className={`text-[13px] font-medium capitalize ${PRIORITY_STYLES[priority]}`}>{priority}</div>
                </div>
              </div>

              {reason.trim() && (
                <div>
                  <div className="text-[11px] font-medium text-slate-500">Reason</div>
                  <div className="text-[13px] text-slate-900">{reason.trim()}</div>
                </div>
              )}

              <div>
                <div className="mb-1.5 text-[11px] font-medium text-slate-500">Items</div>
                <div className="overflow-hidden border rounded-lg border-slate-200">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b bg-slate-50 border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                        <th className="px-3 py-2 font-medium text-left">Item</th>
                        <th className="px-3 py-2 font-medium text-right">Qty</th>
                        <th className="px-3 py-2 font-medium text-left">Unit</th>
                        <th className="px-3 py-2 font-medium text-right">Est. Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items
                        .filter((row) => row.itemName.trim() || row.itemId)
                        .map((row, i) => (
                          <tr key={i} className="border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2 text-slate-800">{row.itemName || "--"}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{row.quantity || "--"}</td>
                            <td className="px-3 py-2 text-slate-600">{row.unit || "--"}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{row.estimatedPrice || "--"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReview(false)}
                disabled={submitting}
                className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-60"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      <PurchaseRequestDetailDrawer
        id={drawerId}
        isAdmin={isAdmin}
        vendors={[]}
        onClose={() => setDrawerId(null)}
        onChanged={() => requestsQuery.refetch()}
      />
    </div>
  );
};

export default ProjectProcurementTab;
