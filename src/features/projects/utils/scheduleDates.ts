import { ScheduleRow } from "../schema/schedule.types";
import { ScheduleLinkType, parsePredecessorList } from "./predecessorTokens";

/**
 * Date-arithmetic helpers shared by scheduleAutoSchedule.ts (forward-cascade
 * auto-scheduling on drag/link edits) and criticalPath.ts (read-only CPM
 * forward/backward pass) — split out so both consume the exact same
 * date/duration/link semantics instead of drifting apart.
 */

export interface RowDates {
  start: Date;
  end: Date;
  duration: number;
}

/** "YYYY-MM-DD" -> Date. Every ScheduleRow.startDate in this app is always
 * written in that exact format (see formatDateInput). */
export function parseISODate(value: string): Date | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getRowDates(row: ScheduleRow): RowDates | null {
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
export function impliedStart(
  pred: RowDates,
  type: ScheduleLinkType,
  lag: number,
  successorDuration: number,
): Date {
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

export interface ForwardEdge {
  successorId: string;
  type: ScheduleLinkType;
  lag: number;
}

/** predecessorId -> every {successorId, type, lag} edge depending on it. */
export function buildForwardEdges(rows: ScheduleRow[]): Map<string, ForwardEdge[]> {
  const forward = new Map<string, ForwardEdge[]>();
  rows.forEach((row) => {
    parsePredecessorList(row.predecessorId).forEach((token) => {
      const list = forward.get(token.id) ?? [];
      list.push({ successorId: row.id, type: token.type, lag: token.lag });
      forward.set(token.id, list);
    });
  });
  return forward;
}

export function buildDatesMap(rows: ScheduleRow[]): Map<string, RowDates> {
  const dates = new Map<string, RowDates>();
  rows.forEach((row) => {
    const d = getRowDates(row);
    if (d) dates.set(row.id, d);
  });
  return dates;
}
