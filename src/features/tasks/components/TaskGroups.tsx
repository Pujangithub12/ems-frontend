import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  CircleDashed,
  CheckCircle2,
  Clock,
  FolderKanban,
  Inbox,
  Layers,
  PauseCircle,
  Plus,
} from "lucide-react";
import type { Task } from "../api/tasks.api";

/** How a task list is split into sections. Tasks don't have to belong to a project, so project is just one option. */
export type GroupBy = "due" | "status" | "project" | "none";

export const GROUP_BY_LABEL: Record<GroupBy, string> = {
  due: "Due date",
  status: "Status",
  project: "Project",
  none: "None",
};

/** Remembers the chosen grouping per list in this browser; falls back to the default if storage is unavailable. */
export function useGroupBy(storageKey: string, fallback: GroupBy, allowed: GroupBy[]) {
  const [groupBy, setGroupByState] = useState<GroupBy>(() => {
    try {
      const saved = localStorage.getItem(storageKey) as GroupBy | null;
      if (saved && allowed.includes(saved)) return saved;
    } catch {
      /* storage blocked — use the default */
    }
    return fallback;
  });
  const setGroupBy = (next: GroupBy) => {
    setGroupByState(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* ignore */
    }
  };
  return [groupBy, setGroupBy] as const;
}

type Tone = "red" | "amber" | "blue" | "slate" | "emerald" | "orange" | "indigo";

export type TaskGroup = {
  key: string;
  label: string;
  /** Small line under the label, e.g. a date range. */
  hint?: string;
  tone: Tone;
  icon: React.ElementType;
  /** Set for project groups, so "Add task" can pre-select the project. */
  projectId: number | null;
  isProject: boolean;
  tasks: Task[];
};

const TONE: Record<Tone, { icon: string; chip: string; bar: string }> = {
  red: { icon: "bg-red-50 text-red-600 ring-red-100", chip: "bg-red-600 text-white", bar: "bg-red-500" },
  amber: { icon: "bg-amber-50 text-amber-600 ring-amber-100", chip: "bg-amber-500 text-white", bar: "bg-amber-500" },
  blue: { icon: "bg-blue-50 text-blue-800 ring-blue-100", chip: "bg-blue-900 text-white", bar: "bg-blue-800" },
  slate: { icon: "bg-slate-100 text-slate-600 ring-slate-200", chip: "bg-slate-700 text-white", bar: "bg-slate-400" },
  emerald: { icon: "bg-emerald-50 text-emerald-600 ring-emerald-100", chip: "bg-emerald-600 text-white", bar: "bg-emerald-500" },
  orange: { icon: "bg-orange-50 text-orange-600 ring-orange-100", chip: "bg-orange-500 text-white", bar: "bg-orange-500" },
  indigo: { icon: "bg-indigo-50 text-indigo-700 ring-indigo-100", chip: "bg-indigo-700 text-white", bar: "bg-indigo-600" },
};

const DAY = 86400000;
const startOfToday = () => new Date(new Date().toDateString()).getTime();
const dueTime = (t: Task) => {
  const ms = t.dueDate ? new Date(t.dueDate).setHours(0, 0, 0, 0) : NaN;
  return Number.isFinite(ms) ? ms : null;
};

const byDue = (desc: boolean) => (a: Task, b: Task) => {
  const da = dueTime(a);
  const db = dueTime(b);
  if (da == null && db == null) return a.title.localeCompare(b.title);
  if (da == null) return 1;
  if (db == null) return -1;
  return desc ? db - da : da - db;
};

const projectName = (t: Task) => t.project?.name || t.projectName || "";

/**
 * Splits a (already filtered) task list into sections. Every grouping sorts tasks by due date inside a section
 * (newest first when `newestFirst`, used by the Completed list).
 */
