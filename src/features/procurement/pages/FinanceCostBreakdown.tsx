import React, { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle, Layers, Check, X, Pencil, History } from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { FinanceCostBreakdownRow } from "../../../types";
import { useFinanceCostBreakdownQuery, useUpdateCostBreakdownRowMutation, useExchangeRatesQuery, useFinanceOverviewQuery } from "../hooks/useFinance";
import { EditCostBreakdownRowInput } from "../api/finance.api";
import { formatCost } from "../../../lib/currency";
import { getErrorMessage } from "../../../lib/errors";
import PaymentHistoryModal from "../components/PaymentHistoryModal";

type RowForm = {
  itemName: string;
  majorCost: string;
  freight: string;
  lcNumber: string;
  lcAmount: string;
  lcCharge: string;
  lcCommission: string;
  vat: string;
  importDuties: string;
  insurance: string;
  /** Manually entered directly in NPR (not the row's own currency, unlike majorCost/freight/etc.)
   * — VAT/tax refunds are processed in NPR regardless of the record's currency, so these are
   * typed in NPR and the row's native-currency equivalent is shown alongside for reference. */
  refundableAmount: string;
  refundedAmount: string;
  remarks: string;
};

/** Blank instead of "0" for an unset numeric field — typing over a pre-filled 0 is annoying, and
 * an empty box is treated as 0 anyway on save (see saveRow's numeric parsing). */
const numOrBlank = (n: number): string => (n === 0 ? "" : String(n));

const toForm = (row: FinanceCostBreakdownRow): RowForm => ({
  itemName: row.itemName,
  majorCost: numOrBlank(row.majorCost),
  freight: numOrBlank(row.freight),
  lcNumber: row.lcNumber || "",
  lcAmount: numOrBlank(row.lcAmount),
  lcCharge: numOrBlank(row.lcCharge),
  lcCommission: numOrBlank(row.lcCommission),
  vat: numOrBlank(row.vat),
  importDuties: numOrBlank(row.importDuties),
  insurance: numOrBlank(row.insurance),
  refundableAmount: numOrBlank(row.refundableAmount),
  refundedAmount: numOrBlank(row.refundedAmount),
  remarks: row.remarks || "",
});

/** Live preview of Refundable Amount/To Be Refunded while editing, mirroring the backend's
 * refundFields() formula. */
