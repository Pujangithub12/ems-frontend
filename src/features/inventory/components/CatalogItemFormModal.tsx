import React, { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { CatalogItem } from "../../../types";
import { useCreateCatalogItemMutation, useUpdateCatalogItemMutation } from "../hooks/useInventory";
import { getErrorMessage } from "../../../lib/errors";

type ItemForm = { name: string; code: string };

interface CatalogItemFormModalProps {
  /** Pass an existing item to edit it in place; omit/null to create a new one. */
  editingItem?: CatalogItem | null;
  onClose: () => void;
  onSaved: (item: CatalogItem) => void;
}

/**
 * Add/edit form for the shared item catalog — the single source of truth for this form's
 * fields and validation. Used both by the Items page (full page context) and by ItemNameField's
 * "Add new item" shortcut (e.g. the Purchase Order Overview tab's Add Item form), so a new item
 * can be created without leaving the page that needed it.
 */
const CatalogItemFormModal: React.FC<CatalogItemFormModalProps> = ({ editingItem, onClose, onSaved }) => {
  const createMutation = useCreateCatalogItemMutation();
  const updateMutation = useUpdateCatalogItemMutation();

  const [form, setForm] = useState<ItemForm>(
    editingItem ? { name: editingItem.name, code: editingItem.code || "" } : { name: "", code: "" },
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setFormError("Item name is required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const item = editingItem
        ? await updateMutation.mutateAsync({
            itemId: editingItem.id,
            input: { name: trimmedName, code: form.code.trim() },
          })
        : await createMutation.mutateAsync({ name: trimmedName, code: form.code.trim() || undefined });
      onSaved(item);
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save item."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-[14px] font-semibold text-slate-900">{editingItem ? "Edit Item" : "Add Item"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {formError && (
            <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">{formError}</div>
          )}
          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-900">Item name</label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Steel Tubular Pole"
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
              {editingItem ? "Save Changes" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CatalogItemFormModal;
