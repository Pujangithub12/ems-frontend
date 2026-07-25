import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ShoppingCart,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  ChevronDown,
  Eye,
  Download,
  DollarSign,
  FileStack,
  Clock3,
} from "lucide-react";
import { useAuth } from "../../../../context/AuthProvider";
import { Project, ProcurementItem } from "../../../../types";
import { formatCost, toNumber, computeItemCostBreakdown, ProcurementItemInput } from "../../../procurement/api/procurement.api";
import {
  useProcurementItemsQuery,
  useCreateProcurementItemMutation,
  useUpdateProcurementItemMutation,
  useDeleteProcurementItemMutation,
} from "../../../procurement/hooks/useProcurement";
import { useWorkspaceVendorsQuery } from "../../../inventory/hooks/useInventory";
import { getErrorMessage } from "../../../../lib/errors";
import ConfirmationModal from "../../../../components/ConfirmationModal";
import ComboBoxInput from "../../../../components/ComboBoxInput";
import Pagination from "../../../../components/Pagination";
import { useRowSelection } from "../../../../hooks/useRowSelection";
import ProcurementItemDrawer from "../../../procurement/components/ProcurementItemDrawer";
import ProcurementItemGroupDrawer from "../../../procurement/components/ProcurementItemGroupDrawer";
import { STATUS_STYLES, CATEGORY_STYLES } from "../../../procurement/components/statusStyles";
import { groupProcurementItems } from "../../../procurement/utils/groupProcurementItems";

interface ProjectProcurementTabProps {
  project: Project;
}

type StatusFilter = "all" | ProcurementItem["status"];

const CategoryPill: React.FC<{ category: ProcurementItem["category"] }> = ({ category }) => {
  const c = CATEGORY_STYLES[category];
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium" style={{ background: c.bg, color: c.fg }}>
      {c.label}
    </span>
  );
};

