import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FileSignature,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  ChevronRight,
  Eye,
  Pencil,
  X,
  Mail,
  ReceiptText,
} from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { getErrorMessage } from "../../../lib/errors";
import { formatCost, toNumber } from "../../../lib/currency";
import { openGmailCompose } from "../../../lib/gmail";
import { currentNepaliFiscalYearLabel } from "../../../lib/bsDate";
import { Quotation } from "../../../types";
import { useAllQuotationsQuery, useCreateQuotationMutation, useUpdateQuotationMutation, useDeleteQuotationMutation } from "../hooks/useQuotation";
import PdfPreviewModal from "../components/PdfPreviewModal";
import ConfirmationModal from "../../../components/ConfirmationModal";
import type { QuotationInput } from "../api/quotation.api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const pdfUrl = (id: number) => `${API_BASE}/api/quotations/${id}/pdf`;

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
 * same handler on the Proforma Invoices / Purchase Order pages. Only wired onto plain text
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

/** Sum of quantity*rate across every item — the pre-VAT subtotal, used for the list's Total column
 * (mirrors quotationPdf.ts's subtotal, computed the same way there). */
const quoteSubtotal = (q: Quotation) => q.items.reduce((sum, item) => sum + item.quantity * (toNumber(item.rate) ?? 0), 0);
const quoteTotal = (q: Quotation) => {
  const subtotal = quoteSubtotal(q);
  const taxPercent = toNumber(q.taxPercent) ?? 13;
  return subtotal + subtotal * (taxPercent / 100);
};

type QuoteItemRow = { itemName: string; description: string; quantity: string; unit: string; rate: string };
const emptyQuoteItemRow: QuoteItemRow = { itemName: "", description: "", quantity: "1", unit: "", rate: "" };

const DEFAULT_DELIVERY_PERIOD = "7 days from Receipt of Advance";
const DEFAULT_PAYMENT_TERMS = "100% advance shall be provided prior to dispatch of goods.";
const DEFAULT_VALIDITY_PERIOD = "15 Days";

/**
 * Quotations — a standalone price quotation sent to a prospective customer, right below Proforma
 * Invoices in the sidebar. Modeled after the company's reference paper quotation (see
 * quotationPdf.ts): a From (this app's own organization)/To (customer) box, an items table, and
 * a Terms and Conditions block (Price Basis/Delivery Period/Payment Terms/Validity).
 */
const QuotationsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const quoteQuery = useAllQuotationsQuery();
  const createMutation = useCreateQuotationMutation();
  const updateMutation = useUpdateQuotationMutation();
  const deleteMutation = useDeleteQuotationMutation();

  const quotations = quoteQuery.data ?? [];
  // Newest first (as returned by the backend) — used to carry over recurring company info
  // (Reg No./PAN/signatory/terms) from the last quotation into a fresh one, so it isn't retyped
  // every time.
  const latestQuotation = quotations[0] ?? null;

  // "007-83/84" — matches the reference paper quotation's numbering scheme.
  const QUOTE_NUMBER_RE = /^(\d+)-(\d{2}\/\d{2})$/;
  /** Next default Quotation Number, shown pre-filled when opening a fresh (non-edit) form:
   * <n+1>-<current Nepali fiscal year>, 3-digit zero-padded — n only counts quotations already
   * numbered for that same fiscal year, so it restarts at 001 each new one. Mirrors
   * QuotationController.nextQuotationNumber, which is what's actually used if this is left as-is
   * (or cleared) on submit. */
  const nextQuoteNumberSuggestion = () => {
    const fiscalYear = currentNepaliFiscalYearLabel();
    let max = 0;
    for (const q of quotations) {
      const match = q.quotationNumber?.match(QUOTE_NUMBER_RE);
      if (match && match[2] === fiscalYear) max = Math.max(max, parseInt(match[1]!, 10));
    }
    return `${String(max + 1).padStart(3, "0")}-${fiscalYear}`;
  };

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [previewQuote, setPreviewQuote] = useState<Quotation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Quotation | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /** Popup shown when the form is submitted with details missing: `blocking` ones must be filled in
   * (Cancel only), `optional` ones can be skipped via "Create anyway" (which submits `input`). */
  const [missingInfo, setMissingInfo] = useState<{ blocking: string[]; optional: string[]; input?: QuotationInput } | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    await quoteQuery.refetch();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotations;
    return quotations.filter(
      (quote) =>
        (quote.quotationNumber || "").toLowerCase().includes(q) ||
        (quote.customerName || "").toLowerCase().includes(q) ||
        (quote.title || "").toLowerCase().includes(q),
    );
  }, [quotations, search]);

  const kpis = useMemo(() => {
    const now = Date.now();
    const thisMonth = quotations.filter((q) => {
      const d = q.quotationDate ? new Date(q.quotationDate) : null;
      return d && d.getMonth() === new Date(now).getMonth() && d.getFullYear() === new Date(now).getFullYear();
    });
    return {
      total: quotations.length,
      thisMonth: thisMonth.length,
      totalValue: quotations.reduce((sum, q) => sum + quoteTotal(q), 0),
    };
  }, [quotations]);

  // ---- Add/Edit Quotation form ----
  const [showForm, setShowForm] = useState(false);
  /** Asked before the form is discarded (Esc, X or Cancel) so typed data isn't lost by accident. */
  const [confirmCancel, setConfirmCancel] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [quotationNumber, setQuotationNumber] = useState("");
  const [quotationDate, setQuotationDate] = useState("");
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState("NPR");
  const [taxPercent, setTaxPercent] = useState("13");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPan, setCustomerPan] = useState("");
  const [fromPan, setFromPan] = useState("");
  const [regNo, setRegNo] = useState("");
  const [priceBasis, setPriceBasis] = useState("");
  const [deliveryPeriod, setDeliveryPeriod] = useState(DEFAULT_DELIVERY_PERIOD);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_PAYMENT_TERMS);
  const [validityPeriod, setValidityPeriod] = useState(DEFAULT_VALIDITY_PERIOD);
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryDesignation, setSignatoryDesignation] = useState("");
  const [items, setItems] = useState<QuoteItemRow[]>([{ ...emptyQuoteItemRow }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toDateInputValue = (value?: string | null) => (value ? value.slice(0, 10) : "");

  const resetForm = () => {
    setEditingId(null);
    setQuotationNumber(nextQuoteNumberSuggestion());
    setQuotationDate(toDateInputValue(new Date().toISOString()));
    setTitle("");
    setCurrency("NPR");
    setTaxPercent("13");
    setCustomerName("");
    setCustomerAddress("");
    setCustomerContact("");
    setCustomerEmail("");
    setCustomerPan("");
    setFromPan(latestQuotation?.fromPan ?? "");
    setRegNo(latestQuotation?.regNo ?? "");
    setPriceBasis(latestQuotation?.priceBasis ?? "");
    setDeliveryPeriod(latestQuotation?.deliveryPeriod ?? DEFAULT_DELIVERY_PERIOD);
    setDeliveryAddress(latestQuotation?.deliveryAddress ?? "");
    setPaymentTerms(latestQuotation?.paymentTerms ?? DEFAULT_PAYMENT_TERMS);
    setValidityPeriod(latestQuotation?.validityPeriod ?? DEFAULT_VALIDITY_PERIOD);
    setSignatoryName(latestQuotation?.signatoryName ?? "");
    setSignatoryDesignation(latestQuotation?.signatoryDesignation ?? "");
    setItems([{ ...emptyQuoteItemRow }]);
    setFormError(null);
  };

  const updateItemRow = (index: number, patch: Partial<QuoteItemRow>) =>
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const addItemRow = () => setItems((prev) => [...prev, { ...emptyQuoteItemRow }]);
  const removeItemRow = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const startEdit = (q: Quotation) => {
    setEditingId(q.id);
    setQuotationNumber(q.quotationNumber ?? "");
    setQuotationDate(toDateInputValue(q.quotationDate));
    setTitle(q.title ?? "");
    setCurrency(q.currency ?? "NPR");
    setTaxPercent(q.taxPercent != null ? String(toNumber(q.taxPercent)) : "13");
    setCustomerName(q.customerName ?? "");
    setCustomerAddress(q.customerAddress ?? "");
    setCustomerContact(q.customerContact ?? "");
    setCustomerEmail(q.customerEmail ?? "");
    setCustomerPan(q.customerPan ?? "");
    setFromPan(q.fromPan ?? "");
    setRegNo(q.regNo ?? "");
    setPriceBasis(q.priceBasis ?? "");
    setDeliveryPeriod(q.deliveryPeriod ?? "");
    setDeliveryAddress(q.deliveryAddress ?? "");
    setPaymentTerms(q.paymentTerms ?? "");
    setValidityPeriod(q.validityPeriod ?? "");
    setSignatoryName(q.signatoryName ?? "");
    setSignatoryDesignation(q.signatoryDesignation ?? "");
    setItems(
      q.items.length > 0
        ? q.items.map((item) => ({
            itemName: item.itemName,
            description: item.description ?? "",
            quantity: String(item.quantity),
            unit: item.unit ?? "",
            rate: item.rate != null ? String(toNumber(item.rate)) : "",
          }))
        : [{ ...emptyQuoteItemRow }],
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

    const blocking: string[] = [];
    if (!customerName.trim()) blocking.push("Customer name");
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
        description: row.description.trim() || undefined,
        quantity,
        unit: row.unit.trim() || undefined,
        rate: numOrUndef(row.rate),
      });
    }
    if (namedItems === 0) blocking.push("At least one item");
    if (blocking.length > 0) {
      setMissingInfo({ blocking, optional: [] });
      return;
    }

    // Editing: send null for a cleared field (undefined is dropped from the JSON, leaving the old value in place).
    const blank = editingId ? null : undefined;
    const input: QuotationInput = {
      quotationNumber: quotationNumber.trim() || blank,
      quotationDate: quotationDate || blank,
      title: title.trim() || blank,
      currency: currency.trim() || "NPR",
      taxPercent: numOrUndef(taxPercent) ?? blank,
      customerName: customerName.trim() || blank,
      customerAddress: customerAddress.trim() || blank,
      customerContact: customerContact.trim() || blank,
      customerEmail: customerEmail.trim() || blank,
      customerPan: customerPan.trim() || blank,
      fromPan: fromPan.trim() || blank,
      regNo: regNo.trim() || blank,
      priceBasis: priceBasis.trim() || blank,
      deliveryPeriod: deliveryPeriod.trim() || blank,
      deliveryAddress: deliveryAddress.trim() || blank,
      paymentTerms: paymentTerms.trim() || blank,
      validityPeriod: validityPeriod.trim() || blank,
      signatoryName: signatoryName.trim() || blank,
      signatoryDesignation: signatoryDesignation.trim() || blank,
      items: payloadItems,
    };

    // Details that would print as "--" on the PDF — worth a heads-up when creating, but not a hard stop.
    if (!editingId) {
      const optional: string[] = [];
      const check = (value: string, label: string) => {
        if (!value.trim()) optional.push(label);
      };
      check(customerAddress, "Customer — address");
      check(customerContact, "Customer — contact number");
      check(customerEmail, "Customer — email id");
      check(customerPan, "Customer — PAN no.");
      check(fromPan, "From — PAN no.");
      check(regNo, "From — Reg No.");
      check(signatoryName, "Signatory name");
      check(signatoryDesignation, "Signatory designation");
      if (optional.length > 0) {
        setMissingInfo({ blocking: [], optional, input });
        return;
      }
    }

    void submitQuote(input);
  };

  const submitQuote = async (input: QuotationInput) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input });
      } else {
        await createMutation.mutateAsync(input);
      }
      await quoteQuery.refetch();
      resetForm();
      setShowForm(false);
    } catch (err) {
      setFormError(getErrorMessage(err, editingId ? "Failed to update quotation." : "Failed to create quotation."));
    } finally {
      setSubmitting(false);
    }
  };

  if (quoteQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading quotations…</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full p-6 bg-white lg:px-8 lg:py-8">
      {quoteQuery.isError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex items-center justify-center w-12 h-12 mb-1 rounded-full bg-gradient-to-br from-red-50 to-red-100 ring-1 ring-red-100">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-[13px] text-slate-600">{getErrorMessage(quoteQuery.error, "Failed to load quotations.")}</p>
          <button onClick={refresh} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col w-full min-w-0 gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KpiCard label="Total Quotations" value={String(kpis.total)} icon={<FileSignature className="w-4 h-4 text-blue-700" />} iconBg="bg-blue-50" />
            <KpiCard label="This Month" value={String(kpis.thisMonth)} icon={<ReceiptText className="w-4 h-4 text-amber-600" />} iconBg="bg-amber-50" />
            <KpiCard label="Total Quoted Value" value={formatCost(kpis.totalValue)} icon={<FileSignature className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Q. No, customer, title..."
                className="pl-8 pr-3 py-2 w-72 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:bg-white transition-colors"
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
                  onClick={() => {
                    resetForm();
                    setShowForm(true);
                  }}
                  className={primaryBtnCls}
                >
                  <Plus size={14} /> New Quotation
                </button>
              )}
            </div>
          </div>

          {isAdmin && showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
              <div className="flex flex-col w-full max-w-4xl max-h-full bg-white shadow-2xl rounded-xl">
                <div className="flex items-center justify-between flex-shrink-0 px-5 py-3 border-b border-slate-200">
                  <h3 className="text-[14px] font-semibold text-slate-900">
                    {editingId ? `Edit Quotation${quotationNumber ? ` — ${quotationNumber}` : ""}` : "Add Quotation"}
                  </h3>
                  <button type="button" onClick={() => setConfirmCancel(true)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" title="Close">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 min-h-0 p-5 overflow-y-auto">
                  <form id="quotation-form" ref={formRef} onSubmit={handleSubmit} className="space-y-3">
                    {formError && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">{formError}</div>}

                    <div data-arrow-row className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Quotation Number</label>
                        <input value={quotationNumber} onChange={(e) => setQuotationNumber(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Optional" />
                      </div>
                      <div>
                        <label className={labelCls}>Quotation Date</label>
                        <input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} className={inputCls} />
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Title / Subject</label>
                      <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="e.g. Quotation for Biomass Pellet ( Ex-Factory Price)" />
                    </div>

                    <div className="p-3 space-y-2 border rounded-lg border-slate-200">
                      <p className="text-[11px] font-semibold text-slate-900">Customer (To)</p>
                      <div data-arrow-row className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Customer Name</label>
                          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Company / customer name" />
                        </div>
                        <div>
                          <label className={labelCls}>Address</label>
                          <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Address" />
                        </div>
                        <div>
                          <label className={labelCls}>Contact Number</label>
                          <input value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Contact no." />
                        </div>
                        <div>
                          <label className={labelCls}>Email Id</label>
                          <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Email" />
                        </div>
                        <div>
                          <label className={labelCls}>Customer PAN No.</label>
                          <input value={customerPan} onChange={(e) => setCustomerPan(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Customer PAN" />
                        </div>
                      </div>
                    </div>

                    <div className="p-3 space-y-2 border rounded-lg border-slate-200">
                      <p className="text-[11px] font-semibold text-slate-900">From (your company)</p>
                      <p className="text-[11px] text-slate-400">Name, address, phone and email come from your organization settings. PAN and Reg No. are set per quotation.</p>
                      <div data-arrow-row className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>PAN No.</label>
                          <input value={fromPan} onChange={(e) => setFromPan(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Your PAN" />
                        </div>
                        <div>
                          <label className={labelCls}>Reg No.</label>
                          <input value={regNo} onChange={(e) => setRegNo(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="e.g. 230625/076/077" />
                        </div>
                      </div>
                    </div>

                    <div data-arrow-row className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div>
                        <label className={labelCls}>Currency</label>
                        <input value={currency} onChange={(e) => setCurrency(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} />
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
                          <div key={i} data-arrow-row className="p-2 space-y-2 border rounded-lg border-slate-200">
                            <div className="flex items-center gap-2">
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
                                value={row.rate}
                                onChange={(e) => updateItemRow(i, { rate: e.target.value })}
                                placeholder="Rate"
                                type="number"
                                min="0"
                                step="any"
                                className="w-24 px-2 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
                              />
                              {items.length > 1 && (
                                <button type="button" onClick={() => removeItemRow(i)} className="p-1.5 text-slate-400 hover:text-red-600">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                            <input
                              value={row.description}
                              onChange={(e) => updateItemRow(i, { description: e.target.value })}
                              onKeyDown={handleRowArrowNav}
                              placeholder="Spec / description shown under the item name on the PDF (optional)"
                              className="w-full px-3 py-2 text-[12.5px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div data-arrow-row className="p-3 space-y-2 border rounded-lg border-slate-200">
                      <p className="text-[11px] font-semibold text-slate-900">Terms and Conditions</p>
                      <div>
                        <label className={labelCls}>Price Basis</label>
                        <input value={priceBasis} onChange={(e) => setPriceBasis(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Optional" />
                      </div>
                      <div>
                        <label className={labelCls}>Delivery Period</label>
                        <input value={deliveryPeriod} onChange={(e) => setDeliveryPeriod(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Delivery Address</label>
                        <input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Optional" />
                      </div>
                      <div>
                        <label className={labelCls}>Payment Terms</label>
                        <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Validity of Quotation</label>
                        <input value={validityPeriod} onChange={(e) => setValidityPeriod(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} />
                      </div>
                    </div>

                    <div data-arrow-row className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Signatory Name</label>
                        <input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="e.g. Mr. Kadam Mani Nepal" />
                      </div>
                      <div>
                        <label className={labelCls}>Signatory Designation</label>
                        <input value={signatoryDesignation} onChange={(e) => setSignatoryDesignation(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="e.g. Chief Technical Officer" />
                      </div>
                    </div>
                  </form>
                </div>
                <div className="flex flex-col flex-shrink-0 gap-2 px-5 py-3 border-t border-slate-100 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[11.5px] text-slate-500 sm:whitespace-nowrap">
                    <p>
                      Press <kbd className="px-1.5 py-0.5 font-sans text-[11px] font-medium bg-white border rounded border-slate-300">Tab</kbd> to switch to the next field · Press{" "}
                      <kbd className="px-1.5 py-0.5 font-sans text-[11px] font-medium bg-white border rounded border-slate-300">Enter</kbd> to save · Press{" "}
                      <kbd className="px-1.5 py-0.5 font-sans text-[11px] font-medium bg-white border rounded border-slate-300">Esc</kbd> to cancel
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
                    <button type="submit" form="quotation-form" disabled={submitting} className={primaryBtnCls}>
                      {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {editingId ? "Save Changes" : "Create Quotation"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {deleteError && (
            <div className="flex items-center justify-between px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">
              <span>{deleteError}</span>
              <button onClick={() => setDeleteError(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className={`${sectionCardCls} text-center py-16`}>
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
                <FileSignature className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="font-semibold text-[14px] text-slate-900 mb-1">No quotations{search ? " match your search" : " yet"}</h3>
              <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                {search ? "Try a different search." : "Add one above to create a price quotation for a prospective customer."}
              </p>
            </div>
          ) : (
            <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                      <th className="w-8 px-3 py-2" />
                      <th className="px-3 py-2 font-medium text-left">Q. No.</th>
                      <th className="px-3 py-2 font-medium text-left">Customer</th>
                      <th className="px-3 py-2 font-medium text-left">Date</th>
                      <th className="px-3 py-2 font-medium text-left">Currency</th>
                      <th className="px-3 py-2 font-medium text-right">Total</th>
                      <th className="px-3 py-2 font-medium text-left">PDF</th>
                      {isAdmin && <th className="px-3 py-2 font-medium text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((q: Quotation) => {
                      const isExpanded = expandedId === q.id;
                      return (
                        <React.Fragment key={q.id}>
                          <tr onClick={() => setExpandedId(isExpanded ? null : q.id)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer">
                            <td className="px-3 py-2 text-slate-400">
                              <ChevronRight size={14} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-800">{q.quotationNumber || `QT #${q.id}`}</td>
                            <td className="px-3 py-2">
                              <div className="text-slate-800">{q.customerName || "No customer"}</div>
                              {q.title && <div className="text-[11px] text-slate-400">{q.title}</div>}
                            </td>
                            <td className="px-3 py-2 text-slate-600">{formatDate(q.quotationDate)}</td>
                            <td className="px-3 py-2 text-slate-600">{q.currency || "NPR"}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{formatCost(quoteTotal(q))}</td>
                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-col items-start gap-1">
                                <button onClick={() => setPreviewQuote(q)} className="flex items-center gap-1 text-[11px] font-medium text-blue-900 hover:underline">
                                  <Eye size={11} /> Preview PDF
                                </button>
                                <button
                                  onClick={() =>
                                    openGmailCompose(
                                      q.customerEmail || "",
                                      `Price Quotation ${q.quotationNumber || `QT-${q.id}`}`,
                                      `Dear Sir/Madam,\n\nPlease find attached our price quotation ${q.quotationNumber || `QT-${q.id}`} for your reference.\n\nKindly review and let us know if you have any questions.\n\nBest regards,`,
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
                                  <button onClick={() => startEdit(q)} className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-900 border rounded-lg border-slate-200 hover:bg-slate-50">
                                    <Pencil size={12} /> Edit
                                  </button>
                                  <button
                                    onClick={() => setConfirmDelete(q)}
                                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-600 border rounded-lg border-slate-200 hover:bg-red-50"
                                  >
                                    <Trash2 size={12} /> Delete
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                          {isExpanded && (
                            <tr className="border-b border-slate-100 last:border-0 bg-slate-50/60">
                              <td />
                              <td colSpan={isAdmin ? 7 : 6} className="px-3 py-3">
                                <div className="overflow-hidden bg-white border rounded-lg border-slate-200">
                                  <table className="w-full text-[12px]">
                                    <thead>
                                      <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                                        <th className="px-3 py-2 font-medium text-left">Item</th>
                                        <th className="px-3 py-2 font-medium text-right">Quantity</th>
                                        <th className="px-3 py-2 font-medium text-left">Unit</th>
                                        <th className="px-3 py-2 font-medium text-right">Rate</th>
                                        <th className="px-3 py-2 font-medium text-right">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {q.items.map((item) => (
                                        <tr key={item.id} className="border-b border-slate-100 last:border-0">
                                          <td className="px-3 py-2 text-slate-700">
                                            {item.itemName}
                                            {item.description && <div className="text-[11px] italic text-slate-400 whitespace-pre-line">{item.description}</div>}
                                          </td>
                                          <td className="px-3 py-2 text-right text-slate-600">{item.quantity}</td>
                                          <td className="px-3 py-2 text-slate-600">{item.unit || "--"}</td>
                                          <td className="px-3 py-2 text-right text-slate-600">{formatCost(item.rate)}</td>
                                          <td className="px-3 py-2 text-right text-slate-600">{formatCost(item.quantity * (toNumber(item.rate) ?? 0))}</td>
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
              <h3 className="text-[14px] font-semibold text-slate-900">Cancel this quotation?</h3>
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
                <h3 className="text-[14px] font-semibold text-slate-900">{missingInfo.blocking.length > 0 ? "Required details are missing" : "Some details are missing"}</h3>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  {missingInfo.blocking.length > 0 ? "Please fill these in before creating the quotation:" : "These will show as “--” on the PDF:"}
                </p>
              </div>
            </div>
            <ul className="px-5 py-3 ml-5 space-y-1 text-[12.5px] list-disc list-inside text-slate-700 max-h-64 overflow-y-auto">
              {(missingInfo.blocking.length > 0 ? missingInfo.blocking : missingInfo.optional).map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <button onClick={() => setMissingInfo(null)} className="px-4 py-2 text-[12px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50">
                Cancel
              </button>
              {missingInfo.blocking.length === 0 && missingInfo.input && (
                <button
                  onClick={() => {
                    const input = missingInfo.input!;
                    setMissingInfo(null);
                    void submitQuote(input);
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

      {previewQuote && (
        <PdfPreviewModal
          url={pdfUrl(previewQuote.id)}
          fileName={`${(previewQuote.quotationNumber || `QT-${previewQuote.id}`).replace(/\//g, "-")}.pdf`}
          onClose={() => setPreviewQuote(null)}
        />
      )}

      <ConfirmationModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await deleteMutation.mutateAsync(confirmDelete.id);
            await quoteQuery.refetch();
          } catch (err) {
            setDeleteError(getErrorMessage(err, "Failed to delete quotation."));
          }
          setConfirmDelete(null);
        }}
        title="Delete Quotation"
        message={`Delete quotation ${confirmDelete?.quotationNumber || `#${confirmDelete?.id}`} for ${confirmDelete?.customerName || "this customer"}? This can't be undone.`}
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default QuotationsPage;
