import { useNavigate } from "react-router-dom";
import React, { useEffect, useMemo, useState } from "react";
import { Users, Search, RefreshCw, Loader2, AlertCircle, X, History, Plus, Pencil, Trash2, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useProjects } from "../../projects/hooks/useProjects";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { useAuth } from "../../../context/AuthProvider";
import { DebtorRow } from "../../../types";
import {
  useDebtorsQuery,
  useCreateDebtorMutation,
  useUpdateDebtorMutation,
  useDeleteDebtorMutation,
  useDeleteDebtorPaymentMutation,
} from "../hooks/useDebtors";
import { formatCost } from "../../../lib/currency";
import { getErrorMessage } from "../../../lib/errors";

const CURRENCY_OPTIONS = ["NPR", "INR", "USD", "RMB"] as const;

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "--";

type SortKey = "debtorName" | "project" | "lcNumber" | "itemName" | "amountDue" | "paymentTerms" | "amountReceived" | "receivedDate" | "outstandingBalance";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "debtorName", label: "Debtor" },
  { key: "project", label: "Project" },
  { key: "lcNumber", label: "LC Number" },
  { key: "itemName", label: "Item / Service" },
  { key: "amountDue", label: "Total Amount", align: "right" },
  { key: "paymentTerms", label: "Terms of Payment" },
  { key: "amountReceived", label: "Amount Received", align: "right" },
  { key: "receivedDate", label: "Received Date" },
  { key: "outstandingBalance", label: "Outstanding Balance", align: "right" },
];

const sortValue = (r: DebtorRow, key: SortKey): string | number => {
  if (key === "project") return r.project?.name ?? "";
  if (key === "lcNumber") return r.lcNumber ?? "";
  const v = r[key];
  return v == null ? "" : v;
};

const inputCls = "w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400";
const labelCls = "block mb-1 text-[11px] font-medium text-slate-900";

/** Debtors ledger — money customers owe us. Mirror image of the Finance page: one row per
 * receivable, with installments received logged against it. Same admin/super_admin/finance access. */
