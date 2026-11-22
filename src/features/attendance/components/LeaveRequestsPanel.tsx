import React, { useMemo, useState } from "react";
import { AlertCircle, CalendarDays, CheckCircle2, Loader2, Plus, X, XCircle } from "lucide-react";
import { getErrorMessage } from "../../../lib/errors";
import { useCreateLeaveRequest, useLeaveRequests } from "../../approvals/hooks/useLeaveRequests";
import { useLeaveActions } from "../hooks/useLeaveActions";

type Filter = "all" | "pending" | "approved" | "rejected";

const inputCls = "w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 transition-colors";
const labelCls = "block mb-1 text-[11px] font-medium text-slate-900";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Leave requests (used to live on the Approvals page). Everyone can apply for leave; admins / super admins approve
 * or reject — a plain admin only for the people who report to them in the org chart, a super admin for everyone,
 * exactly as before.
 */
const LeaveRequestsPanel: React.FC = () => {
  const leaveQuery = useLeaveRequests();
  const createLeave = useCreateLeaveRequest();
  const { canManage, canActOn, setStatus: updateStatus, isPending: statusPending } = useLeaveActions();

  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const requests = useMemo(
    () => [...(leaveQuery.data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [leaveQuery.data],
  );
  const counts = useMemo(
    () => ({
      all: requests.filter((r) => r.status !== "rejected").length,
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
    }),
    [requests],
  );
  const shown = useMemo(
    () => requests.filter((r) => (filter === "all" ? r.status !== "rejected" : r.status === filter)),
    [requests, filter],
  );

  const closeForm = () => {
    setShowForm(false);
    setFormError(null);
    setTitle("");
    setStartDate("");
    setEndDate("");
    setReason("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (endDate < startDate) {
      setFormError("The end date can't be before the start date.");
      return;
    }
    try {
      await createLeave.mutateAsync({ title, startDate, endDate, reason });
      closeForm();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to submit the leave request."));
    }
  };

  const setStatus = async (id: number, status: "approved" | "rejected") => {
    setActionError(null);
    try {
      await updateStatus(id, status);
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to update the request."));
    }
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium border rounded-lg transition-colors ${
                filter === f.key ? "bg-blue-900 border-blue-900 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
              <span className={`px-1.5 rounded-full text-[10px] ${filter === f.key ? "bg-white/20" : f.key === "pending" && counts.pending ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"}`}>
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800"
        >
          <Plus size={13} /> New Leave Request
        </button>
      </div>

      {actionError && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">{actionError}</div>}

      <div className="overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
        {leaveQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
            <p className="text-[12px] text-slate-400">Loading leave requests…</p>
          </div>
        ) : leaveQuery.isError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <p className="text-[13px] text-slate-600">{getErrorMessage(leaveQuery.error, "Failed to load leave requests.")}</p>
            <button onClick={() => void leaveQuery.refetch()} className="mt-1 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50">
              Retry
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
              <CalendarDays className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="font-semibold text-[14px] text-slate-900 mb-1">No leave requests</h3>
            <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
              {filter === "rejected" ? "No rejected requests." : canManage ? "There are no leave requests to review." : "You haven't applied for any leave yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium text-left">Employee</th>
                  <th className="px-3 py-2 font-medium text-left">Request</th>
                  <th className="px-3 py-2 font-medium text-left">Dates</th>
                  <th className="px-3 py-2 font-medium text-left">Reason</th>
                  <th className="px-3 py-2 font-medium text-left">Status</th>
                  <th className="px-3 py-2 font-medium text-left">Requested</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const actionable = r.status === "pending" && canActOn(r.user?.id);
                  return (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="px-3 py-3 font-medium text-slate-800 whitespace-nowrap">{r.user?.fullName ?? "You"}</td>
                      <td className="px-3 py-3 text-slate-700">{r.title}</td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                        {fmt(r.startDate)} – {fmt(r.endDate)}
                      </td>
                      <td className="px-3 py-3 text-slate-500 max-w-[260px] truncate" title={r.reason}>
                        {r.reason}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium capitalize ${STATUS_STYLE[r.status] ?? STATUS_STYLE.pending}`}>{r.status}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{fmt(r.createdAt)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {actionable && (
                            <>
                              <button
                                onClick={() => void setStatus(r.id, "approved")}
                                disabled={statusPending}
                                className="flex items-center justify-center w-7 h-7 bg-white border rounded-lg border-slate-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                title="Approve"
                              >
                                <CheckCircle2 size={14} />
                              </button>
                              <button
                                onClick={() => void setStatus(r.id, "rejected")}
                                disabled={statusPending}
                                className="flex items-center justify-center w-7 h-7 text-red-700 bg-white border rounded-lg border-slate-200 hover:bg-red-50 disabled:opacity-50"
                                title="Reject"
                              >
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={closeForm}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-[15px] font-semibold text-slate-900">New Leave Request</h3>
              <button type="button" onClick={closeForm} className="p-1 rounded hover:bg-slate-100 text-slate-500" title="Close">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-4 p-5">
              {formError && (
                <div className="flex items-center gap-2 p-3 text-[13px] text-red-700 border border-red-100 rounded bg-red-50">
                  <AlertCircle className="flex-shrink-0 w-4 h-4" /> <span>{formError}</span>
                </div>
              )}
              <div>
                <label className={labelCls}>Title</label>
                <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g., Annual Vacation" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Start Date</label>
                  <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>End Date</label>
                  <input required type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Reason</label>
                <textarea required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} resize-none`} placeholder="Briefly explain the reason for your leave..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/60">
              <button type="button" onClick={closeForm} className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createLeave.isPending}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-70"
              >
                {createLeave.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Submit Application
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default LeaveRequestsPanel;
