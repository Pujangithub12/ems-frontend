import React, { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Camera, X, ClipboardList, Loader2, ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Calendar, MapPin, User, CheckCircle2, BarChart3, Plus } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useAuth } from "../../../context/AuthProvider";
import { useProjects } from "../../projects/hooks/useProjects";
import { getErrorMessage } from "../../../lib/errors";
import ErrorBanner from "../../../components/ErrorBanner";
import ConfirmationModal from "../../../components/ConfirmationModal";
import {
  useSiteActivityOptions,
  useAddSiteActivityOption,
  useSiteActivityReport,
  useSiteActivityReportsRange,
  useSaveSiteActivityReport,
  useDeleteSiteActivityReport,
  useUploadSiteActivityPhoto,
  useDeleteSiteActivityPhoto,
} from "../hooks/useSiteActivity";
import {
  SiteActivityReport,
  SaveSiteActivityReportPayload,
  SiteActivityItemStatus,
  SiteActivityEquipmentCondition,
  SiteActivityWeatherSlot,
  SiteActivityRainfall,
  SiteActivitySafetyType,
} from "../api/siteActivity.api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const fileUrl = (filePath: string) => `${API_BASE}/uploads/${filePath}`;

// ---- Palette lifted from the reference Site Diary design — scoped to this
// page only (via Tailwind arbitrary-value classes) rather than touched into
// the app-wide theme. ----
const FONT_DISPLAY = "'Barlow Semi Condensed', sans-serif";
const FONT_BODY = "'IBM Plex Sans', sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

// ---- Date helpers ----
const todayIso = () => new Date().toLocaleDateString("en-CA");
const shiftDateIso = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
};
const formatFullDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
/** Monday of the week containing `iso`. */
const getWeekStart = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toLocaleDateString("en-CA");
};
const formatShortDate = (iso: string): string => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit" });
/** "Today" / "Yesterday" for the day-switcher label, else a short date. */
const dayLabel = (iso: string): string => {
  if (iso === todayIso()) return "Today";
  if (iso === shiftDateIso(todayIso(), -1)) return "Yesterday";
  return formatShortDate(iso);
};
const formatShortDateWithYear = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
const WEEKDAY_LABEL = (iso: string): string => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });

// ---- Row types (local editable draft shape — separate from the API's
// SiteActivity* read shape, mirrors SaveSiteActivity*Payload). ----
type FormActivity = { description: string; chainage: string; todayQty: string; unit: string; status: SiteActivityItemStatus; remarks: string };
type FormEquipment = { equipmentName: string; quantity: string; workingHours: string; condition: SiteActivityEquipmentCondition; remarks: string };
type FormManpower = { role: string; headcount: string; names: string; remarks: string };
type FormWeather = { slot: SiteActivityWeatherSlot; condition: string; tempC: string; rainfall: SiteActivityRainfall | ""; remarks: string };
type FormMaterial = { materialType: string; receivedQuantity: string; receivedUnit: string; usedQuantity: string; usedUnit: string; remarks: string };
type FormSafety = { type: SiteActivitySafetyType; description: string; actionTaken: string };
type FormInstruction = { description: string; byWhom: string; toWhom: string; time: string; signatureOf: string };

const emptyActivity = (): FormActivity => ({ description: "", chainage: "", todayQty: "", unit: "", status: "ongoing", remarks: "" });
const emptyEquipment = (): FormEquipment => ({ equipmentName: "", quantity: "1", workingHours: "", condition: "working", remarks: "" });
const emptyMaterial = (): FormMaterial => ({ materialType: "", receivedQuantity: "", receivedUnit: "", usedQuantity: "", usedUnit: "", remarks: "" });
const emptySafety = (): FormSafety => ({ type: "observation", description: "", actionTaken: "" });
const emptyInstruction = (): FormInstruction => ({ description: "", byWhom: "", toWhom: "", time: "", signatureOf: "" });

const WEATHER_SLOTS: SiteActivityWeatherSlot[] = ["morning", "afternoon", "evening"];
const WEATHER_SLOT_LABEL: Record<SiteActivityWeatherSlot, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
const emptyWeatherRows = (): FormWeather[] => WEATHER_SLOTS.map((slot) => ({ slot, condition: "", tempC: "", rainfall: "" as const, remarks: "" }));
const DEFAULT_ROLES = ["Site Engineer", "Supervisor", "Skilled Labor", "Unskilled Labor", "Safety Personnel"];
const emptyManpowerRows = (): FormManpower[] => DEFAULT_ROLES.map((role) => ({ role, headcount: "", names: "", remarks: "" }));

const TINT: Record<string, string> = {
  ongoing: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  working: "bg-emerald-100 text-emerald-700",
  idle: "bg-slate-100 text-slate-600",
  breakdown: "bg-red-100 text-red-700",
  observation: "bg-blue-100 text-blue-700",
  incident: "bg-red-100 text-red-700",
};
const tintCls = (value: string) => `${TINT[value] || "bg-slate-100 text-slate-600"} rounded-full font-medium`;

// ---- Shared styling ----
const cellInputCls =
  "w-full border border-slate-200 bg-white px-1.5 py-1.5 rounded text-[13px] text-slate-900 hover:border-slate-300 focus:outline-none focus:border-blue-600 transition-colors";
const cellMonoCls = `${cellInputCls}`;
const thCls = "text-left text-[11px] font-semibold text-slate-500 px-3 py-2.5 bg-slate-50 border-b border-slate-200 whitespace-nowrap";
const tdCls = "px-3 py-2 border-b border-slate-100 align-middle";
const metaInputCls =
  "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13.5px] bg-slate-50 text-slate-900 focus:outline-none focus:border-blue-600";

/** Left/Right arrow at a text field's edge moves focus to the next/previous editable field in
 * the same table row (or same manpower row, via [data-arrow-row]), instead of doing nothing —
 * shared across every table on this page. Only wired to plain text/number inputs, never
 * <select>s (whose own left/right behavior must stay untouched). */
const handleRowArrowNav = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const input = e.currentTarget;
  if (input.selectionStart !== input.selectionEnd) return; // a range is selected — let the browser collapse it first
  const atStart = input.selectionStart === 0;
  const atEnd = input.selectionStart === input.value.length;
  if (!((e.key === "ArrowLeft" && atStart) || (e.key === "ArrowRight" && atEnd))) return;

  const row = input.closest<HTMLElement>("tr, [data-arrow-row]");
  if (!row) return;
  const fields = Array.from(row.querySelectorAll<HTMLInputElement>("input[type='text'], input:not([type])")).filter((el) => !el.disabled);
  const idx = fields.indexOf(input);
  if (idx === -1) return;
  const next = fields[e.key === "ArrowRight" ? idx + 1 : idx - 1];
  if (next) {
    e.preventDefault();
    next.focus();
    const pos = e.key === "ArrowRight" ? 0 : next.value.length;
    next.setSelectionRange(pos, pos);
  }
};

// ---- Small building blocks ----

const SectionCard: React.FC<{ idx: string; title: string; badge?: string; onAdd?: () => void; addLabel?: string; children: React.ReactNode }> = ({
  idx,
  title,
  badge,
  onAdd,
  addLabel,
  children,
}) => (
  <section className="bg-white border border-slate-200 rounded-xl shadow-sm mb-4">
    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100">
      <h3 className="flex-1 font-semibold text-[15px] text-slate-900 m-0">
        {idx}. {title}
      </h3>
      {badge && <span className="px-2 py-0.5 text-[11px] font-medium text-slate-500 bg-slate-100 rounded-full">{badge}</span>}
      {onAdd && (
        <button
          onClick={onAdd}
          className="px-2.5 py-1 text-[12px] font-medium border border-slate-200 rounded-lg text-blue-600 hover:border-blue-600 hover:bg-blue-50 transition-colors"
        >
          + {addLabel}
        </button>
      )}
    </div>
    <div className="py-1 overflow-x-auto">{children}</div>
  </section>
);

const RowDelBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} className="p-1 text-[#94a3b8] hover:text-[#b91c1c] transition-colors" title="Remove row">
    <Trash2 size={13} />
  </button>
);

/** Popup for the "+" button next to a predefined-options dropdown (Work
 * description / Equipment name / Material type) — adds a new option to the
 * org's vocabulary for that kind. The dropdown itself is select-only (no
 * free typing), so this is the only way to introduce a new value. */
