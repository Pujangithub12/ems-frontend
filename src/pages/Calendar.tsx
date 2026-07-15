import React, { useState, useEffect } from "react";
import NepaliDate from "nepali-date-converter";
import { getDailyPanchang } from "panchang-ts";
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Loader2,
  X,
  Calendar as CalendarIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthProvider";
import ConfirmationModal from "../components/ConfirmationModal";
import { useEvents, useCreateEvent, useDeleteEvent } from "../hooks/useEvents";
import type { CalendarEvent } from "../services/events.service";
import { getErrorMessage } from "../lib/errors";
import ErrorBanner from "../components/ErrorBanner";

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

// Public holidays / festivals, computed from real tithi (lunar day) via
// panchang-ts's astronomical engine, so it works for any BS year rather than
// being limited to a fixed data table. panchang-ts's own `region: 'nepal'`
// filter still surfaces plenty of pan-Indian/regional observances that aren't
// actually marked or observed as holidays in Nepal (Karva Chauth, Onam,
// monthly Ekadashi/Pradosha/Sankashti vratas, etc.), so results are further
// filtered to a curated set of festivals genuinely tied to Nepal's calendar,
// relabeled with the names used here (Dashain/Tihar stages etc.) instead of
// the library's India-centric names. Purely secular/fixed-BS-date holidays
// (Constitution Day, Democracy Day, Nepali New Year) aren't tithi-based at
// all, so they can't be derived this way and are simply not shown.
type HolidayInfo = { day: number; holiday: boolean; label: string };

const holidayCacheKey = (y: number, m: number) => `${y}-${m}`; // m is 0-indexed (BS)

const KATHMANDU_LOCATION = { latitude: 27.7172, longitude: 85.324 };
const NEPAL_TZ_OFFSET_MINUTES = 345; // NPT = UTC+5:45

const NEPAL_TITHI_FESTIVALS: Record<string, string> = {
  "Makar Sankranti": "Maghe Sankranti",
  "Maha Shivaratri": "Maha Shivaratri",
  "Holi": "Fagu Purnima (Holi)",
  "Rama Navami": "Ram Navami",
  "Krishna Janmashtami": "Krishna Janmashtami",
  "Ganesh Chaturthi": "Ganesh Chaturthi",
  "Raksha Bandhan": "Janai Purnima / Rakshya Bandhan",
  "Mahalaya Amavasya": "Pitri Aunsi",
  "Sharad Navaratri": "Ghatasthapana (Dashain begins)",
  "Durga Ashtami": "Maha Ashtami (Dashain)",
  "Maha Navami": "Maha Navami (Dashain)",
  "Dussehra": "Vijaya Dashami (Dashain)",
  "Sharad Purnima": "Kojagrat Purnima",
  "Dhanteras": "Dhanteras (Tihar begins)",
  "Narak Chaturdashi": "Kaag/Kukur Tihar",
  "Diwali": "Laxmi Puja (Tihar)",
  "Bhai Dooj": "Bhai Tika (Tihar ends)",
  "Chhath — Nahay Khay": "Chhath — Nahay Khay",
  "Chhath — Kharna": "Chhath — Kharna",
  "Chhath — Sandhya Arghya": "Chhath — Sandhya Arghya",
  "Chhath — Usha Arghya": "Chhath — Usha Arghya",
};

