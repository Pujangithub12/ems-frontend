import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Factory,
  Users as UsersIcon,
  Loader2,
  Save,
  Table as TableIcon,
  Pencil,
  SlidersHorizontal,
  Plus,
  Trash2,
  X,
  Check,
  Upload,
  LineChart as LineChartIcon,
  ChevronDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
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

const CHART_COLORS = [
  "#2a78d6", 
  "#eb6834", 
  "#1baf7a", 
  "#eda100", 
  "#e87ba4", 
  "#008300", 
  "#4a3aa7", 
  "#e34948", 
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
  staffUserIds: number[];
  /** Keyed by custom field id (as a string) — booleans are stored as
   * "true"/"" so every custom value shares the same string-state shape as
   * the rest of this form. */
  customValues: Record<string, string>;
};

const emptyForm: FormState = {
  staffUserIds: [],
  customValues: {},
};

const reportToForm = (r: PlantDailyReport, fields: PlantReportCustomField[]): FormState => ({
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
          setLastReport(res.report);
          setForm(reportToForm(res.report, fields));
        } else {
          setExistingId(null);
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
  // (separate queries) — if they arrive after an existing report was
  // already loaded into the form, re-derive just the customValues slice so
  // it doesn't stay stuck blank. Doesn't touch the rest of the form, so it
  // never clobbers in-progress edits to the standard fields.
  useEffect(() => {
    if (!lastReport) return;
    const derived = reportToForm(lastReport, fields);
    setForm((prev) => ({
      ...prev,
      customValues: { ...derived.customValues, ...prev.customValues },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

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

    const payload: SavePlantReportPayload = {
      date,
      projectId,
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

          {fields.length > 0 ? (
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
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center border border-dashed rounded-xl border-slate-200">
              <p className="text-[13px] text-slate-400">
                No fields defined yet
                {isAdmin ? ' — add one via "Custom Fields" above.' : "."}
              </p>
            </div>
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
/** Multi-select dropdown for choosing */
const FieldMultiSelect: React.FC<{
  options: { id: number; name: string; color: string }[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}> = ({ options, selectedIds, onToggle }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const summary =
    selectedIds.length === 0
      ? "Select fields"
      : selectedIds.length === 1
        ? options.find((o) => o.id === selectedIds[0])?.name ?? "1 selected"
        : `${selectedIds.length} fields selected`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] font-medium border rounded-lg text-slate-600 border-slate-200 bg-white hover:bg-slate-50 transition-colors"
      >
        <span className="flex -space-x-1">
          {selectedIds.slice(0, 3).map((id) => {
            const opt = options.find((o) => o.id === id);
            if (!opt) return null;
            return (
              <span
                key={id}
                className="w-2.5 h-2.5 rounded-full ring-2 ring-white flex-shrink-0"
                style={{ backgroundColor: opt.color }}
              />
            );
          })}
        </span>
        {summary}
        <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-64 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1.5">
          {options.map((opt) => {
            const active = selectedIds.includes(opt.id);
            return (
              <label
                key={opt.id}
                className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-[13px] text-slate-700 hover:bg-slate-50"
              >
                <input type="checkbox" checked={active} onChange={() => onToggle(opt.id)} className="flex-shrink-0" />
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
                <span className="truncate">{opt.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** Multi-line chart  */
const PlantReportChart: React.FC<{
  reports: PlantDailyReport[];
  fields: PlantReportCustomField[];
}> = ({ reports, fields }) => {
  // Full numeric-field list — used only to derive each field's stable

  const allNumberFields = useMemo(() => fields.filter((f) => f.dataType === "number"), [fields]);

  const numberFields = useMemo(
    () =>
      allNumberFields.filter((f) =>
        reports.some((r) => typeof r.customValues?.[String(f.id)] === "number"),
      ),
    [allNumberFields, reports],
  );

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    if (selectedIds.length === 0 && numberFields.length > 0) {
      setSelectedIds(numberFields.slice(0, 3).map((f) => f.id));
    }
  }, [numberFields]);

  const toggleField = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const chartData = useMemo(
    () =>
      reports.map((r) => {
        const row: Record<string, string | number | null> = {
          date: new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        };
        for (const f of numberFields) {
          const v = r.customValues?.[String(f.id)];
          row[String(f.id)] = typeof v === "number" ? v : null;
        }
        return row;
      }),
    [reports, numberFields],
  );

  if (numberFields.length === 0) return null;

  const dropdownOptions = numberFields.map((f) => ({
    id: f.id,
    name: f.name,
    color: CHART_COLORS[allNumberFields.findIndex((nf) => nf.id === f.id) % CHART_COLORS.length],
  }));

  return (
    <div className="p-4 mb-4 bg-white border rounded-xl shadow-md border-slate-200">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
          <LineChartIcon size={13} /> Trend Chart
        </div>
        <FieldMultiSelect options={dropdownOptions} selectedIds={selectedIds} onToggle={toggleField} />
      </div>

      {selectedIds.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">
          Select a field above to plot it.
        </div>
      ) : (
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#e1e0d9" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#898781" }}
                axisLine={{ stroke: "#c3c2b7" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#898781" }}
                axisLine={{ stroke: "#c3c2b7" }}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e1e0d9" }}
                labelStyle={{ color: "#52514e", fontWeight: 600 }}
              />
              {selectedIds.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {numberFields
                .filter((f) => selectedIds.includes(f.id))
                .map((f) => {
                  const colorIndex = allNumberFields.findIndex((nf) => nf.id === f.id) % CHART_COLORS.length;
                  return (
                    <Line
                      key={f.id}
                      type="monotone"
                      dataKey={String(f.id)}
                      name={f.name}
                      stroke={CHART_COLORS[colorIndex]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  );
                })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
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

  // there's no fixed set of expected columns — any header whose text
  // matches a custom field's name (case-insensitive) is imported 
  
  const dim = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
  const dayDateStr = (day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const prefillMutation = usePlantReportPrefill();
  const createMutation = useCreatePlantReport();
  const updateMutation = useUpdatePlantReport();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (projectFilter === "all") {
      setImportStatus("Select a specific project before uploading.");
      return;
    }
    const projectId = projectFilter;
    setUploadModalOpen(false);
    setImporting(true);
    setImportStatus(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows2d: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

      const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

      const headerRowIdx = rows2d.findIndex((r) => r.some((c) => normalize(String(c)) === "day"));
      if (headerRowIdx === -1) {
        setImportStatus('Couldn\'t find a header row with a "Day" column.');
        return;
      }
      const header = rows2d[headerRowIdx].map((c) => String(c));

      // Match each header cell (left to right) against this org's custom
      // field names — a field can only be claimed by one column, so two
      // columns sharing the same header text (e.g. two "Average" columns)
      // land on two distinct fields sharing that name, in column order.
      let dayColIdx = -1;
      const usedFieldIds = new Set<number>();
      const colFieldMap: { colIdx: number; field: PlantReportCustomField }[] = [];
      const ignoredColumns: string[] = [];
      header.forEach((raw, idx) => {
        const h = normalize(raw);
        if (!h) return;
        if (h === "day" && dayColIdx === -1) {
          dayColIdx = idx;
          return;
        }
        const match = fields.find((f) => normalize(f.name) === h && !usedFieldIds.has(f.id));
        if (match) {
          usedFieldIds.add(match.id);
          colFieldMap.push({ colIdx: idx, field: match });
        } else {
          ignoredColumns.push(raw.replace(/\s+/g, " ").trim());
        }
      });

      if (dayColIdx === -1) {
        setImportStatus('Couldn\'t find a header row with a "Day" column.');
        return;
      }

      let imported = 0;
      let skipped = 0;
      for (let i = headerRowIdx + 1; i < rows2d.length; i++) {
        const r = rows2d[i];
        const dayRaw = r[dayColIdx];
        const day = typeof dayRaw === "number" ? dayRaw : parseInt(String(dayRaw), 10);
        if (!Number.isInteger(day) || day < 1 || day > dim) break; // stops at TOTAL row / end of data

        const newValues: Record<string, PlantReportCustomValue> = {};
        let matchedAny = false;
        for (const { colIdx, field } of colFieldMap) {
          const raw = r[colIdx];
          if (raw === "" || raw === undefined || raw === null) continue;
          matchedAny = true;
          newValues[String(field.id)] = field.dataType === "boolean" ? Boolean(raw) : (raw as PlantReportCustomValue);
        }
        if (!matchedAny) {
          skipped += 1;
          continue;
        }

        const date = dayDateStr(day);
        const prefill = await prefillMutation.mutateAsync({ date, projectId });
        if (prefill.exists) {
      
          const payload: SavePlantReportPayload = {
            date,
            projectId,
            staffUserIds: prefill.report.staff.map((s) => s.id),
            customValues: { ...prefill.report.customValues, ...newValues },
          };
          
          await updateMutation.mutateAsync({ id: prefill.report.id, payload });
        } else {
          const payload: SavePlantReportPayload = {
            date,
            projectId,
            staffUserIds: [],
            customValues: newValues,
          };
          
          await createMutation.mutateAsync(payload);
        }
        imported += 1;
      }

      let msg = `${imported} day${imported === 1 ? "" : "s"} imported${skipped ? `, ${skipped} skipped` : ""}.`;
      if (ignoredColumns.length > 0) {
        msg += ` ${ignoredColumns.length} column${ignoredColumns.length === 1 ? "" : "s"} ignored (no matching field): ${ignoredColumns.join(", ")}.`;
      }
      setImportStatus(msg);
    } catch (err) {
      setImportStatus(getErrorMessage(err, "Failed to import the file."));
    } finally {
      setImporting(false);
    }
  };

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
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileSelected}
        />
        <button
          onClick={() => setUploadModalOpen(true)}
          disabled={importing}
          title={projectFilter === "all" ? "Select a specific project before uploading" : undefined}
          className="flex items-center gap-1.5 px-3 py-2 ml-auto text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60"
        >
          {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Upload Sheet
        </button>
        <button
          onClick={onAddEntry}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 transition-colors"
        >
          <Plus size={14} /> Add Daily Entry
        </button>
      </div>

      {importStatus && (
        <div className="px-3 py-2 mb-4 text-[12px] text-slate-600 bg-slate-50 border border-slate-200 rounded">
          {importStatus}
        </div>
      )}

      {/* Upload Sheet modal — explains the expected column layout before the native file picker opens. */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">Upload Plant Report Sheet</h3>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3 text-[12px] text-slate-600">
              {projectFilter === "all" ? (
                <p className="text-red-600">Select a specific project (not "All Projects") before uploading.</p>
              ) : (
                <>
                  <p>
                    The file must have a header row with a <span className="font-medium text-slate-800">Day</span>{" "}
                    column (1, 2, 3…). No other column is required — any column whose header text matches one of
                    this organization's field names below (case-insensitive) will be imported under that field;
                    everything else is ignored:
                  </p>
                  {fields.length > 0 ? (
                    <ul className="pl-4 space-y-1 list-disc marker:text-slate-400">
                      {fields.map((f) => (
                        <li key={f.id}>{f.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="italic text-slate-400">
                      No custom fields defined yet — add some via "Custom Fields" first, then upload.
                    </p>
                  )}
                  <p>
                    Each row's <span className="font-medium text-slate-800">Day</span> is matched against{" "}
                    <span className="font-medium text-slate-800">{monthLabel}</span> — make sure that's the right
                    month before uploading. Existing days keep any values not covered by the sheet. A trailing{" "}
                    <span className="font-medium text-slate-800">Total</span> row (or anything after the daily rows)
                    is automatically ignored. Accepted formats: .xlsx, .xls, .csv.
                  </p>
                </>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={projectFilter === "all"}
                  className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-50"
                >
                  <Upload size={14} />
                  Choose File & Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          <PlantReportChart reports={data.reports} fields={fields} />

          <div className="overflow-x-auto bg-white border rounded-xl shadow-md border-slate-200">
            <table className="w-full text-[12px] whitespace-nowrap">
              <thead>
                <tr className="text-left border-b bg-slate-50/60 border-slate-200 text-slate-500">
                  <th className="px-3 py-2 font-medium">Date</th>
                  {projectFilter === "all" && <th className="px-3 py-2 font-medium">Project</th>}
                  <th className="px-3 py-2 font-medium">Staff</th>
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
                    <td className="px-3 py-2 text-slate-600">{r.staffCount}</td>
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