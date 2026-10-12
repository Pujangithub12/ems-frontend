import React, { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle, Plus, Pencil, Trash2, X, Check, Users } from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { DebtorClaimRow } from "../../../types";
import {
  useDebtorDetailQuery,
  useCreateDebtorClaimMutation,
  useUpdateDebtorClaimMutation,
  useDeleteDebtorClaimMutation,
} from "../hooks/useDebtors";
import { formatCost } from "../../../lib/currency";
import { getErrorMessage } from "../../../lib/errors";

// Spreadsheet-style table, same look and behaviour as the Finance cost-breakdown table: uniform
// cells, thin grid, borderless inputs that fill the cell, blue "active cell" outline.
const th = "px-2 h-8 text-[11.5px] font-semibold text-slate-700 bg-slate-100 border border-slate-300 whitespace-nowrap";
const td = "px-2 h-9 text-[12px] text-slate-800 border border-slate-300 whitespace-nowrap";
const inputCell = "p-0 border border-slate-300 bg-white";
const inputCls = "block w-full h-9 px-2 text-[12px] bg-transparent border-0 rounded-none outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600";

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "--";

const balanceCls = (n: number) => `font-medium ${n > 0 ? "text-red-700" : "text-emerald-700"}`;

type RowForm = {
  paymentDate: string;
  purpose: string;
  commercialInvoiceNo: string;
  claimReceived: string;
  reimbursementPurpose: string;
  reimbursementAmount: string;
  reimbursementReceived: string;
};

/** Blank instead of "0" for an unset number, so there's nothing to type over. */
const numOrBlank = (n: number) => (n === 0 ? "" : String(n));

const toForm = (c: DebtorClaimRow): RowForm => ({
  paymentDate: (c.paymentDate ?? "").slice(0, 10),
  purpose: c.purpose ?? "",
  commercialInvoiceNo: c.commercialInvoiceNo ?? "",
  claimReceived: numOrBlank(c.claimReceived),
  reimbursementPurpose: c.reimbursementPurpose ?? "",
  reimbursementAmount: numOrBlank(c.reimbursementAmount),
  reimbursementReceived: numOrBlank(c.reimbursementReceived),
});

const EDITABLE_FIELD_COUNT = 7; // date is not part of the arrow-key chain: purpose, invoice, claimReceived, reimbPurpose, reimbAmount, reimbReceived

/** One debtor's detail page — reached by clicking a row on the Debtors table. Each row pairs a
 * claim (purpose / commercial invoice / amount, received, balance) with the reimbursement of
 * expense tied to it (purpose / amount, received, balance). Rows are typed straight into the table. */