const computeTithiHolidaysForBsMonth = (y: number, m: number): HolidayInfo[] => {
  const totalDays = daysInBsMonth(y, m);
  const result: HolidayInfo[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const ad = new NepaliDate(y, m, d).toJsDate();
    const panchang = getDailyPanchang(ad, KATHMANDU_LOCATION, {
      timezone: NEPAL_TZ_OFFSET_MINUTES,
      region: "nepal",
    });
    const labels = (panchang?.festivals || [])
      .map((f) => NEPAL_TITHI_FESTIVALS[f.name])
      .filter((label): label is string => !!label);
    if (labels.length > 0) {
      result.push({ day: d, holiday: true, label: labels.join(", ") });
    }
  }
  return result;
};

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
  holidays?: HolidayInfo[];
  onDayClick?: (sel: DaySel) => void;
}> = ({ y, m, today, events, holidays = [], onDayClick }) => {
  const totalDays = daysInBsMonth(y, m);
  const holidayByDay = new Map(holidays.map((h) => [h.day, h]));
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

  return (
    <div className="overflow-hidden bg-white border rounded-md border-slate-200">
      <div className="flex items-baseline justify-between px-5 py-3 bg-white border-b border-slate-200">
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

      <div className="grid grid-cols-7 border-b border-slate-200">
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

      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (d === null) {
            return (
              <div
                key={`b${i}`}
                className="bg-slate-50"
                style={{
                  minHeight: 100,
                  borderRight: "1px solid #E2E8F0",
                  borderBottom: "1px solid #E2E8F0",
                  opacity: 0.5,
                }}
              />
            );
          }
          const ad = new NepaliDate(y, m, d).toJsDate();
          const sat = ad.getDay() === 6;
          const hol = holidayByDay.get(d);
          // Every Saturday comes back from the source as a holiday too (it's
          // Nepal's weekly day off) - only flag it separately when there's an
          // actual festival/holiday name, or it's a holiday on a non-Saturday.
          const notableHoliday = !!hol?.holiday && (!!hol.label || !sat);
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
              className={`relative px-2 pt-1.5 pb-2 ${onDayClick ? "cal-day" : ""}`}
              onClick={onDayClick ? () => onDayClick({ y, m, d, ad }) : undefined}
              style={{
                minHeight: 100,
                borderRight: "1px solid #E2E8F0",
                borderBottom: "1px solid #E2E8F0",
                background: sat || notableHoliday ? "#C6000906" : "#fff",
              }}
            >
              <div
                className="absolute"
                style={{
                  top: 6,
                  right: 8,
                  fontSize: 9.5,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: sat || notableHoliday ? "#C6000999" : "#94a3b8",
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
                    color: todayCell ? "#fff" : sat || notableHoliday ? RED : "#0f172a",
                  }}
                >
                  {new NepaliDate(y, m, d).format("D", "np")}
                </span>
              </div>
              <div className="space-y-0.5">
                {notableHoliday && (
                  <div
                    className="font-medium truncate rounded"
                    style={{ fontSize: 9.5, padding: "1.5px 5px", background: "#FEE2E2", color: "#B91C1C" }}
                    title={hol?.label || "Public Holiday"}
                  >
                    {hol?.label || "Public Holiday"}
                  </div>
                )}
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
  holidayInfo?: HolidayInfo;
  isAdmin: boolean;
  submitting: boolean;
  onAdd: (title: string, type: string) => void;
  onDeleteRequest: (id: number) => void;
  onClose: () => void;
}> = ({ sel, events, holidayInfo, isAdmin, submitting, onAdd, onDeleteRequest, onClose }) => {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("event");
  const bsDate = new NepaliDate(sel.y, sel.m, sel.d);
  const dayEvents = events.filter((ev) => isoOfAd(new Date(ev.date)) === isoOfAd(sel.ad));
  const holidayLabel =
    holidayInfo?.holiday &&
    (holidayInfo.label || (sel.ad.getDay() === 6 ? "Saturday — Weekly Holiday" : "Public Holiday"));

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

type MonthPos = { y: number; m: number };

const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const { data: events = [], isLoading: loading } = useEvents();
  const [holidaysByMonth, setHolidaysByMonth] = useState<Record<string, HolidayInfo[]>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const today = new Date();
  const todayBs = NepaliDate.fromAD(today);
  const [cursor, setCursor] = useState<MonthPos>({ y: todayBs.getYear(), m: todayBs.getMonth() });
  const [flip, setFlip] = useState<{ from: MonthPos; dir: "next" | "prev" } | null>(null);

  const [selectedDay, setSelectedDay] = useState<DaySel | null>(null);

  const [deleteEventId, setDeleteEventId] = useState<number | null>(null);

  const createEventMutation = useCreateEvent();
  const deleteEventMutation = useDeleteEvent();
  const addingEvent = createEventMutation.isPending;
  const deletingEvent = deleteEventMutation.isPending;

  const isAdmin = user?.role === "admin";

  // Compute holidays/festivals for the displayed BS month from tithi, cached
  // per month so navigating back to an already-seen month doesn't recompute.
  useEffect(() => {
    const key = holidayCacheKey(cursor.y, cursor.m);
    if (holidaysByMonth[key] !== undefined) return;
    const computed = computeTithiHolidaysForBsMonth(cursor.y, cursor.m);
    setHolidaysByMonth((prev) => ({ ...prev, [key]: computed }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor.y, cursor.m]);

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

  const handleDeleteEvent = async () => {
    if (deleteEventId === null) return;
    try {
      await deleteEventMutation.mutateAsync(deleteEventId);
      setDeleteEventId(null);
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to delete event."));
    }
  };

  return (
    <div className="max-w-5xl px-6 py-8 mx-auto lg:px-8 lg:py-10">
      {/* Header */}
      <div className="mb-6">
        <Eyebrow>Schedule & Deadlines</Eyebrow>
        <h2 className="font-semibold mt-1 text-[28px] tracking-tight text-slate-900">
          Company Calendar
        </h2>
      </div>

      {actionError && (
        <ErrorBanner
          message={actionError}
          onDismiss={() => setActionError(null)}
          className="mb-4"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
      <div className="flex flex-wrap items-center gap-4 mb-4">
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

      {/* Calendar book */}
      <div className="cal-book">
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
            holidays={holidaysByMonth[holidayCacheKey(underCursor.y, underCursor.m)] || []}
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
                  holidays={holidaysByMonth[holidayCacheKey(sheetCursor.y, sheetCursor.m)] || []}
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


      {selectedDay && (
        <DayModal
          sel={selectedDay}
          events={events}
          holidayInfo={(holidaysByMonth[holidayCacheKey(selectedDay.y, selectedDay.m)] || []).find(
            (h) => h.day === selectedDay.d,
          )}
          isAdmin={isAdmin}
          submitting={addingEvent}
          onAdd={(title, type) => handleAddEventForDay(selectedDay.ad, title, type)}
          onDeleteRequest={(id) => setDeleteEventId(id)}
          onClose={() => setSelectedDay(null)}
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
        .cal-book { perspective: 1500px; }
        .cal-binding {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0 28px; height: 20px; position: relative; z-index: 7;
        }
        .cal-ring {
          width: 7px; height: 16px; border: 1.6px solid #96A3AE; border-radius: 4px;
          background: #F6F7F9; box-shadow: inset 0 -1px 0 rgba(0,0,0,0.08);
          margin-bottom: -9px;
        }
        .cal-pages { position: relative; transform-style: preserve-3d; }
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
