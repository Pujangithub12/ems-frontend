import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  AlertCircle,
  Pencil,
  CloudUpload,
  Check,
  LayoutGrid,
  Rows3,
  Filter,
  Download,
  Plus,
  Loader2,
  SquareCheckBig,
  Trash2,
  X,
  UnfoldVertical,
  FoldVertical,
} from "lucide-react";
import * as XLSX from "xlsx";
import { gantt } from "dhtmlx-gantt";

import { ScheduleRow, emptyScheduleRow } from "../../schema/schedule.types";
import { GanttLink, GanttTask, ScheduleStatus, STATUS_META } from "../../schema/schedule.types";
import { dtoToRows, rowsToDto } from "../../api/schedule.api";
import { useScheduleQuery, useSaveScheduleMutation } from "../../hooks/useSchedule";
import {
  ScheduleLinkType,
  PredecessorToken,
  parsePredecessorList,
  formatPredecessorToken,
  LINK_TYPE_LABELS,
  LINK_TYPE_TO_GANTT,
  GANTT_TYPE_TO_LINK_TYPE,
} from "../../utils/predecessorTokens";
import { recalcAfterTaskEdit, recalcAfterLinkEdit } from "../../utils/scheduleAutoSchedule";
import GanttChartView, { ScheduleColumnDef, ScheduleScale, LinkEditInfo } from "../GanttChartView";
import { deleteTask } from "../../../tasks/api/tasks.api";
import { getErrorMessage } from "../../../../lib/errors";
import ConfirmationModal from "../../../../components/ConfirmationModal";
import StickyHorizontalScrollbar from "../../../../components/StickyHorizontalScrollbar";
import Drawer from "../../../../components/Drawer";
import { useRowSelection } from "../../../../hooks/useRowSelection";

/**
 * ProjectScheduleTab
 * ------------------
 * Renders an interactive, hierarchical Gantt chart (dhtmlx-gantt) built from
 * a single source of truth — `scheduleRows` — which can be populated three ways:
 *   1. Uploading an Excel/CSV sheet
 *   2. Editing directly on the chart — inline task-name editing, the "+"
 *      button to add a task, and dragging/resizing a bar to move it or
 *      change its duration (see GanttChartView's onTaskChange)
 *   3. Loading whatever was last saved for this project from the backend
 *
 * Whichever way the rows are populated, "Save to Backend" persists the whole
 * schedule (PUT /api/projects/:projectId/schedule — full replace).
 *
 * MS-Project-style auto-scheduling (see scheduleAutoSchedule.ts): moving a
 * task's dates, or creating/editing a dependency, recomputes every task
 * downstream of it in the dependency graph — FS/SS/FF/SF + lag, cascading
 * transitively. A task's own duration is never touched by this, only its
 * start date. Only fires from these interactive edits; loading a saved
 * schedule or an Excel upload never silently rewrites its dates.
 *
 * Expected columns (header matching is case-insensitive and whitespace-tolerant):
 *   ID              optional, e.g. "1", "1.1" — auto-generated if omitted
 *   Task Name       required
 *   Duration        number (days) — 0 marks the row as a milestone
 *   Start Date      Excel date or "YYYY-MM-DD"
 *   Progress        percent complete, 0-100 (optional, defaults to 0)
 *   Parent ID       optional, references the ID of the owning summary task
 *   Predecessor ID  optional, comma separated list of ID(s) this task depends on. Each id can
 *                   carry an MS-Project-style relationship type + lag right after it: "5FS+2"
 *                   (Finish-to-Start, 2 days lag), "7SS-1" (Start-to-Start, 1 day lead). A bare
 *                   id (e.g. "3") implies Finish-to-Start with zero lag. Types: FS/SS/FF/SF —
 *                   see predecessorTokens.ts for the parser/serializer.
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
  status?: string;
}

interface ParsedRow {
  id: string;
  name: string;
  duration: number | null;
  start: Date | null;
  parentId: string | null;
  predecessorTokens: PredecessorToken[];
  isSummary: boolean;
  isMilestone: boolean;
  progress: number | null;
  status: ScheduleStatus;
}

interface ProjectScheduleTabProps {
  /** Which project's schedule to load/save. Required for backend persistence. */
  projectId: string;
  /** Called after a successful save or task delete so the Task tab (and
   * project header stats) can refresh — Schedule and Task tabs now share the
   * same Task rows, so a Gantt-side change needs to surface there too. */
  onScheduleUpdate?: () => void;
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
  status: "status",
};

const REQUIRED_CANONICAL_COLUMNS: (keyof NormalizedRow)[] = ["taskName"];
const REQUIRED_COLUMN_LABELS: Record<string, string> = {
  id: "ID",
  taskName: "Task Name",
};

type ZoomLevel = "day" | "week" | "month";
const ZOOM_LEVELS: ZoomLevel[] = ["day", "week", "month"];
const ZOOM_LABELS: Record<ZoomLevel, string> = { day: "Day", week: "Week", month: "Month" };

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** dhtmlx's default tree-label rendering auto-escapes task text; a custom
 * column `render`/template does not, so the wbs+name combo below (which
 * takes over rendering the "text" column) has to escape it manually. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Stacks the day number over its weekday initial (S/M/T/W/T/F/S), matching
 * the reference design's two-line day header — used only at day zoom. */
function dayScaleTemplate(date: Date): string {
  return (
    `<div class="gantt-day-scale-cell">` +
    `<span class="gantt-day-scale-num">${date.getDate()}</span>` +
    `<span class="gantt-day-scale-dow">${WEEKDAY_LETTERS[date.getDay()]}</span>` +
    `</div>`
  );
}