const DebtorDetail: React.FC = () => {
  const { debtorId } = useParams<{ debtorId: string }>();
  const navigate = useNavigate();
  const organizationId = useOrganizationId();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || user?.role === "finance";

  const id = debtorId ? Number(debtorId) : null;
  const detailQuery = useDebtorDetailQuery(id);
  const createMutation = useCreateDebtorClaimMutation();
  const updateMutation = useUpdateDebtorClaimMutation();
  const deleteMutation = useDeleteDebtorClaimMutation();

  // A row is editable whenever it has an entry here; the top-right Edit button fills it for every
  // row, and each row can be saved or cancelled on its own.
  const [forms, setForms] = useState<Record<number, RowForm>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [addingRow, setAddingRow] = useState(false);
  const isBulkEditing = Object.keys(forms).length > 0;

  // Left/Right arrow at a field's edge moves to the adjacent cell in the same row.
  const cellRefs = useRef<Record<number, Array<HTMLInputElement | null>>>({});

  if (detailQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading debtor…</p>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data || id == null) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center bg-white">
        <AlertCircle className="w-6 h-6 text-red-600" />
        <p className="text-[13px] text-slate-600">{getErrorMessage(detailQuery.error, "Debtor not found.")}</p>
        <button
          onClick={() => navigate(`/${organizationId}/debtors`)}
          className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          Back to Debtors
        </button>
      </div>
    );
  }

  const { debtor, claims } = detailQuery.data;
  const cur = debtor.currency;
  const sum = (pick: (c: DebtorClaimRow) => number) => claims.reduce((t, c) => t + pick(c), 0);
  // The claim amount comes from the debtor record (display only); each row's claim balance is
  // that amount less everything received up to and including the row.
  const claimBalances = claims.reduce<number[]>((acc, c) => {
    acc.push((acc.length ? acc[acc.length - 1]! : debtor.claimAmount) - c.claimReceived);
    return acc;
  }, []);
  const totals = {
    claimReceived: sum((c) => c.claimReceived),
    claimBalance: debtor.claimAmount - sum((c) => c.claimReceived),
    reimbursementAmount: sum((c) => c.reimbursementAmount),
    reimbursementReceived: sum((c) => c.reimbursementReceived),
    reimbursementBalance: sum((c) => c.reimbursementBalance),
  };

  const parseAmount = (v: string) => (v.trim() === "" ? 0 : parseFloat(v)); // blank means 0

  const startEditingAll = () => {
    setForms(Object.fromEntries(claims.map((c) => [c.id, toForm(c)])));
    setRowErrors({});
  };
  const cancelEditingAll = () => {
    setForms({});
    setRowErrors({});
  };
  const cancelRow = (rowId: number) => {
    setForms((f) => {
      const next = { ...f };
      delete next[rowId];
      return next;
    });
    setRowErrors((e) => {
      const next = { ...e };
      delete next[rowId];
      return next;
    });
  };

  const saveRow = async (claim: DebtorClaimRow) => {
    const form = forms[claim.id];
    if (!form) return;
    const claimReceived = parseAmount(form.claimReceived);
    const reimbursementAmount = parseAmount(form.reimbursementAmount);
    const reimbursementReceived = parseAmount(form.reimbursementReceived);
    if ([claimReceived, reimbursementAmount, reimbursementReceived].some((n) => !Number.isFinite(n) || n < 0)) {
      setRowErrors((e) => ({ ...e, [claim.id]: "Amounts must be valid non-negative numbers." }));
      return;
    }
    setSavingId(claim.id);
    setRowErrors((e) => {
      const next = { ...e };
      delete next[claim.id];
      return next;
    });
    try {
      await updateMutation.mutateAsync({
        id: debtor.id,
        claimId: claim.id,
        input: {
          paymentDate: form.paymentDate || null,
          purpose: form.purpose.trim() || null,
          commercialInvoiceNo: form.commercialInvoiceNo.trim() || null,
          claimReceived,
          reimbursementPurpose: form.reimbursementPurpose.trim() || null,
          reimbursementAmount,
          reimbursementReceived,
        },
      });
      cancelRow(claim.id);
    } catch (err) {
      setRowErrors((e) => ({ ...e, [claim.id]: getErrorMessage(err, "Failed to save row.") }));
    } finally {
      setSavingId(null);
    }
  };

  /** "Add Payment": no form - appends a blank row dated today and opens it in edit mode. */
  const handleAddPayment = async () => {
    if (addingRow) return;
    setAddingRow(true);
    try {
      const created = await createMutation.mutateAsync({
        id: debtor.id,
        input: {
          paymentDate: new Date().toISOString().slice(0, 10),
          purpose: null,
          commercialInvoiceNo: null,
          claimReceived: 0,
          reimbursementPurpose: null,
          reimbursementAmount: 0,
          reimbursementReceived: 0,
        },
      });
      setForms((f) => ({ ...f, [created.id]: toForm(created) }));
    } catch (err) {
      window.alert(getErrorMessage(err, "Failed to add payment row."));
    } finally {
      setAddingRow(false);
    }
  };

  const handleDelete = async (claim: DebtorClaimRow) => {
    if (!window.confirm("Delete this payment row? This can't be undone.")) return;
    setDeletingId(claim.id);
    try {
      await deleteMutation.mutateAsync({ id: debtor.id, claimId: claim.id });
      cancelRow(claim.id);
    } finally {
      setDeletingId(null);
    }
  };

  const registerCell = (rowId: number, i: number) => (el: HTMLInputElement | null) => {
    if (!cellRefs.current[rowId]) cellRefs.current[rowId] = Array(EDITABLE_FIELD_COUNT).fill(null);
    cellRefs.current[rowId]![i] = el;
  };
  const handleCellArrowNav = (e: React.KeyboardEvent<HTMLInputElement>, rowId: number, i: number) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const input = e.currentTarget;
    if (input.selectionStart !== input.selectionEnd) return;
    const rowCells = cellRefs.current[rowId];
    if (!rowCells) return;
    if (e.key === "ArrowLeft" && input.selectionStart === 0) {
      const prev = rowCells[i - 1];
      if (prev) {
        e.preventDefault();
        prev.focus();
        prev.setSelectionRange(prev.value.length, prev.value.length);
      }
    } else if (e.key === "ArrowRight" && input.selectionStart === input.value.length) {
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
              onClick={() => navigate(`/${organizationId}/debtors`)}
              className="flex items-center justify-center w-8 h-8 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
              title="Back to Debtors"
            >
              <ArrowLeft size={14} />
            </button>
            <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-blue-900 rounded-full bg-blue-50">
              <Users size={16} />
            </div>
            <h2 className="text-[17px] font-semibold text-slate-900">{debtor.debtorName}</h2>
          </div>
          {isAdmin && claims.length > 0 && (
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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-slate-700">
            LC Number: <span className="font-semibold text-blue-900">{debtor.lcNumber || "--"}</span>
          </span>
          {isAdmin && (
            <button
              onClick={handleAddPayment}
              disabled={addingRow}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg text-[12px] font-medium hover:bg-blue-800 transition-colors shadow-sm disabled:opacity-60"
            >
              {addingRow ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Payment
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-md shadow-sm border-slate-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className={th}>Date</th>
                  <th rowSpan={2} className={`${th} min-w-[100px] text-right`}>Total Amount</th>
                  <th colSpan={3} className={`${th} text-center`}>Claim</th>
                  <th rowSpan={2} className={`${th} min-w-[100px] text-right`}>Received Amount</th>
                  <th rowSpan={2} className={`${th} min-w-[100px] text-right`}>Balance</th>
                  <th colSpan={4} className={`${th} text-center`}>Reimbursement of Expense</th>
                  {isAdmin && <th rowSpan={2} className={`${th} text-right`}>Actions</th>}
                </tr>
                <tr className="bg-slate-100">
                  <th className={`${th} min-w-[140px]`}>Purpose</th>
                  <th className={`${th} min-w-[140px]`}>Commercial Invoice Number</th>
                  <th className={`${th} min-w-[100px] text-right`}>Claim Amount</th>
                  <th className={`${th} min-w-[160px]`}>Purpose of Reimbursement</th>
                  <th className={`${th} min-w-[100px] text-right`}>Amount</th>
                  <th className={`${th} min-w-[100px] text-right`}>Received Amount</th>
                  <th className={`${th} min-w-[100px] text-right`}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {claims.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 12 : 11} className="px-3 py-12 text-center text-[12px] text-slate-500 border border-slate-300">
                      No payments yet.{isAdmin ? " Click “Add Payment” to add a row." : ""}
                    </td>
                  </tr>
                ) : (
                  claims.map((c, i) => {
                    const form = forms[c.id];

                    if (form) {
                      const updateForm = (patch: Partial<RowForm>) => setForms((f) => ({ ...f, [c.id]: { ...f[c.id]!, ...patch } }));
                      // Live balances while typing
                      const prevBalance = i === 0 ? debtor.claimAmount : claimBalances[i - 1]!;
                      const claimBalancePreview = prevBalance - parseAmount(form.claimReceived || "0");
                      const reimbBalancePreview = parseAmount(form.reimbursementAmount || "0") - parseAmount(form.reimbursementReceived || "0");
                      const numField = (key: "claimReceived" | "reimbursementAmount" | "reimbursementReceived", idx: number) => (
                        <input
                          ref={registerCell(c.id, idx)}
                          type="text"
                          inputMode="decimal"
                          value={form[key]}
                          onChange={(e) => updateForm({ [key]: e.target.value })}
                          onKeyDown={(e) => handleCellArrowNav(e, c.id, idx)}
                          className={inputCls}
                        />
                      );
                      return (
                        <tr key={c.id} className="bg-blue-50/40">
                          <td className={inputCell}>
                            <input type="date" value={form.paymentDate} onChange={(e) => updateForm({ paymentDate: e.target.value })} className={inputCls} />
                          </td>
                          <td className={`${td} text-right text-slate-500`}>{formatCost(debtor.totalAmount, cur)}</td>
                          <td className={inputCell}>
                            <input
                              ref={registerCell(c.id, 0)}
                              value={form.purpose}
                              onChange={(e) => updateForm({ purpose: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, c.id, 0)}
                              className={inputCls}
                              autoFocus
                            />
                          </td>
                          <td className={inputCell}>
                            <input
                              ref={registerCell(c.id, 1)}
                              value={form.commercialInvoiceNo}
                              onChange={(e) => updateForm({ commercialInvoiceNo: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, c.id, 1)}
                              className={inputCls}
                            />
                          </td>
                          <td className={`${td} text-right text-slate-500`}>{formatCost(debtor.claimAmount, cur)}</td>
                          <td className={inputCell}>{numField("claimReceived", 2)}</td>
                          <td className={`${td} text-right text-slate-500`}>{formatCost(claimBalancePreview, cur)}</td>
                          <td className={inputCell}>
                            <input
                              ref={registerCell(c.id, 3)}
                              value={form.reimbursementPurpose}
                              onChange={(e) => updateForm({ reimbursementPurpose: e.target.value })}
                              onKeyDown={(e) => handleCellArrowNav(e, c.id, 3)}
                              className={inputCls}
                            />
                          </td>
                          <td className={inputCell}>{numField("reimbursementAmount", 4)}</td>
                          <td className={inputCell}>{numField("reimbursementReceived", 5)}</td>
                          <td className={`${td} text-right text-slate-500`}>{formatCost(reimbBalancePreview, cur)}</td>
                          <td className={td}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => saveRow(c)}
                                disabled={savingId === c.id}
                                className="flex items-center justify-center w-7 h-7 text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-50"
                                title="Save"
                              >
                                {savingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              </button>
                              <button
                                onClick={() => cancelRow(c.id)}
                                disabled={savingId === c.id}
                                className="flex items-center justify-center w-7 h-7 text-slate-500 transition-colors border rounded border-slate-200 hover:bg-slate-100 disabled:opacity-50"
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </div>
                            {rowErrors[c.id] && <div className="mt-1 text-[10px] text-right text-red-600 max-w-[140px] ml-auto whitespace-normal">{rowErrors[c.id]}</div>}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={c.id} className="bg-white hover:bg-blue-50/60">
                        <td className={td}>{formatDate(c.paymentDate)}</td>
                        <td className={`${td} text-right`}>{formatCost(debtor.totalAmount, cur)}</td>
                        <td className={td}>{c.purpose || "--"}</td>
                        <td className={td}>{c.commercialInvoiceNo || "--"}</td>
                        <td className={`${td} text-right`}>{formatCost(debtor.claimAmount, cur)}</td>
                        <td className={`${td} text-right`}>{formatCost(c.claimReceived, cur)}</td>
                        <td className={`${td} text-right ${balanceCls(claimBalances[i]!)}`}>{formatCost(claimBalances[i]!, cur)}</td>
                        <td className={td}>{c.reimbursementPurpose || "--"}</td>
                        <td className={`${td} text-right`}>{formatCost(c.reimbursementAmount, cur)}</td>
                        <td className={`${td} text-right`}>{formatCost(c.reimbursementReceived, cur)}</td>
                        <td className={`${td} text-right ${balanceCls(c.reimbursementBalance)}`}>{formatCost(c.reimbursementBalance, cur)}</td>
                        {isAdmin && (
                          <td className={td}>
                            <div className="flex items-center justify-end">
                              <button
                                onClick={() => handleDelete(c)}
                                disabled={deletingId === c.id}
                                className="flex items-center justify-center w-7 h-7 text-red-600 transition-colors border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                                title="Delete payment row"
                              >
                                {deletingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {claims.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-semibold border-t-2 border-slate-400">
                    <td className={td}>Total</td>
                    <td className={`${td} text-right`} title="The debtor's total amount (not summed per row)">{formatCost(debtor.totalAmount, cur)}</td>
                    <td className={td} />
                    <td className={td} />
                    <td className={`${td} text-right`}>{formatCost(debtor.claimAmount, cur)}</td>
                    <td className={`${td} text-right`}>{formatCost(totals.claimReceived, cur)}</td>
                    <td className={`${td} text-right ${balanceCls(totals.claimBalance)}`}>{formatCost(totals.claimBalance, cur)}</td>
                    <td className={td} />
                    <td className={`${td} text-right`}>{formatCost(totals.reimbursementAmount, cur)}</td>
                    <td className={`${td} text-right`}>{formatCost(totals.reimbursementReceived, cur)}</td>
                    <td className={`${td} text-right ${balanceCls(totals.reimbursementBalance)}`}>{formatCost(totals.reimbursementBalance, cur)}</td>
                    {isAdmin && <td className={td} />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebtorDetail;
