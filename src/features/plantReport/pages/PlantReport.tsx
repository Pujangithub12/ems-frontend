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
  CalendarDays,
  Table as TableIcon,
  Pencil,
  Layers,
} from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { useUsers } from "../../users/hooks/useUsers";
import { useProjects } from "../../projects/hooks/useProjects";
import { getErrorMessage } from "../../../lib/errors";
import ErrorBanner from "../../../components/ErrorBanner";
import {
  usePlantReportsForMonth,
  usePlantReportPrefill,
  useCreatePlantReport,
  useUpdatePlantReport,
} from "../hooks/usePlantReport";
import type { PlantDailyReport, SavePlantReportPayload } from "../api/plantReport.api";

const todayStr = () => new Date().toISOString().slice(0, 10);

const num = (v: string) => (v.trim() === "" ? null : Number(v));

const BURNER_STATUSES: { value: "running" | "stopped" | "maintenance"; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "stopped", label: "Stopped" },
  { value: "maintenance", label: "Maintenance" },
];

const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`text-[10px] tracking-[0.1em] uppercase text-slate-400 font-semibold flex items-center gap-1.5 ${className}`}
    style={{ fontFamily: "'JetBrains Mono', monospace" }}
  >
    {children}
  </div>
);

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
  "w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors";
const readOnlyCls =
  "w-full px-3 py-2 text-[13px] bg-slate-50 border border-slate-200 rounded text-slate-500";

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
};

const reportToForm = (r: PlantDailyReport): FormState => ({
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
});

