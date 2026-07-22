import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  AlertTriangle,
  PackageX,
  ChevronDown,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  ArrowRightLeft,
  PackagePlus,
  History,
  Download,
  DollarSign,
  Truck,
} from "lucide-react";
import { useAuth } from "../context/AuthProvider";
import { InventoryItem } from "../types";
import { InventoryItemInput } from "./inventoryApi";
import {
  useInventoryItemsQuery,
  useCreateInventoryItemMutation,
  useUpdateInventoryItemMutation,
  useDeleteInventoryItemMutation,
  useWorkspaceWarehousesQuery,
  useWorkspaceVendorsQuery,
} from "../hooks/useInventory";
import { toNumber, formatCost } from "./procurementApi";
import { getErrorMessage } from "../lib/errors";
import ConfirmationModal from "../components/ConfirmationModal";
import ComboBoxInput from "../components/ComboBoxInput";
import Pagination from "../components/Pagination";
import { useRowSelection } from "../hooks/useRowSelection";
import InventoryItemDrawer from "./InventoryItemDrawer";

interface ProjectInventoryTabProps {
  projectId: string;
}

type StatusFilter = "all" | InventoryItem["status"];

const STATUS_STYLES: Record<InventoryItem["status"], { bg: string; fg: string; label: string }> = {
  in_stock: { bg: "#DCFCE7", fg: "#15803D", label: "In Stock" },
  low_stock: { bg: "#FEF3C7", fg: "#B45309", label: "Low Stock" },
  out_of_stock: { bg: "#FEE2E2", fg: "#B91C1C", label: "Out of Stock" },
};

const CATEGORY_STYLES: Record<InventoryItem["category"], { bg: string; fg: string; label: string }> = {
  hardware: { bg: "#E0E7FF", fg: "#3730A3", label: "Hardware" },
  software: { bg: "#F3E8FF", fg: "#7E22CE", label: "Software" },
  service: { bg: "#CCFBF1", fg: "#0F766E", label: "Service" },
};

const QUANTITY_COLOR: Record<InventoryItem["status"], string> = {
  in_stock: "#15803D",
  low_stock: "#B45309",
  out_of_stock: "#B91C1C",
};

const StatusPill: React.FC<{ status: InventoryItem["status"] }> = ({ status }) => {
  const s = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] tracking-[0.05em] uppercase font-medium"
      style={{ fontFamily: "'JetBrains Mono', monospace", background: s.bg, color: s.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.fg }} />
      {s.label}
    </span>
  );
};

const CategoryPill: React.FC<{ category: InventoryItem["category"] }> = ({ category }) => {
  const c = CATEGORY_STYLES[category];
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium" style={{ background: c.bg, color: c.fg }}>
      {c.label}
    </span>
  );
};

const emptyForm: InventoryItemInput = {
  itemName: "",
  category: "hardware",
  quantity: 0,
  unit: "",
  status: "in_stock",
  lastRestockedDate: "",
  notes: "",
  sku: "",
  warehouseId: null,
  reservedQuantity: 0,
  incomingQuantity: 0,
  averageCost: null,
  supplier: "",
  vendorId: null,
};

const KpiCard: React.FC<{ label: string; value: string; icon: React.ReactNode; iconBg: string }> = ({ label, value, icon, iconBg }) => (
  <div className="p-3 bg-white border rounded-lg border-slate-200">
    <div className="flex items-start justify-between">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <div className={`flex items-center justify-center flex-shrink-0 rounded-lg w-7 h-7 ${iconBg}`}>{icon}</div>
    </div>
    <div className="mt-2 text-[19px] font-bold leading-none tracking-tight text-slate-900">{value}</div>
  </div>
);

