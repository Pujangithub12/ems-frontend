import { GanttTask, GanttLink, ScheduleRow } from "../schema/schedule.types";
import { ScheduleLinkType, parsePredecessorList } from "./predecessorTokens";
import { RowDates, ForwardEdge, addDays, buildForwardEdges, buildDatesMap } from "./scheduleDates";

/**
 * Client-side Critical Path Method (CPM) over the same dependency network
 * scheduleAutoSchedule.ts already cascades — dhtmlx-gantt's built-in critical
 * path (highlight_critical_path / isCriticalTask / getCriticalPath) only
 * exists as a dead stub in the installed free/MIT build (the real
 * implementation is Pro-only), so this reimplements the forward/backward
 * pass by hand, the same way scheduleAutoSchedule.ts reimplements MS
 * Project's auto-scheduling cascade.
 *
 * Purely read-only and derived — never writes back to ScheduleRow, never
 * persisted. Recomputed on every render via useMemo in ProjectScheduleTab.
 */

export interface CriticalPathResult {
  criticalTaskIds: Set<string>;
  criticalLinkIds: Set<string>;
  /** Overall implied project finish — max(EF) across every task in the
   * network. Null when there are no schedulable (non-summary, dated) rows. */
  projectFinishDate: Date | null;
  /** Earliest root start — min(ES) across every root task. Paired with
   * projectFinishDate to show a "critical path: N days" figure. */
  projectStartDate: Date | null;
}

const EMPTY_RESULT: CriticalPathResult = {
  criticalTaskIds: new Set(),
  criticalLinkIds: new Set(),
  projectFinishDate: null,
  projectStartDate: null,
};

/** Reverse of buildForwardEdges — successorId -> every {predecessorId, type, lag} edge feeding it. */
function buildReverseEdges(rows: ScheduleRow[]) {
  const reverse = new Map<string, { predecessorId: string; type: ScheduleLinkType; lag: number }[]>();
  rows.forEach((row) => {
    parsePredecessorList(row.predecessorId).forEach((token) => {
      const list = reverse.get(row.id) ?? [];
      list.push({ predecessorId: token.id, type: token.type, lag: token.lag });
      reverse.set(row.id, list);
    });
  });
  return reverse;
}

/**
 * Kahn's algorithm topological sort, restricted to ids present in `dates`
 * (i.e. real schedulable rows — summary rows and dangling references are
 * transparently excluded from the network, same as scheduleAutoSchedule.ts).
 * A saved schedule is always acyclic (the DTO's validateScheduleLinks
 * rejects cycles on save), so this never needs cycle handling.
 */
function topologicalOrder(
  ids: string[],
  forward: Map<string, ForwardEdge[]>,
  reverse: Map<string, { predecessorId: string; type: ScheduleLinkType; lag: number }[]>,
): string[] {
  const idSet = new Set(ids);
  const inDegree = new Map<string, number>();
  ids.forEach((id) => {
    const preds = (reverse.get(id) ?? []).filter((e) => idSet.has(e.predecessorId));
    inDegree.set(id, preds.length);
  });

  const queue = ids.filter((id) => inDegree.get(id) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    (forward.get(id) ?? []).forEach((edge) => {
      if (!idSet.has(edge.successorId)) return;
      const remaining = (inDegree.get(edge.successorId) ?? 0) - 1;
      inDegree.set(edge.successorId, remaining);
      if (remaining === 0) queue.push(edge.successorId);
    });
  }
  // Any ids left out (shouldn't happen for an acyclic saved schedule) are
  // appended so the caller never silently drops a task from the network.
  order.push(...ids.filter((id) => !order.includes(id)));
  return order;
}

/** Computes critical path over the current schedule. `rows` should be the
 * flat ScheduleRow[] (ProjectScheduleTab's source of truth); summary rows
 * are excluded from the network itself but flagged critical afterward if
 * any descendant is critical. */
