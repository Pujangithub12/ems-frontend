import React, { useEffect, useRef, useState } from "react";
import { gantt } from "dhtmlx-gantt";
import "dhtmlx-gantt/codebase/dhtmlxgantt.css";

import { GanttLink, GanttTask } from "../schema/schedule.types";

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
  onDeleteTask?: (id: string) => void;
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

// The row-options ("⋮") menu is a plain floating DOM node appended to
// <body> — not part of React's tree — because it must render outside the
// gantt grid's clipped/scrolling cells (see the "wbs" column's render in
// ProjectScheduleTab.tsx, which emits the ".gantt-row-menu-btn" trigger).
let openRowMenuEl: HTMLDivElement | null = null;

function closeRowMenu() {
  openRowMenuEl?.remove();
  openRowMenuEl = null;
}

function openRowMenu(
  anchor: HTMLElement,
  taskId: string,
  onAddChild: (id: string) => void,
  onDelete: (id: string) => void,
) {
  closeRowMenu();

  const menu = document.createElement("div");
  menu.className = "gantt-row-menu";
  menu.innerHTML = `
    <button type="button" class="gantt-row-menu-item" data-action="add">Add subtask</button>
    <button type="button" class="gantt-row-menu-item gantt-row-menu-item-danger" data-action="delete">Delete task</button>
  `;
  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const left = Math.min(
    rect.right - menuRect.width,
    window.innerWidth - menuRect.width - 8,
  );
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.max(8, left)}px`;

  menu.querySelector('[data-action="add"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeRowMenu();
    onAddChild(taskId);
  });
  menu.querySelector('[data-action="delete"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeRowMenu();
    if (window.confirm("Delete this task? Any subtasks under it will be deleted too.")) {
      onDelete(taskId);
    }
  });

  openRowMenuEl = menu;
}

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
  onDeleteTask,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const finestScaleUnitRef = useRef<string>("day");

  const onLinkCreateRef = useRef(onLinkCreate);
  const onLinkDeleteRef = useRef(onLinkDelete);
  const onTaskChangeRef = useRef(onTaskChange);
  const onAddChildTaskRef = useRef(onAddChildTask);
  const onDeleteTaskRef = useRef(onDeleteTask);
  const editableRef = useRef(editable);
  useEffect(() => {
    onLinkCreateRef.current = onLinkCreate;
    onLinkDeleteRef.current = onLinkDelete;
    onTaskChangeRef.current = onTaskChange;
    onAddChildTaskRef.current = onAddChildTask;
    onDeleteTaskRef.current = onDeleteTask;
    editableRef.current = editable;
  }, [onLinkCreate, onLinkDelete, onTaskChange, onAddChildTask, onDeleteTask, editable]);


  // Row-options menu is dismissed by clicking outside it, scrolling, or Escape.
  useEffect(() => {
    const handleDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        openRowMenuEl &&
        !openRowMenuEl.contains(target) &&
        !target.closest(".gantt-row-menu-btn")
      ) {
        closeRowMenu();
      }
    };
    const handleScroll = () => closeRowMenu();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRowMenu();
    };
    document.addEventListener("mousedown", handleDocMouseDown, true);
    document.addEventListener("scroll", handleScroll, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocMouseDown, true);
      document.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("keydown", handleKeyDown);
      closeRowMenu();
    };
  }, []);

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
        const menuBtn = target.closest<HTMLElement>(".gantt-row-menu-btn");
        if (menuBtn) {
          const rowId = menuBtn.dataset.rowMenuId ?? String(id);
          if (openRowMenuEl && openRowMenuEl.dataset.forId === rowId) {
            closeRowMenu();
          } else {
            openRowMenu(
              menuBtn,
              rowId,
              (tid) => onAddChildTaskRef.current?.(tid),
              (tid) => onDeleteTaskRef.current?.(tid),
            );
            if (openRowMenuEl) openRowMenuEl.dataset.forId = rowId;
          }
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
        /* The "⋮" next to a task's # id (edit mode only) that opens the
           row-options menu (Add subtask / Delete task) — see the "wbs"
           column's render + the openRowMenu/onTaskClick wiring above. */
        .gantt-wbs-label {
          margin-right: 3px;
        }
        .gantt-row-menu-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          padding: 0;
          line-height: 1;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -1px;
          border-radius: 3px;
          border: 1px solid transparent;
          background: transparent;
          color: #64748b;
          cursor: pointer;
        }
        .gantt-row-menu-btn:hover {
          background: #eff6ff;
          border-color: #2563eb;
          color: #2563eb;
        }
        /* Floating dropdown opened by .gantt-row-menu-btn — appended to
           <body> (see openRowMenu in GanttChartView) so it isn't clipped by
           the narrow, scrollable grid column it's triggered from. */
        .gantt-row-menu {
          position: fixed;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          min-width: 140px;
          padding: 4px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
        }
        .gantt-row-menu-item {
          display: block;
          width: 100%;
          padding: 6px 10px;
          text-align: left;
          font-size: 12.5px;
          font-weight: 500;
          color: #334155;
          background: transparent;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .gantt-row-menu-item:hover {
          background: #f1f5f9;
        }
        .gantt-row-menu-item-danger {
          color: #dc2626;
        }
        .gantt-row-menu-item-danger:hover {
          background: #fef2f2;
        }
        /* Subtask rows in the "Task Name" tree column — indent each nesting
           level by ~10px relative to its parent (dhtmlx's default is 15px).
           The expand/collapse arrow (.gantt_open/.gantt_close, 20px) and the
           leaf placeholder (.gantt_blank, 18px) differ in width by default,
           which partly cancels the indent out — equalized here so the full
           10px actually shows up as the visual gap between levels. */
        .gantt_tree_indent {
          width: 10px !important;
        }
        .gantt_tree_icon.gantt_open,
        .gantt_tree_icon.gantt_close,
        .gantt_tree_icon.gantt_blank {
          width: 18px !important;
        }
      `}</style>
      <div ref={containerRef} style={{ width: "100%" }} />
    </>
  );
};

export default GanttChartView;
