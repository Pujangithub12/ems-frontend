import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, Search, RefreshCw, Loader2, AlertCircle, History, Plus, Pencil, Trash2, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { FinancePurchaseOrderRow } from "../../../types";
import { useFinanceOverviewQuery, useDeleteFinanceManualRecordMutation } from "../hooks/useFinance";
import PaymentHistoryModal from "../components/PaymentHistoryModal";
import ManualRecordModal from "../components/ManualRecordModal";
import { formatCost } from "../../../lib/currency";
import { getErrorMessage } from "../../../lib/errors";

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "--";

const rowKey = (r: FinancePurchaseOrderRow) => `${r.source}-${r.source === "po" ? r.poId : r.manualRecordId}`;

type SortKey = "vendor" | "project" | "lcNumber" | "itemProcure" | "itemValue" | "paymentTerms" | "amountPaid" | "paidDate" | "outstandingBalance";

const COLUMNS: { key: SortKey; label: string; sortable?: boolean; align?: "right" }[] = [
  { key: "vendor", label: "Vendor", sortable: true },
  { key: "project", label: "Project", sortable: true },
  { key: "lcNumber", label: "LC Number", sortable: true },
  { key: "itemProcure", label: "Item Procure", sortable: true },
  { key: "itemValue", label: "Item Value", sortable: true, align: "right" },
  { key: "paymentTerms", label: "Terms of Payment", sortable: true },
  { key: "amountPaid", label: "Amount Paid", sortable: true, align: "right" },
  { key: "paidDate", label: "Paid Date", sortable: true },
  { key: "outstandingBalance", label: "Outstanding Balance", sortable: true, align: "right" },
];

const sortValue = (r: FinancePurchaseOrderRow, key: SortKey): string | number => {
  switch (key) {
    case "vendor":
      return r.vendorName || r.vendor?.name || "";
    case "project":
      return r.project?.name || "";
    case "lcNumber":
      return r.lcNumber || "";
    case "itemProcure":
      return r.itemNames[0] || r.poNumber || "";
    case "itemValue":
      return r.itemValue;
    case "paymentTerms":
      return r.paymentTerms || "";
    case "amountPaid":
      return r.amountPaid;
    case "paidDate":
      return r.paidDate || "";
    case "outstandingBalance":
      return r.outstandingBalance;
  }
};

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

  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "paidDate", dir: "desc" });
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
    const matched = !q
      ? rows
      : rows.filter(
          (r) =>
            (r.poNumber || "").toLowerCase().includes(q) ||
            (r.vendorName || r.vendor?.name || "").toLowerCase().includes(q) ||
            (r.project?.name || "").toLowerCase().includes(q) ||
            (r.lcNumber || "").toLowerCase().includes(q) ||
            r.itemNames.some((n) => n.toLowerCase().includes(q)),
        );
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...matched].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return cmp !== 0 ? cmp * dir : 0;
    });
  }, [rows, search, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const openAddRecord = () => {
    setEditingManualRow(null);
    setManualModalOpen(true);
  };

  // Ctrl+Enter (Cmd+Enter on Mac) is the keyboard shortcut for the "Add New Record" button —
  // opens the same modal, wherever focus is on the page.
  useEffect(() => {
    if (!isAdmin) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !manualModalOpen) {
        e.preventDefault();
        openAddRecord();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, manualModalOpen]);

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
                  placeholder="Search PO#, vendor, project, LC #, item..."
                  className="pl-8 pr-3 py-2 w-64 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:bg-white transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={openAddRecord}
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
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f3f6fb]">
                      {COLUMNS.map((c) => {
                        const active = c.sortable && sort.key === c.key;
                        return (
                          <th
                            key={c.key}
                            onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                            className={`px-2.5 py-3 text-[11.5px] font-semibold text-slate-700 border border-slate-200 whitespace-nowrap ${
                              c.align === "right" ? "text-right" : ""
                            } ${c.sortable ? "cursor-pointer select-none" : ""}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {c.label}
                              {c.sortable &&
                                (active ? (
                                  sort.dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                                ) : (
                                  <ChevronsUpDown size={11} className="text-slate-400" />
                                ))}
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
                        key={rowKey(r)}
                        onClick={() => navigate(`/${organizationId}/finance/records/${r.source}/${r.source === "po" ? r.poId : r.manualRecordId}`)}
                        className="bg-white hover:bg-blue-50/60 cursor-pointer"
                      >
                        <td className={cell} onClick={(e) => r.vendor && e.stopPropagation()}>
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
                        <td className={cell}>{r.project ? r.project.name : <span className="text-slate-400">--</span>}</td>
                        <td className={cell}>{r.lcNumber || <span className="text-slate-400">--</span>}</td>
                        <td className={cell} onClick={(e) => r.source === "po" && e.stopPropagation()}>
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
                        <td className={`${cell} text-right`}>
                          {formatCost(r.itemValue, r.currency)}
                          {r.currency && r.currency !== "NPR" && <span className="ml-1 text-[10px] text-slate-400">{r.currency}</span>}
                        </td>
                        <td className={`${cell} whitespace-pre-line`}>{r.paymentTerms || "--"}</td>
                        <td className={`${cell} text-right`}>
                          {formatCost(r.amountPaid, r.currency)}
                        </td>
                        <td className={cell} onClick={(e) => e.stopPropagation()}>
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
                        <td className={`${cell} text-right font-medium ${r.outstandingBalance > 0 ? "text-red-700" : "text-emerald-700"}`}>
                          {formatCost(r.outstandingBalance, r.currency)}
                        </td>
                        {isAdmin && (
                          <td className={cell} onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
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

export default FinancePage;
