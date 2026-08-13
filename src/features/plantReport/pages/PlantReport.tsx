import React, { useEffect, useMemo, useState } from "react";
import {
  Factory,
  Gauge,
  Droplets,
  Flame,
  Package,
  Users as UsersIcon,
  AlertTriangle,
  Loader2,
  Save,
  Table as TableIcon,
  Pencil,
  Layers,
  SlidersHorizontal,
  Plus,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { useUsers } from "../../users/hooks/useUsers";
import { useProjects } from "../../projects/hooks/useProjects";
import { getErrorMessage } from "../../../lib/errors";
import ErrorBanner from "../../../components/ErrorBanner";
import ConfirmationModal from "../../../components/ConfirmationModal";
import Drawer from "../../../components/Drawer";
import {
  usePlantReportsForMonth,
  usePlantReportPrefill,
  useCreatePlantReport,
  useUpdatePlantReport,
  usePlantReportFields,
  useCreatePlantReportField,
  useUpdatePlantReportField,
  useDeletePlantReportField,
} from "../hooks/usePlantReport";
import type {
  PlantDailyReport,
  SavePlantReportPayload,
  PlantReportCustomField,
  PlantReportFieldDataType,
  PlantReportCustomValue,
} from "../api/plantReport.api";

const todayStr = () => new Date().toISOString().slice(0, 10);

const num = (v: string) => (v.trim() === "" ? null : Number(v));

const BURNER_STATUSES: { value: "running" | "stopped" | "maintenance"; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "stopped", label: "Stopped" },
  { value: "maintenance", label: "Maintenance" },
];

const FIELD_DATA_TYPES: { value: PlantReportFieldDataType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes / No" },
];

const dataTypeLabel = (dataType: PlantReportFieldDataType) =>
  FIELD_DATA_TYPES.find((t) => t.value === dataType)?.label ?? dataType;

/** Renders a value from PlantDailyReport.customValues per its field's
 * dataType — used in the monthly table where there's no input to bind to. */
const formatCustomValue = (value: PlantReportCustomValue, dataType: PlantReportFieldDataType): string => {
  if (value == null || value === "") return "—";
  if (dataType === "boolean") return value ? "Yes" : "No";
  if (dataType === "date") {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime())
      ? String(value)
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return String(value);
};

const Field: React.FC<{
  label: string;
  suffix?: string;
  children: React.ReactNode;
}> = ({ label, suffix, children }) => (
  <div>
    <label className="text-[11px] font-medium text-slate-500">
      {label}
      {suffix && <span className="text-slate-400"> ({suffix})</span>}
    </label>
    <div className="mt-1">{children}</div>
  </div>
);

const inputCls =
  "w-full px-3 py-2 text-[13px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-400 transition-colors";
const readOnlyCls =
  "w-full px-3 py-2 text-[13px] bg-slate-50 border border-slate-200 rounded-lg text-slate-500";

