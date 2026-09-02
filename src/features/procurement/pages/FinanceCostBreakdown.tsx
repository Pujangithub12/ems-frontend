import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle, Layers, Check, X, Pencil } from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { FinanceCostBreakdownRow } from "../../../types";
import { useFinanceCostBreakdownQuery, useUpdateCostBreakdownRowMutation } from "../hooks/useFinance";
import { EditCostBreakdownRowInput } from "../api/finance.api";
import { formatCost } from "../../../lib/currency";
import { getErrorMessage } from "../../../lib/errors";

type RowForm = {
  itemName: string;
  majorCost: string;
  freight: string;
  lcNumber: string;
  lcCharge: string;
  lcCommission: string;
  vat: string;
  refundedAmount: string;
  remarks: string;
};

const toForm = (row: FinanceCostBreakdownRow): RowForm => ({
  itemName: row.itemName,
  majorCost: String(row.majorCost),
  freight: String(row.freight),
  lcNumber: row.lcNumber || "",
  lcCharge: String(row.lcCharge),
  lcCommission: String(row.lcCommission),
  vat: String(row.vat),
  refundedAmount: String(row.refundedAmount),
  remarks: row.remarks || "",
});

/** Live preview of Refundable Amount/To Be Refunded while editing, mirroring the backend's
 * refundFields() formula — Refundable Amount is always 0 now that the per-row Refundable Margin
 * % it used to be computed from has been removed. */
const previewRefund = (form: RowForm) => {
  const refunded = parseFloat(form.refundedAmount) || 0;
  const refundableAmount = 0;
  return { refundableAmount, toBeRefunded: refundableAmount - refunded };
};

/**
 * Per-item cost breakdown for one Finance row (a PO's line items, or a manual record's single
 * line) — reached by clicking that row on the Finance page. Every field is editable inline:
 * for a PO row, item name/major cost write through to the real PurchaseOrderItem, while
 * freight/LC charge/LC commission/VAT are saved as this item's override of the otherwise
 * computed proration (see FinanceController.buildPoCostBreakdownRows on the backend).
 */
