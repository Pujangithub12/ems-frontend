import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  X,
  Trash2,
  Pencil,
  Upload,
  Paperclip,
  ChevronDown,
  Plus,
  Check,
  XCircle,
  Truck,
  Shield,
  FileCheck,
  Calculator,
  PackageCheck,
  LayoutDashboard,
  Download,
} from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { getErrorMessage } from "../../../lib/errors";
import { formatCost, toNumber } from "../../../lib/currency";
import {
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchaseType,
  ShipmentTransportMode,
  ShipmentStatus,
  CustomsDocumentType,
  GoodsReceiptStatus,
  Shipment,
  Insurance,
  Customs,
} from "../../../types";
import {
  usePurchaseOrderDetailQuery,
  useUpdatePurchaseOrderMutation,
  useAddPurchaseOrderItemMutation,
  useEditPurchaseOrderItemMutation,
  useDeletePurchaseOrderItemMutation,
  useCostSheetQuery,
} from "../hooks/usePurchaseOrder";
import ItemNameField from "../../inventory/components/ItemNameField";
import CatalogItemFormModal from "../../inventory/components/CatalogItemFormModal";
import ConfirmationModal from "../../../components/ConfirmationModal";
import {
  useCreateShipmentMutation,
  useUpdateShipmentMutation,
  useCreateInsuranceMutation,
  useUpdateInsuranceMutation,
  useCreateCustomsMutation,
  useUpdateCustomsMutation,
  useUploadCustomsDocumentMutation,
  useDeleteCustomsDocumentMutation,
} from "../hooks/useShipment";
import {
  useCreateGoodsReceiptMutation,
  useUpdateGoodsReceiptStatusMutation,
  useUploadGoodsReceiptPhotoMutation,
  useDeleteGoodsReceiptPhotoMutation,
} from "../hooks/useGoodsReceipt";
import { useOrganizationWarehousesQuery, useOrganizationItemCatalogQuery } from "../../inventory/hooks/useInventory";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const fileUrl = (filePath: string) => `${API_BASE}/uploads/${filePath}`;
const pdfUrl = (id: number) => `${API_BASE}/api/purchase-orders/${id}/pdf`;

// ---- Status pill styling (kept local to this file, matching the rest of this feature) ----

const PO_STATUS_STYLES: Record<PurchaseOrderStatus, { bg: string; fg: string; label: string }> = {
  created: { bg: "#f1f5f9", fg: "#475569", label: "Created" },
  sent: { bg: "#fef9c3", fg: "#854d0e", label: "Sent" },
  accepted: { bg: "#dcfce7", fg: "#166534", label: "Accepted" },
  completed: { bg: "#dbeafe", fg: "#1e40af", label: "Completed" },
  cancelled: { bg: "#fee2e2", fg: "#991b1b", label: "Cancelled" },
};

const PURCHASE_TYPE_STYLES: Record<PurchaseType, { bg: string; fg: string; label: string }> = {
  local: { bg: "#f1f5f9", fg: "#475569", label: "Local" },
  international: { bg: "#e0e7ff", fg: "#3730a3", label: "International" },
};

const GRN_STATUS_STYLES: Record<GoodsReceiptStatus, { bg: string; fg: string; label: string }> = {
  pending_inspection: { bg: "#fef9c3", fg: "#854d0e", label: "Pending Inspection" },
  accepted: { bg: "#dcfce7", fg: "#166534", label: "Accepted" },
  partially_accepted: { bg: "#dbeafe", fg: "#1e40af", label: "Partially Accepted" },
  rejected: { bg: "#fee2e2", fg: "#991b1b", label: "Rejected" },
};

const Pill: React.FC<{ bg: string; fg: string; label: string }> = ({ bg, fg, label }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: bg, color: fg }}>
    {label}
  </span>
);

const inputCls = "w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500";
const labelCls = "block mb-1 text-[11px] font-medium text-slate-900";
const primaryBtnCls = "flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60 transition-colors";
const sectionCardCls = "p-4 bg-white border rounded-xl shadow-md border-slate-200";

const numOrUndef = (s: string): number | undefined => {
  if (s.trim() === "") return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "--";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "shipment", label: "Shipment", icon: Truck },
  { id: "costsheet", label: "Cost Sheet", icon: Calculator },
  { id: "grn", label: "Goods Receipt", icon: PackageCheck },
];

/**
 * Purchase Order detail — a full page (not a drawer) because it fans out into
 * four data-rich tabs (Overview, Shipment, Cost Sheet, Goods Receipt — Proforma
 * Invoice moved out to its own sidebar page, see ProformaInvoices.tsx). One
 * usePurchaseOrderDetailQuery covers everything except the Cost Sheet, which is
 * its own computed-on-the-fly endpoint. Every mutation across every tab
 * refetches both queries afterward — this codebase's mutations never
 * auto-invalidate the cache.
 */
