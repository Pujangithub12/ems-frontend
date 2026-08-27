import React, { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Vendor } from "../../../types";
import { useCreateVendorMutation, useUpdateVendorMutation } from "../hooks/useInventory";
import { getErrorMessage } from "../../../lib/errors";

type VendorForm = {
  name: string;
  code: string;
  location: string;
  contact: string;
  contractExpiryDate: string;
  contactPerson: string;
  address: string;
  email: string;
};

const emptyForm: VendorForm = {
  name: "",
  code: "",
  location: "",
  contact: "",
  contractExpiryDate: "",
  contactPerson: "",
  address: "",
  email: "",
};

interface VendorFormModalProps {
  /** Pass an existing vendor to edit it in place; omit/null to create a new one. */
  editingVendor?: Vendor | null;
  onClose: () => void;
  onSaved: (vendor: Vendor) => void;
}

/**
 * Add/edit form for the vendor directory — the single source of truth for this form's fields
 * and validation. Used both by the Vendors page (full page context) and by VendorField's
 * "Add vendor" shortcut (e.g. the New Purchase Order form), so a new vendor can be created
 * without leaving the page that needed it.
 */
const VendorFormModal: React.FC<VendorFormModalProps> = ({ editingVendor, onClose, onSaved }) => {
  const createMutation = useCreateVendorMutation();
  const updateMutation = useUpdateVendorMutation();

  const [form, setForm] = useState<VendorForm>(
    editingVendor
      ? {
          name: editingVendor.name,
          code: editingVendor.code || "",
          location: editingVendor.location || "",
          contact: editingVendor.contact || "",
          contractExpiryDate: editingVendor.contractExpiryDate ? editingVendor.contractExpiryDate.slice(0, 10) : "",
          contactPerson: editingVendor.contactPerson || "",
          address: editingVendor.address || "",
          email: editingVendor.email || "",
        }
      : emptyForm,
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setFormError("Company name is required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const vendor = editingVendor
        ? await updateMutation.mutateAsync({
            vendorId: editingVendor.id,
            input: {
              name: trimmedName,
              code: form.code.trim(),
              location: form.location.trim(),
              contact: form.contact.trim(),
              contractExpiryDate: form.contractExpiryDate || null,
              contactPerson: form.contactPerson.trim(),
              address: form.address.trim(),
              email: form.email.trim(),
            },
          })
        : await createMutation.mutateAsync({
            name: trimmedName,
            code: form.code.trim() || undefined,
            location: form.location.trim() || undefined,
            contact: form.contact.trim() || undefined,
            ...(form.contractExpiryDate ? { contractExpiryDate: form.contractExpiryDate } : {}),
            contactPerson: form.contactPerson.trim() || undefined,
            address: form.address.trim() || undefined,
            email: form.email.trim() || undefined,
          });
      onSaved(vendor);
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save vendor."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-[14px] font-semibold text-slate-900">{editingVendor ? "Edit Vendor" : "Add Vendor"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {formError && (
            <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">{formError}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Name</label>
              <input
                autoFocus
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                placeholder="e.g. Anshuman Pani"
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Company name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Himalayan Solar Supplies"
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Phone</label>
              <input
                type="tel"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-900">Address</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2}
              placeholder="Used on generated Purchase Order PDFs"
              className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none resize-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-900">Contract expiry date</label>
            <input
              type="date"
              value={form.contractExpiryDate}
              onChange={(e) => setForm({ ...form, contractExpiryDate: e.target.value })}
              className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60 transition-colors"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingVendor ? "Save Changes" : "Add Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VendorFormModal;
