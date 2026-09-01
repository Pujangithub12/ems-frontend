import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Plus,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Trash2,
  Camera,
  ClipboardList,
  Users,
  Wrench,
  Package,
  ShieldAlert,
  MessageSquare,
  CalendarRange,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { useProjects } from "../../projects/hooks/useProjects";
import { getErrorMessage } from "../../../lib/errors";
import ErrorBanner from "../../../components/ErrorBanner";
import ConfirmationModal from "../../../components/ConfirmationModal";
import Drawer, { DrawerSection } from "../../../components/Drawer";
import StatCard from "../../../components/StatCard";
import {
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
  SaveSiteActivityItemPayload,
  SaveSiteActivityEquipmentPayload,
  SaveSiteActivityManpowerPayload,
  SiteActivityWeatherSlot,
  SiteActivityRainfall,
  SiteActivitySafetyType,
  SaveSiteActivityWeatherPayload,
  SaveSiteActivityMaterialPayload,
  SaveSiteActivitySafetyPayload,
  SaveSiteActivityInstructionPayload,
} from "../api/siteActivity.api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const fileUrl = (filePath: string) => `${API_BASE}/uploads/${filePath}`;

const todayIso = () => new Date().toLocaleDateString("en-CA");

const formatDateLabel = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  const label = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
  return iso === todayIso() ? `${label} (Today)` : label;
};

const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" });
};

const shiftDateIso = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
};

/** Monday of the week containing `iso`. */
const getWeekStart = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toLocaleDateString("en-CA");
};

const formatShortDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
};

const formatShortDateWithYear = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
};

const WEEKDAY_LABEL = (iso: string): string => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });

const inputCls =
  "w-full px-3 py-2 text-[13px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-400 transition-colors";

// ---- Small display building blocks ----

const Panel: React.FC<{ title: string; badge?: string; onAdd?: () => void; children: React.ReactNode }> = ({
  title,
  badge,
  onAdd,
  children,
}) => (
  <div className="overflow-hidden bg-white border rounded-xl border-slate-200">
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
      <h3 className="text-[13.5px] font-semibold text-slate-900">{title}</h3>
      <div className="flex items-center gap-2">
        {badge && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{badge}</span>}
        {onAdd && (
          <button
            onClick={onAdd}
            title="Add"
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md text-blue-700 hover:bg-blue-50"
          >
            <Plus size={12} /> Add
          </button>
        )}
      </div>
    </div>
    {children}
  </div>
);

const STATUS_BADGE_CLS: Record<SiteActivityItemStatus, string> = {
  ongoing: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
};

const CONDITION_BADGE_CLS: Record<SiteActivityEquipmentCondition, string> = {
  working: "bg-emerald-50 text-emerald-700",
  idle: "bg-slate-100 text-slate-600",
  breakdown: "bg-red-50 text-red-700",
};

const CONDITION_BAR_CLS: Record<SiteActivityEquipmentCondition, string> = {
  working: "bg-blue-600",
  idle: "bg-slate-300",
  breakdown: "bg-red-500",
};

const WEATHER_SLOTS: SiteActivityWeatherSlot[] = ["morning", "afternoon", "evening"];
const WEATHER_SLOT_LABEL: Record<SiteActivityWeatherSlot, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
const RAINFALL_LABEL: Record<SiteActivityRainfall, string> = {
  no_rainfall: "No rainfall",
  light: "Light",
  moderate: "Moderate",
  heavy: "Heavy rainfall",
};
const SAFETY_TYPE_LABEL: Record<SiteActivitySafetyType, string> = { observation: "Observation", incident: "Incident" };

// ---- Site Photographs panel — upload/delete inline ----

