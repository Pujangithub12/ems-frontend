import React, { useState } from "react";
import { X, Loader2, Trash2, History } from "lucide-react";
import { FinancePurchaseOrderRow } from "../../../types";
import { useDeleteFinanceRowPaymentMutation } from "../hooks/useFinance";
import { formatCost } from "../../../lib/currency";
import { getErrorMessage } from "../../../lib/errors";

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "--";

/**
 * Every installment logged against a PO, newest first (payments arrive pre-sorted desc by
 * paidDate from the API) — the aggregate "Amount Paid"/"Paid Date" columns on the Finance
 * tables only show the running total/latest date, so this is where the full trail lives.
 */
const PaymentHistoryModal: React.FC<{
  row: FinancePurchaseOrderRow;
  canDelete: boolean;
  onClose: () => void;
  onChanged: () => void;
}> = ({ row, canDelete, onClose, onChanged }) => {
  const deletePaymentMutation = useDeleteFinanceRowPaymentMutation();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rowId = row.source === "po" ? row.poId : row.manualRecordId;

  const handleDelete = async (paymentId: number) => {
    if (!window.confirm("Delete this payment? This can't be undone.")) return;
    if (rowId == null) return;
    setDeletingId(paymentId);
    setError(null);
    try {
      await deletePaymentMutation.mutateAsync({ source: row.source, id: rowId, paymentId });
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete payment."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History size={16} className="text-blue-900" />
            <div>
              <h3 className="text-[14px] font-semibold text-slate-900">Payment History</h3>
              <p className="text-[11px] text-slate-500">{row.poNumber || (rowId != null ? `#${rowId}` : "")} · {row.vendorName || row.vendor?.name || "Unknown vendor"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500">
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          {error && (
            <div className="px-3 py-2 mb-3 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>
          )}

          {row.payments.length === 0 ? (
            <p className="py-8 text-[12px] text-center text-slate-400">No payments logged yet.</p>
          ) : (
            <div className="overflow-y-auto divide-y max-h-80 divide-slate-100">
              {row.payments.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-semibold text-slate-900">{formatCost(p.amount)}</span>
                      <span className="text-[11px] text-slate-500">{formatDate(p.paidDate)}</span>
                    </div>
                    {p.reference && <p className="text-[11px] text-slate-500 truncate">Ref: {p.reference}</p>}
                    {p.notes && <p className="text-[11px] text-slate-400 truncate">{p.notes}</p>}
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      className="flex items-center justify-center flex-shrink-0 w-7 h-7 text-red-600 transition-colors rounded hover:bg-red-50 disabled:opacity-50"
                      title="Delete payment"
                    >
                      {deletingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 mt-3 text-[12px] border-t border-slate-100">
            <span className="text-slate-500">Total Paid</span>
            <span className="font-semibold text-slate-900">{formatCost(row.amountPaid)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistoryModal;