const FinanceCostBreakdownPage: React.FC = () => {
  const { source, id } = useParams<{ source: string; id: string }>();
  const navigate = useNavigate();
  const organizationId = useOrganizationId();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || user?.role === "finance";

  const normalizedSource = source === "manual" ? "manual" : source === "po" ? "po" : null;
  const recordId = id ? Number(id) : null;

  const breakdownQuery = useFinanceCostBreakdownQuery(normalizedSource, recordId);
  const rowMutation = useUpdateCostBreakdownRowMutation();

  const [editingRowKey, setEditingRowKey] = useState<number | null>(null); // itemId, or -1 for the single manual row
  const [form, setForm] = useState<RowForm | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!normalizedSource || !recordId) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center bg-white">
        <AlertCircle className="w-6 h-6 text-red-600" />
        <p className="text-[13px] text-slate-600">Invalid record.</p>
      </div>
    );
  }

  if (breakdownQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading cost breakdown…</p>
      </div>
    );
  }

  if (breakdownQuery.isError || !breakdownQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center bg-white">
        <AlertCircle className="w-6 h-6 text-red-600" />
        <p className="text-[13px] text-slate-600">{getErrorMessage(breakdownQuery.error, "Record not found.")}</p>
        <button
          onClick={() => navigate(`/${organizationId}/finance`)}
          className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          Back to Finance
        </button>
      </div>
    );
  }

  const { poNumber, vendorName, rows } = breakdownQuery.data;

  const startEditing = (row: FinanceCostBreakdownRow) => {
    setEditingRowKey(row.itemId ?? -1);
    setForm(toForm(row));
    setRowError(null);
  };

  const cancelEditing = () => {
    setEditingRowKey(null);
    setForm(null);
    setRowError(null);
  };

  const saveRow = async (row: FinanceCostBreakdownRow) => {
    if (!form) return;

    if (!form.itemName.trim()) {
      setRowError("Item name is required.");
      return;
    }
    const numericFields: [string, string][] = [
      ["Major Cost", form.majorCost],
      ["Freight", form.freight],
      ["LC Charge", form.lcCharge],
      ["LC Commission", form.lcCommission],
      ["VAT", form.vat],
      ["Refunded", form.refundedAmount],
    ];
    const parsed: Record<string, number> = {};
    for (const [label, value] of numericFields) {
      const n = parseFloat(value);
      if (!Number.isFinite(n) || n < 0) {
        setRowError(`Enter a valid ${label}.`);
        return;
      }
      parsed[label] = n;
    }
    const input: EditCostBreakdownRowInput = {
      itemName: form.itemName.trim(),
      majorCost: parsed["Major Cost"]!,
      freight: parsed["Freight"]!,
      lcNumber: form.lcNumber.trim() || null,
      lcCharge: parsed["LC Charge"]!,
      lcCommission: parsed["LC Commission"]!,
      vat: parsed["VAT"]!,
      refundedAmount: parsed["Refunded"]!,
      remarks: form.remarks.trim() || null,
    };

    setSaving(true);
    setRowError(null);
    try {
      await rowMutation.mutateAsync({
        source: normalizedSource,
        id: recordId,
        input,
        itemId: row.itemId,
      });
      cancelEditing();
    } catch (err) {
      setRowError(getErrorMessage(err, "Failed to save row."));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-2 py-1 text-[12px] border border-slate-200 rounded outline-none focus:border-blue-400";

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
          <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-blue-900 rounded-full bg-blue-50">
            <Layers size={16} />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-slate-900">{poNumber || `#${recordId}`}</h2>
            <p className="text-[12px] text-slate-500">{vendorName || "Unknown vendor"}</p>
          </div>
        </div>

        {rowError && (
          <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">{rowError}</div>
        )}

        <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-slate-500 text-[12px]">No items to show.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-blue-900 text-white text-[11px] font-semibold uppercase tracking-wide">
                    <th className="px-3 py-2 font-semibold text-left">Item Procure</th>
                    <th className="px-3 py-2 font-semibold text-right">Major Cost</th>
                    <th className="px-3 py-2 font-semibold text-right">Freight</th>
                    <th className="px-3 py-2 font-semibold text-left">LC Number</th>
                    <th className="px-3 py-2 font-semibold text-right">LC Charge</th>
                    <th className="px-3 py-2 font-semibold text-right">LC Commission</th>
                    <th className="px-3 py-2 font-semibold text-right">VAT</th>
                    <th className="px-3 py-2 font-semibold text-right">Refundable Amount</th>
                    <th className="px-3 py-2 font-semibold text-right">Refunded</th>
                    <th className="px-3 py-2 font-semibold text-right">To Be Refunded</th>
                    <th className="px-3 py-2 font-semibold text-left">Remarks</th>
                    {isAdmin && <th className="px-3 py-2 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const rowKey = r.itemId ?? -1;
                    const isEditing = editingRowKey === rowKey;

                    if (isEditing && form) {
                      const preview = previewRefund(form);
                      return (
                        <tr key={r.itemId ?? i} className="border-b border-slate-100 last:border-0 bg-blue-50/40">
                          <td className="px-3 py-2">
                            <input value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} className={inputCls} autoFocus />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="any" value={form.majorCost} onChange={(e) => setForm({ ...form, majorCost: e.target.value })} className={`${inputCls} text-right`} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="any" value={form.freight} onChange={(e) => setForm({ ...form, freight: e.target.value })} className={`${inputCls} text-right`} />
                          </td>
                          <td className="px-3 py-2">
                            <input value={form.lcNumber} onChange={(e) => setForm({ ...form, lcNumber: e.target.value })} className={inputCls} placeholder="Optional" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="any" value={form.lcCharge} onChange={(e) => setForm({ ...form, lcCharge: e.target.value })} className={`${inputCls} text-right`} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="any" value={form.lcCommission} onChange={(e) => setForm({ ...form, lcCommission: e.target.value })} className={`${inputCls} text-right`} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="any" value={form.vat} onChange={(e) => setForm({ ...form, vat: e.target.value })} className={`${inputCls} text-right`} />
                          </td>
                          <td className="px-3 py-2 text-right text-slate-500">{formatCost(preview.refundableAmount)}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={form.refundedAmount}
                              onChange={(e) => setForm({ ...form, refundedAmount: e.target.value })}
                              className={`${inputCls} text-right`}
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-slate-500">{formatCost(preview.toBeRefunded)}</td>
                          <td className="px-3 py-2">
                            <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className={inputCls} placeholder="Optional" />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => saveRow(r)}
                                disabled={saving}
                                className="flex items-center justify-center w-7 h-7 text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-50"
                                title="Save"
                              >
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              </button>
                              <button
                                onClick={cancelEditing}
                                disabled={saving}
                                className="flex items-center justify-center w-7 h-7 text-slate-500 transition-colors border rounded border-slate-200 hover:bg-slate-100 disabled:opacity-50"
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={r.itemId ?? i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-800">{r.itemName}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatCost(r.majorCost)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.freight)}</td>
                        <td className="px-3 py-2 text-slate-600">{r.lcNumber || "--"}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.lcCharge)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.lcCommission)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.vat)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.refundableAmount)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.refundedAmount)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${r.toBeRefunded > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                          {formatCost(r.toBeRefunded)}
                        </td>
                        <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{r.remarks || "--"}</td>
                        {isAdmin && (
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => startEditing(r)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors border rounded border-slate-200 hover:bg-slate-100"
                            >
                              <Pencil size={11} /> Edit
                            </button>
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
    </div>
  );
};

export default FinanceCostBreakdownPage;
