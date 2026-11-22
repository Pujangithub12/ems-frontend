import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarCheck, Check, ChevronLeft, ChevronRight, Loader2, Save, Search } from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { getErrorMessage } from "../../../lib/errors";
import type { AttendanceCounts, AttendanceStatus } from "../api/attendance.api";
import { useAttendanceDayQuery, useAttendanceSummaryQuery, useMyAttendanceQuery, useSaveAttendanceMutation } from "../hooks/useAttendance";

type StatusMeta = { key: AttendanceStatus; label: string; /** classes when selected */ on: string; /** text colour for counts */ text: string; pill: string };

const STATUSES: StatusMeta[] = [
  { key: "present", label: "Present", on: "bg-emerald-600 border-emerald-600 text-white", text: "text-emerald-700", pill: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "absent", label: "Absent", on: "bg-red-600 border-red-600 text-white", text: "text-red-700", pill: "bg-red-50 text-red-700 border-red-200" },
  { key: "on_leave", label: "On Leave", on: "bg-violet-600 border-violet-600 text-white", text: "text-violet-700", pill: "bg-violet-50 text-violet-700 border-violet-200" },
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

const TakeAttendanceTab: React.FC = () => {
  const [date, setDate] = useState(todayStr);
  const dayQuery = useAttendanceDayQuery(date);
  const saveMutation = useSaveAttendanceMutation();
  const [draft, setDraft] = useState<Draft>({});
  const [baseline, setBaseline] = useState("");
  const [search, setSearch] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

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
  const setNote = (id: number, note: string) => {
    setJustSaved(false);
    setDraft((d) => ({ ...d, [id]: { status: d[id]?.status ?? "", note } }));
  };
  const markAllPresent = () => {
    setJustSaved(false);
    setDraft((d) => Object.fromEntries(employees.map((e) => [e.id, { status: "present" as const, note: d[e.id]?.note ?? "" }])));
  };
  const clearAll = () => {
    setJustSaved(false);
    setDraft((d) => Object.fromEntries(employees.map((e) => [e.id, { status: "" as const, note: d[e.id]?.note ?? "" }])));
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      await saveMutation.mutateAsync({
        date,
        records: employees.map((e) => ({ userId: e.id, status: draft[e.id]?.status ?? "", note: draft[e.id]?.note ?? "" })),
      });
      setBaseline(JSON.stringify(draft));
      setJustSaved(true);
    } catch (err) {
      setSaveError(getErrorMessage(err, "Failed to save attendance."));
    }
  };

  const counts = useMemo(() => {
    const c: AttendanceCounts & { unmarked: number } = { present: 0, absent: 0, on_leave: 0, unmarked: 0 };
    for (const e of employees) {
      const s = draft[e.id]?.status;
      if (s) c[s] += 1;
      else c.unmarked += 1;
    }
    return c;
  }, [employees, draft]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? employees.filter((e) => e.fullName.toLowerCase().includes(q) || (e.jobPosition ?? "").toLowerCase().includes(q)) : employees;
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
          <button
            onClick={handleSave}
            disabled={!dirty || saveMutation.isPending || employees.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : dirty ? <Save size={14} /> : <Check size={14} />} Save Attendance
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
            <div className="flex items-center gap-2">
              <button onClick={markAllPresent} className="px-3 py-2 text-[12px] font-medium text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50">
                Mark all present
              </button>
              <button onClick={clearAll} className="px-3 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                Clear all
              </button>
            </div>
          </div>

          {/* Employees */}
          <div className="overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
            {filtered.length === 0 ? (
              <p className="py-14 text-center text-[13px] text-slate-500">{employees.length === 0 ? "There are no employees in this organization yet." : "No employee matches your search."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                      <th className="w-10 px-3 py-2 font-medium text-left">#</th>
                      <th className="px-3 py-2 font-medium text-left">Employee</th>
                      <th className="px-3 py-2 font-medium text-left">Status</th>
                      <th className="px-3 py-2 font-medium text-left">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e, idx) => {
                      const current = draft[e.id]?.status ?? "";
                      return (
                        <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                          <td className="px-3 py-2.5 text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <p className="text-[13px] font-medium text-slate-800">{e.fullName}</p>
                            <p className="text-[11px] text-slate-400">{e.jobPosition || <span className="capitalize">{e.role.replace("_", " ")}</span>}</p>
                          </td>
                          <td className="px-3 py-2.5">
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
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              value={draft[e.id]?.note ?? ""}
                              onChange={(ev) => setNote(e.id, ev.target.value)}
                              placeholder="Optional note"
                              maxLength={500}
                              className={`${inputCls} w-full min-w-[160px]`}
                            />
                          </td>
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
};

/**
 * Monthly attendance register: one row per employee, one column per day of the month, with P / A / L in each
 * marked day (hover a cell for the full status and any note), followed by the month's totals.
 */
const SummaryTab: React.FC = () => {
  const [month, setMonth] = useState(thisMonth);
  const summaryQuery = useAttendanceSummaryQuery(month);
  const rows = summaryQuery.data?.month === month ? summaryQuery.data.employees : [];

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
          <table className="text-[11px] border-separate border-spacing-0">
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
                      <p className="text-[12.5px] font-medium text-slate-800 whitespace-nowrap">{r.fullName}</p>
                      <p className="text-[10.5px] text-slate-400 whitespace-nowrap">{r.jobPosition || <span className="capitalize">{r.role.replace("_", " ")}</span>}</p>
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

// =====================================================================================
// My attendance (everyone)
// =====================================================================================

const MyAttendanceTab: React.FC = () => {
  const [month, setMonth] = useState(thisMonth);
  const mineQuery = useMyAttendanceQuery(month);
  const data = mineQuery.data?.month === month ? mineQuery.data : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <label className="text-[12px] font-medium text-slate-700">Month</label>
        <input type="month" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} className={inputCls} />
      </div>
      {mineQuery.isLoading ? (
        <LoadingBlock text="Loading your attendance…" />
      ) : mineQuery.isError ? (
        <ErrorBlock error={mineQuery.error} fallback="Failed to load your attendance." onRetry={() => void mineQuery.refetch()} />
      ) : data ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {STATUSES.map((s) => (
              <CountChip key={s.key} label={s.label} value={data.counts[s.key]} className={s.text} />
            ))}
          </div>
          <div className="overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
            {data.records.length === 0 ? (
              <p className="py-14 text-center text-[13px] text-slate-500">No attendance has been recorded for you this month.</p>
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                    <th className="px-3 py-2 font-medium text-left">Date</th>
                    <th className="px-3 py-2 font-medium text-left">Status</th>
                    <th className="px-3 py-2 font-medium text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((r) => (
                    <tr key={r.date} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{shortDay(r.date)}</td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{r.note || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

// =====================================================================================
// Page
// =====================================================================================

type TabKey = "take" | "summary" | "mine";

/**
 * Attendance — admins and super admins take daily attendance for the organization's employees (one status per
 * person per day, plus an optional note) and review monthly totals. Everyone can see their own record.
 */
const Attendance: React.FC = () => {
  const { user } = useAuth();
  const canTake = user?.role === "admin" || user?.role === "super_admin";
  const tabs: { key: TabKey; label: string }[] = canTake
    ? [
        { key: "take", label: "Take Attendance" },
        { key: "summary", label: "Monthly Summary" },
        { key: "mine", label: "My Attendance" },
      ]
    : [{ key: "mine", label: "My Attendance" }];
  const [tab, setTab] = useState<TabKey>(canTake ? "take" : "mine");

  return (
    <div className="w-full min-h-full p-6 bg-white lg:px-8 lg:py-8">
      <div className="flex flex-col w-full min-w-0 gap-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-blue-900 rounded-full bg-blue-50">
            <CalendarCheck size={16} />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-slate-900">Attendance</h2>
            <p className="text-[12px] text-slate-500">{canTake ? "Mark who is present each day and review the month." : "Your attendance records."}</p>
          </div>
        </div>

        {tabs.length > 1 && (
          <div className="flex gap-1 border-b border-slate-200">
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
        )}

        {tab === "take" && canTake && <TakeAttendanceTab />}
        {tab === "summary" && canTake && <SummaryTab />}
        {tab === "mine" && <MyAttendanceTab />}
      </div>
    </div>
  );
};

export default Attendance;
