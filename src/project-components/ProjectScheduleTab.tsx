import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Upload,
  X,
  AlertCircle,
  Info,
  Pencil,
  CloudUpload,
  Check,
  LayoutGrid,
  Rows3,
  Filter,
  ZoomIn,
  ZoomOut,
  Download,
  Plus,
} from "lucide-react";
import * as XLSX from "xlsx";

import { ScheduleRow, emptyScheduleRow } from "./schema/Scheduletypes";
import { GanttLink, GanttTask, ScheduleStatus, STATUS_META } from "./schema/Scheduletypes";
import { dtoToRows, rowsToDto } from "./scheduleApi";
import { useScheduleQuery, useSaveScheduleMutation } from "../hooks/useSchedule";
import GanttChartView, { ScheduleColumnDef, ScheduleScale } from "./GanttChartView";

/**
 * ProjectScheduleTab
 * ------------------
 * Renders an interactive, hierarchical Gantt chart (dhtmlx-gantt) built from
 * a single source of truth — `scheduleRows` — which can be populated three ways:
 *   1. Uploading an Excel/CSV sheet
 *   2. Editing directly on the chart — inline task-name editing, the "+"
 *      button to add a task, and drag-resizing a bar to change its duration
 *      (see GanttChartView's onTaskChange)
 *   3. Loading whatever was last saved for this project from the backend
 *
 * Whichever way the rows are populated, "Save to Backend" persists the whole
 * schedule (PUT /api/projects/:projectId/schedule — full replace).
 *
 * Expected columns (header matching is case-insensitive and whitespace-tolerant):
 *   ID              optional, e.g. "1", "1.1" — auto-generated if omitted
 *   Task Name       required
 *   Duration        number (days) — 0 marks the row as a milestone
 *   Start Date      Excel date or "YYYY-MM-DD"
 *   Progress        percent complete, 0-100 (optional, defaults to 0)
 *   Parent ID       optional, references the ID of the owning summary task
 *   Predecessor ID  optional, comma separated list of ID(s) this task depends on
 *
 * A row is a "summary" bar only when it has no Start Date/Duration AND at
 * least one other row references it via Parent ID. A row with Duration = 0
 * (and a Start Date) is rendered as a milestone (diamond marker) instead.
 *
 * Status (Completed / In Progress / Delayed / Not Started) is derived from
 * Progress + dates relative to today, and drives both the "Status" column
 * pill and the chart bar color (see GanttChartView's task_class template).
 */

// ---- Types -----------------------------------------------------------

interface RawRow {
  [key: string]: unknown;
}

/** Row with headers normalized to fixed, camelCase keys regardless of the
 * original casing/spacing used in the uploaded sheet. Also the shape
 * `ScheduleRow` (from the modal / backend) structurally satisfies. */
interface NormalizedRow {
  id?: string | number;
  taskName?: string;
  duration?: number | string;
  startDate?: string | number | Date;
  parentId?: string | number;
  predecessorId?: string | number;
  progress?: number | string;
}

interface ParsedRow {
  id: string;
  name: string;
  duration: number | null;
  start: Date | null;
  parentId: string | null;
  predecessorIds: string[];
  isSummary: boolean;
  isMilestone: boolean;
  progress: number | null;
}

interface ProjectScheduleTabProps {
  /** Which project's schedule to load/save. Required for backend persistence. */
  projectId: string;
}

// ---- Constants ---------------------------------------------------------

/** Maps a normalized (trimmed, lowercased, single-spaced) header string to
 * the canonical field it represents. Add synonyms here if needed. */
const HEADER_ALIASES: Record<string, keyof NormalizedRow> = {
  id: "id",
  "task id": "id",
  "task name": "taskName",
  name: "taskName",
  task: "taskName",
  duration: "duration",
  "start date": "startDate",
  start: "startDate",
  "parent id": "parentId",
  parent: "parentId",
  "predecessor id": "predecessorId",
  predecessor: "predecessorId",
  "predecessor ids": "predecessorId",
  predecessors: "predecessorId",
  progress: "progress",
  "% complete": "progress",
  "percent complete": "progress",
  "% done": "progress",
  complete: "progress",
};

const REQUIRED_CANONICAL_COLUMNS: (keyof NormalizedRow)[] = ["taskName"];
const REQUIRED_COLUMN_LABELS: Record<string, string> = {
  id: "ID",
  taskName: "Task Name",
};

