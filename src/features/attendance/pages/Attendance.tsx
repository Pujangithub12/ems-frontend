import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Save, Search, Share2, ShieldCheck, Trash2, X, XCircle } from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { getErrorMessage } from "../../../lib/errors";
import type { AttendanceCounts, AttendancePerson, AttendanceStatus } from "../api/attendance.api";
import ExportMenu from "../../procurement/components/ExportMenu";
import LeaveRequestsPanel from "../components/LeaveRequestsPanel";
import { useLeaveRequests } from "../../approvals/hooks/useLeaveRequests";
import type { LeaveRequest } from "../../approvals/api/leaveRequests.api";
import { useLeaveActions } from "../hooks/useLeaveActions";
import { downloadBlob } from "../../../lib/download";
import {
  useAttendanceAccessQuery,
  useAttendanceDayQuery,
  useAttendancePermissionsQuery,
  useAttendanceSummaryQuery,
  useDeleteAttendanceEmployeeMutation,
  useSaveAttendanceAccessMutation,
  useSaveAttendanceEmployeeMutation,
  useSaveAttendanceMutation,
  useAttendanceSharingQuery,
  useShareAttendanceMutation,
  useStopSharingAttendanceMutation,
} from "../hooks/useAttendance";

type StatusMeta = { key: AttendanceStatus; label: string; /** classes when selected */ on: string; /** text colour for counts */ text: string; pill: string };

const STATUSES: StatusMeta[] = [
  { key: "present", label: "Present", on: "bg-emerald-600 border-emerald-600 text-white", text: "text-emerald-700", pill: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "absent", label: "Absent", on: "bg-red-600 border-red-600 text-white", text: "text-red-700", pill: "bg-red-50 text-red-700 border-red-200" },
  { key: "on_leave", label: "On Leave", on: "bg-violet-600 border-violet-600 text-white", text: "text-violet-700", pill: "bg-violet-50 text-violet-700 border-violet-200" },
  { key: "site_visit", label: "Site Visit", on: "bg-sky-600 border-sky-600 text-white", text: "text-sky-700", pill: "bg-sky-50 text-sky-700 border-sky-200" },
];
const STATUS_BY_KEY = Object.fromEntries(STATUSES.map((s) => [s.key, s])) as Record<AttendanceStatus, StatusMeta>;

const inputCls = "px-3 py-2 text-[12px] bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400";

// ---- date helpers (all plain "YYYY-MM-DD" / "YYYY-MM" strings, in the browser's local calendar) ----
const todayStr = () => new Date().toLocaleDateString("en-CA");
const thisMonth = () => todayStr().slice(0, 7);
const shiftDay = (day: string, delta: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d! + delta).toLocaleDateString("en-CA");
};
const prettyDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short", year: "numeric" });
};
const shortDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
};