const emptyForm: ProcurementItemInput = {
  itemName: "",
  category: "hardware",
  quantity: 1,
  unit: undefined,
  estimatedCost: undefined,
  unitCost: undefined,
  taxPercent: undefined,
  discountPercent: undefined,
  transportCost: undefined,
  customsCost: undefined,
  vendorId: null,
  neededByDate: "",
  notes: "",
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

const ProjectProcurementTab: React.FC<ProjectProcurementTabProps> = ({ project }) => {
  const projectId = String(project.id);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const itemsQuery = useProcurementItemsQuery(projectId);
  const items = itemsQuery.data ?? [];
  const loading = itemsQuery.isLoading;
  const error = itemsQuery.isError
    ? getErrorMessage(itemsQuery.error, "Failed to load procurement items.")
    : null;
  const [refreshing, setRefreshing] = useState(false);

  const createMutation = useCreateProcurementItemMutation();
  const updateMutation = useUpdateProcurementItemMutation();
  const deleteMutation = useDeleteProcurementItemMutation();
  const vendorsQuery = useWorkspaceVendorsQuery();
  const vendors = vendorsQuery.data ?? [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ProcurementItem | null>(null);
  const [form, setForm] = useState<ProcurementItemInput>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProcurementItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [drawerItemId, setDrawerItemId] = useState<number | null>(null);
  const [drawerGroupKey, setDrawerGroupKey] = useState<string | null>(null);

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
      rows = rows.filter(
        (it) =>
          it.itemName.toLowerCase().includes(q) ||
          (it.vendor?.name || it.vendorName || "").toLowerCase().includes(q) ||
          (it.poNumber || "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [items, search, statusFilter]);

  // One row per item (see groupProcurementItems) — repeat requests for the
  // same item within this project fold together, same as the workspace-wide
  // Procurement page; the group's drawer lists each underlying request.
  const groupedItems = useMemo(() => groupProcurementItems(filteredItems), [filteredItems]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return groupedItems.slice(start, start + pageSize);
  }, [groupedItems, page, pageSize]);

  const rowSelection = useRowSelection<string>(pageItems.map((g) => g.key));
  const groupByKey = useMemo(() => new Map(groupedItems.map((g) => [g.key, g])), [groupedItems]);

  const kpis = useMemo(() => {
    const now = Date.now();
    return {
      totalValue: items.reduce((sum, i) => sum + computeItemCostBreakdown(i).total, 0),
      pending: items.filter((i) => i.status === "pending").length,
      overdue: items.filter((i) => i.status !== "delivered" && i.neededByDate && new Date(i.neededByDate).getTime() < now).length,
    };
  }, [items]);

  const itemNameOptions = useMemo(() => items.map((i) => i.itemName), [items]);

  const openCreateForm = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (item: ProcurementItem) => {
    setEditingItem(item);
    setForm({
      itemName: item.itemName,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit || undefined,
      estimatedCost: item.estimatedCost != null ? toNumber(item.estimatedCost) : undefined,
      unitCost: item.unitCost != null ? toNumber(item.unitCost) : undefined,
      taxPercent: item.taxPercent != null ? toNumber(item.taxPercent) : undefined,
      discountPercent: item.discountPercent != null ? toNumber(item.discountPercent) : undefined,
      transportCost: item.transportCost != null ? toNumber(item.transportCost) : undefined,
      customsCost: item.customsCost != null ? toNumber(item.customsCost) : undefined,
      vendorId: item.vendor?.id ?? null,
      neededByDate: item.neededByDate ? item.neededByDate.slice(0, 10) : "",
      notes: item.notes || "",
    });
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
    const trimmedName = form.itemName.trim();
    if (!trimmedName) {
      setFormError("Item name is required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const payload: ProcurementItemInput = {
        itemName: trimmedName,
        category: form.category || "hardware",
        quantity: form.quantity && form.quantity > 0 ? form.quantity : 1,
        unit: form.unit?.trim() || undefined,
        estimatedCost:
          form.estimatedCost !== undefined && form.estimatedCost !== null && `${form.estimatedCost}` !== ""
            ? Number(form.estimatedCost)
            : null,
        taxPercent:
          form.taxPercent !== undefined && form.taxPercent !== null && `${form.taxPercent}` !== ""
            ? Number(form.taxPercent)
            : null,
        discountPercent:
          form.discountPercent !== undefined && form.discountPercent !== null && `${form.discountPercent}` !== ""
            ? Number(form.discountPercent)
            : null,
        transportCost:
          form.transportCost !== undefined && form.transportCost !== null && `${form.transportCost}` !== ""
            ? Number(form.transportCost)
            : null,
        customsCost:
          form.customsCost !== undefined && form.customsCost !== null && `${form.customsCost}` !== ""
            ? Number(form.customsCost)
            : null,
        vendorId: form.vendorId || null,
        neededByDate: form.neededByDate || null,
        notes: form.notes?.trim() || undefined,
      };
      if (editingItem) {
        await updateMutation.mutateAsync({ itemId: editingItem.id, input: payload });
      } else {
        await createMutation.mutateAsync({ projectId, input: payload });
      }
      await itemsQuery.refetch();
      closeForm();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save procurement item."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (item: ProcurementItem, status: ProcurementItem["status"]) => {
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
      setActionError(getErrorMessage(err, "Failed to delete procurement item."));
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    const requestIds = rowSelection.selectedIds.flatMap((key) => groupByKey.get(key)?.requests.map((r) => r.id) ?? []);
    if (requestIds.length === 0) return;
    if (!window.confirm(`Delete ${requestIds.length} selected request(s)? This cannot be undone.`)) return;
    setActionError(null);
    try {
      for (const id of requestIds) {
        await deleteMutation.mutateAsync(id);
      }
      await itemsQuery.refetch();
      rowSelection.clear();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to delete selected items."));
    }
  };

  const handleExport = (rows: ProcurementItem[]) => {
    const sheetRows = rows.map((it) => ({
      "Item Name": it.itemName,
      "PO Number": it.poNumber || "",
      Category: it.category,
      Quantity: it.quantity,
      Unit: it.unit || "",
      "Unit Cost": toNumber(it.unitCost ?? it.estimatedCost),
      "Tax %": it.taxPercent != null ? toNumber(it.taxPercent) : "",
      "Discount %": it.discountPercent != null ? toNumber(it.discountPercent) : "",
      "Transport Cost": it.transportCost != null ? toNumber(it.transportCost) : "",
      "Customs Cost": it.customsCost != null ? toNumber(it.customsCost) : "",
      "Total Cost": computeItemCostBreakdown(it).total,
      Vendor: it.vendor?.name || it.vendorName || "",
      "Needed By": it.neededByDate || "",
      Status: it.status,
    }));
    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Procurement");
    XLSX.writeFile(workbook, `procurement-project-${projectId}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading procurement items…</p>
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
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total PO Value" value={formatCost(kpis.totalValue)} icon={<DollarSign className="w-4 h-4 text-blue-700" />} iconBg="bg-blue-50" />
        <KpiCard label="Pending Approval" value={String(kpis.pending)} icon={<Clock3 className="w-4 h-4 text-amber-700" />} iconBg="bg-amber-50" />
        <KpiCard label="Overdue POs" value={String(kpis.overdue)} icon={<FileStack className="w-4 h-4 text-red-700" />} iconBg="bg-red-50" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search items, PO#, vendors..."
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
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="ordered">Ordered</option>
              <option value="delivered">Delivered</option>
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
              <Plus size={14} /> Request Item
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
          <span>{rowSelection.selectedIds.length} item(s) selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                handleExport(rowSelection.selectedIds.flatMap((key) => groupByKey.get(key)?.requests ?? []))
              }
              className="px-2 py-1 font-medium rounded hover:bg-blue-100"
            >
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
              <ShoppingCart className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
              No procurement items{statusFilter !== "all" || search ? " match your filters" : " yet"}
            </h3>
            <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
              {isAdmin && statusFilter === "all" && !search
                ? "Request an item to start tracking purchases for this project."
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
                  <th className="px-3 py-2 font-medium text-left">Category</th>
                  <th className="px-3 py-2 font-medium text-left">Total Qty</th>
                  <th className="px-3 py-2 font-medium text-left">Total Cost</th>
                  <th className="px-3 py-2 font-medium text-left">Vendor</th>
                  <th className="px-3 py-2 font-medium text-left">Needed By</th>
                  <th className="px-3 py-2 font-medium text-left">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((group) => (
                  <tr key={group.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    {isAdmin && (
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={rowSelection.selected.has(group.key)} onChange={() => rowSelection.toggle(group.key)} className="w-3.5 h-3.5 text-blue-900 border-slate-300 rounded focus:ring-blue-900" />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <button onClick={() => setDrawerGroupKey(group.key)} className="font-medium text-left text-slate-800 hover:text-blue-900 hover:underline">
                        {group.itemName}
                      </button>
                      <div className="text-slate-400 text-[11px]">
                        {group.requests.length} request{group.requests.length === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td className="px-3 py-2"><CategoryPill category={group.category} /></td>
                    <td className="px-3 py-2 text-slate-600">
                      {group.totalQuantity}
                      {group.unitLabel ? ` ${group.unitLabel}` : ""}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">{formatCost(group.totalCost)}</td>
                    <td className="px-3 py-2 text-slate-600">{group.vendorLabel}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {group.earliestNeededBy
                        ? new Date(group.earliestNeededBy).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                        : "--"}
                    </td>
                    <td className="px-3 py-2">
                      {isAdmin && group.requests.length === 1 ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={group.requests[0].status}
                            disabled={statusUpdatingId === group.requests[0].id}
                            onChange={(e) => handleStatusChange(group.requests[0], e.target.value as ProcurementItem["status"])}
                            className="px-2 py-1 text-[11px] font-medium rounded appearance-none cursor-pointer outline-none disabled:opacity-60"
                            style={{
                              background: STATUS_STYLES[group.requests[0].status].bg,
                              color: STATUS_STYLES[group.requests[0].status].fg,
                            }}
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="ordered">Ordered</option>
                            <option value="delivered">Delivered</option>
                          </select>
                          {statusUpdatingId === group.requests[0].id && (
                            <Loader2 size={12} className="animate-spin text-slate-400" />
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1 max-w-[160px]">
                          {(Object.keys(group.statusCounts) as ProcurementItem["status"][]).map((status) => {
                            const count = group.statusCounts[status];
                            if (!count) return null;
                            const s = STATUS_STYLES[status];
                            return (
                              <span
                                key={status}
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                                style={{ background: s.bg, color: s.fg }}
                              >
                                {count} {s.label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setDrawerGroupKey(group.key)}
                        className="flex items-center gap-1 px-2 py-1 ml-auto rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      >
                        <Eye size={13} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={groupedItems.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Add/Edit item modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">
                {editingItem ? "Edit Procurement Item" : "Request Procurement Item"}
              </h3>
              <button onClick={closeForm} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmitForm} className="p-4 space-y-3">
              {formError && (
                <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">{formError}</div>
              )}
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
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Category</label>
                  <div className="relative">
                    <select
                      value={form.category || "hardware"}
                      onChange={(e) => setForm({ ...form, category: e.target.value as ProcurementItem["category"] })}
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
                    min={1}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Unit cost</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.estimatedCost ?? ""}
                    onChange={(e) => setForm({ ...form, estimatedCost: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Unit</label>
                  <input
                    value={form.unit || ""}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="e.g. pcs, kg, box"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Tax %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={form.taxPercent ?? ""}
                    onChange={(e) => setForm({ ...form, taxPercent: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Discount %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={form.discountPercent ?? ""}
                    onChange={(e) => setForm({ ...form, discountPercent: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Transport cost (Rs)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.transportCost ?? ""}
                    onChange={(e) => setForm({ ...form, transportCost: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Customs cost (Rs)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.customsCost ?? ""}
                    onChange={(e) => setForm({ ...form, customsCost: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">Needed by</label>
                  <input
                    type="date"
                    value={form.neededByDate || ""}
                    onChange={(e) => setForm({ ...form, neededByDate: e.target.value })}
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
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
                  {editingItem ? "Save Changes" : "Request Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ProcurementItemGroupDrawer
        group={drawerGroupKey ? groupByKey.get(drawerGroupKey) ?? null : null}
        onClose={() => setDrawerGroupKey(null)}
        isAdmin={isAdmin}
        onViewRequest={(id) => setDrawerItemId(id)}
        onEditRequest={(item) => {
          setDrawerGroupKey(null);
          openEditForm(item);
        }}
        onDeleteRequest={(item) => {
          setDrawerGroupKey(null);
          setDeleteTarget(item);
        }}
        onStatusChange={handleStatusChange}
        statusUpdatingId={statusUpdatingId}
      />

      <ProcurementItemDrawer itemId={drawerItemId} onClose={() => setDrawerItemId(null)} isAdmin={isAdmin} />

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleting}
        title="Delete Procurement Item"
        message={`Delete "${deleteTarget?.itemName}"? This cannot be undone.`}
      />
    </div>
  );
};

export default ProjectProcurementTab;