const previewRefund = (form: RowForm) => {
  const refundableAmount = parseFloat(form.refundableAmount) || 0;
  const refunded = parseFloat(form.refundedAmount) || 0;
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
  const ratesQuery = useExchangeRatesQuery();
  const overviewQuery = useFinanceOverviewQuery();

  // Keyed by itemId (or -1 for the single manual row). A row is editable whenever it has an
  // entry here — the top-right Edit button populates every row at once; each row can also be
  // individually saved or cancelled out of edit mode without affecting the others.
  const [forms, setForms] = useState<Record<number, RowForm>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [savingKey, setSavingKey] = useState<number | null>(null);
  const isBulkEditing = Object.keys(forms).length > 0;
  const [showHistory, setShowHistory] = useState(false);

  // Left/Right arrow at a field's edge moves focus to the adjacent editable cell in that same
  // row (see handleCellArrowNav below) — must be declared before the early returns, same as
  // every other hook here, so the hook order stays stable across loading/error/loaded renders.
  const EDITABLE_FIELD_COUNT = 13; // itemName, majorCost, freight, lcNumber, lcAmount, lcCharge, lcCommission, vat, importDuties, insurance, refundableAmount, refundedAmount, remarks
  const cellRefs = useRef<Record<number, Array<HTMLInputElement | null>>>({});

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

  const { poNumber, vendorName, currency, rows } = breakdownQuery.data;

  // The matching Finance-page ledger row (has the payments list) — same data PaymentHistoryModal
  // uses from the /finance page, just looked up here by source+id instead of already in hand.
  const ledgerRow = (overviewQuery.data ?? []).find((r) =>
    normalizedSource === "po" ? r.source === "po" && r.poId === recordId : r.source === "manual" && r.manualRecordId === recordId,
  );

  // Today's NRB selling rate for this record's currency, when it's not already NPR — used to
  // convert the NPR-entered refund fields back to the row's own currency as a reference.
  const nprRate = currency && currency !== "NPR" ? ratesQuery.data?.[currency] : undefined;
  /** Refundable Amount/Refunded are entered directly in NPR — this converts that NPR figure to
   * the row's own currency, shown alongside as a reference. */
  const toNativeEquivalent = (amountNpr: number): string | null => (nprRate ? formatCost(amountNpr / nprRate, currency) : null);

  const startEditingAll = () => {
    setForms(Object.fromEntries(rows.map((r) => [r.itemId ?? -1, toForm(r)])));
    setRowErrors({});
  };

  const cancelEditingAll = () => {
    setForms({});
    setRowErrors({});
  };

  const cancelRow = (key: number) => {
    setForms((f) => {
      const next = { ...f };
      delete next[key];
      return next;
    });
    setRowErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const saveRow = async (row: FinanceCostBreakdownRow) => {
    const key = row.itemId ?? -1;
    const form = forms[key];
    if (!form) return;

    if (!form.itemName.trim()) {
      setRowErrors((e) => ({ ...e, [key]: "Item name is required." }));
      return;
    }
    const numericFields: [string, string][] = [
      ["Major Cost", form.majorCost],
      ["Freight", form.freight],
      ["LC Amount", form.lcAmount],
      ["LC Charge", form.lcCharge],
      ["LC Commission", form.lcCommission],
      ["VAT", form.vat],
      ["Import Duties", form.importDuties],
      ["Insurance", form.insurance],
      ["Refundable Amount", form.refundableAmount],
      ["Refunded", form.refundedAmount],
    ];
    const parsed: Record<string, number> = {};
    for (const [label, value] of numericFields) {
      const n = value.trim() === "" ? 0 : parseFloat(value); // a blank box (see numOrBlank) means 0
      if (!Number.isFinite(n) || n < 0) {
        setRowErrors((e) => ({ ...e, [key]: `Enter a valid ${label}.` }));
        return;
      }
      parsed[label] = n;
    }
    const input: EditCostBreakdownRowInput = {
      itemName: form.itemName.trim(),
      majorCost: parsed["Major Cost"]!,
      freight: parsed["Freight"]!,
      lcNumber: form.lcNumber.trim() || null,
      lcAmount: parsed["LC Amount"]!,
      lcCharge: parsed["LC Charge"]!,
      lcCommission: parsed["LC Commission"]!,
      vat: parsed["VAT"]!,
      importDuties: parsed["Import Duties"]!,
      insurance: parsed["Insurance"]!,
      refundableAmount: parsed["Refundable Amount"]!,
      refundedAmount: parsed["Refunded"]!,
      remarks: form.remarks.trim() || null,
    };

    setSavingKey(key);
    setRowErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
    try {
      await rowMutation.mutateAsync({
        source: normalizedSource,
        id: recordId,
        input,
        itemId: row.itemId,
      });
      cancelRow(key);
    } catch (err) {
      setRowErrors((e) => ({ ...e, [key]: getErrorMessage(err, "Failed to save row.") }));
    } finally {
      setSavingKey(null);
    }
  };

  const inputCls = "w-full px-2 py-1 text-[12px] border border-slate-200 rounded outline-none focus:border-blue-400";

  const registerCell = (rowKey: number, i: number) => (el: HTMLInputElement | null) => {
    if (!cellRefs.current[rowKey]) cellRefs.current[rowKey] = Array(EDITABLE_FIELD_COUNT).fill(null);
    cellRefs.current[rowKey]![i] = el;
  };
  const handleCellArrowNav = (e: React.KeyboardEvent<HTMLInputElement>, rowKey: number, i: number) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const input = e.currentTarget;
    if (input.selectionStart !== input.selectionEnd) return; // a range is selected — let the browser collapse it first
    const atStart = input.selectionStart === 0;
    const atEnd = input.selectionStart === input.value.length;
    const rowCells = cellRefs.current[rowKey];
    if (!rowCells) return;
    if (e.key === "ArrowLeft" && atStart) {
      const prev = rowCells[i - 1];
      if (prev) {
        e.preventDefault();
        prev.focus();
        const len = prev.value.length;
        prev.setSelectionRange(len, len);
      }
    } else if (e.key === "ArrowRight" && atEnd) {
      const next = rowCells[i + 1];
      if (next) {
        e.preventDefault();
        next.focus();
        next.setSelectionRange(0, 0);
      }
    }
  };

  return (
    <div className="w-full min-h-full p-6 bg-white lg:px-8 lg:py-8">
      <div className="flex flex-col w-full min-w-0 gap-4">
        <div className="flex items-center justify-between gap-3">
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
          <div className="flex items-center gap-2">
            {ledgerRow && (
              <button
                onClick={() => setShowHistory(true)}
                disabled={ledgerRow.payments.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border text-slate-600 border-slate-200 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                title={ledgerRow.payments.length === 0 ? "No payments logged yet" : "View payment history"}
              >
                <History size={13} /> View Payment History
              </button>
            )}
            {isAdmin && rows.length > 0 && (
              <button
                onClick={() => (isBulkEditing ? cancelEditingAll() : startEditingAll())}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${
                  isBulkEditing ? "text-slate-600 border-slate-200 hover:bg-slate-100" : "text-white bg-blue-900 border-blue-900 hover:bg-blue-800"
                }`}
              >
                {isBulkEditing ? (
                  <>
                    <X size={13} /> Done editing
                  </>
                ) : (
                  <>
                    <Pencil size={13} /> Edit
                  </>
                )}
              </button>
            )}
          </div>
        </div>

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
                    <th className="px-3 py-2 font-semibold text-right">LC Amount</th>
                    <th className="px-3 py-2 font-semibold text-right">LC Charge</th>
                    <th className="px-3 py-2 font-semibold text-right">LC Commission</th>
                    <th className="px-3 py-2 font-semibold text-right">VAT</th>
                    <th className="px-3 py-2 font-semibold text-right">Import Duties</th>
                    <th className="px-3 py-2 font-semibold text-right">Insurance</th>
                    <th className="px-3 py-2 font-semibold text-right">Refundable Amount (NPR)</th>
                    <th className="px-3 py-2 font-semibold text-right">Refunded (NPR)</th>
                    <th className="px-3 py-2 font-semibold text-right">To Be Refunded (NPR)</th>
                    <th className="px-3 py-2 font-semibold text-left">Remarks</th>
                    {isAdmin && <th className="px-3 py-2 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const rowKey = r.itemId ?? -1;
                    const form = forms[rowKey];
                    const saving = savingKey === rowKey;
                    const rowErrorMsg = rowErrors[rowKey];

                    if (form) {
                      const preview = previewRefund(form);
                      const updateForm = (patch: Partial<RowForm>) => setForms((f) => ({ ...f, [rowKey]: { ...f[rowKey]!, ...patch } }));
                      return (
                        <tr key={r.itemId ?? i} className="border-b border-slate-100 last:border-0 bg-blue-50/40">
                          <td className="px-3 py-2">
                            <input
                              ref={registerCell(rowKey, 0)}
                              value={form.itemName}
                              onChange={(e) => updateForm({ itemName: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, rowKey, 0)}
                              className={inputCls}
                              autoFocus
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              ref={registerCell(rowKey, 1)}
                              type="text"
                              inputMode="decimal"
                              value={form.majorCost}
                              onChange={(e) => updateForm({ majorCost: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, rowKey, 1)}
                              className={`${inputCls} text-right`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              ref={registerCell(rowKey, 2)}
                              type="text"
                              inputMode="decimal"
                              value={form.freight}
                              onChange={(e) => updateForm({ freight: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, rowKey, 2)}
                              className={`${inputCls} text-right`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              ref={registerCell(rowKey, 3)}
                              value={form.lcNumber}
                              onChange={(e) => updateForm({ lcNumber: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, rowKey, 3)}
                              className={inputCls}
                              placeholder="Optional"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              ref={registerCell(rowKey, 4)}
                              type="text"
                              inputMode="decimal"
                              value={form.lcAmount}
                              onChange={(e) => updateForm({ lcAmount: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, rowKey, 4)}
                              className={`${inputCls} text-right`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              ref={registerCell(rowKey, 5)}
                              type="text"
                              inputMode="decimal"
                              value={form.lcCharge}
                              onChange={(e) => updateForm({ lcCharge: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, rowKey, 5)}
                              className={`${inputCls} text-right`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              ref={registerCell(rowKey, 6)}
                              type="text"
                              inputMode="decimal"
                              value={form.lcCommission}
                              onChange={(e) => updateForm({ lcCommission: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, rowKey, 6)}
                              className={`${inputCls} text-right`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              ref={registerCell(rowKey, 7)}
                              type="text"
                              inputMode="decimal"
                              value={form.vat}
                              onChange={(e) => updateForm({ vat: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, rowKey, 7)}
                              className={`${inputCls} text-right`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              ref={registerCell(rowKey, 8)}
                              type="text"
                              inputMode="decimal"
                              value={form.importDuties}
                              onChange={(e) => updateForm({ importDuties: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, rowKey, 8)}
                              className={`${inputCls} text-right`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              ref={registerCell(rowKey, 9)}
                              type="text"
                              inputMode="decimal"
                              value={form.insurance}
                              onChange={(e) => updateForm({ insurance: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, rowKey, 9)}
                              className={`${inputCls} text-right`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              ref={registerCell(rowKey, 10)}
                              type="text"
                              inputMode="decimal"
                              value={form.refundableAmount}
                              onChange={(e) => updateForm({ refundableAmount: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, rowKey, 10)}
                              className={`${inputCls} text-right`}
                            />
                            {toNativeEquivalent(preview.refundableAmount) && (
                              <div className="text-[10px] text-slate-400 text-right">≈ {toNativeEquivalent(preview.refundableAmount)} today</div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              ref={registerCell(rowKey, 11)}
                              type="text"
                              inputMode="decimal"
                              value={form.refundedAmount}
                              onChange={(e) => updateForm({ refundedAmount: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, rowKey, 11)}
                              className={`${inputCls} text-right`}
                            />
                            {toNativeEquivalent(parseFloat(form.refundedAmount) || 0) && (
                              <div className="text-[10px] text-slate-400 text-right">≈ {toNativeEquivalent(parseFloat(form.refundedAmount) || 0)} today</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-500">{formatCost(preview.toBeRefunded, "NPR")}</td>
                          <td className="px-3 py-2">
                            <input
                              ref={registerCell(rowKey, 12)}
                              value={form.remarks}
                              onChange={(e) => updateForm({ remarks: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, rowKey, 12)}
                              className={inputCls}
                              placeholder="Optional"
                            />
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
                                onClick={() => cancelRow(rowKey)}
                                disabled={saving}
                                className="flex items-center justify-center w-7 h-7 text-slate-500 transition-colors border rounded border-slate-200 hover:bg-slate-100 disabled:opacity-50"
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </div>
                            {rowErrorMsg && <div className="mt-1 text-[10px] text-right text-red-600 max-w-[140px] ml-auto">{rowErrorMsg}</div>}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={r.itemId ?? i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-800">{r.itemName}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatCost(r.majorCost, currency)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.freight, currency)}</td>
                        <td className="px-3 py-2 text-slate-600">{r.lcNumber || "--"}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.lcAmount, currency)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.lcCharge, currency)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.lcCommission, currency)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.vat, currency)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.importDuties, currency)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCost(r.insurance, currency)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {formatCost(r.refundableAmount, "NPR")}
                          {toNativeEquivalent(r.refundableAmount) && <div className="text-[10px] text-slate-400">≈ {toNativeEquivalent(r.refundableAmount)} today</div>}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {formatCost(r.refundedAmount, "NPR")}
                          {toNativeEquivalent(r.refundedAmount) && <div className="text-[10px] text-slate-400">≈ {toNativeEquivalent(r.refundedAmount)} today</div>}
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${r.toBeRefunded > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                          {formatCost(r.toBeRefunded, "NPR")}
                        </td>
                        <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{r.remarks || "--"}</td>
                        {isAdmin && <td className="px-3 py-2" />}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showHistory && ledgerRow && (
        <PaymentHistoryModal
          row={ledgerRow}
          canDelete={isAdmin}
          onClose={() => setShowHistory(false)}
          onChanged={() => overviewQuery.refetch()}
        />
      )}
    </div>
  );
};

export default FinanceCostBreakdownPage;