const StatusPill: React.FC<{ status: AttendanceStatus }> = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${STATUS_BY_KEY[status].pill}`}>{STATUS_BY_KEY[status].label}</span>
);

const CountChip: React.FC<{ label: string; value: number; className?: string }> = ({ label, value, className = "text-slate-700" }) => (
  <div className="px-3 py-2 bg-white border rounded-lg border-slate-200">
    <p className="text-[11px] text-slate-500">{label}</p>
    <p className={`text-[18px] font-semibold leading-tight ${className}`}>{value}</p>
  </div>
);

const LoadingBlock: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16">
    <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
    <p className="text-[12px] text-slate-400">{text}</p>
  </div>
);

const ErrorBlock: React.FC<{ error: unknown; fallback: string; onRetry: () => void }> = ({ error, fallback, onRetry }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
    <AlertCircle className="w-6 h-6 text-red-600" />
    <p className="text-[13px] text-slate-600">{getErrorMessage(error, fallback)}</p>
    <button onClick={onRetry} className="mt-1 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50">
      Retry
    </button>
  </div>
);

// =====================================================================================
// Take attendance (admin / super admin)
// =====================================================================================

type Draft = Record<number, { status: AttendanceStatus | ""; note: string }>;

/** `canEdit` false = view-only: the table is shown but nothing on it can be changed. */
const TakeAttendanceTab: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const [date, setDate] = useState(todayStr);
  const dayQuery = useAttendanceDayQuery(date);
  const saveMutation = useSaveAttendanceMutation();
  const [draft, setDraft] = useState<Draft>({});
  const [baseline, setBaseline] = useState("");
  const [search, setSearch] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  // `{ person: null }` = adding a new employee; otherwise editing that one.
  const [personModal, setPersonModal] = useState<{ person: AttendancePerson | null } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const leaveQuery = useLeaveRequests();
  const leaveActions = useLeaveActions();
  const deleteEmployee = useDeleteAttendanceEmployeeMutation();
  const [actionError, setActionError] = useState<string | null>(null);

  const employees = dayQuery.data?.date === date ? dayQuery.data.employees : [];
  const dirty = JSON.stringify(draft) !== baseline;

  // Load a day's saved marks into the editable draft — but never overwrite edits that haven't been saved
  // (e.g. when the browser refetches in the background after the tab regains focus).
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    const data = dayQuery.data;
    if (!data || data.date !== date) return;
    if (loadedFor.current === date && dirtyRef.current) return;
    const next: Draft = Object.fromEntries(data.employees.map((e) => [e.id, { status: e.status ?? "", note: e.note ?? "" }]));
    setDraft(next);
    setBaseline(JSON.stringify(next));
    loadedFor.current = date;
  }, [dayQuery.data, date]);

  // Leaving or refreshing the page with unsaved marks asks for confirmation first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const changeDate = (next: string) => {
    if (!next || next === date || next > todayStr()) return;
    if (dirty && !window.confirm("You have unsaved attendance for this day. Discard it?")) return;
    loadedFor.current = null;
    setSaveError(null);
    setJustSaved(false);
    setDate(next);
  };

  const setStatus = (id: number, status: AttendanceStatus) => {
    setJustSaved(false);
    setDraft((d) => ({ ...d, [id]: { status: d[id]?.status === status ? "" : status, note: d[id]?.note ?? "" } }));
  };
  const markAllPresent = () => {
    setJustSaved(false);
    setDraft((d) => Object.fromEntries(employees.map((e) => [e.id, { status: "present" as const, note: d[e.id]?.note ?? "" }])));
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      await saveMutation.mutateAsync({
        date,
        records: employees.map((e) => ({ employeeId: e.id, status: draft[e.id]?.status ?? "", note: draft[e.id]?.note ?? "" })),
      });
      setBaseline(JSON.stringify(draft));
      setJustSaved(true);
    } catch (err) {
      setSaveError(getErrorMessage(err, "Failed to save attendance."));
    }
  };

  const handleDeleteEmployee = async (e: AttendancePerson) => {
    if (!window.confirm(`Remove ${e.name}? All of their attendance marks will be deleted too. This can't be undone.`)) return;
    setActionError(null);
    try {
      await deleteEmployee.mutateAsync(e.id);
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to remove the employee."));
    }
  };

  // Leave requests that cover the selected day (rejected ones are hidden), grouped by the requester's name. Employees are
  // typed-in names rather than user accounts, so an employee is matched to a request by name.
  const nameKey = (n: string) => n.trim().toLowerCase();
  const leaveByName = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();
    for (const r of leaveQuery.data ?? []) {
      if (r.status === "rejected" || !r.user?.fullName) continue;
      if (r.startDate.slice(0, 10) > date || r.endDate.slice(0, 10) < date) continue;
      const key = nameKey(r.user.fullName);
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return map;
  }, [leaveQuery.data, date]);
  const pendingLeaveCount = (leaveQuery.data ?? []).filter((r) => r.status === "pending").length;

  const handleLeaveStatus = async (id: number, status: "approved" | "rejected") => {
    setActionError(null);
    try {
      await leaveActions.setStatus(id, status);
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to update the leave request."));
    }
  };

  const counts = useMemo(() => {
    const c: AttendanceCounts & { unmarked: number } = { present: 0, absent: 0, on_leave: 0, site_visit: 0, unmarked: 0 };
    for (const e of employees) {
      const s = draft[e.id]?.status;
      if (s) c[s] += 1;
      else c.unmarked += 1;
    }
    return c;
  }, [employees, draft]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? employees.filter((e) => e.name.toLowerCase().includes(q) || (e.position ?? "").toLowerCase().includes(q) || (e.company ?? "").toLowerCase().includes(q)) : employees;
  }, [employees, search]);

  const isToday = date === todayStr();

  return (
    <div className="flex flex-col gap-4">
      {/* Date picker */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => changeDate(shiftDay(date, -1))} className="flex items-center justify-center w-8 h-8 border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50" title="Previous day">
            <ChevronLeft size={14} />
          </button>
          <input type="date" value={date} max={todayStr()} onChange={(e) => changeDate(e.target.value)} className={inputCls} />
          <button
            onClick={() => changeDate(shiftDay(date, 1))}
            disabled={isToday}
            className="flex items-center justify-center w-8 h-8 border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50 disabled:opacity-40"
            title="Next day"
          >
            <ChevronRight size={14} />
          </button>
          {!isToday && (
            <button onClick={() => changeDate(todayStr())} className="px-3 py-2 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50">
              Today
            </button>
          )}
          <span className="text-[13px] font-medium text-slate-700">{prettyDay(date)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[12px] ${saveError ? "text-red-600" : dirty ? "text-amber-600" : justSaved ? "text-emerald-600" : "text-slate-400"}`}>
            {saveError ?? (dirty ? "Unsaved changes" : justSaved ? "Attendance saved" : "")}
          </span>
          {canEdit ? (
            <button
              onClick={handleSave}
              disabled={!dirty || saveMutation.isPending || employees.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : dirty ? <Save size={14} /> : <Check size={14} />} Save Attendance
            </button>
          ) : (
            <span className="px-3 py-1.5 text-[12px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-full" title="Ask a super admin for edit access">
              View only
            </span>
          )}
          <button
            onClick={() => setLeaveOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <CalendarDays size={14} /> Leave Requests
            {pendingLeaveCount > 0 && <span className="px-1.5 py-0.5 text-[10px] text-red-700 bg-red-50 rounded-full">{pendingLeaveCount}</span>}
          </button>
        </div>
      </div>

      {dayQuery.isLoading || (dayQuery.isFetching && dayQuery.data?.date !== date) ? (
        <LoadingBlock text="Loading employees…" />
      ) : dayQuery.isError ? (
        <ErrorBlock error={dayQuery.error} fallback="Failed to load attendance." onRetry={() => void dayQuery.refetch()} />
      ) : (
        <>
          {/* Counts */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {STATUSES.map((s) => (
              <CountChip key={s.key} label={s.label} value={counts[s.key]} className={s.text} />
            ))}
            <CountChip label="Not marked" value={counts.unmarked} />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee..." className={`${inputCls} w-64 pl-8 bg-slate-50`} />
            </div>
            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPersonModal({ person: null })}
                  className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800"
                >
                  <Plus size={13} /> Add Employee
                </button>
                <button
                  onClick={() => setShareOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50"
                  title="Share this attendance with another organization"
                >
                  <Share2 size={13} /> Share
                </button>
                <button onClick={markAllPresent} className="px-3 py-2 text-[12px] font-medium text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50">
                  Mark all present
                </button>
              </div>
            )}
          </div>

          {actionError && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">{actionError}</div>}

          {/* Employees */}
          <div className="overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-center">
                <p className="text-[13px] text-slate-500">
                  {employees.length === 0
                    ? canEdit
                      ? "No employees added yet. Add the people you take attendance for."
                      : "No employees have been added yet."
                    : "No employee matches your search."}
                </p>
                {employees.length === 0 && canEdit && (
                  <button
                    onClick={() => setPersonModal({ person: null })}
                    className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800"
                  >
                    <Plus size={13} /> Add Employee
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                      <th className="w-10 px-3 py-2 font-medium text-left">#</th>
                      <th className="px-3 py-2 font-medium text-left">Employee</th>
                      <th className="px-3 py-2 font-medium text-left">Company</th>
                      <th className="px-3 py-2 font-medium text-left">Status</th>
                      <th className="px-3 py-2 font-medium text-left">Approval</th>
                      {canEdit && <th className="w-20 px-3 py-2 font-medium text-right">Edit</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e, idx) => {
                      const current = draft[e.id]?.status ?? "";
                      return (
                        <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                          <td className="px-3 py-2.5 text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <p className="text-[13px] font-medium text-slate-800">{e.name}</p>
                            {e.position && <p className="text-[11px] text-slate-400">{e.position}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{e.company || <span className="text-slate-300">--</span>}</td>
                          <td className="px-3 py-2.5">
                            {canEdit ? (
                              <div className="flex flex-wrap gap-1.5">
                                {STATUSES.map((s) => (
                                  <button
                                    key={s.key}
                                    type="button"
                                    onClick={() => setStatus(e.id, s.key)}
                                    className={`px-2.5 py-1 text-[11.5px] font-medium border rounded-lg transition-colors ${
                                      current === s.key ? s.on : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                    }`}
                                  >
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            ) : current ? (
                              <StatusPill status={current} />
                            ) : (
                              <span className="text-slate-300">Not marked</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 min-w-[170px]">
                            {(leaveByName.get(nameKey(e.name)) ?? []).length === 0 ? (
                              <span className="text-slate-300">--</span>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {(leaveByName.get(nameKey(e.name)) ?? []).map((r) => (
                                  <div key={r.id} className="flex items-center gap-1.5">
                                    <span
                                      title={`${r.title} · ${new Date(r.startDate).toLocaleDateString("en-GB")} – ${new Date(r.endDate).toLocaleDateString("en-GB")}${r.reason ? ` · ${r.reason}` : ""}`}
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium capitalize ${
                                        r.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                                      }`}
                                    >
                                      Leave {r.status}
                                    </span>
                                    {r.status === "pending" && leaveActions.canActOn(r.user?.id) && (
                                      <>
                                        <button
                                          onClick={() => void handleLeaveStatus(r.id, "approved")}
                                          disabled={leaveActions.isPending}
                                          className="flex items-center justify-center w-7 h-7 bg-white border rounded-lg border-slate-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                          title="Approve leave"
                                        >
                                          <CheckCircle2 size={14} />
                                        </button>
                                        <button
                                          onClick={() => void handleLeaveStatus(r.id, "rejected")}
                                          disabled={leaveActions.isPending}
                                          className="flex items-center justify-center w-7 h-7 text-red-700 bg-white border rounded-lg border-slate-200 hover:bg-red-50 disabled:opacity-50"
                                          title="Reject leave"
                                        >
                                          <XCircle size={14} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          {canEdit && (
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setPersonModal({ person: { id: e.id, name: e.name, position: e.position, company: e.company } })}
                                className="p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-blue-900"
                                title="Edit employee"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => void handleDeleteEmployee(e)}
                                disabled={deleteEmployee.isPending}
                                className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                title="Remove employee"
                              >
                                <Trash2 size={13} />
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
        </>
      )}

      {personModal && <EmployeeModal person={personModal.person} onClose={() => setPersonModal(null)} />}
      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}
      {leaveOpen && <LeaveRequestsModal onClose={() => setLeaveOpen(false)} />}
    </div>
  );
};

