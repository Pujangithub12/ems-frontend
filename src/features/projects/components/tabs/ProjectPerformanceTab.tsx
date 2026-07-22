import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { useAuth } from "../../../../context/AuthProvider";
import { Project, MonthlyPerformance } from "../../../../types";
import { toNumber, formatCost } from "../../../procurement/api/procurement.api";
import {
  MONTH_NAMES,
  formatEnergy,
  MonthlyPerformanceInput,
} from "../../api/performance.api";
import {
  useMonthlyPerformanceQuery,
  useUpsertMonthlyPerformanceMutation,
} from "../../hooks/useMonthlyPerformance";
import { getErrorMessage } from "../../../../lib/errors";

interface ProjectPerformanceTabProps {
  project: Project;
}

const emptyForm = {
  contractEnergy: "",
  actualGeneration: "",
  incomeReceived: "",
  monthlyExpenditure: "",
  sparePartPurchase: "",
};

const ProjectPerformanceTab: React.FC<ProjectPerformanceTabProps> = ({ project }) => {
  const projectId = String(project.id);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [year, setYear] = useState(new Date().getFullYear());
  const rowsQuery = useMonthlyPerformanceQuery(projectId, year);
  const rows = rowsQuery.data ?? [];
  const loading = rowsQuery.isLoading;
  const error = rowsQuery.isError
    ? getErrorMessage(rowsQuery.error, "Failed to load energy performance data.")
    : null;

  const upsertMutation = useUpsertMonthlyPerformanceMutation();

  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  const openEditForm = (month: number) => {
    const existing = rowsByMonth.get(month);
    setEditingMonth(month);
    setForm({
      contractEnergy: existing?.contractEnergy != null ? String(toNumber(existing.contractEnergy)) : "",
      actualGeneration:
        existing?.actualGeneration != null ? String(toNumber(existing.actualGeneration)) : "",
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
        actualGeneration: toInput(form.actualGeneration),
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
    <div className="flex flex-col gap-4">
      {/* Toolbar: year switcher */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="flex items-center justify-center w-8 h-8 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
            title="Previous year"
          >
            <ChevronLeft size={14} />
          </button>
          <span
            className="w-16 text-center text-[13px] font-semibold text-slate-900"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {year}
          </span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="flex items-center justify-center w-8 h-8 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
            title="Next year"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Table */}
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
                const month = idx + 1;
                const row = rowsByMonth.get(month);
                return (
                  <tr key={month} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
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
                            onClick={() => openEditForm(month)}
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

      {/* Edit modal */}
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
              <div className="grid grid-cols-2 gap-3">
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
                    Actual generation (kWh)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.actualGeneration}
                    onChange={(e) => setForm({ ...form, actualGeneration: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
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
