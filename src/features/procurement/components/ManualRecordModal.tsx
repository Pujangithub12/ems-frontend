import React, { useState } from "react";
import { X, Loader2, Plus } from "lucide-react";
import { FinancePurchaseOrderRow, Vendor } from "../../../types";
import { useOrganizationVendorsQuery } from "../../inventory/hooks/useInventory";
import { useProjects } from "../../projects/hooks/useProjects";
import {
  useCreateFinanceManualRecordMutation,
  useUpdateFinanceManualRecordMutation,
} from "../hooks/useFinance";
import VendorFormModal from "../../inventory/components/VendorFormModal";
import { SaveFinanceManualRecordInput } from "../api/finance.api";
import { getErrorMessage } from "../../../lib/errors";

const CURRENCY_OPTIONS = ["NPR", "INR", "USD", "RMB"] as const;

type ManualRecordForm = {
  vendorId: string; // "" = no linked vendor
  projectId: string; // "" = not linked to a project
  referenceNumber: string;
  lcNumber: string;
  itemValue: string;
  paymentTerms: string;
  currency: string;
};

const toForm = (row: FinancePurchaseOrderRow | null): ManualRecordForm => ({
  vendorId: row?.vendor ? String(row.vendor.id) : "",
  projectId: row?.project ? String(row.project.id) : "",
  referenceNumber: row?.poNumber || "",
  lcNumber: row?.lcNumber || "",
  itemValue: row ? String(row.itemValue) : "",
  paymentTerms: row?.paymentTerms || "",
  currency: row?.currency || "NPR",
});

/**
 * Create/edit a freeform Finance ledger row — one not derived from any real PurchaseOrder.
 * The vendor is picked from the org's vendor list (or added with the + button) so the row folds
 * into that vendor's Finance drilldown/totals; the record's item is named on its cost-breakdown page.
 */
const ManualRecordModal: React.FC<{
  editingRow: FinancePurchaseOrderRow | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ editingRow, onClose, onSaved }) => {
  const vendorsQuery = useOrganizationVendorsQuery();
  const vendors: Vendor[] = vendorsQuery.data ?? [];
  const projectsQuery = useProjects();
  const projects = projectsQuery.data ?? [];
  const createMutation = useCreateFinanceManualRecordMutation();
  const updateMutation = useUpdateFinanceManualRecordMutation();

  const [form, setForm] = useState<ManualRecordForm>(toForm(editingRow));
  // Items procured: on create these all become rows; on edit the existing ones are listed (managed on the
  // cost-breakdown page) and anything added here is appended as new rows.
  const existingItems = (editingRow?.itemNames ?? []).filter((n) => n.trim() !== "");
  const [items, setItems] = useState<string[]>([]);
  const [itemDraft, setItemDraft] = useState("");
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editingRow;

  const handleVendorSelect = (value: string) => {
    setForm({ ...form, vendorId: value });
  };

  /** Adds the typed item (comma-separated entries are split) to the list; returns the new list. */
  const commitDraft = (): string[] => {
    const typed = itemDraft.split(",").map((n) => n.trim()).filter(Boolean);
    const known = new Set([...existingItems, ...items].map((n) => n.toLowerCase()));
    const fresh = typed.filter((n, i) => !known.has(n.toLowerCase()) && typed.findIndex((t) => t.toLowerCase() === n.toLowerCase()) === i);
    const next = [...items, ...fresh];
    setItems(next);
    setItemDraft("");
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allNewItems = commitDraft();
    // An existing record may hold a freeform (unlinked) vendor name from before; keep it unless a vendor is picked.
    if (!form.vendorId && !editingRow?.vendorName) {
      setError("Select a vendor.");
      return;
    }
    if (!form.lcNumber.trim()) {
      setError("LC number is required.");
      return;
    }
    const itemValue = parseFloat(form.itemValue);
    if (!Number.isFinite(itemValue) || itemValue < 0) {
      setError("Enter a valid item value.");
      return;
    }

    const input: SaveFinanceManualRecordInput = {
      vendorName: form.vendorId ? undefined : editingRow?.vendorName || undefined,
      ...(isEditing ? { newItemNames: allNewItems } : { itemNames: allNewItems }),
      referenceNumber: form.referenceNumber.trim() || null,
      lcNumber: form.lcNumber.trim() || null,
      itemValue,
      paymentTerms: form.paymentTerms.trim() || null,
      vendorId: form.vendorId ? Number(form.vendorId) : null,
      projectId: form.projectId ? Number(form.projectId) : null,
      currency: form.currency,
    };

    setSubmitting(true);
    setError(null);
    try {
      if (isEditing && editingRow!.manualRecordId != null) {
        await updateMutation.mutateAsync({ id: editingRow!.manualRecordId, input });
      } else {
        await createMutation.mutateAsync(input);
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save record."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-[14px] font-semibold text-slate-900">{isEditing ? "Edit Record" : "Add New Record"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>
          )}

          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-900">Vendor</label>
            <div className="flex items-center gap-1.5">
              <select
                value={form.vendorId}
                onChange={(e) => handleVendorSelect(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-400"
              >
                <option value="">{editingRow?.vendorName && !editingRow.vendor ? `${editingRow.vendorName} (not linked)` : "-- Select a vendor --"}</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setVendorModalOpen(true)}
                title="Add new vendor"
                className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-white bg-blue-900 rounded hover:bg-blue-800"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-900">Project (optional)</label>
            <select
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-400"
            >
              <option value="">-- Not linked to a project --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-900">Item Procure</label>
            {(existingItems.length > 0 || items.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {existingItems.map((n) => (
                  <span key={`e-${n}`} className="px-2 py-0.5 text-[12px] text-slate-700 bg-slate-100 rounded-full">{n}</span>
                ))}
                {items.map((n) => (
                  <span key={n} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[12px] text-blue-900 bg-blue-50 rounded-full">
                    {n}
                    <button type="button" onClick={() => setItems(items.filter((i) => i !== n))} className="text-blue-700 hover:text-red-600" title="Remove">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <input
                value={itemDraft}
                onChange={(e) => setItemDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitDraft();
                  }
                }}
                placeholder="Type an item and press Enter to add more"
                className="flex-1 min-w-0 px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={commitDraft}
                disabled={!itemDraft.trim()}
                title="Add item"
                className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-40"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Reference #</label>
              <input
                value={form.referenceNumber}
                onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-900">LC Number <span className="text-red-600">*</span></label>
              <input
                value={form.lcNumber}
                onChange={(e) => setForm({ ...form, lcNumber: e.target.value })}
                placeholder="Required"
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-400"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Item Value</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.itemValue}
                onChange={(e) => setForm({ ...form, itemValue: e.target.value })}
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-900">Terms of Payment</label>
            <textarea
              rows={3}
              value={form.paymentTerms}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
              placeholder="Optional"
              className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none resize-y focus:border-blue-400"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
    {vendorModalOpen && (
      <VendorFormModal
        onClose={() => setVendorModalOpen(false)}
        onSaved={async (vendor) => {
          await vendorsQuery.refetch();
          setForm((f) => ({ ...f, vendorId: String(vendor.id) }));
          setVendorModalOpen(false);
        }}
      />
    )}
    </>
  );
};

export default ManualRecordModal;
