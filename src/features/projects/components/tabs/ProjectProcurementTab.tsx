import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Package, Plus, RefreshCw, Loader2, AlertCircle, X } from "lucide-react";
import { useAuth } from "../../../../context/AuthProvider";
import { Project } from "../../../../types";
import { getErrorMessage } from "../../../../lib/errors";
import VendorField from "../../../inventory/components/VendorField";
import VendorFormModal from "../../../inventory/components/VendorFormModal";
import { useOrganizationVendorsQuery } from "../../../inventory/hooks/useInventory";
import { usePurchaseOrdersQuery, useCreatePurchaseOrderMutation } from "../../../procurement/hooks/usePurchaseOrder";

interface ProjectProcurementTabProps {
  project: Project;
}

const PO_STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  created: { bg: "#f1f5f9", fg: "#475569", label: "Created" },
  sent: { bg: "#fef9c3", fg: "#854d0e", label: "Sent" },
  accepted: { bg: "#dbeafe", fg: "#1e40af", label: "Accepted" },
  cancelled: { bg: "#fee2e2", fg: "#991b1b", label: "Cancelled" },
  completed: { bg: "#dcfce7", fg: "#166534", label: "Completed" },
};

/**
 * Project-scoped view of the procurement pipeline v2 (Purchase Orders only —
 * there used to be a Purchase Request + Vendor Selection step ahead of this,
 * removed along with its data; POs are now created directly here, vendor only —
 * line items are added afterward from the detail page's Overview tab). Admin-only,
 * matching the org-wide Purchase Orders page and Vendors page being
 * admin-territory throughout this app.
 */
const ProjectProcurementTab: React.FC<ProjectProcurementTabProps> = ({ project }) => {
  const projectId = String(project.id);
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const ordersQuery = usePurchaseOrdersQuery(projectId);
  const orders = ordersQuery.data ?? [];

  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await ordersQuery.refetch();
    setRefreshing(false);
  };

  // ---- Create Purchase Order form ----
  const [showForm, setShowForm] = useState(false);
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const createMutation = useCreatePurchaseOrderMutation();
  const vendorsQuery = useOrganizationVendorsQuery();

  const openCreateForm = () => {
    setVendorId(null);
    setFormError(null);
    setShowForm(true);
  };
  const closeForm = () => setShowForm(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    setSubmitting(true);
    try {
      await createMutation.mutateAsync({ projectId, input: { vendorId } });
      closeForm();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to create purchase order."));
    } finally {
      setSubmitting(false);
    }
  };

  const kpis = useMemo(
    () => ({
      orders: orders.length,
      activeOrders: orders.filter((o) => o.status !== "completed" && o.status !== "cancelled").length,
    }),
    [orders],
  );

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Package className="w-6 h-6 text-slate-300" />
        <p className="text-[13px] text-slate-500">Procurement is managed by administrators.</p>
      </div>
    );
  }

  if (ordersQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading procurement…</p>
      </div>
    );
  }

  if (ordersQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <AlertCircle className="w-6 h-6 text-red-600" />
        <p className="text-[13px] text-slate-600">{getErrorMessage(ordersQuery.error, "Failed to load purchase orders.")}</p>
        <button onClick={refresh} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded hover:bg-slate-50">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-white border rounded-lg border-slate-200">
          <span className="text-[11px] font-medium text-slate-500">Purchase Orders</span>
          <div className="mt-2 text-[19px] font-bold leading-none tracking-tight text-slate-900">{kpis.orders}</div>
        </div>
        <div className="p-3 bg-white border rounded-lg border-slate-200">
          <span className="text-[11px] font-medium text-slate-500">Active Orders</span>
          <div className="mt-2 text-[19px] font-bold leading-none tracking-tight text-slate-900">{kpis.activeOrders}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
          <Package size={15} className="text-slate-400" /> Purchase Orders
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
            <Plus size={14} /> New Purchase Order
          </button>
        </div>
      </div>

      <div className="overflow-hidden bg-white border rounded-lg border-slate-200">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-slate-500 text-[12px]">No purchase orders for this project yet.</p>
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">New Purchase Order</h3>
              <button onClick={closeForm} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto">
              {formError && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">{formError}</div>}
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-900">Vendor</label>
                <VendorField vendorId={vendorId} onSelect={setVendorId} onAddNew={() => setVendorModalOpen(true)} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeForm} disabled={submitting} className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-60">
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
        </div>
      )}

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

export default ProjectProcurementTab;
