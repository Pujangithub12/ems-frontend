import React, { useState } from "react";
import NepaliDate from "nepali-date-converter";
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Copy,
  Trash2,
  Loader2,
  X,
  Calendar as CalendarIcon,
} from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import ConfirmationModal from "../../../components/ConfirmationModal";
import { useEvents, useCreateEvent, useDeleteEvent, useCopyEvents } from "../hooks/useEvents";
import type { CalendarEvent, CopyEventsOrgResult } from "../api/events.api";
import { getErrorMessage } from "../../../lib/errors";
import ErrorBanner from "../../../components/ErrorBanner";

const RED = "#C60009"; // Traditional Nepali patro accent color

// Weekday short/full labels in Nepali script, indexed by JS Date's getDay()
// (0 = Sunday ... 6 = Saturday). Generated from the date library itself
// (rather than hand-typed Devanagari) so the encoding is guaranteed correct.
const WEEKDAY_LABELS_NP: { short: string; full: string }[] = (() => {
  const labels: { short: string; full: string }[] = new Array(7);
  let d = new NepaliDate(2082, 3, 1);
  for (let i = 0; i < 7; i++) {
    labels[d.getDay()] = { short: d.format("dd", "np"), full: d.format("ddd", "np") };
    d = new NepaliDate(d.toJsDate().getTime() + 86400000);
  }
  return labels;
})();
const EN_WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Computed via the library's own conversion rather than a hardcoded table,
// so it stays correct regardless of which years that table would cover.
const daysInBsMonth = (year: number, month: number) => {
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  const firstOfThis = new NepaliDate(year, month, 1).toJsDate();
  const firstOfNext = new NepaliDate(nextYear, nextMonth, 1).toJsDate();
  return Math.round((firstOfNext.getTime() - firstOfThis.getTime()) / 86400000);
};

const isoOfAd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const EVENT_STYLES: Record<string, { fg: string; bg: string; label: string }> = {
  event: { fg: "#1E3A8A", bg: "#DBEAFE", label: "Event" },
  holiday: { fg: "#B91C1C", bg: "#FEE2E2", label: "Holiday" },
  deadline: { fg: "#B45309", bg: "#FEF3C7", label: "Deadline" },
};
const eventStyle = (type: string) => EVENT_STYLES[type] || EVENT_STYLES.event;

const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`text-[10px] tracking-[0.1em] uppercase text-slate-400 ${className}`}
    style={{ fontFamily: "'JetBrains Mono', monospace" }}
  >
    {children}
  </div>
);

type DaySel = { y: number; m: number; d: number; ad: Date };