const AddOptionModal: React.FC<{
  isOpen: boolean;
  saving: boolean;
  title: string;
  fieldLabel: string;
  placeholder: string;
  onClose: () => void;
  onAdd: (name: string) => void;
}> = ({ isOpen, saving, title, fieldLabel, placeholder, onClose, onAdd }) => {
  const [value, setValue] = useState("");
  useEffect(() => {
    if (isOpen) setValue("");
  }, [isOpen]);
  if (!isOpen) return null;
  const submit = () => {
    const name = value.trim();
    if (!name) return;
    onAdd(name);
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-[#0f172a]/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-white border border-[#e2e8f0]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2e8f0]">
          <h3 className="font-semibold text-[15px] text-[#0f172a]" style={{ fontFamily: FONT_DISPLAY }}>
            {title}
          </h3>
          <button onClick={onClose} className="p-1 text-[#94a3b8] hover:text-[#0f172a] transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="p-4">
          <label className="block mb-1 text-[10.5px] text-[#64748b] tracking-wide">{fieldLabel}</label>
          <input
            autoFocus
            className={metaInputCls}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>
        <div className="flex justify-end gap-2 px-4 pb-4">
          <button onClick={onClose} className="px-3 py-1.5 text-[12.5px] border border-[#cbd5e1] rounded-[3px] text-[#64748b] hover:bg-[#f1f5f9] transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!value.trim() || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium text-white bg-[#1d4ed8] rounded-[3px] hover:bg-[#1e3a8a] transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const EmptyRow: React.FC<{ colSpan: number }> = ({ colSpan }) => (
  <tr>
    <td colSpan={colSpan} className="px-2.5 py-4 text-[12.5px] text-center text-[#94a3b8]">
      No entries yet — use "+ Add" above.
    </td>
  </tr>
);

// ---- Photos ----

const PhotosSection: React.FC<{ report: SiteActivityReport | null; projectId: number; date: string }> = ({ report, projectId, date }) => {
  const uploadMutation = useUploadSiteActivityPhoto(projectId, date);
  const deleteMutation = useDeleteSiteActivityPhoto(projectId, date);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file || !report) return;
    setError(null);
    try {
      await uploadMutation.mutateAsync({ reportId: report.id, file });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to upload photo."));
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm mb-4">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100">
        <h3 className="flex-1 font-semibold text-[15px] text-slate-900 m-0">Site Photographs ({report?.photos.length ?? 0})</h3>
      </div>
      <div className="p-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-3" />}
        {!report ? (
          <p className="text-[12.5px] text-slate-400">Add at least one entry above (it autosaves) before attaching photos.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {report.photos.map((p) => (
              <div key={p.id} className="relative overflow-hidden border border-slate-200 rounded-lg group aspect-[4/3] bg-slate-100">
                <img src={fileUrl(p.filePath)} alt={p.caption ?? p.fileName} className="object-cover w-full h-full" />
                <button
                  onClick={() => deleteMutation.mutate(p.id)}
                  title="Delete photo"
                  className="absolute flex items-center justify-center w-5 h-5 text-white transition-opacity rounded-full opacity-0 top-1 right-1 bg-black/60 group-hover:opacity-100 hover:bg-red-600"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="flex flex-col items-center justify-center gap-1 text-slate-500 border-[1.5px] border-dashed border-slate-200 rounded-lg aspect-[4/3] hover:border-blue-600 hover:text-blue-600 disabled:opacity-50 transition-colors"
            >
              {uploadMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
              <span className="text-[11px] font-medium">Add photo</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
};

// ---- Weekly Summary — aggregates a project's daily entries over one
// Mon-Sun week (one range request), plus a cumulative-progress S-curve. ----

const InfoCard: React.FC<{ title: string; badge?: string; children: React.ReactNode }> = ({ title, badge, children }) => (
  <section className="bg-white border border-slate-200 rounded-xl shadow-sm mb-4">
    <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100">
      <h3 className="flex-1 font-semibold text-[15px] text-slate-900 m-0">{title}</h3>
      {badge && <span className="px-2 py-0.5 text-[11px] font-medium text-slate-500 bg-slate-100 rounded-full">{badge}</span>}
    </div>
    <div className="py-1">{children}</div>
  </section>
);

const WeekStat: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-3.5">
    <p className="m-0 text-[10.5px] text-slate-500 tracking-wide">{label}</p>
    <p className="m-0 mt-1 font-bold text-[20px] text-slate-900">{value}</p>
    {sub && <p className="m-0 mt-0.5 text-[11px] text-slate-400">{sub}</p>}
  </div>
);

const WeeklySummary: React.FC<{ projectId: number; weekStart: string; onWeekStart: (iso: string) => void }> = ({ projectId, weekStart, onWeekStart }) => {
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDateIso(weekStart, i)), [weekStart]);
  const weekEnd = weekDays[6]!;
  const { data: reports = [], isLoading } = useSiteActivityReportsRange(projectId, weekStart, weekEnd);
  const isCurrentWeek = weekStart === getWeekStart(todayIso());

  const totals = useMemo(() => {
    const daysReported = reports.length;
    const totalActivities = reports.reduce((sum, r) => sum + r.activities.length, 0);
    const totalQtyCompleted = reports.reduce((sum, r) => sum + r.activities.reduce((s, a) => s + (a.todayQty ?? 0), 0), 0);
    const totalManpowerDays = reports.reduce((sum, r) => sum + r.manpower.reduce((s, m) => s + m.headcount, 0), 0);
    const totalEquipmentHours = reports.reduce((sum, r) => sum + r.equipment.reduce((s, e) => s + (e.workingHours ?? 0), 0), 0);
    const incidents = reports.flatMap((r) => r.safety.filter((s) => s.type === "incident").map((s) => ({ ...s, date: r.reportDate })));
    const observations = reports.flatMap((r) => r.safety.filter((s) => s.type === "observation").map((s) => ({ ...s, date: r.reportDate })));
    return { daysReported, totalActivities, totalQtyCompleted, totalManpowerDays, totalEquipmentHours, incidents, observations };
  }, [reports]);

  const materialTotals = useMemo(() => {
    const byMaterial = new Map<string, { materialType: string; receivedQuantity: number; receivedUnit: string; usedQuantity: number; usedUnit: string }>();
    for (const r of reports) {
      for (const m of r.materials) {
        const key = m.materialType.toLowerCase();
        const existing = byMaterial.get(key) ?? {
          materialType: m.materialType,
          receivedQuantity: 0,
          receivedUnit: m.receivedUnit ?? "",
          usedQuantity: 0,
          usedUnit: m.usedUnit ?? "",
        };
        existing.receivedQuantity += m.receivedQuantity ?? 0;
        existing.usedQuantity += m.usedQuantity ?? 0;
        if (!existing.receivedUnit && m.receivedUnit) existing.receivedUnit = m.receivedUnit;
        if (!existing.usedUnit && m.usedUnit) existing.usedUnit = m.usedUnit;
        byMaterial.set(key, existing);
      }
    }
    return Array.from(byMaterial.values());
  }, [reports]);

  const activitiesWeekly = useMemo(
    () => reports.flatMap((r) => r.activities.map((a) => ({ ...a, date: r.reportDate }))).sort((a, b) => a.date.localeCompare(b.date)),
    [reports],
  );

  // Per-role headcount broken down by each day of the week, for the Manpower Breakdown box.
  const manpowerDailyWeekly = useMemo(() => {
    const roles = new Set<string>();
    const byRoleDay = new Map<string, Map<string, number>>();
    for (const r of reports) {
      for (const m of r.manpower) {
        if (m.headcount <= 0) continue;
        roles.add(m.role);
        if (!byRoleDay.has(m.role)) byRoleDay.set(m.role, new Map());
        byRoleDay.get(m.role)!.set(r.reportDate, m.headcount);
      }
    }
    return Array.from(roles).map((role) => {
      const byDay = weekDays.map((d) => byRoleDay.get(role)?.get(d) ?? 0);
      return { role, byDay, total: byDay.reduce((s, n) => s + n, 0) };
    });
  }, [reports, weekDays]);
  const manpowerDailyTotals = useMemo(
    () => weekDays.map((d) => reports.find((r) => r.reportDate === d)?.manpower.reduce((s, m) => s + m.headcount, 0) ?? 0),
    [reports, weekDays],
  );

  const equipmentWeekly = useMemo(() => {
    const byEquipment = new Map<string, { equipmentName: string; entries: number; totalHours: number }>();
    for (const r of reports) {
      for (const e of r.equipment) {
        const key = e.equipmentName.toLowerCase();
        const existing = byEquipment.get(key) ?? { equipmentName: e.equipmentName, entries: 0, totalHours: 0 };
        existing.entries += 1;
        existing.totalHours += e.workingHours ?? 0;
        byEquipment.set(key, existing);
      }
    }
    return Array.from(byEquipment.values());
  }, [reports]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="font-bold text-[22px] m-0 mb-0.5 text-[#0f172a]" style={{ fontFamily: FONT_DISPLAY }}>
            Weekly Summary
          </h2>
          <p className="m-0 text-[12.5px] text-[#64748b]">
            {formatShortDateWithYear(weekStart)} – {formatShortDateWithYear(weekEnd)}
            {isCurrentWeek ? " (This Week)" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 px-1 py-1 bg-white border border-[#e2e8f0] rounded-[3px]">
          <button onClick={() => onWeekStart(shiftDateIso(weekStart, -7))} className="p-1.5 rounded-[3px] hover:bg-[#f8fafc] text-[#64748b]">
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => onWeekStart(getWeekStart(todayIso()))}
            className="px-2 py-1 text-[11.5px] font-medium rounded-[3px] text-[#0f172a] hover:bg-[#f8fafc]"
          >
            This Week
          </button>
          <button
            onClick={() => onWeekStart(shiftDateIso(weekStart, 7))}
            disabled={isCurrentWeek}
            className="p-1.5 rounded-[3px] hover:bg-[#f8fafc] text-[#64748b] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[#94a3b8]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-3 lg:grid-cols-5">
            <WeekStat label="Days Reported" value={`${totals.daysReported} / 7`} />
            <WeekStat label="Work Items Logged" value={`${totals.totalActivities}`} sub={`${totals.totalQtyCompleted} total qty completed`} />
            <WeekStat label="Manpower (person-days)" value={`${totals.totalManpowerDays}`} />
            <WeekStat label="Equipment Hours" value={`${totals.totalEquipmentHours}`} />
            <WeekStat label="Safety Incidents" value={`${totals.incidents.length}`} sub={`${totals.observations.length} observations`} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <InfoCard title="Work Activities — This Week" badge={`${activitiesWeekly.length} items · ${totals.totalQtyCompleted} qty`}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th className={thCls}>Date</th>
                      <th className={thCls}>Description</th>
                      <th className={thCls}>Qty</th>
                      <th className={thCls}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activitiesWeekly.length === 0 ? (
                      <EmptyRow colSpan={4} />
                    ) : (
                      activitiesWeekly.map((a, i) => (
                        <tr key={i} className="hover:bg-[#f8fafc]">
                          <td className={`${tdCls} text-[#64748b]`}>{formatShortDate(a.date)}</td>
                          <td className={`${tdCls} text-[#0f172a]`}>{a.description}</td>
                          <td className={`${tdCls} text-[#64748b]`}>
                            {a.todayQty ?? "—"} {a.unit ?? ""}
                          </td>
                          <td className={tdCls}>
                            <span className={`px-2 py-0.5 text-[11px] ${tintCls(a.status)}`}>{a.status === "completed" ? "Completed" : "Ongoing"}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </InfoCard>

            <InfoCard title="Manpower Breakdown — This Week" badge={`${totals.totalManpowerDays} person-days`}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th className={thCls}>Category</th>
                      {weekDays.map((d) => (
                        <th key={d} className={`${thCls} text-center`} style={{ width: 56 }}>
                          {WEEKDAY_LABEL(d)}
                        </th>
                      ))}
                      <th className={`${thCls} text-center`} style={{ width: 56 }}>
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {manpowerDailyWeekly.length === 0 ? (
                      <EmptyRow colSpan={9} />
                    ) : (
                      manpowerDailyWeekly.map((m) => (
                        <tr key={m.role} className="hover:bg-[#f8fafc]">
                          <td className={`${tdCls} font-medium text-[#0f172a]`}>{m.role}</td>
                          {m.byDay.map((n, i) => (
                            <td key={weekDays[i]} className={`${tdCls} text-center text-[#64748b]`}>
                              {n || "—"}
                            </td>
                          ))}
                          <td className={`${tdCls} text-center font-semibold text-[#1d4ed8]`}>{m.total}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {manpowerDailyWeekly.length > 0 && (
                    <tfoot>
                      <tr className="bg-blue-50">
                        <td className={`${tdCls} font-semibold text-blue-900`}>Total Headcount</td>
                        {manpowerDailyTotals.map((n, i) => (
                          <td key={weekDays[i]} className={`${tdCls} text-center font-semibold text-blue-900`}>
                            {n || "—"}
                          </td>
                        ))}
                        <td className={`${tdCls} text-center font-bold text-blue-900`}>{totals.totalManpowerDays}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </InfoCard>

            <InfoCard title="Equipment — This Week" badge={`${totals.totalEquipmentHours} hrs`}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th className={thCls}>Equipment / plant</th>
                      <th className={thCls}>Times Logged</th>
                      <th className={thCls}>Total Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipmentWeekly.length === 0 ? (
                      <EmptyRow colSpan={3} />
                    ) : (
                      equipmentWeekly.map((e) => (
                        <tr key={e.equipmentName} className="hover:bg-[#f8fafc]">
                          <td className={`${tdCls} font-medium text-[#0f172a]`}>{e.equipmentName}</td>
                          <td className={`${tdCls} text-[#64748b]`}>{e.entries}</td>
                          <td className={`${tdCls} text-[#64748b]`}>{e.totalHours}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </InfoCard>

            <InfoCard title="Materials — This Week" badge={`${materialTotals.length} type${materialTotals.length === 1 ? "" : "s"}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th className={thCls}>Material Type</th>
                      <th className={thCls}>Received</th>
                      <th className={thCls}>Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialTotals.length === 0 ? (
                      <EmptyRow colSpan={3} />
                    ) : (
                      materialTotals.map((m) => (
                        <tr key={m.materialType} className="hover:bg-[#f8fafc]">
                          <td className={`${tdCls} font-medium text-[#0f172a]`}>{m.materialType}</td>
                          <td className={`${tdCls} text-[#64748b]`}>
                            {m.receivedQuantity} {m.receivedUnit}
                          </td>
                          <td className={`${tdCls} text-[#64748b]`}>
                            {m.usedQuantity} {m.usedUnit}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </InfoCard>
          </div>
        </>
      )}
    </div>
  );
};

// ---- Overview — the project's entire site-diary history to date, aggregated
// the same way as Weekly Summary but with no week boundary (and no day-by-day
// manpower matrix, which wouldn't scale past a handful of days). ----

const OverviewSummary: React.FC<{ projectId: number }> = ({ projectId }) => {
  // "All reports for this project" has no dedicated endpoint — reuse the range
  // endpoint with a wide-enough floor date to capture the project's whole history.
  const from = "2015-01-01";
  const to = todayIso();
  const { data: reports = [], isLoading } = useSiteActivityReportsRange(projectId, from, to);

  const sortedReports = useMemo(() => [...reports].sort((a, b) => a.reportDate.localeCompare(b.reportDate)), [reports]);
  const [manpowerDailyView, setManpowerDailyView] = useState(false);

  const totals = useMemo(() => {
    const daysReported = reports.length;
    const totalActivities = reports.reduce((sum, r) => sum + r.activities.length, 0);
    const totalQtyCompleted = reports.reduce((sum, r) => sum + r.activities.reduce((s, a) => s + (a.todayQty ?? 0), 0), 0);
    const totalManpowerDays = reports.reduce((sum, r) => sum + r.manpower.reduce((s, m) => s + m.headcount, 0), 0);
    const totalEquipmentHours = reports.reduce((sum, r) => sum + r.equipment.reduce((s, e) => s + (e.workingHours ?? 0), 0), 0);
    const incidents = reports.reduce((sum, r) => sum + r.safety.filter((s) => s.type === "incident").length, 0);
    const observations = reports.reduce((sum, r) => sum + r.safety.filter((s) => s.type === "observation").length, 0);
    return { daysReported, totalActivities, totalQtyCompleted, totalManpowerDays, totalEquipmentHours, incidents, observations };
  }, [reports]);

  const materialTotals = useMemo(() => {
    const byMaterial = new Map<string, { materialType: string; receivedQuantity: number; receivedUnit: string; usedQuantity: number; usedUnit: string }>();
    for (const r of reports) {
      for (const m of r.materials) {
        const key = m.materialType.toLowerCase();
        const existing = byMaterial.get(key) ?? {
          materialType: m.materialType,
          receivedQuantity: 0,
          receivedUnit: m.receivedUnit ?? "",
          usedQuantity: 0,
          usedUnit: m.usedUnit ?? "",
        };
        existing.receivedQuantity += m.receivedQuantity ?? 0;
        existing.usedQuantity += m.usedQuantity ?? 0;
        if (!existing.receivedUnit && m.receivedUnit) existing.receivedUnit = m.receivedUnit;
        if (!existing.usedUnit && m.usedUnit) existing.usedUnit = m.usedUnit;
        byMaterial.set(key, existing);
      }
    }
    return Array.from(byMaterial.values());
  }, [reports]);

  const manpowerTotals = useMemo(() => {
    const byRole = new Map<string, number>();
    for (const r of reports) {
      for (const m of r.manpower) {
        if (m.headcount <= 0) continue;
        byRole.set(m.role, (byRole.get(m.role) ?? 0) + m.headcount);
      }
    }
    return Array.from(byRole.entries()).map(([role, headcount]) => ({ role, headcount }));
  }, [reports]);

  // Only columns for dates that actually have a report (not every calendar date since project
  // start) — a project can run for years, so a fixed daily grid would be mostly empty columns.
  const manpowerDaily = useMemo(() => {
    const roles = new Set<string>();
    const byRoleDay = new Map<string, Map<string, number>>();
    for (const r of sortedReports) {
      for (const m of r.manpower) {
        if (m.headcount <= 0) continue;
        roles.add(m.role);
        if (!byRoleDay.has(m.role)) byRoleDay.set(m.role, new Map());
        byRoleDay.get(m.role)!.set(r.reportDate, m.headcount);
      }
    }
    return Array.from(roles).map((role) => ({
      role,
      byDay: sortedReports.map((r) => byRoleDay.get(role)?.get(r.reportDate) ?? 0),
    }));
  }, [sortedReports]);
  const manpowerDailyTotals = useMemo(() => sortedReports.map((r) => r.manpower.reduce((s, m) => s + m.headcount, 0)), [sortedReports]);

  const equipmentTotals = useMemo(() => {
    const byEquipment = new Map<string, { equipmentName: string; entries: number; totalHours: number }>();
    for (const r of reports) {
      for (const e of r.equipment) {
        const key = e.equipmentName.toLowerCase();
        const existing = byEquipment.get(key) ?? { equipmentName: e.equipmentName, entries: 0, totalHours: 0 };
        existing.entries += 1;
        existing.totalHours += e.workingHours ?? 0;
        byEquipment.set(key, existing);
      }
    }
    return Array.from(byEquipment.values());
  }, [reports]);

  const curveData = useMemo(() => {
    let cumulative = 0;
    return sortedReports.map((r) => {
      const daily = r.activities.reduce((s, a) => s + (a.todayQty ?? 0), 0);
      cumulative += daily;
      return { label: formatShortDate(r.reportDate), daily, cumulative };
    });
  }, [sortedReports]);

  const firstDate = sortedReports[0]?.reportDate;

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-bold text-[22px] m-0 mb-0.5 text-slate-900">All-Time Overview</h2>
        <p className="m-0 text-[12.5px] text-slate-500">{firstDate ? `${formatShortDateWithYear(firstDate)} – Today` : "No entries logged yet"}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-3 lg:grid-cols-5">
            <WeekStat label="Days Reported" value={`${totals.daysReported}`} />
            <WeekStat label="Work Items Logged" value={`${totals.totalActivities}`} sub={`${totals.totalQtyCompleted} total qty completed`} />
            <WeekStat label="Manpower (person-days)" value={`${totals.totalManpowerDays}`} />
            <WeekStat label="Equipment Hours" value={`${totals.totalEquipmentHours}`} />
            <WeekStat label="Safety Incidents" value={`${totals.incidents}`} sub={`${totals.observations} observations`} />
          </div>

          <InfoCard title="Cumulative Progress (S-Curve)">
            <div className="px-[10px] pt-3" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curveData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scurveFillOverview" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1e3a8a" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} interval="preserveStartEnd" minTickGap={30} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} width={36} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 3, borderColor: "#e2e8f0" }}
                    formatter={((value: number, name: string) => [value, name === "cumulative" ? "Cumulative qty" : "Daily qty"]) as any}
                  />
                  <Area type="monotone" dataKey="cumulative" stroke="#1d4ed8" strokeWidth={2} fill="url(#scurveFillOverview)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="px-[18px] pb-3 pt-1 text-[11.5px] text-[#94a3b8]">
              Cumulative "today qty" completed across every Work Activities row logged for this project so far.
            </p>
          </InfoCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <InfoCard title="Work Activities — All Time" badge={`${totals.totalActivities} items · ${totals.totalQtyCompleted} qty`}>
              <div className="overflow-x-auto" style={{ maxHeight: 320, overflowY: "auto" }}>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th className={thCls}>Date</th>
                      <th className={thCls}>Description</th>
                      <th className={thCls}>Qty</th>
                      <th className={thCls}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReports.flatMap((r) => r.activities.map((a) => ({ ...a, date: r.reportDate }))).length === 0 ? (
                      <EmptyRow colSpan={4} />
                    ) : (
                      [...sortedReports]
                        .reverse()
                        .flatMap((r) => r.activities.map((a) => ({ ...a, date: r.reportDate })))
                        .map((a, i) => (
                          <tr key={i} className="hover:bg-[#f8fafc]">
                            <td className={`${tdCls} text-[#64748b]`}>{formatShortDate(a.date)}</td>
                            <td className={`${tdCls} text-[#0f172a]`}>{a.description}</td>
                            <td className={`${tdCls} text-[#64748b]`}>
                              {a.todayQty ?? "—"} {a.unit ?? ""}
                            </td>
                            <td className={tdCls}>
                              <span className={`px-2 py-0.5 text-[11px] ${tintCls(a.status)}`}>{a.status === "completed" ? "Completed" : "Ongoing"}</span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </InfoCard>

            <InfoCard title="Manpower — All Time" badge={`${totals.totalManpowerDays} person-days`}>
              <div className="flex items-center justify-end px-3 pt-1">
                <button
                  onClick={() => setManpowerDailyView((v) => !v)}
                  className="text-[11.5px] font-medium text-blue-600 hover:underline"
                >
                  {manpowerDailyView ? "Show totals only" : "Break down by day"}
                </button>
              </div>
              {manpowerDailyView ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr>
                        <th className={thCls}>Category</th>
                        {sortedReports.map((r) => (
                          <th key={r.reportDate} className={`${thCls} text-center`} style={{ width: 60 }}>
                            {formatShortDate(r.reportDate)}
                          </th>
                        ))}
                        <th className={`${thCls} text-center`} style={{ width: 60 }}>
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {manpowerDaily.length === 0 ? (
                        <EmptyRow colSpan={2} />
                      ) : (
                        manpowerDaily.map((m) => (
                          <tr key={m.role} className="hover:bg-[#f8fafc]">
                            <td className={`${tdCls} font-medium text-[#0f172a]`}>{m.role}</td>
                            {m.byDay.map((n, i) => (
                              <td key={sortedReports[i]!.reportDate} className={`${tdCls} text-center text-[#64748b]`}>
                                {n || "—"}
                              </td>
                            ))}
                            <td className={`${tdCls} text-center font-semibold text-[#1d4ed8]`}>{m.byDay.reduce((s, n) => s + n, 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {manpowerDaily.length > 0 && (
                      <tfoot>
                        <tr className="bg-blue-50">
                          <td className={`${tdCls} font-semibold text-blue-900`}>Total Headcount</td>
                          {manpowerDailyTotals.map((n, i) => (
                            <td key={sortedReports[i]!.reportDate} className={`${tdCls} text-center font-semibold text-blue-900`}>
                              {n || "—"}
                            </td>
                          ))}
                          <td className={`${tdCls} text-center font-bold text-blue-900`}>{totals.totalManpowerDays}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              ) : (
                <div className="px-2 py-1">
                  {manpowerTotals.length === 0 ? (
                    <p className="px-3 py-6 text-[12.5px] text-center text-slate-400">No manpower logged yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {manpowerTotals.map((m) => (
                        <div key={m.role} className="flex items-center justify-between px-3 py-2.5">
                          <span className="text-[13.5px] font-medium text-slate-800">{m.role}</span>
                          <span className="text-[13px] text-slate-500">
                            {m.headcount} person-day{m.headcount === 1 ? "" : "s"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3 py-2.5 mt-1.5 mb-1 border border-blue-200 rounded-lg bg-blue-50">
                    <span className="text-[13px] font-medium text-blue-900">Total Person-Days</span>
                    <span className="text-[14px] font-bold text-blue-900">{totals.totalManpowerDays} Total</span>
                  </div>
                </div>
              )}
            </InfoCard>

            <InfoCard title="Equipment — All Time" badge={`${totals.totalEquipmentHours} hrs`}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th className={thCls}>Equipment / plant</th>
                      <th className={thCls}>Times Logged</th>
                      <th className={thCls}>Total Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipmentTotals.length === 0 ? (
                      <EmptyRow colSpan={3} />
                    ) : (
                      equipmentTotals.map((e) => (
                        <tr key={e.equipmentName} className="hover:bg-[#f8fafc]">
                          <td className={`${tdCls} font-medium text-[#0f172a]`}>{e.equipmentName}</td>
                          <td className={`${tdCls} text-[#64748b]`}>{e.entries}</td>
                          <td className={`${tdCls} text-[#64748b]`}>{e.totalHours}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </InfoCard>

            <InfoCard title="Materials — All Time" badge={`${materialTotals.length} type${materialTotals.length === 1 ? "" : "s"}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th className={thCls}>Material Type</th>
                      <th className={thCls}>Received</th>
                      <th className={thCls}>Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialTotals.length === 0 ? (
                      <EmptyRow colSpan={3} />
                    ) : (
                      materialTotals.map((m) => (
                        <tr key={m.materialType} className="hover:bg-[#f8fafc]">
                          <td className={`${tdCls} font-medium text-[#0f172a]`}>{m.materialType}</td>
                          <td className={`${tdCls} text-[#64748b]`}>
                            {m.receivedQuantity} {m.receivedUnit}
                          </td>
                          <td className={`${tdCls} text-[#64748b]`}>
                            {m.usedQuantity} {m.usedUnit}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </InfoCard>
          </div>
        </>
      )}
    </div>
  );
};

// ---- Root page ----

const SiteActivities: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const { data: projects = [] } = useProjects();

  const [projectId, setProjectId] = useState<number | "">("");
  const [date, setDate] = useState(todayIso());
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "overview">("daily");
  const [weekStart, setWeekStart] = useState(() => getWeekStart(todayIso()));

  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const { data: report, isLoading } = useSiteActivityReport(projectId || null, date);
  const { data: workTypes = [] } = useSiteActivityOptions("activity");
  const { data: equipmentTypes = [] } = useSiteActivityOptions("equipment");
  const { data: materialTypes = [] } = useSiteActivityOptions("material");
  const addWorkTypeMutation = useAddSiteActivityOption("activity");
  const addEquipmentTypeMutation = useAddSiteActivityOption("equipment");
  const addMaterialTypeMutation = useAddSiteActivityOption("material");
  const [addWorkTypeFor, setAddWorkTypeFor] = useState<number | null>(null);
  const [addEquipmentTypeFor, setAddEquipmentTypeFor] = useState<number | null>(null);
  const [addMaterialTypeFor, setAddMaterialTypeFor] = useState<number | null>(null);
  const saveMutation = useSaveSiteActivityReport(projectId || null, date);
  const deleteMutation = useDeleteSiteActivityReport(projectId || null, date);

  // ---- Draft state — one field per editable piece of the report, mirroring
  // SaveSiteActivityReportPayload. Autosaves (debounced) on any change. ----
  const [location, setLocation] = useState("");
  const [reportDateBs, setReportDateBs] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [remarksText, setRemarksText] = useState("");
  const [signedBy, setSignedBy] = useState("");
  const [activities, setActivities] = useState<FormActivity[]>([]);
  const [equipment, setEquipment] = useState<FormEquipment[]>([]);
  const [manpower, setManpower] = useState<FormManpower[]>(emptyManpowerRows());
  const [weather, setWeather] = useState<FormWeather[]>(emptyWeatherRows());
  const [materials, setMaterials] = useState<FormMaterial[]>([]);
  const [safety, setSafety] = useState<FormSafety[]>([]);
  const [instructions, setInstructions] = useState<FormInstruction[]>([]);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; date: string } | null>(null);
  // Autosave (on any field change, debounced) always writes "draft" unless this is already
  // "submitted" — so filling in fields without hitting Submit never marks the entry final, but
  // once submitted, further autosaved edits keep it submitted rather than reverting to draft.
  const [reportStatus, setReportStatus] = useState<"draft" | "submitted">("draft");
  const [submitting, setSubmitting] = useState(false);

  const hydratedKeyRef = useRef<string | null>(null);
  const lastSavedSnapshotRef = useRef<string>("");

  const resetToBlank = () => {
    setLocation("");
    setReportDateBs("");
    setPreparedBy("");
    setRemarksText("");
    setSignedBy("");
    setActivities([]);
    setEquipment([]);
    setManpower(emptyManpowerRows());
    setWeather(emptyWeatherRows());
    setMaterials([]);
    setSafety([]);
    setInstructions([]);
    setReportStatus("draft");
  };

  // Switching entry (project or date): blank out immediately so the old
  // entry's data doesn't flash while the new one loads, and require a fresh
  // hydration for this (project, date) pair.
  useEffect(() => {
    hydratedKeyRef.current = null;
    resetToBlank();
    setSaveState("idle");
    setSaveError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, date]);

  // Hydrate from the loaded report exactly once per (project, date) — later
  // refetches of the SAME entry (e.g. after our own autosave completes)
  // must NOT re-run this, or in-flight edits made after the save fired would
  // be clobbered by the older snapshot the save round-tripped back.
  useEffect(() => {
    if (!projectId || isLoading) return;
    const key = `${projectId}:${date}`;
    if (hydratedKeyRef.current === key) return;
    hydratedKeyRef.current = key;

    const nextLocation = report?.location ?? "";
    const nextReportDateBs = report?.reportDateBs ?? "";
    const nextPreparedBy = report?.preparedBy ?? "";
    const nextRemarks = report?.remarks ?? "";
    const nextSignedBy = report?.signedBy ?? "";
    const nextActivities: FormActivity[] = (report?.activities ?? []).map((a) => ({
      description: a.description,
      chainage: a.chainage ?? "",
      todayQty: a.todayQty != null ? String(a.todayQty) : "",
      unit: a.unit ?? "",
      status: a.status,
      remarks: a.remarks ?? "",
    }));
    const nextEquipment: FormEquipment[] = (report?.equipment ?? []).map((e) => ({
      equipmentName: e.equipmentName,
      quantity: String(e.quantity),
      workingHours: e.workingHours != null ? String(e.workingHours) : "",
      condition: e.condition,
      remarks: e.remarks ?? "",
    }));
    let nextManpower: FormManpower[];
    if (report && report.manpower.length > 0) {
      const byRole = new Map(report.manpower.map((m) => [m.role, m]));
      const roles = Array.from(new Set([...DEFAULT_ROLES, ...report.manpower.map((m) => m.role)]));
      nextManpower = roles.map((role) => {
        const m = byRole.get(role);
        return { role, headcount: m ? String(m.headcount) : "", names: m?.names ?? "", remarks: m?.remarks ?? "" };
      });
    } else {
      nextManpower = emptyManpowerRows();
    }
    let nextWeather: FormWeather[];
    if (report && report.weather.length > 0) {
      const bySlot = new Map(report.weather.map((w) => [w.slot, w]));
      nextWeather = WEATHER_SLOTS.map((slot) => {
        const w = bySlot.get(slot);
        return { slot, condition: w?.condition ?? "", tempC: w?.tempC != null ? String(w.tempC) : "", rainfall: w?.rainfall ?? "", remarks: w?.remarks ?? "" };
      });
    } else {
      nextWeather = emptyWeatherRows();
    }
    const nextMaterials: FormMaterial[] = (report?.materials ?? []).map((m) => ({
      materialType: m.materialType,
      receivedQuantity: m.receivedQuantity != null ? String(m.receivedQuantity) : "",
      receivedUnit: m.receivedUnit ?? "",
      usedQuantity: m.usedQuantity != null ? String(m.usedQuantity) : "",
      usedUnit: m.usedUnit ?? "",
      remarks: m.remarks ?? "",
    }));
    const nextSafety: FormSafety[] = (report?.safety ?? []).map((s) => ({ type: s.type, description: s.description ?? "", actionTaken: s.actionTaken ?? "" }));
    const nextInstructions: FormInstruction[] = (report?.instructions ?? []).map((i) => ({
      description: i.description ?? "",
      byWhom: i.byWhom ?? "",
      toWhom: i.toWhom ?? "",
      time: i.time ?? "",
      signatureOf: i.signatureOf ?? "",
    }));

    setLocation(nextLocation);
    setReportDateBs(nextReportDateBs);
    setPreparedBy(nextPreparedBy);
    setRemarksText(nextRemarks);
    setSignedBy(nextSignedBy);
    setReportStatus(report?.status ?? "draft");
    setActivities(nextActivities);
    setEquipment(nextEquipment);
    setManpower(nextManpower);
    setWeather(nextWeather);
    setMaterials(nextMaterials);
    setSafety(nextSafety);
    setInstructions(nextInstructions);

    lastSavedSnapshotRef.current = JSON.stringify({
      location: nextLocation,
      reportDateBs: nextReportDateBs,
      preparedBy: nextPreparedBy,
      remarksText: nextRemarks,
      signedBy: nextSignedBy,
      activities: nextActivities,
      equipment: nextEquipment,
      manpower: nextManpower,
      weather: nextWeather,
      materials: nextMaterials,
      safety: nextSafety,
      instructions: nextInstructions,
    });
    setSaveState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, date, isLoading, report]);

  // Shared by autosave and the explicit Submit button — same fields, just a different status.
  const buildPayload = (status: "draft" | "submitted"): SaveSiteActivityReportPayload => ({
    reportDate: date,
    location: location.trim() || null,
    reportDateBs: reportDateBs.trim() || null,
    preparedBy: preparedBy.trim() || null,
    remarks: remarksText.trim() || null,
    signedBy: signedBy.trim() || null,
    status,
    activities: activities
      .filter((a) => a.description.trim())
      .map((a) => ({
        description: a.description.trim(),
        chainage: a.chainage.trim() || null,
        todayQty: a.todayQty.trim() ? Number(a.todayQty) : null,
        unit: a.unit.trim() || null,
        status: a.status,
        remarks: a.remarks.trim() || null,
      })),
    equipment: equipment
      .filter((e) => e.equipmentName.trim())
      .map((e) => ({
        equipmentName: e.equipmentName.trim(),
        quantity: e.quantity.trim() ? Number(e.quantity) : 1,
        workingHours: e.workingHours.trim() ? Number(e.workingHours) : null,
        condition: e.condition,
        remarks: e.remarks.trim() || null,
      })),
    manpower: manpower
      .filter((m) => m.role.trim() && m.headcount.trim())
      .map((m) => ({ role: m.role.trim(), headcount: Number(m.headcount), names: m.names.trim() || null, remarks: m.remarks.trim() || null })),
    weather: weather.map((w) => ({
      slot: w.slot,
      condition: w.condition.trim() || null,
      tempC: w.tempC.trim() ? Number(w.tempC) : null,
      rainfall: w.rainfall || null,
      remarks: w.remarks.trim() || null,
    })),
    materials: materials
      .filter((m) => m.materialType.trim())
      .map((m) => ({
        materialType: m.materialType.trim(),
        receivedQuantity: m.receivedQuantity.trim() ? Number(m.receivedQuantity) : null,
        receivedUnit: m.receivedUnit.trim() || null,
        usedQuantity: m.usedQuantity.trim() ? Number(m.usedQuantity) : null,
        usedUnit: m.usedUnit.trim() || null,
        remarks: m.remarks.trim() || null,
      })),
    safety: safety
      .filter((s) => s.description.trim())
      .map((s) => ({ type: s.type, description: s.description.trim() || null, actionTaken: s.actionTaken.trim() || null })),
    instructions: instructions
      .filter((i) => i.description.trim())
      .map((i) => ({
        description: i.description.trim() || null,
        byWhom: i.byWhom.trim() || null,
        toWhom: i.toWhom.trim() || null,
        time: i.time.trim() || null,
        signatureOf: i.signatureOf.trim() || null,
      })),
  });

  const handleSubmitReport = async () => {
    setSubmitting(true);
    setSaveState("saving");
    setSaveError(null);
    try {
      await saveMutation.mutateAsync(buildPayload("submitted"));
      setReportStatus("submitted");
      lastSavedSnapshotRef.current = JSON.stringify({ location, reportDateBs, preparedBy, remarksText, signedBy, activities, equipment, manpower, weather, materials, safety, instructions });
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setSaveError(getErrorMessage(err, "Failed to submit — try again."));
    } finally {
      setSubmitting(false);
    }
  };

  // Debounced autosave — fires only once this (project, date) entry has
  // finished its one hydration above, and only when something actually
  // changed since the last successful save. Always saves as "draft" unless
  // the entry has already been submitted (see reportStatus above).
  useEffect(() => {
    if (!projectId) return;
    const key = `${projectId}:${date}`;
    if (hydratedKeyRef.current !== key) return;

    const snapshot = JSON.stringify({ location, reportDateBs, preparedBy, remarksText, signedBy, activities, equipment, manpower, weather, materials, safety, instructions });
    if (snapshot === lastSavedSnapshotRef.current) return;

    const t = setTimeout(async () => {
      const payload = buildPayload(reportStatus);

      setSaveState("saving");
      try {
        await saveMutation.mutateAsync(payload);
        lastSavedSnapshotRef.current = snapshot;
        setSaveState("saved");
        setSaveError(null);
      } catch (err) {
        setSaveState("error");
        setSaveError(getErrorMessage(err, "Failed to save — your edits are kept locally, try again."));
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, reportDateBs, preparedBy, remarksText, signedBy, activities, equipment, manpower, weather, materials, safety, instructions]);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteMutation.mutateAsync(pendingDelete.id);
    if (pendingDelete.date === date) {
      hydratedKeyRef.current = null;
      resetToBlank();
    }
    setPendingDelete(null);
  };

  const updateActivity = (i: number, patch: Partial<FormActivity>) => setActivities((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const handleAddWorkType = (name: string) => {
    addWorkTypeMutation.mutate(name, {
      onSuccess: () => {
        if (addWorkTypeFor !== null) updateActivity(addWorkTypeFor, { description: name });
        setAddWorkTypeFor(null);
      },
    });
  };
  const updateEquipment = (i: number, patch: Partial<FormEquipment>) => setEquipment((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const handleAddEquipmentType = (name: string) => {
    addEquipmentTypeMutation.mutate(name, {
      onSuccess: () => {
        if (addEquipmentTypeFor !== null) updateEquipment(addEquipmentTypeFor, { equipmentName: name });
        setAddEquipmentTypeFor(null);
      },
    });
  };
  const updateManpower = (i: number, patch: Partial<FormManpower>) => setManpower((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updateWeather = (i: number, patch: Partial<FormWeather>) => setWeather((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updateMaterial = (i: number, patch: Partial<FormMaterial>) => setMaterials((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const handleAddMaterialType = (name: string) => {
    addMaterialTypeMutation.mutate(name, {
      onSuccess: () => {
        if (addMaterialTypeFor !== null) updateMaterial(addMaterialTypeFor, { materialType: name });
        setAddMaterialTypeFor(null);
      },
    });
  };
  const updateSafety = (i: number, patch: Partial<FormSafety>) => setSafety((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updateInstruction = (i: number, patch: Partial<FormInstruction>) =>
    setInstructions((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const saveIndicator =
    saveState === "saving" ? (
      <span className="inline-flex items-center gap-1 text-[#94a3b8]">
        <Loader2 size={11} className="animate-spin" /> Saving…
      </span>
    ) : saveState === "saved" ? (
      <span className="text-[#047857]">Saved</span>
    ) : saveState === "error" ? (
      <span className="text-[#b91c1c]">Save failed</span>
    ) : null;

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
          <ClipboardList className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-[13px] text-slate-400">No projects yet — create a project to start tracking here.</p>
      </div>
    );
  }

  const currentProject = projects.find((p) => p.id === projectId);
  const totalTodayQty = activities.reduce((sum, a) => sum + (parseFloat(a.todayQty) || 0), 0);
  const totalManpower = manpower.reduce((sum, m) => sum + (parseInt(m.headcount, 10) || 0), 0);
  const manpowerBreakdown = manpower
    .filter((m) => (parseInt(m.headcount, 10) || 0) > 0)
    .map((m) => `${parseInt(m.headcount, 10) || 0} ${m.role.split(" ")[0]}`)
    .join(", ");
  const workingEquipment = equipment.filter((e) => e.condition === "working").length;
  const idleEquipment = equipment.filter((e) => e.condition !== "working").length;

  return (
    <div className="w-full min-h-full" style={{ fontFamily: FONT_BODY, background: "#F7F8FA" }}>
      <main className="px-4 py-6 pb-20 lg:px-6">
        <div className="max-w-[1280px] mx-auto">
          {/* Control bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 mb-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <select
              value={projectId}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className="bg-white border border-slate-200 text-slate-900 px-3 py-2 rounded-lg text-[13px] cursor-pointer focus:outline-none focus:border-blue-600"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5 p-0.5 bg-slate-50 border border-slate-200 rounded-lg">
                <button
                  onClick={() => setViewMode("daily")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                    viewMode === "daily" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-white"
                  }`}
                >
                  <CalendarDays size={13} /> Daily
                </button>
                <button
                  onClick={() => setViewMode("weekly")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                    viewMode === "weekly" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-white"
                  }`}
                >
                  <CalendarRange size={13} /> Weekly
                </button>
                <button
                  onClick={() => setViewMode("overview")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                    viewMode === "overview" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-white"
                  }`}
                >
                  <BarChart3 size={13} /> Overview
                </button>
              </div>
              {viewMode === "daily" && (
                <>
                  <div className="hidden w-px h-7 sm:block bg-slate-200" />
                  <div className="flex items-center gap-0.5 p-0.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <button onClick={() => setDate((d) => shiftDateIso(d, -1))} className="p-1.5 rounded-md hover:bg-white text-slate-500" title="Previous day">
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      onClick={() => setDate(todayIso())}
                      className="px-2 py-1 text-[12px] font-medium rounded-md text-slate-900 hover:bg-white min-w-[130px] text-center"
                    >
                      {formatShortDate(date)} ({dayLabel(date)})
                    </button>
                    <button
                      onClick={() => setDate((d) => shiftDateIso(d, 1))}
                      disabled={date >= todayIso()}
                      className="p-1.5 rounded-md hover:bg-white text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Next day"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                  <div className="relative flex items-center justify-center w-9 h-9 text-slate-500 border rounded-lg bg-slate-50 border-slate-200 hover:bg-white" title="Jump to date">
                    <Calendar size={14} className="pointer-events-none" />
                    <input
                      type="date"
                      value={date}
                      max={todayIso()}
                      onChange={(e) => e.target.value && setDate(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  {isAdmin && report && (
                    <button
                      onClick={() => setPendingDelete({ id: report.id, date: report.reportDate })}
                      title="Delete this entry"
                      className="p-2 text-slate-500 border border-slate-200 rounded-lg hover:text-red-600 hover:border-red-600 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {viewMode === "daily" && saveError && <ErrorBanner message={saveError} onDismiss={() => setSaveError(null)} className="mb-4" />}

          {viewMode === "weekly" ? (
            projectId && <WeeklySummary projectId={projectId} weekStart={weekStart} onWeekStart={setWeekStart} />
          ) : viewMode === "overview" ? (
            projectId && <OverviewSummary projectId={projectId} />
          ) : isLoading && hydratedKeyRef.current !== `${projectId}:${date}` ? (
            <div className="flex items-center justify-center py-16 text-[#94a3b8]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <>
              {/* Meta panel */}
              <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 p-4 mb-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-blue-600 rounded-lg bg-blue-50">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Work location</label>
                      <input
                        className="w-32 p-0 bg-transparent border-b border-slate-200 outline-none text-[13.5px] font-medium text-slate-900 hover:border-slate-300 focus:border-blue-600"
                        placeholder="e.g. Birgunj"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-lg text-violet-600 bg-violet-50">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Date (B.S.)</label>
                      <input
                        className="w-36 p-0 bg-transparent border-b border-slate-200 outline-none text-[13.5px] font-medium text-slate-900 hover:border-slate-300 focus:border-blue-600"
                        placeholder="2083 Bhadra 13"
                        value={reportDateBs}
                        onChange={(e) => setReportDateBs(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-lg text-emerald-600 bg-emerald-50">
                      <User size={16} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Prepared by</label>
                      <input
                        className="w-28 p-0 bg-transparent border-b border-slate-200 outline-none text-[13.5px] font-medium text-slate-900 hover:border-slate-300 focus:border-blue-600"
                        placeholder="Name"
                        value={preparedBy}
                        onChange={(e) => setPreparedBy(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className={`flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-lg ${report?.status === "submitted" ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"}`}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Status</label>
                      <p className="m-0 text-[13.5px] font-medium text-slate-900">
                        {report ? report.status[0]!.toUpperCase() + report.status.slice(1) : "Draft"}
                        {saveIndicator && <span className="ml-1.5 text-[11px] font-normal text-slate-400">· {saveIndicator}</span>}
                      </p>
                    </div>
                  </div>
                </div>
                {report?.updatedBy && <p className="m-0 text-[11.5px] text-slate-400 whitespace-nowrap">Last edited by {report.updatedBy.name}</p>}
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-1 gap-4 mb-5 sm:grid-cols-3">
                <div className="bg-white border-l-4 border border-slate-200 border-l-blue-600 rounded-xl px-4 py-3">
                  <p className="m-0 text-[12px] text-slate-500">Total Work Items</p>
                  <p className="m-0 text-[22px] font-bold text-slate-900">{activities.length} Active</p>
                  <p className="m-0 text-[12px] text-slate-400">{totalTodayQty} Nos completed today</p>
                </div>
                <div className="bg-white border-l-4 border border-slate-200 border-l-emerald-500 rounded-xl px-4 py-3">
                  <p className="m-0 text-[12px] text-slate-500">Site Manpower</p>
                  <p className="m-0 text-[22px] font-bold text-slate-900">{totalManpower} Personnel</p>
                  <p className="m-0 text-[12px] text-slate-400 truncate">{manpowerBreakdown || "No headcount logged yet"}</p>
                </div>
                <div className="bg-white border-l-4 border border-slate-200 border-l-amber-500 rounded-xl px-4 py-3">
                  <p className="m-0 text-[12px] text-slate-500">Equipment Deployed</p>
                  <p className="m-0 text-[22px] font-bold text-slate-900">{equipment.length} Units</p>
                  <p className="m-0 text-[12px] text-slate-400">
                    {workingEquipment} Working, {idleEquipment} Idle
                  </p>
                </div>
              </div>

              {/* 01 Work activities (full width) */}
              <SectionCard
                idx="01"
                title="Work activities"
                badge={`${activities.length} Item${activities.length === 1 ? "" : "s"} Recorded`}
                addLabel="Add activity"
                onAdd={() => setActivities((rows) => [...rows, emptyActivity()])}
              >
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th className={thCls} style={{ width: 30 }}>
                        S.N.
                      </th>
                      <th className={thCls}>Work description</th>
                      <th className={thCls}>Location / chainage</th>
                      <th className={thCls} style={{ width: 70 }}>
                        Qty
                      </th>
                      <th className={thCls} style={{ width: 60 }}>
                        Unit
                      </th>
                      <th className={thCls} style={{ width: 120 }}>
                        Status
                      </th>
                      <th className={thCls}>Remarks</th>
                      <th className={thCls} style={{ width: 28 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {activities.length === 0 ? (
                      <EmptyRow colSpan={8} />
                    ) : (
                      activities.map((row, i) => (
                        <tr key={i} className="hover:bg-[#f8fafc]">
                          <td className={`${tdCls} text-center text-[12px] text-[#94a3b8]`} style={{ fontFamily: FONT_MONO }}>
                            {i + 1}
                          </td>
                          <td className={tdCls}>
                            <div className="flex items-center gap-1">
                              <select
                                className={`${cellInputCls} cursor-pointer`}
                                value={row.description}
                                onChange={(e) => updateActivity(i, { description: e.target.value })}
                              >
                                <option value="">Select…</option>
                                {row.description && !workTypes.includes(row.description) && <option value={row.description}>{row.description}</option>}
                                {workTypes.map((w) => (
                                  <option key={w} value={w}>
                                    {w}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => setAddWorkTypeFor(i)}
                                className="flex-shrink-0 p-1 text-[#94a3b8] hover:text-[#1d4ed8] transition-colors"
                                title="Add new work description"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.chainage} onChange={(e) => updateActivity(i, { chainage: e.target.value })} onKeyDown={handleRowArrowNav} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellMonoCls} style={{ fontFamily: FONT_MONO }} value={row.todayQty} onChange={(e) => updateActivity(i, { todayQty: e.target.value })} onKeyDown={handleRowArrowNav} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellMonoCls} style={{ fontFamily: FONT_MONO }} value={row.unit} onChange={(e) => updateActivity(i, { unit: e.target.value })} onKeyDown={handleRowArrowNav} />
                          </td>
                          <td className={tdCls}>
                            <select
                              className={`${cellInputCls} ${tintCls(row.status)} cursor-pointer`}
                              value={row.status}
                              onChange={(e) => updateActivity(i, { status: e.target.value as SiteActivityItemStatus })}
                            >
                              <option value="ongoing">Ongoing</option>
                              <option value="completed">Completed</option>
                            </select>
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.remarks} onChange={(e) => updateActivity(i, { remarks: e.target.value })} onKeyDown={handleRowArrowNav} />
                          </td>
                          <td className={tdCls}>
                            <RowDelBtn onClick={() => setActivities((rows) => rows.filter((_, idx) => idx !== i))} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </SectionCard>

              <SectionCard
                idx="02"
                title="Manpower Breakdown"
                addLabel="Add category"
                onAdd={() => setManpower((rows) => [...rows, { role: "", headcount: "", names: "", remarks: "" }])}
              >
                <div className="px-2 py-1">
                  {manpower.length === 0 ? (
                    <p className="px-3 py-6 text-[12.5px] text-center text-slate-400">No entries yet — use "+ Add category" above.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {manpower.map((row, i) => (
                        <div key={i} data-arrow-row className="flex items-center gap-2 px-3 py-2.5">
                          <input
                            className="flex-1 min-w-0 p-0 bg-transparent border-none outline-none text-[13.5px] font-medium text-slate-800 focus:ring-0"
                            value={row.role}
                            onChange={(e) => updateManpower(i, { role: e.target.value })}
                            onKeyDown={handleRowArrowNav}
                          />
                          <input
                            placeholder="Name (specific post only)"
                            className="flex-1 min-w-0 px-1.5 py-1 text-[11.5px] text-slate-500 bg-white border border-slate-200 rounded outline-none hover:border-slate-300 focus:border-blue-600"
                            value={row.names}
                            onChange={(e) => updateManpower(i, { names: e.target.value })}
                            onKeyDown={handleRowArrowNav}
                          />
                          <input
                            placeholder="Remarks"
                            className="flex-1 min-w-0 px-1.5 py-1 text-[11.5px] text-slate-500 bg-white border border-slate-200 rounded outline-none hover:border-slate-300 focus:border-blue-600"
                            value={row.remarks}
                            onChange={(e) => updateManpower(i, { remarks: e.target.value })}
                            onKeyDown={handleRowArrowNav}
                          />
                          <input
                            type="text"
                            inputMode="numeric"
                            style={{ fontFamily: FONT_MONO }}
                            className="w-12 px-1 py-1 text-[14px] font-semibold text-right bg-white border border-slate-200 rounded outline-none text-slate-900 hover:border-slate-300 focus:border-blue-600"
                            value={row.headcount}
                            onChange={(e) => updateManpower(i, { headcount: e.target.value })}
                            onKeyDown={handleRowArrowNav}
                          />
                          <span className="text-[12px] text-slate-400 w-14">Person{row.headcount === "1" ? "" : "s"}</span>
                          <div className="w-4">
                            {i >= DEFAULT_ROLES.length && (
                              <RowDelBtn onClick={() => setManpower((rows) => rows.filter((_, idx) => idx !== i))} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3 py-2.5 mt-1.5 mb-1 border border-blue-200 rounded-lg bg-blue-50">
                    <span className="text-[13px] font-medium text-blue-900">Total Headcount On-Site</span>
                    <span className="text-[14px] font-bold text-blue-900">{totalManpower} Total</span>
                  </div>
                </div>
              </SectionCard>

              {/* 03 Equipment + 04 Weather status, side by side */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionCard idx="03" title="Equipment & Machinery Log" addLabel="Add equipment" onAdd={() => setEquipment((rows) => [...rows, emptyEquipment()])}>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th className={thCls}>Equipment / plant</th>
                      <th className={thCls} style={{ width: 90 }}>
                        Quantity
                      </th>
                      <th className={thCls} style={{ width: 110 }}>
                        Working hours
                      </th>
                      <th className={thCls} style={{ width: 130 }}>
                        Condition
                      </th>
                      <th className={thCls}>Remarks</th>
                      <th className={thCls} style={{ width: 100 }}>
                        Status Bar
                      </th>
                      <th className={thCls} style={{ width: 28 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.length === 0 ? (
                      <EmptyRow colSpan={7} />
                    ) : (
                      equipment.map((row, i) => (
                        <tr key={i} className="hover:bg-[#f8fafc]">
                          <td className={tdCls}>
                            <div className="flex items-center gap-1">
                              <select
                                className={`${cellInputCls} cursor-pointer`}
                                value={row.equipmentName}
                                onChange={(e) => updateEquipment(i, { equipmentName: e.target.value })}
                              >
                                <option value="">Select…</option>
                                {row.equipmentName && !equipmentTypes.includes(row.equipmentName) && <option value={row.equipmentName}>{row.equipmentName}</option>}
                                {equipmentTypes.map((w) => (
                                  <option key={w} value={w}>
                                    {w}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => setAddEquipmentTypeFor(i)}
                                className="flex-shrink-0 p-1 text-[#94a3b8] hover:text-[#1d4ed8] transition-colors"
                                title="Add new equipment"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </td>
                          <td className={tdCls}>
                            <input className={cellMonoCls} style={{ fontFamily: FONT_MONO }} value={row.quantity} onChange={(e) => updateEquipment(i, { quantity: e.target.value })} onKeyDown={handleRowArrowNav} />
                          </td>
                          <td className={tdCls}>
                            <input
                              className={cellMonoCls}
                              style={{ fontFamily: FONT_MONO }}
                              value={row.workingHours}
                              onChange={(e) => updateEquipment(i, { workingHours: e.target.value })}
                              onKeyDown={handleRowArrowNav}
                            />
                          </td>
                          <td className={tdCls}>
                            <select
                              className={`${cellInputCls} ${tintCls(row.condition)} cursor-pointer`}
                              value={row.condition}
                              onChange={(e) => updateEquipment(i, { condition: e.target.value as SiteActivityEquipmentCondition })}
                            >
                              <option value="working">Working</option>
                              <option value="idle">Idle</option>
                              <option value="breakdown">Breakdown</option>
                            </select>
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.remarks} onChange={(e) => updateEquipment(i, { remarks: e.target.value })} onKeyDown={handleRowArrowNav} />
                          </td>
                          <td className={tdCls}>
                            <div className="w-full h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${row.condition === "working" ? "bg-blue-600" : row.condition === "breakdown" ? "bg-red-400" : "bg-slate-300"}`}
                                style={{ width: `${Math.min(100, ((parseFloat(row.workingHours) || 0) / 12) * 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className={tdCls}>
                            <RowDelBtn onClick={() => setEquipment((rows) => rows.filter((_, idx) => idx !== i))} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </SectionCard>

              <SectionCard idx="04" title="Weather status">
                <div
                  className="grid mx-[18px] my-2.5 border border-[#e2e8f0]"
                  style={{ gridTemplateColumns: "120px repeat(3, 1fr)", gap: 1, background: "#e2e8f0" }}
                >
                  <div className="bg-[#f8fafc]" />
                  {WEATHER_SLOTS.map((slot) => (
                    <div key={slot} className="bg-[#f8fafc] px-2.5 py-2 text-[11.5px] font-semibold text-[#64748b]">
                      {WEATHER_SLOT_LABEL[slot]}
                    </div>
                  ))}

                  <div className="bg-[#f8fafc] px-2.5 py-2 text-[12.5px] font-medium flex items-center">Weather status</div>
                  <div data-arrow-row style={{ display: "contents" }}>
                    {weather.map((w, i) => (
                      <div key={`status-${w.slot}`} className="bg-white px-2.5 py-2">
                        <input className={cellInputCls} placeholder="e.g. Sunny" value={w.condition} onChange={(e) => updateWeather(i, { condition: e.target.value })} onKeyDown={handleRowArrowNav} />
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#f8fafc] px-2.5 py-2 text-[12.5px] font-medium flex items-center">Temperature (°C)</div>
                  <div data-arrow-row style={{ display: "contents" }}>
                    {weather.map((w, i) => (
                      <div key={`temp-${w.slot}`} className="bg-white px-2.5 py-2">
                        <input className={cellMonoCls} style={{ fontFamily: FONT_MONO }} value={w.tempC} onChange={(e) => updateWeather(i, { tempC: e.target.value })} onKeyDown={handleRowArrowNav} />
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#f8fafc] px-2.5 py-2 text-[12.5px] font-medium flex items-center">Rainfall status</div>
                  {weather.map((w, i) => (
                    <div key={`rain-${w.slot}`} className="bg-white px-2.5 py-2">
                      <select className={`${cellInputCls} cursor-pointer`} value={w.rainfall} onChange={(e) => updateWeather(i, { rainfall: e.target.value as SiteActivityRainfall })}>
                        <option value="">--</option>
                        <option value="no_rainfall">No rainfall</option>
                        <option value="light">Light</option>
                        <option value="moderate">Moderate</option>
                        <option value="heavy">Heavy rainfall</option>
                      </select>
                    </div>
                  ))}
                </div>
              </SectionCard>
              </div>

              {/* 05 Materials + 06 Safety, side by side */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionCard idx="05" title="Materials" addLabel="Add material" onAdd={() => setMaterials((rows) => [...rows, emptyMaterial()])}>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th className={thCls} rowSpan={2}>
                        Material type
                      </th>
                      <th className={`${thCls} text-center`} colSpan={2}>
                        Received
                      </th>
                      <th className={`${thCls} text-center`} colSpan={2}>
                        Used
                      </th>
                      <th className={thCls} rowSpan={2}>
                        Remarks
                      </th>
                      <th className={thCls} style={{ width: 28 }} rowSpan={2} />
                    </tr>
                    <tr>
                      <th className={thCls} style={{ width: 90 }}>
                        Qty
                      </th>
                      <th className={thCls} style={{ width: 60 }}>
                        Unit
                      </th>
                      <th className={thCls} style={{ width: 90 }}>
                        Qty
                      </th>
                      <th className={thCls} style={{ width: 60 }}>
                        Unit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.length === 0 ? (
                      <EmptyRow colSpan={7} />
                    ) : (
                      materials.map((row, i) => (
                        <tr key={i} className="hover:bg-[#f8fafc]">
                          <td className={tdCls}>
                            <div className="flex items-center gap-1">
                              <select
                                className={`${cellInputCls} cursor-pointer`}
                                value={row.materialType}
                                onChange={(e) => updateMaterial(i, { materialType: e.target.value })}
                              >
                                <option value="">Select…</option>
                                {row.materialType && !materialTypes.includes(row.materialType) && <option value={row.materialType}>{row.materialType}</option>}
                                {materialTypes.map((w) => (
                                  <option key={w} value={w}>
                                    {w}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => setAddMaterialTypeFor(i)}
                                className="flex-shrink-0 p-1 text-[#94a3b8] hover:text-[#1d4ed8] transition-colors"
                                title="Add new material type"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </td>
                          <td className={tdCls}>
                            <input
                              className={cellMonoCls}
                              style={{ fontFamily: FONT_MONO }}
                              value={row.receivedQuantity}
                              onChange={(e) => updateMaterial(i, { receivedQuantity: e.target.value })}
                              onKeyDown={handleRowArrowNav}
                            />
                          </td>
                          <td className={tdCls}>
                            <input
                              className={cellMonoCls}
                              style={{ fontFamily: FONT_MONO }}
                              value={row.receivedUnit}
                              onChange={(e) => updateMaterial(i, { receivedUnit: e.target.value })}
                              onKeyDown={handleRowArrowNav}
                            />
                          </td>
                          <td className={tdCls}>
                            <input
                              className={cellMonoCls}
                              style={{ fontFamily: FONT_MONO }}
                              value={row.usedQuantity}
                              onChange={(e) => updateMaterial(i, { usedQuantity: e.target.value })}
                              onKeyDown={handleRowArrowNav}
                            />
                          </td>
                          <td className={tdCls}>
                            <input className={cellMonoCls} style={{ fontFamily: FONT_MONO }} value={row.usedUnit} onChange={(e) => updateMaterial(i, { usedUnit: e.target.value })} onKeyDown={handleRowArrowNav} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.remarks} onChange={(e) => updateMaterial(i, { remarks: e.target.value })} onKeyDown={handleRowArrowNav} />
                          </td>
                          <td className={tdCls}>
                            <RowDelBtn onClick={() => setMaterials((rows) => rows.filter((_, idx) => idx !== i))} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </SectionCard>

              <SectionCard idx="06" title="Safety" addLabel="Add entry" onAdd={() => setSafety((rows) => [...rows, emptySafety()])}>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th className={thCls} style={{ width: 130 }}>
                        Type
                      </th>
                      <th className={thCls}>Description</th>
                      <th className={thCls}>Action taken</th>
                      <th className={thCls} style={{ width: 28 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {safety.length === 0 ? (
                      <EmptyRow colSpan={4} />
                    ) : (
                      safety.map((row, i) => (
                        <tr key={i} className="hover:bg-[#f8fafc]">
                          <td className={tdCls}>
                            <select
                              className={`${cellInputCls} ${tintCls(row.type)} cursor-pointer`}
                              value={row.type}
                              onChange={(e) => updateSafety(i, { type: e.target.value as SiteActivitySafetyType })}
                            >
                              <option value="observation">Observation</option>
                              <option value="incident">Incident</option>
                            </select>
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.description} onChange={(e) => updateSafety(i, { description: e.target.value })} onKeyDown={handleRowArrowNav} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.actionTaken} onChange={(e) => updateSafety(i, { actionTaken: e.target.value })} onKeyDown={handleRowArrowNav} />
                          </td>
                          <td className={tdCls}>
                            <RowDelBtn onClick={() => setSafety((rows) => rows.filter((_, idx) => idx !== i))} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </SectionCard>
              </div>

              {/* Photographs + 07 Instructions, side by side */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PhotosSection report={report ?? null} projectId={projectId || 0} date={date} />
              <SectionCard idx="07" title="Instructions" addLabel="Add instruction" onAdd={() => setInstructions((rows) => [...rows, emptyInstruction()])}>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th className={thCls}>Description</th>
                      <th className={thCls} style={{ width: 120 }}>
                        By whom
                      </th>
                      <th className={thCls} style={{ width: 120 }}>
                        To whom
                      </th>
                      <th className={thCls} style={{ width: 80 }}>
                        Time
                      </th>
                      <th className={thCls} style={{ width: 120 }}>
                        Signature of
                      </th>
                      <th className={thCls} style={{ width: 28 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {instructions.length === 0 ? (
                      <EmptyRow colSpan={6} />
                    ) : (
                      instructions.map((row, i) => (
                        <tr key={i} className="hover:bg-[#f8fafc]">
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.description} onChange={(e) => updateInstruction(i, { description: e.target.value })} onKeyDown={handleRowArrowNav} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.byWhom} onChange={(e) => updateInstruction(i, { byWhom: e.target.value })} onKeyDown={handleRowArrowNav} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.toWhom} onChange={(e) => updateInstruction(i, { toWhom: e.target.value })} onKeyDown={handleRowArrowNav} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellMonoCls} style={{ fontFamily: FONT_MONO }} value={row.time} onChange={(e) => updateInstruction(i, { time: e.target.value })} onKeyDown={handleRowArrowNav} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.signatureOf} onChange={(e) => updateInstruction(i, { signatureOf: e.target.value })} onKeyDown={handleRowArrowNav} />
                          </td>
                          <td className={tdCls}>
                            <RowDelBtn onClick={() => setInstructions((rows) => rows.filter((_, idx) => idx !== i))} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </SectionCard>
              </div>

              {/* Remarks + signature */}
              <section className="bg-white border border-slate-200 rounded-xl shadow-sm mb-4">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <h3 className="font-semibold text-[15px] text-slate-900 m-0">Remarks / issues / concerns</h3>
                </div>
                <div className="p-4">
                  <textarea
                    className="w-full min-h-[70px] border border-slate-200 rounded-lg p-2.5 text-[13.5px] resize-y focus:outline-none focus:border-blue-600"
                    placeholder="Any open issues, concerns or notes for the day..."
                    value={remarksText}
                    onChange={(e) => setRemarksText(e.target.value)}
                  />
                  <div className="flex items-center justify-end gap-2.5 mt-3">
                    <label className="text-[12px] text-slate-500">Signature (site in-charge):</label>
                    <input
                      className="w-[220px] px-0.5 py-1 border-0 border-b border-slate-300 text-[13.5px] focus:outline-none focus:border-blue-600 bg-transparent"
                      placeholder="Name"
                      value={signedBy}
                      onChange={(e) => setSignedBy(e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {/* Submit */}
              <div className="flex items-center justify-end gap-3 mb-4">
                {reportStatus === "submitted" ? (
                  <span className="px-3 py-2 text-[13px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">✓ Submitted</span>
                ) : (
                  <span className="text-[12px] text-slate-400">Not submitted yet — fields are being saved as a draft.</span>
                )}
                <button
                  onClick={handleSubmitReport}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-[13.5px] hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {reportStatus === "submitted" ? "Re-submit Report" : "Submit Report"}
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      <ConfirmationModal
        isOpen={!!pendingDelete}
        title="Delete this entry?"
        message="This deletes the whole day's diary entry, including its photos. This can't be undone."
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setPendingDelete(null)}
      />

      <AddOptionModal
        isOpen={addWorkTypeFor !== null}
        saving={addWorkTypeMutation.isPending}
        title="Add work description"
        fieldLabel="Description"
        placeholder="e.g. Excavation for foundation"
        onClose={() => setAddWorkTypeFor(null)}
        onAdd={handleAddWorkType}
      />
      <AddOptionModal
        isOpen={addEquipmentTypeFor !== null}
        saving={addEquipmentTypeMutation.isPending}
        title="Add equipment"
        fieldLabel="Equipment / plant"
        placeholder="e.g. Excavator"
        onClose={() => setAddEquipmentTypeFor(null)}
        onAdd={handleAddEquipmentType}
      />
      <AddOptionModal
        isOpen={addMaterialTypeFor !== null}
        saving={addMaterialTypeMutation.isPending}
        title="Add material type"
        fieldLabel="Material type"
        placeholder="e.g. Cement"
        onClose={() => setAddMaterialTypeFor(null)}
        onAdd={handleAddMaterialType}
      />
    </div>
  );
};

export default SiteActivities;
