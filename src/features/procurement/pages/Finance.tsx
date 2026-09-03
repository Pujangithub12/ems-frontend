import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, Search, RefreshCw, Loader2, AlertCircle, X, CreditCard, History, Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { FinancePurchaseOrderRow } from "../../../types";
import { useFinanceOverviewQuery, useAddFinanceRowPaymentMutation, useDeleteFinanceManualRecordMutation, useExchangeRatesQuery } from "../hooks/useFinance";
import PaymentHistoryModal from "../components/PaymentHistoryModal";
import ManualRecordModal from "../components/ManualRecordModal";
import { formatCost } from "../../../lib/currency";
import { getErrorMessage } from "../../../lib/errors";

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "--";

const rowKey = (r: FinancePurchaseOrderRow) => `${r.source}-${r.source === "po" ? r.poId : r.manualRecordId}`;

/** Currencies the "Display in" toggle can convert the whole table into — "native" (the default)
 * shows each row in its own currency, unconverted, exactly like before. */
const DISPLAY_CURRENCIES = ["native", "NPR", "USD", "INR", "RMB"] as const;
type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/** Converts one row's Item Value/Amount Paid/Outstanding Balance into `target`, using today's
 * live NRB rate for both the row's currency and the target — this is what answers "how much
 * {target} do I need today to settle this row," which is the whole point of the toggle: a
 * vendor debt fixed in USD costs a different amount of NPR every day, so seeing it converted at
 * *today's* rate (not some average or the rate from when the PO was made) is what prevents
 * over/under-paying. Returns null when the toggle is "native" or the rate isn't available yet
 * (rates still loading, or an unsupported currency) — callers fall back to the row's own
 * currency in that case. */
function convertRowForDisplay(
  row: FinancePurchaseOrderRow,
  target: DisplayCurrency,
  liveRates: Record<string, number> | undefined,
): { itemValue: number; amountPaid: number; outstandingBalance: number; currency: string } | null {
  if (target === "native" || target === row.currency) return null;
  const rowRate = row.currency === "NPR" ? 1 : liveRates?.[row.currency];
  const targetRate = target === "NPR" ? 1 : liveRates?.[target];
  if (!rowRate || !targetRate) return null;
  const factor = rowRate / targetRate;
  return {
    itemValue: row.itemValue * factor,
    amountPaid: row.amountPaid * factor,
    outstandingBalance: row.outstandingBalance * factor,
    currency: target,
  };
}

type PaymentForm = { amount: string; paidDate: string; exchangeRate: string; reference: string; notes: string };
const emptyPaymentForm: PaymentForm = { amount: "", paidDate: new Date().toISOString().slice(0, 10), exchangeRate: "", reference: "", notes: "" };

/**
 * Finance ledger (procurement pipeline's money layer, on top of the existing Cost Sheet) — one
 * row per Purchase Order across the whole organization, plus any freeform rows added by hand
 * (ManualRecordModal): what it's worth, what's been paid against it, and what's still
 * outstanding. Reachable from the Procurement sidebar dropdown, same admin/super_admin/finance
 * access as the rest of that group.
 */