const PurchaseOrderDetailPage: React.FC = () => {
  const { organizationId, id } = useParams<{ organizationId: string; id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  // Finance can edit a PO while reviewing it for approval (see PurchaseOrderController.updatePurchaseOrder's
  // inline bypass) without holding the broader "projects.procurement" permission admins get.
  const canEditHeader = isAdmin || user?.role === "finance";
  const poId = Number(id);

  const [activeTab, setActiveTab] = useState("overview");
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [headerBusy, setHeaderBusy] = useState(false);

  const detailQuery = usePurchaseOrderDetailQuery(Number.isFinite(poId) ? poId : null);
  const costSheetQuery = useCostSheetQuery(Number.isFinite(poId) ? poId : null);
  const updateMutation = useUpdatePurchaseOrderMutation();

  const po = detailQuery.data;

  const refetchAll = async () => {
    await Promise.all([detailQuery.refetch(), costSheetQuery.refetch()]);
  };

  const changeStatus = async (status: PurchaseOrderStatus) => {
    if (!po) return;
    setHeaderBusy(true);
    setHeaderError(null);
    try {
      await updateMutation.mutateAsync({ id: po.id, input: { status } });
      await refetchAll();
    } catch (err) {
      setHeaderError(getErrorMessage(err, "Failed to update status."));
    } finally {
      setHeaderBusy(false);
    }
  };

  const changePurchaseType = async (purchaseType: PurchaseType) => {
    if (!po) return;
    setHeaderBusy(true);
    setHeaderError(null);
    try {
      await updateMutation.mutateAsync({ id: po.id, input: { purchaseType } });
      await refetchAll();
    } catch (err) {
      setHeaderError(getErrorMessage(err, "Failed to update purchase type."));
    } finally {
      setHeaderBusy(false);
    }
  };

  if (detailQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading purchase order…</p>
      </div>
    );
  }

  if (detailQuery.isError || !po) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center bg-white">
        <div className="flex items-center justify-center w-12 h-12 mb-1 rounded-full bg-gradient-to-br from-red-50 to-red-100 ring-1 ring-red-100">
          <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <p className="text-[13px] text-slate-600">{getErrorMessage(detailQuery.error, "Purchase order not found.")}</p>
        <button
          onClick={() => navigate(`/${organizationId}/purchase-orders`)}
          className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Back to Purchase Orders
        </button>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab po={po} isAdmin={isAdmin} onChanged={refetchAll} />;
      case "shipment":
        return <ShipmentTab po={po} isAdmin={isAdmin} onChanged={refetchAll} />;
      case "costsheet":
        return <CostSheetTab costSheetQuery={costSheetQuery} />;
      case "grn":
        return <GoodsReceiptTab po={po} isAdmin={isAdmin} onChanged={refetchAll} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-4rem)] bg-white">
      {/* Header */}
      <div className="flex flex-col gap-3 px-6 pt-4 pb-3 bg-white lg:px-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/${organizationId}/purchase-orders`)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-800 w-fit"
          >
            <ArrowLeft size={14} /> Back to Purchase Orders
          </button>
        </div>

        {headerError && (
          <div className="flex items-center justify-between px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">
            <span>{headerError}</span>
            <button onClick={() => setHeaderError(null)}><X size={14} /></button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-semibold text-[22px] tracking-tight text-slate-900 truncate">
                {po.poNumber || `PO #${po.id}`}
              </h1>
              <Pill {...PURCHASE_TYPE_STYLES[po.purchaseType]} />
              <Pill {...PO_STATUS_STYLES[po.status]} />
            </div>
            <p className="mt-1 text-[12px] text-slate-500">
              {po.vendor?.name || "Unknown vendor"} · {po.project?.name || "Unknown project"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canEditHeader && (
              <>
                <div className="relative">
                  <select
                    value={po.purchaseType}
                    disabled={headerBusy}
                    onChange={(e) => changePurchaseType(e.target.value as PurchaseType)}
                    className="appearance-none pl-3 pr-8 py-2 text-[12px] border border-slate-200 rounded-lg outline-none cursor-pointer focus:border-blue-400 disabled:opacity-60"
                  >
                    {(Object.keys(PURCHASE_TYPE_STYLES) as PurchaseType[]).map((t) => (
                      <option key={t} value={t}>{PURCHASE_TYPE_STYLES[t].label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-2.5 top-1/2 w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="relative">
                  <select
                    value={po.status}
                    disabled={headerBusy}
                    onChange={(e) => changeStatus(e.target.value as PurchaseOrderStatus)}
                    className="appearance-none pl-3 pr-8 py-2 text-[12px] border border-slate-200 rounded-lg outline-none cursor-pointer focus:border-blue-400 disabled:opacity-60"
                  >
                    {(Object.keys(PO_STATUS_STYLES) as PurchaseOrderStatus[]).map((s) => (
                      <option key={s} value={s}>{PO_STATUS_STYLES[s].label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-2.5 top-1/2 w-3.5 h-3.5 text-slate-400" />
                </div>
              </>
            )}
            {headerBusy && <Loader2 className="w-4 h-4 text-blue-900 animate-spin" />}
          </div>
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        <div className="flex flex-shrink-0 gap-1 px-4 overflow-x-auto border-b border-slate-200 bg-slate-50/60 lg:px-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-[13px] border-b-2 whitespace-nowrap transition-colors
                  ${
                    activeTab === tab.id
                      ? "border-slate-900 text-black font-semibold"
                      : "border-transparent font-medium text-slate-500 hover:text-slate-700"
                  }`}
              >
                <Icon size={14} className="opacity-70" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1 p-6 overflow-auto">{renderTabContent()}</div>
      </div>
    </div>
  );
};

// =====================================================================================
// Overview tab
// =====================================================================================

type OverviewForm = {
  poNumber: string;
  paymentTerms: string;
  incoterms: string;
  taxPercent: string;
  terms: string;
  deliveryPeriod: string;
  finalDestination: string;
  customerContactPerson: string;
  currency: string;
};

const formFromPo = (po: PurchaseOrder): OverviewForm => ({
  poNumber: po.poNumber || "",
  paymentTerms: po.paymentTerms || "",
  incoterms: po.incoterms || "",
  taxPercent: po.taxPercent !== null && po.taxPercent !== undefined ? String(po.taxPercent) : "",
  terms: po.terms || "",
  deliveryPeriod: po.deliveryPeriod || "",
  finalDestination: po.finalDestination || "",
  customerContactPerson: po.customerContactPerson || "",
  currency: po.currency || "",
});

const emptyAddItemForm = {
  itemId: null as number | null,
  itemName: "",
  quantity: "1",
  unit: "",
  unitPrice: "",
  description: "",
};

const OverviewTab: React.FC<{ po: PurchaseOrder; isAdmin: boolean; onChanged: () => Promise<void> }> = ({ po, isAdmin, onChanged }) => {
  const updateMutation = useUpdatePurchaseOrderMutation();
  const addItemMutation = useAddPurchaseOrderItemMutation();
  const editItemMutation = useEditPurchaseOrderItemMutation();
  const deleteItemMutation = useDeletePurchaseOrderItemMutation();
  const catalogQuery = useOrganizationItemCatalogQuery();
  const catalogItems = catalogQuery.data ?? [];

  const [form, setForm] = useState<OverviewForm>(() => formFromPo(po));
  const [hsnCodes, setHsnCodes] = useState<Record<number, string>>(() =>
    Object.fromEntries(po.items.map((item) => [item.id, item.hsnCode || ""])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add Item modal doubles as the Edit modal — editingItemId set means "editing this existing
  // row" instead of creating a new one.
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [addItemForm, setAddItemForm] = useState(emptyAddItemForm);
  const [addItemBusy, setAddItemBusy] = useState(false);
  const [addItemError, setAddItemError] = useState<string | null>(null);
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState<PurchaseOrder["items"][number] | null>(null);
  const [deleteItemBusy, setDeleteItemBusy] = useState(false);

  const openAddItem = () => {
    setEditingItemId(null);
    setAddItemForm(emptyAddItemForm);
    setAddItemError(null);
    setAddItemOpen(true);
  };

  const openEditItem = (item: PurchaseOrder["items"][number]) => {
    setEditingItemId(item.id);
    setAddItemForm({
      itemId: item.itemId ?? null,
      itemName: item.itemName,
      quantity: String(item.quantity),
      unit: item.unit || "",
      unitPrice: item.unitPrice != null ? String(toNumber(item.unitPrice)) : "",
      description: item.description || "",
    });
    setAddItemError(null);
    setAddItemOpen(true);
  };

  const submitAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addItemForm.itemId) {
      setAddItemError("Select an item.");
      return;
    }
    const quantity = parseFloat(addItemForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setAddItemError("Enter a valid quantity.");
      return;
    }
    setAddItemBusy(true);
    setAddItemError(null);
    try {
      const input = {
        itemName: addItemForm.itemName.trim(),
        itemId: addItemForm.itemId,
        quantity,
        unit: addItemForm.unit.trim() || undefined,
        unitPrice: addItemForm.unitPrice ? parseFloat(addItemForm.unitPrice) : null,
        description: addItemForm.description.trim() || null,
      };
      if (editingItemId) {
        await editItemMutation.mutateAsync({ id: po.id, itemId: editingItemId, input });
      } else {
        await addItemMutation.mutateAsync({ id: po.id, input });
      }
      await onChanged();
      setAddItemOpen(false);
    } catch (err) {
      setAddItemError(getErrorMessage(err, editingItemId ? "Failed to save item." : "Failed to add item."));
    } finally {
      setAddItemBusy(false);
    }
  };

  const confirmDeleteItem = async () => {
    if (!deleteItemTarget) return;
    setDeleteItemBusy(true);
    try {
      await deleteItemMutation.mutateAsync({ id: po.id, itemId: deleteItemTarget.id });
      await onChanged();
      setDeleteItemTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete item."));
    } finally {
      setDeleteItemBusy(false);
    }
  };

  // Bulk import via .xlsx/.csv — parsed entirely client-side, then replayed as
  // sequential addPurchaseOrderItem calls (same "Upload Sheet" pattern as the
  // Energy Performance tab's daily-generation import).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const findColumn = (header: string[], needle: string, exclude: number[] = []) =>
    header.findIndex(
      (h, i) => !exclude.includes(i) && (h || "").toString().toLowerCase().includes(needle),
    );

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadModalOpen(false);
    setImporting(true);
    setImportStatus(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows2d: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

      const headerRowIdx = rows2d.findIndex((r) => {
        const cells = r.map((c) => String(c).trim().toLowerCase());
        return cells.some((c) => c.includes("item")) && cells.some((c) => c.includes("qty") || c.includes("quantity"));
      });
      if (headerRowIdx === -1) {
        setImportStatus("Couldn't find a header row with \"Item\" and \"Quantity\" columns.");
        return;
      }
      const header = rows2d[headerRowIdx].map((c) => String(c));
      const itemNameCol = findColumn(header, "item");
      const qtyCol = findColumn(header, "qty");
      const quantityCol = qtyCol >= 0 ? qtyCol : findColumn(header, "quantity");
      const unitPriceCol = findColumn(header, "price");
      const unitCol = findColumn(header, "unit", [unitPriceCol]);
      const descriptionCol = findColumn(header, "desc");

      let imported = 0;
      let skipped = 0;
      for (let i = headerRowIdx + 1; i < rows2d.length; i++) {
        const r = rows2d[i];
        const itemName = itemNameCol >= 0 ? String(r[itemNameCol] ?? "").trim() : "";
        if (!itemName || itemName.toLowerCase() === "total") {
          skipped += 1;
          continue;
        }

        const quantityRaw = quantityCol >= 0 ? r[quantityCol] : "";
        const quantity =
          typeof quantityRaw === "number" ? quantityRaw : parseFloat(String(quantityRaw));
        if (!Number.isFinite(quantity) || quantity <= 0) {
          skipped += 1;
          continue;
        }

        const unit = unitCol >= 0 ? String(r[unitCol] ?? "").trim() || undefined : undefined;
        const unitPriceRaw = unitPriceCol >= 0 ? r[unitPriceCol] : "";
        const unitPrice =
          unitPriceRaw !== "" && unitPriceRaw != null && Number.isFinite(Number(unitPriceRaw))
            ? Number(unitPriceRaw)
            : null;
        const description = descriptionCol >= 0 ? String(r[descriptionCol] ?? "").trim() || null : null;

        const match = catalogItems.find((ci) => ci.name.toLowerCase() === itemName.toLowerCase());

        // eslint-disable-next-line no-await-in-loop -- sequential upserts keep per-row error attribution simple
        await addItemMutation.mutateAsync({
          id: po.id,
          input: { itemName, itemId: match?.id ?? null, quantity, unit, unitPrice, description },
        });
        imported += 1;
      }

      await onChanged();
      setImportStatus(`${imported} item${imported === 1 ? "" : "s"} imported${skipped ? `, ${skipped} skipped` : ""}.`);
    } catch (err) {
      setImportStatus(getErrorMessage(err, "Failed to import the file."));
    } finally {
      setImporting(false);
    }
  };

  // Reset the form when navigating to a different PO (not on every refetch, so
  // in-flight edits aren't clobbered right after a successful save).
  useEffect(() => {
    setForm(formFromPo(po));
    setHsnCodes(Object.fromEntries(po.items.map((item) => [item.id, item.hsnCode || ""])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po.id]);

  const handleSave = async () => {
    const trimmedPoNumber = form.poNumber.trim();
    if (!trimmedPoNumber) {
      setError("PO number cannot be empty.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id: po.id,
        input: {
          poNumber: trimmedPoNumber,
          paymentTerms: form.paymentTerms.trim() || undefined,
          incoterms: form.incoterms.trim() || undefined,
          taxPercent: numOrUndef(form.taxPercent) ?? null,
          terms: form.terms.trim() || undefined,
          deliveryPeriod: form.deliveryPeriod.trim() || undefined,
          finalDestination: form.finalDestination.trim() || undefined,
          customerContactPerson: form.customerContactPerson.trim() || undefined,
          currency: form.currency.trim() || undefined,
          items: po.items.map((item) => ({ id: item.id, hsnCode: hsnCodes[item.id]?.trim() || null })),
        },
      });
      await onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save."));
    } finally {
      setBusy(false);
    }
  };

  const statusHistory = po.statusHistory ?? [];

  const itemsTotal = po.items.reduce((sum, i) => sum + i.quantity * toNumber(i.unitPrice), 0);

  return (
    <div className="flex flex-col gap-4 w-full">
      {error && (
        <div className="flex items-center justify-between px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      <div className={sectionCardCls}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-slate-900">Purchase Order Details</h3>
          <div className="flex items-center gap-2">
            <a
              href={pdfUrl(po.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 w-fit"
            >
              <Download size={13} /> Download PDF
            </a>
            {isAdmin && (
              <button onClick={handleSave} disabled={busy} className={primaryBtnCls}>
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelCls}>PO Number</label>
            <input
              disabled={!isAdmin}
              value={form.poNumber}
              onChange={(e) => setForm({ ...form, poNumber: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Payment Terms</label>
            <input
              disabled={!isAdmin}
              value={form.paymentTerms}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Incoterms</label>
            <input
              disabled={!isAdmin}
              value={form.incoterms}
              onChange={(e) => setForm({ ...form, incoterms: e.target.value })}
              placeholder="e.g. FOB, CIF"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Tax %</label>
            <input
              type="number"
              disabled={!isAdmin}
              value={form.taxPercent}
              onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Delivery Period</label>
            <input
              disabled={!isAdmin}
              value={form.deliveryPeriod}
              onChange={(e) => setForm({ ...form, deliveryPeriod: e.target.value })}
              placeholder="e.g. Within 6 weeks of submission of PO."
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Final Destination</label>
            <input
              disabled={!isAdmin}
              value={form.finalDestination}
              onChange={(e) => setForm({ ...form, finalDestination: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Customer Contact Person</label>
            <input
              disabled={!isAdmin}
              value={form.customerContactPerson}
              onChange={(e) => setForm({ ...form, customerContactPerson: e.target.value })}
              placeholder="Shown as NAME OF CONTACT PERSON under CUSTOMER on the PDF"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <input
              disabled={!isAdmin}
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              placeholder="e.g. Indian Rupees — used in the PDF's Amount in Words line"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelCls}>Notes</label>
            <textarea
              disabled={!isAdmin}
              rows={2}
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>
      </div>

      <div className={sectionCardCls}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-slate-900">Line Items</h3>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelected}
              />
              <button
                onClick={() => setUploadModalOpen(true)}
                disabled={importing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60"
              >
                {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                Upload Sheet
              </button>
              <button onClick={openAddItem} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800">
                <Plus size={13} /> Add Item
              </button>
            </div>
          )}
        </div>
        {importStatus && (
          <div className="px-3 py-2 mb-3 text-[12px] text-slate-600 bg-slate-50 border border-slate-200 rounded">
            {importStatus}
          </div>
        )}
        {po.items.length === 0 ? (
          <p className="py-6 text-[12px] text-center text-slate-400">No items added yet.</p>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                <th className="px-3 py-2 font-medium text-left">Item</th>
                <th className="px-3 py-2 font-medium text-left">HSN Code</th>
                <th className="px-3 py-2 font-medium text-right">Quantity</th>
                <th className="px-3 py-2 font-medium text-left">Unit</th>
                <th className="px-3 py-2 font-medium text-right">Unit Price</th>
                <th className="px-3 py-2 font-medium text-right">Line Total</th>
                {isAdmin && <th className="px-3 py-2 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {po.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 text-slate-700">
                    <div>{item.itemName}</div>
                    {item.description && (
                      <div className="mt-0.5 text-[11px] text-slate-400">{item.description}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    <input
                      disabled={!isAdmin}
                      value={hsnCodes[item.id] ?? ""}
                      onChange={(e) => setHsnCodes({ ...hsnCodes, [item.id]: e.target.value })}
                      placeholder="Optional"
                      className="w-24 px-2 py-1 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{item.quantity}</td>
                  <td className="px-3 py-2 text-slate-600">{item.unit || "--"}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{formatCost(item.unitPrice)}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-800">
                    {formatCost(item.quantity * toNumber(item.unitPrice))}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditItem(item)}
                          title="Edit"
                          className="p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteItemTarget(item)}
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
            <tfoot>
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-3 py-2 text-right text-[12px] font-semibold text-slate-700">Total</td>
                <td className="px-3 py-2 text-right text-[12px] font-bold text-slate-900">{formatCost(itemsTotal)}</td>
                {isAdmin && <td className="px-3 py-2" />}
              </tr>
            </tfoot>
          </table>
        </div>
        )}
      </div>

      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">Upload Line Items</h3>
              <button onClick={() => setUploadModalOpen(false)} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3 text-[12px] text-slate-600">
              <p>
                The file must have a header row with an <span className="font-medium text-slate-800">Item</span>{" "}
                (or "Item Name") column and a <span className="font-medium text-slate-800">Quantity</span> (or
                "Qty") column, plus these optional columns (any order, extra columns are ignored):
              </p>
              <ul className="pl-4 space-y-1 list-disc marker:text-slate-400">
                <li>Unit</li>
                <li>Unit Price</li>
                <li>Description</li>
              </ul>
              <p>
                Each row's item name is matched against the shared catalog (case-insensitive) — a match is linked
                automatically, otherwise it's added as free text. A trailing{" "}
                <span className="font-medium text-slate-800">TOTAL</span> row or rows with no item name are
                automatically skipped. Accepted formats: .xlsx, .xls, .csv.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800"
                >
                  <Upload size={14} />
                  Choose File & Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {addItemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">{editingItemId ? "Edit Item" : "Add Item"}</h3>
              <button onClick={() => setAddItemOpen(false)} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={submitAddItem} className="p-4 space-y-3">
              {addItemError && (
                <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
                  {addItemError}
                </div>
              )}
              <div>
                <label className={labelCls}>Item</label>
                <ItemNameField
                  autoFocus
                  itemId={addItemForm.itemId}
                  currentName={addItemForm.itemName}
                  onSelect={(item) => setAddItemForm({ ...addItemForm, itemId: item.id, itemName: item.name })}
                  onAddNew={() => setCatalogModalOpen(true)}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Quantity</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={addItemForm.quantity}
                    onChange={(e) => setAddItemForm({ ...addItemForm, quantity: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Unit</label>
                  <input
                    value={addItemForm.unit}
                    onChange={(e) => setAddItemForm({ ...addItemForm, unit: e.target.value })}
                    placeholder="e.g. pcs"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Unit Price</label>
                  <input
                    type="number"
                    min="0"
                    value={addItemForm.unitPrice}
                    onChange={(e) => setAddItemForm({ ...addItemForm, unitPrice: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  rows={2}
                  value={addItemForm.description}
                  onChange={(e) => setAddItemForm({ ...addItemForm, description: e.target.value })}
                  placeholder="Shown under the item name on the PDF (optional)"
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAddItemOpen(false)} disabled={addItemBusy} className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-60">
                  Cancel
                </button>
                <button type="submit" disabled={addItemBusy} className={primaryBtnCls}>
                  {addItemBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingItemId ? "Save Changes" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {catalogModalOpen && (
        <CatalogItemFormModal
          onClose={() => setCatalogModalOpen(false)}
          onSaved={async (item) => {
            await catalogQuery.refetch();
            setAddItemForm((prev) => ({ ...prev, itemId: item.id, itemName: item.name }));
            setCatalogModalOpen(false);
          }}
        />
      )}

      <ConfirmationModal
        isOpen={deleteItemTarget !== null}
        onClose={() => setDeleteItemTarget(null)}
        onConfirm={confirmDeleteItem}
        isLoading={deleteItemBusy}
        title="Delete Item"
        message={`Delete "${deleteItemTarget?.itemName}" from this purchase order? This can't be undone.`}
      />

      <div className={sectionCardCls}>
        <h3 className="mb-3 text-[13px] font-semibold text-slate-900">Status History</h3>
        {statusHistory.length === 0 ? (
          <p className="text-[12px] text-slate-400">No status changes yet.</p>
        ) : (
          statusHistory.map((h) => (
            <div key={h.id} className="py-1.5 border-b border-slate-100 last:border-0 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-700">
                  {h.fromStatus ? `${PO_STATUS_STYLES[h.fromStatus as PurchaseOrderStatus]?.label ?? h.fromStatus} → ` : ""}
                  {PO_STATUS_STYLES[h.toStatus as PurchaseOrderStatus]?.label ?? h.toStatus}
                </span>
                <span className="text-slate-400">{new Date(h.createdAt).toLocaleDateString()}</span>
              </div>
              {h.changedBy && <span className="text-slate-400">{h.changedBy.fullName}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// =====================================================================================
// Shipment tab (+ Insurance / Customs sub-sections)
// =====================================================================================

type ShipmentForm = {
  shipmentNo: string;
  transportMode: ShipmentTransportMode;
  transportCompany: string;
  containerNo: string;
  vehicleNo: string;
  trackingNo: string;
  etd: string;
  eta: string;
  arrivalDate: string;
  status: ShipmentStatus;
  freightCost: string;
  loadingCost: string;
  unloadingCost: string;
  fuelCost: string;
  miscellaneousCost: string;
  localTaxCost: string;
};

const emptyShipmentForm: ShipmentForm = {
  shipmentNo: "",
  transportMode: "road",
  transportCompany: "",
  containerNo: "",
  vehicleNo: "",
  trackingNo: "",
  etd: "",
  eta: "",
  arrivalDate: "",
  status: "booked",
  freightCost: "",
  loadingCost: "",
  unloadingCost: "",
  fuelCost: "",
  miscellaneousCost: "",
  localTaxCost: "",
};

const shipmentFormFromEntity = (s: Shipment): ShipmentForm => ({
  shipmentNo: s.shipmentNo || "",
  transportMode: s.transportMode,
  transportCompany: s.transportCompany || "",
  containerNo: s.containerNo || "",
  vehicleNo: s.vehicleNo || "",
  trackingNo: s.trackingNo || "",
  etd: s.etd ? s.etd.slice(0, 10) : "",
  eta: s.eta ? s.eta.slice(0, 10) : "",
  arrivalDate: s.arrivalDate ? s.arrivalDate.slice(0, 10) : "",
  status: s.status,
  freightCost: s.freightCost !== null && s.freightCost !== undefined ? String(s.freightCost) : "",
  loadingCost: s.loadingCost !== null && s.loadingCost !== undefined ? String(s.loadingCost) : "",
  unloadingCost: s.unloadingCost !== null && s.unloadingCost !== undefined ? String(s.unloadingCost) : "",
  fuelCost: s.fuelCost !== null && s.fuelCost !== undefined ? String(s.fuelCost) : "",
  miscellaneousCost: s.miscellaneousCost !== null && s.miscellaneousCost !== undefined ? String(s.miscellaneousCost) : "",
  localTaxCost: s.localTaxCost !== null && s.localTaxCost !== undefined ? String(s.localTaxCost) : "",
});

const ShipmentTab: React.FC<{ po: PurchaseOrder; isAdmin: boolean; onChanged: () => Promise<void> }> = ({ po, isAdmin, onChanged }) => {
  const createMutation = useCreateShipmentMutation();
  const updateMutation = useUpdateShipmentMutation();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shipment = po.shipment;

  const [form, setForm] = useState<ShipmentForm>(shipment ? shipmentFormFromEntity(shipment) : emptyShipmentForm);

  useEffect(() => {
    setForm(shipment ? shipmentFormFromEntity(shipment) : emptyShipmentForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipment?.id]);

  const buildInput = () => ({
    shipmentNo: form.shipmentNo.trim() || undefined,
    transportMode: form.transportMode,
    transportCompany: form.transportCompany.trim() || undefined,
    containerNo: form.containerNo.trim() || undefined,
    vehicleNo: form.vehicleNo.trim() || undefined,
    trackingNo: form.trackingNo.trim() || undefined,
    etd: form.etd || undefined,
    eta: form.eta || undefined,
    arrivalDate: form.arrivalDate || undefined,
    status: form.status,
    freightCost: numOrUndef(form.freightCost),
    loadingCost: numOrUndef(form.loadingCost),
    unloadingCost: numOrUndef(form.unloadingCost),
    fuelCost: numOrUndef(form.fuelCost),
    miscellaneousCost: numOrUndef(form.miscellaneousCost),
    localTaxCost: numOrUndef(form.localTaxCost),
  });

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      await createMutation.mutateAsync({ purchaseOrderId: po.id, input: buildInput() });
      await onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create shipment."));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!shipment) return;
    setBusy(true);
    setError(null);
    try {
      await updateMutation.mutateAsync({ id: shipment.id, input: buildInput() });
      await onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update shipment."));
    } finally {
      setBusy(false);
    }
  };

  const fieldsDisabled = !isAdmin;

  const shipmentFields = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className={labelCls}>Shipment No</label>
        <input disabled={fieldsDisabled} value={form.shipmentNo} onChange={(e) => setForm({ ...form, shipmentNo: e.target.value })} className={inputCls} placeholder="Optional" />
      </div>
      <div>
        <label className={labelCls}>Transport Mode</label>
        <div className="relative">
          <select
            disabled={fieldsDisabled}
            value={form.transportMode}
            onChange={(e) => setForm({ ...form, transportMode: e.target.value as ShipmentTransportMode })}
            className="w-full px-3 py-2 pr-8 text-[13px] bg-white border border-slate-200 rounded-lg outline-none appearance-none focus:border-blue-400 disabled:bg-slate-50"
          >
            <option value="road">Road</option>
            <option value="sea">Sea</option>
            <option value="air">Air</option>
          </select>
          <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-2.5 top-1/2 w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Status</label>
        <div className="relative">
          <select
            disabled={fieldsDisabled}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as ShipmentStatus })}
            className="w-full px-3 py-2 pr-8 text-[13px] bg-white border border-slate-200 rounded-lg outline-none appearance-none focus:border-blue-400 disabled:bg-slate-50"
          >
            <option value="booked">Booked</option>
            <option value="in_transit">In Transit</option>
            <option value="arrived">Arrived</option>
            <option value="delivered">Delivered</option>
          </select>
          <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-2.5 top-1/2 w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Transport Company</label>
        <input disabled={fieldsDisabled} value={form.transportCompany} onChange={(e) => setForm({ ...form, transportCompany: e.target.value })} className={inputCls} placeholder="Optional" />
      </div>
      <div>
        <label className={labelCls}>Container No</label>
        <input disabled={fieldsDisabled} value={form.containerNo} onChange={(e) => setForm({ ...form, containerNo: e.target.value })} className={inputCls} placeholder="Optional" />
      </div>
      <div>
        <label className={labelCls}>Vehicle No</label>
        <input disabled={fieldsDisabled} value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} className={inputCls} placeholder="Optional" />
      </div>
      <div>
        <label className={labelCls}>Tracking No</label>
        <input disabled={fieldsDisabled} value={form.trackingNo} onChange={(e) => setForm({ ...form, trackingNo: e.target.value })} className={inputCls} placeholder="Optional" />
      </div>
      <div>
        <label className={labelCls}>ETD</label>
        <input type="date" disabled={fieldsDisabled} value={form.etd} onChange={(e) => setForm({ ...form, etd: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>ETA</label>
        <input type="date" disabled={fieldsDisabled} value={form.eta} onChange={(e) => setForm({ ...form, eta: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Arrival Date</label>
        <input type="date" disabled={fieldsDisabled} value={form.arrivalDate} onChange={(e) => setForm({ ...form, arrivalDate: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Freight Cost</label>
        <input type="number" disabled={fieldsDisabled} value={form.freightCost} onChange={(e) => setForm({ ...form, freightCost: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Loading Cost</label>
        <input type="number" disabled={fieldsDisabled} value={form.loadingCost} onChange={(e) => setForm({ ...form, loadingCost: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Unloading Cost</label>
        <input type="number" disabled={fieldsDisabled} value={form.unloadingCost} onChange={(e) => setForm({ ...form, unloadingCost: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Fuel Cost</label>
        <input type="number" disabled={fieldsDisabled} value={form.fuelCost} onChange={(e) => setForm({ ...form, fuelCost: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Miscellaneous Cost</label>
        <input type="number" disabled={fieldsDisabled} value={form.miscellaneousCost} onChange={(e) => setForm({ ...form, miscellaneousCost: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Local Tax Cost</label>
        <input type="number" disabled={fieldsDisabled} value={form.localTaxCost} onChange={(e) => setForm({ ...form, localTaxCost: e.target.value })} className={inputCls} />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      {error && (
        <div className="flex items-center justify-between px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      <div className={sectionCardCls}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
            <Truck size={14} className="text-slate-400" /> Shipment
          </h3>
          {isAdmin && (
            <button onClick={shipment ? handleUpdate : handleCreate} disabled={busy} className={primaryBtnCls}>
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {shipment ? "Save Changes" : "Create Shipment"}
            </button>
          )}
        </div>
        {!shipment && !isAdmin ? (
          <p className="text-[12px] text-slate-400">No shipment recorded yet.</p>
        ) : (
          shipmentFields
        )}
      </div>

      {shipment && (
        <>
          <InsuranceBlock shipment={shipment} isAdmin={isAdmin} onChanged={onChanged} />
          <CustomsBlock shipment={shipment} isAdmin={isAdmin} onChanged={onChanged} />
        </>
      )}
    </div>
  );
};

type InsuranceForm = { insuranceCompany: string; policyNumber: string; coverage: string; premium: string; claimStatus: string };
const emptyInsuranceForm: InsuranceForm = { insuranceCompany: "", policyNumber: "", coverage: "", premium: "", claimStatus: "" };
const insuranceFormFromEntity = (i: Insurance): InsuranceForm => ({
  insuranceCompany: i.insuranceCompany || "",
  policyNumber: i.policyNumber || "",
  coverage: i.coverage !== null && i.coverage !== undefined ? String(i.coverage) : "",
  premium: i.premium !== null && i.premium !== undefined ? String(i.premium) : "",
  claimStatus: i.claimStatus || "",
});

const InsuranceBlock: React.FC<{ shipment: Shipment; isAdmin: boolean; onChanged: () => Promise<void> }> = ({ shipment, isAdmin, onChanged }) => {
  const createMutation = useCreateInsuranceMutation();
  const updateMutation = useUpdateInsuranceMutation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insurance = shipment.insurance;
  const [form, setForm] = useState<InsuranceForm>(insurance ? insuranceFormFromEntity(insurance) : emptyInsuranceForm);

  useEffect(() => {
    setForm(insurance ? insuranceFormFromEntity(insurance) : emptyInsuranceForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insurance?.id]);

  const buildInput = () => ({
    insuranceCompany: form.insuranceCompany.trim() || undefined,
    policyNumber: form.policyNumber.trim() || undefined,
    coverage: numOrUndef(form.coverage),
    premium: numOrUndef(form.premium),
    claimStatus: form.claimStatus.trim() || undefined,
  });

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      if (insurance) {
        await updateMutation.mutateAsync({ id: insurance.id, input: buildInput() });
      } else {
        await createMutation.mutateAsync({ shipmentId: shipment.id, input: buildInput() });
      }
      await onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save insurance."));
    } finally {
      setBusy(false);
    }
  };

  if (!insurance && !isAdmin) return null;

  return (
    <div className={sectionCardCls}>
      {error && <div className="mb-3 px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
          <Shield size={14} className="text-slate-400" /> Insurance
        </h3>
        {isAdmin && (
          <button onClick={handleSave} disabled={busy} className={primaryBtnCls}>
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {insurance ? "Save Changes" : "Add Insurance"}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Insurance Company</label>
          <input disabled={!isAdmin} value={form.insuranceCompany} onChange={(e) => setForm({ ...form, insuranceCompany: e.target.value })} className={inputCls} placeholder="Optional" />
        </div>
        <div>
          <label className={labelCls}>Policy Number</label>
          <input disabled={!isAdmin} value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} className={inputCls} placeholder="Optional" />
        </div>
        <div>
          <label className={labelCls}>Coverage</label>
          <input type="number" disabled={!isAdmin} value={form.coverage} onChange={(e) => setForm({ ...form, coverage: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Premium</label>
          <input type="number" disabled={!isAdmin} value={form.premium} onChange={(e) => setForm({ ...form, premium: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Claim Status</label>
          <input disabled={!isAdmin} value={form.claimStatus} onChange={(e) => setForm({ ...form, claimStatus: e.target.value })} className={inputCls} placeholder="Optional" />
        </div>
      </div>
    </div>
  );
};

type CustomsForm = {
  customDeclarationNumber: string;
  billOfEntry: string;
  hsCode: string;
  clearingAgent: string;
  port: string;
  importDuty: string;
  vat: string;
  excise: string;
  serviceCharge: string;
  documentationCost: string;
  inspectionCost: string;
  warehouseCost: string;
  miscellaneousCost: string;
};
const emptyCustomsForm: CustomsForm = {
  customDeclarationNumber: "",
  billOfEntry: "",
  hsCode: "",
  clearingAgent: "",
  port: "",
  importDuty: "",
  vat: "",
  excise: "",
  serviceCharge: "",
  documentationCost: "",
  inspectionCost: "",
  warehouseCost: "",
  miscellaneousCost: "",
};
const customsFormFromEntity = (c: Customs): CustomsForm => ({
  customDeclarationNumber: c.customDeclarationNumber || "",
  billOfEntry: c.billOfEntry || "",
  hsCode: c.hsCode || "",
  clearingAgent: c.clearingAgent || "",
  port: c.port || "",
  importDuty: c.importDuty !== null && c.importDuty !== undefined ? String(c.importDuty) : "",
  vat: c.vat !== null && c.vat !== undefined ? String(c.vat) : "",
  excise: c.excise !== null && c.excise !== undefined ? String(c.excise) : "",
  serviceCharge: c.serviceCharge !== null && c.serviceCharge !== undefined ? String(c.serviceCharge) : "",
  documentationCost: c.documentationCost !== null && c.documentationCost !== undefined ? String(c.documentationCost) : "",
  inspectionCost: c.inspectionCost !== null && c.inspectionCost !== undefined ? String(c.inspectionCost) : "",
  warehouseCost: c.warehouseCost !== null && c.warehouseCost !== undefined ? String(c.warehouseCost) : "",
  miscellaneousCost: c.miscellaneousCost !== null && c.miscellaneousCost !== undefined ? String(c.miscellaneousCost) : "",
});

const DOCUMENT_TYPE_LABELS: Record<CustomsDocumentType, string> = {
  bill_of_lading: "Bill of Lading",
  commercial_invoice: "Commercial Invoice",
  packing_list: "Packing List",
  certificate_of_origin: "Certificate of Origin",
  insurance_certificate: "Insurance Certificate",
  other: "Other",
};

const CustomsBlock: React.FC<{ shipment: Shipment; isAdmin: boolean; onChanged: () => Promise<void> }> = ({ shipment, isAdmin, onChanged }) => {
  const createMutation = useCreateCustomsMutation();
  const updateMutation = useUpdateCustomsMutation();
  const uploadDocMutation = useUploadCustomsDocumentMutation();
  const deleteDocMutation = useDeleteCustomsDocumentMutation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customs = shipment.customs;
  const [form, setForm] = useState<CustomsForm>(customs ? customsFormFromEntity(customs) : emptyCustomsForm);
  const [docType, setDocType] = useState<CustomsDocumentType>("other");

  useEffect(() => {
    setForm(customs ? customsFormFromEntity(customs) : emptyCustomsForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customs?.id]);

  const buildInput = () => ({
    customDeclarationNumber: form.customDeclarationNumber.trim() || undefined,
    billOfEntry: form.billOfEntry.trim() || undefined,
    hsCode: form.hsCode.trim() || undefined,
    clearingAgent: form.clearingAgent.trim() || undefined,
    port: form.port.trim() || undefined,
    importDuty: numOrUndef(form.importDuty),
    vat: numOrUndef(form.vat),
    excise: numOrUndef(form.excise),
    serviceCharge: numOrUndef(form.serviceCharge),
    documentationCost: numOrUndef(form.documentationCost),
    inspectionCost: numOrUndef(form.inspectionCost),
    warehouseCost: numOrUndef(form.warehouseCost),
    miscellaneousCost: numOrUndef(form.miscellaneousCost),
  });

  const runAction = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Action failed."));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () =>
    runAction(() =>
      customs ? updateMutation.mutateAsync({ id: customs.id, input: buildInput() }) : createMutation.mutateAsync({ shipmentId: shipment.id, input: buildInput() }),
    );

  if (!customs && !isAdmin) return null;

  return (
    <div className={sectionCardCls}>
      {error && <div className="mb-3 px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
          <FileCheck size={14} className="text-slate-400" /> Customs
        </h3>
        {isAdmin && (
          <button onClick={handleSave} disabled={busy} className={primaryBtnCls}>
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {customs ? "Save Changes" : "Add Customs"}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Declaration Number</label>
          <input disabled={!isAdmin} value={form.customDeclarationNumber} onChange={(e) => setForm({ ...form, customDeclarationNumber: e.target.value })} className={inputCls} placeholder="Optional" />
        </div>
        <div>
          <label className={labelCls}>Bill of Entry</label>
          <input disabled={!isAdmin} value={form.billOfEntry} onChange={(e) => setForm({ ...form, billOfEntry: e.target.value })} className={inputCls} placeholder="Optional" />
        </div>
        <div>
          <label className={labelCls}>HS Code</label>
          <input disabled={!isAdmin} value={form.hsCode} onChange={(e) => setForm({ ...form, hsCode: e.target.value })} className={inputCls} placeholder="Optional" />
        </div>
        <div>
          <label className={labelCls}>Clearing Agent</label>
          <input disabled={!isAdmin} value={form.clearingAgent} onChange={(e) => setForm({ ...form, clearingAgent: e.target.value })} className={inputCls} placeholder="Optional" />
        </div>
        <div>
          <label className={labelCls}>Port</label>
          <input disabled={!isAdmin} value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} className={inputCls} placeholder="Optional" />
        </div>
        <div>
          <label className={labelCls}>Import Duty</label>
          <input type="number" disabled={!isAdmin} value={form.importDuty} onChange={(e) => setForm({ ...form, importDuty: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>VAT</label>
          <input type="number" disabled={!isAdmin} value={form.vat} onChange={(e) => setForm({ ...form, vat: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Excise</label>
          <input type="number" disabled={!isAdmin} value={form.excise} onChange={(e) => setForm({ ...form, excise: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Service Charge</label>
          <input type="number" disabled={!isAdmin} value={form.serviceCharge} onChange={(e) => setForm({ ...form, serviceCharge: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Documentation Cost</label>
          <input type="number" disabled={!isAdmin} value={form.documentationCost} onChange={(e) => setForm({ ...form, documentationCost: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Inspection Cost</label>
          <input type="number" disabled={!isAdmin} value={form.inspectionCost} onChange={(e) => setForm({ ...form, inspectionCost: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Warehouse Cost</label>
          <input type="number" disabled={!isAdmin} value={form.warehouseCost} onChange={(e) => setForm({ ...form, warehouseCost: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Miscellaneous Cost</label>
          <input type="number" disabled={!isAdmin} value={form.miscellaneousCost} onChange={(e) => setForm({ ...form, miscellaneousCost: e.target.value })} className={inputCls} />
        </div>
      </div>

      {customs && (
        <div className="pt-3 mt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[12px] font-semibold text-slate-900">Documents</h4>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as CustomsDocumentType)}
                  className="px-2 py-1 text-[11px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
                >
                  {(Object.keys(DOCUMENT_TYPE_LABELS) as CustomsDocumentType[]).map((t) => (
                    <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-[11px] font-medium text-blue-700 cursor-pointer hover:underline">
                  <Upload size={11} /> Upload
                  <input
                    type="file"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      await runAction(() => uploadDocMutation.mutateAsync({ customsId: customs.id, file, documentType: docType }));
                    }}
                  />
                </label>
              </div>
            )}
          </div>
          {customs.documents.length === 0 ? (
            <p className="text-[12px] text-slate-400">No documents uploaded yet.</p>
          ) : (
            customs.documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-[12px]">
                <a href={fileUrl(d.filePath)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-900 hover:underline truncate">
                  <Paperclip size={12} className="text-slate-400 flex-shrink-0" /> {DOCUMENT_TYPE_LABELS[d.documentType]} — {d.fileName}
                </a>
                {isAdmin && (
                  <button
                    onClick={() => runAction(() => deleteDocMutation.mutateAsync({ customsId: customs.id, documentId: d.id }))}
                    className="flex-shrink-0 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// =====================================================================================
// Cost Sheet tab
// =====================================================================================

const CostSheetTab: React.FC<{ costSheetQuery: ReturnType<typeof useCostSheetQuery> }> = ({ costSheetQuery }) => {
  const costSheet = costSheetQuery.data;

  if (costSheetQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Computing cost sheet…</p>
      </div>
    );
  }

  if (costSheetQuery.isError || !costSheet) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <AlertCircle className="w-6 h-6 text-red-600" />
        <p className="text-[13px] text-slate-600">{getErrorMessage(costSheetQuery.error, "Failed to load cost sheet.")}</p>
      </div>
    );
  }

  const rows: { label: string; value: number; note?: string }[] = [
    {
      label: "PI Value",
      value: costSheet.piValue,
      note: costSheet.piSource === "proforma_invoice" ? "(from approved Proforma Invoice)" : "(estimated from PO items — no approved PI yet)",
    },
    { label: "Freight", value: costSheet.freight },
    { label: "Loading", value: costSheet.loading },
    { label: "Unloading", value: costSheet.unloading },
    { label: "Fuel", value: costSheet.fuel },
    { label: "Shipment Miscellaneous", value: costSheet.shipmentMiscellaneous },
    { label: "Local Tax", value: costSheet.localTax },
    { label: "Insurance Premium", value: costSheet.insurancePremium },
    { label: "Customs Duty", value: costSheet.customsDuty },
    { label: "Customs VAT", value: costSheet.customsVat },
    { label: "Customs Excise", value: costSheet.customsExcise },
    { label: "Customs Service Charge", value: costSheet.customsServiceCharge },
    { label: "Customs Documentation", value: costSheet.customsDocumentation },
    { label: "Customs Inspection", value: costSheet.customsInspection },
    { label: "Customs Warehouse", value: costSheet.customsWarehouse },
    { label: "Customs Miscellaneous", value: costSheet.customsMiscellaneous },
  ];

  const visibleRows = rows.filter((r) => toNumber(r.value) !== 0 || r.label === "PI Value");

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className={sectionCardCls}>
        <h3 className="flex items-center gap-2 mb-3 text-[13px] font-semibold text-slate-900">
          <Calculator size={14} className="text-slate-400" /> Landed Cost Breakdown
        </h3>
        <table className="w-full text-[12px]">
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.label} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 text-slate-600">
                  {r.label}
                  {r.note && <span className="block text-[10px] text-slate-400">{r.note}</span>}
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-800">{formatCost(r.value)}</td>
              </tr>
            ))}
            <tr className="bg-blue-50">
              <td className="px-3 py-2.5 text-[13px] font-semibold text-blue-900">Grand Total</td>
              <td className="px-3 py-2.5 text-[13px] text-right font-bold text-blue-900">{formatCost(costSheet.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={`${sectionCardCls} bg-slate-900 border-slate-900`}>
        <p className="text-[11px] font-medium text-slate-300">Landed Cost Per Unit</p>
        <p className="mt-1 text-[26px] font-bold tracking-tight text-white">{formatCost(costSheet.landedCostPerUnit)}</p>
        <p className="mt-1 text-[11px] text-slate-400">Grand Total ÷ Total Quantity ({costSheet.totalQuantity})</p>
      </div>
    </div>
  );
};

// =====================================================================================
// Goods Receipt tab
// =====================================================================================

type GrnItemRow = { purchaseOrderItemId: number; itemName: string; receivedQuantity: string; damagedQuantity: string };

const GoodsReceiptTab: React.FC<{ po: PurchaseOrder; isAdmin: boolean; onChanged: () => Promise<void> }> = ({ po, isAdmin, onChanged }) => {
  const createMutation = useCreateGoodsReceiptMutation();
  const updateStatusMutation = useUpdateGoodsReceiptStatusMutation();
  const uploadPhotoMutation = useUploadGoodsReceiptPhotoMutation();
  const deletePhotoMutation = useDeleteGoodsReceiptPhotoMutation();
  const warehousesQuery = useOrganizationWarehousesQuery();
  const warehouses = warehousesQuery.data ?? [];

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAction = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Action failed."));
    } finally {
      setBusy(false);
    }
  };

  // ---- Record Goods Receipt form ----
  const [showForm, setShowForm] = useState(false);
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [inspectionResult, setInspectionResult] = useState("");
  const [rows, setRows] = useState<GrnItemRow[]>(
    po.items.map((i) => ({ purchaseOrderItemId: i.id, itemName: i.itemName, receivedQuantity: String(i.quantity), damagedQuantity: "0" })),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openForm = () => {
    setWarehouseId(warehouses[0]?.id ?? "");
    setInspectionResult("");
    setRows(po.items.map((i) => ({ purchaseOrderItemId: i.id, itemName: i.itemName, receivedQuantity: String(i.quantity), damagedQuantity: "0" })));
    setFormError(null);
    setShowForm(true);
  };

  const updateRow = (index: number, patch: Partial<GrnItemRow>) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = [];
    for (const row of rows) {
      const receivedQuantity = parseFloat(row.receivedQuantity);
      const damagedQuantity = parseFloat(row.damagedQuantity || "0");
      if (!Number.isFinite(receivedQuantity) || receivedQuantity < 0) {
        setFormError(`Invalid received quantity for ${row.itemName}.`);
        return;
      }
      items.push({
        purchaseOrderItemId: row.purchaseOrderItemId,
        receivedQuantity,
        damagedQuantity: Number.isFinite(damagedQuantity) ? damagedQuantity : 0,
      });
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        purchaseOrderId: po.id,
        input: {
          warehouseId: warehouseId ? Number(warehouseId) : undefined,
          inspectionResult: inspectionResult.trim() || undefined,
          items,
        },
      });
      await onChanged();
      setShowForm(false);
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to record goods receipt."));
    } finally {
      setSubmitting(false);
    }
  };

  const goodsReceipts = po.goodsReceipts ?? [];

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      {error && (
        <div className="flex items-center justify-between px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {goodsReceipts.length === 0 ? (
        <div className={`${sectionCardCls} text-center py-8`}>
          <p className="text-[12px] text-slate-400">No goods receipts recorded yet.</p>
        </div>
      ) : (
        goodsReceipts.map((gr) => (
          <div key={gr.id} className={sectionCardCls}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <PackageCheck size={14} className="text-slate-400" />
                <span className="text-[13px] font-semibold text-slate-900">{gr.grnNumber || `GRN #${gr.id}`}</span>
                <Pill {...GRN_STATUS_STYLES[gr.status]} />
              </div>
              {isAdmin && gr.status === "pending_inspection" && (
                <div className="flex items-center gap-2">
                  <button
                    disabled={busy}
                    onClick={() => runAction(() => updateStatusMutation.mutateAsync({ id: gr.id, status: "accepted" }))}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Check size={12} /> Accept
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => runAction(() => updateStatusMutation.mutateAsync({ id: gr.id, status: "partially_accepted" }))}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-900 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-60"
                  >
                    Partially Accept
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => runAction(() => updateStatusMutation.mutateAsync({ id: gr.id, status: "rejected" }))}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-60"
                  >
                    <XCircle size={12} /> Reject
                  </button>
                </div>
              )}
            </div>

            {isAdmin && gr.status === "pending_inspection" && (
              <p className="mb-3 text-[11px] text-slate-500 italic">
                Accepting or partially accepting will add the received quantity to Inventory.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 mb-3 sm:grid-cols-3 text-[12px]">
              <div><span className="text-slate-400">Warehouse:</span> <span className="text-slate-700">{gr.warehouse?.name || "--"}</span></div>
              <div><span className="text-slate-400">Received By:</span> <span className="text-slate-700">{gr.receivedBy?.fullName || "--"}</span></div>
              <div><span className="text-slate-400">Date:</span> <span className="text-slate-700">{formatDate(gr.createdAt)}</span></div>
              {gr.inspectionResult && <div className="sm:col-span-3"><span className="text-slate-400">Inspection Result:</span> <span className="text-slate-700">{gr.inspectionResult}</span></div>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                    <th className="px-3 py-2 font-medium text-left">Item</th>
                    <th className="px-3 py-2 font-medium text-right">Received Qty</th>
                    <th className="px-3 py-2 font-medium text-right">Damaged Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {gr.items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 text-slate-700">
                        {po.items.find((i) => i.id === item.purchaseOrderItemId)?.itemName || "--"}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">{item.receivedQuantity}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{item.damagedQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[12px] font-semibold text-slate-900">Photos</h4>
                {isAdmin && (
                  <label className="flex items-center gap-1 text-[11px] font-medium text-blue-700 cursor-pointer hover:underline">
                    <Upload size={11} /> Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        await runAction(() => uploadPhotoMutation.mutateAsync({ id: gr.id, file }));
                      }}
                    />
                  </label>
                )}
              </div>
              {gr.photos.length === 0 ? (
                <p className="text-[12px] text-slate-400">No photos uploaded yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {gr.photos.map((p) => (
                    <div key={p.id} className="relative group">
                      <a href={fileUrl(p.filePath)} target="_blank" rel="noreferrer">
                        <img src={fileUrl(p.filePath)} alt={p.fileName} className="object-cover w-16 h-16 border rounded-lg border-slate-200" />
                      </a>
                      {isAdmin && (
                        <button
                          onClick={() => runAction(() => deletePhotoMutation.mutateAsync({ id: gr.id, photoId: p.id }))}
                          className="absolute flex items-center justify-center w-4 h-4 text-white bg-red-600 rounded-full -top-1 -right-1 opacity-0 group-hover:opacity-100"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))
      )}

      {isAdmin && (
        <div className={sectionCardCls}>
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-slate-900">Record Goods Receipt</h3>
            <button onClick={() => (showForm ? setShowForm(false) : openForm())} className="flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline">
              <Plus size={12} /> {showForm ? "Cancel" : "New Goods Receipt"}
            </button>
          </div>
          {showForm && (
            <form onSubmit={handleSubmit} className="pt-3 mt-3 space-y-3 border-t border-slate-100">
              {formError && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">{formError}</div>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Warehouse</label>
                  <div className="relative">
                    <select
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : "")}
                      className="w-full px-3 py-2 pr-8 text-[13px] bg-white border border-slate-200 rounded-lg outline-none appearance-none focus:border-blue-400"
                    >
                      <option value="">Select warehouse</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-2.5 top-1/2 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Inspection Result</label>
                  <input value={inspectionResult} onChange={(e) => setInspectionResult(e.target.value)} className={inputCls} placeholder="Optional" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                      <th className="px-3 py-2 font-medium text-left">Item</th>
                      <th className="px-3 py-2 font-medium text-left">Received Qty</th>
                      <th className="px-3 py-2 font-medium text-left">Damaged Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.purchaseOrderItemId} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 text-slate-700">{row.itemName}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={row.receivedQuantity}
                            onChange={(e) => updateRow(i, { receivedQuantity: e.target.value })}
                            className="w-24 px-2 py-1.5 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={row.damagedQuantity}
                            onChange={(e) => updateRow(i, { damagedQuantity: e.target.value })}
                            className="w-24 px-2 py-1.5 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button type="submit" disabled={submitting} className={primaryBtnCls}>
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Record Goods Receipt
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderDetailPage;
