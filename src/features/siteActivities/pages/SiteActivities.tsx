import React, { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Camera, X, ClipboardList, Loader2, ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Plus } from "lucide-react";
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
  ongoing: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  working: "bg-emerald-50 text-emerald-700 border-emerald-200",
  idle: "bg-amber-50 text-amber-700 border-amber-200",
  breakdown: "bg-red-50 text-red-700 border-red-200",
  observation: "bg-blue-50 text-blue-900 border-blue-200",
  incident: "bg-red-50 text-red-700 border-red-200",
};
const tintCls = (value: string) => `${TINT[value] || "bg-[#f1f5f9] text-[#64748b] border-[#cbd5e1]"} border rounded-[3px] font-medium`;

// ---- Shared styling ----
const cellInputCls =
  "w-full border border-transparent bg-transparent px-1.5 py-1.5 rounded-[3px] text-[13px] text-[#0f172a] hover:border-[#e2e8f0] focus:outline-none focus:border-[#1e3a8a] focus:bg-white transition-colors";
const cellMonoCls = `${cellInputCls}`;
const thCls = "text-left text-[11px] font-semibold text-[#64748b] px-2.5 py-2 border-b border-[#e2e8f0] whitespace-nowrap";
const tdCls = "px-1.5 py-1 border-b border-[#f1f5f9] align-middle";
const metaInputCls =
  "w-full border border-[#e2e8f0] rounded-[3px] px-2 py-1.5 text-[13.5px] bg-[#f8fafc] text-[#0f172a] focus:outline-none focus:border-[#1e3a8a]";

// ---- Small building blocks ----

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block mb-1 text-[10.5px] text-[#64748b] tracking-wide">{label}</label>
    {children}
  </div>
);

