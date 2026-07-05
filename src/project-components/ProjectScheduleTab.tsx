import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Upload, X, AlertCircle, Info, Plus, Pencil, CloudUpload, Check } from "lucide-react";
import * as XLSX from "xlsx";
import { Gantt, Willow } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";

import { ScheduleRow } from "./schema/Scheduletypes";
import { dtoToRows, fetchSchedule, rowsToDto, saveSchedule } from "./scheduleApi";
import AddScheduleModal from "./modal/AddScheduleModal";

/**
 * ProjectScheduleTab
 * ------------------
 * Renders an interactive, hierarchical Gantt chart (@svar-ui/react-gantt)
 * built from a single source of truth — `scheduleRows` — which can be
 * populated three ways:
 *   1. Uploading an Excel/CSV sheet
 *   2. Typing directly into the "Add / Edit Schedule" modal
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
 * least one other row references it via Parent ID — @svar-ui/react-gantt
 * crashes on a childless summary-type task, so a childless one is instead
 * rendered as a normal 1-day placeholder task. A row with Duration = 0 (and a
 * Start Date) is rendered as a milestone (diamond marker) instead.
 *
 * Status (Completed / In Progress / Delayed / Not Started) is derived from
 * Progress + dates relative to today, and drives both the "Status" column
 * pill and the chart bar color. Bar colors are applied via a dynamically
 * generated `data-task-id` CSS block (see `buildStatusCss`) rather than the
 * library's `type` field, so the library's own summary-bracket / milestone-
 * diamond rendering is left completely untouched.
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

type ScheduleStatus = "completed" | "in_progress" | "delayed" | "not_started";

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

interface GanttTask {
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
  finishLabel: string;
  progressLabel: string;
}

interface GanttLink {
  id: string;
  source: string;
  target: string;
  type: "e2s" | "s2s" | "e2e" | "s2e";
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

type ViewMode = "day" | "week" | "month";

const SCALES: Record<ViewMode, { unit: string; step: number; format: string }[]> = {
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

/** Colors + labels for each derived status — shared by the Status column, the
 * legend, and the dynamically generated chart-bar CSS. */
const STATUS_META: Record<
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

  // --- Step 3: build @svar-ui/react-gantt task objects ---
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
      // Start Date / Duration) but has no subtasks to roll up from.
      // @svar-ui/react-gantt crashes on a "summary" task with no children,
      // so treat it as a regular placeholder task instead.
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
      // A summary task with no children triggers a known crash in
      // @svar-ui/react-gantt, so only ever mark it "open" when it truly is
      // a summary (which by construction always has children here).
      open: type === "summary",
      status,
      wbs: wbsById.get(row.id) ?? "",
      durationLabel: type === "milestone" ? "—" : `${row.duration ?? dayDiff(end, start)} day${(row.duration ?? 0) === 1 ? "" : "s"}`,
      startLabel: formatDateLabel(start),
      finishLabel: type === "milestone" ? formatDateLabel(start) : formatDateLabel(end),
      progressLabel: `${progress}%`,
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

/** Generates a `data-task-id`-scoped CSS block that colors each bar/diamond
 * by its derived status, without touching the library's own `type`-driven
 * structural rendering (summary brackets, milestone diamonds stay intact). */
function buildStatusCss(tasks: GanttTask[]): string {
  return tasks
    .map((t) => {
      const meta = STATUS_META[t.status];
      const selector = `[data-task-id="${t.id}"]`;
      return `${selector} .wx-bar, ${selector} .wx-segment, ${selector} .wx-content { background-color: ${meta.bar} !important; border-color: ${meta.barBorder} !important; }`;
    })
    .join("\n");
}

// ---- Component -------------------------------------------------------------