export function buildTaskGroups(tasks: Task[], groupBy: GroupBy, newestFirst = false): TaskGroup[] {
  const sort = byDue(newestFirst);
  const make = (g: Omit<TaskGroup, "tasks" | "projectId" | "isProject"> & Partial<TaskGroup>): TaskGroup => ({
    projectId: null,
    isProject: false,
    tasks: [],
    ...g,
  });

  if (groupBy === "none") {
    return [make({ key: "all", label: "All tasks", tone: "slate", icon: Layers, tasks: [...tasks].sort(sort) })];
  }

  if (groupBy === "due") {
    const today = startOfToday();
    const order = [
      make({ key: "overdue", label: "Overdue", tone: "red", icon: AlertTriangle }),
      make({ key: "today", label: "Due today", tone: "amber", icon: CalendarClock }),
      make({ key: "week", label: "Next 7 days", tone: "blue", icon: CalendarRange }),
      make({ key: "later", label: "Later", tone: "slate", icon: CalendarDays }),
      make({ key: "nodate", label: "No due date", tone: "slate", icon: Inbox }),
    ];
    const [overdue, todayG, week, later, nodate] = order;
    for (const t of tasks) {
      const d = dueTime(t);
      if (d == null) nodate.tasks.push(t);
      else if (t.status !== "completed" && d < today) overdue.tasks.push(t);
      else if (d === today) todayG.tasks.push(t);
      else if (d > today && d <= today + 7 * DAY) week.tasks.push(t);
      else later.tasks.push(t);
    }
    order.forEach((g) => g.tasks.sort(sort));
    return order.filter((g) => g.tasks.length > 0);
  }

  if (groupBy === "status") {
    const order = [
      make({ key: "in_progress", label: "In Progress", tone: "blue", icon: Clock }),
      make({ key: "to_do", label: "To Do", tone: "amber", icon: CircleDashed }),
      make({ key: "on_hold", label: "On Hold", tone: "orange", icon: PauseCircle }),
      make({ key: "completed", label: "Completed", tone: "emerald", icon: CheckCircle2 }),
    ];
    const byKey = new Map(order.map((g) => [g.key, g]));
    for (const t of tasks) {
      const k = t.status.toLowerCase().replace(/\s+/g, "_");
      (byKey.get(k) ?? byKey.get("to_do")!).tasks.push(t);
    }
    order.forEach((g) => g.tasks.sort(sort));
    return order.filter((g) => g.tasks.length > 0);
  }

  // project
  const map = new Map<string, TaskGroup>();
  for (const t of tasks) {
    const name = projectName(t);
    const projectId = t.project?.id ?? null;
    const key = projectId != null ? `p-${projectId}` : name ? `name-${name}` : "no-project";
    if (!map.has(key)) {
      map.set(
        key,
        make({
          key,
          label: name || "Not in a project",
          hint: name ? undefined : "General tasks",
          tone: name ? "indigo" : "slate",
          icon: name ? FolderKanban : Inbox,
          projectId,
          isProject: !!name,
        }),
      );
    }
    map.get(key)!.tasks.push(t);
  }
  const groups = Array.from(map.values()).sort((a, b) => {
    if (!a.isProject) return 1;
    if (!b.isProject) return -1;
    return a.label.localeCompare(b.label);
  });
  groups.forEach((g) => g.tasks.sort(sort));
  return groups;
}

/** Collapse state + "Expand all / Collapse all" for a set of groups. */
export function useCollapsedGroups(groups: TaskGroup[]) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const allCollapsed = useMemo(() => groups.length > 0 && groups.every((g) => collapsed.has(g.key)), [groups, collapsed]);
  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(groups.map((g) => g.key)));
  return { collapsed, toggle, allCollapsed, toggleAll };
}

/** Segmented "Group by" control. */
export const GroupBySwitch: React.FC<{ value: GroupBy; onChange: (v: GroupBy) => void; options: GroupBy[] }> = ({
  value,
  onChange,
  options,
}) =>
  options.length < 2 ? null : (
  <div className="flex items-center gap-2">
    <span className="hidden text-[12px] font-medium text-slate-500 md:inline">Group by</span>
    <div className="inline-flex p-0.5 rounded-lg bg-slate-100 ring-1 ring-inset ring-slate-200">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-2.5 py-1.5 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap ${
            value === o ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {GROUP_BY_LABEL[o]}
        </button>
      ))}
    </div>
  </div>
);

/** Column labels shown above the rows on wide screens; widths match TaskListRow. */
export const TaskColumnsHeader: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div className="hidden lg:flex items-center gap-3 px-4 py-2 border-b border-slate-100 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
    <span className="w-[18px] flex-shrink-0" />
    <span className="flex-1 min-w-0">Task</span>
    <span className="w-[92px] flex-shrink-0">Assignees</span>
    <span className="w-[132px] flex-shrink-0">Due</span>
    <span className="w-[76px] flex-shrink-0">Priority</span>
    {!compact && <span className="w-[118px] flex-shrink-0">Status</span>}
    {!compact && <span className="w-[88px] flex-shrink-0" />}
  </div>
);

/** One collapsible section of the task list. */
export const TaskGroupSection: React.FC<{
  group: TaskGroup;
  collapsed: boolean;
  onToggle: () => void;
  /** Hide the header when the list isn't grouped. */
  showHeader: boolean;
  /** Completed list: no Status/actions columns. */
  compact?: boolean;
  onAddTask?: (projectId?: number) => void;
  children: React.ReactNode;
}> = ({ group, collapsed, onToggle, showHeader, compact, onAddTask, children }) => {
  const tone = TONE[group.tone];
  const Icon = group.icon;
  return (
    <section className="overflow-hidden bg-white border shadow-sm rounded-xl border-slate-200">
      {showHeader && (
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/70"
        >
          <span className={`flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg ring-1 ${tone.icon}`}>
            <Icon className="w-3.5 h-3.5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[14px] text-slate-900 truncate">{group.label}</span>
              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md leading-none ${tone.chip}`}>
                {group.tasks.length}
              </span>
            </div>
            {group.hint && <div className="text-[11px] text-slate-400 mt-0.5">{group.hint}</div>}
          </div>
          <ChevronDown
            className={`flex-shrink-0 w-4 h-4 text-slate-400 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
        </button>
      )}
      {(!showHeader || !collapsed) && (
        <div className={showHeader ? "border-t border-slate-200" : ""}>
          <TaskColumnsHeader compact={compact} />
          <div>{children}</div>
          {onAddTask && (
            <button
              type="button"
              onClick={() => onAddTask(group.projectId ?? undefined)}
              className="flex items-center w-full gap-1.5 px-4 py-2.5 text-[12px] text-slate-500 border-t border-slate-100 hover:text-blue-900 hover:bg-slate-50/70 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {group.isProject ? <>Add task to {group.label}</> : "Add task"}
            </button>
          )}
        </div>
      )}
    </section>
  );
};