type ZoomLevel = "day" | "week" | "month";
const ZOOM_LEVELS: ZoomLevel[] = ["day", "week", "month"];
const ZOOM_LABELS: Record<ZoomLevel, string> = { day: "Day", week: "Week", month: "Month" };

const SCALES: Record<ZoomLevel, ScheduleScale[]> = {
  day: [
    { unit: "month", step: 1, format: "%F %Y" },
    { unit: "day", step: 1, format: "%j" },
  ],
  week: [
    { unit: "month", step: 1, format: "%F %Y" },
    { unit: "week", step: 1, format: "Week %W" },
  ],
  month: [
    { unit: "year", step: 1, format: "%Y" },
    { unit: "month", step: 1, format: "%M" },
  ],
};

type ViewTab = "gantt" | "list";
type StatusFilter = "all" | ScheduleStatus;

// ---- Helpers -------------------------------------------------------------

/** Trim, lowercase, and collapse internal whitespace so headers like
 * " Task  Name", "TASK NAME", and "task name" all match the same alias. */
function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Re-key a raw SheetJS row onto our fixed canonical field names, matching
 * headers case-insensitively via HEADER_ALIASES. Unrecognized columns are
 * dropped (they aren't used by the Gantt builder). */
function normalizeRow(row: RawRow): NormalizedRow {
  const out: NormalizedRow = {};
  Object.keys(row).forEach((rawKey) => {
    const canonical = HEADER_ALIASES[normalizeKey(rawKey)];
    if (canonical && row[rawKey] !== undefined && row[rawKey] !== "") {
      (out as Record<string, unknown>)[canonical] = row[rawKey];
    }
  });
  return out;
}

/** Coerce whatever SheetJS gives us (Date, Excel serial, or string) into a Date. */
function coerceDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF?.parse_date_code ? XLSX.SSF.parse_date_code(value) : null;
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
  }
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayDiff(a: Date, b: Date): number {
  return Math.max(1, Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)));
}

/** "YYYY-MM-DD" for a Date, or "" — matches <input type="date"> value format. */
function formatDateInput(date: Date | null): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "21 Jan" style, matching the reference design's compact date columns. */
function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

/** Derives Completed / In Progress / Delayed / Not Started from progress + dates. */
function computeStatus(progress: number, start: Date, end: Date, today: Date): ScheduleStatus {
  if (progress >= 100) return "completed";
  if (end.getTime() < today.getTime()) return "delayed";
  if (start.getTime() > today.getTime()) return "not_started";
  return "in_progress";
}

/** Convert normalized rows (from an Excel upload) into editable ScheduleRow
 * form so they can be shown/edited in the same modal used for manual entry. */
function normalizedRowsToScheduleRows(rows: NormalizedRow[]): ScheduleRow[] {
  return rows.map((row) => ({
    id: row.id != null ? String(row.id).trim() : "",
    taskName: row.taskName != null ? String(row.taskName).trim() : "",
    duration: row.duration != null && row.duration !== "" ? String(row.duration) : "",
    startDate: formatDateInput(coerceDate(row.startDate)),
    parentId: row.parentId != null ? String(row.parentId).trim() : "",
    predecessorId: row.predecessorId != null ? String(row.predecessorId).trim() : "",
    progress: row.progress != null && row.progress !== "" ? String(row.progress) : "",
  }));
}

