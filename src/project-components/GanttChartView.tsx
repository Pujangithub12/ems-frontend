import React, { useEffect, useRef, useState } from "react";
import { gantt } from "dhtmlx-gantt";
import "dhtmlx-gantt/codebase/dhtmlxgantt.css";

import { GanttLink, GanttTask } from "./schema/Scheduletypes";

/**
 * GanttChartView
 * --------------
 * Thin React wrapper around dhtmlx-gantt. dhtmlx-gantt is a singleton (the
 * `gantt` export is one shared instance, not a fresh object per component),
 * so every mount fully (re)configures it via `gantt.init()`, which dhtmlx
 * supports calling repeatedly to re-target a new container element (e.g.
 * switching away from and back to the Schedule tab). Unmount only calls
 * `gantt.clearAll()` — NOT `gantt.destructor()`, which tears down internal
 * extension state (markers, event wiring) in a way this version doesn't
 * cleanly recover from on the next `gantt.init()`.
 *
 * Read-only by design: all editing (add/rename/reschedule tasks) happens
 * through the existing "Add / Edit Schedule" modal, which fully replaces the
 * schedule on save — so drag-move/resize/progress and the built-in
 * double-click lightbox are all disabled here to avoid a second, competing
 * editing surface.
 */

export interface ScheduleColumnDef {
  /** Property name on the dhtmlx task object (matches a GanttTask field, or "wbs"). */
  id: string;
  header: string;
  width?: number;
  align?: "left" | "center" | "right";
  /** Marks the tree column (expand/collapse arrows + indentation) — exactly one column should set this. */
  tree?: boolean;
  /** Custom cell renderer; omit to just print the raw field value (used for the tree column). */
  render?: (task: GanttTask) => string;
}

export interface ScheduleScale {
  unit: string;
  step: number;
  format: string;
}

interface GanttChartViewProps {
  tasks: GanttTask[];
  links: GanttLink[];
  columns: ScheduleColumnDef[];
  scales: ScheduleScale[];
  /** false renders the task grid only (the "List" view) with no chart panel. */
  showChart: boolean;
  /** Fired when the user drags a link from one bar's connector dot onto
   * another, creating a finish-to-start dependency. Receives the two
   * task ids involved (predecessor, then dependent). */
  onLinkCreate?: (sourceId: string, targetId: string) => void;
  /** Fired when the user deletes a dependency arrow (hover + click the "x"). */
  onLinkDelete?: (sourceId: string, targetId: string) => void;
}

/** In Gantt mode, the task table takes this fraction of the container width
 * and the chart takes the rest. Column `width`s are relative weights scaled
 * to fit inside it — not literal pixel widths. */
const GRID_WIDTH_RATIO = 0.25;

const LINK_TYPE_MAP: Record<GanttLink["type"], string> = {
  e2s: "0", // finish_to_start
  s2s: "1", // start_to_start
  e2e: "2", // finish_to_finish
  s2e: "3", // start_to_finish
};

const TYPE_MAP: Record<GanttTask["type"], string> = {
  task: "task",
  summary: "project",
  milestone: "milestone",
};