const SCALES: Record<ZoomLevel, ScheduleScale[]> = {
  day: [
    { unit: "month", step: 1, format: "%F %Y" },
    { unit: "day", step: 1, template: dayScaleTemplate },
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

/** Optional grid columns the user can show/hide via the "+" columns menu
 * (Gantt view only — the List view always shows every field, since it's the
 * one place that info is otherwise unavailable). Id/Task Name are never
 * toggleable: Id also houses the edit-mode row menu, Task Name is the point. */
type ColumnFieldId = "status" | "duration" | "start";
const COLUMN_FIELD_DEFS: { id: ColumnFieldId; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "duration", label: "Duration" },
  { id: "start", label: "Start Date" },
];

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

const VALID_STATUSES = new Set<ScheduleStatus>(["to_do", "in_progress", "on_hold", "completed"]);

/** Case/spacing-tolerant normalization ("On Hold", "on-hold" -> "on_hold"),
 * falling back to "to_do" for anything missing/unrecognized (e.g. an
 * Excel upload with no Status column, or a stray typo in one). */
function normalizeStatus(raw: string | undefined | null): ScheduleStatus {
  if (!raw) return "to_do";
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return VALID_STATUSES.has(key as ScheduleStatus) ? (key as ScheduleStatus) : "to_do";
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
    status: normalizeStatus(row.status),
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
    const predecessorTokens =
      predecessorRaw === undefined || predecessorRaw === "" || predecessorRaw === null
        ? []
        : parsePredecessorList(String(predecessorRaw));

    const progressRaw = item.progress;
    const progressNum =
      progressRaw === undefined || progressRaw === "" || progressRaw === null ? null : Number(progressRaw);
    const progress =
      progressNum === null || isNaN(progressNum) ? null : Math.max(0, Math.min(100, progressNum));

    const status = normalizeStatus(item.status);

    // A row with no Start Date or Duration is treated as a summary bar.
    const isSummary = !start || duration === null;
    // A row with an explicit zero Duration (and a real Start Date) is a milestone.
    const isMilestone = duration === 0 && start != null;

    return { id, name, duration, start, parentId, predecessorTokens, isSummary, isMilestone, progress, status };
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

  // --- Step 2b2: auto-complete a parent task once every one of its
  // (sub)tasks is completed — recurses so a grandparent also flips once its
  // whole subtree is done. Purely derived for display, same as progress
  // above: it re-evaluates from the underlying rows every render, so it
  // self-heals if a child is later reopened, and a manual "completed" pick
  // on a parent with incomplete children is left alone.
  const rolledUpStatus = new Map<string, ScheduleStatus>();

  function resolveRolledUpStatus(row: ParsedRow, visited = new Set<string>()): ScheduleStatus {
    if (rolledUpStatus.has(row.id)) return rolledUpStatus.get(row.id)!;
    const children = childrenByParent.get(row.id) ?? [];
    if (children.length === 0 || visited.has(row.id)) return row.status;
    visited.add(row.id);

    const allChildrenCompleted = children.every(
      (child) => resolveRolledUpStatus(child, visited) === "completed",
    );
    const status = allChildrenCompleted ? "completed" : row.status;
    rolledUpStatus.set(row.id, status);
    return status;
  }

  parsedRows.forEach((r) => resolveRolledUpStatus(r));

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
    const status = rolledUpStatus.get(row.id) ?? row.status;

    let progress =
      type === "summary" ? summaryProgress.get(row.id) ?? 0 : row.progress ?? 0;
    // To Do/Completed always display 0/100 regardless of whatever stray
    // value is stored (e.g. a status changed elsewhere, or a Completed row
    // straight off an Excel import with a stale Progress column) — kept in
    // sync display-side the same way the status rollup above is, on top of
    // the source-of-truth enforcement in handleStatusChange/the backend DTO.
    if (type !== "summary") {
      if (status === "to_do") progress = 0;
      else if (status === "completed") progress = 100;
    }

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
    row.predecessorTokens.forEach((token) => {
      const pid = token.id;
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
        type: LINK_TYPE_TO_GANTT[token.type],
        lag: token.lag,
      });
    });
  });

  return { tasks, links, warnings: Array.from(new Set(warnings)) };
}

/** Guarantees every row has a unique id before saving. Schedules authored
 * before ID-uniqueness was enforced here (e.g. an Excel import that reused
 * the same "ID" value across multiple unrelated rows — this is exactly what
 * buildGanttData's now-removed "Duplicate ID" notes used to warn about) can
 * still contain duplicates; the backend rejects the whole save outright if
 * so (`validateScheduleTasks`'s "Duplicate task ID" check).
 *
 * This used to *rename* the later duplicate to a fresh id instead of
 * blocking the save — but since every other field on that row (name, dates,
 * status, ...) was carried over unchanged, the renamed copy became a fully
 * independent task that looked identical to the original. That's exactly
 * the "my task got duplicated" bug this now fixes: every single click of
 * "Done Editing" on schedule with a pre-existing duplicate id would re-fork
 * it, even with no actual edits made. Two rows sharing an id represent the
 * same task, not two different tasks that coincidentally chose the same
 * identifier, so the later occurrence is dropped instead of spun off — any
 * children pointing at that id via parentId still resolve fine, since the
 * first (kept) occurrence has the identical id. Rows with no id at all are
 * left alone either way; the backend assigns each an id from its position
 * in the array, which is already unique per-row without any help here. */
function dedupeRowIds(rows: ScheduleRow[]): ScheduleRow[] {
  const used = new Set<string>();
  return rows.filter((row) => {
    const id = row.id.trim();
    if (!id) return true;
    if (used.has(id)) return false;
    used.add(id);
    return true;
  });
}

// ---- Component -------------------------------------------------------------

