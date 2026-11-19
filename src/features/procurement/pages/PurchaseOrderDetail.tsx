import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle, X, Upload, ChevronDown, Plus, Eye } from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { getErrorMessage } from "../../../lib/errors";
import PdfPreviewModal from "../components/PdfPreviewModal";
import PoFormField from "../components/PoFormField";
import PoLineItemRow from "../components/PoLineItemRow";
import PoSpecTablesEditor, { specTablesFromPo, type SpecTableForm } from "../components/PoSpecTablesEditor";
import { useColumnWidths } from "../hooks/useColumnWidths";
import { preloadPdfFonts } from "../pdf/pdfFonts";
import { toNumber } from "../../../lib/currency";
import { PurchaseOrder, PurchaseOrderStatus, PurchaseType } from "../../../types";
import {
  usePurchaseOrderDetailQuery,
  useUpdatePurchaseOrderMutation,
  useAddPurchaseOrderItemMutation,
  useEditPurchaseOrderItemMutation,
  useDeletePurchaseOrderItemMutation,
  useOrganizationPurchaseOrdersQuery,
} from "../hooks/usePurchaseOrder";
import { useProjects } from "../../projects/hooks/useProjects";
import { inputCls, labelCls, numOrUndef, primaryBtnCls, sectionCardCls } from "../utils/poFormUi";
import {
  blankRow,
  formatPoMoney,
  colsSig,
  newColKey,
  parseLineItemsSheet,
  rowFromItem,
  rowIsBlank,
  rowSig,
  rowTotal,
  type CustomCol,
  type ItemRow,
} from "../utils/poLineItems";

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

const PO_STATUSES = Object.keys(PO_STATUS_STYLES) as PurchaseOrderStatus[];
const PURCHASE_TYPES = Object.keys(PURCHASE_TYPE_STYLES) as PurchaseType[];

const Pill: React.FC<{ bg: string; fg: string; label: string }> = ({ bg, fg, label }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: bg, color: fg }}>
    {label}
  </span>
);

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="px-1.5 py-0.5 font-sans text-[11px] font-medium bg-white border rounded border-slate-300">{children}</kbd>
);

/** Compact dropdown used for the Purchase Type / Status pickers in the header. */
function HeaderSelect<T extends string>({
  value,
  options,
  labelOf,
  disabled,
  onChange,
}: {
  value: T;
  options: T[];
  labelOf: (option: T) => string;
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none pl-3 pr-8 py-2 text-[12px] border border-slate-200 rounded-lg outline-none cursor-pointer focus:border-blue-400 disabled:opacity-60"
      >
        {options.map((o) => (
          <option key={o} value={o}>{labelOf(o)}</option>
        ))}
      </select>
      <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-2.5 top-1/2 w-3.5 h-3.5 text-slate-400" />
    </div>
  );
}

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
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [headerBusy, setHeaderBusy] = useState(false);

  const detailQuery = usePurchaseOrderDetailQuery(Number.isFinite(poId) ? poId : null);
  const updateMutation = useUpdatePurchaseOrderMutation();

  const po = detailQuery.data;
  // View-only page access (see ProcurementPageAccess) reads the PO but cannot change it.
  const canEditPo = po?.access?.canEdit !== false;
  const canEditHeader = (isAdmin || user?.role === "finance") && canEditPo;

  const refetchAll = async () => {
    await detailQuery.refetch();
  };

  const updateHeader = async (input: { status: PurchaseOrderStatus } | { purchaseType: PurchaseType }, failMessage: string) => {
    if (!po) return;
    setHeaderBusy(true);
    setHeaderError(null);
    try {
      await updateMutation.mutateAsync({ id: po.id, input });
      await refetchAll();
    } catch (err) {
      setHeaderError(getErrorMessage(err, failMessage));
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
                <HeaderSelect
                  value={po.purchaseType}
                  options={PURCHASE_TYPES}
                  labelOf={(t) => PURCHASE_TYPE_STYLES[t].label}
                  disabled={headerBusy}
                  onChange={(purchaseType) => updateHeader({ purchaseType }, "Failed to update purchase type.")}
                />
                <HeaderSelect
                  value={po.status}
                  options={PO_STATUSES}
                  labelOf={(s) => PO_STATUS_STYLES[s].label}
                  disabled={headerBusy}
                  onChange={(status) => updateHeader({ status }, "Failed to update status.")}
                />
              </>
            )}
            {headerBusy && <Loader2 className="w-4 h-4 text-blue-900 animate-spin" />}
            {po.access?.canEdit === false && (
              <span className="px-2 py-1 text-[11px] font-medium rounded-full text-amber-800 bg-amber-50 border border-amber-200">View only</span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        <div className="flex-1 p-6 overflow-auto">
          <OverviewTab po={po} isAdmin={isAdmin && canEditPo} onChanged={refetchAll} onBack={onBack} />
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
  /** "" = no project. */
  projectId: string;
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
  projectId: po.project?.id != null ? String(po.project.id) : po.projectId != null ? String(po.projectId) : "",
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
  currency: (po.currency || "").toUpperCase(),
});

