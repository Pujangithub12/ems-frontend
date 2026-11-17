import React from "react";
import { Calendar, Check, ChevronDown, Clock, Edit2, MessageSquare, Trash2 } from "lucide-react";
import { daysRemainingLabel, formatDate, isOverdue, StatusPill } from "../utils/taskDisplay";
import type { Task } from "../api/tasks.api";

const STATUS_COLOR: Record<string, string> = {
  completed: "text-emerald-600",
  in_progress: "text-amber-600",
  on_hold: "text-orange-600",
};

type Props = {
  task: Task;
  /** "assigned" = the Assigned Tasks list (Edit button, Calendar icon, click expands the task);
   * "my" = the My Tasks list (no Edit button, Clock icon, click opens the details popup). */
  variant: "assigned" | "my";
  onStatusChange: (taskId: number, status: string) => void;
  /** Clicking the title: expands the task (assigned) or opens its popup (my). */
  onOpen: (task: Task) => void;
  onShowFeedback: (taskId: number) => void;
  onDelete: (taskId: number) => void;
  /** Only used by the "assigned" variant. */
  onEdit?: (task: Task) => void;
};

/**
 * One row of a project group on the Assigned Tasks / My Tasks lists. Memoised: the pages pass stable
 * handlers and keep unchanged task objects referentially equal, so typing in the search box or any
 * popup no longer re-renders every row.
 */
const TaskListRow = React.memo(function TaskListRow({ task, variant, onStatusChange, onOpen, onShowFeedback, onDelete, onEdit }: Props) {
  const isAssignedList = variant === "assigned";
  const overdue = isOverdue(task.dueDate, task.status);
  const completed = task.status === "completed";
  const statusColor = STATUS_COLOR[task.status] ?? "text-slate-500";
  const remaining = daysRemainingLabel(task.dueDate, task.status);
  const DueIcon = isAssignedList ? Calendar : Clock;

  return (
    <div
      className={`group flex items-center gap-3 px-2.5 py-2.5 ${isAssignedList ? "rounded-lg" : "rounded-md"} hover:bg-slate-50/60 transition-colors ${
        completed ? "opacity-60" : ""
      }`}
    >
      <button
        onClick={() => onStatusChange(task.id, completed ? "to_do" : "completed")}
        className={`w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          completed ? "bg-emerald-600 border-emerald-600" : "border-slate-300 hover:border-blue-900"
        }`}
        title="Mark as completed"
      >
        {completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>
      <button onClick={() => onOpen(task)} className="flex-1 min-w-0 text-left">
        <p className={`text-[13px] font-medium text-slate-900 truncate ${completed ? "line-through" : ""}`}>{task.title}</p>
        <p className={`flex items-center gap-1 text-[11px] mt-0.5 ${overdue ? "text-red-600" : "text-slate-500"}`}>
          <DueIcon className="w-3 h-3" /> Due {formatDate(task.dueDate)}
          {remaining && <span className="font-medium text-red-600"> · {remaining}</span>}
          {task.createdBy && <span className="text-slate-400"> · Assigned by {task.createdBy.fullName}</span>}
        </p>
      </button>
      <div className="flex-shrink-0">
        <StatusPill type="priority" value={task.priority} />
      </div>
      <div className="relative flex-shrink-0 hidden sm:block">
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value)}
          className={`text-[12px] font-medium bg-transparent outline-none appearance-none cursor-pointer text-right pr-4 ${statusColor}`}
        >
          <option value="to_do">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
        </select>
        <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
      </div>
      <div className="flex-shrink-0 -space-x-1 flex">
        {task.assignedUsers.length === 0 ? (
          <span className="text-[11px] text-slate-400">Unassigned</span>
        ) : (
          task.assignedUsers.slice(0, 3).map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-center w-6 h-6 text-[9px] font-semibold text-white bg-blue-900 border-2 border-white rounded-full"
              title={u.fullName}
            >
              {u.fullName.charAt(0)}
            </div>
          ))
        )}
      </div>
      <div className="items-center flex-shrink-0 hidden gap-1 sm:flex">
        <button
          onClick={() => onShowFeedback(task.id)}
          className="p-1.5 transition-colors rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50"
          title="Show Feedback"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
        {isAssignedList && onEdit && (
          <button
            onClick={() => onEdit(task)}
            className="p-1.5 transition-colors rounded-lg text-slate-400 hover:text-blue-900 hover:bg-blue-50"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => onDelete(task.id)}
          className={`p-1.5 transition-colors rounded-lg text-slate-400 hover:bg-red-50 ${isAssignedList ? "hover:text-red-700" : "hover:text-red-600"}`}
          title={isAssignedList ? "Delete" : "Delete task"}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});

export default TaskListRow;
