import React, { useMemo, useState } from "react";
import { AlertCircle, ClipboardList, Eye, Loader2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import PdfPreviewModal from "../components/PdfPreviewModal";
import RequisitionFormModal, { blankRequisitionForm } from "../components/RequisitionFormModal";
import { preloadPdfFonts } from "../pdf/pdfFonts";
import { getErrorMessage } from "../../../lib/errors";
import { useRequisitionsQuery, useDeleteRequisitionMutation } from "../hooks/useRequisitions";
import type { RequisitionRecord } from "../api/requisition.api";

// The PDF is drawn in the browser (see ../pdf/generatePdf.ts): warm the fonts and the (lazy)
// pdfkit chunk in the background so "Preview PDF" opens without waiting on either.
preloadPdfFonts();
void import("../pdf/generatePdf");

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "--";
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Requisitions — every saved purchase requisition in a table (like the Purchase Orders page). Clicking
 * a row opens its form in a popup with the full details; "New Requisition" opens the same form blank.
 */
const Requisition: React.FC = () => {
  const { organization } = useAuth();
  const requisitionsQuery = useRequisitionsQuery();
  const deleteMutation = useDeleteRequisitionMutation();
  const rows = requisitionsQuery.data ?? [];

  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  // `null` = nothing open; `{ record: null }` = a new requisition; otherwise the saved one being viewed/edited.
  const [editing, setEditing] = useState<{ record: RequisitionRecord | null } | null>(null);
  const [previewing, setPreviewing] = useState<RequisitionRecord | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const orgDetails = {
    name: organization?.name ?? "Purchase Requisition",
    address: organization?.address,
    contact: organization?.contact,
    email: organization?.email,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.requisitionNo, r.requestedBy, r.data.projectLocation, r.createdByName, r.priority].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const refresh = async () => {
    setRefreshing(true);
    await requisitionsQuery.refetch();
    setRefreshing(false);
  };

  const handleDelete = async (rec: RequisitionRecord) => {
    if (!window.confirm(`Delete requisition ${rec.requisitionNo || `#${rec.id}`}? This can't be undone.`)) return;
    setDeletingId(rec.id);
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(rec.id);
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to delete the requisition."));
    } finally {
      setDeletingId(null);
    }
  };

  if (requisitionsQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading requisitions…</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-white">
      {requisitionsQuery.isError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex items-center justify-center w-12 h-12 mb-1 rounded-full bg-gradient-to-br from-red-50 to-red-100 ring-1 ring-red-100">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-[13px] text-slate-600">{getErrorMessage(requisitionsQuery.error, "Failed to load requisitions.")}</p>
          <button onClick={refresh} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Retry
          </button>
        </div>
      ) : (
        <div className="p-6 lg:px-8 lg:py-8">
          <div className="flex flex-col w-full min-w-0 gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-blue-900 rounded-full bg-blue-50">
                  <ClipboardList size={16} />
                </div>
                <div>
                  <h2 className="text-[17px] font-semibold text-slate-900">Requisitions</h2>
                  <p className="text-[12px] text-slate-500">Click a requisition to see its details, or create a new one.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search no., requested by, location..."
                    className="pl-8 pr-3 py-2 w-64 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:bg-white transition-colors"
                  />
                </div>
                <button
                  onClick={refresh}
                  className="flex items-center justify-center w-8 h-8 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
                  title="Refresh"
                >
                  <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={() => setEditing({ record: null })}
                  className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 transition-colors"
                >
                  <Plus size={14} /> New Requisition
                </button>
              </div>
            </div>

            {actionError && (
              <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">{actionError}</div>
            )}

            <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
                    <ClipboardList className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-[14px] text-slate-900 mb-1">No requisitions{search ? " match your search" : " yet"}</h3>
                  <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                    {search ? "Try a different search." : 'Click "New Requisition" to create your first one.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                        <th className="px-3 py-2 font-medium text-left">Requisition No.</th>
                        <th className="px-3 py-2 font-medium text-left">Date</th>
                        <th className="px-3 py-2 font-medium text-left">Requested By</th>
                        <th className="px-3 py-2 font-medium text-left">Project Location</th>
                        <th className="px-3 py-2 font-medium text-left">Priority</th>
                        <th className="px-3 py-2 font-medium text-left">Items</th>
                        <th className="px-3 py-2 font-medium text-left">Created By</th>
                        <th className="px-3 py-2 font-medium text-left">Saved</th>
                        <th className="px-3 py-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((rec) => (
                        <tr
                          key={rec.id}
                          onClick={() => setEditing({ record: rec })}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                        >
                          <td className="px-3 py-3 font-medium text-slate-800 whitespace-nowrap">{rec.requisitionNo || `#${rec.id}`}</td>
                          <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{fmtDate(rec.requisitionDate)}</td>
                          <td className="px-3 py-3 text-slate-600">{rec.requestedBy || "--"}</td>
                          <td className="px-3 py-3 text-slate-600">{rec.data.projectLocation || "--"}</td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {rec.priority === "urgent" ? (
                              <span className="font-medium text-red-600">Urgent</span>
                            ) : rec.priority === "normal" ? (
                              <span className="text-slate-600">Normal</span>
                            ) : (
                              "--"
                            )}
                          </td>
                          <td className="px-3 py-3 text-slate-600">{rec.itemCount}</td>
                          <td className="px-3 py-3 text-slate-600">{rec.createdByName || "--"}</td>
                          <td className="px-3 py-3 text-[11px] text-slate-500 whitespace-nowrap">
                            {fmtDateTime(rec.createdAt)}
                            {rec.updatedAt !== rec.createdAt && <div className="text-slate-400">edited {fmtDateTime(rec.updatedAt)}</div>}
                          </td>
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setPreviewing(rec)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-900 border border-slate-200 rounded hover:bg-slate-50"
                              >
                                <Eye size={12} /> PDF
                              </button>
                              <button
                                onClick={() => handleDelete(rec)}
                                disabled={deletingId === rec.id}
                                className="flex items-center justify-center w-7 h-7 text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                                title="Delete"
                              >
                                {deletingId === rec.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <RequisitionFormModal
          key={editing.record?.id ?? "new"}
          record={editing.record}
          onClose={() => {
            setEditing(null);
            // The requisition may have been created or edited in the popup — reload the table.
            void requisitionsQuery.refetch();
          }}
        />
      )}

      {previewing && (
        <PdfPreviewModal
          generate={() => import("../pdf/generatePdf").then((m) => m.generateRequisitionPdf({ ...blankRequisitionForm(), ...previewing.data }, orgDetails))}
          fileName={`Requisition-${(previewing.requisitionNo || `#${previewing.id}`).replace(/[\\/]/g, "-")}.pdf`}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
};

export default Requisition;