const ProjectScheduleTab: React.FC<ProjectScheduleTabProps> = ({ projectId }) => {
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [backendError, setBackendError] = useState<string | null>(null);

  // Load whatever was last saved for this project.
  useEffect(() => {
    if (!projectId) {
      setLoadingInitial(false);
      return;
    }
    let cancelled = false;
    setLoadingInitial(true);
    fetchSchedule(projectId)
      .then((dtos) => {
        if (cancelled) return;
        if (dtos.length > 0) setScheduleRows(dtoToRows(dtos));
      })
      .catch((err) => {
        if (!cancelled) setBackendError(err instanceof Error ? err.message : "Failed to load saved schedule.");
      })
      .finally(() => {
        if (!cancelled) setLoadingInitial(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Derive the Gantt chart from scheduleRows — the single source of truth,
  // whether it came from an Excel upload, the modal, or the backend.
  const { tasks: ganttTasks, links: ganttLinks, warnings: ganttWarnings } = useMemo(
    () => buildGanttData(scheduleRows as NormalizedRow[]),
    [scheduleRows],
  );

  const statusCss = useMemo(() => buildStatusCss(ganttTasks), [ganttTasks]);

  const columns = useMemo(
    () => [
      { id: "wbs", header: "#", width: 52, align: "center" as const },
      { id: "text", header: "Task Name", flexgrow: 2 },
      { id: "durationLabel", header: "Duration", width: 90 },
      { id: "startLabel", header: "Start", width: 84 },
      { id: "finishLabel", header: "Finish", width: 84 },
      { id: "progressLabel", header: "Progress", width: 80, align: "center" as const },
      {
        id: "status",
        header: "Status",
        width: 130,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        template: (value: any) => {
          const meta = STATUS_META[value as ScheduleStatus] ?? STATUS_META.not_started;
          return `<span style="display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:9999px;font-size:11px;font-weight:600;background:${meta.pillBg};color:${meta.pillText}"><span style="width:6px;height:6px;border-radius:9999px;background:${meta.dot};display:inline-block"></span>${meta.label}</span>`;
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any[],
    [],
  );

  const today = useMemo(() => startOfDay(new Date()), []);
  const highlightTime = useCallback(
    (date: Date, unit: string) => (unit === "day" && startOfDay(date).getTime() === today.getTime() ? "wx-today-column" : ""),
    [today],
  );

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
        const saved = await saveSchedule(projectId, rowsToDto(rows));
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
    [projectId],
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

  const scales = useMemo(() => SCALES[viewMode], [viewMode]);

  return (
    <div className="space-y-6">
      {scheduleRows.length === 0 ? (
        <div className="flex flex-col justify-center items-center py-16 text-center rounded border border-dashed border-slate-200">
          <div className="flex justify-center items-center mb-3 w-12 h-12 rounded bg-slate-100">
            <Upload className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
            {loadingInitial ? "Loading schedule..." : "Add a Schedule"}
          </h3>
          <p className="text-slate-500 text-[12px] max-w-sm mx-auto mb-4">
            Upload an Excel file, or add tasks manually, to generate an interactive Gantt chart.
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
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-slate-700 border border-slate-200 rounded text-[12px] font-medium hover:bg-slate-50"
            >
              <Plus className="w-4 h-4" />
              Add Schedule
            </button>
          </div>

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
          <div className="flex flex-wrap gap-4 justify-between items-center">
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as ViewMode)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-blue-900"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>

              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
              >
                <Pencil className="w-4 h-4" />
                Edit Schedule
              </button>

              <button
                onClick={() => persistSchedule(scheduleRows).catch(() => {})}
                disabled={saveStatus === "saving"}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
              >
                {saveStatus === "saving" ? (
                  <>
                    <CloudUpload className="w-4 h-4 animate-pulse" />
                    Saving...
                  </>
                ) : saveStatus === "saved" ? (
                  <>
                    <Check className="w-4 h-4" />
                    Saved
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" />
                    Save to Backend
                  </>
                )}
              </button>

              {fileName && <span className="text-xs text-slate-400 truncate max-w-[200px]">{fileName}</span>}
            </div>
            <button
              onClick={clearGantt}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
            >
              <X className="w-4 h-4" />
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

          {/* Per-task status colors + a soft highlight over today's column. */}
          <style>{`
            ${statusCss}
            .wx-today-column { background-color: rgba(37, 99, 235, 0.06) !important; }
            .wx-willow-theme .wx-gantt { --wx-gantt-task-border-radius: 6px; }
          `}</style>

          {/* Scrollable, responsive Gantt panel */}
          <div className="overflow-x-auto bg-white rounded-lg border border-slate-200" style={{ height: 520 }}>
            <div className="min-w-[600px] h-full">
              <Willow>
                <Gantt
                  tasks={ganttTasks}
                  links={ganttLinks}
                  scales={scales}
                  columns={columns}
                  highlightTime={highlightTime}
                  cellWidth={viewMode === "month" ? 90 : 55}
                />
              </Willow>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 items-center px-1 text-[12px] text-slate-600">
            {(Object.keys(STATUS_META) as ScheduleStatus[]).map((key) => (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: STATUS_META[key].dot }}
                />
                {STATUS_META[key].label}
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 bg-slate-500"
                style={{ transform: "rotate(45deg)" }}
              />
              Milestone
            </div>
          </div>
        </>
      )}

      <AddScheduleModal
        open={modalOpen}
        initialRows={scheduleRows}
        onClose={() => setModalOpen(false)}
        onSave={async (rows) => {
          setScheduleRows(rows);
          await persistSchedule(rows);
          setModalOpen(false);
        }}
      />
    </div>
  );
};

export default ProjectScheduleTab;
