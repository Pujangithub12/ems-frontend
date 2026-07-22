import React, { useMemo, useState } from "react";
import {
  Pencil,
  Loader2,
  X,
  FileSignature,
  Flag,
  Wallet,
  Receipt,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Project } from "../types";
import { flattenProjectTasks } from "./taskUtils";
import { useAuth } from "../context/AuthProvider";
import { useUpdateProject } from "../hooks/useProjects";
import { useProcurementItemsQuery } from "../hooks/useProcurement";
import { formatCost, toNumber } from "./procurementApi";
import { useMonthlyPerformanceQuery } from "../hooks/useMonthlyPerformance";
import { MONTH_NAMES, formatEnergy } from "./monthlyPerformanceApi";
import { getErrorMessage } from "../lib/errors";

interface ProjectOverviewTabProps {
  project: Project;
  /** Switches the parent ProjectDetails page to another tab — used by this
   * tab's "View all ..." / "Invite Member" links instead of duplicating
   * those flows here. */
  onNavigateTab?: (tab: string) => void;
}

/** Task-status buckets that make up the "Task Overview" donut — a status
 * (state) dataset, so it takes the app's existing status colors rather than
 * a generic categorical palette. Always rendered with a legend dot + label +
 * count, never color-alone. */
const DONUT_BUCKETS: { key: string; label: string; color: string; statuses: string[] }[] = [
  { key: "completed", label: "Completed", color: "#10b981", statuses: ["completed"] },
  { key: "in_progress", label: "In Progress", color: "#3b82f6", statuses: ["in_progress"] },
  { key: "to_do", label: "To Do", color: "#94a3b8", statuses: ["pending"] },
  { key: "blocked", label: "Blocked", color: "#f43f5e", statuses: ["on_hold"] },
];

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const dateInputValue = (value?: string | null) => (value ? value.slice(0, 10) : "");

/** Small local presentational card shell — every section in this tab shares
 * this same bordered-card language. */
const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = "",
  children,
}) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
    {children}
  </div>
);

const CardHeader: React.FC<{
  title: string;
  action?: { label: string; onClick: () => void };
}> = ({ title, action }) => (
  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
    <span className="font-semibold text-[14px] text-slate-900">{title}</span>
    {action && (
      <button
        onClick={action.onClick}
        className="text-[12px] font-medium text-blue-900 hover:underline whitespace-nowrap"
      >
        {action.label} &rarr;
      </button>
    )}
  </div>
);

/** Hand-rolled donut (no new chart dependency) — stroke-based ring segments
 * with a 2px surface gap between each, a hero total in the center, and a
 * native-tooltip on every segment. */
