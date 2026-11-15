import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  X,
  Trash2,
  Upload,
  Paperclip,
  ChevronDown,
  Plus,
  Check,
  XCircle,
  Download,
  Eye,
} from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { getErrorMessage } from "../../../lib/errors";
import PdfPreviewModal from "../components/PdfPreviewModal";
import { preloadPdfFonts } from "../pdf/pdfFonts";
import { formatCost, toNumber } from "../../../lib/currency";
import { PurchaseOrder, PurchaseOrderStatus, PurchaseType } from "../../../types";
import {
  usePurchaseOrderDetailQuery,
  useUpdatePurchaseOrderMutation,
  useAddPurchaseOrderItemMutation,
  useEditPurchaseOrderItemMutation,
  useDeletePurchaseOrderItemMutation,
  useOrganizationPurchaseOrdersQuery,
} from "../hooks/usePurchaseOrder";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const fileUrl = (filePath: string) => `${API_BASE}/uploads/${filePath}`;
const generatePoPdf = (id: number) => import("../pdf/generatePdf").then((m) => m.generatePurchaseOrderPdf(id));
// PDFs are drawn in the browser (see ../pdf/generatePdf.ts): warm the fonts and the (lazy) pdfkit
// chunk in the background so "Preview PDF" opens without waiting on either.
preloadPdfFonts();
void import("../pdf/generatePdf");


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

/** One editable row of the Line Items table. Numbers are kept as the text the user typed; `id` is
 * null for a row that hasn't been saved yet. Nothing is sent to the server until Save Changes. */
type ItemRow = { key: string; id: number | null; itemName: string; hsnCode: string; quantity: string; unit: string; unitPrice: string; custom: Record<string, string> };

/** A user-defined column: `key` is stable (values are stored under it), `label` is the heading the user typed. */
type CustomCol = { key: string; label: string };

const newColKey = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const rowFromItem = (item: PurchaseOrder["items"][number]): ItemRow => ({
  key: `i${item.id}`,
  id: item.id,
  itemName: item.itemName,
  hsnCode: item.hsnCode || "",
  quantity: String(item.quantity),
  unit: item.unit || "",
  unitPrice: item.unitPrice != null ? String(toNumber(item.unitPrice)) : "",
  custom: { ...(item.customValues ?? {}) },
});

let newRowSeq = 0;
const blankRow = (): ItemRow => ({ key: `n${++newRowSeq}`, id: null, itemName: "", hsnCode: "", quantity: "", unit: "", unitPrice: "", custom: {} });

const rowIsBlank = (r: ItemRow) =>
  !r.itemName.trim() && !r.hsnCode.trim() && !r.quantity.trim() && !r.unit.trim() && !r.unitPrice.trim() && Object.values(r.custom).every((v) => !v.trim());

/** Comparable snapshot of a row (ignores the React key), so "has anything changed?" is a string compare. */
const rowSig = (r: ItemRow) =>
  JSON.stringify([
    r.id,
    r.itemName.trim(),
    r.hsnCode.trim(),
    r.quantity.trim(),
    r.unit.trim(),
    r.unitPrice.trim(),
    Object.entries(r.custom)
      .map(([k, v]) => [k, v.trim()] as const)
      .filter(([, v]) => v)
      .sort(([a], [b]) => a.localeCompare(b)),
  ]);

const colsSig = (cols: CustomCol[]) => JSON.stringify(cols.filter((c) => c.label.trim()).map((c) => [c.key, c.label.trim()]));

/** Keeps only digits and a single decimal point, so number cells can stay plain left-aligned text inputs. */
const cleanNumberText = (s: string) => {
  const t = s.replace(/[^0-9.]/g, "");
  const dot = t.indexOf(".");
  return dot === -1 ? t : t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, "");
};

const cellInputCls =
  "w-full h-full px-2.5 py-2 text-[12px] text-left text-slate-800 bg-transparent border-0 outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500 disabled:text-slate-600";

