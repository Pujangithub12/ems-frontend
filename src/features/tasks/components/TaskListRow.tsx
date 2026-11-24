import React from "react";
import { Check, ChevronDown, Edit2, FolderKanban, ListChecks, MessageSquare, Trash2 } from "lucide-react";
import { daysRemainingLabel, formatDate, getStatusMeta, isOverdue, StatusPill } from "../utils/taskDisplay";
import type { Task } from "../api/tasks.api";

const PRIORITY_BAR: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-emerald-500",
};

type Props = {
  task: Task;
  /** "assigned" = the Assigned Tasks list (has an Edit button);
   * "my" = the My Tasks list (no Edit button);
   * "completed" = the Completed list (no status menu or actions; the tick re-opens the task). */
  variant: "assigned" | "my" | "completed";
  onStatusChange: (taskId: number, status: string) => void;
  /** Clicking the title opens the task's details. */
  onOpen: (task: Task) => void;
  onShowFeedback?: (taskId: number) => void;
  onDelete?: (taskId: number) => void;
  /** Only used by the "assigned" variant. */
  onEdit?: (task: Task) => void;
  /** Show the project name under the title (off when the list is already grouped by project). */
  showProject?: boolean;
};

/**
 * One task on the Assigned / My / Completed lists. Memoised: the pages pass stable handlers and keep unchanged
 * task objects referentially equal, so typing in the search box or any popup doesn't re-render every row.
 */
const TaskListRow = React.memo(function TaskListRow({
  task,
  variant,
  onStatusChange,
  onOpen,
  onShowFeedback,
  onDelete,
  onEdit,
  showProject = true,
}: Props) {
  const isCompletedList = variant === "completed";
  const overdue = isOverdue(task.dueDate, task.status);
  const completed = task.status === "completed";
  const remaining = daysRemainingLabel(task.dueDate, task.status);
  const statusMeta = getStatusMeta(task.status);
  const project = task.project?.name || task.projectName || "";
  const subTaskCount = task.subTasks?.length ?? 0;
  const priorityBar = PRIORITY_BAR[task.priority?.toLowerCase()] ?? "bg-slate-300";
  const dueValid = !!task.dueDate && !Number.isNaN(new Date(task.dueDate).getTime());

  return (
    <div
      className={`group relative flex items-center gap-3 pl-4 pr-3 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 transition-colors ${
        completed && !isCompletedList ? "opacity-60" : ""
      }`}
    >
      {/* priority accent */}
      <span className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full ${priorityBar}`} aria-hidden />

      <button
        onClick={() => onStatusChange(task.id, completed ? "to_do" : "completed")}
        className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          completed ? "bg-emerald-600 border-emerald-600" : "border-slate-300 hover:border-emerald-600 hover:bg-emerald-50"
        }`}
        title={completed ? "Mark as pending" : "Mark as completed"}
      >
        {completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>

      {/* title + meta */}
      <button onClick={() => onOpen(task)} className="flex-1 min-w-0 text-left">
        <p
          className={`text-[13.5px] font-medium text-slate-900 truncate group-hover:text-blue-900 ${
            completed ? "line-through text-slate-500" : ""
          }`}
        >
          {task.title}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-slate-500">
          {showProject &&
            (project ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 max-w-[200px]">
                <FolderKanban className="flex-shrink-0 w-3 h-3" />
                <span className="truncate">{project}</span>
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">No project</span>
            ))}
          {/* due date inline on small screens (it has its own column on wider ones) */}
          {dueValid && (
            <span className={`sm:hidden ${overdue ? "text-red-600 font-medium" : ""}`}>Due {formatDate(task.dueDate)}</span>
          )}
          {subTaskCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="w-3 h-3" /> {subTaskCount} subtask{subTaskCount === 1 ? "" : "s"}
            </span>
          )}
          {task.createdBy && <span className="text-slate-400 truncate">by {task.createdBy.fullName}</span>}
        </div>
      </button>

      {/* assignees */}
      <div className="hidden md:flex w-[92px] flex-shrink-0 items-center">
        {task.assignedUsers.length === 0 ? (
          <span className="text-[11px] text-slate-400">Unassigned</span>
        ) : (
          <div className="flex -space-x-1.5">
            {task.assignedUsers.slice(0, 3).map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-center w-6 h-6 text-[9px] font-semibold text-white bg-blue-900 border-2 border-white rounded-full"
                title={u.fullName}
              >
                {u.fullName.charAt(0).toUpperCase()}
              </div>
            ))}
            {task.assignedUsers.length > 3 && (
              <div
                className="flex items-center justify-center w-6 h-6 text-[9px] font-semibold border-2 border-white rounded-full text-slate-600 bg-slate-200"
                title={task.assignedUsers.slice(3).map((u) => u.fullName).join(", ")}
              >
                +{task.assignedUsers.length - 3}
              </div>
            )}
          </div>
        )}
      </div>

      {/* due */}
      <div className="hidden sm:block w-[132px] flex-shrink-0 leading-tight">
        {dueValid ? (
          <>
            <div className={`text-[12px] ${overdue ? "text-red-600 font-medium" : "text-slate-700"}`}>{formatDate(task.dueDate)}</div>
            {remaining && (
              <div className={`text-[11px] mt-0.5 ${overdue ? "text-red-500" : remaining === "Due today" ? "text-amber-600" : "text-slate-400"}`}>
                {remaining}
              </div>
            )}
          </>
        ) : (
          <span className="text-[12px] text-slate-400">—</span>
        )}
      </div>

      {/* priority */}
      <div className="hidden md:block w-[76px] flex-shrink-0">
        <StatusPill type="priority" value={task.priority} />
      </div>

      {!isCompletedList && (
        <>
          {/* status */}
          <div className="relative flex-shrink-0 w-[118px] hidden sm:block">
            <select
              value={task.status}
              onChange={(e) => onStatusChange(task.id, e.target.value)}
              className="w-full pl-2.5 pr-6 py-1 text-[11.5px] font-medium rounded-full outline-none appearance-none cursor-pointer ring-1 ring-inset ring-black/5"
              style={{ background: statusMeta.bg, color: statusMeta.fg }}
            >
              <option value="to_do">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
            <ChevronDown
              className="absolute w-3 h-3 -translate-y-1/2 pointer-events-none right-2 top-1/2"
              style={{ color: statusMeta.fg }}
            />
          </div>

          {/* actions */}
          <div className="flex items-center justify-end flex-shrink-0 gap-0.5 sm:w-[88px] lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 transition-opacity">
            {onShowFeedback && (
              <button
                onClick={() => onShowFeedback(task.id)}
                className="p-1.5 transition-colors rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50"
                title="Show Feedback"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            )}
            {variant === "assigned" && onEdit && (
              <button
                onClick={() => onEdit(task)}
                className="p-1.5 transition-colors rounded-lg text-slate-400 hover:text-blue-900 hover:bg-blue-50"
                title="Edit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(task.id)}
                className="p-1.5 transition-colors rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50"
                title={variant === "assigned" ? "Delete" : "Delete task"}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
});

export default TaskListRow;
