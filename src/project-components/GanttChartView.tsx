import React, { useEffect, useRef, useState } from "react";
import { gantt } from "dhtmlx-gantt";
import "dhtmlx-gantt/codebase/dhtmlxgantt.css";

import { GanttLink, GanttTask } from "./schema/Scheduletypes";

export interface ScheduleColumnDef {
  id: string;
  header: string;
  width?: number;
  align?: "left" | "center" | "right";
  tree?: boolean;

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
  
  showChart: boolean;
  
  editable: boolean;
  
  onLinkCreate?: (sourceId: string, targetId: string) => void;
  onLinkDelete?: (sourceId: string, targetId: string) => void;
  onTaskChange?: (
    id: string,
    changes: { text?: string; start?: Date; duration?: number },
  ) => void;

  onAddChildTask?: (parentId: string) => void;
}


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


function renderTodayLine(container: HTMLElement | null, showChart: boolean) {
  if (!container) return;
  const dataArea = container.querySelector<HTMLElement>(".gantt_data_area");
  if (!dataArea) return;

  let line = dataArea.querySelector<HTMLDivElement>(
    ":scope > .gantt-today-line",
  );
  const todayCell = dataArea.querySelector<HTMLElement>(
    ".gantt_task_cell.gantt-today-cell",
  );
  if (!showChart || !todayCell) {
    line?.remove();
    return;
  }
  if (!line) {
    line = document.createElement("div");
    line.className = "gantt-today-line";
    dataArea.appendChild(line);
  }

  const left =
    todayCell.getBoundingClientRect().left -
    dataArea.getBoundingClientRect().left;
  line.style.left = `${Math.round(left)}px`;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}