const OverviewTab: React.FC<{ po: PurchaseOrder; isAdmin: boolean; onChanged: () => Promise<void>; onBack: () => void }> = ({ po, isAdmin, onChanged, onBack }) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const updateMutation = useUpdatePurchaseOrderMutation();
  const addItemMutation = useAddPurchaseOrderItemMutation();
  const editItemMutation = useEditPurchaseOrderItemMutation();
  const deleteItemMutation = useDeletePurchaseOrderItemMutation();
  const ordersQuery = useOrganizationPurchaseOrdersQuery();

  const [form, setForm] = useState<OverviewForm>(() => formFromPo(po));
  const { data: projects = [] } = useProjects();
  // One stable handler for every text field, so the memoised fields below only re-render when their own value changes.
  // The currency label is always kept in capitals (npr -> NPR) as it is typed.
  const setField = useCallback(
    (name: string, value: string) => setForm((prev) => ({ ...prev, [name]: name === "currency" ? value.toUpperCase() : value })),
    [],
  );
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
  const baselineRowsSig = useMemo(() => baselineRows.map(rowSig).join("|"), [baselineRows]);
  const [rows, setRows] = useState<ItemRow[]>(() => (baselineRows.length || !isAdmin ? baselineRows : [blankRow()]));
  const baselineCols = useMemo<CustomCol[]>(() => (po.itemColumns ?? []).map((c) => ({ key: c.key, label: c.label })), [po.itemColumns]);
  const baselineColsSig = useMemo(() => colsSig(baselineCols), [baselineCols]);
  const [customCols, setCustomCols] = useState<CustomCol[]>(baselineCols);
  const colIds = useMemo(() => ["sn", "item", "hsn", "qty", "unit", ...customCols.map((c) => c.key), "unitPrice", "vat", "total", "actions"], [customCols]);
  const { tableRef, widthOf, tableMinWidth, startResize, resetWidth } = useColumnWidths(colIds);
  const resizeHandle = (id: string) => (
    <span
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize · double-click to reset"
      onPointerDown={(e) => startResize(id, e)}
      onDoubleClick={() => resetWidth(id)}
      className="absolute top-0 right-0 z-10 w-2 h-full -mr-1 cursor-col-resize touch-none hover:bg-blue-400/50 active:bg-blue-500/60"
    />
  );
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
    () => rows.filter((r) => !rowIsBlank(r)).map(rowSig).join("|") !== baselineRowsSig || colsSig(customCols) !== baselineColsSig,
    [rows, baselineRowsSig, customCols, baselineColsSig],
  );

  // Row handlers are stable (functional updates only), so memoised rows aren't re-rendered by unrelated edits.
  const updateRow = useCallback(
    (key: string, patch: Partial<ItemRow>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r))),
    [],
  );

  const updateCustomValue = useCallback(
    (rowKey: string, colKey: string, value: string) =>
      setRows((prev) => prev.map((r) => (r.key === rowKey ? { ...r, custom: { ...r.custom, [colKey]: value } } : r))),
    [],
  );

  const addRow = useCallback(() => {
    const row = blankRow();
    setRows((prev) => [...prev, row]);
    setFocusKey(row.key);
  }, []);

  const removeRow = useCallback(
    (key: string) =>
      setRows((prev) => {
        const next = prev.filter((r) => r.key !== key);
        return next.length ? next : [blankRow()];
      }),
    [],
  );

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
    const itemsById = new Map(po.items.map((i) => [i.id, i] as const));

    setItemsBusy(true);
    setError(null);
    try {
      if (colsSig(customCols) !== baselineColsSig) {
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
        const original = row.id !== null ? itemsById.get(row.id) : undefined;
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
              taxable: row.taxable,
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
            input: { itemName: name, itemId: null, hsnCode: row.hsnCode.trim() || null, taxable: row.taxable, customValues: customOf(row), quantity: qty, unit: row.unit.trim() || null, unitPrice: price },
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

  // Bulk import via .xlsx/.csv — parsed entirely client-side (see parseLineItemsSheet), then replayed as
  // sequential addPurchaseOrderItem calls (same "Upload Sheet" pattern as the Energy Performance tab's
  // daily-generation import).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadModalOpen(false);
    setImporting(true);
    setImportStatus(null);
    try {
      const parsed = await parseLineItemsSheet(file);
      if (!parsed.ok) {
        setImportStatus(parsed.message);
        return;
      }
      for (const item of parsed.items) {
        // eslint-disable-next-line no-await-in-loop -- sequential upserts keep per-row error attribution simple
        await addItemMutation.mutateAsync({ id: po.id, input: { itemId: null, ...item } });
      }
      await onChanged();
      const imported = parsed.items.length;
      setImportStatus(`${imported} item${imported === 1 ? "" : "s"} imported${parsed.skipped ? `, ${parsed.skipped} skipped` : ""}.`);
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
          projectId: form.projectId ? Number(form.projectId) : null,
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
          currency: form.currency.trim().toUpperCase() || undefined,
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
  // behaviour. Suppressed while a nested popup (PDF preview, sheet upload) is open so it doesn't
  // fight that popup's own Enter/Escape handling — mirrors the Proforma Invoice form's shortcuts.
  // The listener reads the latest state through a ref, so it's attached once per popup state instead
  // of being torn down and re-added on every keystroke.
  const latest = useRef({ handleSave, busy, confirmCancel, isAdmin });
  latest.current = { handleSave, busy, confirmCancel, isAdmin };
  useEffect(() => {
    if (previewOpen || uploadModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirmCancel((open) => !open);
        return;
      }
      const { handleSave: save, busy: isBusy, confirmCancel: confirming, isAdmin: admin } = latest.current;
      if (e.key !== "Enter" || confirming || !admin) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "BUTTON" || target.tagName === "A") return;
      if (target.tagName === "TEXTAREA" && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      if (!isBusy) save();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [previewOpen, uploadModalOpen]);

  const statusHistory = po.statusHistory ?? [];

  const itemsTotal = useMemo(() => rows.reduce((sum, r) => sum + rowTotal(r), 0), [rows]);
  // VAT comes from the Tax % field above (live, even before it's saved); with no Tax % there is no VAT row.
  const taxPct = parseFloat(form.taxPercent);
  const vatPct = Number.isFinite(taxPct) && taxPct > 0 ? taxPct : 0;
  // VAT is charged only on lines whose VAT box is ticked; the others still count toward the total.
  const taxableTotal = useMemo(() => rows.reduce((sum, r) => (r.taxable ? sum + rowTotal(r) : sum), 0), [rows]);
  const vatAmount = vatPct > 0 ? taxableTotal * (vatPct / 100) : 0;
  const grandTotal = itemsTotal + vatAmount;
  const lastRowKey = rows.length ? rows[rows.length - 1]!.key : null;
  const fieldsDisabled = !isAdmin;

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
          Press <Kbd>Tab</Kbd> to switch to the next field · Press <Kbd>Enter</Kbd> to save · Press <Kbd>Esc</Kbd> to go back
        </p>
        {isAdmin && (
          <p className="mt-1">
            <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> to save from a text area
          </p>
        )}
      </div>

      <div className={sectionCardCls}>
        <h3 className="mb-3 text-[13px] font-semibold text-slate-900">Customer Details</h3>
        <div data-arrow-row className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PoFormField
            label="Customer Contact Person"
            name="customerContactPerson"
            value={form.customerContactPerson}
            onField={setField}
            disabled={fieldsDisabled}
            arrowNav
            placeholder="Shown as NAME OF CONTACT PERSON under CUSTOMER on the PDF"
          />
          <PoFormField label="Customer PAN/VAT No." name="customerPanVatNumber" value={form.customerPanVatNumber} onField={setField} disabled={fieldsDisabled} arrowNav />
          <PoFormField
            label="Customer Email"
            name="customerEmail"
            type="email"
            value={form.customerEmail}
            onField={setField}
            disabled={fieldsDisabled}
            arrowNav
            placeholder="Shown as EMAIL ADDRESS under CUSTOMER on the PDF — defaults to the organization's own email"
          />
          <PoFormField
            label="Customer Phone"
            name="customerPhone"
            value={form.customerPhone}
            onField={setField}
            disabled={fieldsDisabled}
            arrowNav
            placeholder="Shown as PHONE under CUSTOMER on the PDF — defaults to the organization's own phone"
          />
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
          <PoFormField label="PO Number" name="poNumber" value={form.poNumber} onField={setField} disabled={fieldsDisabled} arrowNav />
          <PoFormField label="Date" name="poDate" type="date" value={form.poDate} onField={setField} disabled={fieldsDisabled} />
          <div>
            <label className={labelCls}>Project</label>
            <select
              value={form.projectId}
              onChange={(e) => setField("projectId", e.target.value)}
              disabled={fieldsDisabled}
              className={inputCls}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <PoFormField
            label={po.purchaseType === "international" ? "GSTIN No." : "Vendor PAN/VAT No."}
            name="vendorPanVatNumber"
            value={po.vendor?.panVatNumber || "--"}
            onField={setField}
            disabled
          />
          <PoFormField label="Incoterms" name="incoterms" value={form.incoterms} onField={setField} disabled={fieldsDisabled} arrowNav placeholder="e.g. FOB, CIF" />
          <PoFormField label="Tax %" name="taxPercent" type="number" value={form.taxPercent} onField={setField} disabled={fieldsDisabled} />
          <PoFormField
            label="Delivery Period"
            name="deliveryPeriod"
            value={form.deliveryPeriod}
            onField={setField}
            disabled={fieldsDisabled}
            arrowNav
            placeholder="e.g. Within 6 weeks of submission of PO."
          />
          <PoFormField label="Final Destination" name="finalDestination" value={form.finalDestination} onField={setField} disabled={fieldsDisabled} arrowNav />
          <PoFormField
            label="Currency"
            name="currency"
            value={form.currency}
            onField={setField}
            disabled={fieldsDisabled}
            arrowNav
            placeholder="e.g. Indian Rupees — used in the PDF's Amount in Words line"
          />
          <PoFormField label="Payment Terms" name="paymentTerms" value={form.paymentTerms} onField={setField} disabled={fieldsDisabled} multiline rows={5} wrapperClass="sm:col-span-2 lg:col-span-3" />
          <PoFormField label="Notes" name="terms" value={form.terms} onField={setField} disabled={fieldsDisabled} multiline rows={5} wrapperClass="sm:col-span-2 lg:col-span-3" />
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
          <table ref={tableRef} className="w-full text-[12px] border-collapse" style={{ tableLayout: "fixed", minWidth: tableMinWidth }}>
            <colgroup>
              {colIds.map((id) => (
                <col key={id} data-col={id} style={{ width: widthOf(id) }} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide">
                <th className="relative px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">S.N.{resizeHandle("sn")}</th>
                <th className="relative px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">Item{resizeHandle("item")}</th>
                <th className="relative px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">HSN Code <span className="normal-case text-slate-400">(optional)</span>{resizeHandle("hsn")}</th>
                <th className="relative px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">Quantity{resizeHandle("qty")}</th>
                <th className="relative px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">Unit{resizeHandle("unit")}</th>
                {customCols.map((col) => (
                  <th key={col.key} data-col-key={col.key} className="relative p-0 font-medium text-left border-b border-r border-slate-200">
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
                    {resizeHandle(col.key)}
                  </th>
                ))}
                <th className="relative px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">Unit Price{resizeHandle("unitPrice")}</th>
                <th className="relative px-2.5 py-2 font-medium text-center border-b border-r border-slate-200" title="Tick the items that VAT applies to">VAT{resizeHandle("vat")}</th>
                <th className="relative px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">Total Price{resizeHandle("total")}</th>
                <th className="px-2.5 py-2 font-medium text-center border-b border-slate-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <PoLineItemRow
                  key={row.key}
                  row={row}
                  index={rowIdx}
                  customCols={customCols}
                  isAdmin={isAdmin}
                  itemsBusy={itemsBusy}
                  isLast={row.key === lastRowKey}
                  currency={form.currency}
                  onUpdate={updateRow}
                  onUpdateCustom={updateCustomValue}
                  onRemove={removeRow}
                  onAddRow={addRow}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={7 + customCols.length} className="px-2.5 py-2 text-right text-[12px] font-semibold text-slate-700 border-r border-slate-200">Sub Total</td>
                <td className="px-2.5 py-2 text-left text-[12px] font-bold text-slate-900 border-r border-slate-200">{formatPoMoney(itemsTotal, form.currency)}</td>
                <td />
              </tr>
              {vatPct > 0 && (
                <tr className="bg-slate-50">
                  <td colSpan={7 + customCols.length} className="px-2.5 py-2 text-right text-[12px] font-semibold text-slate-700 border-r border-slate-200">
                    Value Added Tax @ {vatPct}%
                    {Math.abs(taxableTotal - itemsTotal) > 0.005 && (
                      <span className="ml-1 font-normal text-slate-500">on {formatPoMoney(taxableTotal, form.currency)} (VAT-applicable items)</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2 text-left text-[12px] font-bold text-slate-900 border-r border-slate-200">{formatPoMoney(vatAmount, form.currency)}</td>
                  <td />
                </tr>
              )}
              <tr className="bg-slate-100 border-t border-slate-300">
                <td colSpan={7 + customCols.length} className="px-2.5 py-2 text-right text-[12px] font-bold text-slate-800 border-r border-slate-200">Grand Total</td>
                <td className="px-2.5 py-2 text-left text-[12px] font-bold text-slate-900 border-r border-slate-200">{formatPoMoney(grandTotal, form.currency)}</td>
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

      <PoSpecTablesEditor tables={specTables} setTables={setSpecTables} isAdmin={isAdmin} />

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
