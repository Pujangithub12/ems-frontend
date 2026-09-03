import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronDown,
  Plus,
  Check,
  XCircle,
  Upload,
  Paperclip,
  Trash2,
  X,
  Clock,
  CheckCircle2,
  Ban,
  ChevronRight,
  Download,
  Pencil,
} from "lucide-react";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { useAuth } from "../../../context/AuthProvider";
import { getErrorMessage } from "../../../lib/errors";
import { formatCost, toNumber } from "../../../lib/currency";
import { ProformaInvoice, ProformaInvoiceStatus } from "../../../types";
import { useAllProformaInvoicesQuery, useCreateProformaInvoiceMutation, useCreateStandaloneProformaInvoiceMutation, useUpdateProformaInvoiceMutation, useChangeProformaInvoiceStatusMutation, useUploadProformaInvoiceFileMutation } from "../hooks/useProformaInvoice";
import { useOrganizationPurchaseOrdersQuery } from "../hooks/usePurchaseOrder";
import { useOrganizationVendorsQuery } from "../../inventory/hooks/useInventory";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const fileUrl = (filePath: string) => `${API_BASE}/uploads/${filePath}`;
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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const piQuery = useAllProformaInvoicesQuery();
  const poQuery = useOrganizationPurchaseOrdersQuery();
  const vendorsQuery = useOrganizationVendorsQuery();
  const createMutation = useCreateProformaInvoiceMutation();
  const createStandaloneMutation = useCreateStandaloneProformaInvoiceMutation();
  const updateMutation = useUpdateProformaInvoiceMutation();
  const changeStatusMutation = useChangeProformaInvoiceStatusMutation();
  const uploadFileMutation = useUploadProformaInvoiceFileMutation();

  const proformaInvoices = piQuery.data ?? [];
  const purchaseOrders = poQuery.data ?? [];
  const vendors = vendorsQuery.data ?? [];

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProformaInvoiceStatus | "">("");
  const [rowBusyId, setRowBusyId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([piQuery.refetch(), poQuery.refetch()]);
    setRefreshing(false);
  };

  const runRowAction = async (fn: () => Promise<unknown>) => {
    setRowError(null);
    try {
      await fn();
      await piQuery.refetch();
    } catch (err) {
      setRowError(getErrorMessage(err, "Action failed."));
    } finally {
      setRowBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return proformaInvoices.filter((pi) => {
      if (statusFilter && pi.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (pi.piNumber || "").toLowerCase().includes(q) ||
        (pi.purchaseOrder?.poNumber || "").toLowerCase().includes(q) ||
        (pi.purchaseOrder?.vendor?.name || pi.vendor?.name || pi.vendorName || "").toLowerCase().includes(q) ||
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
  // Only used for a standalone (no purchase order) PI — the PO-backed path pulls vendor info
  // from the purchase order itself.
  const [vendorId, setVendorId] = useState<number | "">("");
  const [vendorName, setVendorName] = useState("");
  const [vendorContactPerson, setVendorContactPerson] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [vendorContact, setVendorContact] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
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
    setPiNumber("");
    setPiDate("");
    setCurrency("NPR");
    setExchangeRate("1");
    setPaymentTerms("");
    setValidityDate("");
    setTaxPercent("13");
    setCustomerPan("");
    setVendorPan("");
    setVendorId("");
    setVendorName("");
    setVendorContactPerson("");
    setVendorAddress("");
    setVendorContact("");
    setVendorEmail("");
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
    setVendorId(pi.vendorId ?? "");
    setVendorName(pi.vendorName ?? "");
    setVendorContactPerson(pi.vendorContactPerson ?? "");
    setVendorAddress(pi.vendorAddress ?? "");
    setVendorContact(pi.vendorContact ?? "");
    setVendorEmail(pi.vendorEmail ?? "");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId && !targetPoId && !vendorId && !vendorName.trim()) {
      setFormError("Select a purchase order, or select/enter a vendor for a standalone PI.");
      return;
    }
    const payloadItems = [];
    for (const row of items) {
      if (!row.itemName.trim()) continue;
      const quantity = parseFloat(row.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setFormError("Every item needs a valid quantity.");
        return;
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
    if (payloadItems.length === 0) {
      setFormError("Add at least one item.");
      return;
    }
    const input = {
      piNumber: piNumber.trim() || undefined,
      piDate: piDate || undefined,
      currency: currency.trim() || "NPR",
      exchangeRate: numOrUndef(exchangeRate) ?? 1,
      paymentTerms: paymentTerms.trim() || undefined,
      validityDate: validityDate || undefined,
      taxPercent: numOrUndef(taxPercent),
      customerPan: customerPan.trim() || undefined,
      vendorPan: vendorPan.trim() || undefined,
      ...(!targetPoId
        ? {
            vendorId: vendorId || null,
            vendorName: vendorName.trim() || undefined,
            vendorContactPerson: vendorContactPerson.trim() || undefined,
            vendorAddress: vendorAddress.trim() || undefined,
            vendorContact: vendorContact.trim() || undefined,
            vendorEmail: vendorEmail.trim() || undefined,
          }
        : {}),
      bankBeneficiaryName: bankBeneficiaryName.trim() || undefined,
      bankAccountNumber: bankAccountNumber.trim() || undefined,
      bankName: bankName.trim() || undefined,
      bankSwiftCode: bankSwiftCode.trim() || undefined,
      bankAddress: bankAddress.trim() || undefined,
      deliveryTerms: deliveryTerms.trim() || undefined,
      placeOfLoading: placeOfLoading.trim() || undefined,
      placeOfDischarge: placeOfDischarge.trim() || undefined,
      modeOfShipment: modeOfShipment.trim() || undefined,
      notes: notes.trim() || undefined,
      items: payloadItems,
    };

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
                  placeholder="Search PI#, PO#, vendor, project..."
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
                    if (showForm) {
                      resetForm();
                      setShowForm(false);
                    } else {
                      setShowForm(true);
                    }
                  }}
                  className={primaryBtnCls}
                >
                  <Plus size={14} /> {showForm ? "Cancel" : "New Proforma Invoice"}
                </button>
              )}
            </div>
          </div>

          {rowError && (
            <div className="flex items-center justify-between px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">
              <span>{rowError}</span>
              <button onClick={() => setRowError(null)}><X size={14} /></button>
            </div>
          )}

          {isAdmin && showForm && (
            <div className={sectionCardCls}>
              <h3 className="text-[13px] font-semibold text-slate-900 mb-3">
                {editingId ? `Edit Proforma Invoice${piNumber ? ` — ${piNumber}` : ""}` : "Add Proforma Invoice"}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
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
                    {targetPoId
                      ? "Vendor details for the VENDOR box come from the selected purchase order."
                      : "No purchase order selected — pick or enter a vendor below for the VENDOR box."}
                  </p>
                </div>

                {!targetPoId && (
                  <div className="p-3 space-y-2 border rounded-lg border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-900">Vendor (standalone PI)</p>
                    <select
                      value={vendorId}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : "";
                        setVendorId(id);
                        const v = vendors.find((x) => x.id === id);
                        if (v) {
                          setVendorName(v.name ?? "");
                          setVendorContactPerson(v.contactPerson ?? "");
                          setVendorAddress(v.address ?? v.location ?? "");
                          setVendorContact(v.contact ?? "");
                          setVendorEmail(v.email ?? "");
                        }
                      }}
                      className="appearance-none w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none cursor-pointer focus:border-blue-400"
                    >
                      <option value="">Enter vendor details freeform (no existing vendor)…</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                    <div data-arrow-row className="grid grid-cols-2 gap-2">
                      <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Vendor / company name" />
                      <input value={vendorContactPerson} onChange={(e) => setVendorContactPerson(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Contact person" />
                      <input value={vendorAddress} onChange={(e) => setVendorAddress(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Address" />
                      <input value={vendorContact} onChange={(e) => setVendorContact(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Contact no." />
                      <input value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Email" />
                    </div>
                  </div>
                )}
                <div data-arrow-row className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className={labelCls}>PI Number</label>
                    <input value={piNumber} onChange={(e) => setPiNumber(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Optional" />
                  </div>
                  <div>
                    <label className={labelCls}>PI Date</label>
                    <input type="date" value={piDate} onChange={(e) => setPiDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Currency</label>
                    <input value={currency} onChange={(e) => setCurrency(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Exchange Rate</label>
                    <input type="number" step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Payment Terms</label>
                    <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Optional" />
                  </div>
                  <div>
                    <label className={labelCls}>Validity Date</label>
                    <input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>VAT %</label>
                    <input type="number" step="0.01" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Customer PAN No.</label>
                    <input value={customerPan} onChange={(e) => setCustomerPan(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Optional" />
                  </div>
                  <div>
                    <label className={labelCls}>Vendor PAN No.</label>
                    <input value={vendorPan} onChange={(e) => setVendorPan(e.target.value)} onKeyDown={handleRowArrowNav} className={inputCls} placeholder="Optional" />
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
                          min="1"
                          className="w-16 px-2 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
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
                  <label className={labelCls}>Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} rows={2} placeholder="Optional" />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setShowForm(false);
                      }}
                      className="px-4 py-2 text-[12px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" disabled={submitting} className={primaryBtnCls}>
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editingId ? "Save Changes" : "Create Proforma Invoice"}
                  </button>
                </div>
              </form>
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
                  : "Add one above — link it to a purchase order, or create a standalone PI for a vendor."}
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
                      <th className="px-3 py-2 font-medium text-left">File</th>
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
                                    {pi.purchaseOrder.vendor?.name || "Unknown vendor"} · {pi.purchaseOrder.project?.name || "Unknown project"}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className="text-slate-500 italic">Standalone</span>
                                  <div className="text-[11px] text-slate-400">
                                    {pi.vendor?.name || pi.vendorName || "No vendor"}
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
                              {pi.filePath ? (
                                <a href={fileUrl(pi.filePath)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] font-medium text-blue-900 hover:underline">
                                  <Paperclip size={11} /> {pi.fileName || "View file"}
                                </a>
                              ) : isAdmin ? (
                                <label className="flex items-center gap-1 text-[11px] font-medium text-blue-700 cursor-pointer hover:underline">
                                  <Upload size={11} /> Upload PDF
                                  <input
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      e.target.value = "";
                                      if (!file) return;
                                      setRowBusyId(pi.id);
                                      await runRowAction(() => uploadFileMutation.mutateAsync({ id: pi.id, file }));
                                    }}
                                  />
                                </label>
                              ) : (
                                <span className="text-slate-300">--</span>
                              )}
                            </td>
                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              <a
                                href={pdfUrl(pi.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[11px] font-medium text-blue-900 hover:underline"
                              >
                                <Download size={11} /> Download PDF
                              </a>
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
                                  {pi.status === "waiting" && (
                                    <>
                                      <button
                                        disabled={rowBusyId === pi.id}
                                        onClick={() => {
                                          setRowBusyId(pi.id);
                                          runRowAction(() => changeStatusMutation.mutateAsync({ id: pi.id, status: "approved" }));
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                                      >
                                        <Check size={12} /> Approve
                                      </button>
                                      <button
                                        disabled={rowBusyId === pi.id}
                                        onClick={() => {
                                          setRowBusyId(pi.id);
                                          runRowAction(() => changeStatusMutation.mutateAsync({ id: pi.id, status: "rejected" }));
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-60"
                                      >
                                        <XCircle size={12} /> Reject
                                      </button>
                                    </>
                                  )}
                                  {rowBusyId === pi.id && <Loader2 className="w-3.5 h-3.5 text-blue-900 animate-spin" />}
                                </div>
                              </td>
                            )}
                          </tr>
                          {isExpanded && (
                            <tr className="border-b border-slate-100 last:border-0 bg-slate-50/60">
                              <td />
                              <td colSpan={isAdmin ? 9 : 8} className="px-3 py-3">
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
    </div>
  );
};

export default ProformaInvoicesPage;