/** "YYYY-MM-DD 00:00" — matches gantt.config.date_format below. */
function toDhtmlxDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d} 00:00`;
}

/**
 * Draws the "today" line by hand: dhtmlx-gantt's own coordinate/marker/
 * task-layer helpers (gantt.posFromDate, gantt.addMarker, gantt.addTaskLayer)
 * are declared in the TypeScript types but are either absent at runtime in
 * this build ("not a function") or — in posFromDate's case — return a
 * position that doesn't match what's actually rendered once a multi-tier
 * `scales` config is in play. Templates (task_class, timeline_cell_class)
 * DO work reliably though, so this marks today's timeline cell with a class
 * via a template, then measures that cell's real DOM position and places a
 * plain div at the same x inside `.gantt_data_area` (the positioned ancestor
 * task bars live in, so the coordinate space matches).
 */
function renderTodayLine(container: HTMLElement | null, showChart: boolean) {
  if (!container) return;
  const dataArea = container.querySelector<HTMLElement>(".gantt_data_area");
  if (!dataArea) return;

  let line = dataArea.querySelector<HTMLDivElement>(":scope > .gantt-today-line");
  const todayCell = dataArea.querySelector<HTMLElement>(".gantt_task_cell.gantt-today-cell");
  if (!showChart || !todayCell) {
    line?.remove();
    return;
  }
  if (!line) {
    line = document.createElement("div");
    line.className = "gantt-today-line";
    dataArea.appendChild(line);
  }

  const left = todayCell.getBoundingClientRect().left - dataArea.getBoundingClientRect().left;
  line.style.left = `${Math.round(left)}px`;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Does the timeline cell starting at `cellStart` (whose width spans one
 * unit of `unit`) contain `today`? Needed because timeline_cell_class only
 * gets the cell's start date, and the finest configured scale row can be a
 * day, a week, or a month depending on the current zoom level. */
function cellContainsToday(cellStart: Date, unit: string, today: Date): boolean {
  if (unit === "week") {
    const weekEnd = new Date(cellStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return today >= cellStart && today < weekEnd;
  }
  if (unit === "month") {
    return cellStart.getFullYear() === today.getFullYear() && cellStart.getMonth() === today.getMonth();
  }
  return isSameCalendarDay(cellStart, today);
}

const GanttChartView: React.FC<GanttChartViewProps> = ({
  tasks,
  links,
  columns,
  scales,
  showChart,
  onLinkCreate,
  onLinkDelete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const [containerWidth, setContainerWidth] = useState(0);
  // The finest scale row's unit ("day"/"week"/"month"), kept in a ref so the
  // timeline_cell_class template (registered once, in the init effect below)
  // always reads the current zoom level instead of a stale closure value.
  const finestScaleUnitRef = useRef<string>("day");
  // The onLinkCreate/onLinkDelete events are wired up once, in the init
  // effect below, so they read these refs instead of a stale closure.
  const onLinkCreateRef = useRef(onLinkCreate);
  const onLinkDeleteRef = useRef(onLinkDelete);
  useEffect(() => {
    onLinkCreateRef.current = onLinkCreate;
    onLinkDeleteRef.current = onLinkDelete;
  }, [onLinkCreate, onLinkDelete]);

  // Tracks the container's rendered width so the grid/chart split stays a
  // true 25%/75% at any screen size, not a fixed pixel guess.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    gantt.config.date_format = "%Y-%m-%d %H:%i";
    // Not fully readonly: drag-to-link (the small connector dots on a bar's
    // edges) needs to stay interactive. Every other form of editing
    // (move/resize/progress-drag/selection) is individually switched off
    // below so this doesn't reopen a second editing surface alongside the
    // Add/Edit Schedule modal.
    gantt.config.readonly = false;
    gantt.config.drag_links = true;
    gantt.config.drag_move = false;
    gantt.config.drag_resize = false;
    gantt.config.drag_progress = false;
    gantt.config.select_task = false;
    gantt.config.show_progress = true;
    gantt.config.row_height = 38;
    gantt.config.bar_height = 22;
    gantt.config.scale_height = 44;
    gantt.config.min_column_width = 34;

    gantt.templates.task_class = (_start: Date, _end: Date, task: unknown) =>
      `gantt-color-${(task as GanttTask).colorIndex % 4}`;

    // Marks whichever timeline cell today falls in — the "today" line is
    // then positioned by measuring this cell's real DOM position (see
    // renderTodayLine) rather than trusting gantt's own coordinate helpers.
    gantt.templates.timeline_cell_class = (_item: unknown, date: Date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return cellContainsToday(date, finestScaleUnitRef.current, today) ? "gantt-today-cell" : "";
    };

    // The default double-click "lightbox" editor is a second, competing
    // editing surface — this app edits schedules only via the Add/Edit
    // Schedule modal, which does a full-replace save.
    gantt.attachEvent("onBeforeLightbox", () => false);

    // A dependency can't link a task to itself.
    gantt.attachEvent("onBeforeLinkAdd", (_id: string | number, link: { source: unknown; target: unknown }) => {
      return link.source !== link.target;
    });
    // Report the new link up to the parent, which folds it into the
    // dependent row's `predecessorId`. Left in gantt's own data store too —
    // the next tasks/links prop update (from that state change) rebuilds
    // this exact link via gantt.clearAll()/parse(), so it isn't lost.
    gantt.attachEvent("onAfterLinkAdd", (_id: string | number, link: { source: unknown; target: unknown }) => {
      onLinkCreateRef.current?.(String(link.source), String(link.target));
    });
    gantt.attachEvent("onAfterLinkDelete", (_id: string | number, link: { source: unknown; target: unknown }) => {
      onLinkDeleteRef.current?.(String(link.source), String(link.target));
    });
    // This build has no built-in hover-to-delete icon on a dependency arrow,
    // so double-click is repurposed here (links only — task double-click
    // stays fully blocked above) as the one way to remove one.
    gantt.attachEvent("onLinkDblClick", (id: string | number) => {
      if (window.confirm("Delete this dependency?")) {
        gantt.deleteLink(id);
      }
      return false;
    });

    gantt.init(containerRef.current);
    readyRef.current = true;

    return () => {
      readyRef.current = false;
      gantt.clearAll();
    };
  }, []);

  useEffect(() => {
    // In Gantt mode the grid is a fixed 25% of the container (column
    // `width`s are relative weights scaled to fit); in List mode there's no
    // chart to share space with, so columns keep their weight as a literal
    // pixel width and the last one is stretched to fill the container.
    const gridWidthPx = Math.round(containerWidth * GRID_WIDTH_RATIO);
    const totalWeight = columns.reduce((sum, c) => sum + (c.width ?? 100), 0);

    gantt.config.columns = columns.map((col) => ({
      name: col.id,
      label: col.header,
      width: showChart
        ? Math.max(28, Math.round(((col.width ?? 100) / totalWeight) * gridWidthPx))
        : col.width,
      align: col.align,
      tree: col.tree,
      template: col.render ? (task: unknown) => col.render!(task as GanttTask) : undefined,
    }));
    gantt.config.show_chart = showChart;
    gantt.config.autofit = !showChart;
    if (showChart && gridWidthPx > 0) gantt.config.grid_width = gridWidthPx;
    if (readyRef.current) gantt.render();
    renderTodayLine(containerRef.current, showChart);
  }, [columns, showChart, containerWidth]);

  useEffect(() => {
    // dhtmlx types `scales` as a non-empty tuple array; ours is always a
    // fixed 2-level array (see SCALES in ProjectScheduleTab) but built from
    // a plain literal, so it doesn't structurally match the tuple type.
    gantt.config.scales = scales as unknown as typeof gantt.config.scales;
    finestScaleUnitRef.current = scales[scales.length - 1]?.unit ?? "day";
    if (readyRef.current) gantt.render();
    renderTodayLine(containerRef.current, showChart);
  }, [scales, showChart]);

  useEffect(() => {
    const data = tasks.map((t) => ({
      id: t.id,
      text: t.text,
      start_date: toDhtmlxDate(t.start),
      duration: t.type === "milestone" ? 0 : Math.max(1, Math.round((t.end.getTime() - t.start.getTime()) / 86400000)),
      progress: Math.max(0, Math.min(1, (t.progress || 0) / 100)),
      parent: t.parent,
      type: TYPE_MAP[t.type],
      open: t.open,
      colorIndex: t.colorIndex,
      wbs: t.wbs,
      durationLabel: t.durationLabel,
      startLabel: t.startLabel,
    }));
    const linkData = links.map((l) => ({
      id: l.id,
      source: l.source,
      target: l.target,
      type: LINK_TYPE_MAP[l.type],
    }));

    gantt.clearAll();
    gantt.parse({ data, links: linkData });
    renderTodayLine(containerRef.current, showChart);
  }, [tasks, links, showChart]);

  return (
    <>
      <style>{`
        .gantt_task_line.gantt-color-0 { background: #3b82f6 !important; border: 1px solid #2563eb !important; }
        .gantt_task_line.gantt-color-1 { background: #8b5cf6 !important; border: 1px solid #7c3aed !important; }
        .gantt_task_line.gantt-color-2 { background: #14b8a6 !important; border: 1px solid #0d9488 !important; }
        .gantt_task_line.gantt-color-3 { background: #f59e0b !important; border: 1px solid #d97706 !important; }
        .gantt_task_line .gantt_task_progress { background: rgba(0, 0, 0, 0.18) !important; }
        .gantt_milestone.gantt-color-0 .gantt_task_content { background: #3b82f6 !important; border-color: #2563eb !important; }
        .gantt_milestone.gantt-color-1 .gantt_task_content { background: #8b5cf6 !important; border-color: #7c3aed !important; }
        .gantt_milestone.gantt-color-2 .gantt_task_content { background: #14b8a6 !important; border-color: #0d9488 !important; }
        .gantt_milestone.gantt-color-3 .gantt_task_content { background: #f59e0b !important; border-color: #d97706 !important; }
        .gantt-today-line {
          position: absolute;
          top: 0;
          width: 2px;
          height: 100%;
          background: #2563eb;
          pointer-events: none;
          z-index: 1;
        }
        /* The small drag-to-connect dot dhtmlx shows on a bar's edges on
           hover — recolored to match the app's blue accent instead of its
           default white/gray. */
        .gantt_link_control {
          --dhx-gantt-link-handle-background: #2563eb;
          --dhx-gantt-link-handle-border: #2563eb;
          --dhx-gantt-link-handle-background-hover: #1d4ed8;
          --dhx-gantt-link-handle-border-hover: #1d4ed8;
        }
      `}</style>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </>
  );
};

export default GanttChartView;