/**
 * Live sharing: organizations on the same list see — and can edit — the very same employees and attendance. Shows who
 * the list is shared with (with a Stop / Leave button) and lets you add more of your organizations.
 */
const ShareModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { organization } = useAuth();
  const sharingQuery = useAttendanceSharingQuery();
  const shareMutation = useShareAttendanceMutation();
  const stopMutation = useStopSharingAttendanceMutation();
  const sharing = sharingQuery.data;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    setError(null);
    setNotice(null);
    try {
      const results = await shareMutation.mutateAsync(Array.from(selected));
      const failed = results.filter((r) => !r.shared);
      const ok = results.filter((r) => r.shared);
      if (ok.length) setNotice(`Now shared with ${ok.map((r) => r.organizationName).join(", ")}.`);
      if (failed.length) setError(failed.map((r) => `${r.organizationName}: ${r.error}`).join(" "));
      setSelected(new Set());
    } catch (err) {
      setError(getErrorMessage(err, "Failed to share attendance."));
    }
  };

  const stop = async (id: number, name: string, leaving: boolean) => {
    const message = leaving
      ? `Stop using ${name}'s attendance list? ${organization?.name ?? "This organization"} will go back to its own list (which may be empty).`
      : `Stop sharing with ${name}? They will go back to their own attendance list.`;
    if (!window.confirm(message)) return;
    setError(null);
    setNotice(null);
    try {
      await stopMutation.mutateAsync(id);
      setNotice("Sharing stopped.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to stop sharing."));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-[14px] font-semibold text-slate-900">Share attendance</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4 overflow-y-auto max-h-[70vh]">
          {error && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>}
          {notice && <div className="px-3 py-2 text-[12px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded">{notice}</div>}

          {sharingQuery.isLoading ? (
            <LoadingBlock text="Loading…" />
          ) : sharingQuery.isError || !sharing ? (
            <ErrorBlock error={sharingQuery.error} fallback="Failed to load sharing." onRetry={() => void sharingQuery.refetch()} />
          ) : (
            <>
              <p className="text-[12px] text-slate-500">
                Organizations that share attendance use <strong>one list</strong>: the same employees and the same marks. Anyone who is an admin in any of them can add
                employees and take attendance, and everyone sees it straight away.
              </p>

              {sharing.linked.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold tracking-wide uppercase text-slate-500">
                    {sharing.role === "member" ? "Using the list shared by" : "Shared with"}
                  </p>
                  <div className="border divide-y rounded-lg divide-slate-100 border-slate-200">
                    {sharing.linked.map((o) => {
                      // The owner can remove anyone; a member can only leave (i.e. unlink itself, shown on the owner's row).
                      const canStop = sharing.role !== "member" || o.isOwner;
                      return (
                        <div key={o.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <span className="text-[13px] text-slate-800">
                            {o.name}
                            {o.isOwner && <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium text-blue-900 bg-blue-50 rounded-full">owner</span>}
                          </span>
                          {canStop && (
                            <button
                              onClick={() => void stop(sharing.role === "member" ? (organization?.id ?? 0) : o.id, o.name, sharing.role === "member")}
                              disabled={stopMutation.isPending}
                              className="px-2 py-1 text-[11.5px] font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                            >
                              {sharing.role === "member" ? "Leave" : "Stop sharing"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide uppercase text-slate-500">Share with another organization</p>
                {sharing.candidates.length === 0 ? (
                  <p className="py-3 text-[12px] text-slate-400">No other organization is available. You need to be an admin of an organization that isn&apos;t already sharing.</p>
                ) : (
                  <>
                    <div className="overflow-y-auto border divide-y rounded-lg max-h-48 divide-slate-100 border-slate-200">
                      {sharing.candidates.map((o) => (
                        <label key={o.id} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
                          <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} className="w-4 h-4 mt-0.5 accent-blue-900" />
                          <span>
                            <span className="text-[13px] text-slate-800">{o.name}</span>
                            {o.hasOwnData && (
                              <span className="block text-[11px] text-amber-700">Has its own attendance list — it stays saved but is hidden while shared.</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={submit}
                      disabled={selected.size === 0 || shareMutation.isPending}
                      className="flex items-center gap-1.5 mt-3 px-4 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 disabled:opacity-60"
                    >
                      {shareMutation.isPending && <Loader2 size={12} className="animate-spin" />} Share
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end px-4 py-3 border-t border-slate-100 bg-slate-50/60">
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

/** Super admins choose who may edit attendance. Everyone else who can see the page (admins and the people listed here) only views it. */
const AccessModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const accessQuery = useAttendanceAccessQuery();
  const saveMutation = useSaveAttendanceAccessMutation();
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const members = accessQuery.data ?? [];
  // Start from whoever can edit now; edits are kept locally until Save.
  const current = selected ?? new Set(members.filter((m) => m.canEdit).map((m) => m.id));

  const toggle = (id: number) => {
    setSaved(false);
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const save = async () => {
    setError(null);
    try {
      await saveMutation.mutateAsync(Array.from(current));
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save access."));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-[14px] font-semibold text-slate-900">Attendance access</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" title="Close">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {error && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>}
          <p className="text-[12px] text-slate-500">
            Super admins can always edit. Tick the other people who may take attendance and manage the employee list. Admins and anyone ticked can view the page; everyone else can only
            view what they are allowed to see.
          </p>
          {accessQuery.isLoading ? (
            <LoadingBlock text="Loading members…" />
          ) : accessQuery.isError ? (
            <ErrorBlock error={accessQuery.error} fallback="Failed to load members." onRetry={() => void accessQuery.refetch()} />
          ) : members.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-slate-400">There are no other members in this organization.</p>
          ) : (
            <div className="overflow-y-auto border divide-y rounded-lg max-h-72 divide-slate-100 border-slate-200">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={current.has(m.id)} onChange={() => toggle(m.id)} className="w-4 h-4 accent-blue-900" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-slate-800 truncate">{m.fullName}</span>
                    <span className="block text-[11px] text-slate-400 truncate">
                      {m.email} · <span className="capitalize">{m.role.replace("_", " ")}</span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
          {saved && <span className="mr-auto text-[12px] text-emerald-700">Access updated.</span>}
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white">
            Close
          </button>
          <button
            onClick={save}
            disabled={saveMutation.isPending || selected === null}
            className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 disabled:opacity-60"
          >
            {saveMutation.isPending && <Loader2 size={12} className="animate-spin" />} Save access
          </button>
        </div>
      </div>
    </div>
  );
};

/** The full leave-request list (apply, approve, reject) in a popup, opened from the Take Attendance toolbar. */
const LeaveRequestsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-slate-900/50 backdrop-blur-sm sm:p-6" onClick={onClose}>
    <div className="w-full max-w-5xl my-4 overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h3 className="text-[15px] font-semibold text-slate-900">Leave Requests</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" title="Close">
          <X size={16} />
        </button>
      </div>
      <div className="max-h-[78vh] overflow-y-auto p-5">
        <LeaveRequestsPanel />
      </div>
    </div>
  </div>
);

/** Add a new employee, or rename / change the position of an existing one. */
const EmployeeModal: React.FC<{ person: AttendancePerson | null; onClose: () => void }> = ({ person, onClose }) => {
  const saveMutation = useSaveAttendanceEmployeeMutation();
  const [name, setName] = useState(person?.name ?? "");
  const [position, setPosition] = useState(person?.position ?? "");
  const [company, setCompany] = useState(person?.company ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter the employee's name.");
      return;
    }
    setError(null);
    try {
      await saveMutation.mutateAsync({ id: person?.id ?? null, input: { name: name.trim(), position: position.trim(), company: company.trim() } });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save the employee."));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-[14px] font-semibold text-slate-900">{person ? "Edit Employee" : "Add Employee"}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" title="Close">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {error && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>}
          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-900">Name</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Employee name" className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-900">Position (optional)</label>
            <input value={position} onChange={(e) => setPosition(e.target.value)} maxLength={120} placeholder="e.g. Site Engineer" className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className="block mb-1 text-[11px] font-medium text-slate-900">Company (optional)</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} placeholder="Company this employee belongs to" className={`${inputCls} w-full`} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 disabled:opacity-60"
          >
            {saveMutation.isPending && <Loader2 size={12} className="animate-spin" />} {person ? "Save" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
};

// =====================================================================================
// Monthly summary (admin / super admin)
// =====================================================================================

/** Letter shown in a register cell, and its colours. */
const CELL: Record<AttendanceStatus, { letter: string; cls: string }> = {
  present: { letter: "P", cls: "bg-emerald-100 text-emerald-800" },
  absent: { letter: "A", cls: "bg-red-100 text-red-700" },
  on_leave: { letter: "L", cls: "bg-violet-100 text-violet-700" },
  site_visit: { letter: "S", cls: "bg-sky-100 text-sky-700" },
};

/**
 * Monthly attendance register: one row per employee, one column per day of the month, with P / A / L in each
 * marked day (hover a cell for the full status and any note), followed by the month's totals.
 */
const SummaryTab: React.FC = () => {
  const { organization } = useAuth();
  const [month, setMonth] = useState(thisMonth);
  const summaryQuery = useAttendanceSummaryQuery(month);
  const rows = summaryQuery.data?.month === month ? summaryQuery.data.employees : [];
  const [exportError, setExportError] = useState<string | null>(null);

  /** The register as a spreadsheet: one row per employee, one column per day (P / A / L), then totals. */
  const exportExcel = async () => {
    setExportError(null);
    try {
      const XLSX = await import("xlsx");
      const [yy, mm] = month.split("-").map(Number);
      const n = new Date(yy!, mm!, 0).getDate();
      const dates = Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
      const { monthLabel } = await import("../pdf/attendanceSummaryPdf");
      const header = ["Employee", "Position", "Company", ...dates.map((_, i) => String(i + 1)), "Present", "Absent", "On Leave", "Site Visit", "Days marked"];
      const data = rows.map((r) => {
        const byDate = new Map(r.days.map((d) => [d.date, d.status] as const));
        return [
          r.name,
          r.position ?? "",
          r.company ?? "",
          ...dates.map((d) => {
            const st = byDate.get(d);
            return st ? CELL[st].letter : "";
          }),
          r.present,
          r.absent,
          r.on_leave,
          r.site_visit,
          r.marked,
        ];
      });
      const sheet = XLSX.utils.aoa_to_sheet([
        [`${organization?.name ?? ""} — Attendance Register — ${monthLabel(month)}`],
        ["P = Present, A = Absent, L = On Leave, S = Site Visit, blank = not marked"],
        [],
        header,
        ...data,
      ]);
      sheet["!cols"] = [{ wch: 24 }, { wch: 18 }, { wch: 22 }, ...dates.map(() => ({ wch: 3.5 })), { wch: 8 }, { wch: 8 }, { wch: 9 }, { wch: 12 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Attendance");
      XLSX.writeFile(workbook, `attendance-${month}.xlsx`);
    } catch (err) {
      setExportError(getErrorMessage(err, "Failed to export to Excel."));
    }
  };

  const exportPdf = async () => {
    setExportError(null);
    try {
      const { generateAttendanceSummaryPdf } = await import("../pdf/attendanceSummaryPdf");
      const blob = await generateAttendanceSummaryPdf({ organizationName: organization?.name ?? "Attendance", month, rows });
      downloadBlob(blob, `attendance-${month}.pdf`);
    } catch (err) {
      setExportError(getErrorMessage(err, "Failed to export to PDF."));
    }
  };

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y!, m!, 0).getDate();
  const today = todayStr();
  const dayCols = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const weekday = new Date(y!, m! - 1, i + 1).getDay();
    return { date, day: i + 1, weekday: "SMTWTFS"[weekday]!, isSaturday: weekday === 6, isFuture: date > today };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-medium text-slate-700">Month</label>
          <input type="month" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} className={inputCls} />
        </div>
        {rows.length > 0 && <ExportMenu onExportExcel={() => void exportExcel()} onExportPdf={exportPdf} />}
      </div>
      {exportError && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">{exportError}</div>}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-slate-600">
          {STATUSES.map((st) => (
            <span key={st.key} className="flex items-center gap-1.5">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10.5px] font-semibold ${CELL[st.key].cls}`}>{CELL[st.key].letter}</span>
              {st.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-5 border rounded border-slate-200 bg-slate-50" />
            Not marked
          </span>
        </div>
      </div>
      {summaryQuery.isLoading ? (
        <LoadingBlock text="Loading summary…" />
      ) : summaryQuery.isError ? (
        <ErrorBlock error={summaryQuery.error} fallback="Failed to load the summary." onRetry={() => void summaryQuery.refetch()} />
      ) : rows.length === 0 ? (
        <div className="bg-white border rounded-xl shadow-md border-slate-200">
          <p className="py-14 text-center text-[13px] text-slate-500">No employees found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border rounded-xl shadow-md border-slate-200">
          <table className="w-full min-w-max text-[11px] border-separate border-spacing-0">
            <thead>
              <tr className="text-slate-500">
                <th className="sticky left-0 z-10 min-w-[180px] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide bg-white border-b border-r border-slate-200">
                  Employee
                </th>
                {dayCols.map((d) => (
                  <th key={d.date} className={`w-7 min-w-[28px] py-1 font-medium text-center border-b border-slate-200 ${d.isSaturday ? "bg-slate-100" : ""}`}>
                    <div className="text-[9.5px] text-slate-400">{d.weekday}</div>
                    <div className="text-slate-700">{d.day}</div>
                  </th>
                ))}
                {STATUSES.map((st) => (
                  <th key={st.key} className={`px-2 py-2 font-semibold text-center border-b border-l border-slate-200 ${st.text}`} title={st.label}>
                    {CELL[st.key].letter}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const byDate = new Map(r.days.map((d) => [d.date, d] as const));
                return (
                  <tr key={r.id} className="group">
                    <td className="sticky left-0 z-10 px-3 py-1.5 bg-white border-b border-r border-slate-100 group-hover:bg-slate-50">
                      <p className="text-[12.5px] font-medium text-slate-800 whitespace-nowrap">{r.name}</p>
                      {r.position && <p className="text-[10.5px] text-slate-400 whitespace-nowrap">{r.position}</p>}
                    </td>
                    {dayCols.map((d) => {
                      const mark = byDate.get(d.date);
                      return (
                        <td
                          key={d.date}
                          className={`p-0.5 text-center border-b border-slate-100 ${d.isSaturday ? "bg-slate-50" : ""} group-hover:bg-slate-50`}
                          title={mark ? `${shortDay(d.date)}: ${STATUS_BY_KEY[mark.status].label}${mark.note ? ` — ${mark.note}` : ""}` : `${shortDay(d.date)}: not marked`}
                        >
                          {mark ? (
                            <span className={`relative inline-flex items-center justify-center w-6 h-6 rounded text-[10.5px] font-semibold ${CELL[mark.status].cls}`}>
                              {CELL[mark.status].letter}
                              {mark.note && <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-current opacity-60" />}
                            </span>
                          ) : (
                            <span className={`inline-block w-6 h-6 rounded ${d.isFuture ? "" : "bg-slate-50 border border-slate-100"}`} />
                          )}
                        </td>
                      );
                    })}
                    {STATUSES.map((st) => (
                      <td
                        key={st.key}
                        className={`px-2 text-center text-[12px] border-b border-l border-slate-100 ${r[st.key] ? `font-semibold ${st.text}` : "text-slate-300"}`}
                      >
                        {r[st.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/** One line telling the admin whether this attendance is shared with other organizations. */
const SharingBanner: React.FC = () => {
  const { data } = useAttendanceSharingQuery();
  if (!data || data.role === "none") return null;
  const names = data.linked.map((o) => o.name).join(", ");
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-blue-900 border border-blue-100 rounded-lg bg-blue-50/60">
      <Share2 size={13} />
      {data.role === "member" ? (
        <span>
          This is <strong>{data.owner?.name}</strong>&apos;s attendance list, shared with your organization. What you add or change here is visible there too.
        </span>
      ) : (
        <span>
          Shared live with <strong>{names}</strong>. Their admins can add employees and take attendance here as well.
        </span>
      )}
    </div>
  );
};

// =====================================================================================
// Page
// =====================================================================================

type TabKey = "take" | "summary";

/**
 * Attendance — admins and super admins keep their own list of employees (typed in here, independent of the
 * People / users page), take daily attendance for them (one status per person per day), approve leave requests
 * from the same table and review or export the monthly register. Everyone else just gets the leave-request list
 * (apply for leave, follow its status).
 */
const Attendance: React.FC = () => {
  const permissionsQuery = useAttendancePermissionsQuery();
  const permissions = permissionsQuery.data;
  const [tab, setTab] = useState<TabKey>("take");
  const [accessOpen, setAccessOpen] = useState(false);
  const tabs: { key: TabKey; label: string }[] = [
    { key: "take", label: "Take Attendance" },
    { key: "summary", label: "Monthly Summary" },
  ];

  return (
    <div className="w-full min-h-full p-6 bg-white lg:px-8 lg:py-8">
      <div className="flex flex-col w-full min-w-0 gap-5">
        {permissionsQuery.isLoading ? (
          <LoadingBlock text="Loading…" />
        ) : permissionsQuery.isError || !permissions ? (
          <ErrorBlock error={permissionsQuery.error} fallback="Failed to load the attendance page." onRetry={() => void permissionsQuery.refetch()} />
        ) : !permissions.canView ? (
          // No access to the attendance table: the page is just the leave-request list.
          <LeaveRequestsPanel />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200">
              <div className="flex gap-1">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-4 py-2 text-[12.5px] font-medium -mb-px border-b-2 transition-colors ${
                      tab === t.key ? "text-blue-900 border-blue-900" : "text-slate-500 border-transparent hover:text-slate-800"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {permissions.canManage && (
                <button
                  onClick={() => setAccessOpen(true)}
                  className="flex items-center gap-1.5 mb-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                  title="Choose who can edit attendance"
                >
                  <ShieldCheck size={13} /> Access
                </button>
              )}
            </div>
            <SharingBanner />
            {tab === "take" && <TakeAttendanceTab canEdit={permissions.canEdit} />}
            {tab === "summary" && <SummaryTab />}
          </>
        )}
      </div>
      {accessOpen && <AccessModal onClose={() => setAccessOpen(false)} />}
    </div>
  );
};

export default Attendance;