/** Core transform: normalized rows -> Gantt tasks/links, with data-quality warnings. */
function buildGanttData(normalizedRows: NormalizedRow[]): { tasks: GanttTask[]; links: GanttLink[]; warnings: string[] } {
  const warnings: string[] = [];

  // --- Step 1: normalize raw rows ---
  const parsedRows: ParsedRow[] = normalizedRows.map((item, index) => {
    const id = String(item.id ?? `__auto_row_${index}__`).trim() || `__auto_row_${index}__`;
    const name = String(item.taskName ?? `Task ${index + 1}`).trim() || `Task ${index + 1}`;

    const durationRaw = item.duration;
    const durationNum =
      durationRaw === undefined || durationRaw === "" || durationRaw === null ? null : Number(durationRaw);
    const duration = durationNum === null || isNaN(durationNum) ? null : durationNum;

    const start = coerceDate(item.startDate);

    const parentIdRaw = item.parentId;
    const parentId =
      parentIdRaw === undefined || parentIdRaw === "" || parentIdRaw === null ? null : String(parentIdRaw).trim();

    const predecessorRaw = item.predecessorId;
    const predecessorIds =
      predecessorRaw === undefined || predecessorRaw === "" || predecessorRaw === null
        ? []
        : String(predecessorRaw)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

    const progressRaw = item.progress;
    const progressNum =
      progressRaw === undefined || progressRaw === "" || progressRaw === null ? null : Number(progressRaw);
    const progress =
      progressNum === null || isNaN(progressNum) ? null : Math.max(0, Math.min(100, progressNum));

    // A row with no Start Date or Duration is treated as a summary bar.
    const isSummary = !start || duration === null;
    // A row with an explicit zero Duration (and a real Start Date) is a milestone.
    const isMilestone = duration === 0 && start != null;

    return { id, name, duration, start, parentId, predecessorIds, isSummary, isMilestone, progress };
  });

  const byId = new Map<string, ParsedRow>();
  parsedRows.forEach((r) => {
    if (byId.has(r.id)) {
      warnings.push(`Duplicate ID "${r.id}" found — later row overwrote the earlier one.`);
    }
    byId.set(r.id, r);
  });

  // --- Step 2: compute summary spans from children (min start -> max end) ---
  const childrenByParent = new Map<string, ParsedRow[]>();
  parsedRows.forEach((r) => {
    if (r.parentId) {
      if (!byId.has(r.parentId)) {
        warnings.push(`Task "${r.id}" references missing Parent ID "${r.parentId}".`);
      }
      const list = childrenByParent.get(r.parentId) ?? [];
      list.push(r);
      childrenByParent.set(r.parentId, list);
    }
  });

  const summarySpans = new Map<string, { start: Date; end: Date }>();

  function resolveSpan(row: ParsedRow, visited = new Set<string>()): { start: Date; end: Date } | null {
    if (summarySpans.has(row.id)) return summarySpans.get(row.id)!;
    if (visited.has(row.id)) return null; // cycle guard
    visited.add(row.id);

    if (!row.isSummary && row.start && row.duration != null) {
      return { start: row.start, end: addDays(row.start, row.duration || 1) };
    }

    const children = childrenByParent.get(row.id) ?? [];
    if (children.length === 0) return null;

    let minStart: Date | null = null;
    let maxEnd: Date | null = null;
    children.forEach((child) => {
      const childSpan = resolveSpan(child, visited);
      if (childSpan) {
        if (!minStart || childSpan.start < minStart) minStart = childSpan.start;
        if (!maxEnd || childSpan.end > maxEnd) maxEnd = childSpan.end;
      }
    });

    if (minStart && maxEnd) {
      const span = { start: minStart, end: maxEnd };
      summarySpans.set(row.id, span);
      return span;
    }
    return null;
  }

  parsedRows.filter((r) => r.isSummary).forEach((r) => resolveSpan(r));

  // --- Step 2b: roll up progress from children for summary rows ---
  const summaryProgress = new Map<string, number>();

  function resolveProgress(row: ParsedRow, visited = new Set<string>()): number | null {
    if (!row.isSummary) return row.progress;
    if (summaryProgress.has(row.id)) return summaryProgress.get(row.id)!;
    if (visited.has(row.id)) return null;
    visited.add(row.id);

    const children = childrenByParent.get(row.id) ?? [];
    if (children.length === 0) return null;

    const values = children
      .map((child) => resolveProgress(child, visited))
      .filter((v): v is number => v != null);
    if (values.length === 0) return null;

    const avg = Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
    summaryProgress.set(row.id, avg);
    return avg;
  }

  parsedRows.filter((r) => r.isSummary).forEach((r) => resolveProgress(r));

  // --- Step 2c: WBS numbering (1, 1.1, 1.2, 2, 2.1, ...), parents processed first ---
  const wbsById = new Map<string, string>();
  const childOrderCounter = new Map<string, number>();

  function computeWbs(row: ParsedRow, visited = new Set<string>()): string {
    if (wbsById.has(row.id)) return wbsById.get(row.id)!;
    if (visited.has(row.id)) return "?";
    visited.add(row.id);

    const parentKey = row.parentId && byId.has(row.parentId) ? row.parentId : "__root__";
    const count = (childOrderCounter.get(parentKey) ?? 0) + 1;
    childOrderCounter.set(parentKey, count);

    const code =
      parentKey !== "__root__" ? `${computeWbs(byId.get(parentKey)!, visited)}.${count}` : `${count}`;
    wbsById.set(row.id, code);
    return code;
  }

  parsedRows.forEach((r) => computeWbs(r));

  // --- Step 3: build Gantt task objects ---
  const today = startOfDay(new Date());
  const tasks: GanttTask[] = [];

  parsedRows.forEach((row) => {
    let start: Date;
    let end: Date;
    let type: GanttTask["type"] = "task";
    const hasChildren = (childrenByParent.get(row.id)?.length ?? 0) > 0;

    if (row.isMilestone) {
      type = "milestone";
      start = row.start!;
      end = addDays(start, 1);
    } else if (row.isSummary && hasChildren) {
      // Genuine summary bar — has subtasks to roll dates up from.
      type = "summary";
      const span = summarySpans.get(row.id);
      if (span) {
        start = span.start;
        end = span.end;
      } else {
        warnings.push(`Summary task "${row.id}" (${row.name}) has subtasks with no resolvable dates; using a placeholder date.`);
        start = today;
        end = addDays(today, 1);
      }
    } else {
      // Either a normal task, or a row that looked like a summary (no
      // Start Date / Duration) but has no subtasks to roll up from — treat
      // it as a regular placeholder task instead.
      if (row.isSummary && !hasChildren) {
        warnings.push(`Task "${row.id}" (${row.name}) has no Start Date/Duration and no subtasks; using a 1-day placeholder.`);
      } else if (!row.start) {
        warnings.push(`Task "${row.id}" (${row.name}) is missing a Start Date; using today as a fallback.`);
      } else if (row.duration == null) {
        warnings.push(`Task "${row.id}" (${row.name}) is missing a Duration; defaulting to 1 day.`);
      }
      start = row.start ?? today;
      const duration = row.duration != null && row.duration > 0 ? row.duration : 1;
      end = addDays(start, duration);
    }

    if (end.getTime() <= start.getTime()) {
      end = addDays(start, 1);
    }

    const parent = row.parentId && byId.has(row.parentId) ? row.parentId : 0;

    const progress =
      type === "summary" ? summaryProgress.get(row.id) ?? 0 : row.progress ?? 0;
    const statusEnd = type === "milestone" ? start : end;
    const status = computeStatus(progress, start, statusEnd, today);

    tasks.push({
      id: row.id,
      text: row.name,
      start,
      end,
      duration: dayDiff(end, start),
      progress,
      type,
      parent,
      // Any row with children starts expanded (not just true "summary" rows)
      // so a freshly added subtask (see handleAddChildTask) is visible right
      // away instead of hidden behind a collapsed parent.
      open: hasChildren,
      status,
      wbs: wbsById.get(row.id) ?? "",
      durationLabel: type === "milestone" ? "—" : `${row.duration ?? dayDiff(end, start)} day${(row.duration ?? 0) === 1 ? "" : "s"}`,
      startLabel: formatDateLabel(start),
      colorIndex: tasks.length % 4,
    });
  });

  // Parent (summary) rows should appear before their children in the array.
  tasks.sort((a, b) => {
    if (a.type === "summary" && b.type !== "summary") return -1;
    if (a.type !== "summary" && b.type === "summary") return 1;
    return 0;
  });

  // --- Step 4: build dependency links ---
  const links: GanttLink[] = [];
  let linkCounter = 1;
  parsedRows.forEach((row) => {
    row.predecessorIds.forEach((pid) => {
      if (!byId.has(pid)) {
        warnings.push(`Task "${row.id}" references missing Predecessor ID "${pid}".`);
        return;
      }
      if (pid === row.id) {
        warnings.push(`Task "${row.id}" lists itself as a Predecessor ID; skipped.`);
        return;
      }
      links.push({
        id: `link-${linkCounter++}`,
        source: pid,
        target: row.id,
        type: "e2s", // finish-to-start: predecessor must finish before this task starts
      });
    });
  });

  return { tasks, links, warnings: Array.from(new Set(warnings)) };
}