const MonthGrid: React.FC<{
  y: number;
  m: number;
  today: Date;
  events: CalendarEvent[];
  onDayClick?: (sel: DaySel) => void;
}> = ({ y, m, today, events, onDayClick }) => {
  const totalDays = daysInBsMonth(y, m);
  const firstAd = new NepaliDate(y, m, 1).toJsDate();
  const lastAd = new NepaliDate(y, m, totalDays).toJsDate();
  const startWeekday = firstAd.getDay();
  const adSpan =
    firstAd.getMonth() === lastAd.getMonth()
      ? firstAd.toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : `${firstAd.toLocaleDateString("en-US", { month: "short" })}/${lastAd.toLocaleDateString(
          "en-US",
          { month: "short" },
        )} ${lastAd.getFullYear()}`;
  const todayBs = NepaliDate.fromAD(today);
  const isToday = (d: number) =>
    todayBs.getYear() === y && todayBs.getMonth() === m && todayBs.getDate() === d;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  const numRows = Math.ceil(cells.length / 7);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white border rounded-md border-slate-200">
      <div className="flex items-baseline justify-between flex-shrink-0 px-5 py-3 bg-white border-b border-slate-200">
        <div className="flex items-baseline gap-3">
          <span
            className="font-bold text-[21px] font-nepali"
            style={{ color: RED }}
          >
            {new NepaliDate(y, m, 1).format("MMMM", "np")} {new NepaliDate(y, m, 1).format("YYYY", "np")}
          </span>
          <span
            className="text-[11.5px] text-slate-400"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {adSpan}
          </span>
        </div>
      </div>

      <div className="grid flex-shrink-0 grid-cols-7 border-b border-slate-200">
        {WEEKDAY_LABELS_NP.map((w, i) => (
          <div
            key={i}
            className="px-2 py-2 text-center"
            style={{ background: i === 6 ? "#C6000910" : "#EEF1F5" }}
          >
            <div
              className="font-semibold text-[12.5px] font-nepali"
              style={{
                color: i === 6 ? RED : "#0f172a",
              }}
            >
              {w.short}
            </div>
            <div
              className="text-[8.5px] uppercase tracking-[0.08em]"
              style={{ color: i === 6 ? RED : "#94a3b8", fontFamily: "'JetBrains Mono', monospace" }}
            >
              {EN_WEEKDAYS_SHORT[i]}
            </div>
          </div>
        ))}
      </div>

      <div
        className="grid flex-1 min-h-0 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))` }}
      >
        {cells.map((d, i) => {
          if (d === null) {
            return (
              <div
                key={`b${i}`}
                className="bg-slate-50"
                style={{
                  borderRight: "1px solid #E2E8F0",
                  borderBottom: "1px solid #E2E8F0",
                  opacity: 0.5,
                }}
              />
            );
          }
          const ad = new NepaliDate(y, m, d).toJsDate();
          const sat = ad.getDay() === 6; // Saturday is Nepal's weekly day off.
          const dayEvents = events.filter((ev) => isoOfAd(new Date(ev.date)) === isoOfAd(ad));
          const todayCell = isToday(d);
          const shown = dayEvents.slice(0, 2);
          const extra = dayEvents.length - shown.length;
          const adSmall =
            ad.getDate() === 1
              ? ad.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : String(ad.getDate());

          return (
            <div
              key={d}
              className={`relative px-2 pt-1.5 pb-2 overflow-hidden ${onDayClick ? "cal-day" : ""}`}
              onClick={onDayClick ? () => onDayClick({ y, m, d, ad }) : undefined}
              style={{
                borderRight: "1px solid #E2E8F0",
                borderBottom: "1px solid #E2E8F0",
                background: sat ? "#C6000906" : "#fff",
              }}
            >
              <div
                className="absolute"
                style={{
                  top: 6,
                  right: 8,
                  fontSize: 9.5,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: sat ? "#C6000999" : "#94a3b8",
                }}
              >
                {adSmall}
              </div>
              <div className="flex justify-center mt-1.5 mb-1">
                <span
                  className={`font-bold flex items-center justify-center font-nepali ${
                    todayCell ? "rounded-full text-white" : ""
                  }`}
                  style={{
                    fontSize: todayCell ? 17 : 21,
                    lineHeight: 1,
                    width: todayCell ? 34 : "auto",
                    height: todayCell ? 34 : "auto",
                    background: todayCell ? RED : "transparent",
                    color: todayCell ? "#fff" : sat ? RED : "#0f172a",
                  }}
                >
                  {new NepaliDate(y, m, d).format("D", "np")}
                </span>
              </div>
              <div className="space-y-0.5">
                {shown.map((ev) => {
                  const st = eventStyle(ev.type);
                  return (
                    <div
                      key={ev.id}
                      className="font-medium truncate rounded"
                      style={{ fontSize: 9.5, padding: "1.5px 5px", background: st.bg, color: st.fg }}
                    >
                      {ev.title}
                    </div>
                  );
                })}
                {extra > 0 && (
                  <div
                    className="text-center text-slate-400"
                    style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    +{extra}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DayModal: React.FC<{
  sel: DaySel;
  events: CalendarEvent[];
  isAdmin: boolean;
  submitting: boolean;
  onAdd: (title: string, type: string) => void;
  onDeleteRequest: (id: number) => void;
  onClose: () => void;
}> = ({ sel, events, isAdmin, submitting, onAdd, onDeleteRequest, onClose }) => {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("event");
  const bsDate = new NepaliDate(sel.y, sel.m, sel.d);
  const dayEvents = events.filter((ev) => isoOfAd(new Date(ev.date)) === isoOfAd(sel.ad));
  const holidayLabel = sel.ad.getDay() === 6 ? "Saturday — Weekly Holiday" : null;

  const submit = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), type);
    setTitle("");
  };

  const typeOptions: [string, string][] = [
    ["event", "Event"],
    ["holiday", "Holiday"],
    ["deadline", "Deadline"],
  ];

  return (
    <div
      className="fixed inset-0 z-[45] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/45"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden bg-white border rounded-md shadow-lg border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-slate-200"
          style={{ borderTop: `3px solid ${RED}` }}
        >
          <div>
            <div
              className="font-bold text-[16px] font-nepali"
              style={{ color: RED }}
            >
              {bsDate.format("ddd, D MMMM YYYY", "np")}
            </div>
            <div className="text-[12px] text-slate-400 mt-0.5">
              {sel.ad.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          {holidayLabel && (
            <div
              className="flex items-center gap-2 px-3 py-2 mb-3 rounded"
              style={{ background: "#FEE2E2", color: "#B91C1C" }}
            >
              <span className="flex-shrink-0 rounded-full" style={{ width: 6, height: 6, background: "#B91C1C" }} />
              <span className="text-[12.5px] font-medium">{holidayLabel}</span>
            </div>
          )}
          {dayEvents.length === 0 ? (
            <p className="py-3 mb-4 text-center text-slate-400 text-[12.5px]">
              Nothing scheduled yet.
            </p>
          ) : (
            <div className="mb-4 space-y-2">
              {dayEvents.map((ev) => {
                const st = eventStyle(ev.type);
                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded border border-slate-200"
                  >
                    <span
                      className="flex-shrink-0 rounded-full"
                      style={{ width: 6, height: 6, background: st.fg }}
                    />
                    <span className="flex-1 min-w-0 text-[13px] text-slate-800 truncate">
                      {ev.title}
                    </span>
                    <span
                      className="text-[9.5px] uppercase tracking-[0.04em] font-medium flex-shrink-0"
                      style={{ color: st.fg }}
                    >
                      {st.label}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => onDeleteRequest(ev.id)}
                        className="flex-shrink-0 p-1 transition-colors rounded text-slate-400 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isAdmin && (
            <div className="pt-4 border-t border-slate-200">
              <Eyebrow className="mb-1.5">Add to this day</Eyebrow>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="e.g., Democracy Day, Office Holiday"
                autoFocus
                className="w-full px-3 py-2 mb-2.5 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
              />
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap flex-1 gap-1.5">
                  {typeOptions.map(([id, label]) => {
                    const st = EVENT_STYLES[id];
                    const active = type === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setType(id)}
                        className="font-medium transition-colors border rounded-full"
                        style={{
                          padding: "4px 11px",
                          fontSize: 11.5,
                          background: active ? st.bg : "#fff",
                          color: active ? st.fg : "#94a3b8",
                          borderColor: active ? st.fg : "#E2E8F0",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!title.trim() || submitting}
                  className="flex items-center flex-shrink-0 gap-1.5 px-3.5 py-2 text-[12.5px] font-medium text-white rounded disabled:opacity-50 transition-colors"
                  style={{ background: RED }}
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

type BulkRow = { key: number; date: string; title: string; type: string };

/** "YYYY-MM-DD" (from <input type="date">) → local-midnight Date, matching how the grid buckets events by day. */
const dateFromInput = (v: string): Date | null => {
  const [y, mo, d] = v.split("-").map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d);
};

const bsLabel = (v: string): string => {
  const ad = dateFromInput(v);
  if (!ad) return "";
  try {
    return NepaliDate.fromAD(ad).format("ddd, D MMMM YYYY", "np");
  } catch {
    return ""; // outside the converter's supported range
  }
};

/** Add several events on different days in one go. */
const BulkAddModal: React.FC<{
  defaultDate: string;
  onSave: (rows: { date: Date; title: string; type: string }[]) => Promise<number>;
  onClose: () => void;
}> = ({ defaultDate, onSave, onClose }) => {
  const nextKey = React.useRef(2);
  const [rows, setRows] = useState<BulkRow[]>([
    { key: 1, date: defaultDate, title: "", type: "event" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRowRef = React.useRef<HTMLInputElement>(null);
  const [focusLast, setFocusLast] = useState(false);

  React.useEffect(() => {
    if (focusLast) {
      lastRowRef.current?.focus();
      setFocusLast(false);
    }
  }, [focusLast, rows.length]);

  const update = (key: number, patch: Partial<BulkRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () => {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      // Carry over the previous row's date and type — the next event is usually on a nearby day.
      return [
        ...prev,
        { key: nextKey.current++, date: last?.date || defaultDate, title: "", type: last?.type || "event" },
      ];
    });
    setFocusLast(true);
  };

  const removeRow = (key: number) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== key)));

  const filled = rows.filter((r) => r.title.trim() && r.date);

  const save = async () => {
    if (filled.length === 0) {
      setError("Enter at least one event with a date and a title.");
      return;
    }
    setError(null);
    setSaving(true);
    const toSave = filled.map((r) => ({
      key: r.key,
      date: dateFromInput(r.date)!,
      title: r.title.trim(),
      type: r.type,
    }));
    const savedCount = await onSave(toSave.map(({ date, title, type }) => ({ date, title, type })));
    setSaving(false);
    if (savedCount === toSave.length) {
      onClose();
      return;
    }
    // Keep only what failed (saves run in order, so the first `savedCount` went through).
    const failedKeys = new Set(toSave.slice(savedCount).map((r) => r.key));
    setRows((prev) => prev.filter((r) => failedKeys.has(r.key) || !r.title.trim()));
    setError(
      `${savedCount} of ${toSave.length} events saved. The remaining ones are still listed below — please try again.`,
    );
  };

  return (
    <div
      className="fixed inset-0 z-[45] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/45"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="flex flex-col w-full max-w-2xl max-h-[88vh] overflow-hidden bg-white border rounded-md shadow-lg border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between flex-shrink-0 px-5 py-4 border-b border-slate-200"
          style={{ borderTop: `3px solid ${RED}` }}
        >
          <div>
            <div className="font-bold text-[16px]" style={{ color: RED }}>
              Add Events
            </div>
            <div className="text-[12px] text-slate-400 mt-0.5">
              Add events, holidays or deadlines on different days, then save them all at once.
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-5 space-y-3 overflow-y-auto">
          {rows.map((r, idx) => {
            const isLast = idx === rows.length - 1;
            const bs = bsLabel(r.date);
            return (
              <div key={r.key} className="p-3 border rounded border-slate-200 bg-slate-50/40">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={r.date}
                    onChange={(e) => update(r.key, { date: e.target.value })}
                    className="px-2.5 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  />
                  <input
                    ref={isLast ? lastRowRef : undefined}
                    value={r.title}
                    onChange={(e) => update(r.key, { title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (r.title.trim() && isLast) addRow();
                      }
                    }}
                    placeholder="e.g., Democracy Day, Office Holiday"
                    className="flex-1 min-w-[160px] px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(r.key)}
                    disabled={rows.length === 1}
                    title="Remove"
                    className="flex-shrink-0 p-1.5 transition-colors rounded text-slate-400 hover:text-red-700 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(EVENT_STYLES).map(([id, st]) => {
                      const active = r.type === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => update(r.key, { type: id })}
                          className="font-medium transition-colors border rounded-full"
                          style={{
                            padding: "3px 10px",
                            fontSize: 11.5,
                            background: active ? st.bg : "#fff",
                            color: active ? st.fg : "#94a3b8",
                            borderColor: active ? st.fg : "#E2E8F0",
                          }}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>
                  {bs && (
                    <span className="text-[12px] font-nepali" style={{ color: RED }}>
                      {bs}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium border border-dashed rounded text-slate-600 border-slate-300 hover:bg-slate-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add another event
          </button>
        </div>

        <div className="flex items-center justify-between flex-shrink-0 gap-3 px-5 py-3 border-t border-slate-200 bg-slate-50/60">
          <p className={`text-[12px] ${error ? "text-red-700" : "text-slate-400"}`}>
            {error ?? `${filled.length} event${filled.length === 1 ? "" : "s"} ready to save`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3.5 py-2 text-[12.5px] font-medium border rounded text-slate-600 border-slate-200 hover:bg-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || filled.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-medium text-white rounded disabled:opacity-50 transition-colors"
              style={{ background: RED }}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save {filled.length > 1 ? `${filled.length} events` : "event"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Copy events from this organization's calendar into another organization's calendar. */
const CopyEventsModal: React.FC<{
  events: CalendarEvent[];
  targets: { id: number; name: string }[];
  monthEventIds: Set<number>;
  monthLabel: string;
  onClose: () => void;
}> = ({ events, targets, monthEventIds, monthLabel, onClose }) => {
  const copyMutation = useCopyEvents();
  const sorted = React.useMemo(
    () => [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events],
  );
  // With a single possible destination it's pre-ticked; otherwise the user picks.
  const [targetIds, setTargetIds] = useState<Set<number>>(
    () => new Set(targets.length === 1 ? [targets[0]!.id] : []),
  );
  const [selected, setSelected] = useState<Set<number>>(() => new Set(events.map((e) => e.id)));
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CopyEventsOrgResult[] | null>(null);

  const toggleTarget = (id: number) =>
    setTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    setError(null);
    try {
      const r = await copyMutation.mutateAsync({
        targetOrganizationIds: Array.from(targetIds),
        eventIds: sorted.filter((e) => selected.has(e.id)).map((e) => e.id),
      });
      setResults(r);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to copy events."));
    }
  };

  const linkBtn = "text-[11.5px] font-medium text-blue-900 hover:underline";

  return (
    <div
      className="fixed inset-0 z-[45] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/45"
      onClick={copyMutation.isPending ? undefined : onClose}
    >
      <div
        className="flex flex-col w-full max-w-lg max-h-[88vh] overflow-hidden bg-white border rounded-md shadow-lg border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between flex-shrink-0 px-5 py-4 border-b border-slate-200"
          style={{ borderTop: `3px solid ${RED}` }}
        >
          <div>
            <div className="font-bold text-[16px]" style={{ color: RED }}>
              Copy events to another organization
            </div>
            <div className="text-[12px] text-slate-400 mt-0.5">
              Events already in the other calendar are skipped, so nothing gets duplicated.
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {results ? (
          <div className="p-6">
            <div className="space-y-2">
              {results.map((r) => (
                <div
                  key={r.organizationId}
                  className={`px-3 py-2.5 border rounded ${
                    r.error ? "border-red-200 bg-red-50" : "border-slate-200"
                  }`}
                >
                  <p className="text-[13px] font-semibold text-slate-900">{r.organizationName}</p>
                  {r.error ? (
                    <p className="mt-0.5 text-[12px] text-red-700">{r.error}</p>
                  ) : (
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      {r.copied} event{r.copied === 1 ? "" : "s"} copied
                      {r.skipped > 0 && ` · ${r.skipped} skipped (already there)`}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 text-center">
              <button
                onClick={onClose}
                className="px-4 py-2 text-[12.5px] font-medium text-white rounded"
                style={{ background: RED }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 p-5 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-600">
                  Copy to ({targetIds.size} of {targets.length} selected)
                </span>
                {targets.length > 1 && (
                  <div className="flex items-center gap-3">
                    <button type="button" className={linkBtn} onClick={() => setTargetIds(new Set(targets.map((t) => t.id)))}>
                      All
                    </button>
                    <button type="button" className={linkBtn} onClick={() => setTargetIds(new Set())}>
                      None
                    </button>
                  </div>
                )}
              </div>
              <div className="mb-5 space-y-1.5">
                {targets.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2.5 px-3 py-2 border rounded cursor-pointer border-slate-200 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={targetIds.has(t.id)}
                      onChange={() => toggleTarget(t.id)}
                      className="flex-shrink-0"
                    />
                    <span className="flex-1 min-w-0 text-[13px] text-slate-800 truncate">{t.name}</span>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-600">
                  Events ({selected.size} of {sorted.length} selected)
                </span>
                <div className="flex items-center gap-3">
                  <button type="button" className={linkBtn} onClick={() => setSelected(new Set(sorted.map((e) => e.id)))}>
                    All
                  </button>
                  <button type="button" className={linkBtn} onClick={() => setSelected(new Set(monthEventIds))}>
                    {monthLabel}
                  </button>
                  <button type="button" className={linkBtn} onClick={() => setSelected(new Set())}>
                    None
                  </button>
                </div>
              </div>

              {sorted.length === 0 ? (
                <p className="py-6 text-center text-slate-400 text-[12.5px]">
                  This calendar has no events to copy yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {sorted.map((ev) => {
                    const st = eventStyle(ev.type);
                    const d = new Date(ev.date);
                    return (
                      <label
                        key={ev.id}
                        className="flex items-center gap-2.5 px-3 py-2 border rounded cursor-pointer border-slate-200 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(ev.id)}
                          onChange={() => toggle(ev.id)}
                          className="flex-shrink-0"
                        />
                        <span className="flex-shrink-0 rounded-full" style={{ width: 6, height: 6, background: st.fg }} />
                        <span className="flex-1 min-w-0 text-[13px] text-slate-800 truncate">{ev.title}</span>
                        <span
                          className="flex-shrink-0 text-[10.5px] text-slate-400"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span
                          className="flex-shrink-0 text-[9.5px] uppercase tracking-[0.04em] font-medium"
                          style={{ color: st.fg }}
                        >
                          {st.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between flex-shrink-0 gap-3 px-5 py-3 border-t border-slate-200 bg-slate-50/60">
              <p className={`text-[12px] ${error ? "text-red-700" : "text-slate-400"}`}>{error ?? ""}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={copyMutation.isPending}
                  className="px-3.5 py-2 text-[12.5px] font-medium border rounded text-slate-600 border-slate-200 hover:bg-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={copyMutation.isPending || selected.size === 0 || targetIds.size === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-medium text-white rounded disabled:opacity-50"
                  style={{ background: RED }}
                >
                  {copyMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Copy {selected.size} event{selected.size === 1 ? "" : "s"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

type MonthPos = { y: number; m: number };

const CalendarPage: React.FC = () => {
  const { user, organization, organizations } = useAuth();
  const { data: events = [], isLoading: loading } = useEvents();
  const [showCopy, setShowCopy] = useState(false);
  const copyTargets = organizations.filter((o) => o.id !== organization?.id);
  const [actionError, setActionError] = useState<string | null>(null);

  const today = new Date();
  const todayBs = NepaliDate.fromAD(today);
  const [cursor, setCursor] = useState<MonthPos>({ y: todayBs.getYear(), m: todayBs.getMonth() });
  const [flip, setFlip] = useState<{ from: MonthPos; dir: "next" | "prev" } | null>(null);

  const [selectedDay, setSelectedDay] = useState<DaySel | null>(null);
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  const [deleteEventId, setDeleteEventId] = useState<number | null>(null);

  const createEventMutation = useCreateEvent();
  const deleteEventMutation = useDeleteEvent();
  const addingEvent = createEventMutation.isPending;
  const deletingEvent = deleteEventMutation.isPending;

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const clampMonth = (y: number, m: number): MonthPos | null => {
    if (m < 0) {
      y -= 1;
      m = 11;
    }
    if (m > 11) {
      y += 1;
      m = 0;
    }
    try {
      // Validate the target is within the library's supported BS range.
      new NepaliDate(y, m, 1);
      return { y, m };
    } catch {
      return null;
    }
  };

  const goTo = (target: MonthPos | null) => {
    if (flip || !target) return;
    const diff = target.y * 12 + target.m - (cursor.y * 12 + cursor.m);
    if (diff === 0) return;
    setFlip({ from: cursor, dir: diff > 0 ? "next" : "prev" });
    setCursor(target);
  };

  const underCursor = flip && flip.dir === "prev" ? flip.from : cursor;
  const sheetCursor = flip ? (flip.dir === "next" ? flip.from : cursor) : null;

  const handleAddEventForDay = async (date: Date, title: string, type: string) => {
    setActionError(null);
    try {
      await createEventMutation.mutateAsync({ title, date: date.toISOString(), type });
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to add event."));
    }
  };

  /** Saves in order and stops at the first failure; resolves to how many were saved. */
  const handleBulkSave = async (rows: { date: Date; title: string; type: string }[]) => {
    setActionError(null);
    let saved = 0;
    for (const r of rows) {
      try {
        await createEventMutation.mutateAsync({ title: r.title, date: r.date.toISOString(), type: r.type });
        saved++;
      } catch (err) {
        setActionError(getErrorMessage(err, "Failed to add event."));
        break;
      }
    }
    return saved;
  };

  const handleDeleteEvent = async () => {
    if (deleteEventId === null) return;
    try {
      await deleteEventMutation.mutateAsync(deleteEventId);
      setDeleteEventId(null);
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to delete event."));
    }
  };

  // "This week" runs from today through the coming Saturday (matching the
  // grid's Sun-first week layout) — days already past this week are excluded
  // since the box is meant to show what's still upcoming, not a history.
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(startOfToday.getDate() + (6 - startOfToday.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);
  const upcomingThisWeek = events
    .filter((ev) => {
      const d = new Date(ev.date);
      return d >= startOfToday && d <= endOfWeek;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="h-[calc(100vh-4rem)] max-w-6xl px-6 py-6 mx-auto lg:px-8 flex flex-col overflow-hidden">

      {actionError && (
        <ErrorBanner
          message={actionError}
          onDismiss={() => setActionError(null)}
          className="flex-shrink-0 mb-4"
        />
      )}

      <div className="flex flex-wrap items-center justify-between flex-shrink-0 gap-3 mb-4">
        <p className="text-slate-500 text-[13px]">
          <span
            className="font-semibold font-nepali"
            style={{ color: RED }}
          >
            Today: {todayBs.format("D MMMM, YYYY", "np")}
          </span>
          <span
            className="ml-2 text-slate-400"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5 }}
          >
            {today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <span className="ml-2 text-slate-400">· click any day to view or add events</span>
        </p>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
          {isAdmin && copyTargets.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCopy(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px] font-semibold border rounded transition-colors hover:bg-slate-50"
              style={{ borderColor: RED, color: RED }}
            >
              <Copy className="w-3.5 h-3.5" />
              Copy to…
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowBulkAdd(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px] font-semibold text-white rounded transition-colors"
              style={{ background: RED }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Event
            </button>
          )}
          <button
            type="button"
            onClick={() => goTo(clampMonth(cursor.y, cursor.m - 1))}
            className="flex items-center justify-center p-2 transition-colors border rounded border-slate-200 hover:bg-slate-50"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <button
            type="button"
            onClick={() => goTo({ y: todayBs.getYear(), m: todayBs.getMonth() })}
            className="px-3.5 py-1.5 text-[12.5px] font-semibold border rounded transition-colors"
            style={{ borderColor: RED, color: RED }}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => goTo(clampMonth(cursor.y, cursor.m + 1))}
            className="flex items-center justify-center p-2 transition-colors border rounded border-slate-200 hover:bg-slate-50"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center flex-shrink-0 gap-4 mb-4">
        {Object.entries(EVENT_STYLES).map(([key, st]) => (
          <span key={key} className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <span className="rounded-sm" style={{ width: 8, height: 8, background: st.fg }} />
            {st.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: RED }}>
          <span className="rounded-sm" style={{ width: 8, height: 8, background: RED }} />
          Saturday
        </span>
      </div>

      <div className="flex flex-1 min-h-0 gap-5">
      {/* Calendar book */}
      <div className="flex-1 min-w-0 min-h-0 cal-book">
        <div className="cal-binding" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="cal-ring" />
          ))}
        </div>
        <div className="cal-pages">
          <MonthGrid
            y={underCursor.y}
            m={underCursor.m}
            today={today}
            events={events}
            onDayClick={flip ? undefined : (sel) => setSelectedDay(sel)}
          />
          {flip && (
            <div className={flip.dir === "next" ? "cal-shade" : "cal-shade cal-shade-in"} />
          )}
          {flip && sheetCursor && (
            <div
              className={`cal-sheet ${flip.dir === "next" ? "cal-sheet-next" : "cal-sheet-prev"}`}
              onAnimationEnd={(e) => {
                if (e.animationName && e.animationName.indexOf("calSheet") === 0) setFlip(null);
              }}
            >
              <div className="cal-face cal-face-front">
                <MonthGrid
                  y={sheetCursor.y}
                  m={sheetCursor.m}
                  today={today}
                  events={events}
                />
                <div
                  className={`cal-tint ${flip.dir === "next" ? "cal-tint-away" : "cal-tint-arrive"}`}
                />
              </div>
              <div className="cal-face cal-face-back">
                <div className="cal-back-ghost">EMS · {sheetCursor.y}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Events sidebar */}
      <div className="flex-col flex-shrink-0 mt-5 overflow-hidden bg-white border rounded-md w-72 border-slate-200">
        <div className="flex items-center flex-shrink-0 gap-2 px-4 py-3 border-b border-slate-200">
          <CalendarIcon className="flex-shrink-0 w-4 h-4" style={{ color: RED }} />
          <h3 className="font-semibold text-[13px] text-slate-900">Upcoming Events</h3>
        </div>
        <div className="flex-1 min-h-0 p-3 space-y-2 overflow-y-auto">
          {upcomingThisWeek.length === 0 ? (
            <p className="py-8 text-center text-slate-400 text-[12px]">
              No upcoming events this week.
            </p>
          ) : (
            upcomingThisWeek.map((ev) => {
              const st = eventStyle(ev.type);
              const evDate = new Date(ev.date);
              return (
                <div
                  key={ev.id}
                  className="flex items-start gap-2.5 p-2.5 rounded border border-slate-200"
                >
                  <span
                    className="flex-shrink-0 mt-1 rounded-full"
                    style={{ width: 7, height: 7, background: st.fg }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-slate-800 truncate">
                      {ev.title}
                    </p>
                    <p
                      className="text-[10.5px] text-slate-400 mt-0.5"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {evDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span
                    className="flex-shrink-0 text-[9.5px] uppercase tracking-[0.04em] font-medium"
                    style={{ color: st.fg }}
                  >
                    {st.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
      </div>

      {selectedDay && (
        <DayModal
          sel={selectedDay}
          events={events}
          isAdmin={isAdmin}
          submitting={addingEvent}
          onAdd={(title, type) => handleAddEventForDay(selectedDay.ad, title, type)}
          onDeleteRequest={(id) => setDeleteEventId(id)}
          onClose={() => setSelectedDay(null)}
        />
      )}

      {showCopy && (
        <CopyEventsModal
          events={events}
          targets={copyTargets.map((o) => ({ id: o.id, name: o.name }))}
          monthEventIds={
            new Set(
              events
                .filter((ev) => {
                  const bs = NepaliDate.fromAD(new Date(ev.date));
                  return bs.getYear() === cursor.y && bs.getMonth() === cursor.m;
                })
                .map((ev) => ev.id),
            )
          }
          monthLabel="This month"
          onClose={() => setShowCopy(false)}
        />
      )}

      {showBulkAdd && (
        <BulkAddModal
          // Start on today when it's in the month being viewed, otherwise on that month's first day.
          defaultDate={isoOfAd(
            cursor.y === todayBs.getYear() && cursor.m === todayBs.getMonth()
              ? today
              : new NepaliDate(cursor.y, cursor.m, 1).toJsDate(),
          )}
          onSave={handleBulkSave}
          onClose={() => setShowBulkAdd(false)}
        />
      )}

      <ConfirmationModal
        isOpen={deleteEventId !== null}
        onClose={() => setDeleteEventId(null)}
        onConfirm={handleDeleteEvent}
        title="Delete Event"
        message="Are you sure you want to delete this event? This action cannot be undone."
        confirmText="Delete"
        isLoading={deletingEvent}
      />

      <style>{`
        .cal-book { perspective: 1500px; height: 100%; display: flex; flex-direction: column; }
        .cal-binding {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0 28px; height: 20px; flex-shrink: 0; position: relative; z-index: 7;
        }
        .cal-ring {
          width: 7px; height: 16px; border: 1.6px solid #96A3AE; border-radius: 4px;
          background: #F6F7F9; box-shadow: inset 0 -1px 0 rgba(0,0,0,0.08);
          margin-bottom: -9px;
        }
        .cal-pages { position: relative; transform-style: preserve-3d; flex: 1; min-height: 0; }
        .cal-sheet {
          position: absolute; inset: 0; z-index: 5;
          transform-origin: top center;
          transform-style: preserve-3d;
          will-change: transform;
        }
        .cal-face {
          position: absolute; inset: 0;
          backface-visibility: hidden; -webkit-backface-visibility: hidden;
          border-radius: 6px; overflow: hidden;
          background: #fff;
          box-shadow: 0 16px 38px rgba(15, 23, 42, 0.16);
        }
        .cal-face-front::after {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(to bottom, rgba(255,255,255,0) 55%, rgba(15,23,42,0.06) 100%);
        }
        .cal-face-back {
          transform: rotateX(180deg);
          background:
            radial-gradient(ellipse at 50% 0%, rgba(15,23,42,0.05), transparent 60%),
            #fff;
          border: 1px solid #E2E8F0;
          display: flex; align-items: center; justify-content: center;
        }
        .cal-back-ghost {
          font-family: ui-monospace, monospace; font-size: 11px; letter-spacing: 0.3em;
          text-transform: uppercase; color: #94A3B8; opacity: 0.35;
          transform: scaleX(-1);
        }
        .cal-tint {
          position: absolute; inset: 0; pointer-events: none; background: #0F172A;
        }
        .cal-sheet-next { animation: calSheetNext 0.72s cubic-bezier(0.55, 0.06, 0.35, 1) forwards; }
        .cal-sheet-prev { animation: calSheetPrev 0.72s cubic-bezier(0.55, 0.06, 0.35, 1) forwards; }
        @keyframes calSheetNext { 0% { transform: rotateX(0deg); } 100% { transform: rotateX(-180deg); } }
        @keyframes calSheetPrev { 0% { transform: rotateX(-180deg); } 100% { transform: rotateX(0deg); } }
        .cal-tint-away { animation: calTintAway 0.72s ease-in forwards; }
        .cal-tint-arrive { animation: calTintArrive 0.72s ease-out forwards; }
        @keyframes calTintAway { 0% { opacity: 0; } 100% { opacity: 0.2; } }
        @keyframes calTintArrive { 0% { opacity: 0.2; } 100% { opacity: 0; } }
        .cal-shade {
          position: absolute; inset: 0; z-index: 3; pointer-events: none; border-radius: 6px;
          background: rgba(15, 23, 42, 0.12);
          animation: calShadeFade 0.72s ease-out forwards;
        }
        @keyframes calShadeFade { 0% { opacity: 1; } 100% { opacity: 0; } }
        .cal-shade-in { animation: calShadeGrow 0.72s ease-in forwards; }
        @keyframes calShadeGrow { 0% { opacity: 0; } 100% { opacity: 1; } }
        .cal-day { cursor: pointer; transition: background 0.12s; }
        .cal-day:hover { background: #EEF1F5 !important; }
        @media (prefers-reduced-motion: reduce) {
          .cal-sheet, .cal-shade, .cal-tint { animation: none !important; display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default CalendarPage;