const Debtors: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const organizationId = useOrganizationId();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || user?.role === "finance";

  const debtorsQuery = useDebtorsQuery();
  const rows = debtorsQuery.data ?? [];
  const deleteMutation = useDeleteDebtorMutation();

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "receivedDate", dir: "desc" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<DebtorRow | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    await debtorsQuery.refetch();
    setRefreshing(false);
  };

  const openAdd = () => {
    setEditingRow(null);
    setModalOpen(true);
  };

  // Ctrl+Enter (Cmd+Enter on Mac) opens "Add New Record", same as the Finance page.
  useEffect(() => {
    if (!isAdmin) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !modalOpen) {
        e.preventDefault();
        openAdd();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAdmin, modalOpen]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = !q
      ? rows
      : rows.filter(
          (r) =>
            r.debtorName.toLowerCase().includes(q) ||
            r.itemName.toLowerCase().includes(q) ||
            (r.project?.name || "").toLowerCase().includes(q) ||
            (r.referenceNumber || "").toLowerCase().includes(q) ||
            (r.lcNumber || "").toLowerCase().includes(q),
        );
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...matched].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return cmp * dir;
    });
  }, [rows, search, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const handleDelete = async (row: DebtorRow) => {
    if (!window.confirm("Delete this record and its payment history? This can't be undone.")) return;
    setDeletingId(row.id);
    try {
      await deleteMutation.mutateAsync(row.id);
    } finally {
      setDeletingId(null);
    }
  };

  // Totals are only summed across rows sharing a currency would be misleading, so show one
  // total per currency present.
  const totals = useMemo(() => {
    const byCurrency = new Map<string, { due: number; received: number; outstanding: number }>();
    for (const r of rows) {
      const t = byCurrency.get(r.currency) ?? { due: 0, received: 0, outstanding: 0 };
      t.due += r.amountDue;
      t.received += r.amountReceived;
      t.outstanding += r.outstandingBalance;
      byCurrency.set(r.currency, t);
    }
    return [...byCurrency.entries()];
  }, [rows]);

  const fmtTotals = (pick: "due" | "received" | "outstanding") =>
    totals.length === 0 ? formatCost(0) : totals.map(([c, t]) => formatCost(t[pick], c)).join(" · ");

  if (debtorsQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading debtors…</p>
      </div>
    );
  }

  const historyRow = historyId != null ? rows.find((r) => r.id === historyId) ?? null : null;

  return (
    <div className="w-full min-h-full p-6 bg-white lg:px-8 lg:py-8">
      {debtorsQuery.isError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <p className="text-[13px] text-slate-600">{getErrorMessage(debtorsQuery.error, "Failed to load debtors.")}</p>
          <button onClick={refresh} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col w-full min-w-0 gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: "Total Receivable", value: fmtTotals("due"), danger: false },
              { label: "Total Received", value: fmtTotals("received"), danger: false },
              { label: "Total Outstanding", value: fmtTotals("outstanding"), danger: totals.some(([, t]) => t.outstanding > 0) },
            ].map((c) => (
              <div key={c.label} className="p-3 bg-white border rounded-xl shadow-md border-slate-200">
                <span className="text-[11px] font-medium text-slate-500">{c.label}</span>
                <div className={`mt-2 text-[19px] font-bold leading-none tracking-tight ${c.danger ? "text-red-700" : "text-slate-900"}`}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search debtor, project, LC #, item, ref #..."
                className="pl-8 pr-3 py-2 w-64 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:bg-white transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={openAdd}
                  title="Ctrl+Enter"
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

          <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-xl shadow-sm border-slate-200">
            {filteredRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
                  <Users className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="font-semibold text-[14px] text-slate-900 mb-1">No debtors{search ? " match your search" : " yet"}</h3>
                <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                  {search ? "Try adjusting your search." : "Add a record to start tracking money owed to you."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f3f6fb]">
                      {COLUMNS.map((c) => {
                        const active = sort.key === c.key;
                        return (
                          <th
                            key={c.key}
                            onClick={() => toggleSort(c.key)}
                            className={`px-2.5 py-3 text-[11.5px] font-semibold text-slate-700 border border-slate-200 whitespace-nowrap cursor-pointer select-none ${c.align === "right" ? "text-right" : ""}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {c.label}
                              {active ? (
                                sort.dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                              ) : (
                                <ChevronsUpDown size={11} className="text-slate-400" />
                              )}
                            </span>
                          </th>
                        );
                      })}
                      {isAdmin && <th className="px-2.5 py-3 text-[11.5px] font-semibold text-slate-700 border border-slate-200 text-right whitespace-nowrap">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => {
                      const cell = "px-2.5 py-3 text-[12px] text-slate-800 border border-slate-200";
                      return (
                        <tr
                          key={r.id}
                          onClick={() => navigate(`/${organizationId}/debtors/${r.id}`)}
                          className="bg-white hover:bg-blue-50/60 cursor-pointer"
                        >
                          <td className={`${cell} font-medium`}>{r.debtorName}</td>
                          <td className={cell}>{r.project ? r.project.name : <span className="text-slate-400">--</span>}</td>
                          <td className={cell}>{r.lcNumber || <span className="text-slate-400">--</span>}</td>
                          <td className={cell} title={r.referenceNumber || undefined}>{r.itemName}</td>
                          <td className={`${cell} text-right`}>{formatCost(r.amountDue, r.currency)}</td>
                          <td className={cell}>{r.paymentTerms || "--"}</td>
                          <td className={`${cell} text-right`}>{formatCost(r.amountReceived, r.currency)}</td>
                          <td className={cell} onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setHistoryId(r.id)}
                              disabled={r.payments.length === 0}
                              className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-900 hover:underline disabled:no-underline disabled:text-slate-400"
                              title={r.payments.length === 0 ? "No payments received yet" : "View payment history"}
                            >
                              {formatDate(r.receivedDate)}
                              {r.payments.length > 0 && <History size={11} />}
                            </button>
                          </td>
                          <td className={`${cell} text-right font-medium ${r.outstandingBalance > 0 ? "text-red-700" : "text-emerald-700"}`}>
                            {formatCost(r.outstandingBalance, r.currency)}
                          </td>
                          {isAdmin && (
                            <td className={cell} onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingRow(r);
                                    setModalOpen(true);
                                  }}
                                  className="flex items-center justify-center w-7 h-7 text-slate-500 transition-colors border rounded border-slate-200 hover:bg-slate-100"
                                  title="Edit record"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  onClick={() => handleDelete(r)}
                                  disabled={deletingId === r.id}
                                  className="flex items-center justify-center w-7 h-7 text-red-600 transition-colors border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                                  title="Delete record"
                                >
                                  {deletingId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                </button>
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

      {modalOpen && <DebtorModal editingRow={editingRow} onClose={() => setModalOpen(false)} />}
      {historyRow && <HistoryModal row={historyRow} canDelete={isAdmin} onClose={() => setHistoryId(null)} />}
    </div>
  );
};

const ModalShell: React.FC<{ title: string; subtitle?: string; maxWidth?: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  subtitle,
  maxWidth = "max-w-md",
  onClose,
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
    <div className={`w-full ${maxWidth} overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200`}>
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div>
          <h3 className="text-[14px] font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500">
          <X size={16} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const FormFooter: React.FC<{ submitting: boolean; label: string; onClose: () => void }> = ({ submitting, label, onClose }) => (
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
      {label}
    </button>
  </div>
);

const ErrorBanner: React.FC<{ message: string | null }> = ({ message }) =>
  message ? <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">{message}</div> : null;

const DebtorModal: React.FC<{ editingRow: DebtorRow | null; onClose: () => void }> = ({ editingRow, onClose }) => {
  const createMutation = useCreateDebtorMutation();
  const updateMutation = useUpdateDebtorMutation();
  const projects = useProjects().data ?? [];
  const [form, setForm] = useState({
    debtorName: editingRow?.debtorName ?? "",
    projectId: editingRow?.project ? String(editingRow.project.id) : "",
    itemName: editingRow?.itemName ?? "",
    referenceNumber: editingRow?.referenceNumber ?? "",
    lcNumber: editingRow?.lcNumber ?? "",
    amountDue: editingRow ? String(editingRow.amountDue) : "",
    claimAmount: editingRow && editingRow.claimAmount ? String(editingRow.claimAmount) : "",
    currency: editingRow?.currency ?? "NPR",
    paymentTerms: editingRow?.paymentTerms ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.debtorName.trim()) return setError("Debtor name is required.");
    if (!form.itemName.trim()) return setError("Item / service is required.");
    const amountDue = parseFloat(form.amountDue);
    if (!Number.isFinite(amountDue) || amountDue < 0) return setError("Enter a valid total amount.");
    const claimAmount = form.claimAmount.trim() === "" ? 0 : parseFloat(form.claimAmount);
    if (!Number.isFinite(claimAmount) || claimAmount < 0) return setError("Enter a valid claim amount.");

    const input = {
      debtorName: form.debtorName.trim(),
      itemName: form.itemName.trim(),
      referenceNumber: form.referenceNumber.trim() || null,
      lcNumber: form.lcNumber.trim() || null,
      amountDue,
      claimAmount,
      paymentTerms: form.paymentTerms.trim() || null,
      projectId: form.projectId ? Number(form.projectId) : null,
      currency: form.currency,
    };
    setSubmitting(true);
    setError(null);
    try {
      if (editingRow) await updateMutation.mutateAsync({ id: editingRow.id, input });
      else await createMutation.mutateAsync(input);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save record."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title={editingRow ? "Edit Record" : "Add New Record"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
        <ErrorBanner message={error} />
        <div>
          <label className={labelCls}>Debtor Name</label>
          <input autoFocus value={form.debtorName} onChange={(e) => setForm({ ...form, debtorName: e.target.value })} placeholder="Customer / party name" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Project (optional)</label>
          <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className={`${inputCls} bg-white`}>
            <option value="">-- Not linked to a project --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Item / Service</label>
          <input value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Reference #</label>
            <input value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} placeholder="Optional" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>LC Number</label>
            <input value={form.lcNumber} onChange={(e) => setForm({ ...form, lcNumber: e.target.value })} placeholder="Optional" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={`${inputCls} bg-white`}>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Total Amount</label>
            <input type="number" min="0" step="any" value={form.amountDue} onChange={(e) => setForm({ ...form, amountDue: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Claim Amount</label>
            <input type="number" min="0" step="any" value={form.claimAmount} onChange={(e) => setForm({ ...form, claimAmount: e.target.value })} placeholder="Optional" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Terms of Payment</label>
          <input value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} placeholder="Optional" className={inputCls} />
        </div>
        <FormFooter submitting={submitting} label={editingRow ? "Save Changes" : "Add Record"} onClose={onClose} />
      </form>
    </ModalShell>
  );
};

const HistoryModal: React.FC<{ row: DebtorRow; canDelete: boolean; onClose: () => void }> = ({ row, canDelete, onClose }) => {
  const deleteMutation = useDeleteDebtorPaymentMutation();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (paymentId: number) => {
    if (!window.confirm("Delete this payment? This can't be undone.")) return;
    setDeletingId(paymentId);
    setError(null);
    try {
      await deleteMutation.mutateAsync({ id: row.id, paymentId });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete payment."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <ModalShell title="Payment History" subtitle={`${row.debtorName} · ${row.itemName}`} maxWidth="max-w-lg" onClose={onClose}>
      <div className="p-4">
        <ErrorBanner message={error} />
        {row.payments.length === 0 ? (
          <p className="py-8 text-[12px] text-center text-slate-400">No payments received yet.</p>
        ) : (
          <div className="overflow-y-auto divide-y max-h-80 divide-slate-100">
            {row.payments.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold text-slate-900">{formatCost(p.amount, row.currency)}</span>
                    <span className="text-[11px] text-slate-500">{formatDate(p.receivedDate)}</span>
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
          <span className="text-slate-500">Total Received</span>
          <span className="font-semibold text-slate-900">{formatCost(row.amountReceived, row.currency)}</span>
        </div>
      </div>
    </ModalShell>
  );
};

export default Debtors;