// ---- Component -------------------------------------------------------------

const ProjectScheduleTab: React.FC<ProjectScheduleTabProps> = ({ projectId }) => {
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("week");
  const [viewTab, setViewTab] = useState<ViewTab>("gantt");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  // Master edit switch for the chart itself — off by default so the Gantt is
  // read-only until "Edit Schedule" is clicked. Inline text editing,
  // drag-to-link, and drag-resize on the chart all key off this.
  const [editMode, setEditMode] = useState(false);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [backendError, setBackendError] = useState<string | null>(null);

  // Load whatever was last saved for this project.
  const scheduleQuery = useScheduleQuery(projectId);
  const loadingInitial = scheduleQuery.isLoading;
  const saveScheduleMutation = useSaveScheduleMutation(projectId);

  useEffect(() => {
    if (scheduleQuery.data && scheduleQuery.data.length > 0) {
      setScheduleRows(dtoToRows(scheduleQuery.data));
    }
  }, [scheduleQuery.data]);

  useEffect(() => {
    if (scheduleQuery.isError) {
      setBackendError(
        scheduleQuery.error instanceof Error
          ? scheduleQuery.error.message
          : "Failed to load saved schedule.",
      );
    }
  }, [scheduleQuery.isError, scheduleQuery.error]);

  // Derive the Gantt chart from scheduleRows — the single source of truth,
  // whether it came from an Excel upload, the modal, or the backend.
  const { tasks: ganttTasks, links: ganttLinks, warnings: ganttWarnings } = useMemo(
    () => buildGanttData(scheduleRows as NormalizedRow[]),
    [scheduleRows],
  );

  // Summary rows always stay visible (so the hierarchy stays navigable);
  // the status filter only hides non-matching leaf tasks/milestones.
  const visibleTasks = useMemo(() => {
    if (statusFilter === "all") return ganttTasks;
    return ganttTasks.filter((t) => t.type === "summary" || t.status === statusFilter);
  }, [ganttTasks, statusFilter]);

  // `width` here is a relative weight, not a pixel value — GanttChartView
  // scales these proportionally to fill the 25%-of-container grid area it
  // reserves for the table (the remaining 75% is the chart).
  const columns: ScheduleColumnDef[] = useMemo(
    () => [
      {
        id: "wbs",
        header: "Id",
        width: editMode ? 90 : 52,
        align: "center",
        // Only while editing: a small "+" next to the id that adds a
        // subtask under that row (see handleAddChildTask). Wired up in
        // GanttChartView's onTaskClick via the "gantt-add-child-btn" class.
        render: editMode
          ? (t) =>
              `<span class="gantt-wbs-label">${t.wbs}</span><button type="button" class="gantt-add-child-btn" data-add-child-id="${t.id}" title="Add subtask">+</button>`
          : undefined,
      },
      { id: "text", header: "Task Name", width: 260, tree: true, align: "center" },
      { id: "durationLabel", header: "Duration", width: 90, align: "center" },
      { id: "startLabel", header: "Start", width: 84, align: "center" },
    ],
    [editMode],
  );

  const scales = useMemo(() => SCALES[zoomLevel], [zoomLevel]);

  // Drag-created dependency arrows (the connector dots on a bar's edges) fold
  // straight into the dependent row's `predecessorId` — the same field the
  // modal's "Predecessor ID" column and Excel's "Predecessor ID" column
  // already feed, so `buildGanttData` treats them identically. This only
  // updates local state; it's saved to the backend the same way any other
  // edit is, via the existing "Save to Backend" button.
  const handleLinkCreate = useCallback((sourceId: string, targetId: string) => {
    setScheduleRows((rows) =>
      rows.map((row) => {
        if (row.id !== targetId || sourceId === targetId) return row;
        const existing = row.predecessorId
          ? row.predecessorId.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
        if (existing.includes(sourceId)) return row;
        return { ...row, predecessorId: [...existing, sourceId].join(",") };
      }),
    );
  }, []);

  const handleLinkDelete = useCallback((sourceId: string, targetId: string) => {
    setScheduleRows((rows) =>
      rows.map((row) => {
        if (row.id !== targetId) return row;
        const existing = row.predecessorId
          ? row.predecessorId.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
        return { ...row, predecessorId: existing.filter((id) => id !== sourceId).join(",") };
      }),
    );
  }, []);

  // Inline task-name edits and drag-resizes on the chart both report back
  // here — folded into scheduleRows the same way link create/delete are.
  // Nothing is sent to the backend until "Save to Backend" is clicked.
  const handleTaskChange = useCallback(
    (id: string, changes: { text?: string; start?: Date; duration?: number }) => {
      setScheduleRows((rows) =>
        rows.map((row) => {
          if (row.id !== id) return row;
          const next = { ...row };
          if (changes.text !== undefined) next.taskName = changes.text;
          if (changes.start !== undefined) next.startDate = formatDateInput(changes.start);
          if (changes.duration !== undefined) next.duration = String(changes.duration);
          return next;
        }),
      );
    },
    [],
  );

  // Appends a new task row, defaulting it to start right after the last
  // existing task ends so it lands somewhere visible on the chart. The user
  // renames it inline and can drag its bar to adjust the duration.
  const handleAddTask = useCallback(() => {
    setScheduleRows((rows) => {
      const existingIds = new Set(rows.map((r) => r.id));
      let n = rows.length + 1;
      let newId = String(n);
      while (existingIds.has(newId)) newId = String(++n);

      const { tasks } = buildGanttData(rows as NormalizedRow[]);
      const lastEnd = tasks.length > 0 ? tasks[tasks.length - 1].end : new Date();

      const newRow: ScheduleRow = {
        ...emptyScheduleRow(),
        id: newId,
        taskName: "New Task",
        duration: "1",
        startDate: formatDateInput(lastEnd),
      };
      return [...rows, newRow];
    });
  }, []);

  // Adds a subtask under the task whose "+" (next to its # id) was clicked.
  // parentId drives both the tree nesting and the auto WBS numbering
  // (1.1, 1.2, ...) — buildGanttData derives the WBS code purely from the
  // parentId chain, so nothing needs computing here beyond a sane default
  // start date (right after the parent's other children, or the parent
  // itself if it has none yet).
  const handleAddChildTask = useCallback((parentId: string) => {
    setScheduleRows((rows) => {
      const existingIds = new Set(rows.map((r) => r.id));
      let n = rows.length + 1;
      let newId = String(n);
      while (existingIds.has(newId)) newId = String(++n);

      const { tasks } = buildGanttData(rows as NormalizedRow[]);
      const parentTask = tasks.find((t) => t.id === parentId);
      const childTasks = tasks.filter((t) => t.parent === parentId);
      const lastEnd =
        childTasks.length > 0
          ? childTasks.reduce((max, t) => (t.end > max ? t.end : max), childTasks[0].end)
          : parentTask?.start ?? new Date();

      const newRow: ScheduleRow = {
        ...emptyScheduleRow(),
        id: newId,
        parentId,
        taskName: "New Task",
        duration: "1",
        startDate: formatDateInput(lastEnd),
      };
      return [...rows, newRow];
    });
  }, []);

  const cycleZoom = (direction: 1 | -1) => {
    setZoomLevel((current) => {
      const idx = ZOOM_LEVELS.indexOf(current);
      const next = ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, idx + direction))];
      return next;
    });
  };

  const persistSchedule = useCallback(
    async (rows: ScheduleRow[]) => {
      if (!projectId) {
        setBackendError("No project selected — cannot save the schedule.");
        setSaveStatus("error");
        throw new Error("No project selected.");
      }
      setSaveStatus("saving");
      setBackendError(null);
      try {
        const saved = await saveScheduleMutation.mutateAsync(rowsToDto(rows));
        setScheduleRows(dtoToRows(saved));
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2500);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save the schedule.";
        setBackendError(message);
        setSaveStatus("error");
        throw new Error(message);
      }
    },
    [projectId, saveScheduleMutation],
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setFileName(file.name);

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        // cellDates:true converts Excel serial numbers into real JS Date objects.
        const workbook = XLSX.read(data, { type: "array", cellDates: true });

        if (workbook.SheetNames.length === 0) {
          setUploadError("The uploaded file has no sheets.");
          return;
        }

        // Pick the sheet whose headers best match our expected schema,
        // instead of always assuming the data lives on the first sheet.
        let bestJsonData: RawRow[] = [];
        let bestScore = -1;
        let bestHeaders: string[] = [];

        workbook.SheetNames.forEach((sheetName) => {
          const rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName], { defval: "" });
          if (rows.length === 0) return;
          const headers = new Set<string>();
          rows.forEach((row) => Object.keys(row).forEach((k) => headers.add(k)));
          const canonical = new Set<keyof NormalizedRow>();
          headers.forEach((k) => {
            const c = HEADER_ALIASES[normalizeKey(k)];
            if (c) canonical.add(c);
          });
          if (bestJsonData.length === 0) {
            bestJsonData = rows;
            bestHeaders = Array.from(headers);
          }
          const hasRequired = REQUIRED_CANONICAL_COLUMNS.every((c) => canonical.has(c));
          const score = hasRequired ? canonical.size : -1;
          if (score > bestScore) {
            bestScore = score;
            bestJsonData = rows;
            bestHeaders = Array.from(headers);
          }
        });

        if (bestJsonData.length === 0) {
          setUploadError("The uploaded file has no data rows.");
          return;
        }

        const resolvedCanonical = new Set<keyof NormalizedRow>();
        bestHeaders.forEach((k) => {
          const canonical = HEADER_ALIASES[normalizeKey(k)];
          if (canonical) resolvedCanonical.add(canonical);
        });

        const missingCols = REQUIRED_CANONICAL_COLUMNS.filter((c) => !resolvedCanonical.has(c));
        if (missingCols.length > 0) {
          setUploadError(
            `Missing required column(s): ${missingCols.map((c) => REQUIRED_COLUMN_LABELS[c]).join(", ")}. Found columns: ${bestHeaders.join(", ")}`,
          );
          return;
        }

        const normalized = bestJsonData.map(normalizeRow);
        setScheduleRows(normalizedRowsToScheduleRows(normalized));
      } catch (err) {
        console.error("Error parsing Excel file:", err);
        setUploadError("Failed to parse the file. Please make sure it's a valid .xlsx/.csv with the expected columns.");
      }
    };

    reader.onerror = () => setUploadError("Could not read the selected file.");

    reader.readAsArrayBuffer(file);
  };

  const clearGantt = () => {
    setScheduleRows([]);
    setUploadError(null);
    setFileName(null);
  };

  const handleExportCsv = () => {
    const sheetRows = ganttTasks.map((t) => ({
      "#": t.wbs,
      "Task Name": t.text,
      Duration: t.durationLabel,
      Start: t.startLabel,
    }));
    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Schedule");
    XLSX.writeFile(workbook, `schedule-${projectId}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Dims the rest of the page while editing, so the (still-crisp, since
          it sits above this overlay in z-index) chart reads as the one thing
          that's currently interactive. pointer-events-none so it's purely
          visual — nothing underneath loses clickability. */}
      {editMode && (
        <div className="fixed inset-0 z-30 bg-slate-900/10 pointer-events-none transition-opacity duration-200" />
      )}
      {scheduleRows.length === 0 ? (
        <div className="flex flex-col justify-center items-center py-16 text-center rounded border border-dashed border-slate-200">
          <div className="flex justify-center items-center mb-3 w-12 h-12 rounded bg-slate-100">
            <Upload className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
            {loadingInitial ? "Loading schedule..." : "Add a Schedule"}
          </h3>
          <p className="text-slate-500 text-[12px] max-w-sm mx-auto mb-4">
            Upload an Excel file to generate an interactive Gantt chart.
          </p>

          <div className="flex relative gap-2 items-center">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
              id="excel-upload"
            />
            <label
              htmlFor="excel-upload"
              className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded text-[12px] font-medium hover:bg-blue-800 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Upload Excel Sheet
            </label>
          </div>

          {!loadingInitial && (
            <button
              onClick={() => {
                setEditMode(true);
                handleAddTask();
              }}
              className="flex items-center gap-1.5 mt-3 text-[12px] font-medium text-blue-900 hover:text-blue-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Or start from scratch
            </button>
          )}

          {uploadError && (
            <div className="flex gap-2 items-start p-3 mt-4 max-w-md text-xs text-left text-rose-700 bg-rose-50 rounded border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          {backendError && (
            <div className="flex gap-2 items-start p-3 mt-4 max-w-md text-xs text-left text-rose-700 bg-rose-50 rounded border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{backendError}</span>
            </div>
          )}

          <div className="p-4 mt-6 max-w-md text-xs text-left rounded border text-slate-500 bg-slate-50 border-slate-200">
            <p className="mb-2 font-semibold text-slate-700">Schedule Format:</p>
            <p>Whether uploading a sheet or typing it in, these are the fields (any header casing works in Excel):</p>
            <ul className="pl-5 mt-2 space-y-1 list-disc">
              <li><strong>ID</strong> (optional) — unique task identifier, e.g. "1", "1.1". Needed for Parent ID / Predecessor ID references.</li>
              <li><strong>Task Name</strong> — task label (required)</li>
              <li><strong>Duration</strong> — length in days (0 marks a milestone)</li>
              <li><strong>Start Date</strong> — date the task begins</li>
              <li><strong>Progress</strong> (optional) — percent complete, 0-100</li>
              <li><strong>Parent ID</strong> (optional) — ID of the owning summary task</li>
              <li><strong>Predecessor ID</strong> (optional) — comma-separated IDs this task depends on</li>
            </ul>
            <p className="mt-2 text-slate-400">
              Rows with no Start Date / Duration, referenced by at least one other row's Parent ID, become summary bars.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <ViewTabButton icon={<LayoutGrid className="w-3.5 h-3.5" />} label="Gantt" active={viewTab === "gantt"} onClick={() => setViewTab("gantt")} />
              <ViewTabButton icon={<Rows3 className="w-3.5 h-3.5" />} label="List" active={viewTab === "list"} onClick={() => setViewTab("list")} />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-slate-600 border border-slate-200 rounded">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="bg-transparent text-sm focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  {(Object.keys(STATUS_META) as ScheduleStatus[]).map((key) => (
                    <option key={key} value={key}>{STATUS_META[key].label}</option>
                  ))}
                </select>
              </div>

              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="excel-upload-toolbar"
              />
              <label
                htmlFor="excel-upload-toolbar"
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Upload Excel Sheet
              </label>

              {viewTab === "gantt" && (
                <div className="flex items-center gap-1 px-1 py-1 border border-slate-200 rounded">
                  <button
                    onClick={() => cycleZoom(-1)}
                    disabled={zoomLevel === ZOOM_LEVELS[0]}
                    className="p-1.5 text-slate-500 rounded hover:bg-slate-50 disabled:opacity-30"
                    title="Zoom in (more detail)"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <span className="px-1 text-xs font-medium text-slate-600 min-w-[46px] text-center">{ZOOM_LABELS[zoomLevel]}</span>
                  <button
                    onClick={() => cycleZoom(1)}
                    disabled={zoomLevel === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                    className="p-1.5 text-slate-500 rounded hover:bg-slate-50 disabled:opacity-30"
                    title="Zoom out (less detail)"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                </div>
              )}

              <button
                onClick={handleExportCsv}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
              >
                <Download className="w-4 h-4" />
                Export
              </button>

              {editMode && (
                <button
                  onClick={handleAddTask}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-blue-900 rounded hover:bg-blue-800"
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
              )}
            </div>
          </div>

          {/* Secondary actions: edit toggle / save / clear */}
          <div className="flex flex-wrap gap-3 justify-between items-center -mt-2">
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => setEditMode((m) => !m)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors ${
                  editMode
                    ? "text-white bg-blue-900 hover:bg-blue-800"
                    : "text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                {editMode ? "Done Editing" : "Edit Schedule"}
              </button>

              <button
                onClick={() => persistSchedule(scheduleRows).catch(() => {})}
                disabled={saveStatus === "saving"}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
              >
                {saveStatus === "saving" ? (
                  <>
                    <CloudUpload className="w-3.5 h-3.5 animate-pulse" />
                    Saving...
                  </>
                ) : saveStatus === "saved" ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Saved
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-3.5 h-3.5" />
                    Save to Backend
                  </>
                )}
              </button>

              {fileName && <span className="text-xs text-slate-400 truncate max-w-[200px]">{fileName}</span>}
            </div>
            <button
              onClick={clearGantt}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
            >
              <X className="w-3.5 h-3.5" />
              Clear Chart
            </button>
          </div>

          {backendError && (
            <div className="flex gap-2 items-start p-3 text-xs text-rose-700 bg-rose-50 rounded border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{backendError}</span>
            </div>
          )}

          {ganttWarnings.length > 0 && (
            <div className="flex gap-2 items-start p-3 text-xs text-amber-800 bg-amber-50 rounded border border-amber-200">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="mb-1 font-semibold">{ganttWarnings.length} note(s) while building the chart:</p>
                <ul className="pl-4 space-y-0.5 list-disc">
                  {ganttWarnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {ganttWarnings.length > 5 && <li>...and {ganttWarnings.length - 5} more.</li>}
                </ul>
              </div>
            </div>
          )}

          <div
            className={`overflow-auto bg-white rounded-lg border border-slate-200 ${editMode ? "relative z-40" : ""}`}
            style={{ maxHeight: 560 }}
          >
            <div className="min-w-[600px]">
              <GanttChartView
                tasks={visibleTasks}
                links={ganttLinks}
                scales={scales}
                columns={columns}
                showChart={viewTab === "gantt"}
                editable={editMode}
                onLinkCreate={handleLinkCreate}
                onLinkDelete={handleLinkDelete}
                onTaskChange={handleTaskChange}
                onAddChildTask={handleAddChildTask}
              />
              {editMode && (
                <div className="flex items-stretch border-t border-slate-200">
                  <button
                    onClick={handleAddTask}
                    title="Add Task"
                    className="flex items-center justify-center flex-shrink-0 w-[52px] py-1.5 text-slate-400 hover:text-blue-900 hover:bg-slate-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <div className="flex-1 bg-slate-50/40" />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ---- Small presentational helpers -----------------------------------------

const ViewTabButton: React.FC<{ icon: React.ReactNode; label: string; active: boolean; onClick: () => void }> = ({
  icon,
  label,
  active,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
      active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
    }`}
  >
    {icon}
    {label}
  </button>
);

export default ProjectScheduleTab;
