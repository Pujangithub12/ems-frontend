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
} from "lucide-react";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { useAuth } from "../../../context/AuthProvider";
import { getErrorMessage } from "../../../lib/errors";
import { formatCost, toNumber } from "../../../lib/currency";
import { ProformaInvoice, ProformaInvoiceStatus } from "../../../types";
import { useAllProformaInvoicesQuery, useCreateProformaInvoiceMutation, useChangeProformaInvoiceStatusMutation, useUploadProformaInvoiceFileMutation } from "../hooks/useProformaInvoice";
import { useOrganizationPurchaseOrdersQuery } from "../hooks/usePurchaseOrder";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const fileUrl = (filePath: string) => `${API_BASE}/uploads/${filePath}`;

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

const numOrUndef = (s: string): number | undefined => {
  if (s.trim() === "") return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "--";

type PiItemRow = { itemName: string; quantity: string; unit: string; unitPrice: string };
const emptyPiItemRow: PiItemRow = { itemName: "", quantity: "1", unit: "", unitPrice: "" };

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
  const createMutation = useCreateProformaInvoiceMutation();
  const changeStatusMutation = useChangeProformaInvoiceStatusMutation();
  const uploadFileMutation = useUploadProformaInvoiceFileMutation();

  const proformaInvoices = piQuery.data ?? [];
  const purchaseOrders = poQuery.data ?? [];

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

  // ---- Add PI form ----
  const [showForm, setShowForm] = useState(false);
  const [targetPoId, setTargetPoId] = useState<number | "">("");
  const [piNumber, setPiNumber] = useState("");
  const [piDate, setPiDate] = useState("");
  const [currency, setCurrency] = useState("NPR");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [validityDate, setValidityDate] = useState("");
  const [items, setItems] = useState<PiItemRow[]>([{ ...emptyPiItemRow }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setTargetPoId("");
    setPiNumber("");
    setPiDate("");
    setCurrency("NPR");
    setExchangeRate("1");
    setPaymentTerms("");
    setValidityDate("");
    setItems([{ ...emptyPiItemRow }]);
    setFormError(null);
  };

  const updateItemRow = (index: number, patch: Partial<PiItemRow>) =>
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const addItemRow = () => setItems((prev) => [...prev, { ...emptyPiItemRow }]);
  const removeItemRow = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPoId) {
      setFormError("Select a purchase order.");
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
      });
    }
    if (payloadItems.length === 0) {
      setFormError("Add at least one item.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        purchaseOrderId: targetPoId,
        input: {
          piNumber: piNumber.trim() || undefined,
          piDate: piDate || undefined,
          currency: currency.trim() || "NPR",
          exchangeRate: numOrUndef(exchangeRate) ?? 1,
          paymentTerms: paymentTerms.trim() || undefined,
          validityDate: validityDate || undefined,
          items: payloadItems,
        },
      });
      await piQuery.refetch();
      resetForm();
      setShowForm(false);
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to create proforma invoice."));
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
                <button onClick={() => setShowForm((s) => !s)} className={primaryBtnCls}>
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
              <h3 className="text-[13px] font-semibold text-slate-900 mb-3">Add Proforma Invoice</h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                {formError && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">{formError}</div>}
                <div>
                  <label className={labelCls}>Purchase Order</label>
                  <select
                    value={targetPoId}
                    onChange={(e) => setTargetPoId(e.target.value ? Number(e.target.value) : "")}
                    className="appearance-none w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none cursor-pointer focus:border-blue-400"
                  >
                    <option value="">Select a purchase order…</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.poNumber || `PO #${po.id}`} — {po.vendor?.name || "Unknown vendor"} ({po.project?.name || "Unknown project"})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className={labelCls}>PI Number</label>
                    <input value={piNumber} onChange={(e) => setPiNumber(e.target.value)} className={inputCls} placeholder="Optional" />
                  </div>
                  <div>
                    <label className={labelCls}>PI Date</label>
                    <input type="date" value={piDate} onChange={(e) => setPiDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Currency</label>
                    <input value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Exchange Rate</label>
                    <input type="number" step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Payment Terms</label>
                    <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inputCls} placeholder="Optional" />
                  </div>
                  <div>
                    <label className={labelCls}>Validity Date</label>
                    <input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} className={inputCls} />
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
                      <div key={i} className="flex items-center gap-2 p-2 border rounded-lg border-slate-200">
                        <input
                          value={row.itemName}
                          onChange={(e) => updateItemRow(i, { itemName: e.target.value })}
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
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItemRow(i)} className="p-1.5 text-slate-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="submit" disabled={submitting} className={primaryBtnCls}>
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Create Proforma Invoice
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
                  : "Add one above once a purchase order has been generated for a vendor."}
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
                              <button
                                onClick={() => pi.purchaseOrder?.id && navigate(`/${organizationId}/purchase-orders/${pi.purchaseOrder.id}`)}
                                className="text-left text-blue-900 hover:underline"
                              >
                                {pi.purchaseOrder?.poNumber || `PO #${pi.purchaseOrder?.id ?? "--"}`}
                              </button>
                              <div className="text-[11px] text-slate-400">
                                {pi.purchaseOrder?.vendor?.name || "Unknown vendor"} · {pi.purchaseOrder?.project?.name || "Unknown project"}
                              </div>
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
                            {isAdmin && (
                              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1.5">
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
                                        <th className="px-3 py-2 font-medium text-left">Item</th>
                                        <th className="px-3 py-2 font-medium text-right">Quantity</th>
                                        <th className="px-3 py-2 font-medium text-left">Unit</th>
                                        <th className="px-3 py-2 font-medium text-right">Unit Price</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {pi.items.map((item) => (
                                        <tr key={item.id} className="border-b border-slate-100 last:border-0">
                                          <td className="px-3 py-2 text-slate-700">{item.itemName}</td>
                                          <td className="px-3 py-2 text-right text-slate-600">{item.quantity}</td>
                                          <td className="px-3 py-2 text-slate-600">{item.unit || "--"}</td>
                                          <td className="px-3 py-2 text-right text-slate-600">{formatCost(item.unitPrice)}</td>
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
