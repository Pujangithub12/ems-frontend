import React, { useMemo, useState } from "react";
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  Pencil,
  Trash2,
  Hash,
} from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { CatalogItem } from "../../../types";
import {
  useOrganizationItemCatalogQuery,
  useCreateCatalogItemMutation,
  useUpdateCatalogItemMutation,
  useDeleteCatalogItemMutation,
} from "../../inventory/hooks/useInventory";
import { getErrorMessage } from "../../../lib/errors";
import ConfirmationModal from "../../../components/ConfirmationModal";

type ItemForm = { name: string; code: string };
const emptyForm: ItemForm = { name: "", code: "" };

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "--";

const KpiCard: React.FC<{ label: string; value: string; icon: React.ReactNode; iconBg: string }> = ({ label, value, icon, iconBg }) => (
  <div className="p-3 bg-white border rounded-xl shadow-md border-slate-200">
    <div className="flex items-start justify-between">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <div className={`flex items-center justify-center flex-shrink-0 rounded-lg w-7 h-7 ring-1 ring-black/5 ${iconBg}`}>{icon}</div>
    </div>
    <div className="mt-2 text-[19px] font-bold leading-none tracking-tight text-slate-900">{value}</div>
  </div>
);

/**
 * Organization-wide item catalog (under the Procurement group). Backed by the same
 * shared CatalogItem CRUD the Inventory and Procurement "Add item" pickers use, so
 * an item added/edited here shows up in every item dropdown and vice-versa.
 */
const ItemsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const itemsQuery = useOrganizationItemCatalogQuery();
  const items = itemsQuery.data ?? [];
  const loading = itemsQuery.isLoading;
  const error = itemsQuery.isError
    ? getErrorMessage(itemsQuery.error, "Failed to load items.")
    : null;
  const [refreshing, setRefreshing] = useState(false);

  const createMutation = useCreateCatalogItemMutation();
  const updateMutation = useUpdateCatalogItemMutation();
  const deleteMutation = useDeleteCatalogItemMutation();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    await itemsQuery.refetch();
    setRefreshing(false);
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? items.filter(
          (i) => i.name.toLowerCase().includes(q) || (i.code || "").toLowerCase().includes(q),
        )
      : items;
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, search]);

  const kpis = useMemo(
    () => ({
      total: items.length,
      withCode: items.filter((i) => !!i.code).length,
    }),
    [items],
  );

  const openCreateForm = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (item: CatalogItem) => {
    setEditingItem(item);
    setForm({ name: item.name, code: item.code || "" });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setFormError("Item name is required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          itemId: editingItem.id,
          input: { name: trimmedName, code: form.code.trim() },
        });
      } else {
        await createMutation.mutateAsync({
          name: trimmedName,
          code: form.code.trim() || undefined,
        });
      }
      await itemsQuery.refetch();
      closeForm();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save item."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      await itemsQuery.refetch();
      setDeleteTarget(null);
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to delete item."));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading items…</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full p-6 bg-white lg:px-8 lg:py-8">
      {error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex items-center justify-center w-12 h-12 mb-1 rounded-full bg-gradient-to-br from-red-50 to-red-100 ring-1 ring-red-100">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-[13px] text-slate-600">{error}</p>
          <button onClick={refresh} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col w-full min-w-0 gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <KpiCard label="Total Items" value={String(kpis.total)} icon={<Package className="w-4 h-4 text-blue-700" />} iconBg="bg-blue-50" />
            <KpiCard label="With Code" value={String(kpis.withCode)} icon={<Hash className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50" />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items, code..."
                className="pl-8 pr-3 py-2 w-64 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:bg-white transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                className="flex items-center justify-center w-8 h-8 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
                title="Refresh"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              </button>
              {isAdmin && (
                <button
                  onClick={openCreateForm}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg text-[12px] font-medium hover:bg-blue-800 transition-colors shadow-sm"
                >
                  <Plus size={14} /> Add Item
                </button>
              )}
            </div>
          </div>

          {actionError && (
            <div className="flex items-center justify-between px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">
              <span>{actionError}</span>
              <button onClick={() => setActionError(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
                  <Package className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
                  No items{search ? " match your search" : " yet"}
                </h3>
                <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                  {isAdmin && !search
                    ? "Add an item to start building the shared catalog."
                    : "Try adjusting your search."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                      <th className="px-3 py-2 font-medium text-left">Item Name</th>
                      <th className="px-3 py-2 font-medium text-left">Code</th>
                      <th className="px-3 py-2 font-medium text-left">Added</th>
                      {isAdmin && <th className="px-3 py-2 font-medium text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((i) => (
                      <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 text-[11px] font-semibold text-blue-900 rounded-full bg-blue-50">
                              {i.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-slate-800">{i.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {i.code ? (
                            <span className="inline-flex items-center gap-1">
                              <Hash size={11} className="text-slate-400" />
                              {i.code}
                            </span>
                          ) : (
                            "--"
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{formatDate(i.createdAt)}</td>
                        {isAdmin && (
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditForm(i)}
                                title="Edit"
                                className="p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(i)}
                                title="Delete"
                                className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit item modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">
                {editingItem ? "Edit Item" : "Add Item"}
              </h3>
              <button onClick={closeForm} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmitForm} className="p-4 space-y-3">
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
                <button type="button" onClick={closeForm} className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
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
      )}

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleting}
        title="Delete Item"
        message={`Delete "${deleteTarget?.name}"? Purchase orders and inventory referencing this item will keep their records but lose the catalog link. This cannot be undone.`}
      />
    </div>
  );
};

export default ItemsPage;
