import { ScheduleRow } from "../schema/schedule.types";
import { parsePredecessorList } from "./predecessorTokens";
import {
  RowDates,
  ForwardEdge,
  addDays,
  formatISODate,
  buildForwardEdges,
  buildDatesMap,
  impliedStart,
} from "./scheduleDates";

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
  forward: Map<string, ForwardEdge[]>,
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