const SectionCard: React.FC<{ idx: string; title: string; onAdd?: () => void; addLabel?: string; children: React.ReactNode }> = ({
  idx,
  title,
  onAdd,
  addLabel,
  children,
}) => (
  <section className="bg-white border border-[#e2e8f0] mb-4">
    <div className="flex items-center gap-3 px-[18px] py-3 border-b border-[#e2e8f0]">
      <span className="font-bold text-[20px] text-[#1d4ed8] w-6" style={{ fontFamily: FONT_DISPLAY }}>
        {idx}
      </span>
      <h3 className="flex-1 font-semibold text-[18px] text-[#0f172a] m-0" style={{ fontFamily: FONT_DISPLAY }}>
        {title}
      </h3>
      {onAdd && (
        <button
          onClick={onAdd}
          className="px-2.5 py-1 text-[12.5px] border border-[#cbd5e1] rounded-[3px] text-[#1e3a8a] hover:border-[#1e3a8a] hover:bg-[#eff6ff] transition-colors"
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
    <section className="bg-white border border-[#e2e8f0] mb-4">
      <div className="px-[18px] py-3 border-b border-[#e2e8f0]">
        <h3 className="font-semibold text-[18px] text-[#0f172a] m-0" style={{ fontFamily: FONT_DISPLAY }}>
          Photographs
        </h3>
      </div>
      <div className="p-[18px]">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-3" />}
        {!report ? (
          <p className="text-[12.5px] text-[#94a3b8]">Add at least one entry above (it autosaves) before attaching photos.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
            {report.photos.map((p) => (
              <div key={p.id} className="relative overflow-hidden border border-[#e2e8f0] rounded-[3px] group aspect-[4/3] bg-[#f8fafc]">
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
              className="flex flex-col items-center justify-center gap-1 text-[#64748b] border-[1.5px] border-dashed border-[#cbd5e1] rounded-[3px] aspect-[4/3] hover:border-[#1e3a8a] hover:text-[#1d4ed8] disabled:opacity-50 transition-colors"
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

const InfoCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="bg-white border border-[#e2e8f0] mb-4">
    <div className="px-[18px] py-3 border-b border-[#e2e8f0]">
      <h3 className="font-semibold text-[18px] text-[#0f172a] m-0" style={{ fontFamily: FONT_DISPLAY }}>
        {title}
      </h3>
    </div>
    <div className="py-1">{children}</div>
  </section>
);

const WeekStat: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="bg-white border border-[#e2e8f0] p-3.5">
    <p className="m-0 text-[10.5px] text-[#64748b] tracking-wide">{label}</p>
    <p className="m-0 mt-1 font-bold text-[20px] text-[#0f172a]" style={{ fontFamily: FONT_DISPLAY }}>
      {value}
    </p>
    {sub && <p className="m-0 mt-0.5 text-[11px] text-[#94a3b8]">{sub}</p>}
  </div>
);

const WeeklySummary: React.FC<{ projectId: number; weekStart: string; onWeekStart: (iso: string) => void }> = ({ projectId, weekStart, onWeekStart }) => {
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDateIso(weekStart, i)), [weekStart]);
  const weekEnd = weekDays[6]!;
  const { data: reports = [], isLoading } = useSiteActivityReportsRange(projectId, weekStart, weekEnd);
  const isCurrentWeek = weekStart === getWeekStart(todayIso());
  const byDate = useMemo(() => new Map(reports.map((r) => [r.reportDate, r])), [reports]);

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

  // Cumulative "today qty" completed across Work Activities rows, day by day
  // — an actual-progress S-curve. There's no planned/target quantity tracked
  // anywhere in this app yet, so this shows the actual curve only rather
  // than a planned-vs-actual comparison.
  const curveData = useMemo(() => {
    let cumulative = 0;
    return weekDays.map((d) => {
      const r = byDate.get(d);
      const daily = r ? r.activities.reduce((s, a) => s + (a.todayQty ?? 0), 0) : 0;
      cumulative += daily;
      return { label: `${WEEKDAY_LABEL(d)} ${formatShortDate(d)}`, daily, cumulative };
    });
  }, [weekDays, byDate]);

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

          <InfoCard title="Cumulative Progress (S-Curve)">
            <div className="px-[10px] pt-3" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curveData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scurveFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1e3a8a" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} width={36} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 3, borderColor: "#e2e8f0" }}
                    formatter={((value: number, name: string) => [value, name === "cumulative" ? "Cumulative qty" : "Daily qty"]) as any}
                  />
                  <Area type="monotone" dataKey="cumulative" stroke="#1d4ed8" strokeWidth={2} fill="url(#scurveFill)" dot={{ r: 3, fill: "#1d4ed8", strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="px-[18px] pb-3 pt-1 text-[11.5px] text-[#94a3b8]">
              Cumulative "today qty" completed across Work Activities rows this week — actual progress only (no planned/target baseline is tracked yet).
            </p>
          </InfoCard>

          <InfoCard title="Daily Breakdown">
            {/* No overflow-x-auto wrapper here (unlike the other weekly tables) — the
                per-day Activities cell shows a hover popup that needs to escape the row's
                bounds, and an overflow-x:auto ancestor would clip it vertically too (a
                well-known CSS quirk: overflow-x:auto forces the other axis to clip as well). */}
            <div>
              <table className="w-full text-[13px]">
                <thead>
                  <tr>
                    <th className={thCls}>Date</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>Activities</th>
                    <th className={thCls}>Manpower</th>
                    <th className={thCls}>Equipment Hrs</th>
                    <th className={thCls}>Incidents</th>
                  </tr>
                </thead>
                <tbody>
                  {weekDays.map((d) => {
                    const r = byDate.get(d);
                    return (
                      <tr key={d} className="hover:bg-[#f8fafc]">
                        <td className={`${tdCls} font-medium text-[#0f172a]`}>
                          {WEEKDAY_LABEL(d)}, {formatShortDate(d)}
                        </td>
                        {r ? (
                          <>
                            <td className={tdCls}>
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${r.status === "submitted" ? "bg-[#ecfdf5] text-[#047857]" : "bg-[#f1f5f9] text-[#64748b]"}`}>
                                {r.status === "submitted" ? "Submitted" : "Draft"}
                              </span>
                            </td>
                            <td className={`${tdCls} text-[#64748b] max-w-[220px]`}>
                              {r.activities.length === 0 ? (
                                <span className="text-[#94a3b8]">—</span>
                              ) : (
                                <div className="relative inline-block max-w-full group/act">
                                  <span className="block truncate">
                                    {r.activities[0]!.description}
                                    {r.activities.length > 1 && <span className="ml-1 text-[11px] font-semibold text-[#1d4ed8]">+{r.activities.length - 1}</span>}
                                  </span>
                                  {r.activities.length > 1 && (
                                    <div className="absolute left-0 top-full z-20 hidden mt-1 w-72 max-w-[80vw] p-2.5 rounded-[3px] bg-[#0f172a] text-[#f1f5f9] text-[12px] shadow-lg group-hover/act:block">
                                      <ul className="pl-3.5 space-y-1 list-disc">
                                        {r.activities.map((a, i) => (
                                          <li key={i}>{a.description}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className={`${tdCls} text-[#64748b]`}>{r.manpower.reduce((s, m) => s + m.headcount, 0)}</td>
                            <td className={`${tdCls} text-[#64748b]`}>{r.equipment.reduce((s, e) => s + (e.workingHours ?? 0), 0)}</td>
                            <td className={tdCls}>
                              {r.safety.filter((s) => s.type === "incident").length > 0 ? (
                                <span className="font-medium text-[#b91c1c]">{r.safety.filter((s) => s.type === "incident").length}</span>
                              ) : (
                                <span className="text-[#64748b]">0</span>
                              )}
                            </td>
                          </>
                        ) : (
                          <td colSpan={5} className={`${tdCls} text-[#94a3b8]`}>
                            No report
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </InfoCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <InfoCard title="Materials — Weekly Totals">
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

            <InfoCard title="Safety — This Week">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th className={thCls}>Date</th>
                      <th className={thCls}>Type</th>
                      <th className={thCls}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...totals.incidents, ...totals.observations].length === 0 ? (
                      <EmptyRow colSpan={3} />
                    ) : (
                      [...totals.incidents, ...totals.observations]
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((s) => (
                          <tr key={s.id} className="hover:bg-[#f8fafc]">
                            <td className={`${tdCls} text-[#64748b]`}>{formatShortDate(s.date)}</td>
                            <td className={tdCls}>
                              <span className={`px-2 py-0.5 text-[11px] ${tintCls(s.type)}`}>{s.type === "incident" ? "Incident" : "Observation"}</span>
                            </td>
                            <td className={`${tdCls} text-[#0f172a]`}>{s.description || "—"}</td>
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
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily");
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

  // Used only to know which dates already have an entry, so "+ New day entry" can pick an unused one.
  const recentFrom = useMemo(() => shiftDateIso(todayIso(), -180), []);
  const recentTo = useMemo(() => shiftDateIso(todayIso(), 14), []);
  const { data: recentReports = [] } = useSiteActivityReportsRange(projectId || null, recentFrom, recentTo);

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

  // Debounced autosave — fires only once this (project, date) entry has
  // finished its one hydration above, and only when something actually
  // changed since the last successful save.
  useEffect(() => {
    if (!projectId) return;
    const key = `${projectId}:${date}`;
    if (hydratedKeyRef.current !== key) return;

    const snapshot = JSON.stringify({ location, reportDateBs, preparedBy, remarksText, signedBy, activities, equipment, manpower, weather, materials, safety, instructions });
    if (snapshot === lastSavedSnapshotRef.current) return;

    const t = setTimeout(async () => {
      const payload: SaveSiteActivityReportPayload = {
        reportDate: date,
        location: location.trim() || null,
        reportDateBs: reportDateBs.trim() || null,
        preparedBy: preparedBy.trim() || null,
        remarks: remarksText.trim() || null,
        signedBy: signedBy.trim() || null,
        status: "submitted",
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
      };

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

  const existingDates = useMemo(() => new Set(recentReports.map((r) => r.reportDate)), [recentReports]);
  const handleNewDay = () => {
    if (!existingDates.has(todayIso())) {
      setDate(todayIso());
      return;
    }
    let d = todayIso();
    for (let i = 0; i < 730; i++) {
      d = shiftDateIso(d, -1);
      if (!existingDates.has(d)) {
        setDate(d);
        return;
      }
    }
    setDate(todayIso());
  };

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

  return (
    <div className="w-full min-h-full" style={{ fontFamily: FONT_BODY, background: "#F7F8FA" }}>
      <main className="px-10 py-7 pb-20">
        <div className="max-w-[980px] mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-[18px]">
            <div>
              <h2 className="font-bold text-[26px] m-0 mb-0.5 text-[#0f172a]" style={{ fontFamily: FONT_DISPLAY }}>
                {viewMode === "daily" ? "Daily site record" : "Weekly overview"}
              </h2>
              {viewMode === "daily" && (
                <p className="m-0 text-[13px] text-[#64748b]">
                  {formatFullDate(date)}
                  {saveIndicator && <span className="ml-2">· {saveIndicator}</span>}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={projectId}
                onChange={(e) => setProjectId(Number(e.target.value))}
                className="bg-white border border-[#cbd5e1] text-[#0f172a] px-3 py-2 rounded-[3px] text-[13px] cursor-pointer focus:outline-none focus:border-[#1e3a8a]"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-0.5 p-0.5 bg-white border border-[#cbd5e1] rounded-[3px]">
                <button
                  onClick={() => setViewMode("daily")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] text-[12px] font-medium transition-colors ${
                    viewMode === "daily" ? "bg-[#1e3a8a] text-white" : "text-[#64748b] hover:bg-[#f8fafc]"
                  }`}
                >
                  <CalendarDays size={13} /> Daily
                </button>
                <button
                  onClick={() => setViewMode("weekly")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] text-[12px] font-medium transition-colors ${
                    viewMode === "weekly" ? "bg-[#1e3a8a] text-white" : "text-[#64748b] hover:bg-[#f8fafc]"
                  }`}
                >
                  <CalendarRange size={13} /> Weekly
                </button>
              </div>
              {viewMode === "daily" && (
                <>
                  <div className="flex items-center gap-0.5 p-0.5 bg-white border border-[#cbd5e1] rounded-[3px]">
                    <button onClick={() => setDate((d) => shiftDateIso(d, -1))} className="p-1.5 rounded-[3px] hover:bg-[#f8fafc] text-[#64748b]" title="Previous day">
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      onClick={() => setDate(todayIso())}
                      className="px-2 py-1 text-[12px] font-medium rounded-[3px] text-[#0f172a] hover:bg-[#f8fafc] min-w-[64px] text-center"
                    >
                      {dayLabel(date)}
                    </button>
                    <button
                      onClick={() => setDate((d) => shiftDateIso(d, 1))}
                      disabled={date >= todayIso()}
                      className="p-1.5 rounded-[3px] hover:bg-[#f8fafc] text-[#64748b] disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Next day"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </>
              )}
              {viewMode === "daily" && (
                <>
                  {isAdmin && report && (
                    <button
                      onClick={() => setPendingDelete({ id: report.id, date: report.reportDate })}
                      title="Delete this entry"
                      className="p-2 text-[#64748b] border border-[#cbd5e1] rounded-[3px] hover:text-[#b91c1c] hover:border-[#b91c1c] transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  <button
                    onClick={handleNewDay}
                    className="px-3.5 py-2 bg-[#1e3a8a] text-white rounded-[3px] font-semibold text-[14.5px] hover:bg-[#1e40af] transition-colors"
                    style={{ fontFamily: FONT_DISPLAY }}
                  >
                    + New day entry
                  </button>
                </>
              )}
            </div>
          </div>

          {viewMode === "daily" && saveError && <ErrorBanner message={saveError} onDismiss={() => setSaveError(null)} className="mb-4" />}

          {viewMode === "weekly" ? (
            projectId && <WeeklySummary projectId={projectId} weekStart={weekStart} onWeekStart={setWeekStart} />
          ) : isLoading && hydratedKeyRef.current !== `${projectId}:${date}` ? (
            <div className="flex items-center justify-center py-16 text-[#94a3b8]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <>
              {/* Meta panel */}
              <div className="grid grid-cols-2 gap-4 p-4 mb-[22px] bg-white border border-[#e2e8f0] border-t-[3px] border-t-[#0f172a] sm:grid-cols-4">
                <Field label="Work location">
                  <input className={metaInputCls} placeholder="e.g. Birgunj" value={location} onChange={(e) => setLocation(e.target.value)} />
                </Field>
                <Field label="Date (B.S.)">
                  <input className={metaInputCls} placeholder="2083 Bhadra 13" value={reportDateBs} onChange={(e) => setReportDateBs(e.target.value)} />
                </Field>
                <Field label="Date (A.D.)">
                  <input type="date" className={metaInputCls} value={date} max={todayIso()} onChange={(e) => e.target.value && setDate(e.target.value)} />
                </Field>
                <Field label="Prepared by">
                  <input className={metaInputCls} placeholder="Name" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} />
                </Field>
              </div>

              {/* 01 Work activities */}
              <SectionCard idx="01" title="Work activities" addLabel="Add activity" onAdd={() => setActivities((rows) => [...rows, emptyActivity()])}>
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
                            <input className={cellInputCls} value={row.chainage} onChange={(e) => updateActivity(i, { chainage: e.target.value })} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellMonoCls} style={{ fontFamily: FONT_MONO }} value={row.todayQty} onChange={(e) => updateActivity(i, { todayQty: e.target.value })} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellMonoCls} style={{ fontFamily: FONT_MONO }} value={row.unit} onChange={(e) => updateActivity(i, { unit: e.target.value })} />
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
                            <input className={cellInputCls} value={row.remarks} onChange={(e) => updateActivity(i, { remarks: e.target.value })} />
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

              {/* 02 Manpower */}
              <SectionCard idx="02" title="Manpower" addLabel="Add category" onAdd={() => setManpower((rows) => [...rows, { role: "", headcount: "", names: "", remarks: "" }])}>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <th className={thCls}>Category</th>
                      <th className={thCls} style={{ width: 110 }}>
                        No. of persons
                      </th>
                      <th className={thCls}>Name (specific post only)</th>
                      <th className={thCls}>Remarks</th>
                      <th className={thCls} style={{ width: 28 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {manpower.length === 0 ? (
                      <EmptyRow colSpan={5} />
                    ) : (
                      manpower.map((row, i) => (
                        <tr key={i} className="hover:bg-[#f8fafc]">
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.role} onChange={(e) => updateManpower(i, { role: e.target.value })} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellMonoCls} style={{ fontFamily: FONT_MONO }} value={row.headcount} onChange={(e) => updateManpower(i, { headcount: e.target.value })} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.names} onChange={(e) => updateManpower(i, { names: e.target.value })} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.remarks} onChange={(e) => updateManpower(i, { remarks: e.target.value })} />
                          </td>
                          <td className={tdCls}>
                            {i >= DEFAULT_ROLES.length && (
                              <RowDelBtn onClick={() => setManpower((rows) => rows.filter((_, idx) => idx !== i))} />
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </SectionCard>

              {/* 03 Equipment */}
              <SectionCard idx="03" title="Equipment" addLabel="Add equipment" onAdd={() => setEquipment((rows) => [...rows, emptyEquipment()])}>
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
                      <th className={thCls} style={{ width: 28 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.length === 0 ? (
                      <EmptyRow colSpan={6} />
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
                            <input className={cellMonoCls} style={{ fontFamily: FONT_MONO }} value={row.quantity} onChange={(e) => updateEquipment(i, { quantity: e.target.value })} />
                          </td>
                          <td className={tdCls}>
                            <input
                              className={cellMonoCls}
                              style={{ fontFamily: FONT_MONO }}
                              value={row.workingHours}
                              onChange={(e) => updateEquipment(i, { workingHours: e.target.value })}
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
                            <input className={cellInputCls} value={row.remarks} onChange={(e) => updateEquipment(i, { remarks: e.target.value })} />
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

              {/* 04 Weather */}
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
                  {weather.map((w, i) => (
                    <div key={`status-${w.slot}`} className="bg-white px-2.5 py-2">
                      <input className={cellInputCls} placeholder="e.g. Sunny" value={w.condition} onChange={(e) => updateWeather(i, { condition: e.target.value })} />
                    </div>
                  ))}

                  <div className="bg-[#f8fafc] px-2.5 py-2 text-[12.5px] font-medium flex items-center">Temperature (°C)</div>
                  {weather.map((w, i) => (
                    <div key={`temp-${w.slot}`} className="bg-white px-2.5 py-2">
                      <input className={cellMonoCls} style={{ fontFamily: FONT_MONO }} value={w.tempC} onChange={(e) => updateWeather(i, { tempC: e.target.value })} />
                    </div>
                  ))}

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

              {/* 05 Materials */}
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
                            />
                          </td>
                          <td className={tdCls}>
                            <input
                              className={cellMonoCls}
                              style={{ fontFamily: FONT_MONO }}
                              value={row.receivedUnit}
                              onChange={(e) => updateMaterial(i, { receivedUnit: e.target.value })}
                            />
                          </td>
                          <td className={tdCls}>
                            <input
                              className={cellMonoCls}
                              style={{ fontFamily: FONT_MONO }}
                              value={row.usedQuantity}
                              onChange={(e) => updateMaterial(i, { usedQuantity: e.target.value })}
                            />
                          </td>
                          <td className={tdCls}>
                            <input className={cellMonoCls} style={{ fontFamily: FONT_MONO }} value={row.usedUnit} onChange={(e) => updateMaterial(i, { usedUnit: e.target.value })} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.remarks} onChange={(e) => updateMaterial(i, { remarks: e.target.value })} />
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

              {/* 06 Safety */}
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
                            <input className={cellInputCls} value={row.description} onChange={(e) => updateSafety(i, { description: e.target.value })} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.actionTaken} onChange={(e) => updateSafety(i, { actionTaken: e.target.value })} />
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

              {/* 07 Instructions */}
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
                            <input className={cellInputCls} value={row.description} onChange={(e) => updateInstruction(i, { description: e.target.value })} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.byWhom} onChange={(e) => updateInstruction(i, { byWhom: e.target.value })} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.toWhom} onChange={(e) => updateInstruction(i, { toWhom: e.target.value })} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellMonoCls} style={{ fontFamily: FONT_MONO }} value={row.time} onChange={(e) => updateInstruction(i, { time: e.target.value })} />
                          </td>
                          <td className={tdCls}>
                            <input className={cellInputCls} value={row.signatureOf} onChange={(e) => updateInstruction(i, { signatureOf: e.target.value })} />
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

              {/* Remarks + signature */}
              <section className="bg-white border border-[#e2e8f0] mb-4">
                <div className="px-[18px] py-3 border-b border-[#e2e8f0]">
                  <h3 className="font-semibold text-[18px] text-[#0f172a] m-0" style={{ fontFamily: FONT_DISPLAY }}>
                    Remarks / issues / concerns
                  </h3>
                </div>
                <div className="p-[18px]">
                  <textarea
                    className="w-full min-h-[70px] border border-[#e2e8f0] rounded-[3px] p-2.5 text-[13.5px] resize-y focus:outline-none focus:border-[#1e3a8a]"
                    placeholder="Any open issues, concerns or notes for the day..."
                    value={remarksText}
                    onChange={(e) => setRemarksText(e.target.value)}
                  />
                  <div className="flex items-center justify-end gap-2.5 mt-3">
                    <label className="text-[12px] text-[#64748b]">Signature (site in-charge):</label>
                    <input
                      className="w-[220px] px-0.5 py-1 border-0 border-b border-[#cbd5e1] text-[13.5px] focus:outline-none focus:border-[#1e3a8a] bg-transparent"
                      style={{ fontFamily: FONT_DISPLAY }}
                      placeholder="Name"
                      value={signedBy}
                      onChange={(e) => setSignedBy(e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {/* Photos */}
              <PhotosSection report={report ?? null} projectId={projectId || 0} date={date} />
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