const ProjectScheduleTab: React.FC<ProjectScheduleTabProps> = ({ projectId, onScheduleUpdate }) => {
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("day");
  const [viewTab, setViewTab] = useState<ViewTab>("gantt");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  // Right-side drawer housing the Excel-format instructions + the actual
  // upload control — opened from the toolbar's "Upload Excel Sheet" button
  // instead of that button triggering a file picker directly.
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  // Gantt-view-only column visibility — starts empty so only Id/Task Name
  // show by default, matching ClickUp/GanttPro's minimal default grid. The
  // "+" button lives in the grid's own header row (see the "columnsMenuBtn"
  // column below + GanttChartView's onGridHeaderClick), so the popover is
  // fixed-positioned off that button's rect rather than inline in the toolbar.
  // Status starts visible (it always was, before it became toggleable) —
  // Duration/Start still start hidden, unchanged.
  const [visibleFields, setVisibleFields] = useState<Set<ColumnFieldId>>(new Set(["status"]));
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [columnsMenuAnchor, setColumnsMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement>(null);
  // Double-click-a-dependency-arrow popover (type + lag + delete) — anchored
  // to the click position the same way the columns menu is anchored to its
  // trigger button's rect. Replaces the old window.confirm-to-delete flow.
  const [linkEditor, setLinkEditor] = useState<{
    linkId: string;
    sourceId: string;
    targetId: string;
    type: ScheduleLinkType;
    lag: number;
    top: number;
    left: number;
  } | null>(null);
  const linkEditorRef = useRef<HTMLDivElement>(null);
  // The chart's own horizontal-scroll container — mirrored by
  // StickyHorizontalScrollbar so its scrollbar stays reachable at the
  // bottom of the viewport instead of requiring the whole page scrolled down.
  const chartScrollRef = useRef<HTMLDivElement>(null);
  // Master edit switch for the chart itself — off by default so the Gantt is
  // read-only until "Edit Schedule" is clicked. Inline text editing,
  // drag-to-link, and drag-resize on the chart all key off this.
  const [editMode, setEditMode] = useState(false);
  // Task id awaiting delete confirmation (via ConfirmationModal, see below)
  // — set by the row menu's "Delete task" click, cleared on cancel/confirm.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // True while confirmDeleteTask's real backend delete is in flight — drives
  // ConfirmationModal's isLoading spinner (delete is no longer purely local).
  const [deletingTask, setDeletingTask] = useState(false);
  // Bulk-select mode (toggled via the toolbar's checkbox-icon button, left of
  // the Gantt/List switcher) — while on, every row gets a checkbox (see the
  // "selectCheckbox" column below) and a selection bar with a bulk-delete
  // action appears above the chart. Off by default; turning it off clears
  // whatever was selected, same as a "Cancel" would.
  const [selectMode, setSelectMode] = useState(false);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Every row with children starts open (see buildGanttData's `open:
  // hasChildren`), so "all expanded" is the true default — this just tracks
  // which state the toggle button should switch to next, it isn't itself
  // the source of truth for any individual row's open/closed state.
  const [allExpanded, setAllExpanded] = useState(true);
  const handleToggleExpandAll = useCallback(() => {
    const next = !allExpanded;
    gantt.eachTask((task: { id: string | number }) => {
      if (next) gantt.open(task.id);
      else gantt.close(task.id);
    });
    gantt.render();
    setAllExpanded(next);
  }, [allExpanded]);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [backendError, setBackendError] = useState<string | null>(null);

  // Load whatever was last saved for this project.
  const scheduleQuery = useScheduleQuery(projectId);
  const loadingInitial = scheduleQuery.isLoading;
  const saveScheduleMutation = useSaveScheduleMutation(projectId);

  useEffect(() => {
    if (scheduleQuery.data && scheduleQuery.data.tasks.length > 0) {
      setScheduleRows(dtoToRows(scheduleQuery.data));
    }
  }, [scheduleQuery.data]);

  // Columns menu dismisses on outside click, scroll, or Escape — same as the
  // Gantt row-options menu (openRowMenu in GanttChartView), since this is
  // also fixed-positioned off a button embedded in gantt's own DOM rather
  // than inline in React's normal layout flow. The "+" button's own clicks
  // are excluded here so re-clicking it (see handleGridHeaderClick) isn't
  // immediately undone by this handler closing the menu first.
  useEffect(() => {
    if (!showColumnsMenu) return;
    const close = () => setShowColumnsMenu(false);
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        columnsMenuRef.current &&
        !columnsMenuRef.current.contains(target) &&
        !target.closest(".gantt-columns-menu-btn")
      ) {
        close();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("scroll", close, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showColumnsMenu]);

  // Same dismiss-on-outside-click/scroll/Escape behavior as the columns menu.
  useEffect(() => {
    if (!linkEditor) return;
    const close = () => setLinkEditor(null);
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (linkEditorRef.current && !linkEditorRef.current.contains(target)) {
        close();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("scroll", close, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [linkEditor]);

  const toggleField = useCallback((id: ColumnFieldId) => {
    setVisibleFields((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Fired when any grid header cell is clicked (see GanttChartView's
  // onGridHeaderClick) — only the "columnsMenuBtn" column's embedded button
  // (see the `columns` memo below) is handled here.
  const handleGridHeaderClick = useCallback((_columnId: string, target: HTMLElement) => {
    // Deliberately ignore dhtmlx's own `_columnId` argument — it's read via
    // `event.target.getAttribute("data-column-id")` internally, which only
    // has a value when the click lands directly on the header cell <div>.
    // Since the "+" is a nested <button> inside that div, clicking the
    // button itself (not just the cell's padding around it) makes
    // event.target the button — which has no such attribute — so dhtmlx
    // reports a null columnId even though this is exactly the right click.
    // Resolve the button from the DOM ourselves instead, which works
    // regardless of which element inside it was actually hit.
    const btn = target.closest<HTMLElement>(".gantt-columns-menu-btn");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setShowColumnsMenu((s) => !s);
    setColumnsMenuAnchor({ top: rect.bottom + 4, left: Math.max(8, rect.right - 208) });
  }, []);

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
  const { tasks: ganttTasks, links: ganttLinks } = useMemo(
    () => buildGanttData(scheduleRows as NormalizedRow[]),
    [scheduleRows],
  );

  // Summary rows always stay visible (so the hierarchy stays navigable);
  // the status filter only hides non-matching leaf tasks/milestones.
  const visibleTasks = useMemo(() => {
    if (statusFilter === "all") return ganttTasks;
    return ganttTasks.filter((t) => t.type === "summary" || t.status === statusFilter);
  }, [ganttTasks, statusFilter]);

  const rowSelection = useRowSelection<string>(useMemo(() => visibleTasks.map((t) => t.id), [visibleTasks]));

  // `width` here is a relative weight, not a pixel value — GanttChartView
  // scales these proportionally to fill the 25%-of-container grid area it
  // reserves for the table (the remaining 75% is the chart).
  const columns: ScheduleColumnDef[] = useMemo(
    () => [
      // Bulk-select checkbox — only present while selectMode is on (toggled
      // via the toolbar's checkbox-icon button). Has to be its own leading
      // column rather than folded into the "text" tree column below, since
      // dhtmlx only supports one `tree: true` column and renders its own
      // indent/expand-arrow inside it. Checked state is recomputed from
      // rowSelection.selected on every render; toggling posts a "change"
      // event picked up via document-level delegation in GanttChartView
      // (see onSelectToggle there), same pattern as the status/progress cells.
      // onmousedown stops propagation so dhtmlx's own row drag-to-reorder
      // (order_branch, active while editMode is on — see the "Row
      // drag-to-reorder" config below) never sees the mousedown: dhtmlx
      // treats *any* mousedown+slight pointer movement anywhere in a grid
      // row as "start dragging this row" since it has no concept of our
      // raw-HTML checkbox as a distinct control, which was visibly yanking
      // the clicked task's bar up/down in the timeline on every checkbox click.
      ...(selectMode
        ? [
            {
              id: "selectCheckbox",
              header: "",
              width: 34,
              fixedWidth: true,
              align: "center" as const,
              render: (t: GanttTask) =>
                `<input type="checkbox" class="gantt-select-checkbox" data-row-id="${t.id}"${
                  rowSelection.selected.has(t.id) ? " checked" : ""
                } onmousedown="event.stopPropagation()" />`,
            },
          ]
        : []),
      // The id (e.g. "1", "1.1") is shown inline as a prefix inside this same
      // column instead of a separate "Id" column — dhtmlx renders the tree
      // indent/expand-arrow first, then this template as the cell's content,
      // so the id+name pair always lands right after those. An always-visible
      // "+" (adds a new sibling task directly below this row — see
      // handleAddTaskBelow, wired up in GanttChartView's onTaskClick via the
      // "gantt-row-add-btn" class) is pinned to the actual right edge of this
      // column's grid cell via `position: absolute` (see the CSS in
      // GanttChartView) — a flex/width:100% wrapper doesn't work here since
      // dhtmlx's own .gantt_tree_content wrapper around this render() output
      // is shrink-to-fit (width: auto), not full-width, so anything
      // "right-aligned" inside it would just hug the end of the text instead
      // of the column's actual edge. The per-row "..." row-options trigger
      // stays in the trailing "columnsMenuBtn" column (see below), matching
      // the reference layout's own trailing actions column.
      {
        id: "text",
        header: "Task Name",
        width: 400,
        tree: true,
        align: "left",
        render: (t) => {
          const isSubtask = t.wbs.includes(".");
          const label = `<span class="gantt-wbs-label${isSubtask ? " gantt-wbs-label-sub" : ""}">${escapeHtml(t.wbs)}</span><span class="gantt-task-text">${escapeHtml(t.text)}</span>`;
          const addBtn = editMode
            ? `<button type="button" class="gantt-row-add-btn" data-row-add-id="${t.id}" title="Add task below">+</button>`
            : "";
          return `${label}${addBtn}`;
        },
      },
      // Shown by default, same as before, but now toggleable via the "+"
      // show/hide-fields menu like Duration/Start — a read-only colored pill
      // outside edit mode, an actual <select> (same pill styling, via the
      // "gantt-status-select" class) while editing so the status can be
      // changed inline. The <select>'s change event is picked up via
      // document-level delegation in GanttChartView, since this is raw HTML
      // outside React's tree — see onStatusChange there.
      ...(viewTab === "list" || visibleFields.has("status")
        ? [
            {
              id: "status",
              header: "Status",
              width: 170,
              align: "center" as const,
              render: (t: GanttTask) => {
                const meta = STATUS_META[t.status];
                if (!editMode) {
                  return `<span class="gantt-status-text" style="color:${meta.pillText}">${meta.label}</span>`;
                }
                const options = (Object.keys(STATUS_META) as ScheduleStatus[])
                  .map(
                    (key) =>
                      `<option value="${key}"${key === t.status ? " selected" : ""}>${STATUS_META[key].label}</option>`,
                  )
                  .join("");
                return `<select class="gantt-status-select" data-row-id="${t.id}" style="color:${meta.pillText}">${options}</select>`;
              },
            },
          ]
        : []),
      // Always visible, same as Status. A bar+percent readout outside edit
      // mode; while editing, an editable number input for every status
      // except On Hold, which freezes it (see handleStatusChange/
      // handleProgressChange below for the full two-way sync between this
      // field and Status). Summary rows are always disabled too, since their
      // percent is a rollup average of children, not a value of their own.
      // Committed via document-level delegation in GanttChartView (see
      // onProgressChange there), same as Status.
      {
        id: "progress",
        header: "Progress",
        width: 120,
        align: "center" as const,
        render: (t) => {
          // t.progress here is dhtmlx's own 0-1 bar-fill fraction, not our
          // percent value — progressPercent is the non-colliding field
          // GanttChartView adds alongside it specifically for this render.
          const value = Math.max(0, Math.min(100, Math.round(t.progressPercent ?? 0)));
          if (!editMode) {
            return `<span class="gantt-progress-value">${value}%</span>`;
          }
          const canEdit = !t.isSummaryRow && t.status !== "on_hold";
          return `<input type="number" min="0" max="100" class="gantt-progress-input" data-row-id="${t.id}" value="${value}"${canEdit ? "" : " disabled"} />`;
        },
      },
      // The List view always shows every field — it's the one place that
      // info is otherwise unavailable. The Gantt view instead defaults to
      // just Id/Task Name and lets the user opt fields back in via the "+"
      // columns menu (visibleFields), since Duration/Start are largely
      // redundant with the chart's own bars there.
      ...(viewTab === "list" || visibleFields.has("duration")
        ? [{ id: "durationLabel", header: "Duration", width: 90, align: "center" as const }]
        : []),
      ...(viewTab === "list" || visibleFields.has("start")
        ? [{ id: "startLabel", header: "Start", width: 84, align: "center" as const }]
        : []),
      // Trailing column (Gantt view only) — the header embeds a plain "+"
      // button (raw HTML; dhtmlx renders column labels unescaped) that opens
      // the show/hide-fields popover (see handleGridHeaderClick), and each
      // row's body cell (edit mode only) embeds a "..." that opens the
      // row-options menu (Add subtask / Duplicate / Delete task) — wired up
      // via the "gantt-row-menu-btn" class + openRowMenu. The "add task
      // below" trigger lives in the Task Name column instead (see above),
      // not here.
      ...(viewTab === "gantt"
        ? [
            {
              id: "columnsMenuBtn",
              header: '<button type="button" class="gantt-columns-menu-btn" title="Show/hide columns">+</button>',
              width: 40,
              fixedWidth: true,
              align: "center" as const,
              render: (t: GanttTask) =>
                editMode
                  ? `<button type="button" class="gantt-row-menu-btn" data-row-menu-id="${t.id}" title="Task options">&#8230;</button>`
                  : "",
            },
          ]
        : []),
    ],
    [editMode, viewTab, visibleFields, selectMode, rowSelection.selected],
  );

  const scales = useMemo(() => SCALES[zoomLevel], [zoomLevel]);

  // Drag-created dependency arrows (the connector dots on a bar's edges) fold
  // straight into the dependent row's `predecessorId` — the same field the
  // modal's "Predecessor ID" column and Excel's "Predecessor ID" column
  // already feed, so `buildGanttData` treats them identically. This only
  // updates local state; it's saved to the backend the same way any other
  // edit is, via the existing "Save to Backend" button.
  const handleLinkCreate = useCallback((sourceId: string, targetId: string, ganttType: GanttLink["type"]) => {
    setScheduleRows((rows) => {
      const next = rows.map((row) => {
        if (row.id !== targetId || sourceId === targetId) return row;
        const existing = parsePredecessorList(row.predecessorId);
        if (existing.some((t) => t.id === sourceId)) return row;
        const nextTokens = [...existing, { id: sourceId, type: GANTT_TYPE_TO_LINK_TYPE[ganttType], lag: 0 }];
        return { ...row, predecessorId: nextTokens.map(formatPredecessorToken).join(",") };
      });
      // MS-Project-style auto-scheduling: a fresh dependency immediately
      // snaps the new successor (and anything downstream of it) into place
      // relative to its predecessor, same as creating a link in MS Project.
      return recalcAfterLinkEdit(next, targetId);
    });
  }, []);

  const handleLinkDelete = useCallback((sourceId: string, targetId: string) => {
    setScheduleRows((rows) =>
      rows.map((row) => {
        if (row.id !== targetId) return row;
        const existing = parsePredecessorList(row.predecessorId);
        return { ...row, predecessorId: existing.filter((t) => t.id !== sourceId).map(formatPredecessorToken).join(",") };
      }),
    );
  }, []);

  /** Patches an existing dependency's type/lag (from the double-click edit popover — see linkEditor state below). */
  const handleLinkUpdate = useCallback((sourceId: string, targetId: string, patch: { type?: ScheduleLinkType; lag?: number }) => {
    setScheduleRows((rows) => {
      const next = rows.map((row) => {
        if (row.id !== targetId) return row;
        const existing = parsePredecessorList(row.predecessorId);
        const nextTokens = existing.map((t) => (t.id === sourceId ? { ...t, ...patch } : t));
        return { ...row, predecessorId: nextTokens.map(formatPredecessorToken).join(",") };
      });
      // Changing a dependency's type or lag re-anchors the successor exactly
      // the same way creating the link did.
      return recalcAfterLinkEdit(next, targetId);
    });
  }, []);

  /** Opens the type/lag/delete popover for a double-clicked dependency arrow. */
  const handleLinkEditRequest = useCallback((info: LinkEditInfo) => {
    setLinkEditor({
      linkId: info.linkId,
      sourceId: info.sourceId,
      targetId: info.targetId,
      type: GANTT_TYPE_TO_LINK_TYPE[info.type],
      lag: info.lag,
      top: info.top,
      left: info.left,
    });
  }, []);

  // Inline task-name edits and drag-resizes on the chart both report back
  // here — folded into scheduleRows the same way link create/delete are.
  // Nothing is sent to the backend until "Save to Backend" is clicked.
  const handleTaskChange = useCallback(
    (id: string, changes: { text?: string; start?: Date; duration?: number }) => {
      setScheduleRows((rows) => {
        const next = rows.map((row) => {
          if (row.id !== id) return row;
          const updated = { ...row };
          if (changes.text !== undefined) updated.taskName = changes.text;
          if (changes.start !== undefined) updated.startDate = formatDateInput(changes.start);
          if (changes.duration !== undefined) updated.duration = String(changes.duration);
          return updated;
        });
        // Dragging a bar (move or resize) shifts its dates directly above —
        // MS-Project-style auto-scheduling then cascades that change to
        // whatever else depends on it (see scheduleAutoSchedule.ts). Also
        // runs after a plain rename, since dhtmlx reports the task's full
        // current record on every update either way; harmless no-op there
        // since the dates it "changed to" are the ones it already had.
        return changes.start !== undefined || changes.duration !== undefined
          ? recalcAfterTaskEdit(next, id)
          : next;
      });
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
      // "temp-" prefixed (same convention TaskController.ts already uses for
      // unsaved subtasks) so a brand-new row's id can never collide with a
      // real Task.id once schedule rows are loaded from the backend — see
      // schedule.service.ts's saveSchedule, which treats any id that doesn't
      // resolve to an existing Task as a new row to create.
      let newId = `temp-${n}`;
      while (existingIds.has(newId)) newId = `temp-${++n}`;

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
      let newId = `temp-${n}`;
      while (existingIds.has(newId)) newId = `temp-${++n}`;

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

  // Adds a new sibling task immediately below the row whose hover "+" was
  // clicked (same parentId as that row, so it lands at the same nesting
  // level) — inserted right after the anchor row's own subtree (all of its
  // descendants, if any) rather than in the middle of them, same
  // insert-after-subtree approach as handleDuplicateTask below.
  const handleAddTaskBelow = useCallback((anchorId: string) => {
    setScheduleRows((rows) => {
      const existingIds = new Set(rows.map((r) => r.id));
      let n = rows.length + 1;
      let newId = `temp-${n}`;
      while (existingIds.has(newId)) newId = `temp-${++n}`;

      const anchorRow = rows.find((r) => r.id === anchorId);
      const { tasks } = buildGanttData(rows as NormalizedRow[]);
      const anchorTask = tasks.find((t) => t.id === anchorId);

      const newRow: ScheduleRow = {
        ...emptyScheduleRow(),
        id: newId,
        parentId: anchorRow?.parentId ?? "",
        taskName: "New Task",
        duration: "1",
        startDate: formatDateInput(anchorTask?.end ?? new Date()),
      };

      const idsInSubtree = new Set<string>([anchorId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of rows) {
          if (row.parentId && idsInSubtree.has(row.parentId) && !idsInSubtree.has(row.id)) {
            idsInSubtree.add(row.id);
            changed = true;
          }
        }
      }
      const lastIndexInSubtree = rows.reduce(
        (max, row, i) => (idsInSubtree.has(row.id) ? i : max),
        -1,
      );
      const next = [...rows];
      next.splice(lastIndexInSubtree + 1, 0, newRow);
      return next;
    });
  }, []);

  // Deletes a task row and cascades to every descendant under it (a summary
  // row can't be left with orphaned children pointing at a parentId that no
  // longer exists). Confirmed via a ConfirmationModal (see pendingDeleteId
  // below) before this fires — GanttChartView's row menu calls straight
  // through without its own confirmation. Since Schedule and Task tabs now
  // share the same Task rows (see schedule.service.ts), this is a REAL,
  // immediate backend delete — not deferred to the next "Done Editing" save
  // the way it used to be, since a task can carry real comments/subtasks/
  // assignees that shouldn't be destroyed as a side effect of some later,
  // unrelated save. A "temp-…" row was never persisted, so only rows with a
  // real numeric id hit the backend; everything is still removed from local
  // state either way for immediate feedback.
  const handleDeleteTask = useCallback(
    async (id: string) => {
      const idsToRemove = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of scheduleRows) {
          if (row.parentId && idsToRemove.has(row.parentId) && !idsToRemove.has(row.id)) {
            idsToRemove.add(row.id);
            changed = true;
          }
        }
      }

      const realId = Number(id);
      if (Number.isInteger(realId)) {
        await deleteTask(realId);
      }

      setScheduleRows((rows) => rows.filter((row) => !idsToRemove.has(row.id)));
    },
    [scheduleRows],
  );

  // Confirms the delete requested via the row menu (pendingDeleteId, set by
  // onDeleteTask={setPendingDeleteId} on GanttChartView below).
  const confirmDeleteTask = useCallback(async () => {
    if (!pendingDeleteId) return;
    setDeletingTask(true);
    setBackendError(null);
    try {
      await handleDeleteTask(pendingDeleteId);
      setPendingDeleteId(null);
      onScheduleUpdate?.();
    } catch (err) {
      setBackendError(getErrorMessage(err, "Failed to delete task."));
    } finally {
      setDeletingTask(false);
    }
  }, [pendingDeleteId, handleDeleteTask, onScheduleUpdate]);

  // Bulk delete for the checkbox-select toolbar (see selectMode/rowSelection
  // above) — unions each selected row's own descendant cascade (same logic
  // as handleDeleteTask, but computed once across every selected id rather
  // than looping handleDeleteTask, which would redo the cascade scan against
  // an increasingly stale `scheduleRows` closure on each iteration), then
  // fires one deleteTask call per real (non-"temp-") id in parallel.
  const confirmBulkDeleteTasks = useCallback(async () => {
    if (rowSelection.selectedIds.length === 0) return;
    setBulkDeleting(true);
    setBackendError(null);
    try {
      const idsToRemove = new Set<string>(rowSelection.selectedIds);
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of scheduleRows) {
          if (row.parentId && idsToRemove.has(row.parentId) && !idsToRemove.has(row.id)) {
            idsToRemove.add(row.id);
            changed = true;
          }
        }
      }

      const realIds = Array.from(idsToRemove)
        .map((rid) => Number(rid))
        .filter((n) => Number.isInteger(n));
      await Promise.all(realIds.map((n) => deleteTask(n)));

      setScheduleRows((rows) => rows.filter((row) => !idsToRemove.has(row.id)));
      rowSelection.clear();
      setPendingBulkDelete(false);
      onScheduleUpdate?.();
    } catch (err) {
      setBackendError(getErrorMessage(err, "Failed to delete selected tasks."));
    } finally {
      setBulkDeleting(false);
    }
  }, [rowSelection, scheduleRows, onScheduleUpdate]);

  // Fired when the status <select> in the "status" column is changed (see
  // GanttChartView's onStatusChange) — folded into scheduleRows the same way
  // inline task-name edits and drag-resizes are. Nothing is sent to the
  // backend until "Done Editing" auto-saves.
  //
  // Progress is kept in sync with the new status: To Do always resets to
  // 0, Completed always jumps to 100. In Progress leaves the existing value
  // alone (it's already freely editable). On Hold also leaves it alone, but
  // additionally freezes the Progress column (disabled, see the `columns`
  // memo above) until status moves off On Hold again.
  const handleStatusChange = useCallback((id: string, status: string) => {
    setScheduleRows((rows) =>
      rows.map((row) => {
        if (row.id !== id) return row;
        if (status === "to_do") return { ...row, status, progress: "0" };
        if (status === "completed") return { ...row, status, progress: "100" };
        return { ...row, status };
      }),
    );
  }, []);

  // Fired when the progress <input> in the "progress" column is changed (see
  // GanttChartView's onProgressChange) — editable for every status except On
  // Hold (frozen, see the `columns` memo above). The reverse of
  // handleStatusChange above: here Progress drives Status instead, so
  // dragging progress down to 0 or up to 100 (or anywhere between) keeps the
  // Status column in sync automatically, without needing to touch it by hand.
  const handleProgressChange = useCallback((id: string, progress: number) => {
    setScheduleRows((rows) =>
      rows.map((row) => {
        if (row.id !== id) return row;
        const status = progress <= 0 ? "to_do" : progress >= 100 ? "completed" : "in_progress";
        return { ...row, progress: String(progress), status };
      }),
    );
  }, []);

  // Duplicates a task/subtask row and every descendant beneath it, giving
  // each a fresh unique id (remapped so the cloned subtree's parentId chain
  // points at the new ids, not the originals) and inserting the copies
  // directly after the original subtree in the array. Dependency links
  // aren't copied over — a predecessor link on the clone would otherwise
  // silently point back at either the original or its own copy, which is
  // rarely what's wanted; the user can re-draw one if needed.
  const handleDuplicateTask = useCallback((id: string) => {
    setScheduleRows((rows) => {
      const existingIds = new Set(rows.map((r) => r.id));
      let n = existingIds.size + 1;
      const nextId = () => {
        let candidate = `temp-${n}`;
        while (existingIds.has(candidate)) candidate = `temp-${++n}`;
        existingIds.add(candidate);
        n++;
        return candidate;
      };

      // Collect the task and all of its descendants, at any depth.
      const idsToDuplicate = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of rows) {
          if (row.parentId && idsToDuplicate.has(row.parentId) && !idsToDuplicate.has(row.id)) {
            idsToDuplicate.add(row.id);
            changed = true;
          }
        }
      }

      const rowsToClone = rows.filter((r) => idsToDuplicate.has(r.id));
      const idMap = new Map<string, string>();
      rowsToClone.forEach((r) => idMap.set(r.id, nextId()));

      const clones: ScheduleRow[] = rowsToClone.map((r) => ({
        ...r,
        id: idMap.get(r.id)!,
        taskName: r.id === id ? `${r.taskName} (Copy)` : r.taskName,
        parentId: r.parentId && idMap.has(r.parentId) ? idMap.get(r.parentId)! : r.parentId,
        predecessorId: "",
      }));

      const lastOriginalIndex = Math.max(...rowsToClone.map((r) => rows.indexOf(r)));
      const next = [...rows];
      next.splice(lastOriginalIndex + 1, 0, ...clones);
      return next;
    });
  }, []);

  // Dragging a row up/down in the "Task Name" column reorders it among its
  // siblings, or (dropped onto a different summary task) re-parents it — see
  // GanttChartView's order_branch/order_branch_free + onRowDragEnd. gantt
  // reports back every task's id + current parent id in its new top-to-bottom
  // order; scheduleRows is rebuilt to match, since array order + parentId are
  // what buildGanttData/WBS numbering derive positions and hierarchy from.
  // Any row gantt didn't report back (e.g. hidden by the status filter) keeps
  // its relative place and parentId, appended after the reordered ones, so
  // nothing is silently dropped.
  const handleReorder = useCallback((order: { id: string; parentId: string | null }[]) => {
    setScheduleRows((rows) => {
      const byId = new Map(rows.map((r) => [r.id, r]));
      const reordered = order
        .map(({ id, parentId }) => {
          const row = byId.get(id);
          if (!row) return null;
          const nextParentId = parentId ?? "";
          return row.parentId === nextParentId ? row : { ...row, parentId: nextParentId };
        })
        .filter((r): r is ScheduleRow => r != null);
      const reorderedIds = new Set(order.map((o) => o.id));
      const remaining = rows.filter((r) => !reorderedIds.has(r.id));
      return [...reordered, ...remaining];
    });
  }, []);

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
        const saved = await saveScheduleMutation.mutateAsync(rowsToDto(dedupeRowIds(rows)));
        setScheduleRows(dtoToRows(saved));
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2500);
        onScheduleUpdate?.();
      } catch (err) {
        const message = getErrorMessage(err, "Failed to save the schedule.");
        setBackendError(message);
        setSaveStatus("error");
        throw new Error(message);
      }
    },
    [projectId, saveScheduleMutation, onScheduleUpdate],
  );

  // "Edit Schedule" just flips the local edit-mode switch; "Done Editing"
  // additionally persists whatever changed while editing, so there's no
  // separate save step to remember. Save status still surfaces via the
  // backendError banner below and the button's own label (see saveStatus).
  const handleToggleEditMode = useCallback(() => {
    setEditMode((m) => {
      const next = !m;
      if (!next) {
        persistSchedule(scheduleRows).catch(() => {});
      }
      return next;
    });
  }, [persistSchedule, scheduleRows]);

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
        // This only replaces the local working view, not anything server-side
        // — saveSchedule (see schedule.service.ts) never deletes a task just
        // for being absent from a save's payload. Since an uploaded sheet's
        // own ID column essentially never matches a real Task.id, every
        // uploaded row is treated as brand-new on the next save rather than
        // updating an existing task, so a re-upload effectively ADDS these as
        // new tasks — any tasks not in the sheet stay exactly as they are in
        // the database (with all their comments/attachments/assignees
        // intact), just not visible in this Gantt view again until the tab
        // is reloaded and re-fetches the full task list.
        setScheduleRows(normalizedRowsToScheduleRows(normalized));
        setShowUploadDrawer(false);
      } catch (err) {
        console.error("Error parsing Excel file:", err);
        setUploadError("Failed to parse the file. Please make sure it's a valid .xlsx/.csv with the expected columns.");
      }
    };

    reader.onerror = () => setUploadError("Could not read the selected file.");

    reader.readAsArrayBuffer(file);
  };

  const handleExportCsv = () => {
    const sheetRows = ganttTasks.map((t) => ({
      "#": t.wbs,
      "Task Name": t.text,
      Status: STATUS_META[t.status].label,
      Duration: t.durationLabel,
      Start: t.startLabel,
    }));
    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Schedule");
    XLSX.writeFile(workbook, `schedule-${projectId}.xlsx`);
  };

  return (
    <div className="-mt-3 space-y-6">
      {/* Dims the rest of the page while editing, so the (still-crisp, since
          it sits above this overlay in z-index) chart reads as the one thing
          that's currently interactive. pointer-events-none so it's purely
          visual — nothing underneath loses clickability. Portaled to
          document.body rather than rendered inline: this component's root is
          a `space-y-6` flex column, and Tailwind's space-y margin applies to
          any child with a preceding sibling regardless of that sibling's
          `position` — so mounting/unmounting this fixed overlay as the first
          child was adding/removing a spurious margin-top on the content
          below it, visible as the chart jumping down on entering edit mode. */}
      {editMode &&
        createPortal(
          <div className="fixed inset-0 z-30 bg-slate-900/10 pointer-events-none transition-opacity duration-200" />,
          document.body,
        )}
      <div>
          {/* Toolbar — a single flat row of minimal, icon+text controls
              (borderless, hover background) matching the reference design's
              clean, airy toolbar instead of the previous two boxed rows. */}
          <div className="flex flex-wrap gap-1 justify-between items-center pb-2 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-0.5">
              <button
                type="button"
                onClick={() => {
                  setSelectMode((prev) => {
                    if (prev) rowSelection.clear();
                    return !prev;
                  });
                }}
                title={selectMode ? "Exit select mode" : "Select tasks"}
                className={`flex items-center justify-center w-7 h-7 mr-1 rounded-md transition-colors ${
                  selectMode ? "bg-blue-900 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <SquareCheckBig className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleToggleExpandAll}
                title={allExpanded ? "Collapse all" : "Expand all"}
                className="flex items-center justify-center w-7 h-7 mr-1 rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
              >
                {allExpanded ? (
                  <FoldVertical className="w-3.5 h-3.5" />
                ) : (
                  <UnfoldVertical className="w-3.5 h-3.5" />
                )}
              </button>

              <div className="flex items-center gap-0.5 p-0.5 mr-1 bg-slate-100 rounded-md">
                <ViewTabButton icon={<LayoutGrid className="w-3 h-3" />} label="Gantt" active={viewTab === "gantt"} onClick={() => setViewTab("gantt")} />
                <ViewTabButton icon={<Rows3 className="w-3 h-3" />} label="List" active={viewTab === "list"} onClick={() => setViewTab("list")} />
              </div>

              <div className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] font-medium text-slate-600 rounded-md hover:bg-slate-100">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="bg-transparent focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  {(Object.keys(STATUS_META) as ScheduleStatus[]).map((key) => (
                    <option key={key} value={key}>{STATUS_META[key].label}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowUploadDrawer(true)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] font-medium text-slate-600 rounded-md hover:bg-slate-100 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Excel Sheet
              </button>

              {viewTab === "gantt" && <ZoomSlider level={zoomLevel} onChange={setZoomLevel} />}
            </div>

            <div className="flex flex-wrap items-center gap-0.5">
              {fileName && <span className="text-[11px] text-slate-400 truncate max-w-[160px] mr-1">{fileName}</span>}

              <ToolbarButton icon={<Download className="w-3.5 h-3.5" />} label="Export" onClick={handleExportCsv} />

              {/* Always mounted (visibility toggled via `invisible` rather than
                  conditional rendering) so this button's slot in the flex-wrap
                  toolbar never appears/disappears — doing so would change the
                  row's total content width and could flip whether it wraps to
                  a second line, shifting the chart below it up/down. */}
              <button
                onClick={handleAddTask}
                tabIndex={editMode ? 0 : -1}
                aria-hidden={!editMode}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-md hover:bg-blue-800 ${
                  editMode ? "" : "invisible"
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Task
              </button>

              <button
                onClick={handleToggleEditMode}
                disabled={saveStatus === "saving"}
                className={`flex items-center justify-center gap-1.5 ml-0.5 px-2.5 py-1.5 min-w-[128px] text-[12px] font-medium rounded-md transition-colors disabled:opacity-60 ${
                  editMode
                    ? "text-white bg-blue-900 hover:bg-blue-800"
                    : "text-white bg-slate-800 hover:bg-slate-900"
                }`}
              >
                {saveStatus === "saving" ? (
                  <>
                    <CloudUpload className="w-3 h-3 animate-pulse" />
                    Saving...
                  </>
                ) : !editMode && saveStatus === "saved" ? (
                  <>
                    <Check className="w-3 h-3" />
                    Saved
                  </>
                ) : (
                  <>
                    <Pencil className="w-3 h-3" />
                    {editMode ? "Done Editing" : "Edit Schedule"}
                  </>
                )}
              </button>
            </div>
          </div>

          {backendError && (
            <div className="flex gap-2 items-start p-3 mt-3 text-xs text-rose-700 bg-rose-50 rounded border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{backendError}</span>
            </div>
          )}

          {loadingInitial && scheduleRows.length === 0 && (
            <div className="flex items-center gap-2 py-10 justify-center text-slate-400 text-[12px]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading schedule…
            </div>
          )}

          {selectMode && rowSelection.someSelected && (
            <div className="flex items-center justify-between px-3 py-2 mt-2 text-[12.5px] bg-blue-50 border border-blue-200 rounded-md text-blue-900">
              <span className="font-medium">{rowSelection.selectedIds.length} selected</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPendingBulkDelete(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-white bg-red-600 rounded hover:bg-red-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected
                </button>
                <button
                  type="button"
                  onClick={rowSelection.clear}
                  title="Clear selection"
                  className="p-1 rounded text-blue-700 hover:bg-blue-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* -mx-6 cancels the page's own p-6 gutter (see ProjectDetails.tsx,
              shared by every tab) so the chart genuinely spans the full
              content width instead of sitting inset within it. Scoped to
              just this card, not the whole tab, so the toolbar above stays
              normally aligned with the rest of the page.
              Only horizontal overflow is handled here — vertical scrolling
              happens *inside* GanttChartView itself (a fixed/content-aware
              height there, not this wrapper) so the grid/date-scale header
              rows stay fixed in place while the rows beneath scroll, instead
              of scrolling away along with everything else. */}
          <div className="bg-white border-y border-slate-200 -mx-6">
            <div
              ref={chartScrollRef}
              className={`overflow-x-auto no-scrollbar ${editMode ? "relative z-40" : ""}`}
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
                  onLinkEdit={handleLinkEditRequest}
                  onTaskChange={handleTaskChange}
                  onAddChildTask={handleAddChildTask}
                  onAddTaskBelow={handleAddTaskBelow}
                  onDeleteTask={setPendingDeleteId}
                  onDuplicateTask={handleDuplicateTask}
                  onStatusChange={handleStatusChange}
                  onProgressChange={handleProgressChange}
                  onSelectToggle={rowSelection.toggle}
                  onReorder={handleReorder}
                  onGridHeaderClick={handleGridHeaderClick}
                />
              </div>
            </div>
          </div>
          {viewTab === "gantt" && <StickyHorizontalScrollbar targetRef={chartScrollRef} />}

          {/* Show/hide-fields popover — anchored to the "+" button embedded
              in the grid's own header row (see handleGridHeaderClick), so
              it's fixed-positioned off that button's rect rather than
              inline in the toolbar's normal layout flow. */}
          {showColumnsMenu && columnsMenuAnchor && (
            <div
              ref={columnsMenuRef}
              style={{ position: "fixed", top: columnsMenuAnchor.top, left: columnsMenuAnchor.left }}
              className="z-50 p-1 bg-white border rounded-lg shadow-lg w-64 border-slate-200"
            >
              <div className="px-2 py-1.5 text-[11px] font-semibold tracking-wide uppercase text-slate-400">
                Show fields
              </div>
              {COLUMN_FIELD_DEFS.map((field) => (
                <button
                  type="button"
                  key={field.id}
                  onClick={() => toggleField(field.id)}
                  className="flex items-center justify-between w-full px-2 py-1.5 rounded cursor-pointer hover:bg-slate-50"
                >
                  <span className="text-[13px] text-slate-700">{field.label}</span>
                  <ToggleSwitch checked={visibleFields.has(field.id)} />
                </button>
              ))}
            </div>
          )}

          {/* Dependency edit popover — anchored to wherever the user
              double-clicked the link arrow (see GanttChartView's
              onLinkDblClick -> onLinkEdit). Same fixed-position/dismiss
              pattern as the columns menu above. */}
          {linkEditor && (
            <div
              ref={linkEditorRef}
              style={{ position: "fixed", top: linkEditor.top, left: linkEditor.left }}
              className="z-50 p-3 bg-white border rounded-lg shadow-lg w-64 border-slate-200"
            >
              <div className="px-1 py-1 text-[11px] font-semibold tracking-wide uppercase text-slate-400">
                Dependency
              </div>
              <div className="px-1 pb-2 text-[12px] text-slate-600">
                Task {linkEditor.sourceId} → Task {linkEditor.targetId}
              </div>
              <div className="px-1 py-1.5">
                <label className="block mb-1 text-[11px] font-medium text-slate-700">Type</label>
                <select
                  value={linkEditor.type}
                  onChange={(e) => setLinkEditor({ ...linkEditor, type: e.target.value as ScheduleLinkType })}
                  className="w-full px-2 py-1.5 text-[12px] border rounded outline-none border-slate-200 focus:border-blue-400"
                >
                  {(Object.keys(LINK_TYPE_LABELS) as ScheduleLinkType[]).map((t) => (
                    <option key={t} value={t}>
                      {LINK_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="px-1 py-1.5">
                <label className="block mb-1 text-[11px] font-medium text-slate-700">Lag (days)</label>
                <input
                  type="number"
                  value={linkEditor.lag}
                  onChange={(e) => setLinkEditor({ ...linkEditor, lag: Number(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full px-2 py-1.5 text-[12px] border rounded outline-none border-slate-200 focus:border-blue-400"
                />
              </div>
              <div className="flex items-center justify-between gap-2 px-1 pt-2 mt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    handleLinkDelete(linkEditor.sourceId, linkEditor.targetId);
                    setLinkEditor(null);
                  }}
                  className="text-[12px] font-medium text-red-600 hover:underline"
                >
                  Delete dependency
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleLinkUpdate(linkEditor.sourceId, linkEditor.targetId, {
                      type: linkEditor.type,
                      lag: linkEditor.lag,
                    });
                    setLinkEditor(null);
                  }}
                  className="px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          <ConfirmationModal
            isOpen={pendingDeleteId != null}
            onClose={() => setPendingDeleteId(null)}
            onConfirm={confirmDeleteTask}
            isLoading={deletingTask}
            title="Delete Task"
            message="Delete this task? Any subtasks under it will be deleted too."
          />

          <ConfirmationModal
            isOpen={pendingBulkDelete}
            onClose={() => setPendingBulkDelete(false)}
            onConfirm={confirmBulkDeleteTasks}
            isLoading={bulkDeleting}
            title="Delete Selected Tasks"
            message={`Delete ${rowSelection.selectedIds.length} selected task${
              rowSelection.selectedIds.length === 1 ? "" : "s"
            }? Any subtasks under them will be deleted too.`}
          />
      </div>

      {/* Excel-format instructions + the actual upload control, relocated
          here from the old empty-state screen — the Gantt chart (even
          blank) is now shown by default instead of an upload prompt, so
          this only surfaces on demand via the toolbar's "Upload Excel
          Sheet" button. */}
      <Drawer
        open={showUploadDrawer}
        onClose={() => setShowUploadDrawer(false)}
        title="Upload Excel Sheet"
        subtitle="Import or replace this project's schedule from a spreadsheet"
        width={420}
      >
        <div className="p-5">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
            id="excel-upload-drawer"
          />
          <label
            htmlFor="excel-upload-drawer"
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-900 text-white rounded text-[12px] font-medium hover:bg-blue-800 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Upload Excel Sheet
          </label>

          {uploadError && (
            <div className="flex gap-2 items-start p-3 mt-3 text-xs text-left text-rose-700 bg-rose-50 rounded border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="mt-5 text-xs text-left text-slate-500">
            <p className="mb-2 font-semibold text-slate-700">Schedule Format:</p>
            <p>Whether uploading a sheet or typing it in, these are the fields (any header casing works in Excel):</p>
            <ul className="pl-5 mt-2 space-y-1 list-disc">
              <li><strong>ID</strong> (optional) — unique task identifier, e.g. "1", "1.1". Needed for Parent ID / Predecessor ID references.</li>
              <li><strong>Task Name</strong> — task label (required)</li>
              <li><strong>Duration</strong> — length in days (0 marks a milestone)</li>
              <li><strong>Start Date</strong> — date the task begins</li>
              <li><strong>Progress</strong> (optional) — percent complete, 0-100</li>
              <li><strong>Status</strong> (optional) — To Do, In Progress, On Hold, or Completed; defaults to To Do. Drives the bar's color.</li>
              <li><strong>Parent ID</strong> (optional) — ID of the owning summary task</li>
              <li>
                <strong>Predecessor ID</strong> (optional) — comma-separated IDs this task depends on. Add a
                relationship type and/or lag right after the id, MS-Project style: a bare id (e.g. "3") means
                Finish-to-Start with no lag; "5FS+2" = Finish-to-Start, 2 days after; "7SS-1" = Start-to-Start,
                1 day lead. Types: FS, SS, FF, SF.
              </li>
            </ul>
            <p className="mt-2 text-slate-400">
              Rows with no Start Date / Duration, referenced by at least one other row's Parent ID, become summary bars.
            </p>
            <p className="mt-2 text-slate-400">
              Dragging a task's bar, or adding/editing a dependency, auto-schedules every task downstream of it
              according to the dependency type and lag — duration always stays fixed; only the start date shifts.
            </p>
            <p className="mt-2 text-slate-400">
              Uploading a sheet adds its rows as new tasks — it never updates or removes your existing schedule
              tasks, even ones not included in the sheet.
            </p>
          </div>
        </div>
      </Drawer>
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
    className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
      active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
    }`}
  >
    {icon}
    {label}
  </button>
);

/** Minimal borderless icon+text toolbar control — hover background instead
 * of a visible border, matching the reference design's understated chrome. */
const ToolbarButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({
  icon,
  label,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] font-medium text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
  >
    {icon}
    {label}
  </button>
);

/** Restyles the existing day/week/month zoom levels (see ZOOM_LEVELS) as a
 * compact dot-slider, matching the reference design's zoom control, in
 * place of the previous +/- buttons — same underlying zoom levels, just a
 * different affordance: click a dot to jump straight to that level. */
const ZoomSlider: React.FC<{ level: ZoomLevel; onChange: (level: ZoomLevel) => void }> = ({ level, onChange }) => (
  <div className="flex items-center gap-2 px-2 py-1.5 ml-0.5">
    <div className="relative flex items-center justify-between w-12">
      <div className="absolute inset-x-0 h-px bg-slate-300" />
      {ZOOM_LEVELS.map((lvl) => (
        <button
          key={lvl}
          type="button"
          onClick={() => onChange(lvl)}
          title={ZOOM_LABELS[lvl]}
          className={`relative z-10 rounded-full transition-all ${
            level === lvl ? "bg-blue-900 w-2.5 h-2.5" : "bg-slate-300 w-2 h-2 hover:bg-slate-400"
          }`}
        />
      ))}
    </div>
    <span className="text-[11px] font-medium text-slate-500 min-w-[34px]">{ZOOM_LABELS[level]}</span>
  </div>
);

/** Purely presentational — the enclosing button (see COLUMN_FIELD_DEFS.map)
 * owns the click, so the whole row toggles, not just this visual. */
const ToggleSwitch: React.FC<{ checked: boolean }> = ({ checked }) => (
  <span
    role="switch"
    aria-checked={checked}
    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
      checked ? "bg-blue-900" : "bg-slate-200"
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
        checked ? "translate-x-[18px]" : "translate-x-1"
      }`}
    />
  </span>
);

export default ProjectScheduleTab;
