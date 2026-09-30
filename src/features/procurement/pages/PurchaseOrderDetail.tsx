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
  Download,
  Eye,
  Mail,
} from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { getErrorMessage } from "../../../lib/errors";
import PdfPreviewModal from "../components/PdfPreviewModal";
import { formatCost, toNumber } from "../../../lib/currency";
import { openGmailCompose } from "../../../lib/gmail";
import { PurchaseOrder, PurchaseOrderStatus, PurchaseType } from "../../../types";
import {
  usePurchaseOrderDetailQuery,
  useUpdatePurchaseOrderMutation,
  useAddPurchaseOrderItemMutation,
  useEditPurchaseOrderItemMutation,
  useDeletePurchaseOrderItemMutation,
} from "../hooks/usePurchaseOrder";
import ItemNameField from "../../inventory/components/ItemNameField";
import CatalogItemFormModal from "../../inventory/components/CatalogItemFormModal";
import ConfirmationModal from "../../../components/ConfirmationModal";
import { useOrganizationItemCatalogQuery } from "../../inventory/hooks/useInventory";

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

const Pill: React.FC<{ bg: string; fg: string; label: string }> = ({ bg, fg, label }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: bg, color: fg }}>
    {label}
  </span>
);

const inputCls = "w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500";
const labelCls = "block mb-1 text-[11px] font-medium text-slate-900";
const primaryBtnCls = "flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60 transition-colors";
const sectionCardCls = "p-4 bg-white border rounded-xl shadow-md border-slate-200";

/** At the end of a field's text, ArrowRight moves focus to the next field in the same
 * [data-arrow-row] group (ArrowLeft does the same at the start, moving back) — mirrors the
 * same handler on the Site Activities and Proforma Invoices pages. Only wired onto plain text
 * inputs (no `type` attribute) since `.selectionStart`/`.setSelectionRange` throw on
 * `type="number"`/`"date"` inputs in Chrome. */
const handleRowArrowNav = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const input = e.currentTarget;
  if (input.selectionStart !== input.selectionEnd) return; // a range is selected — let the browser collapse it first
  const atStart = input.selectionStart === 0;
  const atEnd = input.selectionStart === input.value.length;
  if (!((e.key === "ArrowLeft" && atStart) || (e.key === "ArrowRight" && atEnd))) return;

  const row = input.closest<HTMLElement>("[data-arrow-row]");
  if (!row) return;
  const fields = Array.from(row.querySelectorAll<HTMLInputElement>("input[type='text'], input:not([type])")).filter((el) => !el.disabled);
  const idx = fields.indexOf(input);
  if (idx === -1) return;
  const next = fields[e.key === "ArrowRight" ? idx + 1 : idx - 1];
  if (next) {
    e.preventDefault();
    next.focus();
    const pos = e.key === "ArrowRight" ? 0 : next.value.length;
    next.setSelectionRange(pos, pos);
  }
};