const ProjectInventoryTab: React.FC<ProjectInventoryTabProps> = ({ projectId }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const itemsQuery = useInventoryItemsQuery(projectId);
  const items = itemsQuery.data ?? [];
  const loading = itemsQuery.isLoading;
  const error = itemsQuery.isError
    ? getErrorMessage(itemsQuery.error, "Failed to load inventory items.")
    : null;
  const [refreshing, setRefreshing] = useState(false);

  const warehousesQuery = useWorkspaceWarehousesQuery();
  const warehouses = warehousesQuery.data ?? [];
  const vendorsQuery = useWorkspaceVendorsQuery();
  const vendors = vendorsQuery.data ?? [];

  const createMutation = useCreateInventoryItemMutation();
  const updateMutation = useUpdateInventoryItemMutation();
  const deleteMutation = useDeleteInventoryItemMutation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<InventoryItemInput>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [drawerItemId, setDrawerItemId] = useState<number | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    await itemsQuery.refetch();
    setRefreshing(false);
  };

  const filteredItems = useMemo(() => {
    let rows = items;
    if (statusFilter !== "all") rows = rows.filter((it) => it.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((it) => it.itemName.toLowerCase().includes(q) || (it.sku || "").toLowerCase().includes(q));
    }
    return rows;
  }, [items, search, statusFilter]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const rowSelection = useRowSelection(pageItems.map((it) => it.id));

  const kpis = useMemo(
    () => ({
      totalValue: items.reduce((sum, i) => sum + toNumber(i.averageCost) * i.quantity, 0),
      lowStock: items.filter((i) => i.status === "low_stock").length,
      outOfStock: items.filter((i) => i.status === "out_of_stock").length,
      reserved: items.reduce((sum, i) => sum + (i.reservedQuantity || 0), 0),
      incoming: items.reduce((sum, i) => sum + (i.incomingQuantity || 0), 0),
    }),
    [items],
  );

  const itemNameOptions = useMemo(() => items.map((i) => i.itemName), [items]);

  const openCreateForm = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (item: InventoryItem) => {
    setEditingItem(item);
    setForm({
      itemName: item.itemName,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit || "",
      status: item.status,
      lastRestockedDate: item.lastRestockedDate ? item.lastRestockedDate.slice(0, 10) : "",
      notes: item.notes || "",
      sku: item.sku || "",
      warehouseId: item.warehouse?.id ?? null,
      reservedQuantity: item.reservedQuantity || 0,
      incomingQuantity: item.incomingQuantity || 0,
      averageCost: item.averageCost != null ? toNumber(item.averageCost) : null,
      supplier: item.supplier || "",
      vendorId: item.vendor?.id ?? null,
      warrantyExpiryDate: item.warrantyExpiryDate ? item.warrantyExpiryDate.slice(0, 10) : "",
    });
    setFormError(null);
    setShowForm(true);
    setMenuOpenId(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = form.itemName.trim();
    if (!trimmedName) {
      setFormError("Item name is required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const payload: InventoryItemInput = {
        itemName: trimmedName,
        category: form.category || "hardware",
        quantity: form.quantity && form.quantity > 0 ? form.quantity : 0,
        unit: form.unit?.trim() || undefined,
        status: form.status || "in_stock",
        lastRestockedDate: form.lastRestockedDate || null,
        notes: form.notes?.trim() || undefined,
        sku: form.sku?.trim() || undefined,
        warehouseId: form.warehouseId || null,
        reservedQuantity: form.reservedQuantity || 0,
        incomingQuantity: form.incomingQuantity || 0,
        averageCost: form.averageCost != null && `${form.averageCost}` !== "" ? Number(form.averageCost) : null,
        supplier: form.supplier?.trim() || undefined,
        vendorId: form.vendorId || null,
        warrantyExpiryDate: form.warrantyExpiryDate || null,
      };
      if (editingItem) {
        await updateMutation.mutateAsync({ itemId: editingItem.id, input: payload });
      } else {
        await createMutation.mutateAsync({ projectId, input: payload });
      }
      await itemsQuery.refetch();
      closeForm();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save inventory item."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (item: InventoryItem, status: InventoryItem["status"]) => {
    setActionError(null);
    setStatusUpdatingId(item.id);
    try {
      await updateMutation.mutateAsync({ itemId: item.id, input: { status } });
      await itemsQuery.refetch();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to update status."));
    } finally {
      setStatusUpdatingId(null);
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
      setActionError(getErrorMessage(err, "Failed to delete inventory item."));
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (rowSelection.selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${rowSelection.selectedIds.length} selected item(s)? This cannot be undone.`)) return;
    setActionError(null);
    try {
      for (const id of rowSelection.selectedIds) {
        await deleteMutation.mutateAsync(id);
      }
      await itemsQuery.refetch();
      rowSelection.clear();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to delete selected items."));
    }
  };

  const handleExport = (rows: InventoryItem[]) => {
    const sheetRows = rows.map((it) => ({
      "Item Name": it.itemName,
      SKU: it.sku || "",
      Category: it.category,
      Warehouse: it.warehouse?.name || "",
      Quantity: it.quantity,
      Reserved: it.reservedQuantity,
      Incoming: it.incomingQuantity,
      Unit: it.unit || "",
      "Average Cost": toNumber(it.averageCost),
      Supplier: it.vendor?.name || it.supplier || "",
      Status: it.status,
    }));
    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    XLSX.writeFile(workbook, `inventory-project-${projectId}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading inventory…</p>
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
    <div className="flex flex-col gap-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard label="Total Value" value={formatCost(kpis.totalValue)} icon={<DollarSign className="w-4 h-4 text-blue-700" />} iconBg="bg-blue-50" />
        <KpiCard label="Total SKUs" value={String(items.length)} icon={<Package className="w-4 h-4 text-slate-700" />} iconBg="bg-slate-100" />
        <KpiCard label="Low Stock" value={String(kpis.lowStock)} icon={<AlertTriangle className="w-4 h-4 text-amber-700" />} iconBg="bg-amber-50" />
        <KpiCard label="Out of Stock" value={String(kpis.outOfStock)} icon={<PackageX className="w-4 h-4 text-red-700" />} iconBg="bg-red-50" />
        <KpiCard label="Incoming" value={String(kpis.incoming)} icon={<Truck className="w-4 h-4 text-teal-700" />} iconBg="bg-teal-50" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search items, SKU..."
              className="pl-8 pr-3 py-2 w-64 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
              className="pl-3 pr-8 py-2 text-[12px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors"
            >
              <option value="all">All</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
            <ChevronDown className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none right-2.5 top-1/2 text-slate-400" />
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
            onClick={() => handleExport(filteredItems)}
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50"
          >
            <Download size={13} /> Export
          </button>
          {isAdmin && (
            <button
              onClick={openCreateForm}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg text-[12px] font-medium hover:bg-blue-800 transition-colors"
            >
              <Plus size={14} /> Add Item
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="flex items-center justify-between px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {rowSelection.someSelected && isAdmin && (
        <div className="flex items-center justify-between px-3 py-2 text-[12px] border rounded bg-blue-50 border-blue-200 text-blue-900">
          <span>{rowSelection.selectedIds.length} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => handleExport(items.filter((it) => rowSelection.selected.has(it.id)))} className="px-2 py-1 font-medium rounded hover:bg-blue-100">
              Export Selected
            </button>
            <button onClick={handleBulkDelete} className="px-2 py-1 font-medium text-red-700 rounded hover:bg-red-50">
              Delete Selected
            </button>
            <button onClick={rowSelection.clear} className="p-1 rounded hover:bg-blue-100">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-lg border-slate-200">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
              <Package className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
              No inventory items{statusFilter !== "all" || search ? " match your filters" : " yet"}
            </h3>
            <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
              {isAdmin && statusFilter === "all" && !search
                ? "Add an item to start tracking stock for this project."
                : "Try adjusting your search or status filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                  {isAdmin && (
                    <th className="w-8 px-3 py-2">
                      <input type="checkbox" checked={rowSelection.allSelected} onChange={rowSelection.toggleAll} className="w-3.5 h-3.5 text-blue-900 border-slate-300 rounded focus:ring-blue-900" />
                    </th>
                  )}
                  <th className="px-3 py-2 font-medium text-left">Item</th>
                  <th className="px-3 py-2 font-medium text-left">SKU</th>
                  <th className="px-3 py-2 font-medium text-left">Category</th>
                  <th className="px-3 py-2 font-medium text-left">Warehouse</th>
                  <th className="px-3 py-2 font-medium text-left">Stock</th>
                  <th className="px-3 py-2 font-medium text-left">Value</th>
                  <th className="px-3 py-2 font-medium text-left">Supplier</th>
                  <th className="px-3 py-2 font-medium text-left">Date</th>
                  <th className="px-3 py-2 font-medium text-left">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => {
                  const value = toNumber(item.averageCost) * item.quantity;
                  return (
                    <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      {isAdmin && (
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={rowSelection.selected.has(item.id)} onChange={() => rowSelection.toggle(item.id)} className="w-3.5 h-3.5 text-blue-900 border-slate-300 rounded focus:ring-blue-900" />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <button onClick={() => setDrawerItemId(item.id)} className="font-medium text-left text-slate-800 hover:text-blue-900 hover:underline">
                          {item.itemName}
                        </button>
                        {item.notes && <div className="text-slate-400 text-[11px] truncate max-w-[200px]">{item.notes}</div>}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{item.sku || "--"}</td>
                      <td className="px-3 py-2"><CategoryPill category={item.category} /></td>
                      <td className="px-3 py-2 text-slate-600">{item.warehouse?.name || "--"}</td>
                      <td className="px-3 py-2 font-semibold" style={{ color: QUANTITY_COLOR[item.status] }}>
                        {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{formatCost(value)}</td>
                      <td className="px-3 py-2 text-slate-600">{item.vendor?.name || item.supplier || "--"}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {item.lastRestockedDate
                          ? new Date(item.lastRestockedDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                          : "--"}
                      </td>
                      <td className="px-3 py-2">
                        {isAdmin ? (
                          <select
                            value={item.status}
                            disabled={statusUpdatingId === item.id}
                            onChange={(e) => handleStatusChange(item, e.target.value as InventoryItem["status"])}
                            className="pr-6 py-1 pl-2 text-[11px] font-medium bg-white border border-slate-200 rounded appearance-none cursor-pointer outline-none focus:border-blue-900 disabled:opacity-60"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            <option value="in_stock">In Stock</option>
                            <option value="low_stock">Low Stock</option>
                            <option value="out_of_stock">Out of Stock</option>
                          </select>
                        ) : (
                          <StatusPill status={item.status} />
                        )}
                      </td>
                      <td className="relative px-3 py-2 text-right">
                        <button onClick={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)} className="flex items-center justify-center w-7 h-7 ml-auto rounded text-slate-500 hover:bg-slate-100">
                          <MoreVertical size={14} />
                        </button>
                        {menuOpenId === item.id && (
                          <div className="absolute right-3 top-9 z-10 w-40 bg-white border rounded-lg shadow-lg border-slate-200 py-1">
                            <button onClick={() => { setDrawerItemId(item.id); setMenuOpenId(null); }} className="flex items-center w-full gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50">
                              <Eye size={13} /> View
                            </button>
                            {isAdmin && (
                              <>
                                <button onClick={() => openEditForm(item)} className="flex items-center w-full gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50">
                                  <Pencil size={13} /> Edit
                                </button>
                                <button onClick={() => { setDrawerItemId(item.id); setMenuOpenId(null); }} className="flex items-center w-full gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50">
                                  <ArrowRightLeft size={13} /> Transfer
                                </button>
                                <button onClick={() => { setDrawerItemId(item.id); setMenuOpenId(null); }} className="flex items-center w-full gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50">
                                  <PackagePlus size={13} /> Adjust Stock
                                </button>
                                <button onClick={() => { setDrawerItemId(item.id); setMenuOpenId(null); }} className="flex items-center w-full gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50">
                                  <History size={13} /> View History
                                </button>
                                <button onClick={() => { setDeleteTarget(item); setMenuOpenId(null); }} className="flex items-center w-full gap-2 px-3 py-1.5 text-left text-red-600 hover:bg-red-50">
                                  <Trash2 size={13} /> Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={filteredItems.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Add/Edit item modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">
                {editingItem ? "Edit Inventory Item" : "Add Inventory Item"}
              </h3>
              <button onClick={closeForm} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmitForm} className="p-4 space-y-3 overflow-y-auto">
              {formError && (
                <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Item name</label>
                  <ComboBoxInput
                    autoFocus
                    value={form.itemName}
                    onChange={(v) => setForm({ ...form, itemName: v })}
                    options={itemNameOptions}
                    placeholder="e.g. Solar panel mounting brackets"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">SKU</label>
                  <input
                    value={form.sku || ""}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Category</label>
                  <div className="relative">
                    <select
                      value={form.category || "hardware"}
                      onChange={(e) => setForm({ ...form, category: e.target.value as InventoryItem["category"] })}
                      className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded appearance-none cursor-pointer outline-none focus:border-blue-400"
                    >
                      <option value="hardware">Hardware</option>
                      <option value="software">Software</option>
                      <option value="service">Service</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Quantity</label>
                  <input
                    type="number"
                    min={0}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Unit</label>
                  <input
                    value={form.unit || ""}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="meter, kg, etc"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Warehouse</label>
                  <div className="relative">
                    <select
                      value={form.warehouseId ?? ""}
                      onChange={(e) => setForm({ ...form, warehouseId: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded appearance-none cursor-pointer outline-none focus:border-blue-400"
                    >
                      <option value="">Unassigned</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Average cost</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.averageCost ?? ""}
                    onChange={(e) => setForm({ ...form, averageCost: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Date</label>
                  <input
                    type="date"
                    value={form.lastRestockedDate || ""}
                    onChange={(e) => setForm({ ...form, lastRestockedDate: e.target.value })}
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Vendor</label>
                  <div className="relative">
                    <select
                      value={form.vendorId ?? ""}
                      onChange={(e) => setForm({ ...form, vendorId: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded appearance-none cursor-pointer outline-none focus:border-blue-400"
                    >
                      <option value="">No vendor</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-500">Status</label>
                <div className="relative">
                  <select
                    value={form.status || "in_stock"}
                    onChange={(e) => setForm({ ...form, status: e.target.value as InventoryItem["status"] })}
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded appearance-none cursor-pointer outline-none focus:border-blue-400"
                  >
                    <option value="in_stock">In Stock</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-500">Notes</label>
                <textarea
                  value={form.notes || ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Optional"
                  className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400 resize-none"
                />
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
                  {editingItem ? "Save Changes" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <InventoryItemDrawer
        itemId={drawerItemId}
        onClose={() => setDrawerItemId(null)}
        isAdmin={isAdmin}
        warehouses={warehouses}
        onChanged={() => itemsQuery.refetch()}
      />

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleting}
        title="Delete Inventory Item"
        message={`Delete "${deleteTarget?.itemName}"? This cannot be undone.`}
      />
    </div>
  );
};

export default ProjectInventoryTab;
