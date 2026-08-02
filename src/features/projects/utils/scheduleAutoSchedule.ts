import { ScheduleRow } from "../schema/schedule.types";
import { ScheduleLinkType, parsePredecessorList } from "./predecessorTokens";

/**
 * MS-Project-style auto-scheduling: when a task's dates change (dragged on
 * the chart) or a dependency is created/edited, its dependents' start dates
 * are recalculated from the link's type + lag — same forward-pass logic MS
 * Project uses, just without a "manual vs. auto scheduled" mode distinction
 * (every task here is effectively auto-scheduled). A task's own *duration*
 * is never touched by this — only its start (and therefore end) shifts.
 *
 * Deliberately operates on the same ScheduleRow[] the rest of this feature
 * already treats as the single source of truth (see ProjectScheduleTab's
 * header comment) rather than the derived GanttTask[]/GanttLink[] — summary
 * rows have no start/duration of their own to write a computed date back
 * into, so they're transparently skipped both as dependency sources (their
 * "current dates" are simply absent, so any link referencing one contributes
 * no constraint) and as recompute targets.
 */

interface RowDates {
  start: Date;
  end: Date;
  duration: number;
}

/** "YYYY-MM-DD" -> Date. Mirrors buildGanttData's coerceDate string fallback
 * (`new Date(String(value))`) — every ScheduleRow.startDate in this app is
 * always written in that exact format (see formatDateInput), so the fuller
 * Excel-serial-number handling coerceDate also does isn't needed here. */
function parseISODate(value: string): Date | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getRowDates(row: ScheduleRow): RowDates | null {
  const start = parseISODate(row.startDate);
  if (!start) return null;
  const durationNum = Number(row.duration);
  const duration = row.duration.trim() === "" || isNaN(durationNum) ? 1 : durationNum;
  // A milestone (duration 0) starts and finishes at the same instant for
  // dependency purposes — buildGanttData separately pads its *displayed* bar
  // to 1 day for visibility, which is a rendering concern only.
  const end = duration <= 0 ? start : addDays(start, duration);
  return { start, end, duration };
}

/** Where a task's start must land to satisfy one predecessor link, given the
 * predecessor's current dates and the successor's own (fixed) duration. */
function impliedStart(pred: RowDates, type: ScheduleLinkType, lag: number, successorDuration: number): Date {
  switch (type) {
    case "FS":
      return addDays(pred.end, lag);
    case "SS":
      return addDays(pred.start, lag);
    case "FF":
      return addDays(pred.end, lag - successorDuration);
    case "SF":
      return addDays(pred.start, lag - successorDuration);
  }
}

/** predecessorId -> every {successorId, type, lag} edge depending on it. */
function buildForwardEdges(rows: ScheduleRow[]) {
  const forward = new Map<string, { successorId: string; type: ScheduleLinkType; lag: number }[]>();
  rows.forEach((row) => {
    parsePredecessorList(row.predecessorId).forEach((token) => {
      const list = forward.get(token.id) ?? [];
      list.push({ successorId: row.id, type: token.type, lag: token.lag });
      forward.set(token.id, list);
    });
  });
  return forward;
}

/**
 * Recomputes every id in `queue` from its predecessors' *current* dates (as
 * tracked in `dates`), and cascades to that task's own successors whenever
 * its start actually changes — a plain BFS over the dependency DAG. Capped
 * at a generous iteration bound so a transient cycle mid-edit (the backend
 * rejects cycles at save time, but nothing stops one existing for a moment
 * while the user is still dragging links around) can't hang the browser.
 */
function cascade(
  rows: ScheduleRow[],
  dates: Map<string, RowDates>,
  forward: Map<string, { successorId: string; type: ScheduleLinkType; lag: number }[]>,
  initialQueue: string[],
): Map<string, Date> {
  const rowsById = new Map(rows.map((r) => [r.id, r]));
  const changed = new Map<string, Date>();
  const queue = [...initialQueue];
  const queued = new Set(queue);
  const maxIterations = rows.length * 4 + 10;
  let iterations = 0;

  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    const id = queue.shift()!;
    queued.delete(id);

    const row = rowsById.get(id);
    const current = dates.get(id);
    if (!row || !current) continue; // summary row or dangling reference — nothing to recompute/write

    const tokens = parsePredecessorList(row.predecessorId);
    if (tokens.length === 0) continue;

    let bestStart: Date | null = null;
    for (const token of tokens) {
      const predDates = dates.get(token.id);
      if (!predDates) continue; // predecessor is a summary row or missing — contributes no constraint
      const candidate = impliedStart(predDates, token.type, token.lag, current.duration);
      if (!bestStart || candidate.getTime() > bestStart.getTime()) bestStart = candidate;
    }
    if (!bestStart || bestStart.getTime() === current.start.getTime()) continue;

    const newEnd = current.duration <= 0 ? bestStart : addDays(bestStart, current.duration);
    dates.set(id, { start: bestStart, end: newEnd, duration: current.duration });
    changed.set(id, bestStart);

    (forward.get(id) ?? []).forEach((edge) => {
      if (!queued.has(edge.successorId)) {
        queued.add(edge.successorId);
        queue.push(edge.successorId);
      }
    });
  }

  return changed;
}

function applyChanges(rows: ScheduleRow[], changed: Map<string, Date>): ScheduleRow[] {
  if (changed.size === 0) return rows;
  return rows.map((row) =>
    changed.has(row.id) ? { ...row, startDate: formatISODate(changed.get(row.id)!) } : row,
  );
}

function buildDatesMap(rows: ScheduleRow[]): Map<string, RowDates> {
  const dates = new Map<string, RowDates>();
  rows.forEach((row) => {
    const d = getRowDates(row);
    if (d) dates.set(row.id, d);
  });
  return dates;
}

/**
 * Call after a task's own start/duration just changed directly (dragged or
 * resized on the chart) — `movedId`'s new dates are already reflected in
 * `rows`, so only its dependents need recomputing, cascading onward from
 * whichever of them actually move as a result.
 */
export function recalcAfterTaskEdit(rows: ScheduleRow[], movedId: string): ScheduleRow[] {
  const dates = buildDatesMap(rows);
  const forward = buildForwardEdges(rows);
  const seedQueue = (forward.get(movedId) ?? []).map((e) => e.successorId);
  const changed = cascade(rows, dates, forward, seedQueue);
  return applyChanges(rows, changed);
}

/**
 * Call after `successorId`'s dependency set just changed (a new predecessor
 * link was created, or an existing link's type/lag was edited) — unlike a
 * direct task move, `successorId` itself hasn't been recomputed yet, so it's
 * the seed rather than its dependents.
 */
export function recalcAfterLinkEdit(rows: ScheduleRow[], successorId: string): ScheduleRow[] {
  const dates = buildDatesMap(rows);
  const forward = buildForwardEdges(rows);
  const changed = cascade(rows, dates, forward, [successorId]);
  return applyChanges(rows, changed);
}
