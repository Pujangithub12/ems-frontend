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

// ---- Palette lifted from the reference Site Diary design — graphite ink
// (#20242a) on a warm paper ground (#eef0ea), amber (#e2903a / #c67527)
// as the input-focus accent, steel (#3f6079) for actions/emphasis, plus
// green/brick status tints — applied inline as literal hex Tailwind
// arbitrary-value classes (not JS constants) since Tailwind's class scanner
// needs the literal string, not an interpolated variable. Scoped to this
// page only rather than touched into the app-wide theme. ----
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
  ongoing: "bg-[#fbedda] text-[#c67527]",
  completed: "bg-[#e6efe8] text-[#3f7d5c]",
  working: "bg-[#e6efe8] text-[#3f7d5c]",
  idle: "bg-[#dcdfd6] text-[#6c7166]",
  breakdown: "bg-[#f7e8e4] text-[#a94a35]",
  observation: "bg-[#e9eef1] text-[#3f6079]",
  incident: "bg-[#f7e8e4] text-[#a94a35]",
};
const tintCls = (value: string) => `${TINT[value] || "bg-[#dcdfd6] text-[#6c7166]"} rounded-full font-semibold`;

// ---- Shared styling ----
const cellInputCls =
  "w-full border border-transparent bg-transparent px-1.5 py-1.5 rounded-[3px] text-[13px] text-[#20242a] hover:border-[#b7bab0] focus:outline-none focus:border-[#e2903a] focus:bg-white transition-colors";
const cellMonoCls = `${cellInputCls}`;
const thCls =
  "text-left text-[11px] font-semibold uppercase tracking-[.03em] text-[#9a9d94] px-3 py-2.5 bg-white border-b border-[#dcdfd6] whitespace-nowrap";
const tdCls = "px-3 py-2 border-b border-[#dcdfd6] align-middle";
const metaInputCls =
  "w-full border border-[#b7bab0] rounded-[3px] px-2.5 py-1.5 text-[13.5px] bg-white text-[#20242a] focus:outline-none focus:border-[#e2903a]";

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

/** Same left/right behavior as handleRowArrowNav, plus ArrowUp/ArrowDown moving focus to the
 * same-column field in the row above/below — used on the Manpower Breakdown box, where each
 * [data-arrow-row] is a direct sibling div rather than a <tr>. */
const handleManpowerArrowNav = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
    handleRowArrowNav(e);
    return;
  }
  const input = e.currentTarget;
  const row = input.closest<HTMLElement>("[data-arrow-row]");
  if (!row || !row.parentElement) return;
  const fieldsInRow = Array.from(row.querySelectorAll<HTMLInputElement>("input[type='text'], input:not([type])")).filter((el) => !el.disabled);
  const colIdx = fieldsInRow.indexOf(input);
  if (colIdx === -1) return;

  const rows = Array.from(row.parentElement.children).filter((el): el is HTMLElement => el.hasAttribute("data-arrow-row"));
  const rowIdx = rows.indexOf(row);
  const targetRow = rows[e.key === "ArrowDown" ? rowIdx + 1 : rowIdx - 1];
  if (!targetRow) return;
  const targetFields = Array.from(targetRow.querySelectorAll<HTMLInputElement>("input[type='text'], input:not([type])")).filter((el) => !el.disabled);
  const target = targetFields[colIdx];
  if (target) {
    e.preventDefault();
    target.focus();
    target.setSelectionRange(target.value.length, target.value.length);
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
  <section className="bg-white border border-[#b7bab0] rounded-lg mb-4 overflow-hidden">
    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#dcdfd6] bg-white">
      <span className="mono px-1.5 py-0.5 text-[11px] text-[#9a9d94] border border-[#b7bab0] rounded-[3px]" style={{ fontFamily: FONT_MONO }}>
        {idx}
      </span>
      <h3 className="flex-1 font-semibold text-[17px] text-[#20242a] m-0" style={{ fontFamily: FONT_DISPLAY }}>
        {title}
      </h3>
      {badge && <span className="px-2 py-0.5 text-[11px] font-medium text-[#6c7166] bg-white border border-[#dcdfd6] rounded-full">{badge}</span>}
      {onAdd && (
        <button
          onClick={onAdd}
          className="px-2.5 py-1 text-[12px] font-semibold border border-[#b7bab0] rounded-[3px] text-[#3f6079] hover:border-[#3f6079] hover:bg-[#e9eef1] transition-colors"
        >
          + {addLabel}
        </button>
      )}
    </div>
    <div className="py-1 overflow-x-auto">{children}</div>
  </section>
);

const RowDelBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} className="p-1 text-[#9a9d94] hover:text-[#a94a35] hover:bg-[#f7e8e4] rounded-[3px] transition-colors" title="Remove row">
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-[#20242a]/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-white border border-[#b7bab0] rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#dcdfd6] bg-white">
          <h3 className="font-semibold text-[17px] text-[#20242a]" style={{ fontFamily: FONT_DISPLAY }}>
            {title}
          </h3>
          <button onClick={onClose} className="p-1 text-[#9a9d94] hover:text-[#20242a] transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="p-4">
          <label className="block mb-1 text-[10.5px] text-[#9a9d94] uppercase tracking-wide">{fieldLabel}</label>
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
          <button onClick={onClose} className="px-3 py-1.5 text-[12.5px] border border-[#b7bab0] rounded-[3px] text-[#6c7166] hover:bg-[#f7f8f4] transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!value.trim() || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-white bg-[#3f6079] rounded-[3px] hover:bg-[#2f4a5c] transition-colors disabled:opacity-50"
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
    <td colSpan={colSpan} className="px-2.5 py-4 text-[12.5px] text-center italic text-[#9a9d94]">
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
    <section className="bg-white border border-[#b7bab0] rounded-lg mb-4 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#dcdfd6] bg-white">
        <h3 className="flex-1 font-semibold text-[17px] text-[#20242a] m-0" style={{ fontFamily: FONT_DISPLAY }}>
          Site Photographs ({report?.photos.length ?? 0})
        </h3>
      </div>
      <div className="p-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-3" />}
        {!report ? (
          <p className="text-[12.5px] text-[#9a9d94]">Add at least one entry above (it autosaves) before attaching photos.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {report.photos.map((p) => (
              <div key={p.id} className="relative overflow-hidden border border-[#dcdfd6] rounded-[3px] group aspect-[4/3] bg-[#f4f5f0]">
                <img src={fileUrl(p.filePath)} alt={p.caption ?? p.fileName} className="object-cover w-full h-full" />
                <button
                  onClick={() => deleteMutation.mutate(p.id)}
                  title="Delete photo"
                  className="absolute flex items-center justify-center w-5 h-5 text-white transition-opacity rounded-full opacity-0 top-1 right-1 bg-[#20242a]/70 group-hover:opacity-100 hover:bg-[#a94a35]"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="flex flex-col items-center justify-center gap-1 text-[#6c7166] border-[1.5px] border-dashed border-[#b7bab0] rounded-[3px] aspect-[4/3] hover:border-[#e2903a] hover:text-[#c67527] disabled:opacity-50 transition-colors"
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
  <section className="bg-white border border-[#b7bab0] rounded-lg mb-4 overflow-hidden">
    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#dcdfd6] bg-white">
      <h3 className="flex-1 font-semibold text-[17px] text-[#20242a] m-0" style={{ fontFamily: FONT_DISPLAY }}>
        {title}
      </h3>
      {badge && <span className="px-2 py-0.5 text-[11px] font-medium text-[#6c7166] bg-white border border-[#dcdfd6] rounded-full">{badge}</span>}
    </div>
    <div className="py-1">{children}</div>
  </section>
);

const WeekStat: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="bg-white border border-[#b7bab0] rounded-lg p-3.5">
    <p className="m-0 text-[10.5px] uppercase tracking-[.04em] text-[#9a9d94]">{label}</p>
    <p className="m-0 mt-1 font-bold text-[22px] text-[#20242a]" style={{ fontFamily: FONT_DISPLAY }}>
      {value}
    </p>
    {sub && <p className="m-0 mt-0.5 text-[11px] text-[#9a9d94]">{sub}</p>}
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
          <h2 className="font-bold text-[22px] m-0 mb-0.5 text-[#20242a]" style={{ fontFamily: FONT_DISPLAY }}>
            Weekly Summary
          </h2>
          <p className="m-0 text-[12.5px] text-[#6c7166]">
            {formatShortDateWithYear(weekStart)} – {formatShortDateWithYear(weekEnd)}
            {isCurrentWeek ? " (This Week)" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 px-1 py-1 bg-white border border-[#dcdfd6] rounded-[3px]">
          <button onClick={() => onWeekStart(shiftDateIso(weekStart, -7))} className="p-1.5 rounded-[3px] hover:bg-[#f7f8f4] text-[#6c7166]">
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => onWeekStart(getWeekStart(todayIso()))}
            className="px-2 py-1 text-[11.5px] font-medium rounded-[3px] text-[#20242a] hover:bg-[#f7f8f4]"
          >
            This Week
          </button>
          <button
            onClick={() => onWeekStart(shiftDateIso(weekStart, 7))}
            disabled={isCurrentWeek}
            className="p-1.5 rounded-[3px] hover:bg-[#f7f8f4] text-[#6c7166] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[#9a9d94]">
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
                        <tr key={i} className="hover:bg-[#f7f8f4]">
                          <td className={`${tdCls} text-[#6c7166]`}>{formatShortDate(a.date)}</td>
                          <td className={`${tdCls} text-[#20242a]`}>{a.description}</td>
                          <td className={`${tdCls} text-[#6c7166]`}>
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
                        <tr key={m.role} className="hover:bg-[#f7f8f4]">
                          <td className={`${tdCls} font-medium text-[#20242a]`}>{m.role}</td>
                          {m.byDay.map((n, i) => (
                            <td key={weekDays[i]} className={`${tdCls} text-center text-[#6c7166]`}>
                              {n || "—"}
                            </td>
                          ))}
                          <td className={`${tdCls} text-center font-semibold text-[#3f6079]`}>{m.total}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {manpowerDailyWeekly.length > 0 && (
                    <tfoot>
                      <tr className="bg-[#fbedda]">
                        <td className={`${tdCls} font-semibold text-[#c67527]`}>Total Headcount</td>
                        {manpowerDailyTotals.map((n, i) => (
                          <td key={weekDays[i]} className={`${tdCls} text-center font-semibold text-[#c67527]`}>
                            {n || "—"}
                          </td>
                        ))}
                        <td className={`${tdCls} text-center font-bold text-[#c67527]`}>{totals.totalManpowerDays}</td>
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
                        <tr key={e.equipmentName} className="hover:bg-[#f7f8f4]">
                          <td className={`${tdCls} font-medium text-[#20242a]`}>{e.equipmentName}</td>
                          <td className={`${tdCls} text-[#6c7166]`}>{e.entries}</td>
                          <td className={`${tdCls} text-[#6c7166]`}>{e.totalHours}</td>
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
                        <tr key={m.materialType} className="hover:bg-[#f7f8f4]">
                          <td className={`${tdCls} font-medium text-[#20242a]`}>{m.materialType}</td>
                          <td className={`${tdCls} text-[#6c7166]`}>
                            {m.receivedQuantity} {m.receivedUnit}
                          </td>
                          <td className={`${tdCls} text-[#6c7166]`}>
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

type ChartMetricKey = "qty" | "manpower" | "equipment" | "activities" | "safetyIncidents";
const CHART_METRIC_OPTIONS: { key: ChartMetricKey; label: string; dailyLabel: string; cumulativeLabel: string }[] = [
  { key: "qty", label: "Work Quantity Completed", dailyLabel: "Daily qty", cumulativeLabel: "Cumulative qty" },
  { key: "manpower", label: "Manpower (person-days)", dailyLabel: "Daily headcount", cumulativeLabel: "Cumulative person-days" },
  { key: "equipment", label: "Equipment Hours", dailyLabel: "Daily hours", cumulativeLabel: "Cumulative hours" },
  { key: "activities", label: "Work Items Logged", dailyLabel: "Daily items", cumulativeLabel: "Cumulative items" },
  { key: "safetyIncidents", label: "Safety Incidents", dailyLabel: "Daily incidents", cumulativeLabel: "Cumulative incidents" },
];

const OverviewSummary: React.FC<{ projectId: number }> = ({ projectId }) => {
  // "All reports for this project" has no dedicated endpoint — reuse the range
  // endpoint with a wide-enough floor date to capture the project's whole history.
  const from = "2015-01-01";
  const to = todayIso();
  const { data: reports = [], isLoading } = useSiteActivityReportsRange(projectId, from, to);

  const sortedReports = useMemo(() => [...reports].sort((a, b) => a.reportDate.localeCompare(b.reportDate)), [reports]);
  const [manpowerDailyView, setManpowerDailyView] = useState(false);
  const [equipmentDailyView, setEquipmentDailyView] = useState(false);
  const [materialDailyView, setMaterialDailyView] = useState(false);
  const [chartMetric, setChartMetric] = useState<ChartMetricKey>("qty");

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

  // Grouped by unit rather than one lump sum, since summing e.g. meters and cubic-meters
  // together would be meaningless — each unit gets its own total.
  const activityQtyByUnit = useMemo(() => {
    const byUnit = new Map<string, number>();
    for (const r of reports) {
      for (const a of r.activities) {
        const key = a.unit?.trim() || "";
        byUnit.set(key, (byUnit.get(key) ?? 0) + (a.todayQty ?? 0));
      }
    }
    return Array.from(byUnit.entries()).map(([unit, qty]) => ({ unit, qty }));
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

  // Same "only columns for dates that actually have a report" approach as manpowerDaily above.
  const equipmentDaily = useMemo(() => {
    const names = new Set<string>();
    const byNameDay = new Map<string, Map<string, number>>();
    for (const r of sortedReports) {
      for (const e of r.equipment) {
        names.add(e.equipmentName);
        if (!byNameDay.has(e.equipmentName)) byNameDay.set(e.equipmentName, new Map());
        const dayMap = byNameDay.get(e.equipmentName)!;
        dayMap.set(r.reportDate, (dayMap.get(r.reportDate) ?? 0) + (e.workingHours ?? 0));
      }
    }
    return Array.from(names).map((equipmentName) => ({
      equipmentName,
      byDay: sortedReports.map((r) => byNameDay.get(equipmentName)?.get(r.reportDate) ?? 0),
    }));
  }, [sortedReports]);
  const equipmentDailyTotals = useMemo(
    () => sortedReports.map((r) => r.equipment.reduce((s, e) => s + (e.workingHours ?? 0), 0)),
    [sortedReports],
  );

  const materialDaily = useMemo(() => {
    const types = new Set<string>();
    const byTypeDay = new Map<string, Map<string, { received: number; used: number; receivedUnit: string; usedUnit: string }>>();
    for (const r of sortedReports) {
      for (const m of r.materials) {
        types.add(m.materialType);
        if (!byTypeDay.has(m.materialType)) byTypeDay.set(m.materialType, new Map());
        const dayMap = byTypeDay.get(m.materialType)!;
        const existing = dayMap.get(r.reportDate) ?? { received: 0, used: 0, receivedUnit: m.receivedUnit ?? "", usedUnit: m.usedUnit ?? "" };
        existing.received += m.receivedQuantity ?? 0;
        existing.used += m.usedQuantity ?? 0;
        if (!existing.receivedUnit && m.receivedUnit) existing.receivedUnit = m.receivedUnit;
        if (!existing.usedUnit && m.usedUnit) existing.usedUnit = m.usedUnit;
        dayMap.set(r.reportDate, existing);
      }
    }
    return Array.from(types).map((materialType) => ({
      materialType,
      byDay: sortedReports.map((r) => byTypeDay.get(materialType)?.get(r.reportDate) ?? null),
    }));
  }, [sortedReports]);

  const qtyDaily = useMemo(() => sortedReports.map((r) => r.activities.reduce((s, a) => s + (a.todayQty ?? 0), 0)), [sortedReports]);
  const activitiesDaily = useMemo(() => sortedReports.map((r) => r.activities.length), [sortedReports]);
  const safetyIncidentsDaily = useMemo(() => sortedReports.map((r) => r.safety.filter((s) => s.type === "incident").length), [sortedReports]);

  const dailyValuesByMetric: Record<ChartMetricKey, number[]> = {
    qty: qtyDaily,
    manpower: manpowerDailyTotals,
    equipment: equipmentDailyTotals,
    activities: activitiesDaily,
    safetyIncidents: safetyIncidentsDaily,
  };
  const activeMetric = CHART_METRIC_OPTIONS.find((m) => m.key === chartMetric)!;

  const curveData = useMemo(() => {
    const values = dailyValuesByMetric[chartMetric];
    let cumulative = 0;
    return sortedReports.map((r, i) => {
      const daily = values[i] ?? 0;
      cumulative += daily;
      return { label: formatShortDate(r.reportDate), daily, cumulative };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartMetric, sortedReports, qtyDaily, manpowerDailyTotals, equipmentDailyTotals, activitiesDaily, safetyIncidentsDaily]);

  const firstDate = sortedReports[0]?.reportDate;

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-bold text-[22px] m-0 mb-0.5 text-[#20242a]" style={{ fontFamily: FONT_DISPLAY }}>
          All-Time Overview
        </h2>
        <p className="m-0 text-[12.5px] text-[#6c7166]">{firstDate ? `${formatShortDateWithYear(firstDate)} – Today` : "No entries logged yet"}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[#9a9d94]">
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
            <div className="flex items-center justify-end gap-1.5 px-[18px] pt-1">
              <label className="text-[11.5px] text-[#6c7166]">Y-axis value:</label>
              <select
                value={chartMetric}
                onChange={(e) => setChartMetric(e.target.value as ChartMetricKey)}
                className="px-2 py-1 text-[11.5px] font-medium border rounded-lg cursor-pointer text-[#20242a] border-[#dcdfd6] hover:bg-[#f7f8f4] focus:outline-none"
              >
                {CHART_METRIC_OPTIONS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="px-[10px] pt-3" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curveData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scurveFillOverview" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2f4a5c" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2f4a5c" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f7f8f4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6c7166" }} axisLine={{ stroke: "#dcdfd6" }} tickLine={false} interval="preserveStartEnd" minTickGap={30} />
                  <YAxis tick={{ fontSize: 11, fill: "#6c7166" }} axisLine={{ stroke: "#dcdfd6" }} tickLine={false} width={36} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 3, borderColor: "#dcdfd6" }}
                    formatter={((value: number, name: string) => [value, name === "cumulative" ? activeMetric.cumulativeLabel : activeMetric.dailyLabel]) as any}
                  />
                  <Area type="monotone" dataKey="cumulative" stroke="#3f6079" strokeWidth={2} fill="url(#scurveFillOverview)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="px-[18px] pb-3 pt-1 text-[11.5px] text-[#9a9d94]">
              {activeMetric.cumulativeLabel} across every day logged for this project so far.
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
                          <tr key={i} className="hover:bg-[#f7f8f4]">
                            <td className={`${tdCls} text-[#6c7166]`}>{formatShortDate(a.date)}</td>
                            <td className={`${tdCls} text-[#20242a]`}>{a.description}</td>
                            <td className={`${tdCls} text-[#6c7166]`}>
                              {a.todayQty ?? "—"} {a.unit ?? ""}
                            </td>
                            <td className={tdCls}>
                              <span className={`px-2 py-0.5 text-[11px] ${tintCls(a.status)}`}>{a.status === "completed" ? "Completed" : "Ongoing"}</span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                  {activityQtyByUnit.length > 0 && (
                    <tfoot>
                      <tr className="bg-[#fbedda]">
                        <td colSpan={2} className={`${tdCls} font-semibold text-[#c67527]`}>
                          Total Quantity
                        </td>
                        <td className={`${tdCls} font-semibold text-[#c67527]`}>
                          {activityQtyByUnit.map((u) => `${u.qty}${u.unit ? ` ${u.unit}` : ""}`).join(", ")}
                        </td>
                        <td className={tdCls} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </InfoCard>

            <InfoCard title="Manpower — All Time" badge={`${totals.totalManpowerDays} person-days`}>
              <div className="flex items-center justify-end px-3 pt-1">
                <button
                  onClick={() => setManpowerDailyView((v) => !v)}
                  className="text-[11.5px] font-medium text-[#3f6079] hover:underline"
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
                          <tr key={m.role} className="hover:bg-[#f7f8f4]">
                            <td className={`${tdCls} font-medium text-[#20242a]`}>{m.role}</td>
                            {m.byDay.map((n, i) => (
                              <td key={sortedReports[i]!.reportDate} className={`${tdCls} text-center text-[#6c7166]`}>
                                {n || "—"}
                              </td>
                            ))}
                            <td className={`${tdCls} text-center font-semibold text-[#3f6079]`}>{m.byDay.reduce((s, n) => s + n, 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {manpowerDaily.length > 0 && (
                      <tfoot>
                        <tr className="bg-[#fbedda]">
                          <td className={`${tdCls} font-semibold text-[#c67527]`}>Total Headcount</td>
                          {manpowerDailyTotals.map((n, i) => (
                            <td key={sortedReports[i]!.reportDate} className={`${tdCls} text-center font-semibold text-[#c67527]`}>
                              {n || "—"}
                            </td>
                          ))}
                          <td className={`${tdCls} text-center font-bold text-[#c67527]`}>{totals.totalManpowerDays}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              ) : (
                <div className="px-2 py-1">
                  {manpowerTotals.length === 0 ? (
                    <p className="px-3 py-6 text-[12.5px] text-center text-[#9a9d94]">No manpower logged yet.</p>
                  ) : (
                    <div className="divide-y divide-[#eef0ea]">
                      {manpowerTotals.map((m) => (
                        <div key={m.role} className="flex items-center justify-between px-3 py-2.5">
                          <span className="text-[13.5px] font-medium text-[#20242a]">{m.role}</span>
                          <span className="text-[13px] text-[#6c7166]">
                            {m.headcount} person-day{m.headcount === 1 ? "" : "s"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3 py-2.5 mt-1.5 mb-1 border border-[#e6cfa6] rounded-lg bg-[#fbedda]">
                    <span className="text-[13px] font-medium text-[#c67527]">Total Person-Days</span>
                    <span className="text-[14px] font-bold text-[#c67527]">{totals.totalManpowerDays} Total</span>
                  </div>
                </div>
              )}
            </InfoCard>

            <InfoCard title="Equipment — All Time" badge={`${totals.totalEquipmentHours} hrs`}>
              <div className="flex items-center justify-end px-3 pt-1">
                <button
                  onClick={() => setEquipmentDailyView((v) => !v)}
                  className="text-[11.5px] font-medium text-[#3f6079] hover:underline"
                >
                  {equipmentDailyView ? "Show totals only" : "Break down by day"}
                </button>
              </div>
              {equipmentDailyView ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr>
                        <th className={thCls}>Equipment / plant</th>
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
                      {equipmentDaily.length === 0 ? (
                        <EmptyRow colSpan={2} />
                      ) : (
                        equipmentDaily.map((e) => (
                          <tr key={e.equipmentName} className="hover:bg-[#f7f8f4]">
                            <td className={`${tdCls} font-medium text-[#20242a]`}>{e.equipmentName}</td>
                            {e.byDay.map((hrs, i) => (
                              <td key={sortedReports[i]!.reportDate} className={`${tdCls} text-center text-[#6c7166]`}>
                                {hrs || "—"}
                              </td>
                            ))}
                            <td className={`${tdCls} text-center font-semibold text-[#3f6079]`}>{e.byDay.reduce((s, n) => s + n, 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {equipmentDaily.length > 0 && (
                      <tfoot>
                        <tr className="bg-[#fbedda]">
                          <td className={`${tdCls} font-semibold text-[#c67527]`}>Total Hours</td>
                          {equipmentDailyTotals.map((n, i) => (
                            <td key={sortedReports[i]!.reportDate} className={`${tdCls} text-center font-semibold text-[#c67527]`}>
                              {n || "—"}
                            </td>
                          ))}
                          <td className={`${tdCls} text-center font-bold text-[#c67527]`}>{totals.totalEquipmentHours}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              ) : (
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
                          <tr key={e.equipmentName} className="hover:bg-[#f7f8f4]">
                            <td className={`${tdCls} font-medium text-[#20242a]`}>{e.equipmentName}</td>
                            <td className={`${tdCls} text-[#6c7166]`}>{e.entries}</td>
                            <td className={`${tdCls} text-[#6c7166]`}>{e.totalHours}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </InfoCard>

            <InfoCard title="Materials — All Time" badge={`${materialTotals.length} type${materialTotals.length === 1 ? "" : "s"}`}>
              <div className="flex items-center justify-end px-3 pt-1">
                <button
                  onClick={() => setMaterialDailyView((v) => !v)}
                  className="text-[11.5px] font-medium text-[#3f6079] hover:underline"
                >
                  {materialDailyView ? "Show totals only" : "Break down by day"}
                </button>
              </div>
              {materialDailyView ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr>
                        <th className={thCls}>Material Type</th>
                        {sortedReports.map((r) => (
                          <th key={r.reportDate} className={`${thCls} text-center`} style={{ width: 70 }}>
                            {formatShortDate(r.reportDate)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {materialDaily.length === 0 ? (
                        <EmptyRow colSpan={2} />
                      ) : (
                        materialDaily.map((m) => (
                          <tr key={m.materialType} className="hover:bg-[#f7f8f4]">
                            <td className={`${tdCls} font-medium text-[#20242a]`}>{m.materialType}</td>
                            {m.byDay.map((entry, i) => (
                              <td key={sortedReports[i]!.reportDate} className={`${tdCls} text-center text-[#6c7166]`}>
                                {!entry || (entry.received === 0 && entry.used === 0) ? (
                                  "—"
                                ) : (
                                  <div className="leading-tight">
                                    <div>R {entry.received}</div>
                                    <div>U {entry.used}</div>
                                  </div>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <p className="px-[18px] pb-2 pt-1 text-[11px] text-[#9a9d94]">R = Received, U = Used, per day.</p>
                </div>
              ) : (
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
                          <tr key={m.materialType} className="hover:bg-[#f7f8f4]">
                            <td className={`${tdCls} font-medium text-[#20242a]`}>{m.materialType}</td>
                            <td className={`${tdCls} text-[#6c7166]`}>
                              {m.receivedQuantity} {m.receivedUnit}
                            </td>
                            <td className={`${tdCls} text-[#6c7166]`}>
                              {m.usedQuantity} {m.usedUnit}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
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
      <span className="inline-flex items-center gap-1 text-[#9a9d94]">
        <Loader2 size={11} className="animate-spin" /> Saving…
      </span>
    ) : saveState === "saved" ? (
      <span className="text-[#3f7d5c]">Saved</span>
    ) : saveState === "error" ? (
      <span className="text-[#a94a35]">Save failed</span>
    ) : null;

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[#f7f8f4] to-[#eef0ea] ring-1 ring-[#dcdfd6]">
          <ClipboardList className="w-5 h-5 text-[#9a9d94]" />
        </div>
        <p className="text-[13px] text-[#9a9d94]">No projects yet — create a project to start tracking here.</p>
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
    <div className="w-full min-h-full" style={{ fontFamily: FONT_BODY, background: "#F7F8FA", color: "#20242a" }}>
      <main className="px-4 py-6 pb-20 lg:px-6">
        <div className="max-w-[1280px] mx-auto">
          {/* Control bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 mb-4 bg-white border border-[#b7bab0] rounded-lg">
            <select
              value={projectId}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className="bg-white border border-[#dcdfd6] text-[#20242a] px-3 py-2 rounded-lg text-[13px] cursor-pointer focus:outline-none focus:border-[#e2903a]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5 p-0.5 bg-[#f7f8f4] border border-[#dcdfd6] rounded-lg">
                <button
                  onClick={() => setViewMode("daily")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                    viewMode === "daily" ? "bg-[#3f6079] text-white" : "text-[#6c7166] hover:bg-white"
                  }`}
                >
                  <CalendarDays size={13} /> Daily
                </button>
                <button
                  onClick={() => setViewMode("weekly")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                    viewMode === "weekly" ? "bg-[#3f6079] text-white" : "text-[#6c7166] hover:bg-white"
                  }`}
                >
                  <CalendarRange size={13} /> Weekly
                </button>
                <button
                  onClick={() => setViewMode("overview")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                    viewMode === "overview" ? "bg-[#3f6079] text-white" : "text-[#6c7166] hover:bg-white"
                  }`}
                >
                  <BarChart3 size={13} /> Overview
                </button>
              </div>
              {viewMode === "daily" && (
                <>
                  <div className="hidden w-px h-7 sm:block bg-[#dcdfd6]" />
                  <div className="flex items-center gap-0.5 p-0.5 bg-[#f7f8f4] border border-[#dcdfd6] rounded-lg">
                    <button onClick={() => setDate((d) => shiftDateIso(d, -1))} className="p-1.5 rounded-md hover:bg-white text-[#6c7166]" title="Previous day">
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      onClick={() => setDate(todayIso())}
                      className="px-2 py-1 text-[12px] font-medium rounded-md text-[#20242a] hover:bg-white min-w-[130px] text-center"
                    >
                      {formatShortDate(date)} ({dayLabel(date)})
                    </button>
                    <button
                      onClick={() => setDate((d) => shiftDateIso(d, 1))}
                      disabled={date >= todayIso()}
                      className="p-1.5 rounded-md hover:bg-white text-[#6c7166] disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Next day"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                  <div className="relative flex items-center justify-center w-9 h-9 text-[#6c7166] border rounded-lg bg-[#f7f8f4] border-[#dcdfd6] hover:bg-white" title="Jump to date">
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
                      className="p-2 text-[#6c7166] border border-[#dcdfd6] rounded-lg hover:text-[#a94a35] hover:border-[#a94a35] transition-colors"
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
            <div className="flex items-center justify-center py-16 text-[#9a9d94]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <>
              {/* Meta panel */}
              <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 p-4 mb-5 bg-white border border-[#b7bab0] rounded-lg">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-[#3f6079] rounded-lg bg-[#e9eef1]">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#9a9d94] uppercase tracking-wide">Work location</label>
                      <input
                        className="w-32 p-0 bg-transparent border-b border-[#dcdfd6] outline-none text-[13.5px] font-medium text-[#20242a] hover:border-[#b7bab0] focus:border-[#e2903a]"
                        placeholder="e.g. Birgunj"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-lg text-[#3f6079] bg-[#e9eef1]">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#9a9d94] uppercase tracking-wide">Date (B.S.)</label>
                      <input
                        className="w-36 p-0 bg-transparent border-b border-[#dcdfd6] outline-none text-[13.5px] font-medium text-[#20242a] hover:border-[#b7bab0] focus:border-[#e2903a]"
                        placeholder="2083 Bhadra 13"
                        value={reportDateBs}
                        onChange={(e) => setReportDateBs(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-lg text-[#3f7d5c] bg-[#e6efe8]">
                      <User size={16} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#9a9d94] uppercase tracking-wide">Prepared by</label>
                      <input
                        className="w-28 p-0 bg-transparent border-b border-[#dcdfd6] outline-none text-[13.5px] font-medium text-[#20242a] hover:border-[#b7bab0] focus:border-[#e2903a]"
                        placeholder="Name"
                        value={preparedBy}
                        onChange={(e) => setPreparedBy(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className={`flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-lg ${report?.status === "submitted" ? "text-[#3f7d5c] bg-[#e6efe8]" : "text-[#c67527] bg-[#fbedda]"}`}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#9a9d94] uppercase tracking-wide">Status</label>
                      <p className="m-0 text-[13.5px] font-medium text-[#20242a]">
                        {report ? report.status[0]!.toUpperCase() + report.status.slice(1) : "Draft"}
                        {saveIndicator && <span className="ml-1.5 text-[11px] font-normal text-[#9a9d94]">· {saveIndicator}</span>}
                      </p>
                    </div>
                  </div>
                </div>
                {report?.updatedBy && <p className="m-0 text-[11.5px] text-[#9a9d94] whitespace-nowrap">Last edited by {report.updatedBy.name}</p>}
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-1 gap-4 mb-5 sm:grid-cols-3">
                <div className="bg-white border-l-[3px] border border-[#dcdfd6] rounded-lg border-l-[#3f6079] px-4 py-3">
                  <p className="m-0 text-[12px] text-[#6c7166]">Total Work Items</p>
                  <p className="m-0 text-[22px] font-bold text-[#20242a]">{activities.length} Active</p>
                  <p className="m-0 text-[12px] text-[#9a9d94]">{totalTodayQty} Nos completed today</p>
                </div>
                <div className="bg-white border-l-[3px] border border-[#dcdfd6] rounded-lg border-l-[#3f7d5c] px-4 py-3">
                  <p className="m-0 text-[12px] text-[#6c7166]">Site Manpower</p>
                  <p className="m-0 text-[22px] font-bold text-[#20242a]">{totalManpower} Personnel</p>
                  <p className="m-0 text-[12px] text-[#9a9d94] truncate">{manpowerBreakdown || "No headcount logged yet"}</p>
                </div>
                <div className="bg-white border-l-[3px] border border-[#dcdfd6] rounded-lg border-l-[#c67527] px-4 py-3">
                  <p className="m-0 text-[12px] text-[#6c7166]">Equipment Deployed</p>
                  <p className="m-0 text-[22px] font-bold text-[#20242a]">{equipment.length} Units</p>
                  <p className="m-0 text-[12px] text-[#9a9d94]">
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
                        <tr key={i} className="hover:bg-[#f7f8f4]">
                          <td className={`${tdCls} text-center text-[12px] text-[#9a9d94]`} style={{ fontFamily: FONT_MONO }}>
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
                                className="flex-shrink-0 p-1 text-[#9a9d94] hover:text-[#3f6079] transition-colors"
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
                    <p className="px-3 py-6 text-[12.5px] text-center text-[#9a9d94]">No entries yet — use "+ Add category" above.</p>
                  ) : (
                    <div className="divide-y divide-[#eef0ea]">
                      {manpower.map((row, i) => (
                        <div key={i} data-arrow-row className="flex items-center gap-2 px-3 py-3">
                          <input
                            className="flex-1 min-w-0 p-0 bg-transparent border-none outline-none text-[13.5px] font-medium text-[#20242a] focus:ring-0"
                            value={row.role}
                            onChange={(e) => updateManpower(i, { role: e.target.value })}
                            onKeyDown={handleManpowerArrowNav}
                          />
                          <input
                            placeholder="Name (specific post only)"
                            className="flex-1 min-w-0 px-1.5 py-2 text-[11.5px] text-[#6c7166] bg-white border border-[#dcdfd6] rounded outline-none hover:border-[#b7bab0] focus:border-[#e2903a]"
                            value={row.names}
                            onChange={(e) => updateManpower(i, { names: e.target.value })}
                            onKeyDown={handleManpowerArrowNav}
                          />
                          <input
                            placeholder="Remarks"
                            className="flex-1 min-w-0 px-1.5 py-2 text-[11.5px] text-[#6c7166] bg-white border border-[#dcdfd6] rounded outline-none hover:border-[#b7bab0] focus:border-[#e2903a]"
                            value={row.remarks}
                            onChange={(e) => updateManpower(i, { remarks: e.target.value })}
                            onKeyDown={handleManpowerArrowNav}
                          />
                          <input
                            type="text"
                            inputMode="numeric"
                            style={{ fontFamily: FONT_MONO }}
                            className="w-12 px-1 py-2 text-[14px] font-semibold text-right bg-white border border-[#dcdfd6] rounded outline-none text-[#20242a] hover:border-[#b7bab0] focus:border-[#e2903a]"
                            value={row.headcount}
                            onChange={(e) => updateManpower(i, { headcount: e.target.value })}
                            onKeyDown={handleManpowerArrowNav}
                          />
                          <span className="text-[12px] text-[#9a9d94] w-14">Person{row.headcount === "1" ? "" : "s"}</span>
                          <div className="w-4">
                            {i >= DEFAULT_ROLES.length && (
                              <RowDelBtn onClick={() => setManpower((rows) => rows.filter((_, idx) => idx !== i))} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3 py-2.5 mt-1.5 mb-1 border border-[#e6cfa6] rounded-lg bg-[#fbedda]">
                    <span className="text-[13px] font-medium text-[#c67527]">Total Headcount On-Site</span>
                    <span className="text-[14px] font-bold text-[#c67527]">{totalManpower} Total</span>
                  </div>
                </div>
              </SectionCard>

              {/* 03 Equipment (full width) */}
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
                        <tr key={i} className="hover:bg-[#f7f8f4]">
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
                                className="flex-shrink-0 p-1 text-[#9a9d94] hover:text-[#3f6079] transition-colors"
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
                            <div className="w-full h-1.5 overflow-hidden rounded-full bg-[#eef0ea]">
                              <div
                                className={`h-full rounded-full ${row.condition === "working" ? "bg-[#3f7d5c]" : row.condition === "breakdown" ? "bg-[#a94a35]" : "bg-[#b7bab0]"}`}
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

              {/* 04 Weather status (full width) */}
              <SectionCard idx="04" title="Weather status">
                <div
                  className="grid mx-[18px] my-2.5 border border-[#dcdfd6]"
                  style={{ gridTemplateColumns: "120px repeat(3, 1fr)", gap: 1, background: "#dcdfd6" }}
                >
                  <div className="bg-[#f7f8f4]" />
                  {WEATHER_SLOTS.map((slot) => (
                    <div key={slot} className="bg-[#f7f8f4] px-2.5 py-2 text-[11.5px] font-semibold text-[#6c7166]">
                      {WEATHER_SLOT_LABEL[slot]}
                    </div>
                  ))}

                  <div className="bg-[#f7f8f4] px-2.5 py-2 text-[12.5px] font-medium flex items-center">Weather status</div>
                  <div data-arrow-row style={{ display: "contents" }}>
                    {weather.map((w, i) => (
                      <div key={`status-${w.slot}`} className="bg-white px-2.5 py-2">
                        <input className={cellInputCls} placeholder="e.g. Sunny" value={w.condition} onChange={(e) => updateWeather(i, { condition: e.target.value })} onKeyDown={handleRowArrowNav} />
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#f7f8f4] px-2.5 py-2 text-[12.5px] font-medium flex items-center">Temperature (°C)</div>
                  <div data-arrow-row style={{ display: "contents" }}>
                    {weather.map((w, i) => (
                      <div key={`temp-${w.slot}`} className="bg-white px-2.5 py-2">
                        <input className={cellMonoCls} style={{ fontFamily: FONT_MONO }} value={w.tempC} onChange={(e) => updateWeather(i, { tempC: e.target.value })} onKeyDown={handleRowArrowNav} />
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#f7f8f4] px-2.5 py-2 text-[12.5px] font-medium flex items-center">Rainfall status</div>
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
                        <tr key={i} className="hover:bg-[#f7f8f4]">
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
                                className="flex-shrink-0 p-1 text-[#9a9d94] hover:text-[#3f6079] transition-colors"
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
                        <tr key={i} className="hover:bg-[#f7f8f4]">
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
                        <tr key={i} className="hover:bg-[#f7f8f4]">
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
              <section className="bg-white border border-[#b7bab0] rounded-lg mb-4 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#eef0ea]">
                  <h3 className="font-semibold text-[15px] text-[#20242a] m-0">Remarks / issues / concerns</h3>
                </div>
                <div className="p-4">
                  <textarea
                    className="w-full min-h-[70px] border border-[#dcdfd6] rounded-lg p-2.5 text-[13.5px] resize-y focus:outline-none focus:border-[#e2903a]"
                    placeholder="Any open issues, concerns or notes for the day..."
                    value={remarksText}
                    onChange={(e) => setRemarksText(e.target.value)}
                  />
                  <div className="flex items-center justify-end gap-2.5 mt-3">
                    <label className="text-[12px] text-[#6c7166]">Signature (site in-charge):</label>
                    <input
                      className="w-[220px] px-0.5 py-1 border-0 border-b border-[#b7bab0] text-[13.5px] focus:outline-none focus:border-[#e2903a] bg-transparent"
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
                  <span className="px-3 py-2 text-[13px] font-medium text-[#3f7d5c] bg-[#e6efe8] border border-[#bcd6c6] rounded-lg">✓ Submitted</span>
                ) : (
                  <span className="text-[12px] text-[#9a9d94]">Not submitted yet — fields are being saved as a draft.</span>
                )}
                <button
                  onClick={handleSubmitReport}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#3f6079] text-white rounded-lg font-semibold text-[13.5px] hover:bg-[#2f4a5c] transition-colors disabled:opacity-50"
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