const FinancePage: React.FC = () => {
  const navigate = useNavigate();
  const organizationId = useOrganizationId();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || user?.role === "finance";

  const overviewQuery = useFinanceOverviewQuery();
  const rows = overviewQuery.data ?? [];
  const deleteManualMutation = useDeleteFinanceManualRecordMutation();
  const ratesQuery = useExchangeRatesQuery();

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("native");
  const [paymentTarget, setPaymentTarget] = useState<FinancePurchaseOrderRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<FinancePurchaseOrderRow | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editingManualRow, setEditingManualRow] = useState<FinancePurchaseOrderRow | null>(null);
  const [deletingManualId, setDeletingManualId] = useState<number | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    await overviewQuery.refetch();
    setRefreshing(false);
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.poNumber || "").toLowerCase().includes(q) ||
        (r.vendorName || r.vendor?.name || "").toLowerCase().includes(q) ||
        r.itemNames.some((n) => n.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const openAddRecord = () => {
    setEditingManualRow(null);
    setManualModalOpen(true);
  };

  const openEditRecord = (row: FinancePurchaseOrderRow) => {
    setEditingManualRow(row);
    setManualModalOpen(true);
  };

  const handleDeleteManual = async (row: FinancePurchaseOrderRow) => {
    if (row.manualRecordId == null) return;
    if (!window.confirm("Delete this record? This can't be undone.")) return;
    setDeletingManualId(row.manualRecordId);
    try {
      await deleteManualMutation.mutateAsync(row.manualRecordId);
    } finally {
      setDeletingManualId(null);
    }
  };

  if (overviewQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading finance ledger…</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full p-6 bg-white lg:px-8 lg:py-8">
      {overviewQuery.isError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex items-center justify-center w-12 h-12 mb-1 rounded-full bg-gradient-to-br from-red-50 to-red-100 ring-1 ring-red-100">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-[13px] text-slate-600">{getErrorMessage(overviewQuery.error, "Failed to load the finance ledger.")}</p>
          <button onClick={refresh} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col w-full min-w-0 gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search PO#, vendor, item..."
                  className="pl-8 pr-3 py-2 w-64 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:bg-white transition-colors"
                />
              </div>
              <div className="relative">
                <select
                  value={displayCurrency}
                  onChange={(e) => setDisplayCurrency(e.target.value as DisplayCurrency)}
                  className="appearance-none pl-3 pr-8 py-2 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none cursor-pointer focus:border-blue-400 focus:bg-white transition-colors"
                  title="Convert every row's amounts to one currency using today's exchange rate"
                >
                  <option value="native">Display in: each row's own currency</option>
                  <option value="NPR">Display in: NPR</option>
                  <option value="USD">Display in: USD</option>
                  <option value="INR">Display in: INR</option>
                  <option value="RMB">Display in: RMB</option>
                </select>
                <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-2.5 top-1/2 w-3.5 h-3.5 text-slate-400" />
              </div>
              {displayCurrency !== "native" && (
                <span className="text-[11px] text-slate-400">
                  {ratesQuery.data ? "converted at today's NRB rate" : "loading today's rate…"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={openAddRecord}
                  className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800"
                >
                  <Plus size={14} /> Add New Record
                </button>
              )}
              <button
                onClick={refresh}
                className="flex items-center justify-center w-8 h-8 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
                title="Refresh"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
            {filteredRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
                  <Wallet className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
                  No purchase orders{search ? " match your search" : " yet"}
                </h3>
                <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                  {search ? "Try adjusting your search." : "Create a purchase order, or add a record manually, to start tracking finances."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-blue-900 text-white text-[11px] font-semibold uppercase tracking-wide">
                      <th className="px-3 py-2 font-semibold text-left">Vendor</th>
                      <th className="px-3 py-2 font-semibold text-left">Item Procure</th>
                      <th className="px-3 py-2 font-semibold text-right">Item Value</th>
                      <th className="px-3 py-2 font-semibold text-left">Terms of Payment</th>
                      <th className="px-3 py-2 font-semibold text-right">Amount Paid</th>
                      <th className="px-3 py-2 font-semibold text-left">Paid Date</th>
                      <th className="px-3 py-2 font-semibold text-right">Outstanding Balance</th>
                      {isAdmin && <th className="px-3 py-2 font-semibold text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => {
                      const converted = convertRowForDisplay(r, displayCurrency, ratesQuery.data);
                      const display = converted ?? { itemValue: r.itemValue, amountPaid: r.amountPaid, outstandingBalance: r.outstandingBalance, currency: r.currency };
                      return (
                      <tr
                        key={rowKey(r)}
                        onClick={() => navigate(`/${organizationId}/finance/records/${r.source}/${r.source === "po" ? r.poId : r.manualRecordId}`)}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="px-3 py-2" onClick={(e) => r.vendor && e.stopPropagation()}>
                          {r.vendor ? (
                            <button
                              onClick={() => navigate(`/${organizationId}/finance/vendors/${r.vendor!.id}`)}
                              className="font-medium text-blue-900 hover:underline"
                            >
                              {r.vendor.name}
                            </button>
                          ) : (
                            <span className="text-slate-600">{r.vendorName || "--"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2" onClick={(e) => r.source === "po" && e.stopPropagation()}>
                          {r.source === "po" ? (
                            <button
                              onClick={() => navigate(`/${organizationId}/purchase-orders/${r.poId}`)}
                              className="font-medium text-blue-900 hover:underline"
                              title={r.poNumber || `#${r.poId}`}
                            >
                              {r.itemNames[0] || r.poNumber || `#${r.poId}`}
                              {r.itemNames.length > 1 ? ` +${r.itemNames.length - 1} more` : ""}
                            </button>
                          ) : (
                            <span className="text-slate-700" title={r.poNumber || undefined}>
                              {r.itemNames[0] || "--"}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {formatCost(display.itemValue, display.currency)}
                          {display.currency && display.currency !== "NPR" && <span className="ml-1 text-[10px] text-slate-400">{display.currency}</span>}
                          {converted && <div className="text-[10px] text-slate-400">{formatCost(r.itemValue, r.currency)} native</div>}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{r.paymentTerms || "--"}</td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {formatCost(display.amountPaid, display.currency)}
                          {converted && <div className="text-[10px] text-slate-400">{formatCost(r.amountPaid, r.currency)} native</div>}
                        </td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setHistoryTarget(r)}
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-900 hover:underline disabled:no-underline disabled:text-slate-400"
                            disabled={r.payments.length === 0}
                            title={r.payments.length === 0 ? "No payments logged yet" : "View payment history"}
                          >
                            {formatDate(r.paidDate)}
                            {r.payments.length > 0 && <History size={11} />}
                          </button>
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${display.outstandingBalance > 0 ? "text-red-700" : "text-emerald-700"}`}>
                          {formatCost(display.outstandingBalance, display.currency)}
                          {converted && <div className="text-[10px] font-normal text-slate-400">{formatCost(r.outstandingBalance, r.currency)} native</div>}
                        </td>
                        {isAdmin && (
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setPaymentTarget(r)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800"
                              >
                                <CreditCard size={12} /> Log Payment
                              </button>
                              {r.source === "manual" && (
                                <>
                                  <button
                                    onClick={() => openEditRecord(r)}
                                    className="flex items-center justify-center w-7 h-7 text-slate-500 transition-colors border rounded border-slate-200 hover:bg-slate-100"
                                    title="Edit record"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteManual(r)}
                                    disabled={deletingManualId === r.manualRecordId}
                                    className="flex items-center justify-center w-7 h-7 text-red-600 transition-colors border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                                    title="Delete record"
                                  >
                                    {deletingManualId === r.manualRecordId ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {paymentTarget && (
        <LogPaymentModal row={paymentTarget} onClose={() => setPaymentTarget(null)} onLogged={() => { setPaymentTarget(null); overviewQuery.refetch(); }} />
      )}

      {historyTarget && (
        <PaymentHistoryModal
          row={rows.find((r) => rowKey(r) === rowKey(historyTarget)) ?? historyTarget}
          canDelete={isAdmin}
          onClose={() => setHistoryTarget(null)}
          onChanged={() => overviewQuery.refetch()}
        />
      )}

      {manualModalOpen && (
        <ManualRecordModal
          editingRow={editingManualRow}
          onClose={() => setManualModalOpen(false)}
          onSaved={() => setManualModalOpen(false)}
        />
      )}
    </div>
  );
};

const LogPaymentModal: React.FC<{ row: FinancePurchaseOrderRow; onClose: () => void; onLogged: () => void }> = ({
  row,
  onClose,
  onLogged,
}) => {
  const addPaymentMutation = useAddFinanceRowPaymentMutation();
  const ratesQuery = useExchangeRatesQuery();
  const [form, setForm] = useState<PaymentForm>(emptyPaymentForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rowId = row.source === "po" ? row.poId : row.manualRecordId;
  const needsRate = row.currency && row.currency !== "NPR";

  // Prefill the exchange rate from today's live rate once it loads, so the field isn't blank —
  // but only if the user hasn't already typed something in (e.g. the bank's actual rate).
  useEffect(() => {
    if (!needsRate || form.exchangeRate) return;
    const liveRate = ratesQuery.data?.[row.currency];
    if (liveRate) setForm((f) => (f.exchangeRate ? f : { ...f, exchangeRate: String(liveRate) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratesQuery.data, needsRate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Enter a valid amount.");
      return;
    }
    if (!form.paidDate) {
      setFormError("Select a paid date.");
      return;
    }
    let exchangeRate: number | null = null;
    if (needsRate) {
      exchangeRate = parseFloat(form.exchangeRate);
      if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
        setFormError(`Enter a valid ${row.currency} → NPR exchange rate.`);
        return;
      }
    }
    if (rowId == null) {
      setFormError("This record can't be found.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await addPaymentMutation.mutateAsync({
        source: row.source,
        id: rowId,
        input: {
          amount,
          paidDate: form.paidDate,
          exchangeRate,
          reference: form.reference.trim() || null,
          notes: form.notes.trim() || null,
        },
      });
      onLogged();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to log payment."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h3 className="text-[14px] font-semibold text-slate-900">Log Payment</h3>
            <p className="text-[11px] text-slate-500">{row.poNumber || `#${rowId}`} · {row.vendorName || row.vendor?.name || "Unknown vendor"}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {formError && (
            <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">{formError}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Amount{row.currency && row.currency !== "NPR" ? ` (${row.currency})` : ""}</label>
              <input
                autoFocus
                type="number"
                min="0.01"
                step="any"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Paid Date</label>
              <input
                type="date"
                value={form.paidDate}
                onChange={(e) => setForm({ ...form, paidDate: e.target.value })}
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              />
            </div>
          </div>
          {needsRate && (
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Exchange Rate ({row.currency} → NPR)</label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={form.exchangeRate}
                onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })}
                placeholder={ratesQuery.data?.[row.currency] ? String(ratesQuery.data[row.currency]) : "e.g. 133.20"}
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Prefilled from today's NRB selling rate — edit it to match the rate your bank actually used.
                {parseFloat(form.amount) > 0 && parseFloat(form.exchangeRate) > 0 && (
                  <span className="block mt-0.5 font-medium text-slate-700">
                    = {formatCost(parseFloat(form.amount) * parseFloat(form.exchangeRate), "NPR")}
                  </span>
                )}
              </p>
            </div>
          )}
          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-900">Reference</label>
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="e.g. bank transfer ref / cheque no. (optional)"
              className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-900">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional"
              className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none resize-none focus:border-blue-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Log Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FinancePage;