const TaskStatusDonut: React.FC<{
  counts: Record<string, number>;
  total: number;
}> = ({ counts, total }) => {
  const size = 168;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 0 ? 3 : 0;

  let offset = 0;
  const segments = DONUT_BUCKETS.map((bucket) => {
    const count = counts[bucket.key] || 0;
    const fraction = total > 0 ? count / total : 0;
    const length = Math.max(0, fraction * circumference - gap);
    const segment = { ...bucket, count, fraction, length, offset };
    offset += fraction * circumference;
    return segment;
  });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            segments
              .filter((s) => s.count > 0)
              .map((s) => (
                <circle
                  key={s.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${s.length} ${circumference - s.length}`}
                  strokeDashoffset={-s.offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  strokeLinecap="butt"
                >
                  <title>
                    {s.label}: {s.count} ({Math.round(s.fraction * 100)}%)
                  </title>
                </circle>
              ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold text-[32px] leading-none tracking-tight text-slate-900">
            {total}
          </span>
          <span className="text-[11px] text-slate-500 mt-1">Total Tasks</span>
        </div>
      </div>

      <div className="w-full space-y-2.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-[13px]">
            <span
              className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
              style={{ background: s.color }}
            />
            <span className="text-slate-600">{s.label}</span>
            <span className="ml-auto font-medium text-slate-900">
              {s.count} ({Math.round(s.fraction * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ProjectOverviewTab: React.FC<ProjectOverviewTabProps> = ({ project, onNavigateTab }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const allTasks = flattenProjectTasks(project);
  const total = project.tasksCount ?? allTasks.length;
  const projectManager = project.assignees?.[0];

  const donutCounts = DONUT_BUCKETS.reduce<Record<string, number>>((acc, bucket) => {
    acc[bucket.key] = allTasks.filter((t) => bucket.statuses.includes(t.status || "pending")).length;
    return acc;
  }, {});

  // Project Financials + Procurement Budget Usage (moved here from the Procurement tab)
  const procurementQuery = useProcurementItemsQuery(String(project.id));
  const procurementItems = procurementQuery.data ?? [];
  const totalSpend = useMemo(
    () => procurementItems.reduce((sum, it) => sum + toNumber(it.estimatedCost), 0),
    [procurementItems],
  );

  const updateProjectMutation = useUpdateProject();
  const [showFinancials, setShowFinancials] = useState(false);
  const [financialsForm, setFinancialsForm] = useState({
    contractDate: dateInputValue(project.contractDate),
    kickoffDate: dateInputValue(project.kickoffDate),
    estimatedTotalCost: project.estimatedTotalCost ?? "",
    sellingPrice: project.sellingPrice ?? "",
  });
  const [financialsSubmitting, setFinancialsSubmitting] = useState(false);
  const [financialsError, setFinancialsError] = useState<string | null>(null);

  const estimatedTotalCost = toNumber(project.estimatedTotalCost);
  const sellingPrice = toNumber(project.sellingPrice);
  const hasBudget = project.estimatedTotalCost !== null && project.estimatedTotalCost !== undefined;
  const hasFinancials =
    hasBudget || (project.sellingPrice !== null && project.sellingPrice !== undefined);
  const profitMargin = sellingPrice - estimatedTotalCost;
  const budgetPct = estimatedTotalCost > 0 ? Math.round((totalSpend / estimatedTotalCost) * 100) : 0;
  const budgetBarColor =
    budgetPct >= 100 ? "bg-red-600" : budgetPct >= 80 ? "bg-amber-500" : "bg-blue-900";

  // Energy Performance glimpse — most recent month (this calendar year) with any recorded data.
  const currentYear = new Date().getFullYear();
  const performanceQuery = useMonthlyPerformanceQuery(String(project.id), currentYear);
  const performanceRows = performanceQuery.data ?? [];
  const latestPerformanceRow = useMemo(() => {
    const withData = performanceRows.filter(
      (r) => r.contractEnergy != null || r.actualGeneration != null || r.incomeReceived != null,
    );
    if (withData.length === 0) return null;
    return withData.reduce((latest, r) => (r.month > latest.month ? r : latest));
  }, [performanceRows]);

  const openFinancialsForm = () => {
    setFinancialsForm({
      contractDate: dateInputValue(project.contractDate),
      kickoffDate: dateInputValue(project.kickoffDate),
      estimatedTotalCost: project.estimatedTotalCost ?? "",
      sellingPrice: project.sellingPrice ?? "",
    });
    setFinancialsError(null);
    setShowFinancials(true);
  };

  const handleSubmitFinancials = async (e: React.FormEvent) => {
    e.preventDefault();
    setFinancialsSubmitting(true);
    setFinancialsError(null);
    try {
      await updateProjectMutation.mutateAsync({
        id: project.id,
        payload: {
          contractDate: financialsForm.contractDate || null,
          kickoffDate: financialsForm.kickoffDate || null,
          estimatedTotalCost:
            financialsForm.estimatedTotalCost === "" ? null : Number(financialsForm.estimatedTotalCost),
          sellingPrice:
            financialsForm.sellingPrice === "" ? null : Number(financialsForm.sellingPrice),
        },
      });
      setShowFinancials(false);
    } catch (err) {
      setFinancialsError(getErrorMessage(err, "Failed to save project financials."));
    } finally {
      setFinancialsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Project Description */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-slate-400">
          Project Description
        </span>
        <p className="text-[13px] text-slate-600 leading-relaxed">
          {project.description || "No description provided."}
        </p>
      </div>

      {/* Project Summary — a single inline row, no card chrome */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-[13px] border-t border-slate-100">
        <div className="flex items-center flex-shrink-0 gap-2">
          <span className="text-slate-400">Manager</span>
          {projectManager ? (
            <span className="flex items-center gap-1.5 font-medium text-slate-900">
              <span className="flex items-center justify-center flex-shrink-0 w-5 h-5 text-[9px] font-semibold text-white rounded-full bg-blue-900">
                {initials(projectManager.fullName)}
              </span>
              {projectManager.fullName}
            </span>
          ) : (
            <span className="text-slate-400">Unassigned</span>
          )}
        </div>
        <div className="flex items-center flex-shrink-0 gap-2 pl-6 border-l border-slate-200">
          <span className="text-slate-400">Started</span>
          <span className="font-medium text-slate-900">
            {project.createdAt ? formatDate(project.createdAt) : "—"}
          </span>
        </div>
      </div>

      {/* Project Financials */}
      <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-slate-400">
            Project Financials
          </span>
          {isAdmin && (
            <button
              onClick={openFinancialsForm}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Pencil size={12} /> Edit Financials
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="p-3 bg-white border rounded-lg border-slate-200">
            <div className="flex items-start justify-between">
              <span className="text-[12px] font-medium text-slate-500">Contract Date</span>
              <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg bg-slate-100">
                <FileSignature className="w-4 h-4 text-slate-600" />
              </div>
            </div>
            <div className="mt-2 text-[16px] font-bold leading-none tracking-tight text-slate-900">
              {project.contractDate ? formatDate(project.contractDate) : "Not set"}
            </div>
          </div>

          <div className="p-3 bg-white border rounded-lg border-slate-200">
            <div className="flex items-start justify-between">
              <span className="text-[12px] font-medium text-slate-500">Project Kickoff</span>
              <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg bg-blue-50">
                <Flag className="w-4 h-4 text-blue-900" />
              </div>
            </div>
            <div className="mt-2 text-[16px] font-bold leading-none tracking-tight text-slate-900">
              {project.kickoffDate ? formatDate(project.kickoffDate) : "Not set"}
            </div>
          </div>

          <div className="p-3 bg-white border rounded-lg border-slate-200">
            <div className="flex items-start justify-between">
              <span className="text-[12px] font-medium text-slate-500">Est. Total Project Cost</span>
              <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg bg-orange-50">
                <Wallet className="w-4 h-4 text-orange-700" />
              </div>
            </div>
            <div className="mt-2 text-[16px] font-bold leading-none tracking-tight text-slate-900">
              {formatCost(project.estimatedTotalCost)}
            </div>
          </div>

          <div className="p-3 bg-white border rounded-lg border-slate-200">
            <div className="flex items-start justify-between">
              <span className="text-[12px] font-medium text-slate-500">Selling Price</span>
              <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg bg-emerald-50">
                <Receipt className="w-4 h-4 text-emerald-700" />
              </div>
            </div>
            <div className="mt-2 text-[16px] font-bold leading-none tracking-tight text-slate-900">
              {formatCost(project.sellingPrice)}
            </div>
          </div>
        </div>

        {/* Bonus KPI: computed profit margin */}
        {hasFinancials && (
          <div
            className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
              profitMargin >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {profitMargin >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-700" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-700" />
              )}
              <span
                className={`text-[12px] font-semibold uppercase tracking-[0.05em] ${
                  profitMargin >= 0 ? "text-emerald-800" : "text-red-800"
                }`}
              >
                Estimated Profit Margin
              </span>
            </div>
            <span
              className={`text-[16px] font-bold tracking-tight ${
                profitMargin >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {profitMargin >= 0 ? "+" : ""}
              {formatCost(profitMargin)}
            </span>
          </div>
        )}

        {/* Procurement Budget Usage */}
        <div className="p-4 bg-white border rounded-lg border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-slate-700">Procurement Budget Usage</span>
            <span className="text-[14px] font-bold text-slate-900">
              {formatCost(totalSpend)}
              {hasBudget && (
                <span className="font-medium text-slate-500"> of {formatCost(project.estimatedTotalCost)}</span>
              )}
            </span>
          </div>
          {hasBudget ? (
            <>
              <div className="w-full h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${budgetBarColor}`}
                  style={{ width: `${Math.min(budgetPct, 100)}%` }}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-slate-400">
                {budgetPct}% of estimated project cost committed to procurement items
                {budgetPct >= 100 ? " — over budget" : ""}
              </div>
            </>
          ) : (
            <p className="text-[12px] text-slate-400">
              Set an estimated total project cost in Project Financials to track budget usage.
            </p>
          )}
        </div>
      </div>

      {/* Team glimpse + Task Overview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader
            title="Team"
            action={{ label: "View team", onClick: () => onNavigateTab?.("team") }}
          />
          <div className="p-5">
            {project.assignees && project.assignees.length > 0 ? (
              <div className="space-y-3">
                {project.assignees.slice(0, 5).map((member) => (
                  <div key={member.id} className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center flex-shrink-0 w-7 h-7 text-[10px] font-semibold text-white rounded-full bg-blue-900">
                      {initials(member.fullName)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-slate-900 truncate">
                        {member.fullName}
                      </div>
                      {member.jobPosition && (
                        <div className="text-[11px] text-slate-500 truncate">
                          {member.jobPosition}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {project.assignees.length > 5 && (
                  <div className="pt-1 text-[12px] text-slate-400">
                    +{project.assignees.length - 5} more
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-slate-400">No team members assigned yet.</p>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Task Overview"
            action={{ label: "View all tasks", onClick: () => onNavigateTab?.("tasks") }}
          />
          <div className="p-5">
            <TaskStatusDonut counts={donutCounts} total={total} />
          </div>
        </Card>
      </div>

      {/* Energy Performance glimpse */}
      <Card>
        <CardHeader
          title="Energy Performance"
          action={{ label: "View details", onClick: () => onNavigateTab?.("performance") }}
        />
        <div className="p-5">
          {latestPerformanceRow ? (
            <>
              <div className="mb-3 text-[12px] text-slate-500">
                {MONTH_NAMES[latestPerformanceRow.month - 1]} {latestPerformanceRow.year}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[11px] text-slate-500">Contract Energy</div>
                  <div className="mt-1 text-[15px] font-semibold text-slate-900">
                    {formatEnergy(latestPerformanceRow.contractEnergy)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Actual Generation</div>
                  <div className="mt-1 text-[15px] font-semibold text-slate-900">
                    {formatEnergy(latestPerformanceRow.actualGeneration)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Income Received</div>
                  <div className="mt-1 text-[15px] font-semibold text-slate-900">
                    {formatCost(latestPerformanceRow.incomeReceived)}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[12px] text-slate-400">
              No energy performance data recorded yet for {currentYear}.
            </p>
          )}
        </div>
      </Card>

      {/* Edit financials modal */}
      {showFinancials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">Edit Project Financials</h3>
              <button
                onClick={() => setShowFinancials(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmitFinancials} className="p-4 space-y-3">
              {financialsError && (
                <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
                  {financialsError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">
                    Contract date
                  </label>
                  <input
                    type="date"
                    value={financialsForm.contractDate}
                    onChange={(e) =>
                      setFinancialsForm({ ...financialsForm, contractDate: e.target.value })
                    }
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">
                    Project kickoff
                  </label>
                  <input
                    type="date"
                    value={financialsForm.kickoffDate}
                    onChange={(e) =>
                      setFinancialsForm({ ...financialsForm, kickoffDate: e.target.value })
                    }
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">
                    Est. total project cost
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={financialsForm.estimatedTotalCost}
                    onChange={(e) =>
                      setFinancialsForm({ ...financialsForm, estimatedTotalCost: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">
                    Selling price
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={financialsForm.sellingPrice}
                    onChange={(e) =>
                      setFinancialsForm({ ...financialsForm, sellingPrice: e.target.value })
                    }
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFinancials(false)}
                  className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={financialsSubmitting}
                  className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
                >
                  {financialsSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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

export default ProjectOverviewTab;
