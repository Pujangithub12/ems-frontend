import React, { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { FinancePurchaseOrderRow, Vendor } from "../../../types";
import { useOrganizationVendorsQuery } from "../../inventory/hooks/useInventory";
import {
  useCreateFinanceManualRecordMutation,
  useUpdateFinanceManualRecordMutation,
} from "../hooks/useFinance";
import { SaveFinanceManualRecordInput } from "../api/finance.api";
import { getErrorMessage } from "../../../lib/errors";

type ManualRecordForm = {
  vendorId: string; // "" = no linked vendor, freeform vendorName below
  vendorName: string;
  itemName: string;
  referenceNumber: string;
  itemValue: string;
  paymentTerms: string;
};

const toForm = (row: FinancePurchaseOrderRow | null): ManualRecordForm => ({
  vendorId: row?.vendor ? String(row.vendor.id) : "",
  vendorName: row?.vendorName || row?.vendor?.name || "",
  itemName: row?.itemNames[0] || "",
  referenceNumber: row?.poNumber || "",
  itemValue: row ? String(row.itemValue) : "",
  paymentTerms: row?.paymentTerms || "",
});

/**
 * Create/edit a freeform Finance ledger row — one not derived from any real PurchaseOrder.
 * Vendor can either be picked from the org's existing vendor list (so the row folds into that
 * vendor's Finance drilldown/totals) or typed as plain text when there's no vendor record for it.
 */
const ManualRecordModal: React.FC<{
  editingRow: FinancePurchaseOrderRow | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ editingRow, onClose, onSaved }) => {
  const vendorsQuery = useOrganizationVendorsQuery();
  const vendors: Vendor[] = vendorsQuery.data ?? [];
  const createMutation = useCreateFinanceManualRecordMutation();
  const updateMutation = useUpdateFinanceManualRecordMutation();

  const [form, setForm] = useState<ManualRecordForm>(toForm(editingRow));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editingRow;

  const handleVendorSelect = (value: string) => {
    const selected = vendors.find((v) => String(v.id) === value);
    setForm({ ...form, vendorId: value, vendorName: selected ? selected.name : form.vendorName });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vendorName.trim()) {
      setError("Vendor name is required.");
      return;
    }
    if (!form.itemName.trim()) {
      setError("Part / item name is required.");
      return;
    }
    const itemValue = parseFloat(form.itemValue);
    if (!Number.isFinite(itemValue) || itemValue < 0) {
      setError("Enter a valid item value.");
      return;
    }

    const input: SaveFinanceManualRecordInput = {
      vendorName: form.vendorName.trim(),
      itemName: form.itemName.trim(),
      referenceNumber: form.referenceNumber.trim() || null,
      itemValue,
      paymentTerms: form.paymentTerms.trim() || null,
      vendorId: form.vendorId ? Number(form.vendorId) : null,
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
            <label className="block mb-1 text-[11px] font-medium text-slate-900">Vendor (existing, optional)</label>
            <select
              value={form.vendorId}
              onChange={(e) => handleVendorSelect(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-400"
            >
              <option value="">-- Not linked to a vendor record --</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-900">Vendor Name</label>
            <input
              autoFocus
              value={form.vendorName}
              onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
              placeholder="Vendor / supplier name"
              className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-900">Part / Item Name</label>
            <input
              value={form.itemName}
              onChange={(e) => setForm({ ...form, itemName: e.target.value })}
              className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Item Procure (ref #)</label>
              <input
                value={form.referenceNumber}
                onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              />
            </div>
            <div>
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
            <input
              value={form.paymentTerms}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
              placeholder="Optional"
              className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
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
  );
};

export default ManualRecordModal;