const numOrUndef = (s: string): number | undefined => {
  if (s.trim() === "") return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "--";

/**
 * Purchase Order detail — the Overview tab's content only (Shipment/Cost Sheet/
 * Goods Receipt were removed; Proforma Invoice lives on its own sidebar page, see
 * ProformaInvoices.tsx). Rendered either as a full route page (`PurchaseOrderDetailPage`,
 * for deep links from Finance/VendorFinance/ItemCostReport/ProformaInvoices) or inline
 * inside a large popup modal (from the Purchase Orders list's row click — see
 * `PurchaseOrderDetailModal` below / PurchaseOrders.tsx).
 */
export const PurchaseOrderDetailView: React.FC<{ poId: number; onBack: () => void }> = ({ poId, onBack }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  // Finance can edit a PO while reviewing it for approval (see PurchaseOrderController.updatePurchaseOrder's
  // inline bypass) without holding the broader "projects.procurement" permission admins get.
  const canEditHeader = isAdmin || user?.role === "finance";

  const [headerError, setHeaderError] = useState<string | null>(null);
  const [headerBusy, setHeaderBusy] = useState(false);

  const detailQuery = usePurchaseOrderDetailQuery(Number.isFinite(poId) ? poId : null);
  const updateMutation = useUpdatePurchaseOrderMutation();

  const po = detailQuery.data;

  const refetchAll = async () => {
    await detailQuery.refetch();
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
          onClick={onBack}
          className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Back to Purchase Orders
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-[60vh] bg-white">
      {/* Header */}
      <div className="flex flex-col gap-3 px-6 pt-4 pb-3 bg-white lg:px-8">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
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

      {/* Content */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        <div className="flex-1 p-6 overflow-auto">
          <OverviewTab po={po} isAdmin={isAdmin} onChanged={refetchAll} onBack={onBack} />
        </div>
      </div>
    </div>
  );
};

/** Route wrapper for deep links (Finance/VendorFinance/ItemCostReport/ProformaInvoices row
 * clicks navigate here). The Purchase Orders list itself no longer navigates — it opens
 * `PurchaseOrderDetailModal` in place instead. */
const PurchaseOrderDetailPage: React.FC = () => {
  const { organizationId, id } = useParams<{ organizationId: string; id: string }>();
  const navigate = useNavigate();
  const poId = Number(id);
  return <PurchaseOrderDetailView poId={Number.isFinite(poId) ? poId : NaN} onBack={() => navigate(`/${organizationId}/purchase-orders`)} />;
};

/** Large popup-form rendering of the detail view, opened from the Purchase Orders list's
 * row click instead of navigating to a separate page. */
export const PurchaseOrderDetailModal: React.FC<{ poId: number; onClose: () => void }> = ({ poId, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-slate-900/50 backdrop-blur-sm sm:p-6">
      <div className="w-full max-w-6xl overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200 my-4">
        <div className="flex items-center justify-end px-4 py-2 border-b border-slate-100">
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" title="Close">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[85vh] overflow-y-auto">
          {/* Esc/Enter/Tab shortcuts (with an Esc confirmation) live inside OverviewTab — see
              its keydown effect and confirmCancel dialog, which call onBack() below on confirm. */}
          <PurchaseOrderDetailView poId={poId} onBack={onClose} />
        </div>
      </div>
    </div>
  );
};

// =====================================================================================
// Overview tab
// =====================================================================================

type OverviewForm = {
  poNumber: string;
  poDate: string;
  paymentTerms: string;
  incoterms: string;
  taxPercent: string;
  terms: string;
  deliveryPeriod: string;
  finalDestination: string;
  customerContactPerson: string;
  customerPanVatNumber: string;
  customerEmail: string;
  customerPhone: string;
  currency: string;
};

const formFromPo = (po: PurchaseOrder): OverviewForm => ({
  poNumber: po.poNumber || "",
  poDate: po.poDate ? po.poDate.slice(0, 10) : new Date().toLocaleDateString("en-CA"),
  paymentTerms: po.paymentTerms || "",
  incoterms: po.incoterms || "",
  taxPercent: po.taxPercent !== null && po.taxPercent !== undefined ? String(po.taxPercent) : "",
  terms: po.terms || "",
  deliveryPeriod: po.deliveryPeriod || "",
  finalDestination: po.finalDestination || "",
  customerContactPerson: po.customerContactPerson || "",
  customerPanVatNumber: po.customerPanVatNumber || "",
  customerEmail: po.customerEmail || "",
  customerPhone: po.customerPhone || "",
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

const OverviewTab: React.FC<{ po: PurchaseOrder; isAdmin: boolean; onChanged: () => Promise<void>; onBack: () => void }> = ({ po, isAdmin, onChanged, onBack }) => {
  const { organization } = useAuth();
  const [previewOpen, setPreviewOpen] = useState(false);
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
  /** Asked before leaving (Esc) so in-progress edits aren't lost by accident — mirrors the
   * Proforma Invoice form's Esc/Enter/Tab shortcuts. */
  const [confirmCancel, setConfirmCancel] = useState(false);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);

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

  // Click-to-edit line item cells (Item / Quantity / Unit / Unit Price) — an admin can edit a
  // value directly in the table instead of opening the Edit Item popup for a single-field change.
  type CellField = "itemName" | "quantity" | "unit" | "unitPrice";
  const [editingCell, setEditingCell] = useState<{ itemId: number; field: CellField } | null>(null);
  const [cellValue, setCellValue] = useState("");
  const [cellBusy, setCellBusy] = useState(false);

  const cellValueFor = (item: PurchaseOrder["items"][number], field: CellField): string => {
    switch (field) {
      case "itemName": return item.itemName;
      case "quantity": return String(item.quantity);
      case "unit": return item.unit || "";
      case "unitPrice": return item.unitPrice != null ? String(toNumber(item.unitPrice)) : "";
    }
  };

  const startCellEdit = (item: PurchaseOrder["items"][number], field: CellField) => {
    if (!isAdmin || cellBusy) return;
    setEditingCell({ itemId: item.id, field });
    setCellValue(cellValueFor(item, field));
  };

  const cancelCellEdit = () => setEditingCell(null);

  const saveCellEdit = async () => {
    if (!editingCell) return;
    const item = po.items.find((i) => i.id === editingCell.itemId);
    if (!item) { setEditingCell(null); return; }
    const { field } = editingCell;
    const trimmed = cellValue.trim();

    if (trimmed === cellValueFor(item, field)) { setEditingCell(null); return; }

    let quantity = item.quantity;
    let unitPrice = item.unitPrice != null ? toNumber(item.unitPrice) : null;
    if (field === "itemName" && !trimmed) { setEditingCell(null); return; }
    if (field === "quantity") {
      const q = parseFloat(trimmed);
      if (!Number.isFinite(q) || q <= 0) { setEditingCell(null); return; }
      quantity = q;
    }
    if (field === "unitPrice") {
      const p = trimmed ? parseFloat(trimmed) : null;
      if (trimmed && !Number.isFinite(p)) { setEditingCell(null); return; }
      unitPrice = p;
    }

    setCellBusy(true);
    setError(null);
    try {
      await editItemMutation.mutateAsync({
        id: po.id,
        itemId: item.id,
        input: {
          itemName: field === "itemName" ? trimmed : item.itemName,
          itemId: item.itemId ?? null,
          quantity,
          unit: field === "unit" ? (trimmed || undefined) : (item.unit || undefined),
          unitPrice,
          description: item.description || null,
        },
      });
      await onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save item."));
    } finally {
      setCellBusy(false);
      setEditingCell(null);
    }
  };

  const cellInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancelCellEdit();
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
          poDate: form.poDate || null,
          paymentTerms: form.paymentTerms.trim() || null,
          incoterms: form.incoterms.trim() || null,
          taxPercent: numOrUndef(form.taxPercent) ?? null,
          terms: form.terms.trim() || null,
          deliveryPeriod: form.deliveryPeriod.trim() || null,
          finalDestination: form.finalDestination.trim() || null,
          customerContactPerson: form.customerContactPerson.trim() || null,
          customerPanVatNumber: form.customerPanVatNumber.trim() || null,
          customerEmail: form.customerEmail.trim() || null,
          customerPhone: form.customerPhone.trim() || null,
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

  // Esc = Back (after a confirmation), Enter = Save Changes. Enter inside a text area still adds
  // a new line (Ctrl/Cmd+Enter saves from there), and a focused button keeps its own Enter
  // behaviour. Suppressed while a nested popup (Add/Edit Item, new catalog item, delete
  // confirmation, PDF preview, sheet upload) is open so it doesn't fight that popup's own
  // Enter/Escape handling — mirrors the Proforma Invoice form's shortcuts.
  useEffect(() => {
    const anyPopupOpen = addItemOpen || catalogModalOpen || deleteItemTarget !== null || previewOpen || uploadModalOpen;
    if (anyPopupOpen || editingCell) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirmCancel((open) => !open);
        return;
      }
      if (e.key !== "Enter" || confirmCancel || !isAdmin) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "BUTTON" || target.tagName === "A") return;
      if (target.tagName === "TEXTAREA" && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      if (!busy) handleSave();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addItemOpen, catalogModalOpen, deleteItemTarget, previewOpen, uploadModalOpen, editingCell, confirmCancel, isAdmin, busy, form, hsnCodes]);

  const statusHistory = po.statusHistory ?? [];

  const itemsTotal = po.items.reduce((sum, i) => sum + i.quantity * toNumber(i.unitPrice), 0);

  const poDisplayNumber = po.poNumber || `PO-${po.id}`;
  const emailDefaultSubject = `Purchase Order ${poDisplayNumber}`;
  const emailDefaultMessage = `Dear ${po.vendor?.contactPerson || po.vendor?.name || "Sir/Madam"},

Please find attached Purchase Order ${poDisplayNumber} for your reference.

Kindly review and confirm receipt at your earliest convenience.

Best regards,
${organization?.name || ""}`;

  return (
    <div className="flex flex-col gap-4 w-full">
      {error && (
        <div className="flex items-center justify-between px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      <div className="text-[11.5px] text-slate-500">
        <p>
          Press <kbd className="px-1.5 py-0.5 font-sans text-[11px] font-medium bg-white border rounded border-slate-300">Tab</kbd> to switch to the next field · Press <kbd className="px-1.5 py-0.5 font-sans text-[11px] font-medium bg-white border rounded border-slate-300">Enter</kbd> to save · Press <kbd className="px-1.5 py-0.5 font-sans text-[11px] font-medium bg-white border rounded border-slate-300">Esc</kbd> to go back
        </p>
        {isAdmin && (
          <p className="mt-1">
            <kbd className="px-1.5 py-0.5 font-sans text-[11px] font-medium bg-white border rounded border-slate-300">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 font-sans text-[11px] font-medium bg-white border rounded border-slate-300">Enter</kbd> to save from a text area
          </p>
        )}
      </div>

      <div className={sectionCardCls}>
        <h3 className="mb-3 text-[13px] font-semibold text-slate-900">Customer Details</h3>
        <div data-arrow-row className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls}>Customer Contact Person</label>
            <input
              disabled={!isAdmin}
              value={form.customerContactPerson}
              onChange={(e) => setForm({ ...form, customerContactPerson: e.target.value })}
              onKeyDown={handleRowArrowNav}
              placeholder="Shown as NAME OF CONTACT PERSON under CUSTOMER on the PDF"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Customer PAN/VAT No.</label>
            <input
              disabled={!isAdmin}
              value={form.customerPanVatNumber}
              onChange={(e) => setForm({ ...form, customerPanVatNumber: e.target.value })}
              onKeyDown={handleRowArrowNav}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Customer Email</label>
            <input
              type="email"
              disabled={!isAdmin}
              value={form.customerEmail}
              onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
              onKeyDown={handleRowArrowNav}
              placeholder="Shown as EMAIL ADDRESS under CUSTOMER on the PDF — defaults to the organization's own email"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Customer Phone</label>
            <input
              disabled={!isAdmin}
              value={form.customerPhone}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              onKeyDown={handleRowArrowNav}
              placeholder="Shown as PHONE under CUSTOMER on the PDF — defaults to the organization's own phone"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className={sectionCardCls}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-slate-900">Purchase Order Details</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 w-fit"
            >
              <Eye size={13} /> Preview PDF
            </button>
            {previewOpen && (
              <PdfPreviewModal
                url={pdfUrl(po.id)}
                fileName={`${(po.poNumber || `PO-${po.id}`).replace(/\//g, "-")}.pdf`}
                onClose={() => setPreviewOpen(false)}
              />
            )}
            <button
              onClick={() => openGmailCompose(po.vendor?.email || "", emailDefaultSubject, emailDefaultMessage)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 w-fit"
            >
              <Mail size={13} /> Send Email
            </button>
            {isAdmin && (
              <button onClick={handleSave} disabled={busy} className={primaryBtnCls}>
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            )}
          </div>
        </div>
        <div data-arrow-row className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelCls}>PO Number</label>
            <input
              disabled={!isAdmin}
              value={form.poNumber}
              onChange={(e) => setForm({ ...form, poNumber: e.target.value })}
              onKeyDown={handleRowArrowNav}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input
              type="date"
              disabled={!isAdmin}
              value={form.poDate}
              onChange={(e) => setForm({ ...form, poDate: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{po.purchaseType === "international" ? "GSTIN No." : "Vendor PAN/VAT No."}</label>
            <input
              disabled
              value={po.vendor?.panVatNumber || "--"}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Incoterms</label>
            <input
              disabled={!isAdmin}
              value={form.incoterms}
              onChange={(e) => setForm({ ...form, incoterms: e.target.value })}
              onKeyDown={handleRowArrowNav}
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
              onKeyDown={handleRowArrowNav}
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
              onKeyDown={handleRowArrowNav}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <input
              disabled={!isAdmin}
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              onKeyDown={handleRowArrowNav}
              placeholder="e.g. Indian Rupees — used in the PDF's Amount in Words line"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelCls}>Payment Terms</label>
            <textarea
              disabled={!isAdmin}
              rows={5}
              value={form.paymentTerms}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelCls}>Notes</label>
            <textarea
              disabled={!isAdmin}
              rows={5}
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
                    {editingCell?.itemId === item.id && editingCell.field === "itemName" ? (
                      <input
                        autoFocus
                        disabled={cellBusy}
                        value={cellValue}
                        onChange={(e) => setCellValue(e.target.value)}
                        onBlur={saveCellEdit}
                        onKeyDown={cellInputKeyDown}
                        className="w-full px-2 py-1 text-[12px] border border-blue-400 rounded outline-none disabled:bg-slate-50"
                      />
                    ) : (
                      <div
                        onClick={() => startCellEdit(item, "itemName")}
                        title={isAdmin ? "Click to edit" : undefined}
                        className={isAdmin ? "-mx-1 px-1 py-0.5 rounded cursor-text hover:bg-slate-50" : ""}
                      >
                        {item.itemName}
                      </div>
                    )}
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
                  <td className="px-3 py-2 text-right text-slate-600">
                    {editingCell?.itemId === item.id && editingCell.field === "quantity" ? (
                      <input
                        autoFocus
                        type="number"
                        min="0.01"
                        step="any"
                        disabled={cellBusy}
                        value={cellValue}
                        onChange={(e) => setCellValue(e.target.value)}
                        onBlur={saveCellEdit}
                        onKeyDown={cellInputKeyDown}
                        className="w-20 px-2 py-1 text-[12px] text-right border border-blue-400 rounded outline-none disabled:bg-slate-50"
                      />
                    ) : (
                      <span
                        onClick={() => startCellEdit(item, "quantity")}
                        title={isAdmin ? "Click to edit" : undefined}
                        className={isAdmin ? "inline-block -mx-1 px-1 py-0.5 rounded cursor-text hover:bg-slate-50" : ""}
                      >
                        {item.quantity}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {editingCell?.itemId === item.id && editingCell.field === "unit" ? (
                      <input
                        autoFocus
                        disabled={cellBusy}
                        value={cellValue}
                        onChange={(e) => setCellValue(e.target.value)}
                        onBlur={saveCellEdit}
                        onKeyDown={cellInputKeyDown}
                        className="w-20 px-2 py-1 text-[12px] border border-blue-400 rounded outline-none disabled:bg-slate-50"
                      />
                    ) : (
                      <span
                        onClick={() => startCellEdit(item, "unit")}
                        title={isAdmin ? "Click to edit" : undefined}
                        className={isAdmin ? "inline-block -mx-1 px-1 py-0.5 rounded cursor-text hover:bg-slate-50" : ""}
                      >
                        {item.unit || "--"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {editingCell?.itemId === item.id && editingCell.field === "unitPrice" ? (
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        step="any"
                        disabled={cellBusy}
                        value={cellValue}
                        onChange={(e) => setCellValue(e.target.value)}
                        onBlur={saveCellEdit}
                        onKeyDown={cellInputKeyDown}
                        className="w-24 px-2 py-1 text-[12px] text-right border border-blue-400 rounded outline-none disabled:bg-slate-50"
                      />
                    ) : (
                      <span
                        onClick={() => startCellEdit(item, "unitPrice")}
                        title={isAdmin ? "Click to edit" : undefined}
                        className={isAdmin ? "inline-block -mx-1 px-1 py-0.5 rounded cursor-text hover:bg-slate-50" : ""}
                      >
                        {formatCost(item.unitPrice)}
                      </span>
                    )}
                  </td>
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
                <li>Unit of Measure</li>
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
                  <label className={labelCls}>Unit of Measure</label>
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
                    step="any"
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

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div
            className="w-full max-w-sm bg-white shadow-xl rounded-xl"
            // Left/Right toggles between the two buttons (Enter then presses the focused one).
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                keepEditingRef.current?.focus();
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                confirmCancelRef.current?.focus();
              }
            }}
          >
            <div className="px-5 pt-5">
              <h3 className="text-[14px] font-semibold text-slate-900">Leave without saving?</h3>
              <p className="mt-1 text-[12px] text-slate-500">Any unsaved changes to this purchase order will be discarded.</p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4">
              <button
                ref={keepEditingRef}
                autoFocus
                onClick={() => setConfirmCancel(false)}
                className="px-4 py-2 text-[12px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                Keep editing
              </button>
              <button
                ref={confirmCancelRef}
                onClick={() => {
                  setConfirmCancel(false);
                  onBack();
                }}
                className="px-4 py-2 text-[12px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                Yes, leave
              </button>
            </div>
          </div>
        </div>
      )}

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

export default PurchaseOrderDetailPage;