/** A free-form spec table on the Overview tab (PDF, right above Payment Terms) — title, column
 * headers and rows are all admin-defined, so it can match any spec sheet shape (a simple
 * S.N./label/value table, or a wider multi-column table with its own footer note). */
type SpecTableForm = {
  title: string;
  columns: string[];
  footerNote: string;
  rows: string[][];
};

const emptySpecTable = (): SpecTableForm => ({
  title: "",
  columns: ["S.N.", "Particulars", "Description"],
  footerNote: "",
  rows: [["", "", ""]],
});

const specTablesFromPo = (po: PurchaseOrder): SpecTableForm[] =>
  (po.specTables || []).map((t) => ({
    title: t.title,
    columns: [...t.columns],
    footerNote: t.footerNote || "",
    rows: t.rows.map((r) => [...r.cells]),
  }));

const OverviewTab: React.FC<{ po: PurchaseOrder; isAdmin: boolean; onChanged: () => Promise<void>; onBack: () => void }> = ({ po, isAdmin, onChanged, onBack }) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const updateMutation = useUpdatePurchaseOrderMutation();
  const addItemMutation = useAddPurchaseOrderItemMutation();
  const editItemMutation = useEditPurchaseOrderItemMutation();
  const deleteItemMutation = useDeletePurchaseOrderItemMutation();
  const ordersQuery = useOrganizationPurchaseOrdersQuery();

  const [form, setForm] = useState<OverviewForm>(() => formFromPo(po));
  /** Free-form spec tables (PDF, right above Payment Terms) — a table is dropped from the PDF
   * entirely when it has no title or no non-blank rows (see PurchaseOrderController). */
  const [specTables, setSpecTables] = useState<SpecTableForm[]>(() => specTablesFromPo(po));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Asked before leaving (Esc) so in-progress edits aren't lost by accident — mirrors the
   * Proforma Invoice form's Esc/Enter/Tab shortcuts. */
  const [confirmCancel, setConfirmCancel] = useState(false);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);

  // ---- Line Items: an editable, spreadsheet-style table. Rows live in local state and are only
  // written to the server by Save Changes (see saveItems). ----
  const baselineRows = useMemo(() => po.items.map(rowFromItem), [po.items]);
  const [rows, setRows] = useState<ItemRow[]>(() => (baselineRows.length || !isAdmin ? baselineRows : [blankRow()]));
  const baselineCols = useMemo<CustomCol[]>(() => (po.itemColumns ?? []).map((c) => ({ key: c.key, label: c.label })), [po.itemColumns]);
  const [customCols, setCustomCols] = useState<CustomCol[]>(baselineCols);
  const [itemsBusy, setItemsBusy] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  // Re-sync the table whenever the saved items change (after a save, an import, or opening another
  // PO) - but never while a save is running, so a half-finished save can't wipe what was typed.
  useEffect(() => {
    if (itemsBusy) return;
    setRows(baselineRows.length || !isAdmin ? baselineRows : [blankRow()]);
    setCustomCols(baselineCols);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baselineRows, baselineCols, itemsBusy]);

  useEffect(() => {
    if (!focusKey) return;
    const selector = focusKey.startsWith("col:") ? `th[data-col-key="${focusKey.slice(4)}"] input` : `tr[data-row-key="${focusKey}"] input`;
    document.querySelector<HTMLInputElement>(selector)?.focus();
    setFocusKey(null);
  }, [focusKey, rows]);

  const itemsDirty = useMemo(
    () =>
      rows.filter((r) => !rowIsBlank(r)).map(rowSig).join("|") !== baselineRows.map(rowSig).join("|") ||
      colsSig(customCols) !== colsSig(baselineCols),
    [rows, baselineRows, customCols, baselineCols],
  );

  const updateRow = (key: string, patch: Partial<ItemRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addCustomCol = () => {
    const col = { key: newColKey(), label: "" };
    setCustomCols((prev) => [...prev, col]);
    setFocusKey(`col:${col.key}`);
  };

  const renameCustomCol = (key: string, label: string) =>
    setCustomCols((prev) => prev.map((c) => (c.key === key ? { ...c, label } : c)));

  const removeCustomCol = (key: string) => {
    setCustomCols((prev) => prev.filter((c) => c.key !== key));
    setRows((prev) =>
      prev.map((r) => {
        if (!(key in r.custom)) return r;
        const { [key]: _removed, ...rest } = r.custom;
        return { ...r, custom: rest };
      }),
    );
  };

  const updateCustomValue = (rowKey: string, colKey: string, value: string) =>
    setRows((prev) => prev.map((r) => (r.key === rowKey ? { ...r, custom: { ...r.custom, [colKey]: value } } : r)));

  const addRow = () => {
    const row = blankRow();
    setRows((prev) => [...prev, row]);
    setFocusKey(row.key);
  };

  const removeRow = (key: string) =>
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length ? next : [blankRow()];
    });

  /** Writes the table to the server: deletes removed rows, edits changed ones, adds new ones.
   * Returns false (and sets `error`) if validation fails or any call fails. */
  const saveItems = async (): Promise<boolean> => {
    const filled = rows.filter((r) => !rowIsBlank(r));
    const parsed: { row: ItemRow; name: string; qty: number; price: number | null }[] = [];
    for (const row of filled) {
      const name = row.itemName.trim();
      if (!name) {
        setError("Every line item needs an item name.");
        return false;
      }
      const qty = parseFloat(row.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`Enter a valid quantity for "${name}".`);
        return false;
      }
      const price = row.unitPrice.trim() === "" ? null : parseFloat(row.unitPrice);
      if (price !== null && !Number.isFinite(price)) {
        setError(`Enter a valid unit price for "${name}".`);
        return false;
      }
      parsed.push({ row, name, qty, price });
    }

    // Only columns with a heading are kept; a row's custom values are cut down to those columns.
    const validCols = customCols.filter((c) => c.label.trim()).map((c) => ({ key: c.key, label: c.label.trim() }));
    const customOf = (row: ItemRow): Record<string, string> =>
      Object.fromEntries(validCols.map((c) => [c.key, (row.custom[c.key] ?? "").trim()] as const).filter(([, v]) => v));

    setItemsBusy(true);
    setError(null);
    try {
      if (colsSig(customCols) !== colsSig(baselineCols)) {
        await updateMutation.mutateAsync({ id: po.id, input: { itemColumns: validCols } });
      }
      const keptIds = new Set(filled.filter((r) => r.id !== null).map((r) => r.id));
      for (const item of po.items) {
        if (!keptIds.has(item.id)) {
          // eslint-disable-next-line no-await-in-loop -- sequential keeps per-row errors simple
          await deleteItemMutation.mutateAsync({ id: po.id, itemId: item.id });
        }
      }
      for (const { row, name, qty, price } of parsed) {
        const original = row.id !== null ? po.items.find((i) => i.id === row.id) : undefined;
        if (original) {
          if (rowSig(row) === rowSig(rowFromItem(original))) continue;
          // eslint-disable-next-line no-await-in-loop
          await editItemMutation.mutateAsync({
            id: po.id,
            itemId: original.id,
            input: {
              itemName: name,
              itemId: name === original.itemName ? original.itemId ?? null : null,
              hsnCode: row.hsnCode.trim() || null,
              customValues: customOf(row),
              quantity: qty,
              unit: row.unit.trim() || null,
              unitPrice: price,
              // Fields this table no longer shows are carried over untouched.
              perUnit: original.perUnit || null,
              unitWeight: original.unitWeight != null ? toNumber(original.unitWeight) : null,
              weightUnit: original.weightUnit || null,
              rate: original.rate != null ? toNumber(original.rate) : null,
              description: original.description || null,
            },
          });
        } else {
          // eslint-disable-next-line no-await-in-loop
          await addItemMutation.mutateAsync({
            id: po.id,
            input: { itemName: name, itemId: null, hsnCode: row.hsnCode.trim() || null, customValues: customOf(row), quantity: qty, unit: row.unit.trim() || null, unitPrice: price },
          });
        }
      }
      await onChanged();
      return true;
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save line items. Check the table and save again."));
      await onChanged();
      return false;
    } finally {
      setItemsBusy(false);
    }
  };

  const openPreview = async () => {
    if (itemsDirty && isAdmin && !(await saveItems())) return;
    setPreviewOpen(true);
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


        // eslint-disable-next-line no-await-in-loop -- sequential upserts keep per-row error attribution simple
        await addItemMutation.mutateAsync({
          id: po.id,
          input: { itemName, itemId: null, quantity, unit, unitPrice, description },
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
    setSpecTables(specTablesFromPo(po));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po.id]);

  // ---- Free-form spec table editing (add/remove table, rename/add/remove column, add/remove
  // row, edit a cell) — see SpecTableForm above. ----
  const addSpecTable = () => setSpecTables((prev) => [...prev, emptySpecTable()]);
  const removeSpecTable = (tableIdx: number) => setSpecTables((prev) => prev.filter((_, i) => i !== tableIdx));
  const updateSpecTableTitle = (tableIdx: number, title: string) =>
    setSpecTables((prev) => prev.map((t, i) => (i === tableIdx ? { ...t, title } : t)));
  const updateSpecTableFooter = (tableIdx: number, footerNote: string) =>
    setSpecTables((prev) => prev.map((t, i) => (i === tableIdx ? { ...t, footerNote } : t)));
  const updateSpecColumn = (tableIdx: number, colIdx: number, value: string) =>
    setSpecTables((prev) =>
      prev.map((t, i) => (i === tableIdx ? { ...t, columns: t.columns.map((c, ci) => (ci === colIdx ? value : c)) } : t)),
    );
  const addSpecColumn = (tableIdx: number) =>
    setSpecTables((prev) =>
      prev.map((t, i) =>
        i === tableIdx
          ? { ...t, columns: [...t.columns, `Column ${t.columns.length + 1}`], rows: t.rows.map((r) => [...r, ""]) }
          : t,
      ),
    );
  const removeSpecColumn = (tableIdx: number, colIdx: number) =>
    setSpecTables((prev) =>
      prev.map((t, i) =>
        i === tableIdx
          ? { ...t, columns: t.columns.filter((_, ci) => ci !== colIdx), rows: t.rows.map((r) => r.filter((_, ci) => ci !== colIdx)) }
          : t,
      ),
    );
  const addSpecRow = (tableIdx: number) =>
    setSpecTables((prev) => prev.map((t, i) => (i === tableIdx ? { ...t, rows: [...t.rows, t.columns.map(() => "")] } : t)));
  const removeSpecRow = (tableIdx: number, rowIdx: number) =>
    setSpecTables((prev) => prev.map((t, i) => (i === tableIdx ? { ...t, rows: t.rows.filter((_, ri) => ri !== rowIdx) } : t)));
  const updateSpecCell = (tableIdx: number, rowIdx: number, colIdx: number, value: string) =>
    setSpecTables((prev) =>
      prev.map((t, i) =>
        i === tableIdx
          ? { ...t, rows: t.rows.map((r, ri) => (ri === rowIdx ? r.map((c, ci) => (ci === colIdx ? value : c)) : r)) }
          : t,
      ),
    );

  // Carry the Customer Details fields over from the most recently saved PO that has them, so a
  // brand-new PO (this one has never had any of its own customer info saved) starts pre-filled
  // instead of blank — same info tends to repeat PO after PO. Only fills fields this PO doesn't
  // already have its own saved value for, and never overwrites anything the admin has already
  // typed into the form.
  useEffect(() => {
    const hasOwnCustomerInfo = po.customerContactPerson || po.customerPanVatNumber || po.customerEmail || po.customerPhone;
    if (hasOwnCustomerInfo) return;
    const orders = ordersQuery.data;
    if (!orders || orders.length === 0) return;
    const sorted = [...orders]
      .filter((o) => o.id !== po.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latestContactPerson = sorted.find((o) => o.customerContactPerson)?.customerContactPerson || "";
    const latestPanVatNumber = sorted.find((o) => o.customerPanVatNumber)?.customerPanVatNumber || "";
    const latestEmail = sorted.find((o) => o.customerEmail)?.customerEmail || "";
    const latestPhone = sorted.find((o) => o.customerPhone)?.customerPhone || "";
    if (!latestContactPerson && !latestPanVatNumber && !latestEmail && !latestPhone) return;
    setForm((prev) => ({
      ...prev,
      customerContactPerson: prev.customerContactPerson || latestContactPerson,
      customerPanVatNumber: prev.customerPanVatNumber || latestPanVatNumber,
      customerEmail: prev.customerEmail || latestEmail,
      customerPhone: prev.customerPhone || latestPhone,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po.id, ordersQuery.data]);

  const handleSave = async () => {
    const trimmedPoNumber = form.poNumber.trim();
    if (!trimmedPoNumber) {
      setError("PO number cannot be empty.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (itemsDirty && !(await saveItems())) return;
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
          specTables: specTables.map((t) => ({
            title: t.title.trim(),
            columns: t.columns.map((c) => c.trim()),
            footerNote: t.footerNote.trim() || null,
            rows: t.rows.map((r) => ({ cells: r.map((c) => c.trim()) })),
          })),
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
    const anyPopupOpen = previewOpen || uploadModalOpen;
    if (anyPopupOpen) return;
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
  }, [previewOpen, uploadModalOpen, confirmCancel, isAdmin, busy, form, rows, itemsDirty]);

  const statusHistory = po.statusHistory ?? [];

  const rowTotal = (r: ItemRow) => {
    const q = parseFloat(r.quantity);
    const p = parseFloat(r.unitPrice);
    return (Number.isFinite(q) ? q : 0) * (Number.isFinite(p) ? p : 0);
  };
  const itemsTotal = rows.reduce((sum, r) => sum + rowTotal(r), 0);
  // VAT comes from the Tax % field above (live, even before it's saved); with no Tax % there is no VAT row.
  const taxPct = parseFloat(form.taxPercent);
  const vatPct = Number.isFinite(taxPct) && taxPct > 0 ? taxPct : 0;
  const vatAmount = vatPct > 0 ? itemsTotal * (vatPct / 100) : 0;
  const grandTotal = itemsTotal + vatAmount;
  const lastRowKey = rows.length ? rows[rows.length - 1]!.key : null;

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
              onClick={openPreview}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 w-fit"
            >
              <Eye size={13} /> Preview PDF
            </button>
            {previewOpen && (
              <PdfPreviewModal
                generate={() => generatePoPdf(po.id)}
                fileName={`${(po.poNumber || `PO-${po.id}`).replace(/\//g, "-")}.pdf`}
                onClose={() => setPreviewOpen(false)}
              />
            )}
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
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-[13px] font-semibold text-slate-900">Line Items</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Type straight into the table — Tab moves to the next cell (and adds a row after the last one). Add Column creates your own column; it prints on the PDF once it has a name and at least one value. Changes are saved with Save Changes.
            </p>
          </div>
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
                disabled={importing || itemsBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60"
              >
                {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                Upload Sheet
              </button>
              <button
                type="button"
                onClick={addCustomCol}
                disabled={itemsBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60"
              >
                <Plus size={13} /> Add Column
              </button>
              <button onClick={addRow} disabled={itemsBusy} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 disabled:opacity-60">
                <Plus size={13} /> Add Row
              </button>
            </div>
          )}
        </div>
        {importStatus && (
          <div className="px-3 py-2 mb-3 text-[12px] text-slate-600 bg-slate-50 border border-slate-200 rounded">
            {importStatus}
          </div>
        )}
        {itemsDirty && isAdmin && (
          <div className="px-3 py-2 mb-3 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded">
            You have unsaved line item changes — click Save Changes to keep them.
          </div>
        )}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide">
                <th className="w-16 px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">S.N.</th>
                <th className="px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">Item</th>
                <th className="w-32 px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">HSN Code <span className="normal-case text-slate-400">(optional)</span></th>
                <th className="w-28 px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">Quantity</th>
                <th className="w-28 px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">Unit</th>
                {customCols.map((col) => (
                  <th key={col.key} data-col-key={col.key} className="w-40 p-0 font-medium text-left border-b border-r border-slate-200">
                    <div className="flex items-center">
                      <input
                        disabled={!isAdmin || itemsBusy}
                        value={col.label}
                        onChange={(e) => renameCustomCol(col.key, e.target.value)}
                        placeholder="Column name"
                        className="flex-1 min-w-0 px-2.5 py-2 text-[11px] font-medium tracking-wide text-left text-slate-600 uppercase bg-transparent border-0 outline-none placeholder:normal-case placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500"
                      />
                      {isAdmin && (
                        <button type="button" onClick={() => removeCustomCol(col.key)} tabIndex={-1} title="Remove column" className="p-1 mr-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="w-36 px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">Unit Price</th>
                <th className="w-36 px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">Total Price</th>
                <th className="w-16 px-2.5 py-2 font-medium text-center border-b border-slate-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={row.key} data-row-key={row.key} className="border-b border-slate-200 last:border-b-0">
                  <td className="px-2.5 py-2 text-left text-slate-500 bg-slate-50/60 border-r border-slate-200">{rowIdx + 1}</td>
                  <td className="p-0 border-r border-slate-200">
                    <input
                      disabled={!isAdmin || itemsBusy}
                      value={row.itemName}
                      onChange={(e) => updateRow(row.key, { itemName: e.target.value })}
                      placeholder="Item name"
                      className={cellInputCls}
                    />
                  </td>
                  <td className="p-0 border-r border-slate-200">
                    <input
                      disabled={!isAdmin || itemsBusy}
                      value={row.hsnCode}
                      onChange={(e) => updateRow(row.key, { hsnCode: e.target.value })}
                      className={cellInputCls}
                    />
                  </td>
                  <td className="p-0 border-r border-slate-200">
                    <input
                      disabled={!isAdmin || itemsBusy}
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.key, { quantity: cleanNumberText(e.target.value) })}
                      className={cellInputCls}
                    />
                  </td>
                  <td className="p-0 border-r border-slate-200">
                    <input
                      disabled={!isAdmin || itemsBusy}
                      value={row.unit}
                      onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                      placeholder="e.g. pcs"
                      className={cellInputCls}
                    />
                  </td>
                  {customCols.map((col) => (
                    <td key={col.key} className="p-0 border-r border-slate-200">
                      <input
                        disabled={!isAdmin || itemsBusy}
                        value={row.custom[col.key] ?? ""}
                        onChange={(e) => updateCustomValue(row.key, col.key, e.target.value)}
                        className={cellInputCls}
                      />
                    </td>
                  ))}
                  <td className="p-0 border-r border-slate-200">
                    <input
                      disabled={!isAdmin || itemsBusy}
                      inputMode="decimal"
                      value={row.unitPrice}
                      onChange={(e) => updateRow(row.key, { unitPrice: cleanNumberText(e.target.value) })}
                      onKeyDown={(e) => {
                        // Tab out of the very last cell starts a new row, like a spreadsheet.
                        if (e.key === "Tab" && !e.shiftKey && row.key === lastRowKey && isAdmin) {
                          e.preventDefault();
                          addRow();
                        }
                      }}
                      className={cellInputCls}
                    />
                  </td>
                  <td className="px-2.5 py-2 font-medium text-left text-slate-800 bg-slate-50/60 border-r border-slate-200">
                    {rowTotal(row) > 0 ? formatCost(rowTotal(row)) : ""}
                  </td>
                  <td className="px-1 py-1 text-center">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        disabled={itemsBusy}
                        tabIndex={-1}
                        title="Remove row"
                        className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={6 + customCols.length} className="px-2.5 py-2 text-right text-[12px] font-semibold text-slate-700 border-r border-slate-200">Total</td>
                <td className="px-2.5 py-2 text-left text-[12px] font-bold text-slate-900 border-r border-slate-200">{formatCost(itemsTotal)}</td>
                <td />
              </tr>
              {vatPct > 0 && (
                <tr className="bg-slate-50">
                  <td colSpan={6 + customCols.length} className="px-2.5 py-2 text-right text-[12px] font-semibold text-slate-700 border-r border-slate-200">
                    Value Added Tax @ {vatPct}%
                  </td>
                  <td className="px-2.5 py-2 text-left text-[12px] font-bold text-slate-900 border-r border-slate-200">{formatCost(vatAmount)}</td>
                  <td />
                </tr>
              )}
              <tr className="bg-slate-100 border-t border-slate-300">
                <td colSpan={6 + customCols.length} className="px-2.5 py-2 text-right text-[12px] font-bold text-slate-800 border-r border-slate-200">Grand Total</td>
                <td className="px-2.5 py-2 text-left text-[12px] font-bold text-slate-900 border-r border-slate-200">{formatCost(grandTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
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
                Item names are added exactly as written. A trailing{" "}
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
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[13px] font-semibold text-slate-900">Specification Tables</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Shown on the PDF right above Payment Terms (e.g. "Technical Specification", "Electricity Requirement", "Electrical Motor data...") — a table with no title or no rows doesn't appear at all. Add as many as you need, each with its own columns.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={addSpecTable}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 w-fit"
            >
              <Plus size={13} /> Add Table
            </button>
          )}
        </div>
        {specTables.length === 0 ? (
          <p className="text-[12px] text-slate-400">No spec tables added.</p>
        ) : (
          <div className="space-y-4">
            {specTables.map((table, tIdx) => (
              <div key={tIdx} className="p-3 border rounded-lg border-slate-200">
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <label className={labelCls}>Table Title</label>
                    <input
                      disabled={!isAdmin}
                      value={table.title}
                      onChange={(e) => updateSpecTableTitle(tIdx, e.target.value)}
                      placeholder="e.g. Technical Specification"
                      className={inputCls}
                    />
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => removeSpecTable(tIdx)}
                      title="Remove table"
                      className="flex-shrink-0 p-1.5 mt-5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                <label className={labelCls}>Columns</label>
                <div className="flex items-start gap-1.5 mb-2">
                  {table.columns.map((col, cIdx) => (
                    <div key={cIdx} className="flex items-center flex-1 min-w-0 gap-1">
                      <input
                        disabled={!isAdmin}
                        value={col}
                        onChange={(e) => updateSpecColumn(tIdx, cIdx, e.target.value)}
                        className={`${inputCls} font-medium`}
                      />
                      {isAdmin && table.columns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSpecColumn(tIdx, cIdx)}
                          title="Remove column"
                          className="flex-shrink-0 p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => addSpecColumn(tIdx)}
                      title="Add column"
                      className="flex-shrink-0 p-2 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>

                <label className={labelCls}>Rows</label>
                <div className="space-y-1.5">
                  {table.rows.map((row, rIdx) => (
                    <div key={rIdx} data-arrow-row className="flex items-center gap-1.5">
                      {table.columns.map((col, cIdx) => (
                        <input
                          key={cIdx}
                          disabled={!isAdmin}
                          value={row[cIdx] ?? ""}
                          onChange={(e) => updateSpecCell(tIdx, rIdx, cIdx, e.target.value)}
                          onKeyDown={handleRowArrowNav}
                          placeholder={col}
                          className={`${inputCls} flex-1 min-w-0`}
                        />
                      ))}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => removeSpecRow(tIdx, rIdx)}
                          title="Remove row"
                          className="flex-shrink-0 p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => addSpecRow(tIdx)}
                    className="flex items-center gap-1 mt-2 text-[11px] font-medium text-blue-700 hover:underline"
                  >
                    <Plus size={12} /> Add Row
                  </button>
                )}

                <div className="mt-3">
                  <label className={labelCls}>Footer Note (optional)</label>
                  <input
                    disabled={!isAdmin}
                    value={table.footerNote}
                    onChange={(e) => updateSpecTableFooter(tIdx, e.target.value)}
                    placeholder="e.g. Motors Make – Havells (RPM 1440)"
                    className={inputCls}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
