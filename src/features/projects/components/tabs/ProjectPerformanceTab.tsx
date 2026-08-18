import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Loader2,
  AlertCircle,
  X,
  Plus,
  Check,
} from "lucide-react";
import { useAuth } from "../../../../context/AuthProvider";
import { Project, MonthlyPerformance } from "../../../../types";
import { toNumber, formatCost } from "../../../../lib/currency";
import {
  MONTH_NAMES,
  formatEnergy,
  MonthlyPerformanceInput,
} from "../../api/performance.api";
import {
  useMonthlyPerformanceQuery,
  useUpsertMonthlyPerformanceMutation,
  useDailyGenerationQuery,
  useUpsertDailyGenerationMutation,
  useGenerationSummaryQuery,
} from "../../hooks/useMonthlyPerformance";
import { getErrorMessage } from "../../../../lib/errors";
import EnergyPerformanceChart, { EnergyChartPoint } from "../../../../components/charts/EnergyPerformanceChart";

interface ProjectPerformanceTabProps {
  project: Project;
}

const emptyForm = {
  contractEnergy: "",
  incomeReceived: "",
  monthlyExpenditure: "",
  sparePartPurchase: "",
};

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const ProjectPerformanceTab: React.FC<ProjectPerformanceTabProps> = ({ project }) => {
  const projectId = String(project.id);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [chartMode, setChartMode] = useState<"daily" | "monthly">("daily");

  const rowsQuery = useMonthlyPerformanceQuery(projectId, year);
  const rows = rowsQuery.data ?? [];
  const loading = rowsQuery.isLoading;
  const error = rowsQuery.isError
    ? getErrorMessage(rowsQuery.error, "Failed to load energy performance data.")
    : null;

  const upsertMutation = useUpsertMonthlyPerformanceMutation();

  const dailyQuery = useDailyGenerationQuery(projectId, year, month);
  const upsertDailyMutation = useUpsertDailyGenerationMutation();
  const summaryQuery = useGenerationSummaryQuery(projectId, year);

  const rowsByMonth = useMemo(() => {
    const map = new Map<number, MonthlyPerformance>();
    rows.forEach((r) => map.set(r.month, r));
    return map;
  }, [rows]);

  const totals = useMemo(() => {
    const sum = (key: keyof MonthlyPerformance) =>
      rows.reduce((acc, r) => acc + toNumber(r[key] as number | string | null), 0);
    return {
      contractEnergy: sum("contractEnergy"),
      actualGeneration: sum("actualGeneration"),
      incomeReceived: sum("incomeReceived"),
      monthlyExpenditure: sum("monthlyExpenditure"),
      sparePartPurchase: sum("sparePartPurchase"),
    };
  }, [rows]);

  // Only days that actually have a logged value are shown — entries are added
  // one at a time via the "Add Entry" form below, not a pre-filled full-month grid.
  const dailyEntries = useMemo(
    () =>
      (dailyQuery.data ?? [])
        .filter((d) => d.generation !== null && d.generation !== undefined)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [dailyQuery.data],
  );

  const dailyTotal = useMemo(
    () => dailyEntries.reduce((acc, d) => acc + toNumber(d.generation), 0),
    [dailyEntries],
  );

  const loggedDates = useMemo(() => new Set(dailyEntries.map((d) => d.date)), [dailyEntries]);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const toISODate = (y: number, m: number, day: number) => `${y}-${pad2(m)}-${pad2(day)}`;
  const firstOpenDate = useMemo(() => {
    const dim = daysInMonth(year, month);
    for (let day = 1; day <= dim; day++) {
      const iso = toISODate(year, month, day);
      if (!loggedDates.has(iso)) return iso;
    }
    return toISODate(year, month, 1);
  }, [year, month, loggedDates]);

  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [addValue, setAddValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const openAddForm = () => {
    setAddDate(firstOpenDate);
    setAddValue("");
    setAddError(null);
    setAddOpen(true);
  };

  const submitAdd = async () => {
    const generation = Number(addValue);
    if (!addDate || addValue === "" || Number.isNaN(generation)) {
      setAddError("Enter a date and a generation value.");
      return;
    }
    setAddError(null);
    await upsertDailyMutation.mutateAsync({ projectId, input: { date: addDate, generation } });
    setAddOpen(false);
  };

  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (date: string, current: number) => {
    setEditingDate(date);
    setEditValue(String(current));
  };

  const submitEdit = async () => {
    if (editingDate === null) return;
    const generation = editValue === "" ? null : Number(editValue);
    if (editValue !== "" && Number.isNaN(generation)) return;
    await upsertDailyMutation.mutateAsync({ projectId, input: { date: editingDate, generation } });
    setEditingDate(null);
  };

  const navigateMonth = (dir: -1 | 1) => {
    let m = month + dir;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const chartData: EnergyChartPoint[] = useMemo(() => {
    if (chartMode === "daily") {
      const contractEnergy = toNumber(rowsByMonth.get(month)?.contractEnergy ?? null);
      const dim = daysInMonth(year, month);
      const target = contractEnergy > 0 ? contractEnergy / dim : null;
      return (dailyQuery.data ?? []).map((d) => ({
        label: String(new Date(`${d.date}T00:00:00`).getDate()),
        value: d.generation != null ? toNumber(d.generation) : null,
        target,
      }));
    }
    return (summaryQuery.data ?? []).map((r) => ({
      label: MONTH_NAMES[r.month - 1].slice(0, 3),
      value: r.generation != null ? toNumber(r.generation) : null,
      target: r.contractEnergy != null ? toNumber(r.contractEnergy) : null,
    }));
  }, [chartMode, dailyQuery.data, summaryQuery.data, rowsByMonth, month, year]);

  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openEditForm = (m: number) => {
    const existing = rowsByMonth.get(m);
    setEditingMonth(m);
    setForm({
      contractEnergy: existing?.contractEnergy != null ? String(toNumber(existing.contractEnergy)) : "",
      incomeReceived:
        existing?.incomeReceived != null ? String(toNumber(existing.incomeReceived)) : "",
      monthlyExpenditure:
        existing?.monthlyExpenditure != null ? String(toNumber(existing.monthlyExpenditure)) : "",
      sparePartPurchase:
        existing?.sparePartPurchase != null ? String(toNumber(existing.sparePartPurchase)) : "",
    });
    setFormError(null);
  };

  const closeForm = () => {
    setEditingMonth(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const toInput = (value: string): number | null => (value === "" ? null : Number(value));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMonth === null) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const payload: MonthlyPerformanceInput = {
        year,
        month: editingMonth,
        contractEnergy: toInput(form.contractEnergy),
        incomeReceived: toInput(form.incomeReceived),
        monthlyExpenditure: toInput(form.monthlyExpenditure),
        sparePartPurchase: toInput(form.sparePartPurchase),
      };
      await upsertMutation.mutateAsync({ projectId, input: payload });
      await rowsQuery.refetch();
      closeForm();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save monthly performance."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading energy performance…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <AlertCircle className="w-6 h-6 text-red-600" />
        <p className="text-[13px] text-slate-600">{error}</p>
        <button
          onClick={() => rowsQuery.refetch()}
          className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded hover:bg-slate-50"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Trend chart */}
      <div className="p-4 bg-white border rounded-lg border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-slate-900">Generation Trend</h3>
          <div className="flex text-[11px] border rounded-lg border-slate-200 overflow-hidden">
            <button
              onClick={() => setChartMode("daily")}
              className={`px-3 py-1.5 font-medium ${chartMode === "daily" ? "bg-blue-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Daily
            </button>
            <button
              onClick={() => setChartMode("monthly")}
              className={`px-3 py-1.5 font-medium ${chartMode === "monthly" ? "bg-blue-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Monthly trend
            </button>
          </div>
        </div>
        <EnergyPerformanceChart
          data={chartData}
          navigatorLabel={chartMode === "daily" ? `${MONTH_NAMES[month - 1]} ${year}` : `${year}`}
          onNavigate={(dir) => (chartMode === "daily" ? navigateMonth(dir) : setYear((y) => y + dir))}
        />
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-slate-900">Daily Generation Entry</h3>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={openAddForm}
              className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800"
            >
              <Plus size={14} />
              Add Entry
            </button>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateMonth(-1)}
              className="flex items-center justify-center w-8 h-8 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
              title="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <span
              className="w-32 text-center text-[13px] font-semibold text-slate-900"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="flex items-center justify-center w-8 h-8 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
              title="Next month"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Add entry form */}
      {addOpen && (
        <div className="p-3 bg-white border rounded-lg border-slate-200">
          <div className="flex items-end gap-3">
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-500">Date</label>
              <input
                type="date"
                value={addDate}
                min={toISODate(year, month, 1)}
                max={toISODate(year, month, daysInMonth(year, month))}
                onChange={(e) => setAddDate(e.target.value)}
                className="px-2 py-1.5 text-[12px] border rounded outline-none border-slate-200 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-500">
                Generation (kWh)
              </label>
              <input
                autoFocus
                type="number"
                step="0.01"
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                placeholder="0"
                className="px-2 py-1.5 text-[12px] border rounded outline-none w-28 border-slate-200 focus:border-blue-400"
              />
            </div>
            <button
              onClick={submitAdd}
              disabled={upsertDailyMutation.isPending}
              className="px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
            >
              Save
            </button>
            <button
              onClick={() => setAddOpen(false)}
              className="px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
          {addError && <p className="mt-2 text-[11px] text-red-600">{addError}</p>}
        </div>
      )}

      {/* Daily entries — only days that have been logged; add more via "Add Entry" above. */}
      <div className="overflow-hidden bg-white border rounded-lg border-slate-200">
        {dailyQuery.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-4 h-4 text-blue-900 animate-spin" />
          </div>
        ) : dailyEntries.length === 0 ? (
          <p className="px-3 py-6 text-[12px] text-center text-slate-400">
            No daily entries logged for {MONTH_NAMES[month - 1]} {year} yet.
          </p>
        ) : (
          <div className="overflow-y-auto max-h-96">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium text-left">Date</th>
                  <th className="px-3 py-2 font-medium text-left">Generation (kWh)</th>
                  {isAdmin && <th className="px-3 py-2 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {dailyEntries.map((d) => {
                  const isEditing = editingDate === d.date;
                  return (
                    <tr key={d.date} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-600">
                        {new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-2 text-slate-800">
                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && submitEdit()}
                            className="px-2 py-1 text-[12px] border rounded outline-none w-28 border-slate-200 focus:border-blue-400"
                          />
                        ) : (
                          formatEnergy(d.generation)
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={submitEdit}
                                  className="flex items-center justify-center w-7 h-7 text-emerald-600 hover:bg-slate-100 rounded"
                                  title="Save"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingDate(null)}
                                  className="flex items-center justify-center w-7 h-7 text-slate-500 hover:bg-slate-100 rounded"
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => startEdit(d.date, toNumber(d.generation))}
                                className="flex items-center justify-center w-7 h-7 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded transition-colors"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2">{formatEnergy(dailyTotal)}</td>
                  {isAdmin && <td className="px-3 py-2" />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Financial fields table */}
      <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-lg border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                <th className="px-3 py-2 font-medium text-left">Month</th>
                <th className="px-3 py-2 font-medium text-left">Contract Energy</th>
                <th className="px-3 py-2 font-medium text-left">Actual Generation</th>
                <th className="px-3 py-2 font-medium text-left">Income Received</th>
                <th className="px-3 py-2 font-medium text-left">Monthly Expenditure</th>
                <th className="px-3 py-2 font-medium text-left">Spare Part Purchase</th>
                {isAdmin && <th className="px-3 py-2 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {MONTH_NAMES.map((name, idx) => {
                const m = idx + 1;
                const row = rowsByMonth.get(m);
                return (
                  <tr key={m} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{name}</td>
                    <td className="px-3 py-2 text-slate-600">{formatEnergy(row?.contractEnergy)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatEnergy(row?.actualGeneration)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatCost(row?.incomeReceived)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatCost(row?.monthlyExpenditure)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatCost(row?.sparePartPurchase)}</td>
                    {isAdmin && (
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => openEditForm(m)}
                            className="flex items-center justify-center w-7 h-7 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2">{formatEnergy(totals.contractEnergy)}</td>
                <td className="px-3 py-2">{formatEnergy(totals.actualGeneration)}</td>
                <td className="px-3 py-2">{formatCost(totals.incomeReceived)}</td>
                <td className="px-3 py-2">{formatCost(totals.monthlyExpenditure)}</td>
                <td className="px-3 py-2">{formatCost(totals.sparePartPurchase)}</td>
                {isAdmin && <td className="px-3 py-2" />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Edit modal (financial fields only — Actual Generation is derived from the daily grid above) */}
      {editingMonth !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">
                {MONTH_NAMES[editingMonth - 1]} {year}
              </h3>
              <button onClick={closeForm} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {formError && (
                <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
                  {formError}
                </div>
              )}
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-500">
                  Contract energy (kWh)
                </label>
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  value={form.contractEnergy}
                  onChange={(e) => setForm({ ...form, contractEnergy: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-500">
                  Income received
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.incomeReceived}
                  onChange={(e) => setForm({ ...form, incomeReceived: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">
                    Monthly expenditure
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.monthlyExpenditure}
                    onChange={(e) => setForm({ ...form, monthlyExpenditure: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">
                    Spare part purchase
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.sparePartPurchase}
                    onChange={(e) => setForm({ ...form, sparePartPurchase: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectPerformanceTab;
