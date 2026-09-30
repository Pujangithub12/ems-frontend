import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronDown,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  Ban,
  ChevronRight,
  Eye,
  Pencil,
  X,
  Mail,
} from "lucide-react";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { useAuth } from "../../../context/AuthProvider";
import { getErrorMessage } from "../../../lib/errors";
import { formatCost, toNumber } from "../../../lib/currency";
import { openGmailCompose } from "../../../lib/gmail";
import { ProformaInvoice, ProformaInvoiceStatus } from "../../../types";
import { useAllProformaInvoicesQuery, useCreateProformaInvoiceMutation, useCreateStandaloneProformaInvoiceMutation, useUpdateProformaInvoiceMutation } from "../hooks/useProformaInvoice";
import { useOrganizationPurchaseOrdersQuery } from "../hooks/usePurchaseOrder";
import PdfPreviewModal from "../components/PdfPreviewModal";
import type { ProformaInvoiceInput } from "../api/proformaInvoice.api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const pdfUrl = (id: number) => `${API_BASE}/api/proforma-invoices/${id}/pdf`;

const PI_STATUS_STYLES: Record<ProformaInvoiceStatus, { bg: string; fg: string; label: string }> = {
  waiting: { bg: "#fef9c3", fg: "#854d0e", label: "Waiting" },
  approved: { bg: "#dcfce7", fg: "#166534", label: "Approved" },
  rejected: { bg: "#fee2e2", fg: "#991b1b", label: "Rejected" },
};

const Pill: React.FC<{ bg: string; fg: string; label: string }> = ({ bg, fg, label }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: bg, color: fg }}>
    {label}
  </span>
);

const KpiCard: React.FC<{ label: string; value: string; icon: React.ReactNode; iconBg: string }> = ({ label, value, icon, iconBg }) => (
  <div className="p-3 bg-white border rounded-xl shadow-md border-slate-200">
    <div className="flex items-start justify-between">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <div className={`flex items-center justify-center flex-shrink-0 rounded-lg w-7 h-7 ring-1 ring-black/5 ${iconBg}`}>{icon}</div>
    </div>
    <div className="mt-2 text-[19px] font-bold leading-none tracking-tight text-slate-900">{value}</div>
  </div>
);

const inputCls = "w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500";
const labelCls = "block mb-1 text-[11px] font-medium text-slate-900";
const primaryBtnCls = "flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60 transition-colors";
const sectionCardCls = "p-4 bg-white border rounded-xl shadow-md border-slate-200";

/** At the end of a field's text, ArrowRight moves focus to the next field in the same
 * [data-arrow-row] group (ArrowLeft does the same at the start, moving back) — mirrors the
 * Site Activities page's handleRowArrowNav. Only wired onto plain text inputs (no `type`
 * attribute) since `.selectionStart`/`.setSelectionRange` throw on `type="number"`/`"date"`
 * inputs in Chrome. */
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

type PiItemRow = { itemName: string; quantity: string; unit: string; unitPrice: string; hsnCode: string; taxable: boolean };
const emptyPiItemRow: PiItemRow = { itemName: "", quantity: "1", unit: "", unitPrice: "", hsnCode: "", taxable: true };

/**
 * Proforma Invoices — org-wide list across every purchase order, moved out of
 * the Purchase Order detail page's "Proforma Invoice" tab into its own sidebar
 * page (under the Procurement dropdown) so PIs from every PO are visible in
 * one place instead of having to open each PO individually. Creating a new PI
 * here requires picking a target purchase order first (the tab had that PO
 * as implicit context; this page doesn't).
 */
