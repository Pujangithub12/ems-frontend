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
  };
}

// ---- Gantt chart data shapes (shared by ProjectScheduleTab and GanttChartView) ----

export type ScheduleStatus = "completed" | "in_progress" | "delayed" | "not_started";

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
  /** 0-3, cycled per task in row order — drives the Gantt bar's rotating color (not status-based). */
  colorIndex: number;
}

export interface GanttLink {
  id: string;
  source: string;
  target: string;
  type: "e2s" | "s2s" | "e2e" | "s2e";
}

/** Colors + labels for each derived status — shared by the Status column, the
 * legend, the stat tiles, and the Gantt chart bar coloring. */
export const STATUS_META: Record<
  ScheduleStatus,
  { label: string; bar: string; barBorder: string; pillBg: string; pillText: string; dot: string }
> = {
  completed: {
    label: "Completed",
    bar: "#10b981",
    barBorder: "#059669",
    pillBg: "#d1fae5",
    pillText: "#047857",
    dot: "#10b981",
  },
  in_progress: {
    label: "In Progress",
    bar: "#3b82f6",
    barBorder: "#2563eb",
    pillBg: "#dbeafe",
    pillText: "#1d4ed8",
    dot: "#3b82f6",
  },
  delayed: {
    label: "Delayed",
    bar: "#f43f5e",
    barBorder: "#e11d48",
    pillBg: "#ffe4e6",
    pillText: "#be123c",
    dot: "#f43f5e",
  },
  not_started: {
    label: "Not Started",
    bar: "#cbd5e1",
    barBorder: "#94a3b8",
    pillBg: "#f1f5f9",
    pillText: "#475569",
    dot: "#94a3b8",
  },
};