const PhotosPanel: React.FC<{ report: SiteActivityReport; projectId: number; date: string }> = ({ report, projectId, date }) => {
  const uploadMutation = useUploadSiteActivityPhoto(projectId, date);
  const deleteMutation = useDeleteSiteActivityPhoto(projectId, date);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      await uploadMutation.mutateAsync({ reportId: report.id, file });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to upload photo."));
    }
  };

  return (
    <Panel title="4. Site Photographs" badge={`${report.photos.length}`}>
      <div className="p-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-3" />}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {report.photos.map((p) => (
            <div key={p.id} className="relative overflow-hidden bg-slate-100 rounded-lg group aspect-square">
              <img src={fileUrl(p.filePath)} alt={p.caption ?? p.fileName} className="object-cover w-full h-full" />
              {p.caption && (
                <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[10px] text-white bg-black/50 truncate">{p.caption}</div>
              )}
              <button
                onClick={() => deleteMutation.mutate(p.id)}
                title="Delete photo"
                className="absolute p-1 text-white rounded-full opacity-0 top-1 right-1 bg-black/60 group-hover:opacity-100 hover:bg-red-600"
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="flex flex-col items-center justify-center gap-1 text-slate-400 border-2 border-dashed rounded-lg aspect-square border-slate-200 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
          >
            {uploadMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            <span className="text-[10.5px] font-medium">Add Photo</span>
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
        {report.photos.length === 0 && <p className="mt-2 text-[12px] text-slate-400">No photos yet — add one above.</p>}
      </div>
    </Panel>
  );
};

// ---- New/Edit DPR form ----

type FormActivity = { description: string; chainage: string; todayQty: string; unit: string; status: SiteActivityItemStatus; remarks: string };
type FormEquipment = { equipmentName: string; quantity: string; workingHours: string; condition: SiteActivityEquipmentCondition };
type FormManpower = { role: string; headcount: string };
type FormWeather = { slot: SiteActivityWeatherSlot; condition: string; tempC: string; rainfall: SiteActivityRainfall | ""; remarks: string };
type FormMaterial = {
  materialType: string;
  receivedQuantity: string;
  receivedUnit: string;
  usedQuantity: string;
  usedUnit: string;
  remarks: string;
};
type FormSafety = { type: SiteActivitySafetyType; description: string; actionTaken: string };
type FormInstruction = { description: string; byWhom: string; toWhom: string; time: string; signatureOf: string };

const emptyActivity = (): FormActivity => ({ description: "", chainage: "", todayQty: "", unit: "Nos", status: "ongoing", remarks: "" });
const emptyEquipment = (): FormEquipment => ({ equipmentName: "", quantity: "1", workingHours: "", condition: "working" });
const emptyMaterial = (): FormMaterial => ({
  materialType: "",
  receivedQuantity: "",
  receivedUnit: "",
  usedQuantity: "",
  usedUnit: "",
  remarks: "",
});
const emptySafety = (): FormSafety => ({ type: "observation", description: "", actionTaken: "" });
const emptyInstruction = (): FormInstruction => ({ description: "", byWhom: "", toWhom: "", time: "", signatureOf: "" });
const emptyWeatherRows = (): FormWeather[] =>
  WEATHER_SLOTS.map((slot) => ({ slot, condition: "", tempC: "", rainfall: "" as const, remarks: "" }));
const DEFAULT_ROLES = ["Site Engineer", "Supervisor", "Skilled Labor", "Unskilled Labor", "Driver"];

// ---- Quick-add — a single-row popup per panel, so adding one entry doesn't
// require opening the full Edit DPR drawer. There's no per-row create
// endpoint: this reuses the same full-replace save, built from the
// currently-loaded report's other sections plus the one new row. ----

function reportToBasePayload(report: SiteActivityReport): SaveSiteActivityReportPayload {
  return {
    reportDate: report.reportDate,
    location: report.location,
    status: report.status,
    activities: report.activities.map((a) => ({
      description: a.description,
      chainage: a.chainage,
      todayQty: a.todayQty,
      unit: a.unit,
      status: a.status,
      remarks: a.remarks,
    })),
    equipment: report.equipment.map((e) => ({
      equipmentName: e.equipmentName,
      quantity: e.quantity,
      workingHours: e.workingHours,
      condition: e.condition,
    })),
    manpower: report.manpower.map((m) => ({ role: m.role, headcount: m.headcount })),
    weather: report.weather.map((w) => ({ slot: w.slot, condition: w.condition, tempC: w.tempC, rainfall: w.rainfall, remarks: w.remarks })),
    materials: report.materials.map((m) => ({
      materialType: m.materialType,
      receivedQuantity: m.receivedQuantity,
      receivedUnit: m.receivedUnit,
      usedQuantity: m.usedQuantity,
      usedUnit: m.usedUnit,
      remarks: m.remarks,
    })),
    safety: report.safety.map((s) => ({ type: s.type, description: s.description, actionTaken: s.actionTaken })),
    instructions: report.instructions.map((i) => ({
      description: i.description,
      byWhom: i.byWhom,
      toWhom: i.toWhom,
      time: i.time,
      signatureOf: i.signatureOf,
    })),
  };
}

const QuickAddModal: React.FC<{
  title: string;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
  error: string | null;
  children: React.ReactNode;
}> = ({ title, onSave, onClose, isSaving, error, children }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
    <div className="w-full max-w-sm overflow-hidden bg-white border rounded-xl shadow-2xl border-slate-200/70">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/60">
        <div className="font-semibold text-[14px] text-slate-900">{title}</div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-2">
        {children}
        {error && <p className="text-[11.5px] text-red-600">{error}</p>}
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center justify-center w-full gap-1.5 px-3 py-2 text-[12.5px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Add
        </button>
      </div>
    </div>
  </div>
);

type QuickAddProps = { report: SiteActivityReport; projectId: number; date: string; onClose: () => void };

const QuickAddActivity: React.FC<QuickAddProps> = ({ report, projectId, date, onClose }) => {
  const saveMutation = useSaveSiteActivityReport(projectId, date);
  const [row, setRow] = useState<FormActivity>(emptyActivity());
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!row.description.trim()) {
      setError("Work description is required.");
      return;
    }
    setError(null);
    try {
      const base = reportToBasePayload(report);
      await saveMutation.mutateAsync({
        ...base,
        activities: [
          ...base.activities,
          {
            description: row.description.trim(),
            chainage: row.chainage.trim() || null,
            todayQty: row.todayQty.trim() ? Number(row.todayQty) : null,
            unit: row.unit.trim() || null,
            status: row.status,
            remarks: row.remarks.trim() || null,
          },
        ],
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add."));
    }
  };

  return (
    <QuickAddModal title="Add Work Activity" onSave={handleSave} onClose={onClose} isSaving={saveMutation.isPending} error={error}>
      <input
        autoFocus
        className={inputCls}
        placeholder="Work description"
        value={row.description}
        onChange={(e) => setRow((r) => ({ ...r, description: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-1.5">
        <input
          className={inputCls}
          placeholder="Chainage"
          value={row.chainage}
          onChange={(e) => setRow((r) => ({ ...r, chainage: e.target.value }))}
        />
        <input
          className={inputCls}
          placeholder="Today qty"
          type="number"
          value={row.todayQty}
          onChange={(e) => setRow((r) => ({ ...r, todayQty: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <input className={inputCls} placeholder="Unit" value={row.unit} onChange={(e) => setRow((r) => ({ ...r, unit: e.target.value }))} />
        <select
          className={inputCls}
          value={row.status}
          onChange={(e) => setRow((r) => ({ ...r, status: e.target.value as SiteActivityItemStatus }))}
        >
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <input
        className={inputCls}
        placeholder="Remarks / total"
        value={row.remarks}
        onChange={(e) => setRow((r) => ({ ...r, remarks: e.target.value }))}
      />
    </QuickAddModal>
  );
};

const QuickAddEquipment: React.FC<QuickAddProps> = ({ report, projectId, date, onClose }) => {
  const saveMutation = useSaveSiteActivityReport(projectId, date);
  const [row, setRow] = useState<FormEquipment>(emptyEquipment());
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!row.equipmentName.trim()) {
      setError("Equipment name is required.");
      return;
    }
    setError(null);
    try {
      const base = reportToBasePayload(report);
      await saveMutation.mutateAsync({
        ...base,
        equipment: [
          ...base.equipment,
          {
            equipmentName: row.equipmentName.trim(),
            quantity: row.quantity.trim() ? Number(row.quantity) : 1,
            workingHours: row.workingHours.trim() ? Number(row.workingHours) : null,
            condition: row.condition,
          },
        ],
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add."));
    }
  };

  return (
    <QuickAddModal title="Add Equipment" onSave={handleSave} onClose={onClose} isSaving={saveMutation.isPending} error={error}>
      <input
        autoFocus
        className={inputCls}
        placeholder="Equipment name"
        value={row.equipmentName}
        onChange={(e) => setRow((r) => ({ ...r, equipmentName: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-1.5">
        <input
          className={inputCls}
          placeholder="Quantity"
          type="number"
          value={row.quantity}
          onChange={(e) => setRow((r) => ({ ...r, quantity: e.target.value }))}
        />
        <input
          className={inputCls}
          placeholder="Working hours"
          type="number"
          value={row.workingHours}
          onChange={(e) => setRow((r) => ({ ...r, workingHours: e.target.value }))}
        />
      </div>
      <select
        className={inputCls}
        value={row.condition}
        onChange={(e) => setRow((r) => ({ ...r, condition: e.target.value as SiteActivityEquipmentCondition }))}
      >
        <option value="working">Working</option>
        <option value="idle">Idle</option>
        <option value="breakdown">Breakdown</option>
      </select>
    </QuickAddModal>
  );
};

const QuickAddManpower: React.FC<QuickAddProps> = ({ report, projectId, date, onClose }) => {
  const saveMutation = useSaveSiteActivityReport(projectId, date);
  const [row, setRow] = useState<FormManpower>({ role: "", headcount: "" });
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!row.role.trim() || !row.headcount.trim()) {
      setError("Role and headcount are required.");
      return;
    }
    setError(null);
    try {
      const base = reportToBasePayload(report);
      await saveMutation.mutateAsync({
        ...base,
        manpower: [...base.manpower, { role: row.role.trim(), headcount: Number(row.headcount) }],
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add."));
    }
  };

  return (
    <QuickAddModal title="Add Manpower Role" onSave={handleSave} onClose={onClose} isSaving={saveMutation.isPending} error={error}>
      <input
        autoFocus
        className={inputCls}
        placeholder="Role (e.g. Mason)"
        value={row.role}
        onChange={(e) => setRow((r) => ({ ...r, role: e.target.value }))}
      />
      <input
        className={inputCls}
        placeholder="Headcount"
        type="number"
        value={row.headcount}
        onChange={(e) => setRow((r) => ({ ...r, headcount: e.target.value }))}
      />
    </QuickAddModal>
  );
};

const QuickAddMaterial: React.FC<QuickAddProps> = ({ report, projectId, date, onClose }) => {
  const saveMutation = useSaveSiteActivityReport(projectId, date);
  const [row, setRow] = useState<FormMaterial>(emptyMaterial());
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!row.materialType.trim()) {
      setError("Material type is required.");
      return;
    }
    setError(null);
    try {
      const base = reportToBasePayload(report);
      await saveMutation.mutateAsync({
        ...base,
        materials: [
          ...base.materials,
          {
            materialType: row.materialType.trim(),
            receivedQuantity: row.receivedQuantity.trim() ? Number(row.receivedQuantity) : null,
            receivedUnit: row.receivedUnit.trim() || null,
            usedQuantity: row.usedQuantity.trim() ? Number(row.usedQuantity) : null,
            usedUnit: row.usedUnit.trim() || null,
            remarks: row.remarks.trim() || null,
          },
        ],
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add."));
    }
  };

  return (
    <QuickAddModal title="Add Material" onSave={handleSave} onClose={onClose} isSaving={saveMutation.isPending} error={error}>
      <input
        autoFocus
        className={inputCls}
        placeholder="Material type"
        value={row.materialType}
        onChange={(e) => setRow((r) => ({ ...r, materialType: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase">Received</p>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              className={inputCls}
              placeholder="Qty"
              type="number"
              value={row.receivedQuantity}
              onChange={(e) => setRow((r) => ({ ...r, receivedQuantity: e.target.value }))}
            />
            <input
              className={inputCls}
              placeholder="Unit"
              value={row.receivedUnit}
              onChange={(e) => setRow((r) => ({ ...r, receivedUnit: e.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase">Used</p>
          <div className="grid grid-cols-2 gap-1.5">
            <input
              className={inputCls}
              placeholder="Qty"
              type="number"
              value={row.usedQuantity}
              onChange={(e) => setRow((r) => ({ ...r, usedQuantity: e.target.value }))}
            />
            <input
              className={inputCls}
              placeholder="Unit"
              value={row.usedUnit}
              onChange={(e) => setRow((r) => ({ ...r, usedUnit: e.target.value }))}
            />
          </div>
        </div>
      </div>
      <input
        className={inputCls}
        placeholder="Remarks"
        value={row.remarks}
        onChange={(e) => setRow((r) => ({ ...r, remarks: e.target.value }))}
      />
    </QuickAddModal>
  );
};

const QuickAddSafety: React.FC<QuickAddProps> = ({ report, projectId, date, onClose }) => {
  const saveMutation = useSaveSiteActivityReport(projectId, date);
  const [row, setRow] = useState<FormSafety>(emptySafety());
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!row.description.trim()) {
      setError("Description is required.");
      return;
    }
    setError(null);
    try {
      const base = reportToBasePayload(report);
      await saveMutation.mutateAsync({
        ...base,
        safety: [
          ...base.safety,
          { type: row.type, description: row.description.trim() || null, actionTaken: row.actionTaken.trim() || null },
        ],
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add."));
    }
  };

  return (
    <QuickAddModal title="Add Safety Entry" onSave={handleSave} onClose={onClose} isSaving={saveMutation.isPending} error={error}>
      <select className={inputCls} value={row.type} onChange={(e) => setRow((r) => ({ ...r, type: e.target.value as SiteActivitySafetyType }))}>
        <option value="observation">Observation</option>
        <option value="incident">Incident</option>
      </select>
      <input
        autoFocus
        className={inputCls}
        placeholder="Description"
        value={row.description}
        onChange={(e) => setRow((r) => ({ ...r, description: e.target.value }))}
      />
      <input
        className={inputCls}
        placeholder="Action taken"
        value={row.actionTaken}
        onChange={(e) => setRow((r) => ({ ...r, actionTaken: e.target.value }))}
      />
    </QuickAddModal>
  );
};

const QuickAddInstruction: React.FC<QuickAddProps> = ({ report, projectId, date, onClose }) => {
  const saveMutation = useSaveSiteActivityReport(projectId, date);
  const [row, setRow] = useState<FormInstruction>(emptyInstruction());
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!row.description.trim()) {
      setError("Description is required.");
      return;
    }
    setError(null);
    try {
      const base = reportToBasePayload(report);
      await saveMutation.mutateAsync({
        ...base,
        instructions: [
          ...base.instructions,
          {
            description: row.description.trim() || null,
            byWhom: row.byWhom.trim() || null,
            toWhom: row.toWhom.trim() || null,
            time: row.time.trim() || null,
            signatureOf: row.signatureOf.trim() || null,
          },
        ],
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add."));
    }
  };

  return (
    <QuickAddModal title="Add Instruction" onSave={handleSave} onClose={onClose} isSaving={saveMutation.isPending} error={error}>
      <input
        autoFocus
        className={inputCls}
        placeholder="Description"
        value={row.description}
        onChange={(e) => setRow((r) => ({ ...r, description: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-1.5">
        <input
          className={inputCls}
          placeholder="By whom"
          value={row.byWhom}
          onChange={(e) => setRow((r) => ({ ...r, byWhom: e.target.value }))}
        />
        <input
          className={inputCls}
          placeholder="To whom"
          value={row.toWhom}
          onChange={(e) => setRow((r) => ({ ...r, toWhom: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <input className={inputCls} placeholder="Time" value={row.time} onChange={(e) => setRow((r) => ({ ...r, time: e.target.value }))} />
        <input
          className={inputCls}
          placeholder="Signature of"
          value={row.signatureOf}
          onChange={(e) => setRow((r) => ({ ...r, signatureOf: e.target.value }))}
        />
      </div>
    </QuickAddModal>
  );
};

const SiteActivityFormDrawer: React.FC<{
  open: boolean;
  projectId: number;
  date: string;
  existing: SiteActivityReport | null;
  onClose: () => void;
}> = ({ open, projectId, date, existing, onClose }) => {
  const saveMutation = useSaveSiteActivityReport(projectId, date);
  const [location, setLocation] = useState(existing?.location ?? "");
  const [activities, setActivities] = useState<FormActivity[]>([emptyActivity()]);
  const [equipment, setEquipment] = useState<FormEquipment[]>([emptyEquipment()]);
  const [manpower, setManpower] = useState<FormManpower[]>(DEFAULT_ROLES.map((role) => ({ role, headcount: "" })));
  const [weather, setWeather] = useState<FormWeather[]>(emptyWeatherRows());
  const [materials, setMaterials] = useState<FormMaterial[]>([emptyMaterial()]);
  const [safety, setSafety] = useState<FormSafety[]>([emptySafety()]);
  const [instructions, setInstructions] = useState<FormInstruction[]>([emptyInstruction()]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocation(existing?.location ?? "");
    setActivities(
      existing && existing.activities.length > 0
        ? existing.activities.map((a) => ({
            description: a.description,
            chainage: a.chainage ?? "",
            todayQty: a.todayQty != null ? String(a.todayQty) : "",
            unit: a.unit ?? "",
            status: a.status,
            remarks: a.remarks ?? "",
          }))
        : [emptyActivity()],
    );
    setEquipment(
      existing && existing.equipment.length > 0
        ? existing.equipment.map((e) => ({
            equipmentName: e.equipmentName,
            quantity: String(e.quantity),
            workingHours: e.workingHours != null ? String(e.workingHours) : "",
            condition: e.condition,
          }))
        : [emptyEquipment()],
    );
    if (existing && existing.manpower.length > 0) {
      const byRole = new Map(existing.manpower.map((m) => [m.role, String(m.headcount)]));
      const roles = Array.from(new Set([...DEFAULT_ROLES, ...existing.manpower.map((m) => m.role)]));
      setManpower(roles.map((role) => ({ role, headcount: byRole.get(role) ?? "" })));
    } else {
      setManpower(DEFAULT_ROLES.map((role) => ({ role, headcount: "" })));
    }
    if (existing && existing.weather.length > 0) {
      const bySlot = new Map(existing.weather.map((w) => [w.slot, w]));
      setWeather(
        WEATHER_SLOTS.map((slot) => {
          const w = bySlot.get(slot);
          return {
            slot,
            condition: w?.condition ?? "",
            tempC: w?.tempC != null ? String(w.tempC) : "",
            rainfall: w?.rainfall ?? "",
            remarks: w?.remarks ?? "",
          };
        }),
      );
    } else {
      setWeather(emptyWeatherRows());
    }
    setMaterials(
      existing && existing.materials.length > 0
        ? existing.materials.map((m) => ({
            materialType: m.materialType,
            receivedQuantity: m.receivedQuantity != null ? String(m.receivedQuantity) : "",
            receivedUnit: m.receivedUnit ?? "",
            usedQuantity: m.usedQuantity != null ? String(m.usedQuantity) : "",
            usedUnit: m.usedUnit ?? "",
            remarks: m.remarks ?? "",
          }))
        : [emptyMaterial()],
    );
    setSafety(
      existing && existing.safety.length > 0
        ? existing.safety.map((s) => ({ type: s.type, description: s.description ?? "", actionTaken: s.actionTaken ?? "" }))
        : [emptySafety()],
    );
    setInstructions(
      existing && existing.instructions.length > 0
        ? existing.instructions.map((i) => ({
            description: i.description ?? "",
            byWhom: i.byWhom ?? "",
            toWhom: i.toWhom ?? "",
            time: i.time ?? "",
            signatureOf: i.signatureOf ?? "",
          }))
        : [emptyInstruction()],
    );
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    try {
      const cleanActivities: SaveSiteActivityItemPayload[] = activities
        .filter((a) => a.description.trim())
        .map((a) => ({
          description: a.description.trim(),
          chainage: a.chainage.trim() || null,
          todayQty: a.todayQty.trim() ? Number(a.todayQty) : null,
          unit: a.unit.trim() || null,
          status: a.status,
          remarks: a.remarks.trim() || null,
        }));
      const cleanEquipment: SaveSiteActivityEquipmentPayload[] = equipment
        .filter((e) => e.equipmentName.trim())
        .map((e) => ({
          equipmentName: e.equipmentName.trim(),
          quantity: e.quantity.trim() ? Number(e.quantity) : 1,
          workingHours: e.workingHours.trim() ? Number(e.workingHours) : null,
          condition: e.condition,
        }));
      const cleanManpower: SaveSiteActivityManpowerPayload[] = manpower
        .filter((m) => m.role.trim() && m.headcount.trim())
        .map((m) => ({ role: m.role.trim(), headcount: Number(m.headcount) }));
      const cleanWeather: SaveSiteActivityWeatherPayload[] = weather.map((w) => ({
        slot: w.slot,
        condition: w.condition.trim() || null,
        tempC: w.tempC.trim() ? Number(w.tempC) : null,
        rainfall: w.rainfall || null,
        remarks: w.remarks.trim() || null,
      }));
      const cleanMaterials: SaveSiteActivityMaterialPayload[] = materials
        .filter((m) => m.materialType.trim())
        .map((m) => ({
          materialType: m.materialType.trim(),
          receivedQuantity: m.receivedQuantity.trim() ? Number(m.receivedQuantity) : null,
          receivedUnit: m.receivedUnit.trim() || null,
          usedQuantity: m.usedQuantity.trim() ? Number(m.usedQuantity) : null,
          usedUnit: m.usedUnit.trim() || null,
          remarks: m.remarks.trim() || null,
        }));
      const cleanSafety: SaveSiteActivitySafetyPayload[] = safety
        .filter((s) => s.description.trim())
        .map((s) => ({ type: s.type, description: s.description.trim() || null, actionTaken: s.actionTaken.trim() || null }));
      const cleanInstructions: SaveSiteActivityInstructionPayload[] = instructions
        .filter((i) => i.description.trim())
        .map((i) => ({
          description: i.description.trim() || null,
          byWhom: i.byWhom.trim() || null,
          toWhom: i.toWhom.trim() || null,
          time: i.time.trim() || null,
          signatureOf: i.signatureOf.trim() || null,
        }));

      await saveMutation.mutateAsync({
        reportDate: date,
        location: location.trim() || null,
        status: "submitted",
        activities: cleanActivities,
        equipment: cleanEquipment,
        manpower: cleanManpower,
        weather: cleanWeather,
        materials: cleanMaterials,
        safety: cleanSafety,
        instructions: cleanInstructions,
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save report."));
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title={existing ? "Edit Daily Report" : "New Daily Progress Report"} subtitle={date} width={640}>
      <DrawerSection title="Location">
        <input className={inputCls} placeholder="e.g. Birgunj" value={location} onChange={(e) => setLocation(e.target.value)} />
      </DrawerSection>

      <DrawerSection
        title="Work Activities Progress"
        action={
          <button
            onClick={() => setActivities((rows) => [...rows, emptyActivity()])}
            className="flex items-center gap-1 text-[11.5px] font-medium text-blue-700 hover:underline"
          >
            <Plus size={12} /> Add Row
          </button>
        }
      >
        <div className="space-y-2">
          {activities.map((row, i) => (
            <div key={i} className="p-2.5 space-y-1.5 border rounded-lg border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-1.5">
                <input
                  className={inputCls}
                  placeholder="Work description"
                  value={row.description}
                  onChange={(e) =>
                    setActivities((rows) => rows.map((r, idx) => (idx === i ? { ...r, description: e.target.value } : r)))
                  }
                />
                <button
                  onClick={() => setActivities((rows) => rows.filter((_, idx) => idx !== i))}
                  className="flex-shrink-0 p-2 text-slate-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <input
                  className={inputCls}
                  placeholder="Chainage"
                  value={row.chainage}
                  onChange={(e) => setActivities((rows) => rows.map((r, idx) => (idx === i ? { ...r, chainage: e.target.value } : r)))}
                />
                <input
                  className={inputCls}
                  placeholder="Today qty"
                  type="number"
                  value={row.todayQty}
                  onChange={(e) => setActivities((rows) => rows.map((r, idx) => (idx === i ? { ...r, todayQty: e.target.value } : r)))}
                />
                <input
                  className={inputCls}
                  placeholder="Unit"
                  value={row.unit}
                  onChange={(e) => setActivities((rows) => rows.map((r, idx) => (idx === i ? { ...r, unit: e.target.value } : r)))}
                />
                <select
                  className={inputCls}
                  value={row.status}
                  onChange={(e) =>
                    setActivities((rows) =>
                      rows.map((r, idx) => (idx === i ? { ...r, status: e.target.value as SiteActivityItemStatus } : r)),
                    )
                  }
                >
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <input
                className={inputCls}
                placeholder="Remarks / total"
                value={row.remarks}
                onChange={(e) => setActivities((rows) => rows.map((r, idx) => (idx === i ? { ...r, remarks: e.target.value } : r)))}
              />
            </div>
          ))}
        </div>
      </DrawerSection>

      <DrawerSection
        title="Equipment & Machinery Log"
        action={
          <button
            onClick={() => setEquipment((rows) => [...rows, emptyEquipment()])}
            className="flex items-center gap-1 text-[11.5px] font-medium text-blue-700 hover:underline"
          >
            <Plus size={12} /> Add Row
          </button>
        }
      >
        <div className="space-y-2">
          {equipment.map((row, i) => (
            <div key={i} className="grid items-center grid-cols-12 gap-1.5">
              <input
                className={`${inputCls} col-span-4`}
                placeholder="Equipment"
                value={row.equipmentName}
                onChange={(e) => setEquipment((rows) => rows.map((r, idx) => (idx === i ? { ...r, equipmentName: e.target.value } : r)))}
              />
              <input
                className={`${inputCls} col-span-2`}
                placeholder="Qty"
                type="number"
                value={row.quantity}
                onChange={(e) => setEquipment((rows) => rows.map((r, idx) => (idx === i ? { ...r, quantity: e.target.value } : r)))}
              />
              <input
                className={`${inputCls} col-span-2`}
                placeholder="Hours"
                type="number"
                value={row.workingHours}
                onChange={(e) => setEquipment((rows) => rows.map((r, idx) => (idx === i ? { ...r, workingHours: e.target.value } : r)))}
              />
              <select
                className={`${inputCls} col-span-3`}
                value={row.condition}
                onChange={(e) =>
                  setEquipment((rows) =>
                    rows.map((r, idx) => (idx === i ? { ...r, condition: e.target.value as SiteActivityEquipmentCondition } : r)),
                  )
                }
              >
                <option value="working">Working</option>
                <option value="idle">Idle</option>
                <option value="breakdown">Breakdown</option>
              </select>
              <button
                onClick={() => setEquipment((rows) => rows.filter((_, idx) => idx !== i))}
                className="col-span-1 p-2 text-slate-400 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </DrawerSection>

      <DrawerSection
        title="Manpower Breakdown"
        action={
          <button
            onClick={() => setManpower((rows) => [...rows, { role: "", headcount: "" }])}
            className="flex items-center gap-1 text-[11.5px] font-medium text-blue-700 hover:underline"
          >
            <Plus size={12} /> Add Role
          </button>
        }
      >
        <div className="space-y-1.5">
          {manpower.map((row, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                className={inputCls}
                placeholder="Role"
                value={row.role}
                onChange={(e) => setManpower((rows) => rows.map((r, idx) => (idx === i ? { ...r, role: e.target.value } : r)))}
              />
              <input
                className={inputCls}
                style={{ width: 90 }}
                placeholder="Count"
                type="number"
                value={row.headcount}
                onChange={(e) => setManpower((rows) => rows.map((r, idx) => (idx === i ? { ...r, headcount: e.target.value } : r)))}
              />
              <button
                onClick={() => setManpower((rows) => rows.filter((_, idx) => idx !== i))}
                className="flex-shrink-0 p-2 text-slate-400 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </DrawerSection>

      <DrawerSection title="Weather Status">
        <div className="space-y-2">
          {weather.map((row, i) => (
            <div key={row.slot} className="p-2.5 space-y-1.5 border rounded-lg border-slate-200 bg-slate-50/50">
              <p className="text-[11.5px] font-semibold text-slate-600">{WEATHER_SLOT_LABEL[row.slot]}</p>
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  className={inputCls}
                  placeholder="Status (e.g. sunny)"
                  value={row.condition}
                  onChange={(e) => setWeather((rows) => rows.map((r, idx) => (idx === i ? { ...r, condition: e.target.value } : r)))}
                />
                <input
                  className={inputCls}
                  placeholder="Temp (°C)"
                  type="number"
                  value={row.tempC}
                  onChange={(e) => setWeather((rows) => rows.map((r, idx) => (idx === i ? { ...r, tempC: e.target.value } : r)))}
                />
                <select
                  className={inputCls}
                  value={row.rainfall}
                  onChange={(e) =>
                    setWeather((rows) =>
                      rows.map((r, idx) => (idx === i ? { ...r, rainfall: e.target.value as SiteActivityRainfall } : r)),
                    )
                  }
                >
                  <option value="">Rainfall...</option>
                  <option value="no_rainfall">No rainfall</option>
                  <option value="light">Light</option>
                  <option value="moderate">Moderate</option>
                  <option value="heavy">Heavy rainfall</option>
                </select>
              </div>
              <input
                className={inputCls}
                placeholder="Remarks"
                value={row.remarks}
                onChange={(e) => setWeather((rows) => rows.map((r, idx) => (idx === i ? { ...r, remarks: e.target.value } : r)))}
              />
            </div>
          ))}
        </div>
      </DrawerSection>

      <DrawerSection
        title="Materials"
        action={
          <button
            onClick={() => setMaterials((rows) => [...rows, emptyMaterial()])}
            className="flex items-center gap-1 text-[11.5px] font-medium text-blue-700 hover:underline"
          >
            <Plus size={12} /> Add Row
          </button>
        }
      >
        <div className="space-y-2">
          {materials.map((row, i) => (
            <div key={i} className="p-2.5 space-y-1.5 border rounded-lg border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-1.5">
                <input
                  className={inputCls}
                  placeholder="Material type"
                  value={row.materialType}
                  onChange={(e) =>
                    setMaterials((rows) => rows.map((r, idx) => (idx === i ? { ...r, materialType: e.target.value } : r)))
                  }
                />
                <button
                  onClick={() => setMaterials((rows) => rows.filter((_, idx) => idx !== i))}
                  className="flex-shrink-0 p-2 text-slate-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase">Received</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      className={inputCls}
                      placeholder="Quantity"
                      type="number"
                      value={row.receivedQuantity}
                      onChange={(e) =>
                        setMaterials((rows) => rows.map((r, idx) => (idx === i ? { ...r, receivedQuantity: e.target.value } : r)))
                      }
                    />
                    <input
                      className={inputCls}
                      placeholder="Unit"
                      value={row.receivedUnit}
                      onChange={(e) =>
                        setMaterials((rows) => rows.map((r, idx) => (idx === i ? { ...r, receivedUnit: e.target.value } : r)))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase">Used</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      className={inputCls}
                      placeholder="Quantity"
                      type="number"
                      value={row.usedQuantity}
                      onChange={(e) =>
                        setMaterials((rows) => rows.map((r, idx) => (idx === i ? { ...r, usedQuantity: e.target.value } : r)))
                      }
                    />
                    <input
                      className={inputCls}
                      placeholder="Unit"
                      value={row.usedUnit}
                      onChange={(e) => setMaterials((rows) => rows.map((r, idx) => (idx === i ? { ...r, usedUnit: e.target.value } : r)))}
                    />
                  </div>
                </div>
              </div>
              <input
                className={inputCls}
                placeholder="Remarks"
                value={row.remarks}
                onChange={(e) => setMaterials((rows) => rows.map((r, idx) => (idx === i ? { ...r, remarks: e.target.value } : r)))}
              />
            </div>
          ))}
        </div>
      </DrawerSection>

      <DrawerSection
        title="Safety"
        action={
          <button
            onClick={() => setSafety((rows) => [...rows, emptySafety()])}
            className="flex items-center gap-1 text-[11.5px] font-medium text-blue-700 hover:underline"
          >
            <Plus size={12} /> Add Row
          </button>
        }
      >
        <div className="space-y-2">
          {safety.map((row, i) => (
            <div key={i} className="p-2.5 space-y-1.5 border rounded-lg border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-1.5">
                <select
                  className={inputCls}
                  style={{ maxWidth: 150 }}
                  value={row.type}
                  onChange={(e) =>
                    setSafety((rows) => rows.map((r, idx) => (idx === i ? { ...r, type: e.target.value as SiteActivitySafetyType } : r)))
                  }
                >
                  <option value="observation">Observation</option>
                  <option value="incident">Incident</option>
                </select>
                <button
                  onClick={() => setSafety((rows) => rows.filter((_, idx) => idx !== i))}
                  className="flex-shrink-0 p-2 ml-auto text-slate-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <input
                className={inputCls}
                placeholder="Description"
                value={row.description}
                onChange={(e) => setSafety((rows) => rows.map((r, idx) => (idx === i ? { ...r, description: e.target.value } : r)))}
              />
              <input
                className={inputCls}
                placeholder="Action taken"
                value={row.actionTaken}
                onChange={(e) => setSafety((rows) => rows.map((r, idx) => (idx === i ? { ...r, actionTaken: e.target.value } : r)))}
              />
            </div>
          ))}
        </div>
      </DrawerSection>

      <DrawerSection
        title="Instructions"
        action={
          <button
            onClick={() => setInstructions((rows) => [...rows, emptyInstruction()])}
            className="flex items-center gap-1 text-[11.5px] font-medium text-blue-700 hover:underline"
          >
            <Plus size={12} /> Add Row
          </button>
        }
      >
        <div className="space-y-2">
          {instructions.map((row, i) => (
            <div key={i} className="p-2.5 space-y-1.5 border rounded-lg border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-1.5">
                <input
                  className={inputCls}
                  placeholder="Description"
                  value={row.description}
                  onChange={(e) =>
                    setInstructions((rows) => rows.map((r, idx) => (idx === i ? { ...r, description: e.target.value } : r)))
                  }
                />
                <button
                  onClick={() => setInstructions((rows) => rows.filter((_, idx) => idx !== i))}
                  className="flex-shrink-0 p-2 text-slate-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  className={inputCls}
                  placeholder="By whom"
                  value={row.byWhom}
                  onChange={(e) => setInstructions((rows) => rows.map((r, idx) => (idx === i ? { ...r, byWhom: e.target.value } : r)))}
                />
                <input
                  className={inputCls}
                  placeholder="To whom"
                  value={row.toWhom}
                  onChange={(e) => setInstructions((rows) => rows.map((r, idx) => (idx === i ? { ...r, toWhom: e.target.value } : r)))}
                />
                <input
                  className={inputCls}
                  placeholder="Time"
                  value={row.time}
                  onChange={(e) => setInstructions((rows) => rows.map((r, idx) => (idx === i ? { ...r, time: e.target.value } : r)))}
                />
              </div>
              <input
                className={inputCls}
                placeholder="Signature of"
                value={row.signatureOf}
                onChange={(e) => setInstructions((rows) => rows.map((r, idx) => (idx === i ? { ...r, signatureOf: e.target.value } : r)))}
              />
            </div>
          ))}
        </div>
      </DrawerSection>

      <div className="sticky bottom-0 p-4 space-y-2 bg-white border-t border-slate-200">
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center justify-center w-full gap-1.5 px-3 py-2.5 text-[13px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60"
        >
          {saveMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Save Report
        </button>
      </div>
    </Drawer>
  );
};

// ---- Weekly Summary — aggregates a project's daily reports over one
// Mon-Sun week, fetched in a single range request. ----

const WeeklySummary: React.FC<{ projectId: number; projectName?: string; weekStart: string; onWeekStart: (iso: string) => void }> = ({
  projectId,
  projectName,
  weekStart,
  onWeekStart,
}) => {
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDateIso(weekStart, i)), [weekStart]);
  const weekEnd = weekDays[6];
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[19px] font-bold text-slate-900">
            Weekly Summary — {projectName} <span className="text-[13px] font-normal text-slate-400">(read-only)</span>
          </h2>
          <p className="text-[12.5px] text-slate-500">
            {formatShortDateWithYear(weekStart)} – {formatShortDateWithYear(weekEnd)}
            {isCurrentWeek ? " (This Week)" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 px-1 py-1 border rounded-lg border-slate-200 bg-slate-50">
          <button onClick={() => onWeekStart(shiftDateIso(weekStart, -7))} className="p-1.5 rounded hover:bg-slate-200 text-slate-500">
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => onWeekStart(getWeekStart(todayIso()))}
            className="px-2 py-1 text-[11.5px] font-medium rounded text-slate-600 hover:bg-slate-200"
          >
            This Week
          </button>
          <button
            onClick={() => onWeekStart(shiftDateIso(weekStart, 7))}
            disabled={isCurrentWeek}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard accent="#64748b" label="Days Reported" value={`${totals.daysReported} / 7`} sub="Daily reports submitted" />
            <StatCard accent="#2563eb" label="Work Items Logged" value={`${totals.totalActivities}`} sub={`${totals.totalQtyCompleted} total qty completed`} />
            <StatCard accent="#059669" label="Manpower (person-days)" value={`${totals.totalManpowerDays}`} sub="Sum of daily headcounts" />
            <StatCard accent="#d97706" label="Equipment Hours" value={`${totals.totalEquipmentHours}`} sub="Sum of daily working hours" />
            <StatCard
              accent={totals.incidents.length > 0 ? "#dc2626" : "#64748b"}
              label="Safety Incidents"
              value={`${totals.incidents.length}`}
              sub={`${totals.observations.length} observations`}
            />
          </div>

          <Panel title="Daily Breakdown">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wide text-slate-500 bg-slate-50">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Activities</th>
                    <th className="px-3 py-2 font-medium">Manpower</th>
                    <th className="px-3 py-2 font-medium">Equipment Hrs</th>
                    <th className="px-3 py-2 font-medium">Incidents</th>
                  </tr>
                </thead>
                <tbody>
                  {weekDays.map((d) => {
                    const r = byDate.get(d);
                    return (
                      <tr key={d} className="border-t border-slate-100 text-[12.5px]">
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {WEEKDAY_LABEL(d)}, {formatShortDate(d)}
                        </td>
                        {r ? (
                          <>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                  r.status === "submitted" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {r.status === "submitted" ? "Submitted" : "Draft"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{r.activities.length}</td>
                            <td className="px-3 py-2 text-slate-600">{r.manpower.reduce((s, m) => s + m.headcount, 0)}</td>
                            <td className="px-3 py-2 text-slate-600">{r.equipment.reduce((s, e) => s + (e.workingHours ?? 0), 0)}</td>
                            <td className="px-3 py-2 text-slate-600">
                              {r.safety.filter((s) => s.type === "incident").length > 0 ? (
                                <span className="text-red-600 font-medium">{r.safety.filter((s) => s.type === "incident").length}</span>
                              ) : (
                                "0"
                              )}
                            </td>
                          </>
                        ) : (
                          <td colSpan={5} className="px-3 py-2 text-slate-300">
                            No report
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Materials — Weekly Totals">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-wide text-slate-500 bg-slate-50">
                      <th className="px-3 py-2 font-medium">Material Type</th>
                      <th className="px-3 py-2 font-medium">Received</th>
                      <th className="px-3 py-2 font-medium">Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialTotals.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-[12px] text-slate-400">
                          No materials recorded this week.
                        </td>
                      </tr>
                    ) : (
                      materialTotals.map((m) => (
                        <tr key={m.materialType} className="border-t border-slate-100 text-[12.5px]">
                          <td className="flex items-center gap-1.5 px-3 py-2 font-medium text-slate-800">
                            <Package size={12} className="text-slate-400" /> {m.materialType}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {m.receivedQuantity} {m.receivedUnit}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {m.usedQuantity} {m.usedUnit}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Safety — This Week">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-wide text-slate-500 bg-slate-50">
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...totals.incidents, ...totals.observations].length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-[12px] text-slate-400">
                          No safety entries this week.
                        </td>
                      </tr>
                    ) : (
                      [...totals.incidents, ...totals.observations]
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((s) => (
                          <tr key={s.id} className="border-t border-slate-100 text-[12.5px]">
                            <td className="px-3 py-2 text-slate-600">{formatShortDate(s.date)}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                  s.type === "incident" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <ShieldAlert size={10} className="inline mr-1 -mt-0.5" />
                                {SAFETY_TYPE_LABEL[s.type]}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-700">{s.description || "—"}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
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
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [quickAdd, setQuickAdd] = useState<null | "activity" | "equipment" | "manpower" | "material" | "safety" | "instruction">(null);

  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const { data: report, isLoading } = useSiteActivityReport(projectId || null, date);
  const deleteMutation = useDeleteSiteActivityReport(projectId || null, date);

  const project = projects.find((p) => p.id === projectId);

  const stats = useMemo(() => {
    if (!report) return null;
    const activeItems = report.activities.filter((a) => a.status === "ongoing").length;
    const completedTotal = report.activities.reduce((sum, a) => sum + (a.todayQty ?? 0), 0);
    const totalHeadcount = report.manpower.reduce((sum, m) => sum + m.headcount, 0);
    const manpowerSummary = report.manpower
      .filter((m) => m.headcount > 0)
      .map((m) => `${m.headcount} ${m.role}`)
      .join(", ");
    const workingCount = report.equipment.filter((e) => e.condition === "working").length;
    const idleCount = report.equipment.filter((e) => e.condition !== "working").length;
    return { activeItems, completedTotal, totalHeadcount, manpowerSummary, workingCount, idleCount };
  }, [report]);

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
    <div className="w-full min-h-full bg-slate-50/40">
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-white border-b border-slate-200">
        <span className="mr-1 text-[12.5px] font-medium text-slate-600 whitespace-nowrap">Project:</span>
        <select
          value={projectId}
          onChange={(e) => setProjectId(Number(e.target.value))}
          className={`${inputCls} bg-white`}
          style={{ width: 180 }}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-0.5 p-0.5 border rounded-lg border-slate-200 bg-slate-50">
          <button
            onClick={() => setViewMode("daily")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              viewMode === "daily" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <CalendarDays size={13} /> Daily
          </button>
          <button
            onClick={() => setViewMode("weekly")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              viewMode === "weekly" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <CalendarRange size={13} /> Weekly
          </button>
        </div>

        {viewMode === "daily" && (
          <>
            <div className="flex items-center gap-1 px-1 py-1 border rounded-lg border-slate-200 bg-slate-50">
              <button onClick={() => setDate((d) => shiftDateIso(d, -1))} className="p-1.5 rounded hover:bg-slate-200 text-slate-500">
                <ChevronLeft size={15} />
              </button>
              <span className="px-1.5 text-[12.5px] font-medium text-slate-700 whitespace-nowrap">{formatDateLabel(date)}</span>
              <button
                onClick={() => setDate((d) => shiftDateIso(d, 1))}
                disabled={date >= todayIso()}
                className="p-1.5 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            <span className="flex items-center gap-1 px-3 py-1.5 text-[12px] text-slate-500 border rounded-lg border-slate-200 bg-slate-50">
              <MapPin size={12} /> {report?.location || "No location set"}
            </span>
          </>
        )}

        <div className="flex-1" />

        {viewMode === "daily" && (
          <>
            {report && isAdmin && (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Delete this report"
                className="p-2 text-slate-400 rounded-lg hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800"
            >
              <Plus size={14} />
              {report ? "Edit DPR" : "New DPR"}
            </button>
          </>
        )}
      </div>

      {viewMode === "weekly" ? (
        projectId && <WeeklySummary projectId={projectId} projectName={project?.name} weekStart={weekStart} onWeekStart={setWeekStart} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !report ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
            <ClipboardList className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-[13px] text-slate-400">No report for {formatDateLabel(date)} yet.</p>
          <button onClick={() => setFormOpen(true)} className="text-[12.5px] font-medium text-blue-700 hover:underline">
            Create the Daily Progress Report
          </button>
        </div>
      ) : (
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-[19px] font-bold text-slate-900">Site Report — {project?.name}</h2>
            <p className="text-[12.5px] text-slate-500">
              Prepared by: {report.createdBy?.name ?? "—"} • Status: {report.status === "submitted" ? "Submitted" : "Draft"} • Last
              updated {formatDateTime(report.updatedAt)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              accent="#2563eb"
              label="Total Work Items"
              value={`${stats?.activeItems ?? 0} Active`}
              sub={`${stats?.completedTotal ?? 0} Nos completed today`}
            />
            <StatCard
              accent="#059669"
              label="Site Manpower"
              value={`${stats?.totalHeadcount ?? 0} Personnel`}
              sub={stats?.manpowerSummary || "No manpower recorded"}
            />
            <StatCard
              accent="#d97706"
              label="Equipment Deployed"
              value={`${report.equipment.length} Units`}
              sub={`${stats?.workingCount ?? 0} Working, ${stats?.idleCount ?? 0} Idle`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              title="1. Work Activities Progress"
              badge={`${report.activities.length} Items Recorded`}
              onAdd={() => setQuickAdd("activity")}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-wide text-slate-500 bg-slate-50">
                      <th className="px-3 py-2 font-medium">S.N.</th>
                      <th className="px-3 py-2 font-medium">Work Description</th>
                      <th className="px-3 py-2 font-medium">Chainage</th>
                      <th className="px-3 py-2 font-medium">Today Qty</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.activities.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-[12px] text-slate-400">
                          No work activities recorded.
                        </td>
                      </tr>
                    ) : (
                      report.activities.map((a, i) => (
                        <tr key={a.id} className="border-t border-slate-100 text-[12.5px]">
                          <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">{a.description}</td>
                          <td className="px-3 py-2 text-slate-500">{a.chainage || "—"}</td>
                          <td className="px-3 py-2 font-semibold text-slate-800">
                            {a.todayQty ?? "—"} {a.unit}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_BADGE_CLS[a.status]}`}>
                              {a.status === "ongoing" ? "Ongoing" : "Completed"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-500">{a.remarks || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="3. Manpower Breakdown" onAdd={() => setQuickAdd("manpower")}>
              <div className="p-4 space-y-2">
                {report.manpower.length === 0 ? (
                  <p className="text-[12px] text-slate-400">No manpower recorded.</p>
                ) : (
                  <>
                    {report.manpower.map((m) => (
                      <div key={m.id} className="flex items-center justify-between px-3 py-2 border rounded-lg border-slate-100 bg-slate-50/50">
                        <span className="flex items-center gap-2 text-[12.5px] text-slate-700">
                          <Users size={13} className="text-slate-400" /> {m.role}
                        </span>
                        <span className="text-[13px] font-semibold text-slate-900">
                          {m.headcount} {m.headcount === 1 ? "Person" : "Persons"}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-3 py-2 border rounded-lg border-blue-200 bg-blue-50/60">
                      <span className="text-[12.5px] font-medium text-blue-900">Total Headcount On-Site</span>
                      <span className="text-[13px] font-bold text-blue-900">{stats?.totalHeadcount ?? 0} Total</span>
                    </div>
                  </>
                )}
              </div>
            </Panel>

            <Panel title="2. Equipment & Machinery Log" onAdd={() => setQuickAdd("equipment")}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-wide text-slate-500 bg-slate-50">
                      <th className="px-3 py-2 font-medium">Equipment / Plant</th>
                      <th className="px-3 py-2 font-medium">Quantity</th>
                      <th className="px-3 py-2 font-medium">Working Hours</th>
                      <th className="px-3 py-2 font-medium">Condition</th>
                      <th className="px-3 py-2 font-medium">Status Bar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.equipment.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-[12px] text-slate-400">
                          No equipment recorded.
                        </td>
                      </tr>
                    ) : (
                      report.equipment.map((e) => (
                        <tr key={e.id} className="border-t border-slate-100 text-[12.5px]">
                          <td className="flex items-center gap-1.5 px-3 py-2 font-medium text-slate-800">
                            <Wrench size={12} className="text-slate-400" /> {e.equipmentName}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{e.quantity} Unit{e.quantity === 1 ? "" : "s"}</td>
                          <td className="px-3 py-2 font-semibold text-slate-800">{e.workingHours ?? 0} Hours</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${CONDITION_BADGE_CLS[e.condition]}`}>
                              {e.condition === "working" ? "Working" : e.condition === "idle" ? "Idle / Standby" : "Breakdown"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${CONDITION_BAR_CLS[e.condition]}`}
                                style={{ width: `${Math.min(100, ((e.workingHours ?? 0) / 10) * 100)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            {projectId && <PhotosPanel report={report} projectId={projectId} date={date} />}

            <Panel title="5. Weather Status">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-wide text-slate-500 bg-slate-50">
                      <th className="px-3 py-2 font-medium">Time of Day</th>
                      {WEATHER_SLOTS.map((slot) => (
                        <th key={slot} className="px-3 py-2 font-medium">
                          {WEATHER_SLOT_LABEL[slot]}
                        </th>
                      ))}
                      <th className="px-3 py-2 font-medium">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="text-[12.5px]">
                    <tr className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-600">Weather Status</td>
                      {WEATHER_SLOTS.map((slot) => (
                        <td key={slot} className="px-3 py-2 text-slate-800">
                          {report.weather.find((w) => w.slot === slot)?.condition || "—"}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-slate-500" rowSpan={3}>
                        {report.weather.map((w) => w.remarks).filter(Boolean).join(" · ") || "—"}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-600">Temperature (°C)</td>
                      {WEATHER_SLOTS.map((slot) => (
                        <td key={slot} className="px-3 py-2 text-slate-800">
                          {report.weather.find((w) => w.slot === slot)?.tempC ?? "—"}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-600">Rainfall Status</td>
                      {WEATHER_SLOTS.map((slot) => {
                        const rainfall = report.weather.find((w) => w.slot === slot)?.rainfall;
                        return (
                          <td key={slot} className="px-3 py-2 text-slate-800">
                            {rainfall ? RAINFALL_LABEL[rainfall] : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="6. Materials" badge={`${report.materials.length} Items`} onAdd={() => setQuickAdd("material")}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-100/70">
                      <th className="px-3 py-1.5 font-medium" rowSpan={2}>
                        Material Type
                      </th>
                      <th className="px-3 py-1 font-medium text-center border-l border-slate-200" colSpan={2}>
                        Received
                      </th>
                      <th className="px-3 py-1 font-medium text-center border-l border-slate-200" colSpan={2}>
                        Used
                      </th>
                      <th className="px-3 py-1.5 font-medium border-l border-slate-200" rowSpan={2}>
                        Remarks
                      </th>
                    </tr>
                    <tr className="text-[10.5px] uppercase tracking-wide text-slate-500 bg-slate-50">
                      <th className="px-3 py-2 font-medium border-l border-slate-200">Quantity</th>
                      <th className="px-3 py-2 font-medium">Unit</th>
                      <th className="px-3 py-2 font-medium border-l border-slate-200">Quantity</th>
                      <th className="px-3 py-2 font-medium">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.materials.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-[12px] text-slate-400">
                          No materials recorded.
                        </td>
                      </tr>
                    ) : (
                      report.materials.map((m) => (
                        <tr key={m.id} className="border-t border-slate-100 text-[12.5px]">
                          <td className="flex items-center gap-1.5 px-3 py-2 font-medium text-slate-800">
                            <Package size={12} className="text-slate-400" /> {m.materialType}
                          </td>
                          <td className="px-3 py-2 text-slate-600 border-l border-slate-100">{m.receivedQuantity ?? "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{m.receivedUnit || "—"}</td>
                          <td className="px-3 py-2 text-slate-600 border-l border-slate-100">{m.usedQuantity ?? "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{m.usedUnit || "—"}</td>
                          <td className="px-3 py-2 text-slate-500 border-l border-slate-100">{m.remarks || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="7. Safety" onAdd={() => setQuickAdd("safety")}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-wide text-slate-500 bg-slate-50">
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium">Action Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.safety.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-[12px] text-slate-400">
                          No safety observations or incidents recorded.
                        </td>
                      </tr>
                    ) : (
                      report.safety.map((s) => (
                        <tr key={s.id} className="border-t border-slate-100 text-[12.5px]">
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                s.type === "incident" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              <ShieldAlert size={10} className="inline mr-1 -mt-0.5" />
                              {SAFETY_TYPE_LABEL[s.type]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700">{s.description || "—"}</td>
                          <td className="px-3 py-2 text-slate-500">{s.actionTaken || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="8. Instructions" onAdd={() => setQuickAdd("instruction")}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-wide text-slate-500 bg-slate-50">
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium">By Whom</th>
                      <th className="px-3 py-2 font-medium">To Whom</th>
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">Signature of</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.instructions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-[12px] text-slate-400">
                          No instructions recorded.
                        </td>
                      </tr>
                    ) : (
                      report.instructions.map((i) => (
                        <tr key={i.id} className="border-t border-slate-100 text-[12.5px]">
                          <td className="flex items-center gap-1.5 px-3 py-2 font-medium text-slate-800">
                            <MessageSquare size={12} className="text-slate-400" /> {i.description || "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{i.byWhom || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{i.toWhom || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{i.time || "—"}</td>
                          <td className="px-3 py-2 text-slate-500">{i.signatureOf || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      )}

      {projectId && (
        <SiteActivityFormDrawer open={formOpen} projectId={projectId} date={date} existing={report ?? null} onClose={() => setFormOpen(false)} />
      )}

      {report && projectId && quickAdd === "activity" && (
        <QuickAddActivity report={report} projectId={projectId} date={date} onClose={() => setQuickAdd(null)} />
      )}
      {report && projectId && quickAdd === "equipment" && (
        <QuickAddEquipment report={report} projectId={projectId} date={date} onClose={() => setQuickAdd(null)} />
      )}
      {report && projectId && quickAdd === "manpower" && (
        <QuickAddManpower report={report} projectId={projectId} date={date} onClose={() => setQuickAdd(null)} />
      )}
      {report && projectId && quickAdd === "material" && (
        <QuickAddMaterial report={report} projectId={projectId} date={date} onClose={() => setQuickAdd(null)} />
      )}
      {report && projectId && quickAdd === "safety" && (
        <QuickAddSafety report={report} projectId={projectId} date={date} onClose={() => setQuickAdd(null)} />
      )}
      {report && projectId && quickAdd === "instruction" && (
        <QuickAddInstruction report={report} projectId={projectId} date={date} onClose={() => setQuickAdd(null)} />
      )}

      <ConfirmationModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!report) return;
          await deleteMutation.mutateAsync(report.id);
          setConfirmDelete(false);
        }}
        title="Delete Report"
        message={`Delete the report for ${formatDateLabel(date)}? This can't be undone.`}
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default SiteActivities;