const SectionCard: React.FC<{
  icon: React.ElementType;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon: Icon, title, right, children }) => (
  <div className="overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
    <div className="flex items-center justify-between gap-2.5 px-4 py-3 border-b border-slate-200 bg-slate-50/60">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg bg-slate-100 ring-1 ring-black/5">
          <Icon className="w-3.5 h-3.5 text-slate-600" />
        </div>
        <span className="text-[12px] font-semibold tracking-wide text-slate-700 uppercase">{title}</span>
      </div>
      {right}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

type FormState = {
  steamInitial: string;
  steamFinal: string;
  steamPressure: string;
  steamTemp: string;
  feedwaterTemp: string;
  pelletUsedKg: string;
  pelletsBag: string;
  pelletReceivedKg: string;
  waterInitial: string;
  waterFinal: string;
  burnerStatus: "running" | "stopped" | "maintenance" | "";
  burnerHours: string;
  shutdownReason: string;
  staffUserIds: number[];
  /** Keyed by custom field id (as a string) — booleans are stored as
   * "true"/"" so every custom value shares the same string-state shape as
   * the rest of this form. */
  customValues: Record<string, string>;
};

const emptyForm: FormState = {
  steamInitial: "",
  steamFinal: "",
  steamPressure: "",
  steamTemp: "",
  feedwaterTemp: "",
  pelletUsedKg: "",
  pelletsBag: "",
  pelletReceivedKg: "",
  waterInitial: "",
  waterFinal: "",
  burnerStatus: "",
  burnerHours: "",
  shutdownReason: "",
  staffUserIds: [],
  customValues: {},
};

const reportToForm = (r: PlantDailyReport, fields: PlantReportCustomField[]): FormState => ({
  steamInitial: r.steamInitial != null ? String(r.steamInitial) : "",
  steamFinal: r.steamFinal != null ? String(r.steamFinal) : "",
  steamPressure: r.steamPressure != null ? String(r.steamPressure) : "",
  steamTemp: r.steamTemp != null ? String(r.steamTemp) : "",
  feedwaterTemp: r.feedwaterTemp != null ? String(r.feedwaterTemp) : "",
  pelletUsedKg: r.pelletUsedKg != null ? String(r.pelletUsedKg) : "",
  pelletsBag: r.pelletsBag != null ? String(r.pelletsBag) : "",
  pelletReceivedKg: r.pelletReceivedKg != null ? String(r.pelletReceivedKg) : "",
  waterInitial: r.waterInitial != null ? String(r.waterInitial) : "",
  waterFinal: r.waterFinal != null ? String(r.waterFinal) : "",
  burnerStatus: r.burnerStatus ?? "",
  burnerHours: r.burnerHours != null ? String(r.burnerHours) : "",
  shutdownReason: r.shutdownReason ?? "",
  staffUserIds: r.staff.map((s) => s.id),
  customValues: Object.fromEntries(
    fields.map((f) => {
      const v = r.customValues?.[String(f.id)];
      return [String(f.id), v == null ? "" : f.dataType === "boolean" ? (v ? "true" : "") : String(v)];
    }),
  ),
});

/** Builds the customValues payload sent on save — passthrough values, since
 * the backend is the authority that re-validates/coerces each one against
 * the field's dataType anyway. */
const buildCustomValuesPayload = (
  fields: PlantReportCustomField[],
  formValues: Record<string, string>,
): Record<string, PlantReportCustomValue> =>
  Object.fromEntries(
    fields.map((f) => {
      const raw = formValues[String(f.id)] ?? "";
      if (raw === "") return [String(f.id), null];
      if (f.dataType === "boolean") return [String(f.id), raw === "true"];
      if (f.dataType === "number") {
        const n = Number(raw);
        return [String(f.id), Number.isFinite(n) ? n : null];
      }
      return [String(f.id), raw];
    }),
  );

/** A single row in the field list — click the name/type to edit them
 * in place, matching the rest of this form's inline-edit conventions. */
const CustomFieldRow: React.FC<{
  field: PlantReportCustomField;
  onDeleteRequest: (field: PlantReportCustomField) => void;
}> = ({ field, onDeleteRequest }) => {
  const updateMutation = useUpdatePlantReportField();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(field.name);
  const [dataType, setDataType] = useState<PlantReportFieldDataType>(field.dataType);
  const [rowError, setRowError] = useState<string | null>(null);

  const startEdit = () => {
    setName(field.name);
    setDataType(field.dataType);
    setRowError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!name.trim()) {
      setRowError("Name is required.");
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: field.id, payload: { name: name.trim(), dataType } });
      setEditing(false);
    } catch (err) {
      setRowError(getErrorMessage(err, "Failed to update field."));
    }
  };

  if (editing) {
    return (
      <div className="p-3 rounded-lg bg-slate-50">
        <div className="flex items-center gap-2">
          <input
            className={`${inputCls} flex-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <select
            className={inputCls}
            style={{ width: 130 }}
            value={dataType}
            onChange={(e) => setDataType(e.target.value as PlantReportFieldDataType)}
          >
            {FIELD_DATA_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            onClick={save}
            disabled={updateMutation.isPending}
            className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60"
          >
            {updateMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-slate-500 border rounded-lg border-slate-200 hover:bg-white"
          >
            <X size={14} />
          </button>
        </div>
        {rowError && <p className="mt-1.5 text-[11.5px] text-red-600">{rowError}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg hover:bg-slate-50">
      <button onClick={startEdit} className="flex items-center flex-1 min-w-0 gap-2 text-left">
        <span className="text-[13px] font-medium truncate text-slate-800">{field.name}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.05em] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">
          {dataTypeLabel(field.dataType)}
        </span>
      </button>
      <button
        onClick={startEdit}
        className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <Pencil size={13} />
      </button>
      <button
        onClick={() => onDeleteRequest(field)}
        className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
};

/** Admin-only modal for defining the org's extra Plant Report columns —
 * name + data type. Values themselves live per-report (see the "Custom
 * Fields" SectionCard in DailyEntryTab); this only manages the schema. */
const ManageCustomFieldsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data: fields = [] } = usePlantReportFields();
  const createMutation = useCreatePlantReportField();
  const deleteMutation = useDeletePlantReportField();

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<PlantReportFieldDataType>("text");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlantReportCustomField | null>(null);

  const handleAdd = async () => {
    setFormError(null);
    if (!newName.trim()) {
      setFormError("Enter a name for the field.");
      return;
    }
    try {
      await createMutation.mutateAsync({ name: newName.trim(), dataType: newType });
      setNewName("");
      setNewType("text");
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to create field."));
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteMutation.mutateAsync(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm">
        <div className="w-full max-w-lg overflow-hidden bg-white border rounded-xl shadow-2xl border-slate-200/70">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/60">
            <div>
              <div className="font-semibold text-[15px] text-slate-900">Custom Fields</div>
              <div className="text-[11.5px] text-slate-500 mt-0.5">
                Extra columns for the daily report form, shared across this organization
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-1 overflow-y-auto max-h-80">
            {fields.length === 0 ? (
              <p className="py-6 text-[13px] text-center text-slate-400">
                No custom fields yet — add one below.
              </p>
            ) : (
              fields.map((f) => (
                <CustomFieldRow key={f.id} field={f} onDeleteRequest={setPendingDelete} />
              ))
            )}
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <input
                className={`${inputCls} flex-1`}
                placeholder="Field name (e.g. Ash Removed)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <select
                className={inputCls}
                style={{ width: 130 }}
                value={newType}
                onChange={(e) => setNewType(e.target.value as PlantReportFieldDataType)}
              >
                {FIELD_DATA_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAdd}
                disabled={createMutation.isPending}
                className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60"
              >
                {createMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
              </button>
            </div>
            {formError && <p className="mt-1.5 text-[11.5px] text-red-600">{formError}</p>}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Custom Field"
        message={`Delete "${pendingDelete?.name}"? Existing values already logged for it will no longer be shown.`}
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
};

const DailyEntryDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const { data: users = [] } = useUsers();
  const { data: projects = [] } = useProjects();
  const { data: fields = [] } = usePlantReportFields();
  const prefillMutation = usePlantReportPrefill();
  const createMutation = useCreatePlantReport();
  const updateMutation = useUpdatePlantReport();

  const [date, setDate] = useState(todayStr());
  const [projectId, setProjectId] = useState<number | "">("");
  const [existingId, setExistingId] = useState<number | null>(null);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loadingDate, setLoadingDate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [manageFieldsOpen, setManageFieldsOpen] = useState(false);

  // Default to the first project once the list loads, so a single-project
  // organization never has to think about the picker.
  useEffect(() => {
    if (projectId === "" && projects.length > 0) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  const [lastReport, setLastReport] = useState<PlantDailyReport | null>(null);

  useEffect(() => {
    if (projectId === "") return;
    let cancelled = false;
    // Reset synchronously — before the async fetch even starts — so a save
    // that somehow fires before the fetch resolves can never reuse the
    // previous project/date's existingId (which would silently update that
    // other report instead of creating this one). Worst case with this in
    // place is a rejected duplicate-date 409, never a cross-project overwrite.
    setExistingId(null);
    setOpeningBalance(0);
    setLastReport(null);
    setForm(emptyForm);
    setLoadingDate(true);
    setError(null);
    setSuccess(null);
    prefillMutation
      .mutateAsync({ date, projectId })
      .then((res) => {
        if (cancelled) return;
        if (res.exists) {
          setExistingId(res.report.id);
          setOpeningBalance(res.report.pelletStockOpening);
          setLastReport(res.report);
          setForm(reportToForm(res.report, fields));
        } else {
          setExistingId(null);
          setOpeningBalance(res.openingBalance);
          setLastReport(null);
          setForm(emptyForm);
        }
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err, "Failed to load this date.")))
      .finally(() => !cancelled && setLoadingDate(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, projectId]);

  // Custom field definitions load independently of the prefill fetch above
  // (a separate query) — if they arrive after an existing report was already
  // loaded into the form, re-derive just the customValues slice so those
  // columns aren't stuck blank. Doesn't touch the rest of the form, so it
  // never clobbers in-progress edits to the standard fields.
  useEffect(() => {
    if (!lastReport) return;
    const customValues = reportToForm(lastReport, fields).customValues;
    setForm((prev) => ({ ...prev, customValues: { ...customValues, ...prev.customValues } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const steamTon = useMemo(() => {
    const i = num(form.steamInitial);
    const f = num(form.steamFinal);
    return i != null && f != null ? f - i : null;
  }, [form.steamInitial, form.steamFinal]);

  const waterFlow = useMemo(() => {
    const i = num(form.waterInitial);
    const f = num(form.waterFinal);
    return i != null && f != null ? f - i : null;
  }, [form.waterInitial, form.waterFinal]);

  const pelletStockClosing = useMemo(() => {
    const received = num(form.pelletReceivedKg) ?? 0;
    const used = num(form.pelletUsedKg) ?? 0;
    return openingBalance + received - used;
  }, [openingBalance, form.pelletReceivedKg, form.pelletUsedKg]);

  const shutdownRequired = steamTon === 0 || form.burnerStatus === "stopped";

  const toggleStaff = (id: number) => {
    setForm((prev) => ({
      ...prev,
      staffUserIds: prev.staffUserIds.includes(id)
        ? prev.staffUserIds.filter((x) => x !== id)
        : [...prev.staffUserIds, id],
    }));
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (projectId === "") {
      setError("Select a project before saving.");
      return;
    }
    if (form.steamInitial && form.steamFinal && Number(form.steamFinal) < Number(form.steamInitial)) {
      setError("Steam final reading cannot be less than the initial reading.");
      return;
    }
    if (form.waterInitial && form.waterFinal && Number(form.waterFinal) < Number(form.waterInitial)) {
      setError("Water final reading cannot be less than the initial reading.");
      return;
    }
    if (shutdownRequired && !form.shutdownReason.trim()) {
      setError("A shutdown reason is required when steam ton is 0 or the burner is stopped.");
      return;
    }

    const payload: SavePlantReportPayload = {
      date,
      projectId,
      steamInitial: num(form.steamInitial),
      steamFinal: num(form.steamFinal),
      steamPressure: num(form.steamPressure),
      steamTemp: num(form.steamTemp),
      feedwaterTemp: num(form.feedwaterTemp),
      pelletUsedKg: num(form.pelletUsedKg),
      pelletsBag: num(form.pelletsBag),
      pelletReceivedKg: num(form.pelletReceivedKg),
      waterInitial: num(form.waterInitial),
      waterFinal: num(form.waterFinal),
      burnerStatus: form.burnerStatus || null,
      burnerHours: num(form.burnerHours),
      shutdownReason: form.shutdownReason.trim() || null,
      staffUserIds: form.staffUserIds,
      customValues: buildCustomValuesPayload(fields, form.customValues),
    };

    try {
      if (existingId) {
        const updated = await updateMutation.mutateAsync({ id: existingId, payload });
        setLastReport(updated);
        setForm(reportToForm(updated, fields));
        setSuccess("Report updated.");
      } else {
        const created = await createMutation.mutateAsync(payload);
        setExistingId(created.id);
        setLastReport(created);
        setForm(reportToForm(created, fields));
        setSuccess("Report saved.");
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save report."));
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add Daily Entry"
      subtitle="Log or edit a plant's daily report"
      width={640}
    >
    <div className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
              className={`${inputCls} mt-1`}
              style={{ width: 192 }}
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500">Date</label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputCls} mt-1`}
              style={{ width: 160 }}
            />
          </div>
          {isAdmin && (
            <button
              onClick={() => setManageFieldsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <SlidersHorizontal size={13} /> Custom Fields
            </button>
          )}
        </div>
        {existingId && (
          <span className="flex items-center gap-1.5 text-[12px] text-blue-900 font-medium">
            <Pencil size={12} /> Editing existing entry for this date
          </span>
        )}
      </div>

      {manageFieldsOpen && <ManageCustomFieldsModal onClose={() => setManageFieldsOpen(false)} />}

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />}
      {success && (
        <ErrorBanner variant="success" message={success} onDismiss={() => setSuccess(null)} className="mb-4" />
      )}

      {projectId === "" ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
            <Factory className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-[13px] text-slate-400">
            {projects.length === 0
              ? "No projects found in this organization yet — create one first."
              : "Select a project to log or view its daily report."}
          </p>
        </div>
      ) : loadingDate ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <SectionCard icon={Gauge} title="Steam">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Initial reading" suffix="ton">
                <input
                  type="number"
                  className={inputCls}
                  value={form.steamInitial}
                  onChange={(e) => setForm((p) => ({ ...p, steamInitial: e.target.value }))}
                />
              </Field>
              <Field label="Final reading" suffix="ton">
                <input
                  type="number"
                  className={inputCls}
                  value={form.steamFinal}
                  onChange={(e) => setForm((p) => ({ ...p, steamFinal: e.target.value }))}
                />
              </Field>
              <Field label="Per day steam" suffix="ton">
                <div className={readOnlyCls}>{steamTon ?? "—"}</div>
              </Field>
              <Field label="Pressure" suffix="bar">
                <input
                  type="number"
                  className={inputCls}
                  value={form.steamPressure}
                  onChange={(e) => setForm((p) => ({ ...p, steamPressure: e.target.value }))}
                />
              </Field>
              <Field label="Temperature" suffix="°C">
                <input
                  type="number"
                  className={inputCls}
                  value={form.steamTemp}
                  onChange={(e) => setForm((p) => ({ ...p, steamTemp: e.target.value }))}
                />
              </Field>
              <Field label="Feedwater temp" suffix="°C">
                <input
                  type="number"
                  className={inputCls}
                  value={form.feedwaterTemp}
                  onChange={(e) => setForm((p) => ({ ...p, feedwaterTemp: e.target.value }))}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard icon={Package} title="Pellet">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pellet used" suffix="kg">
                <input
                  type="number"
                  className={inputCls}
                  value={form.pelletUsedKg}
                  onChange={(e) => setForm((p) => ({ ...p, pelletUsedKg: e.target.value }))}
                />
              </Field>
              <Field label="Pallets" suffix="bag">
                <input
                  type="number"
                  className={inputCls}
                  value={form.pelletsBag}
                  onChange={(e) => setForm((p) => ({ ...p, pelletsBag: e.target.value }))}
                />
              </Field>
              <Field label="Received today" suffix="kg">
                <input
                  type="number"
                  className={inputCls}
                  value={form.pelletReceivedKg}
                  onChange={(e) => setForm((p) => ({ ...p, pelletReceivedKg: e.target.value }))}
                />
              </Field>
              <Field label="Opening balance" suffix="kg">
                <div className={readOnlyCls}>{openingBalance}</div>
              </Field>
              <Field label="Closing balance" suffix="kg">
                <div className={readOnlyCls}>{pelletStockClosing}</div>
              </Field>
            </div>
          </SectionCard>

          <SectionCard icon={Droplets} title="Water">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Meter initial">
                <input
                  type="number"
                  className={inputCls}
                  value={form.waterInitial}
                  onChange={(e) => setForm((p) => ({ ...p, waterInitial: e.target.value }))}
                />
              </Field>
              <Field label="Meter final">
                <input
                  type="number"
                  className={inputCls}
                  value={form.waterFinal}
                  onChange={(e) => setForm((p) => ({ ...p, waterFinal: e.target.value }))}
                />
              </Field>
              <Field label="Water flow">
                <div className={readOnlyCls}>{waterFlow ?? "—"}</div>
              </Field>
            </div>
          </SectionCard>

          <SectionCard icon={Flame} title="Burner">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select
                  className={inputCls}
                  value={form.burnerStatus}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, burnerStatus: e.target.value as FormState["burnerStatus"] }))
                  }
                >
                  <option value="">Select status</option>
                  {BURNER_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Hours run" suffix="hrs">
                <input
                  type="number"
                  className={inputCls}
                  value={form.burnerHours}
                  onChange={(e) => setForm((p) => ({ ...p, burnerHours: e.target.value }))}
                />
              </Field>
            </div>

            {shutdownRequired && (
              <div className="p-3 mt-3 border rounded-lg border-amber-200 bg-amber-50">
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-amber-800 mb-1.5">
                  <AlertTriangle size={13} /> Shutdown reason required
                </div>
                <input
                  className="w-full px-3 py-2 text-[13px] bg-white border rounded-lg outline-none border-amber-300 focus:border-amber-500"
                  placeholder="Why was the plant down today?"
                  value={form.shutdownReason}
                  onChange={(e) => setForm((p) => ({ ...p, shutdownReason: e.target.value }))}
                />
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={UsersIcon}
            title="Staff present"
            right={
              <span className="text-[11px] font-medium text-slate-500">
                {form.staffUserIds.length} selected
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-1 overflow-y-auto max-h-48">
              {users.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-[13px] text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={form.staffUserIds.includes(Number(u.id))}
                    onChange={() => toggleStaff(Number(u.id))}
                  />
                  {u.fullName}
                </label>
              ))}
              {users.length === 0 && (
                <p className="text-[12px] text-slate-400">No organization members found.</p>
              )}
            </div>
          </SectionCard>

          {fields.length > 0 && (
            <SectionCard icon={SlidersHorizontal} title="Custom Fields">
              <div className="grid grid-cols-2 gap-3">
                {fields.map((f) => {
                  const key = String(f.id);
                  const value = form.customValues[key] ?? "";
                  const setValue = (v: string) =>
                    setForm((p) => ({ ...p, customValues: { ...p.customValues, [key]: v } }));
                  return (
                    <Field key={f.id} label={f.name}>
                      {f.dataType === "boolean" ? (
                        <label className="flex items-center h-[38px] gap-2 px-3 text-[13px] text-slate-700 border rounded-lg cursor-pointer border-slate-200 bg-slate-50">
                          <input
                            type="checkbox"
                            checked={value === "true"}
                            onChange={(e) => setValue(e.target.checked ? "true" : "")}
                          />
                          Yes
                        </label>
                      ) : (
                        <input
                          type={f.dataType === "number" ? "number" : f.dataType === "date" ? "date" : "text"}
                          className={inputCls}
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                        />
                      )}
                    </Field>
                  );
                })}
              </div>
            </SectionCard>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {existingId ? "Update Report" : "Save Report"}
            </button>
          </div>
        </div>
      )}
    </div>
    </Drawer>
  );
};

