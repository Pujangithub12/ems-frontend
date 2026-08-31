import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Loader2, AlertCircle, CreditCard, X, History } from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { FinancePurchaseOrderRow } from "../../../types";
import { useVendorFinanceSummaryQuery, useAddFinanceRowPaymentMutation } from "../hooks/useFinance";
import PaymentHistoryModal from "../components/PaymentHistoryModal";
import { formatCost } from "../../../lib/currency";
import { getErrorMessage } from "../../../lib/errors";

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "--";

const rowKey = (r: FinancePurchaseOrderRow) => `${r.source}-${r.source === "po" ? r.poId : r.manualRecordId}`;

const SummaryCard: React.FC<{ label: string; value: string; tone?: "default" | "danger" }> = ({ label, value, tone = "default" }) => (
  <div className="p-3 bg-white border rounded-xl shadow-md border-slate-200">
    <span className="text-[11px] font-medium text-slate-500">{label}</span>
    <div className={`mt-2 text-[19px] font-bold leading-none tracking-tight ${tone === "danger" ? "text-red-700" : "text-slate-900"}`}>
      {value}
    </div>
  </div>
);

/** One vendor's finance drilldown — reached by clicking a vendor name on the main Finance page. */
const VendorFinancePage: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const organizationId = useOrganizationId();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || user?.role === "finance";

  const summaryQuery = useVendorFinanceSummaryQuery(vendorId ? Number(vendorId) : null);
  const [paymentTarget, setPaymentTarget] = useState<FinancePurchaseOrderRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<FinancePurchaseOrderRow | null>(null);

  if (summaryQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading vendor finances…</p>
      </div>
    );
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center bg-white">
        <AlertCircle className="w-6 h-6 text-red-600" />
        <p className="text-[13px] text-slate-600">{getErrorMessage(summaryQuery.error, "Vendor not found.")}</p>
        <button
          onClick={() => navigate(`/${organizationId}/finance`)}
          className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          Back to Finance
        </button>
      </div>
    );
  }

  const { vendor, totals, rows } = summaryQuery.data;

  return (
    <div className="w-full min-h-full p-6 bg-white lg:px-8 lg:py-8">
      <div className="flex flex-col w-full min-w-0 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/${organizationId}/finance`)}
            className="flex items-center justify-center w-8 h-8 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
            title="Back to Finance"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-[13px] font-semibold text-blue-900 rounded-full bg-blue-50">
            <Building2 size={16} />
          </div>
          <h2 className="text-[17px] font-semibold text-slate-900">{vendor.name}</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard label="Total Procurement" value={formatCost(totals.totalProcurement)} />
          <SummaryCard label="Total Amount Paid" value={formatCost(totals.totalAmountPaid)} />
          <SummaryCard
            label="Total Outstanding Balance"
            value={formatCost(totals.totalOutstandingBalance)}
            tone={totals.totalOutstandingBalance > 0 ? "danger" : "default"}
          />
        </div>

        <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-slate-500 text-[12px]">No purchase orders for this vendor yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                    <th className="px-3 py-2 font-medium text-left">Item Procure</th>
                    <th className="px-3 py-2 font-medium text-right">Item Value</th>
                    <th className="px-3 py-2 font-medium text-left">Terms of Payment</th>
                    <th className="px-3 py-2 font-medium text-right">Amount Paid</th>
                    <th className="px-3 py-2 font-medium text-left">Paid Date</th>
                    <th className="px-3 py-2 font-medium text-right">Outstanding Balance</th>
                    {isAdmin && <th className="px-3 py-2 font-medium text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={rowKey(r)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-3 py-2">
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
                      <td className="px-3 py-2 text-right text-slate-700">{formatCost(r.itemValue)}</td>
                      <td className="px-3 py-2 text-slate-600">{r.paymentTerms || "--"}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatCost(r.amountPaid)}</td>
                      <td className="px-3 py-2">
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
                      <td className={`px-3 py-2 text-right font-medium ${r.outstandingBalance > 0 ? "text-red-700" : "text-emerald-700"}`}>
                        {formatCost(r.outstandingBalance)}
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => setPaymentTarget(r)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800"
                          >
                            <CreditCard size={12} /> Log Payment
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {paymentTarget && (
        <LogPaymentModal
          row={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onLogged={() => {
            setPaymentTarget(null);
            summaryQuery.refetch();
          }}
        />
      )}

      {historyTarget && (
        <PaymentHistoryModal
          row={rows.find((r) => rowKey(r) === rowKey(historyTarget)) ?? historyTarget}
          canDelete={isAdmin}
          onClose={() => setHistoryTarget(null)}
          onChanged={() => summaryQuery.refetch()}
        />
      )}
    </div>
  );
};

type PaymentForm = { amount: string; paidDate: string; reference: string; notes: string };
const emptyPaymentForm: PaymentForm = { amount: "", paidDate: new Date().toISOString().slice(0, 10), reference: "", notes: "" };

const LogPaymentModal: React.FC<{ row: FinancePurchaseOrderRow; onClose: () => void; onLogged: () => void }> = ({
  row,
  onClose,
  onLogged,
}) => {
  const addPaymentMutation = useAddFinanceRowPaymentMutation();
  const [form, setForm] = useState<PaymentForm>(emptyPaymentForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rowId = row.source === "po" ? row.poId : row.manualRecordId;

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
            <p className="text-[11px] text-slate-500">{row.poNumber || `#${rowId}`}</p>
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
              <label className="block mb-1 text-[11px] font-medium text-slate-900">Amount</label>
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

export default VendorFinancePage;
