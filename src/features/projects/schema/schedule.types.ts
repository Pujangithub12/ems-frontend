/**
 * Shared schedule row shape used across the Excel upload flow, the manual
 * "Add Schedule" modal, and the backend API. Every field is a plain string
 * so it binds cleanly to <input> elements — numeric/date parsing happens at
 * the boundaries (when building the Gantt chart, and when sending to the API).
 */
export interface ScheduleRow {

  id: string;
  taskName: string;
  duration: string;
  startDate: string;
  parentId: string;
  predecessorId: string;
  progress: string;
  /** "pending" | "in_progress" | "on_hold" | "completed", or "" (treated as "pending"). */
  status: string;
}

export function emptyScheduleRow(): ScheduleRow {
  return {
    id: "",
    taskName: "",
    duration: "",
    startDate: "",
    parentId: "",
    predecessorId: "",
    progress: "",
    status: "",
  };
}

// ---- Gantt chart data shapes (shared by ProjectScheduleTab and GanttChartView) ----

/** Manually set per task (not derived from progress/dates) — drives both the
 * Status column pill and the Gantt bar color. */
export type ScheduleStatus = "pending" | "in_progress" | "on_hold" | "completed";

export interface GanttTask {
  id: string;
  text: string;
  start: Date;
  end: Date;
  duration: number;
  progress: number;
  type: "task" | "summary" | "milestone";
  parent: string | number;
  open?: boolean;
  status: ScheduleStatus;
  wbs: string;
  durationLabel: string;
  startLabel: string;
}

export interface GanttLink {
  id: string;
  source: string;
  target: string;
  type: "e2s" | "s2s" | "e2e" | "s2e";
}

/** Colors + labels for each manual status — shared by the Status column pill,
 * the filter dropdown, and the Gantt chart bar coloring. Pending stays the
 * "default" blue; the others each get their own distinct color. */
export const STATUS_META: Record<
  ScheduleStatus,
  { label: string; bar: string; barBorder: string; pillBg: string; pillText: string; dot: string }
> = {
  pending: {
    label: "Pending",
    bar: "#60a5fa",
    barBorder: "#3b82f6",
    pillBg: "#dbeafe",
    pillText: "#1d4ed8",
    dot: "#60a5fa",
  },
  in_progress: {
    label: "In Progress",
    bar: "#8b5cf6",
    barBorder: "#7c3aed",
    pillBg: "#ede9fe",
    pillText: "#6d28d9",
    dot: "#8b5cf6",
  },
  on_hold: {
    label: "On Hold",
    bar: "#f59e0b",
    barBorder: "#d97706",
    pillBg: "#fef3c7",
    pillText: "#b45309",
    dot: "#f59e0b",
  },
  completed: {
    label: "Completed",
    bar: "#10b981",
    barBorder: "#059669",
    pillBg: "#d1fae5",
    pillText: "#047857",
    dot: "#10b981",
  },
};
