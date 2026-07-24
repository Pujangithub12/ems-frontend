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
  format?: string;
  /** Renders the cell's HTML directly instead of a plain date format string —
   * used for the day scale to stack the day number over its weekday letter. */
  template?: (date: Date) => string;
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
  onDuplicateTask?: (id: string) => void;
  /** Fires when the status <select> embedded in the "status" column (see
   * ProjectScheduleTab's `columns` memo) is changed. */
  onStatusChange?: (id: string, status: string) => void;
  /** Fires after a row is dragged to a new position (and/or a new parent) in
   * the grid — every task's id + current parent id (null at root), in the
   * new top-to-bottom order. */
  onReorder?: (order: { id: string; parentId: string | null }[]) => void;
  /** Fires when any grid header cell is clicked — lets callers embed raw
   * HTML (e.g. a button) in a column's `header` string and react to clicks
   * on it, the same way row-level buttons are embedded via `render`. */
  onGridHeaderClick?: (columnId: string, target: HTMLElement) => void;
}


const GRID_WIDTH_RATIO = 0.32;

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


const MIN_DAY_COLUMNS = 90;


function applyDayRangePadding(tasks: GanttTask[], isDayZoom: boolean) {
  if (!isDayZoom || tasks.length === 0) {
    gantt.config.start_date = undefined;
    gantt.config.end_date = undefined;
    return;
  }
  const starts = tasks.map((t) => t.start.getTime());
  const ends = tasks.map((t) => t.end.getTime());
  const start = new Date(Math.min(...starts));
  start.setDate(start.getDate() - 3);
  const minEnd = new Date(start);
  minEnd.setDate(minEnd.getDate() + MIN_DAY_COLUMNS);
  const naturalEnd = new Date(Math.max(...ends));
  naturalEnd.setDate(naturalEnd.getDate() + 3);
  gantt.config.start_date = start;
  gantt.config.end_date = naturalEnd.getTime() > minEnd.getTime() ? naturalEnd : minEnd;
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
    // "Today" flag — a small pill anchored to the line's top, matching the
    // reference design's marker (in place of a plain unlabeled line).
    const flag = document.createElement("span");
    flag.className = "gantt-today-flag";
    flag.textContent = "Today";
    line.appendChild(flag);
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


let openRowMenuEl: HTMLDivElement | null = null;

function closeRowMenu() {
  openRowMenuEl?.remove();
  openRowMenuEl = null;
}

function openRowMenu(
  anchor: HTMLElement,
  taskId: string,
  onAddChild: (id: string) => void,
  onDuplicate: (id: string) => void,
  onDelete: (id: string) => void,
) {
  closeRowMenu();

  const menu = document.createElement("div");
  menu.className = "gantt-row-menu";
  menu.innerHTML = `
    <button type="button" class="gantt-row-menu-item" data-action="add">Add subtask</button>
    <button type="button" class="gantt-row-menu-item" data-action="duplicate">Duplicate</button>
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
  menu.querySelector('[data-action="duplicate"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeRowMenu();
    onDuplicate(taskId);
  });
  menu.querySelector('[data-action="delete"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeRowMenu();
    // Confirmation is handled by the caller (a styled ConfirmationModal in
    // ProjectScheduleTab), not here — window.confirm would be a jarring
    // native browser dialog inconsistent with the rest of the app's UI.
    onDelete(taskId);
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
  onDuplicateTask,
  onStatusChange,
  onReorder,
  onGridHeaderClick,
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
  const onDuplicateTaskRef = useRef(onDuplicateTask);
  const onStatusChangeRef = useRef(onStatusChange);
  const onReorderRef = useRef(onReorder);
  const onGridHeaderClickRef = useRef(onGridHeaderClick);
  const editableRef = useRef(editable);
  useEffect(() => {
    onLinkCreateRef.current = onLinkCreate;
    onLinkDeleteRef.current = onLinkDelete;
    onTaskChangeRef.current = onTaskChange;
    onAddChildTaskRef.current = onAddChildTask;
    onDeleteTaskRef.current = onDeleteTask;
    onDuplicateTaskRef.current = onDuplicateTask;
    onStatusChangeRef.current = onStatusChange;
    onReorderRef.current = onReorder;
    onGridHeaderClickRef.current = onGridHeaderClick;
    editableRef.current = editable;
  }, [onLinkCreate, onLinkDelete, onTaskChange, onAddChildTask, onDeleteTask, onDuplicateTask, onStatusChange, onReorder, onGridHeaderClick, editable]);


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
    // The status <select> embedded in the "status" column (see
    // ProjectScheduleTab's `columns` memo) is a plain, uncontrolled DOM node
    // — not part of React's tree, so its change is picked up via delegation
    // here rather than a per-element listener, the same way row-menu clicks
    // and the inline task-name editor are wired up outside React elsewhere
    // in this file.
    const handleDocChange = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!(target instanceof HTMLSelectElement)) return;
      if (!target.classList.contains("gantt-status-select")) return;
      const rowId = target.dataset.rowId;
      if (rowId) onStatusChangeRef.current?.(rowId, target.value);
    };
    document.addEventListener("mousedown", handleDocMouseDown, true);
    document.addEventListener("change", handleDocChange, true);
    document.addEventListener("scroll", handleScroll, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocMouseDown, true);
      document.removeEventListener("change", handleDocChange, true);
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
    // Lets a row be dragged up/down among its siblings in the grid (the "Task
    // Name" column) to reorder it — separate from drag_move, which is the
    // (disabled) timeline-bar drag. order_branch_free additionally lets a
    // drag drop a task onto a different summary task, re-parenting it (e.g.
    // moving a subtask from under Task 1 to under Task 2).
    // Must be truthy here, at gantt.init() time — unlike drag_links/
    // drag_resize (checked live on every interaction), gantt only wires up
    // its row drag-n-drop module once, during init, if order_branch was
    // already truthy at that moment. Toggling it afterward (see the
    // `editable` effect below) still works for enabling/disabling actual
    // drags — via readonly, which the drag module *does* check live — but
    // toggling it from false on mount (editMode starts false) to true later
    // would never wire the module up at all, which is why dragging silently
    // did nothing before this fix.
    gantt.config.order_branch = true;
    gantt.config.order_branch_free = true;
    gantt.config.show_progress = true;
    gantt.config.row_height = 38;
    gantt.config.bar_height = 22;
    gantt.config.scale_height = 50;
    gantt.config.min_column_width = 34;
    gantt.config.autosize = "y";

    gantt.templates.task_class = (_start: Date, _end: Date, task: unknown) => {
      const t = task as GanttTask;
      // draggingTaskId (declared further down, in this same effect) is read
      // here rather than mutating a DOM node directly — dhtmlx re-renders
      // bars mid-drag on its own (to reflow rows as the grid preview
      // reorders), which would silently wipe out a one-off classList.add.
      // A template re-derives the class on every one of those re-renders
      // instead, so the "lifted" look survives them.
      const draggingClass = draggingTaskId === String(t.id) ? " gantt-dragging-bar" : "";
      return `gantt-status-${t.status}${draggingClass}`;
    };


    gantt.templates.timeline_cell_class = (_item: unknown, date: Date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const classes: string[] = [];
      if (cellContainsToday(date, finestScaleUnitRef.current, today)) {
        classes.push("gantt-today-cell");
      }
      // Light weekend shading, day-scale only — at week/month scale a
      // single cell spans more than one day, so "is this cell a weekend"
      // stops being a meaningful question.
      if (finestScaleUnitRef.current === "day" && (date.getDay() === 0 || date.getDay() === 6)) {
        classes.push("gantt-weekend-cell");
      }
      return classes.join(" ");
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
              (tid) => onDuplicateTaskRef.current?.(tid),
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

    // While a row is being dragged, gray-tint whichever row is currently
    // under the pointer, so it's clear where the dragged task will land if
    // dropped there — dhtmlx's own drag ghost (.gantt_drag_marker) has
    // pointer-events:none, so a plain mousemove + gantt.locate(e) resolves
    // straight through it to the real row underneath.
    let draggingTaskId: string | null = null;
    // The dragged row's parent *before* the drag started — captured so
    // onRowDragEnd can enforce "a task stays a task, a subtask stays a
    // subtask" (see below), since dhtmlx's own order_branch_free drag
    // freely allows either to become the other otherwise.
    let draggingOriginalParentId: string | null = null;
    // The task id of whatever row the pointer was over most recently during
    // the drag — used as the authoritative re-parent target in
    // onRowDragEnd (see below). dhtmlx's own built-in nest-vs-reorder
    // detection only recognizes "nest as child" in a thin slice near the
    // bottom of a row (confirmed by direct testing: hovering the top ~50%
    // of a target row shows no nesting indicator at all), which made
    // dropping a subtask onto a new task feel like it "did nothing" most of
    // the time. Tracking the full row the pointer is over — the same
    // element already used for the drop-target highlight — makes the whole
    // row a valid drop target instead of a sliver of it.
    let lastHoveredTaskId: string | null = null;
    let dragHighlightEl: HTMLElement | null = null;
    const clearDragHighlight = () => {
      dragHighlightEl?.classList.remove("gantt-drop-target-row");
      dragHighlightEl = null;
    };
    const handleDragMouseMove = (e: MouseEvent) => {
      const hoveredId = gantt.locate(e);
      if (hoveredId == null || String(hoveredId) === draggingTaskId) {
        lastHoveredTaskId = null;
        clearDragHighlight();
        return;
      }
      lastHoveredTaskId = String(hoveredId);
      const rowEl = gantt.getTaskRowNode(hoveredId);
      if (rowEl === dragHighlightEl) return;
      clearDragHighlight();
      if (rowEl) {
        rowEl.classList.add("gantt-drop-target-row");
        dragHighlightEl = rowEl;
      }
    };

    eventIds.push(
      gantt.attachEvent("onRowDragStart", (id: string | number) => {
        draggingTaskId = String(id);
        const parent = gantt.getTask(id).parent;
        const parentStr = parent != null ? String(parent) : "0";
        draggingOriginalParentId = parentStr === "0" ? null : parentStr;
        // Re-render just this task's bar so its "lifted" look (driven by
        // draggingTaskId, read in the task_class template above) shows up
        // immediately rather than waiting for whatever next triggers a
        // redraw.
        gantt.refreshTask(id);
        document.addEventListener("mousemove", handleDragMouseMove);
        return true;
      }),
    );

    // Row reordering/re-parenting (drag the task name up/down, or onto a
    // different summary task, in the grid) — read the full task order (and,
    // since order_branch_free allows re-parenting, each task's current
    // parent) back out of gantt once the drag settles, rather than trying to
    // compute it from the drag target, since gantt has already applied the
    // move internally by this point. gantt's root sentinel is parent id "0".
    eventIds.push(
      gantt.attachEvent("onRowDragEnd", () => {
        document.removeEventListener("mousemove", handleDragMouseMove);
        clearDragHighlight();

        const order: { id: string; parentId: string | null }[] = [];
        gantt.eachTask((task: { id: string | number; parent?: string | number }) => {
          const parentStr = task.parent != null ? String(task.parent) : "0";
          order.push({ id: String(task.id), parentId: parentStr === "0" ? null : parentStr });
        });

        // Enforce "a task stays a task, a subtask stays a subtask": a row
        // that was top-level before the drag must stay top-level no matter
        // where it's dropped (only its position changes); a row that was
        // already a subtask may be re-parented to a *different top-level
        // task* by dropping it there, but can't be promoted to top-level or
        // nested under another subtask (no 3-level nesting) — either of
        // those falls back to its original parent instead.
        if (draggingTaskId) {
          const entry = order.find((o) => o.id === draggingTaskId);
          if (entry) {
            if (draggingOriginalParentId === null) {
              entry.parentId = null;
            } else {
              const parentById = new Map(order.map((o) => [o.id, o.parentId]));
              // Prefer whatever row the pointer was actually hovering over
              // at drop time — dhtmlx's own nest-vs-reorder detection
              // (reflected in entry.parentId here) only recognizes a "nest"
              // drop in a thin slice near the bottom of the target row, so
              // relying on it alone made most drops silently fail.
              const hoveredIsTopLevelTask =
                lastHoveredTaskId != null &&
                lastHoveredTaskId !== draggingTaskId &&
                parentById.get(lastHoveredTaskId) == null;
              if (hoveredIsTopLevelTask) {
                entry.parentId = lastHoveredTaskId;
              } else {
                const dhtmlxParentIsTopLevelTask =
                  entry.parentId != null && parentById.get(entry.parentId) == null;
                entry.parentId = dhtmlxParentIsTopLevelTask
                  ? entry.parentId
                  : draggingOriginalParentId;
              }
            }
          }
        }

        const draggedId = draggingTaskId;
        draggingTaskId = null;
        draggingOriginalParentId = null;
        lastHoveredTaskId = null;
        // Clear the "lifted" look immediately (task_class now sees
        // draggingTaskId as null again) rather than waiting for the next
        // incidental re-render.
        if (draggedId) gantt.refreshTask(draggedId);
        onReorderRef.current?.(order);
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

    eventIds.push(
      gantt.attachEvent("onGridHeaderClick", (name: string, e: Event) => {
        onGridHeaderClickRef.current?.(name, e.target as HTMLElement);
        return true;
      }),
    );

    activeGanttEventIds = eventIds;

    gantt.init(containerRef.current);
    readyRef.current = true;

    return () => {
      readyRef.current = false;
      eventIds.forEach((eid) => gantt.detachEvent(eid));
      if (activeGanttEventIds === eventIds) activeGanttEventIds = [];
      document.removeEventListener("mousemove", handleDragMouseMove);
      clearDragHighlight();
      gantt.clearAll();
    };
  }, []);

  useEffect(() => {
    gantt.config.readonly = !editable;
    gantt.config.drag_links = editable;
    gantt.config.drag_resize = editable;
    gantt.config.order_branch = editable;
    gantt.config.order_branch_free = editable;
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
    gantt.config.min_column_width = 34;
    applyDayRangePadding(tasks, finestScaleUnitRef.current === "day");
    if (readyRef.current) gantt.render();
    renderTodayLine(containerRef.current, showChart);
  }, [scales, showChart, tasks]);

  useEffect(() => {
    applyDayRangePadding(tasks, finestScaleUnitRef.current === "day");
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
      status: t.status,
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
        
        .gantt_task_line {
          border-radius: 6px !important;
        }
        .gantt_task_line.gantt-status-pending { background: rgba(96, 165, 250, 0.7) !important; border: 1px solid #3b82f6 !important; }
        .gantt_task_line.gantt-status-in_progress { background: #8b5cf6 !important; border: 1px solid #7c3aed !important; }
        .gantt_task_line.gantt-status-on_hold { background: #f59e0b !important; border: 1px solid #d97706 !important; }
        .gantt_task_line.gantt-status-completed { background: #10b981 !important; border: 1px solid #059669 !important; }
        .gantt_task_line .gantt_task_progress { background: rgba(0, 0, 0, 0.18) !important; border-radius: 6px 0 0 6px !important; }
        
        /* Summary (project) bars are a slimmer, vertically-centered pill —
           matching the reference's thin bracket-style summary marker, still
           colored by status like every other bar. */
           
        .gantt_task_line.gantt_project {
          height: 10px !important;
          margin-top: 12px !important;
          border-radius: 5px !important;
        }
        .gantt_task_line.gantt_project .gantt_task_progress {
          border-radius: 5px 0 0 5px !important;
        }
        .gantt_milestone.gantt-status-pending .gantt_task_content { background: rgba(96, 165, 250, 0.7) !important; border-color: #3b82f6 !important; }
        .gantt_milestone.gantt-status-in_progress .gantt_task_content { background: #8b5cf6 !important; border-color: #7c3aed !important; }
        .gantt_milestone.gantt-status-on_hold .gantt_task_content { background: #f59e0b !important; border-color: #d97706 !important; }
        .gantt_milestone.gantt-status-completed .gantt_task_content { background: #10b981 !important; border-color: #059669 !important; }


        .gantt_task_cell.gantt-weekend-cell {
          background: #f8fafc;
        }
        .gantt-today-line {
          position: absolute;
          top: 0;
          width: 2px;
          height: 100%;
          background: #f43f5e;
          pointer-events: none;
          z-index: 1;
        }

        .gantt-today-flag {
          position: absolute;
          top: 0;
          left: 0;
          transform: translateX(-50%);
          padding: 2px 8px;
          border-radius: 4px 4px 4px 0;
          background: #f43f5e;
          color: #fff;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          pointer-events: none;
        }
        /* Grid header/row polish — lighter borders, roomier rows, a subtle
           hover highlight — matching the reference design's clean, airy
           table look instead of dhtmlx's tighter default grid chrome. */
        .gantt_grid_head_cell {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          border-color: #eef1f6 !important;
        }
        
        .gantt-day-scale-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          line-height: 1.15;
        }
        .gantt-day-scale-num {
          font-size: 12px;
          font-weight: 600;
          color: #334155;
        }
        .gantt-day-scale-dow {
          font-size: 10px;
          font-weight: 500;
          color: #94a3b8;
        }
        .gantt_grid_data .gantt_cell {
          border-color: #eef1f6 !important;
          font-size: 12.5px;
        }
        .gantt_grid_data .gantt_row:not(.gantt-drop-target-row):hover {
          background: #f8fafc;
        }
        .gantt_task_row {
          border-color: #eef1f6 !important;
        }
        

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
        .gantt-wbs-label {
          margin-right: 3px;
        }

        .gantt-row-menu-btn {
          display: none;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          padding: 0;
          line-height: 1;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -1px;
          border-radius: 4px;
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
        .gantt_row:hover .gantt-row-menu-btn {
          display: inline-flex;
        }
        
        .gantt-status-pill {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          line-height: 1.4;
          white-space: nowrap;
        }
        .gantt-status-select {
          appearance: none;
          -webkit-appearance: none;
          padding: 2px 20px 2px 8px;
          border: none;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          line-height: 1.4;
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23334155' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 6px center;
        }
        
        .gantt-columns-menu-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          padding: 0;
          line-height: 1;
          font-size: 14px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid transparent;
          background: transparent;
          color: #64748b;
          cursor: pointer;
        }
        .gantt-columns-menu-btn:hover {
          background: #eff6ff;
          border-color: #2563eb;
          color: #2563eb;
        }
        
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
          
        .gantt_tree_indent {
          width: 10px !important;
        }
        .gantt_tree_icon.gantt_open,
        .gantt_tree_icon.gantt_close,
        .gantt_tree_icon.gantt_blank {
          width: 18px !important;
        }
        /* Row drag-to-reorder (order_branch, edit mode only) — pointer cursor
           over a row's grid cells to hint it's draggable. */
        .gantt-editable .gantt_grid_data .gantt_row:hover {
          cursor: pointer;
        }
        /* Applied to whichever row is currently under the pointer while
           dragging another row over it (see onRowDragStart/handleDragMouseMove)
           — shows where the dragged task will land if dropped now. */
        .gantt-drop-target-row {
          background: #e2e8f0 !important;
        }
        
        .gantt_drag_marker {
          background: #ffffff !important;
          border-radius: 6px !important;
          box-shadow: 0 16px 28px -8px rgba(15, 23, 42, 0.28), 0 4px 10px -2px rgba(15, 23, 42, 0.16) !important;
          transform: scale(1.02) rotate(-0.6deg);
          transition: transform 0.12s ease-out, box-shadow 0.12s ease-out;
        }
        /* The row's original spot fades while its ghost is being dragged,
           reinforcing that it has been "lifted" out of the list. */
        .gantt_row[aria-grabbed="true"] {
          opacity: 0.35;
        }

        .gantt_task_line.gantt-dragging-bar {
          box-shadow: 0 14px 24px -6px rgba(15, 23, 42, 0.35), 0 4px 10px -2px rgba(15, 23, 42, 0.2) !important;
          transform: scale(1.04);
          z-index: 50;
          transition: transform 0.12s ease-out, box-shadow 0.12s ease-out;
        }
      `}</style>
      <div ref={containerRef} className={editable ? "gantt-editable" : undefined} style={{ width: "100%" }} />
    </>
  );
};

export default GanttChartView;