export function computeCriticalPath(rows: ScheduleRow[]): CriticalPathResult {
  const dates = buildDatesMap(rows); // excludes summary/undated rows
  const ids = [...dates.keys()];
  if (ids.length === 0) return EMPTY_RESULT;

  const forward = buildForwardEdges(rows);
  const reverse = buildReverseEdges(rows);
  const order = topologicalOrder(ids, forward, reverse);

  // ---- Forward pass: ES/EF ----
  const es = new Map<string, Date>();
  const ef = new Map<string, Date>();
  order.forEach((id) => {
    const own = dates.get(id)!;
    const preds = (reverse.get(id) ?? []).filter((e) => dates.has(e.predecessorId));
    let start = own.start; // root anchor: its own current start
    if (preds.length > 0) {
      let best: Date | null = null;
      preds.forEach((edge) => {
        const predEF = ef.get(edge.predecessorId);
        const predES = es.get(edge.predecessorId);
        if (!predEF || !predES) return;
        const predDates: RowDates = { start: predES, end: predEF, duration: dates.get(edge.predecessorId)!.duration };
        const candidate = impliedStartFwd(predDates, edge.type, edge.lag, own.duration);
        if (!best || candidate.getTime() > best.getTime()) best = candidate;
      });
      if (best) start = best;
    }
    const end = own.duration <= 0 ? start : addDays(start, own.duration);
    es.set(id, start);
    ef.set(id, end);
  });

  // ---- Project finish = max(EF); project start = min(ES) among roots ----
  let projectFinishDate: Date | null = null;
  ef.forEach((d) => {
    if (!projectFinishDate || d.getTime() > projectFinishDate.getTime()) projectFinishDate = d;
  });
  let projectStartDate: Date | null = null;
  es.forEach((d) => {
    if (!projectStartDate || d.getTime() < projectStartDate.getTime()) projectStartDate = d;
  });
  if (!projectFinishDate) return EMPTY_RESULT;
  const finish: Date = projectFinishDate;

  // ---- Backward pass: LS/LF ----
  const lf = new Map<string, Date>();
  const ls = new Map<string, Date>();
  [...order].reverse().forEach((id) => {
    const own = dates.get(id)!;
    const succs = (forward.get(id) ?? []).filter((e) => dates.has(e.successorId));
    let latestFinish: Date | null = null;
    if (succs.length === 0) {
      latestFinish = finish;
    } else {
      succs.forEach((edge) => {
        const succLS = ls.get(edge.successorId);
        const succLF = lf.get(edge.successorId);
        if (!succLS || !succLF) return;
        const succDates: RowDates = { start: succLS, end: succLF, duration: dates.get(edge.successorId)!.duration };
        const candidateLF = impliedLatestFinish(succDates, edge.type, edge.lag, own.duration);
        if (!latestFinish || candidateLF.getTime() < latestFinish.getTime()) latestFinish = candidateLF;
      });
      if (!latestFinish) latestFinish = finish;
    }
    const latestStart = own.duration <= 0 ? latestFinish : addDays(latestFinish, -own.duration);
    lf.set(id, latestFinish);
    ls.set(id, latestStart);
  });

  // ---- Slack + critical flagging ----
  const criticalTaskIds = new Set<string>();
  ids.forEach((id) => {
    const startEs = es.get(id)!;
    const startLs = ls.get(id)!;
    const slackDays = Math.round((startLs.getTime() - startEs.getTime()) / 86400000);
    if (slackDays === 0) criticalTaskIds.add(id);
  });

  // Keyed "predecessorId->successorId" (matches buildGanttData's
  // GanttLink.source/target, not the link's own synthetic "link-N" id).
  const criticalLinkIds = new Set<string>();
  rows.forEach((row) => {
    if (!criticalTaskIds.has(row.id)) return;
    parsePredecessorList(row.predecessorId).forEach((token) => {
      if (criticalTaskIds.has(token.id)) {
        criticalLinkIds.add(`${token.id}->${row.id}`);
      }
    });
  });

  // ---- Roll up onto summary/parent rows ----
  const parentOf = new Map<string, string>();
  rows.forEach((row) => {
    if (row.parentId) parentOf.set(row.id, row.parentId);
  });
  criticalTaskIds.forEach((id) => {
    let parentId = parentOf.get(id);
    const guard = new Set<string>(); // cycle safety on malformed parent chains
    while (parentId && !guard.has(parentId)) {
      guard.add(parentId);
      criticalTaskIds.add(parentId);
      parentId = parentOf.get(parentId);
    }
  });

  return { criticalTaskIds, criticalLinkIds, projectFinishDate, projectStartDate };
}

/** Same edge semantics as scheduleDates.ts's impliedStart — duplicated here
 * (rather than imported) because the forward pass here operates on
 * ES/EF pairs computed fresh each pass, not a row's literal current dates. */
function impliedStartFwd(pred: RowDates, type: ScheduleLinkType, lag: number, successorDuration: number): Date {
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

/** Inverse of impliedStartFwd for the backward pass — given the successor's
 * current LS/LF, the latest the predecessor may finish and still satisfy
 * this one link. FS/FF constrain the predecessor's LF directly; SS/SF
 * constrain its LS, converted to an LF-equivalent via its own duration so
 * every candidate can be reconciled with a single min(). */
function impliedLatestFinish(
  succ: RowDates,
  type: ScheduleLinkType,
  lag: number,
  predecessorDuration: number,
): Date {
  switch (type) {
    case "FS":
      return addDays(succ.start, -lag);
    case "SS": {
      const predLS = addDays(succ.start, -lag);
      return predecessorDuration <= 0 ? predLS : addDays(predLS, predecessorDuration);
    }
    case "FF":
      return addDays(succ.end, -lag);
    case "SF": {
      const predLS = addDays(succ.end, -lag);
      return predecessorDuration <= 0 ? predLS : addDays(predLS, predecessorDuration);
    }
  }
}

/** Applies a CriticalPathResult onto GanttTask[]/GanttLink[] — small helpers
 * so ProjectScheduleTab/GanttChartView don't each re-derive the "is this id
 * in the set" check inline. */
export function markCriticalTasks(tasks: GanttTask[], result: CriticalPathResult): GanttTask[] {
  if (result.criticalTaskIds.size === 0) return tasks;
  return tasks.map((t) => (result.criticalTaskIds.has(t.id) ? { ...t, isCritical: true } : t));
}

export function markCriticalLinks(links: GanttLink[], result: CriticalPathResult): GanttLink[] {
  if (result.criticalLinkIds.size === 0) return links;
  return links.map((l) =>
    result.criticalLinkIds.has(`${l.source}->${l.target}`) ? { ...l, isCritical: true } : l,
  );
}

/** Project length in whole days, or null when there's nothing to compute. */
export function criticalPathLengthDays(result: CriticalPathResult): number | null {
  if (!result.projectFinishDate || !result.projectStartDate) return null;
  return Math.round(
    (result.projectFinishDate.getTime() - result.projectStartDate.getTime()) / 86400000,
  );
}