const MonthlyReportTab: React.FC<{ onAddEntry: () => void }> = ({ onAddEntry }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [projectFilter, setProjectFilter] = useState<number | "all">("all");
  const { data: projects = [] } = useProjects();
  const { data: fields = [] } = usePlantReportFields();
  const { data, isLoading, isError, error } = usePlantReportsForMonth(
    year,
    month,
    projectFilter === "all" ? null : projectFilter,
  );

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const totalsLabel = projectFilter === "all" ? "All Projects" : "This Project";

  return (
    <div className="px-6 py-5">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className={inputCls}
          style={{ width: 160 }}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {new Date(2000, m - 1, 1).toLocaleDateString("en-US", { month: "long" })}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className={inputCls}
          style={{ width: 112 }}
        >
          {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          className={inputCls}
          style={{ width: 192 }}
        >
          <option value="all">All Projects (Total)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="ml-2 text-[13px] font-medium text-slate-500">{monthLabel}</span>
        <button
          onClick={onAddEntry}
          className="flex items-center gap-1.5 px-4 py-2 ml-auto text-[13px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 transition-colors"
        >
          <Plus size={14} /> Add Daily Entry
        </button>
      </div>

      {isError && (
        <ErrorBanner message={getErrorMessage(error, "Failed to load report.")} className="mb-4" />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !data || data.reports.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
            <TableIcon className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-[13px] text-slate-400">No entries logged for {monthLabel} yet.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 mb-2 text-[12px] font-semibold text-slate-500">
            <Layers size={13} /> {totalsLabel} Totals — {monthLabel}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4 lg:grid-cols-8">
            {[
              ["Days Logged", data.summary.daysLogged],
              ["Total Steam", data.summary.totalSteamTon != null ? `${data.summary.totalSteamTon} ton` : "—"],
              [
                "Avg Pressure",
                data.summary.avgSteamPressure != null ? data.summary.avgSteamPressure.toFixed(1) : "—",
              ],
              ["Avg Temp", data.summary.avgSteamTemp != null ? data.summary.avgSteamTemp.toFixed(1) : "—"],
              [
                "Pellet Used",
                data.summary.totalPelletUsedKg != null ? `${data.summary.totalPelletUsedKg} kg` : "—",
              ],
              [
                "Pellet Received",
                data.summary.totalPelletReceivedKg != null ? `${data.summary.totalPelletReceivedKg} kg` : "—",
              ],
              ["Burner Hours", data.summary.totalBurnerHours ?? "—"],
              ["Shutdown Days", data.summary.shutdownDays],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="p-3 transition-shadow bg-white border rounded-xl shadow-md border-slate-200 hover:shadow-lg"
              >
                <div className="text-[11px] text-slate-500">{label}</div>
                <div className="text-[16px] font-semibold text-slate-900">{value}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto bg-white border rounded-xl shadow-md border-slate-200">
            <table className="w-full text-[12px] whitespace-nowrap">
              <thead>
                <tr className="text-left border-b bg-slate-50/60 border-slate-200 text-slate-500">
                  <th className="px-3 py-2 font-medium">Date</th>
                  {projectFilter === "all" && <th className="px-3 py-2 font-medium">Project</th>}
                  <th className="px-3 py-2 font-medium">Steam Ton</th>
                  <th className="px-3 py-2 font-medium">Pressure</th>
                  <th className="px-3 py-2 font-medium">Temp</th>
                  <th className="px-3 py-2 font-medium">Feedwater</th>
                  <th className="px-3 py-2 font-medium">Pellet Used</th>
                  <th className="px-3 py-2 font-medium">Pellet Recv.</th>
                  <th className="px-3 py-2 font-medium">Stock Close</th>
                  <th className="px-3 py-2 font-medium">Water Flow</th>
                  <th className="px-3 py-2 font-medium">Burner</th>
                  <th className="px-3 py-2 font-medium">Staff</th>
                  <th className="px-3 py-2 font-medium">Shutdown Reason</th>
                  {fields.map((f) => (
                    <th key={f.id} className="px-3 py-2 font-medium">
                      {f.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.reports.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {new Date(r.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    {projectFilter === "all" && (
                      <td className="px-3 py-2 text-slate-600">{r.project?.name ?? "—"}</td>
                    )}
                    <td className="px-3 py-2 text-slate-600">{r.steamTon ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.steamPressure ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.steamTemp ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.feedwaterTemp ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.pelletUsedKg ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.pelletReceivedKg ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.pelletStockClosing}</td>
                    <td className="px-3 py-2 text-slate-600">{r.waterFlow ?? "—"}</td>
                    <td className="px-3 py-2 capitalize text-slate-600">{r.burnerStatus ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.staffCount}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.shutdownReason ? (
                        <span className="text-amber-700">{r.shutdownReason}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    {fields.map((f) => (
                      <td key={f.id} className="px-3 py-2 text-slate-600">
                        {formatCustomValue(r.customValues?.[String(f.id)] ?? null, f.dataType)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

const PlantReport: React.FC = () => {
  const [entryDrawerOpen, setEntryDrawerOpen] = useState(false);

  return (
    <div className="w-full min-h-full bg-white">
      <MonthlyReportTab onAddEntry={() => setEntryDrawerOpen(true)} />
      <DailyEntryDrawer open={entryDrawerOpen} onClose={() => setEntryDrawerOpen(false)} />
    </div>
  );
};

export default PlantReport;