const DailyEntryTab: React.FC = () => {
  const { user } = useAuth();
  const { data: users = [] } = useUsers();
  const { data: projects = [] } = useProjects();
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

  // Default to the first project once the list loads, so a single-project
  // organization never has to think about the picker.
  useEffect(() => {
    if (projectId === "" && projects.length > 0) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

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
          setForm(reportToForm(res.report));
        } else {
          setExistingId(null);
          setOpeningBalance(res.openingBalance);
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
    };

    try {
      if (existingId) {
        const updated = await updateMutation.mutateAsync({ id: existingId, payload });
        setForm(reportToForm(updated));
        setSuccess("Report updated.");
      } else {
        const created = await createMutation.mutateAsync(payload);
        setExistingId(created.id);
        setForm(reportToForm(created));
        setSuccess("Report saved.");
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save report."));
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="px-6 py-5">
      <div className="flex items-end justify-between mb-4">
        <div className="flex items-end gap-3">
          <div>
            <label className="text-[11px] font-medium text-slate-500">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
              className={`${inputCls} mt-1 w-56`}
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
            <label className="text-[11px] font-medium text-slate-500">Date</label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputCls} mt-1 w-48`}
            />
          </div>
        </div>
        {existingId && (
          <span className="flex items-center gap-1.5 text-[12px] text-blue-900 font-medium">
            <Pencil size={12} /> Editing existing entry for this date
          </span>
        )}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />}
      {success && (
        <ErrorBanner variant="success" message={success} onDismiss={() => setSuccess(null)} className="mb-4" />
      )}

      {projectId === "" ? (
        <p className="py-16 text-center text-[13px] text-slate-400">
          {projects.length === 0
            ? "No projects found in this organization yet — create one first."
            : "Select a project to log or view its daily report."}
        </p>
      ) : loadingDate ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Steam */}
          <div className="p-4 bg-white border rounded-lg border-slate-200">
            <Eyebrow className="mb-3">
              <Gauge size={12} /> Steam
            </Eyebrow>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
          </div>

          {/* Pellet */}
          <div className="p-4 bg-white border rounded-lg border-slate-200">
            <Eyebrow className="mb-3">
              <Package size={12} /> Pellet
            </Eyebrow>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
          </div>

          {/* Water */}
          <div className="p-4 bg-white border rounded-lg border-slate-200">
            <Eyebrow className="mb-3">
              <Droplets size={12} /> Water
            </Eyebrow>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
          </div>

          {/* Burner */}
          <div className="p-4 bg-white border rounded-lg border-slate-200">
            <Eyebrow className="mb-3">
              <Flame size={12} /> Burner
            </Eyebrow>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
              <div className="p-3 mt-3 border rounded border-amber-200 bg-amber-50">
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-amber-800 mb-1.5">
                  <AlertTriangle size={13} /> Shutdown reason required
                </div>
                <input
                  className="w-full px-3 py-2 text-[13px] bg-white border rounded outline-none border-amber-300 focus:border-amber-500"
                  placeholder="Why was the plant down today?"
                  value={form.shutdownReason}
                  onChange={(e) => setForm((p) => ({ ...p, shutdownReason: e.target.value }))}
                />
              </div>
            )}
          </div>

          {/* Staff */}
          <div className="p-4 bg-white border rounded-lg border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <Eyebrow>
                <UsersIcon size={12} /> Staff present
              </Eyebrow>
              <span className="text-[11px] font-medium text-slate-500">
                {form.staffUserIds.length} selected
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 overflow-y-auto md:grid-cols-3 max-h-48">
              {users.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-[13px] text-slate-700 hover:bg-slate-50"
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
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {existingId ? "Update Report" : "Save Report"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MonthlyReportTab: React.FC = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [projectFilter, setProjectFilter] = useState<number | "all">("all");
  const { data: projects = [] } = useProjects();
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
      <div className="flex items-center gap-2 mb-4">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className={`${inputCls} w-40`}
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
          className={`${inputCls} w-28`}
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
          className={`${inputCls} w-48`}
        >
          <option value="all">All Projects (Total)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="ml-2 text-[13px] font-medium text-slate-500">{monthLabel}</span>
      </div>

      {isError && (
        <ErrorBanner message={getErrorMessage(error, "Failed to load report.")} className="mb-4" />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !data || data.reports.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-slate-400">
          No entries logged for {monthLabel} yet.
        </p>
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
              <div key={label as string} className="p-3 bg-white border rounded-lg border-slate-200">
                <div className="text-[11px] text-slate-500">{label}</div>
                <div className="text-[16px] font-semibold text-slate-900">{value}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto bg-white border rounded-lg border-slate-200">
            <table className="w-full text-[12px] whitespace-nowrap">
              <thead>
                <tr className="text-left border-b bg-slate-50 border-slate-200 text-slate-500">
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
  const [tab, setTab] = useState<"entry" | "report">("entry");

  return (
    <div className="flex flex-col min-h-0">

      <div className="flex items-center gap-1 px-6 mt-4 overflow-x-auto border-b border-slate-200 no-scrollbar">
        <button
          onClick={() => setTab("entry")}
          className={`relative flex items-center gap-2 whitespace-nowrap transition-colors ${
            tab === "entry" ? "text-slate-900 font-semibold" : "text-slate-500 hover:text-slate-700"
          }`}
          style={{ padding: "10px 14px", fontSize: 13 }}
        >
          <CalendarDays className="w-3.5 h-3.5" /> Daily Entry
          <span
            className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-slate-900 transition-opacity duration-150 ${
              tab === "entry" ? "opacity-100" : "opacity-0"
            }`}
          />
        </button>
        <button
          onClick={() => setTab("report")}
          className={`relative flex items-center gap-2 whitespace-nowrap transition-colors ${
            tab === "report" ? "text-slate-900 font-semibold" : "text-slate-500 hover:text-slate-700"
          }`}
          style={{ padding: "10px 14px", fontSize: 13 }}
        >
          <TableIcon className="w-3.5 h-3.5" /> Monthly Report
          <span
            className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-slate-900 transition-opacity duration-150 ${
              tab === "report" ? "opacity-100" : "opacity-0"
            }`}
          />
        </button>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {tab === "entry" ? <DailyEntryTab /> : <MonthlyReportTab />}
      </div>
    </div>
  );
};

export default PlantReport;