const ProformaInvoicesPage: React.FC = () => {
  const organizationId = useOrganizationId();
  const navigate = useNavigate();
  const { user, organization } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const piQuery = useAllProformaInvoicesQuery();
  const poQuery = useOrganizationPurchaseOrdersQuery();
  const createMutation = useCreateProformaInvoiceMutation();
  const createStandaloneMutation = useCreateStandaloneProformaInvoiceMutation();
  const updateMutation = useUpdateProformaInvoiceMutation();

  const proformaInvoices = piQuery.data ?? [];

  const PI_NUMBER_RE = /^PI-(\d+)$/i;
  /** Next default PI Number, shown pre-filled when opening a fresh (non-edit) form: PI-<n+1>,
   * zero-padded to at least 3 digits, where n is the highest number among existing "PI-###"
   * invoices. Mirrors ProformaInvoiceController.nextPiNumber, which is what's actually used if
   * this is left as-is (or cleared) on submit — this is just what the field shows meanwhile. */
  const nextPiNumberSuggestion = () => {
    let max = 0;
    for (const pi of proformaInvoices) {
      const match = pi.piNumber?.match(PI_NUMBER_RE);
      if (match) max = Math.max(max, parseInt(match[1]!, 10));
    }
    return `PI-${String(max + 1).padStart(3, "0")}`;
  };
  const purchaseOrders = poQuery.data ?? [];

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProformaInvoiceStatus | "">("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [previewPi, setPreviewPi] = useState<ProformaInvoice | null>(null);
  /** Popup shown when the form is submitted with details missing: `blocking` ones must be filled in
   * (Cancel only), `optional` ones can be skipped via "Create anyway" (which submits `input`). */
  const [missingInfo, setMissingInfo] = useState<{ blocking: string[]; optional: string[]; input?: ProformaInvoiceInput } | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([piQuery.refetch(), poQuery.refetch()]);
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return proformaInvoices.filter((pi) => {
      if (statusFilter && pi.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (pi.piNumber || "").toLowerCase().includes(q) ||
        (pi.purchaseOrder?.poNumber || "").toLowerCase().includes(q) ||
        (pi.customerName || "").toLowerCase().includes(q) ||
        (pi.purchaseOrder?.vendor?.name || "").toLowerCase().includes(q) ||
        (pi.purchaseOrder?.project?.name || "").toLowerCase().includes(q)
      );
    });
  }, [proformaInvoices, search, statusFilter]);

  const kpis = useMemo(
    () => ({
      total: proformaInvoices.length,
      waiting: proformaInvoices.filter((p) => p.status === "waiting").length,
      approved: proformaInvoices.filter((p) => p.status === "approved").length,
      rejected: proformaInvoices.filter((p) => p.status === "rejected").length,
    }),
    [proformaInvoices],
  );

  // ---- Add/Edit PI form ----
  const [showForm, setShowForm] = useState(false);
  /** Asked before the form is discarded (Esc, X or Cancel) so typed data isn't lost by accident. */
  const [confirmCancel, setConfirmCancel] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [targetPoId, setTargetPoId] = useState<number | "">("");
  const [piNumber, setPiNumber] = useState("");
  const [piDate, setPiDate] = useState("");
  const [currency, setCurrency] = useState("NPR");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [validityDate, setValidityDate] = useState("");
  const [taxPercent, setTaxPercent] = useState("13");
  const [customerPan, setCustomerPan] = useState("");
  const [vendorPan, setVendorPan] = useState("");
  // The customer being invoiced — the CUSTOMER box on the PDF. The VENDOR box is always us
  // (the organization), so there is nothing to enter for it beyond our PAN.
  const [customerName, setCustomerName] = useState("");
  const [customerContactPerson, setCustomerContactPerson] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  // The VENDOR box is us: prefilled from the organization's own details, editable per invoice.
  const [vendorName, setVendorName] = useState(organization?.name ?? "");
  const [vendorContactPerson, setVendorContactPerson] = useState("");
  const [vendorAddress, setVendorAddress] = useState(organization?.address ?? "");
  const [vendorEmail, setVendorEmail] = useState(organization?.email ?? "");
  const [vendorContact, setVendorContact] = useState(organization?.contact ?? "");
  const [bankBeneficiaryName, setBankBeneficiaryName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankSwiftCode, setBankSwiftCode] = useState("");
  const [bankAddress, setBankAddress] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [placeOfLoading, setPlaceOfLoading] = useState("");
  const [placeOfDischarge, setPlaceOfDischarge] = useState("");
  const [modeOfShipment, setModeOfShipment] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PiItemRow[]>([{ ...emptyPiItemRow }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setTargetPoId("");
    setPiNumber(nextPiNumberSuggestion());
    setPiDate("");
    setCurrency("NPR");
    setExchangeRate("1");
    setPaymentTerms("");
    setValidityDate("");
    setTaxPercent("13");
    setCustomerPan("");
    setVendorPan("");
    setCustomerName("");
    setCustomerContactPerson("");
    setCustomerAddress("");
    setCustomerEmail("");
    setCustomerContact("");
    setVendorName(organization?.name ?? "");
    setVendorContactPerson("");
    setVendorAddress(organization?.address ?? "");
    setVendorEmail(organization?.email ?? "");
    setVendorContact(organization?.contact ?? "");
    setBankBeneficiaryName("");
    setBankAccountNumber("");
    setBankName("");
    setBankSwiftCode("");
    setBankAddress("");
    setDeliveryTerms("");
    setPlaceOfLoading("");
    setPlaceOfDischarge("");
    setModeOfShipment("");
    setNotes("");
    setItems([{ ...emptyPiItemRow }]);
    setFormError(null);
  };

  const updateItemRow = (index: number, patch: Partial<PiItemRow>) =>
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const addItemRow = () => setItems((prev) => [...prev, { ...emptyPiItemRow }]);
  const removeItemRow = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const toDateInputValue = (value?: string | null) => (value ? value.slice(0, 10) : "");

  const startEdit = (pi: ProformaInvoice) => {
    setEditingId(pi.id);
    setTargetPoId(pi.purchaseOrder?.id ?? "");
    setPiNumber(pi.piNumber ?? "");
    setPiDate(toDateInputValue(pi.piDate));
    setCurrency(pi.currency ?? "NPR");
    setExchangeRate(String(toNumber(pi.exchangeRate) ?? 1));
    setPaymentTerms(pi.paymentTerms ?? "");
    setValidityDate(toDateInputValue(pi.validityDate));
    setTaxPercent(pi.taxPercent != null ? String(toNumber(pi.taxPercent)) : "13");
    setCustomerPan(pi.customerPan ?? "");
    setVendorPan(pi.vendorPan ?? "");
    setCustomerName(pi.customerName ?? "");
    setCustomerContactPerson(pi.customerContactPerson ?? "");
    setCustomerAddress(pi.customerAddress ?? "");
    setCustomerEmail(pi.customerEmail ?? "");
    setCustomerContact(pi.customerContact ?? "");
    setVendorName(pi.vendorName || organization?.name || "");
    setVendorContactPerson(pi.vendorContactPerson ?? "");
    setVendorAddress(pi.vendorAddress || organization?.address || "");
    setVendorEmail(pi.vendorEmail || organization?.email || "");
    setVendorContact(pi.vendorContact || organization?.contact || "");
    setBankBeneficiaryName(pi.bankBeneficiaryName ?? "");
    setBankAccountNumber(pi.bankAccountNumber ?? "");
    setBankName(pi.bankName ?? "");
    setBankSwiftCode(pi.bankSwiftCode ?? "");
    setBankAddress(pi.bankAddress ?? "");
    setDeliveryTerms(pi.deliveryTerms ?? "");
    setPlaceOfLoading(pi.placeOfLoading ?? "");
    setPlaceOfDischarge(pi.placeOfDischarge ?? "");
    setModeOfShipment(pi.modeOfShipment ?? "");
    setNotes(pi.notes ?? "");
    setItems(
      pi.items.length > 0
        ? pi.items.map((item) => ({
            itemName: item.itemName,
            quantity: String(item.quantity),
            unit: item.unit ?? "",
            unitPrice: item.unitPrice != null ? String(toNumber(item.unitPrice)) : "",
            hsnCode: item.hsnCode ?? "",
            taxable: item.taxable,
          }))
        : [{ ...emptyPiItemRow }],
    );
    setFormError(null);
    setShowForm(true);
  };

  // Esc = Cancel (after a confirmation), Enter = Save. Enter inside a text area still adds a new
  // line (Ctrl/Cmd+Enter saves from there), and a focused button keeps its own Enter behaviour.
  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (missingInfo) {
        // The "missing details" popup: Esc is its Cancel button.
        if (e.key === "Escape") setMissingInfo(null);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirmCancel((open) => !open);
        return;
      }
      if (e.key !== "Enter" || confirmCancel) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "BUTTON" || target.tagName === "A") return;
      if (target.tagName === "TEXTAREA" && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      if (!submitting) formRef.current?.requestSubmit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showForm, missingInfo, confirmCancel, submitting]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Things the invoice can't be saved without.
    const blocking: string[] = [];
    if (!editingId && !customerName.trim()) blocking.push("Customer name");
    const payloadItems = [];
    let namedItems = 0;
    for (const row of items) {
      if (!row.itemName.trim()) continue;
      namedItems++;
      const quantity = parseFloat(row.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        blocking.push(`A valid quantity for item "${row.itemName.trim()}"`);
        continue;
      }
      payloadItems.push({
        itemName: row.itemName.trim(),
        quantity,
        unit: row.unit.trim() || undefined,
        unitPrice: numOrUndef(row.unitPrice),
        hsnCode: row.hsnCode.trim() || undefined,
        taxable: row.taxable,
      });
    }
    if (namedItems === 0) blocking.push("At least one item");
    if (blocking.length > 0) {
      setMissingInfo({ blocking, optional: [] });
      return;
    }

    // Editing: send null for a cleared field (undefined is dropped from the JSON, leaving the old value in place).
    const blank = editingId ? null : undefined;
    const input: ProformaInvoiceInput = {
      piNumber: piNumber.trim() || blank,
      piDate: piDate || blank,
      currency: currency.trim() || "NPR",
      exchangeRate: numOrUndef(exchangeRate) ?? 1,
      paymentTerms: paymentTerms.trim() || blank,
      validityDate: validityDate || blank,
      taxPercent: numOrUndef(taxPercent) ?? blank,
      customerPan: customerPan.trim() || blank,
      vendorPan: vendorPan.trim() || blank,
      customerName: customerName.trim() || blank,
      customerContactPerson: customerContactPerson.trim() || blank,
      customerAddress: customerAddress.trim() || blank,
      customerEmail: customerEmail.trim() || blank,
      customerContact: customerContact.trim() || blank,
      vendorName: vendorName.trim() || blank,
      vendorContactPerson: vendorContactPerson.trim() || blank,
      vendorAddress: vendorAddress.trim() || blank,
      vendorEmail: vendorEmail.trim() || blank,
      vendorContact: vendorContact.trim() || blank,
      bankBeneficiaryName: bankBeneficiaryName.trim() || blank,
      bankAccountNumber: bankAccountNumber.trim() || blank,
      bankName: bankName.trim() || blank,
      bankSwiftCode: bankSwiftCode.trim() || blank,
      bankAddress: bankAddress.trim() || blank,
      deliveryTerms: deliveryTerms.trim() || blank,
      placeOfLoading: placeOfLoading.trim() || blank,
      placeOfDischarge: placeOfDischarge.trim() || blank,
      modeOfShipment: modeOfShipment.trim() || blank,
      notes: notes.trim() || blank,
      items: payloadItems,
    };

    // Details that would print as "--" on the PDF — worth a heads-up when creating, but not a hard stop.
    if (!editingId) {
      const optional: string[] = [];
      const check = (value: string, label: string) => {
        if (!value.trim()) optional.push(label);
      };
      check(customerContactPerson, "Customer — name of contact person");
      check(customerAddress, "Customer — address");
      check(customerPan, "Customer — PAN no.");
      check(customerEmail, "Customer — email id");
      check(customerContact, "Customer — contact number");
      check(vendorName, "Vendor — company name");
      check(vendorContactPerson, "Vendor — name of contact person");
      check(vendorAddress, "Vendor — address");
      check(vendorPan, "Vendor — PAN no.");
      check(vendorEmail, "Vendor — email id");
      check(vendorContact, "Vendor — contact number");
      if (optional.length > 0) {
        setMissingInfo({ blocking: [], optional, input });
        return;
      }
    }

    void submitPi(input);
  };

  const submitPi = async (input: ProformaInvoiceInput) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input });
      } else if (targetPoId) {
        await createMutation.mutateAsync({ purchaseOrderId: targetPoId as number, input });
      } else {
        await createStandaloneMutation.mutateAsync(input);
      }
      await piQuery.refetch();
      resetForm();
      setShowForm(false);
    } catch (err) {
      setFormError(getErrorMessage(err, editingId ? "Failed to update proforma invoice." : "Failed to create proforma invoice."));
    } finally {
      setSubmitting(false);
    }
  };

  if (piQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading proforma invoices…</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full p-6 bg-white lg:px-8 lg:py-8">
      {piQuery.isError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex items-center justify-center w-12 h-12 mb-1 rounded-full bg-gradient-to-br from-red-50 to-red-100 ring-1 ring-red-100">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-[13px] text-slate-600">{getErrorMessage(piQuery.error, "Failed to load proforma invoices.")}</p>
          <button onClick={refresh} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col w-full min-w-0 gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Total PIs" value={String(kpis.total)} icon={<FileText className="w-4 h-4 text-blue-700" />} iconBg="bg-blue-50" />
            <KpiCard label="Waiting" value={String(kpis.waiting)} icon={<Clock className="w-4 h-4 text-amber-600" />} iconBg="bg-amber-50" />
            <KpiCard label="Approved" value={String(kpis.approved)} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50" />
            <KpiCard label="Rejected" value={String(kpis.rejected)} icon={<Ban className="w-4 h-4 text-red-700" />} iconBg="bg-red-50" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search PI#, PO#, customer, project..."
                  className="pl-8 pr-3 py-2 w-72 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:bg-white transition-colors"
                />
              </div>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ProformaInvoiceStatus | "")}
                  className="appearance-none pl-3 pr-8 py-2 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none cursor-pointer focus:border-blue-400 focus:bg-white transition-colors"
                >
                  <option value="">All statuses</option>
                  {(Object.keys(PI_STATUS_STYLES) as ProformaInvoiceStatus[]).map((s) => (
                    <option key={s} value={s}>{PI_STATUS_STYLES[s].label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-2.5 top-1/2 w-3.5 h-3.5 text-slate-400" />
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
              {isAdmin && (
                <button
                  onClick={() => {
                    resetForm();
                    setShowForm(true);
                  }}
                  className={primaryBtnCls}
                >
                  <Plus size={14} /> New Proforma Invoice
                </button>
              )}
            </div>
          </div>

          {isAdmin && showForm && (
            <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/50">
              <div className="flex flex-col w-full max-w-4xl max-h-full bg-white shadow-2xl rounded-xl">
                <div className="flex items-center justify-between flex-shrink-0 px-5 py-3 border-b border-slate-200">
                  <h3 className="text-[14px] font-semibold text-slate-900">
                    {editingId ? `Edit Proforma Invoice${piNumber ? ` — ${piNumber}` : ""}` : "Add Proforma Invoice"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(true)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                    title="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 min-h-0 p-5 overflow-y-auto">
              <form id="proforma-invoice-form" ref={formRef} onSubmit={handleSubmit} className="space-y-3">
                {formError && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">{formError}</div>}
                <div>
                  <label className={labelCls}>Purchase Order</label>
                  <select
                    value={targetPoId}
                    onChange={(e) => setTargetPoId(e.target.value ? Number(e.target.value) : "")}
                    disabled={!!editingId}
                    className="appearance-none w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none cursor-pointer focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                  >
                    <option value="">No purchase order (standalone PI)</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.poNumber || `PO #${po.id}`} — {po.vendor?.name || "Unknown vendor"} ({po.project?.name || "Unknown project"})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Optional — link this invoice to a purchase order. The VENDOR box on the PDF is always your own organization.
                  </p>
                </div>

                <div data-arrow-row className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>PI Number</label>
                    <input value={piNumber} onChange={(e) => setPiNumber(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Optional" />
                  </div>
                  <div>
                    <label className={labelCls}>PI Date</label>
                    <input type="date" value={piDate} onChange={(e) => setPiDate(e.target.value)} className={inputCls} />
                  </div>
                </div>

                <div className="p-3 space-y-2 border rounded-lg border-slate-200">
                  <p className="text-[11px] font-semibold text-slate-900">Customer</p>
                  <div data-arrow-row className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Customer Name</label>
                      <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Company / customer name" />
                    </div>
                    <div>
                      <label className={labelCls}>Name of Contact Person</label>
                      <input value={customerContactPerson} onChange={(e) => setCustomerContactPerson(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Contact person" />
                    </div>
                    <div>
                      <label className={labelCls}>Customer Address</label>
                      <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Address" />
                    </div>
                    <div>
                      <label className={labelCls}>PAN No.</label>
                      <input value={customerPan} onChange={(e) => setCustomerPan(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Customer PAN" />
                    </div>
                    <div>
                      <label className={labelCls}>Customer Email Id</label>
                      <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Email" />
                    </div>
                    <div>
                      <label className={labelCls}>Customer Contact Number</label>
                      <input value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Contact no." />
                    </div>
                  </div>
                </div>
                <div className="p-3 space-y-2 border rounded-lg border-slate-200">
                  <p className="text-[11px] font-semibold text-slate-900">Vendor (your company)</p>
                  <div data-arrow-row className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Company Name</label>
                      <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Company name" />
                    </div>
                    <div>
                      <label className={labelCls}>Name of Contact Person</label>
                      <input value={vendorContactPerson} onChange={(e) => setVendorContactPerson(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Contact person" />
                    </div>
                    <div>
                      <label className={labelCls}>Address</label>
                      <input value={vendorAddress} onChange={(e) => setVendorAddress(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Address" />
                    </div>
                    <div>
                      <label className={labelCls}>PAN No.</label>
                      <input value={vendorPan} onChange={(e) => setVendorPan(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Vendor PAN" />
                    </div>
                    <div>
                      <label className={labelCls}>Email Id</label>
                      <input type="email" value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Email" />
                    </div>
                    <div>
                      <label className={labelCls}>Contact Number</label>
                      <input value={vendorContact} onChange={(e) => setVendorContact(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Contact no." />
                    </div>
                  </div>
                </div>
                <div data-arrow-row className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className={labelCls}>Currency</label>
                    <input value={currency} onChange={(e) => setCurrency(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Exchange Rate</label>
                    <input type="number" step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Validity Date</label>
                    <input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>VAT %</label>
                    <input type="number" step="0.01" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} className={inputCls} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-medium text-slate-900">Items</label>
                    <button type="button" onClick={addItemRow} className="flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline">
                      <Plus size={11} /> Add item
                    </button>
                  </div>
                  <div className="space-y-2">
                    {items.map((row, i) => (
                      <div key={i} data-arrow-row className="flex items-center gap-2 p-2 border rounded-lg border-slate-200">
                        <input
                          value={row.hsnCode}
                          onChange={(e) => updateItemRow(i, { hsnCode: e.target.value })}
                          onKeyDown={handleRowArrowNav}
                          placeholder="HS Code"
                          className="w-20 px-2 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
                        />
                        <input
                          value={row.itemName}
                          onChange={(e) => updateItemRow(i, { itemName: e.target.value })}
                          onKeyDown={handleRowArrowNav}
                          placeholder="Item name"
                          className="flex-[2] min-w-0 px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
                        />
                        <input
                          value={row.quantity}
                          onChange={(e) => updateItemRow(i, { quantity: e.target.value })}
                          placeholder="Qty"
                          type="number"
                          min="0"
                          step="any"
                          className="w-20 px-2 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
                        />
                        <input
                          value={row.unit}
                          onChange={(e) => updateItemRow(i, { unit: e.target.value })}
                          onKeyDown={handleRowArrowNav}
                          placeholder="Unit"
                          className="w-20 px-2 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
                        />
                        <input
                          value={row.unitPrice}
                          onChange={(e) => updateItemRow(i, { unitPrice: e.target.value })}
                          placeholder="Unit price"
                          type="number"
                          min="0"
                          step="any"
                          className="w-24 px-2 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
                        />
                        <label className="flex items-center gap-1 text-[11px] text-slate-600 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={row.taxable}
                            onChange={(e) => updateItemRow(i, { taxable: e.target.checked })}
                          />
                          Taxable
                        </label>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItemRow(i)} className="p-1.5 text-slate-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div data-arrow-row className="p-3 space-y-2 border rounded-lg border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-900">Bank Details</p>
                    <input value={bankBeneficiaryName} onChange={(e) => setBankBeneficiaryName(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Beneficiary's Name" />
                    <input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="A/C No." />
                    <input value={bankName} onChange={(e) => setBankName(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Bank Name" />
                    <input value={bankSwiftCode} onChange={(e) => setBankSwiftCode(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="SWIFT Code" />
                    <input value={bankAddress} onChange={(e) => setBankAddress(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Bank Address" />
                  </div>
                  <div data-arrow-row className="p-3 space-y-2 border rounded-lg border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-900">Terms of Delivery</p>
                    <input value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Delivery Terms (e.g. DAP Parsa Nepal, Incoterms 2020)" />
                    <input value={placeOfLoading} onChange={(e) => setPlaceOfLoading(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Place of Loading" />
                    <input value={placeOfDischarge} onChange={(e) => setPlaceOfDischarge(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Place of Discharge" />
                    <input value={modeOfShipment} onChange={(e) => setModeOfShipment(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Mode & Duration of Shipment" />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Payment Terms</label>
                  <textarea value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inputCls} rows={4} placeholder="Optional" />
                </div>

                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} rows={4} placeholder="Optional" />
                </div>

              </form>
                </div>
                <div className="flex flex-col flex-shrink-0 gap-2 px-5 py-3 border-t border-slate-100 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[11.5px] text-slate-500 sm:whitespace-nowrap">
                    <p>
                      Press <kbd className="px-1.5 py-0.5 font-sans text-[11px] font-medium bg-white border rounded border-slate-300">Tab</kbd> to switch to the next field · Press <kbd className="px-1.5 py-0.5 font-sans text-[11px] font-medium bg-white border rounded border-slate-300">Enter</kbd> to save · Press <kbd className="px-1.5 py-0.5 font-sans text-[11px] font-medium bg-white border rounded border-slate-300">Esc</kbd> to cancel
                    </p>
                    <p className="mt-1">
                      <kbd className="px-1.5 py-0.5 font-sans text-[11px] font-medium bg-white border rounded border-slate-300">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 font-sans text-[11px] font-medium bg-white border rounded border-slate-300">Enter</kbd> to save from Payment Terms / Notes
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(true)}
                      className="px-4 py-2 text-[12px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button type="submit" form="proforma-invoice-form" disabled={submitting} className={primaryBtnCls}>
                      {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {editingId ? "Save Changes" : "Create Proforma Invoice"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className={`${sectionCardCls} text-center py-16`}>
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
                <FileText className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
                No proforma invoices{search || statusFilter ? " match your filters" : " yet"}
              </h3>
              <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                {search || statusFilter
                  ? "Try adjusting your filters."
                  : "Add one above — link it to a purchase order, or create a standalone PI for a customer."}
              </p>
            </div>
          ) : (
            <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                      <th className="w-8 px-3 py-2" />
                      <th className="px-3 py-2 font-medium text-left">PI Number</th>
                      <th className="px-3 py-2 font-medium text-left">Purchase Order</th>
                      <th className="px-3 py-2 font-medium text-left">Status</th>
                      <th className="px-3 py-2 font-medium text-left">PI Date</th>
                      <th className="px-3 py-2 font-medium text-left">Currency</th>
                      <th className="px-3 py-2 font-medium text-right">Exchange Rate</th>
                      <th className="px-3 py-2 font-medium text-left">Validity</th>
                      <th className="px-3 py-2 font-medium text-left">PDF</th>
                      {isAdmin && <th className="px-3 py-2 font-medium text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((pi: ProformaInvoice) => {
                      const isExpanded = expandedId === pi.id;
                      return (
                        <React.Fragment key={pi.id}>
                          <tr
                            onClick={() => setExpandedId(isExpanded ? null : pi.id)}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                          >
                            <td className="px-3 py-2 text-slate-400">
                              <ChevronRight size={14} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-800">{pi.piNumber || `PI #${pi.id}`}</td>
                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              {pi.purchaseOrder ? (
                                <>
                                  <button
                                    onClick={() => navigate(`/${organizationId}/purchase-orders/${pi.purchaseOrder!.id}`)}
                                    className="text-left text-blue-900 hover:underline"
                                  >
                                    {pi.purchaseOrder.poNumber || `PO #${pi.purchaseOrder.id}`}
                                  </button>
                                  <div className="text-[11px] text-slate-400">
                                    {pi.customerName || "No customer"} · {pi.purchaseOrder.project?.name || "Unknown project"}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className="text-slate-500 italic">Standalone</span>
                                  <div className="text-[11px] text-slate-400">
                                    {pi.customerName || "No customer"}
                                  </div>
                                </>
                              )}
                            </td>
                            <td className="px-3 py-2"><Pill {...PI_STATUS_STYLES[pi.status]} /></td>
                            <td className="px-3 py-2 text-slate-600">{formatDate(pi.piDate)}</td>
                            <td className="px-3 py-2 text-slate-600">{pi.currency}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{toNumber(pi.exchangeRate)}</td>
                            <td className="px-3 py-2 text-slate-600">{formatDate(pi.validityDate)}</td>
                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-col items-start gap-1">
                                <button
                                  onClick={() => setPreviewPi(pi)}
                                  className="flex items-center gap-1 text-[11px] font-medium text-blue-900 hover:underline"
                                >
                                  <Eye size={11} /> Preview PDF
                                </button>
                                <button
                                  onClick={() =>
                                    openGmailCompose(
                                      pi.customerEmail || "",
                                      `Proforma Invoice ${pi.piNumber || `PI-${pi.id}`}`,
                                      `Dear ${pi.customerContactPerson || pi.customerName || "Sir/Madam"},\n\nPlease find attached Proforma Invoice ${pi.piNumber || `PI-${pi.id}`} for your reference.\n\nKindly review and confirm receipt at your earliest convenience.\n\nBest regards,`,
                                    )
                                  }
                                  className="flex items-center gap-1 text-[11px] font-medium text-blue-900 hover:underline"
                                >
                                  <Mail size={11} /> Send Email
                                </button>
                              </div>
                            </td>
                            {isAdmin && (
                              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => startEdit(pi)}
                                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-900 border rounded-lg border-slate-200 hover:bg-slate-50"
                                  >
                                    <Pencil size={12} /> Edit
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                          {isExpanded && (
                            <tr className="border-b border-slate-100 last:border-0 bg-slate-50/60">
                              <td />
                              <td colSpan={isAdmin ? 8 : 7} className="px-3 py-3">
                                {pi.paymentTerms && (
                                  <p className="mb-2 text-[12px] text-slate-600">
                                    <span className="text-slate-400">Payment Terms:</span> {pi.paymentTerms}
                                  </p>
                                )}
                                <div className="overflow-hidden bg-white border rounded-lg border-slate-200">
                                  <table className="w-full text-[12px]">
                                    <thead>
                                      <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                                        <th className="px-3 py-2 font-medium text-left">HS Code</th>
                                        <th className="px-3 py-2 font-medium text-left">Item</th>
                                        <th className="px-3 py-2 font-medium text-right">Quantity</th>
                                        <th className="px-3 py-2 font-medium text-left">Unit</th>
                                        <th className="px-3 py-2 font-medium text-right">Unit Price</th>
                                        <th className="px-3 py-2 font-medium text-left">Taxable</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {pi.items.map((item) => (
                                        <tr key={item.id} className="border-b border-slate-100 last:border-0">
                                          <td className="px-3 py-2 text-slate-600">{item.hsnCode || "--"}</td>
                                          <td className="px-3 py-2 text-slate-700">{item.itemName}</td>
                                          <td className="px-3 py-2 text-right text-slate-600">{item.quantity}</td>
                                          <td className="px-3 py-2 text-slate-600">{item.unit || "--"}</td>
                                          <td className="px-3 py-2 text-right text-slate-600">{formatCost(item.unitPrice)}</td>
                                          <td className="px-3 py-2 text-slate-600">{item.taxable ? "Yes" : "No"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
              <h3 className="text-[14px] font-semibold text-slate-900">Cancel this proforma invoice?</h3>
              <p className="mt-1 text-[12px] text-slate-500">Anything you've entered in the form will be discarded.</p>
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
                  resetForm();
                  setShowForm(false);
                }}
                className="px-4 py-2 text-[12px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {missingInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-md bg-white shadow-xl rounded-xl">
            <div className="flex items-start gap-3 px-5 pt-5">
              <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-amber-600 rounded-full bg-amber-50">
                <AlertCircle size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-slate-900">
                  {missingInfo.blocking.length > 0 ? "Required details are missing" : "Some details are missing"}
                </h3>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  {missingInfo.blocking.length > 0
                    ? "Please fill these in before creating the proforma invoice:"
                    : "These will show as “--” on the PDF:"}
                </p>
              </div>
            </div>
            <ul className="px-5 py-3 ml-5 space-y-1 text-[12.5px] list-disc list-inside text-slate-700 max-h-64 overflow-y-auto">
              {(missingInfo.blocking.length > 0 ? missingInfo.blocking : missingInfo.optional).map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button
                onClick={() => setMissingInfo(null)}
                className="px-4 py-2 text-[12px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              {missingInfo.blocking.length === 0 && missingInfo.input && (
                <button
                  onClick={() => {
                    const input = missingInfo.input!;
                    setMissingInfo(null);
                    void submitPi(input);
                  }}
                  className={primaryBtnCls}
                >
                  Create anyway
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {previewPi && (
        <PdfPreviewModal
          url={pdfUrl(previewPi.id)}
          fileName={`${(previewPi.piNumber || `PI-${previewPi.id}`).replace(/\//g, "-")}.pdf`}
          onClose={() => setPreviewPi(null)}
        />
      )}
    </div>
  );
};

export default ProformaInvoicesPage;
