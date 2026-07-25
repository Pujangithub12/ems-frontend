import React, { useMemo, useRef, useState } from "react";
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
  Upload,
  DollarSign,
  FileStack,
  Clock3,
  AlertTriangle,
  CheckCircle2,
  Truck,
  Users,
} from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { useProjects } from "../../projects/hooks/useProjects";
import { ProcurementItem } from "../../../types";
import { formatCost, toNumber, computeItemCostBreakdown, ProcurementItemInput } from "../api/procurement.api";
import {
  useWorkspaceProcurementQuery,
  useCreateProcurementItemMutation,
  useUpdateProcurementItemMutation,
  useDeleteProcurementItemMutation,
} from "../hooks/useProcurement";
import { useWorkspaceVendorsQuery } from "../../inventory/hooks/useInventory";
import { getErrorMessage } from "../../../lib/errors";
import ConfirmationModal from "../../../components/ConfirmationModal";
import ItemNameField from "../../inventory/components/ItemNameField";
import VendorField from "../../inventory/components/VendorField";
import Pagination from "../../../components/Pagination";
import { useRowSelection } from "../../../hooks/useRowSelection";
import ProcurementItemDrawer from "../components/ProcurementItemDrawer";
import ProcurementItemGroupDrawer from "../components/ProcurementItemGroupDrawer";
import { STATUS_STYLES, CATEGORY_STYLES } from "../components/statusStyles";
import { groupProcurementItems } from "../utils/groupProcurementItems";

type StatusFilter = "all" | ProcurementItem["status"];
type CategoryFilter = "all" | ProcurementItem["category"];
type SortBy = "name" | "cost" | "date" | "needed";

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
  itemId: null,
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

const ProcurementPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const { data: projects = [] } = useProjects();
  const itemsQuery = useWorkspaceProcurementQuery();
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
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [projectFilter, setProjectFilter] = useState<number | "all">("all");
  const [vendorFilter, setVendorFilter] = useState<number | "all">("all");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ProcurementItem | null>(null);
  const [formProjectId, setFormProjectId] = useState<number | "">("");
  const [form, setForm] = useState<ProcurementItemInput>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProcurementItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [drawerItemId, setDrawerItemId] = useState<number | null>(null);
  const [drawerGroupKey, setDrawerGroupKey] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProjectId, setImportProjectId] = useState<number | "">("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setRefreshing(true);
    await itemsQuery.refetch();
    setRefreshing(false);
  };

  const filteredItems = useMemo(() => {
    let rows = items;
    if (statusFilter !== "all") rows = rows.filter((it) => it.status === statusFilter);
    if (categoryFilter !== "all") rows = rows.filter((it) => it.category === categoryFilter);
    if (projectFilter !== "all") rows = rows.filter((it) => it.projectId === projectFilter);
    if (vendorFilter !== "all") rows = rows.filter((it) => it.vendor?.id === vendorFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (it) =>
          it.itemName.toLowerCase().includes(q) ||
          (it.vendor?.name || it.vendorName || "").toLowerCase().includes(q) ||
          (it.poNumber || "").toLowerCase().includes(q) ||
          (it.projectName || "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [items, search, statusFilter, categoryFilter, projectFilter, vendorFilter]);

  // Every purchase request for the same item (within the same project) folds
  // into one summary row here — see groupProcurementItems — so repeat
  // requests for "Solar Panel 550W" don't clutter the table as separate
  // lines; the group's own drawer (ProcurementItemGroupDrawer) lists each
  // underlying request individually.
  const groupedItems = useMemo(() => {
    const groups = groupProcurementItems(filteredItems);
    groups.sort((a, b) => {
      if (sortBy === "cost") return b.totalCost - a.totalCost;
      if (sortBy === "needed")
        return new Date(a.earliestNeededBy || 0).getTime() - new Date(b.earliestNeededBy || 0).getTime();
      if (sortBy === "name") return a.itemName.localeCompare(b.itemName);
      return new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime();
    });
    return groups;
  }, [filteredItems, sortBy]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return groupedItems.slice(start, start + pageSize);
  }, [groupedItems, page, pageSize]);

  const rowSelection = useRowSelection<string>(pageItems.map((g) => g.key));
  const groupByKey = useMemo(() => new Map(groupedItems.map((g) => [g.key, g])), [groupedItems]);

  const kpis = useMemo(() => {
    const now = Date.now();
    const totalValue = items.reduce((sum, i) => sum + computeItemCostBreakdown(i).total, 0);
    const overdue = items.filter(
      (i) => i.status !== "delivered" && i.neededByDate && new Date(i.neededByDate).getTime() < now,
    ).length;
    return {
      totalValue,
      totalPOs: items.length,
      pending: items.filter((i) => i.status === "pending").length,
      overdue,
      approved: items.filter((i) => i.status === "approved").length,
      ordered: items.filter((i) => i.status === "ordered").length,
      delivered: items.filter((i) => i.status === "delivered").length,
      totalVendors: new Set(items.map((i) => i.vendor?.id).filter(Boolean)).size,
    };
  }, [items]);


  const openCreateForm = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setFormProjectId(projects[0]?.id ?? "");
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (item: ProcurementItem) => {
    setEditingItem(item);
    setFormProjectId(item.projectId ?? "");
    setForm({
      itemName: item.itemName,
      itemId: item.item?.id ?? null,
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
    if (!form.itemId) {
      setFormError("Select an item from the catalog (or add a new one).");
      return;
    }
    if (!editingItem && !formProjectId) {
      setFormError("Choose a project for this item.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const payload: ProcurementItemInput = {
        itemName: form.itemName.trim(),
        itemId: form.itemId,
        category: form.category || "hardware",
        quantity: form.quantity && form.quantity > 0 ? form.quantity : 1,
        unit: form.unit?.trim() || undefined,
        estimatedCost:
          form.estimatedCost !== undefined && form.estimatedCost !== null && `${form.estimatedCost}` !== ""
            ? Number(form.estimatedCost)
            : null,
        unitCost:
          form.unitCost !== undefined && form.unitCost !== null && `${form.unitCost}` !== ""
            ? Number(form.unitCost)
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
        await createMutation.mutateAsync({ projectId: String(formProjectId), input: payload });
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
      Project: it.projectName || "",
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
    XLSX.writeFile(workbook, "procurement-export.xlsx");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importProjectId) return;
    setImporting(true);
    setActionError(null);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      for (const row of rows) {
        const itemName = String(row["Item Name"] || row["itemName"] || "").trim();
        if (!itemName) continue;
        await createMutation.mutateAsync({
          projectId: String(importProjectId),
          input: {
            itemName,
            category: (row["Category"] as ProcurementItem["category"]) || "hardware",
            quantity: Number(row["Quantity"]) || 1,
            estimatedCost: row["Unit Cost"] !== "" ? Number(row["Unit Cost"]) : null,
            vendorName: String(row["Vendor"] || "") || undefined,
          },
        });
      }
      await itemsQuery.refetch();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to import file."));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading procurement…</p>
      </div>
    );
  }

  return (
    <div className="w-full p-6">
      {error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <p className="text-[13px] text-slate-600">{error}</p>
          <button onClick={refresh} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded hover:bg-slate-50">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col w-full min-w-0 gap-4">
          <div className="flex flex-col w-full min-w-0 gap-4">
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label="Total PO Value" value={formatCost(kpis.totalValue)} icon={<DollarSign className="w-4 h-4 text-blue-700" />} iconBg="bg-blue-50" />
              <KpiCard label="Total POs" value={String(kpis.totalPOs)} icon={<FileStack className="w-4 h-4 text-slate-700" />} iconBg="bg-slate-100" />
              <KpiCard label="Pending Approval" value={String(kpis.pending)} icon={<Clock3 className="w-4 h-4 text-amber-700" />} iconBg="bg-amber-50" />
              <KpiCard label="Overdue POs" value={String(kpis.overdue)} icon={<AlertTriangle className="w-4 h-4 text-red-700" />} iconBg="bg-red-50" />
              <KpiCard label="Approved" value={String(kpis.approved)} icon={<CheckCircle2 className="w-4 h-4 text-purple-700" />} iconBg="bg-purple-50" />
              <KpiCard label="Ordered" value={String(kpis.ordered)} icon={<Truck className="w-4 h-4 text-indigo-700" />} iconBg="bg-indigo-50" />
              <KpiCard label="Delivered" value={String(kpis.delivered)} icon={<CheckCircle2 className="w-4 h-4 text-emerald-700" />} iconBg="bg-emerald-50" />
              <KpiCard label="Total Vendors" value={String(kpis.totalVendors)} icon={<Users className="w-4 h-4 text-teal-700" />} iconBg="bg-teal-50" />
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search items, PO#, vendors..."
                    className="pl-8 pr-3 py-2 w-56 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
                  />
                </div>
                <div className="relative">
                  <select
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value as CategoryFilter); setPage(1); }}
                    className="pl-3 pr-8 py-2 text-[12px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors"
                  >
                    <option value="all">All Categories</option>
                    <option value="hardware">Hardware</option>
                    <option value="software">Software</option>
                    <option value="service">Service</option>
                  </select>
                  <ChevronDown className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none right-2.5 top-1/2 text-slate-400" />
                </div>
                <div className="relative">
                  <select
                    value={projectFilter}
                    onChange={(e) => { setProjectFilter(e.target.value === "all" ? "all" : Number(e.target.value)); setPage(1); }}
                    className="pl-3 pr-8 py-2 text-[12px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors max-w-[160px]"
                  >
                    <option value="all">All Projects</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none right-2.5 top-1/2 text-slate-400" />
                </div>
                <div className="relative">
                  <select
                    value={vendorFilter}
                    onChange={(e) => { setVendorFilter(e.target.value === "all" ? "all" : Number(e.target.value)); setPage(1); }}
                    className="pl-3 pr-8 py-2 text-[12px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors max-w-[150px]"
                  >
                    <option value="all">All Vendors</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none right-2.5 top-1/2 text-slate-400" />
                </div>
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
                    className="pl-3 pr-8 py-2 text-[12px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="ordered">Ordered</option>
                    <option value="delivered">Delivered</option>
                  </select>
                  <ChevronDown className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none right-2.5 top-1/2 text-slate-400" />
                </div>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortBy)}
                    className="pl-3 pr-8 py-2 text-[12px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors"
                  >
                    <option value="date">Sort: Newest</option>
                    <option value="name">Sort: Name</option>
                    <option value="cost">Sort: Cost</option>
                    <option value="needed">Sort: Needed By</option>
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
                  title="Export current view to Excel"
                >
                  <Download size={13} /> Export
                </button>
                {isAdmin && (
                  <>
                    <select
                      value={importProjectId}
                      onChange={(e) => setImportProjectId(e.target.value ? Number(e.target.value) : "")}
                      className="px-2 py-2 text-[11px] bg-white border border-slate-200 rounded-lg outline-none max-w-[110px]"
                      title="Target project for import"
                    >
                      <option value="">Import to…</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <label
                      className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border rounded-lg cursor-pointer ${importProjectId ? "text-slate-600 border-slate-200 hover:bg-slate-50" : "text-slate-300 border-slate-100 cursor-not-allowed"}`}
                    >
                      {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Import
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.csv"
                        disabled={!importProjectId || importing}
                        className="hidden"
                        onChange={handleImportFile}
                      />
                    </label>
                    <button
                      onClick={openCreateForm}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg text-[12px] font-medium hover:bg-blue-800 transition-colors"
                    >
                      <Plus size={14} /> Request Item
                    </button>
                  </>
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
                      handleExport(
                        rowSelection.selectedIds.flatMap((key) => groupByKey.get(key)?.requests ?? []),
                      )
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

            {/* Table — one row per item (see groupProcurementItems); each
                row's individual purchase requests live in its group drawer. */}
            <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-lg border-slate-200">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
                    <ShoppingCart className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
                    No procurement items{statusFilter !== "all" || projectFilter !== "all" || search ? " match your filters" : " yet"}
                  </h3>
                  <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                    {isAdmin && statusFilter === "all" && projectFilter === "all" && !search
                      ? "Request an item to start tracking purchases."
                      : "Try adjusting your search or filters."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                        {isAdmin && (
                          <th className="w-8 px-3 py-2">
                            <input
                              type="checkbox"
                              checked={rowSelection.allSelected}
                              onChange={rowSelection.toggleAll}
                              className="w-3.5 h-3.5 text-blue-900 border-slate-300 rounded focus:ring-blue-900"
                            />
                          </th>
                        )}
                        <th className="px-3 py-2 font-medium text-left">Item</th>
                        <th className="px-3 py-2 font-medium text-left">Project</th>
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
                              <input
                                type="checkbox"
                                checked={rowSelection.selected.has(group.key)}
                                onChange={() => rowSelection.toggle(group.key)}
                                className="w-3.5 h-3.5 text-blue-900 border-slate-300 rounded focus:ring-blue-900"
                              />
                            </td>
                          )}
                          <td className="px-3 py-2">
                            <button
                              onClick={() => setDrawerGroupKey(group.key)}
                              className="font-medium text-left text-slate-800 hover:text-blue-900 hover:underline"
                            >
                              {group.itemName}
                            </button>
                            <div className="text-slate-400 text-[11px]">
                              {group.requests.length} request{group.requests.length === 1 ? "" : "s"}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{group.projectName || "--"}</td>
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
              <Pagination
                page={page}
                pageSize={pageSize}
                total={groupedItems.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>

          {/* Widgets */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="p-4 bg-white border rounded-lg border-slate-200">
              <h4 className="text-[12px] font-semibold text-slate-900 mb-3">Recent Purchases</h4>
              {items.length === 0 ? (
                <p className="text-[11px] text-slate-400">No purchases yet.</p>
              ) : (
                <div className="space-y-2">
                  {[...items]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 8)
                    .map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 truncate">{p.itemName}</span>
                        <span className="text-slate-400">{formatCost(p.estimatedCost)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-white border rounded-lg border-slate-200">
              <h4 className="text-[12px] font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-red-600" /> Overdue Purchase Orders
              </h4>
              {(() => {
                const now = Date.now();
                const overdueItems = items.filter(
                  (i) => i.status !== "delivered" && i.neededByDate && new Date(i.neededByDate).getTime() < now,
                );
                return overdueItems.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Nothing overdue.</p>
                ) : (
                  <div className="space-y-2">
                    {overdueItems.slice(0, 6).map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 truncate">{p.itemName}</span>
                        <span className="text-red-600">
                          {new Date(p.neededByDate!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

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
              {!editingItem && (
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-900">Project</label>
                  <div className="relative">
                    <select
                      value={formProjectId}
                      onChange={(e) => setFormProjectId(Number(e.target.value))}
                      className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded appearance-none cursor-pointer outline-none focus:border-blue-400"
                    >
                      <option value="" disabled>Choose a project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-900">Item name</label>
                <ItemNameField
                  autoFocus
                  itemId={form.itemId ?? null}
                  currentName={form.itemName}
                  onSelect={(item) => setForm((f) => ({ ...f, itemId: item.id, itemName: item.name }))}
                  placeholder="e.g. Solar panel mounting brackets"
                  className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-900">Category</label>
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
                  <label className="block mb-1 text-[11px] font-medium text-slate-900">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-900">Unit cost</label>
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
                  <label className="block mb-1 text-[11px] font-medium text-slate-900">Unit</label>
                  <input
                    value={form.unit || ""}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="e.g. pcs, kg, box"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-900">Tax %</label>
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
                  <label className="block mb-1 text-[11px] font-medium text-slate-900">Discount %</label>
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
                  <label className="block mb-1 text-[11px] font-medium text-slate-900">Transport cost (Rs)</label>
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
                  <label className="block mb-1 text-[11px] font-medium text-slate-900">Customs cost (Rs)</label>
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
                  <label className="block mb-1 text-[11px] font-medium text-slate-900">Vendor</label>
                  <VendorField
                    vendorId={form.vendorId ?? null}
                    onSelect={(vendorId) => setForm({ ...form, vendorId })}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-900">Needed by</label>
                  <input
                    type="date"
                    value={form.neededByDate || ""}
                    onChange={(e) => setForm({ ...form, neededByDate: e.target.value })}
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-900">Notes</label>
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

export default ProcurementPage;