function cellContainsToday(
  cellStart: Date,
  unit: string,
  today: Date,
): boolean {
  if (unit === "week") {
    const weekEnd = new Date(cellStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return today >= cellStart && today < weekEnd;
  }
  if (unit === "month") {
    return (
      cellStart.getFullYear() === today.getFullYear() &&
      cellStart.getMonth() === today.getMonth()
    );
  }
  return isSameCalendarDay(cellStart, today);
}

let activeGanttEventIds: string[] = [];

const GanttChartView: React.FC<GanttChartViewProps> = ({
  tasks,
  links,
  columns,
  scales,
  showChart,
  editable,
  onLinkCreate,
  onLinkDelete,
  onTaskChange,
  onAddChildTask,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const [containerWidth, setContainerWidth] = useState(0);
  
  const finestScaleUnitRef = useRef<string>("day");
  
  const onLinkCreateRef = useRef(onLinkCreate);
  const onLinkDeleteRef = useRef(onLinkDelete);
  const onTaskChangeRef = useRef(onTaskChange);
  const onAddChildTaskRef = useRef(onAddChildTask);
  const editableRef = useRef(editable);
  useEffect(() => {
    onLinkCreateRef.current = onLinkCreate;
    onLinkDeleteRef.current = onLinkDelete;
    onTaskChangeRef.current = onTaskChange;
    onAddChildTaskRef.current = onAddChildTask;
    editableRef.current = editable;
  }, [onLinkCreate, onLinkDelete, onTaskChange, onAddChildTask, editable]);


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
    
    gantt.config.readonly = true;
    gantt.config.drag_links = false;
    gantt.config.drag_move = false;
    gantt.config.drag_resize = false;
    gantt.config.drag_progress = false;
    gantt.config.select_task = false;
    gantt.config.show_progress = true;
    gantt.config.row_height = 38;
    gantt.config.bar_height = 22;
    gantt.config.scale_height = 44;
    gantt.config.min_column_width = 34;
    gantt.config.autosize = "y";

    gantt.templates.task_class = (_start: Date, _end: Date, task: unknown) =>
      `gantt-color-${(task as GanttTask).colorIndex % 4}`;


    gantt.templates.timeline_cell_class = (_item: unknown, date: Date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return cellContainsToday(date, finestScaleUnitRef.current, today)
        ? "gantt-today-cell"
        : "";
    };


    activeGanttEventIds.forEach((eid) => gantt.detachEvent(eid));
    activeGanttEventIds = [];

    const eventIds: string[] = [];

    eventIds.push(gantt.attachEvent("onBeforeLightbox", () => false));

    eventIds.push(
      gantt.attachEvent("onTaskClick", (id: string | number, e: MouseEvent) => {
        if (!editableRef.current) return true;
        const target = e.target as HTMLElement;
        const addChildBtn = target.closest<HTMLElement>(".gantt-add-child-btn");
        if (addChildBtn) {
          onAddChildTaskRef.current?.(
            addChildBtn.dataset.addChildId ?? String(id),
          );
          return false;
        }
        if (target.closest(".gantt_tree_icon")) return true; // expand/collapse arrow
        const cell = target.closest<HTMLElement>(
          ".gantt_cell[data-column-name='text']",
        );
        if (!cell || cell.querySelector("input")) return true;
        const contentEl = cell.querySelector<HTMLElement>(
          ".gantt_tree_content",
        );
        if (!contentEl) return true;

        const originalText = String(gantt.getTask(id).text ?? "");
        const input = document.createElement("input");
        input.type = "text";
        input.value = originalText;
        input.className = "gantt-inline-text-editor";
        contentEl.replaceWith(input);
        input.focus();
        input.select();

        let settled = false;
        const commit = () => {
          if (settled) return;
          settled = true;
          const nextText = input.value.trim() || originalText;
          if (nextText !== originalText) {
            gantt.getTask(id).text = nextText;
            gantt.updateTask(id);
          } else {
            gantt.render();
          }
        };
        const cancel = () => {
          if (settled) return;
          settled = true;
          gantt.render();
        };

        input.addEventListener("blur", commit);
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            input.blur();
          } else if (ev.key === "Escape") {
            ev.preventDefault();
            input.removeEventListener("blur", commit);
            cancel();
          }
        });

        return false;
      }),
    );

    eventIds.push(
      gantt.attachEvent("onBeforeTaskDrag", (id: string | number) => {
        return gantt.getTask(id).type !== "project";
      }),
    );

    eventIds.push(
      gantt.attachEvent(
        "onAfterTaskUpdate",
        (
          id: string | number,
          task: { text?: string; start_date?: Date; duration?: number },
        ) => {
          onTaskChangeRef.current?.(String(id), {
            text: task.text,
            start: task.start_date,
            duration: task.duration,
          });
        },
      ),
    );

    // A dependency can't link a task to itself.
    eventIds.push(
      gantt.attachEvent(
        "onBeforeLinkAdd",
        (_id: string | number, link: { source: unknown; target: unknown }) => {
          return link.source !== link.target;
        },
      ),
    );
    
    eventIds.push(
      gantt.attachEvent(
        "onAfterLinkAdd",
        (_id: string | number, link: { source: unknown; target: unknown }) => {
          onLinkCreateRef.current?.(String(link.source), String(link.target));
        },
      ),
    );
    eventIds.push(
      gantt.attachEvent(
        "onAfterLinkDelete",
        (_id: string | number, link: { source: unknown; target: unknown }) => {
          onLinkDeleteRef.current?.(String(link.source), String(link.target));
        },
      ),
    );
    
    eventIds.push(
      gantt.attachEvent("onLinkDblClick", (id: string | number) => {
        if (window.confirm("Delete this dependency?")) {
          gantt.deleteLink(id);
        }
        return false;
      }),
    );

    activeGanttEventIds = eventIds;

    gantt.init(containerRef.current);
    readyRef.current = true;

    return () => {
      readyRef.current = false;
      eventIds.forEach((eid) => gantt.detachEvent(eid));
      if (activeGanttEventIds === eventIds) activeGanttEventIds = [];
      gantt.clearAll();
    };
  }, []);

  useEffect(() => {
    gantt.config.readonly = !editable;
    gantt.config.drag_links = editable;
    gantt.config.drag_resize = editable;
    if (readyRef.current) gantt.render();
  }, [editable]);

  useEffect(() => {
    const gridWidthPx = Math.round(containerWidth * GRID_WIDTH_RATIO);
    const totalWeight = columns.reduce((sum, c) => sum + (c.width ?? 100), 0);

    gantt.config.columns = columns.map((col) => ({
      name: col.id,
      label: col.header,
      width: showChart
        ? Math.max(
            28,
            Math.round(((col.width ?? 100) / totalWeight) * gridWidthPx),
          )
        : col.width,
      align: col.align,
      tree: col.tree,
      template: col.render
        ? (task: unknown) => col.render!(task as GanttTask)
        : undefined,
    }));
    gantt.config.show_chart = showChart;
    gantt.config.autofit = !showChart;
    if (showChart && gridWidthPx > 0) gantt.config.grid_width = gridWidthPx;
    if (readyRef.current) gantt.render();
    renderTodayLine(containerRef.current, showChart);
  }, [columns, showChart, containerWidth]);

  useEffect(() => {
    
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
      duration:
        t.type === "milestone"
          ? 0
          : Math.max(
              1,
              Math.round((t.end.getTime() - t.start.getTime()) / 86400000),
            ),
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
        /* Hand-rolled inline task-name editor (see onTaskClick) — sized to
           fill the cell it replaces. */
        .gantt-inline-text-editor {
          width: 100%;
          height: 100%;
          padding: 0 4px;
          border: 1px solid #2563eb;
          border-radius: 2px;
          outline: none;
          font: inherit;
          text-align: inherit;
          background: #fff;
        }
        /* The "+" next to a task's # id (edit mode only) that adds a
           subtask under that row — see the "wbs" column's render + the
           onAddChildTask handler in onTaskClick. */
        .gantt-wbs-label {
          margin-right: 4px;
        }
        .gantt-add-child-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          padding: 0;
          line-height: 1;
          font-size: 12px;
          font-weight: 600;
          border-radius: 3px;
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #64748b;
          cursor: pointer;
        }
        .gantt-add-child-btn:hover {
          background: #eff6ff;
          border-color: #2563eb;
          color: #2563eb;
        }
      `}</style>
      <div ref={containerRef} style={{ width: "100%" }} />
    </>
  );
};

export default GanttChartView;
