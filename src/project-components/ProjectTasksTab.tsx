import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Calendar,
  User as UserIcon,
  X,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { useAuth } from "../context/AuthProvider";
import { Project, ProjectTask } from "../types";
import { flattenProjectTasks } from "./taskUtils";
import ConfirmationModal from "../components/ConfirmationModal";
import { useHierarchy } from "../hooks/useHierarchy";
import { getDescendantUserIds } from "../lib/hierarchyAuthority";
import {
  useUpdateTaskStatus,
  useCreateProjectTask,
  useUpdateTask,
  useDeleteTask,
} from "../hooks/useTasks";
import { getErrorMessage } from "../lib/errors";

interface ProjectTasksTabProps {
  project: Project;
  onTaskUpdate?: () => void;
}

type TaskStatus = "pending" | "in_progress" | "completed" | "on_hold";

const COLUMNS: { status: TaskStatus; title: string; accent: string }[] = [
  { status: "pending", title: "Pending", accent: "border-t-slate-400" },
  { status: "in_progress", title: "In Progress", accent: "border-t-amber-400" },
  { status: "on_hold", title: "On Hold", accent: "border-t-rose-400" },
  { status: "completed", title: "Completed", accent: "border-t-emerald-500" },
];

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-rose-50 text-rose-600 border-rose-100",
  medium: "bg-amber-50 text-amber-600 border-amber-100",
  low: "bg-emerald-50 text-emerald-600 border-emerald-100",
};

const TaskCardContent: React.FC<{
  task: ProjectTask;
  canManage?: boolean;
  isMenuOpen?: boolean;
  menuRef?: React.RefObject<HTMLDivElement>;
  onToggleMenu?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}> = ({ task, canManage, isMenuOpen, menuRef, onToggleMenu, onEdit, onDelete }) => {
  return (
    <div className="p-3 bg-white border border-slate-200 rounded-md shadow-sm hover:shadow-md hover:border-slate-300 transition-all">
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-semibold text-slate-400"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          TSK-{String(task.id).padStart(4, "0")}
        </span>
        <div className="flex items-center gap-1">
          {task.priority && (
            <span
              className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium
              }`}
            >
              {task.priority}
            </span>
          )}
          {canManage && (
            <div className="relative">
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMenu?.();
                }}
                className="flex items-center justify-center w-5 h-5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Task options"
              >
                <MoreVertical size={13} />
              </button>
              {isMenuOpen && (
                <div
                  ref={menuRef}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute right-0 top-6 z-20 w-32 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.();
                    }}
                    className="flex items-center w-full gap-2 px-3 py-2 text-[12px] text-left text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil size={12} className="text-slate-400" />
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.();
                    }}
                    className="flex items-center w-full gap-2 px-3 py-2 text-[12px] text-left text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <h4 className="text-[13px] font-medium text-slate-900 leading-snug mb-2">
        {task.title}
      </h4>

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1">
          <UserIcon size={11} />
          <span className="truncate max-w-[90px]">
            {task.assignedUsers && task.assignedUsers.length > 0
              ? task.assignedUsers[0]?.fullName
              : "Unassigned"}
          </span>
        </div>
        {task.dueDate && (
          <div className="flex items-center gap-1">
            <Calendar size={11} />
            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {typeof task.progress === "number" && task.progress > 0 && (
        <div className="mt-2">
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-900 rounded-full"
              style={{ width: `${task.progress}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400">{task.progress}%</span>
        </div>
      )}
    </div>
  );
};

const TaskCard: React.FC<{
  task: ProjectTask;
  canManage?: boolean;
  isMenuOpen?: boolean;
  menuRef?: React.RefObject<HTMLDivElement>;
  onToggleMenu?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}> = ({ task, canManage, isMenuOpen, menuRef, onToggleMenu, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `task-${task.id}` });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <TaskCardContent
        task={task}
        canManage={canManage}
        isMenuOpen={isMenuOpen}
        menuRef={menuRef}
        onToggleMenu={onToggleMenu}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
};

const TaskColumn: React.FC<{
  status: TaskStatus;
  title: string;
  accent: string;
  tasks: ProjectTask[];
  canAddTask: boolean;
  onAddTask: () => void;
  canManageTasks: boolean;
  openMenuTaskId: number | null;
  menuRef: React.RefObject<HTMLDivElement>;
  onToggleMenu: (taskId: number) => void;
  onEditTask: (task: ProjectTask) => void;
  onDeleteTask: (task: ProjectTask) => void;
}> = ({
  status,
  title,
  accent,
  tasks,
  canAddTask,
  onAddTask,
  canManageTasks,
  openMenuTaskId,
  menuRef,
  onToggleMenu,
  onEditTask,
  onDeleteTask,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col min-w-[260px] flex-1">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-semibold rounded">
            {tasks.length}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2 p-2 rounded-md border-t-2 bg-slate-50/60 min-h-[300px] transition-colors ${accent} ${
          isOver ? "bg-blue-50/60 ring-1 ring-blue-200" : ""
        }`}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            canManage={canManageTasks}
            isMenuOpen={openMenuTaskId === task.id}
            menuRef={menuRef}
            onToggleMenu={() => onToggleMenu(task.id)}
            onEdit={() => onEditTask(task)}
            onDelete={() => onDeleteTask(task)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-6 text-[11px] text-slate-400">
            No tasks
          </div>
        )}
        {canAddTask && (
          <button
            onClick={onAddTask}
            className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-slate-500 hover:text-blue-900 hover:bg-white rounded transition-colors"
          >
            <Plus size={13} /> Add Task
          </button>
        )}
      </div>
    </div>
  );
};

const AddTaskModal: React.FC<{
  status: TaskStatus;
  assignees: Array<{ id: number; fullName: string }>;
  onClose: () => void;
  onCreate: (payload: {
    title: string;
    description: string;
    dueDate: string;
    priority: string;
    assignedUserIds: number[];
    status: TaskStatus;
  }) => Promise<void>;
}> = ({ status, assignees, onClose, onCreate }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedUserIds, setAssignedUserIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAssignee = (id: number) => {
    setAssignedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !dueDate) {
      setError("Title, description and due date are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ title, description, dueDate, priority, assignedUserIds, status });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create task.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-[14px] font-semibold text-slate-900">
            New Task &middot; {COLUMNS.find((c) => c.status === status)?.title}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-500">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          {error && (
            <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}
          <div>
            <label className="text-[11px] font-medium text-slate-500">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              placeholder="Task title"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full mt-1 px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400 resize-none"
              placeholder="What needs to be done?"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-slate-500">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-medium text-slate-500">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          {assignees.length > 0 && (
            <div>
              <label className="text-[11px] font-medium text-slate-500">Assign To</label>
              <div className="mt-1 max-h-32 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100">
                {assignees.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-slate-700 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={assignedUserIds.includes(a.id)}
                      onChange={() => toggleAssignee(a.id)}
                    />
                    {a.fullName}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 p-4 pt-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
};

const EditTaskModal: React.FC<{
  task: ProjectTask;
  assignees: Array<{ id: number; fullName: string }>;
  onClose: () => void;
  onSave: (payload: {
    title: string;
    description: string;
    dueDate: string;
    priority: string;
    status: TaskStatus;
    assignedUserIds: number[];
  }) => Promise<void>;
}> = ({ task, assignees, onClose, onSave }) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [dueDate, setDueDate] = useState(
    task.dueDate ? task.dueDate.slice(0, 10) : "",
  );
  const [priority, setPriority] = useState<string>(task.priority || "medium");
  const [status, setStatus] = useState<TaskStatus>(
    (task.status as TaskStatus) || "pending",
  );
  const [assignedUserIds, setAssignedUserIds] = useState<number[]>(
    task.assignedUsers?.map((u) => u.id) || [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAssignee = (id: number) => {
    setAssignedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !dueDate) {
      setError("Title, description and due date are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSave({ title, description, dueDate, priority, status, assignedUserIds });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update task.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-[14px] font-semibold text-slate-900">
            Edit Task &middot; TSK-{String(task.id).padStart(4, "0")}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-500">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          {error && (
            <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}
          <div>
            <label className="text-[11px] font-medium text-slate-500">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              placeholder="Task title"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full mt-1 px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400 resize-none"
              placeholder="What needs to be done?"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-slate-500">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-medium text-slate-500">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full mt-1 px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
            >
              {COLUMNS.map((c) => (
                <option key={c.status} value={c.status}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          {assignees.length > 0 && (
            <div>
              <label className="text-[11px] font-medium text-slate-500">Assign To</label>
              <div className="mt-1 max-h-32 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100">
                {assignees.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-slate-700 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={assignedUserIds.includes(a.id)}
                      onChange={() => toggleAssignee(a.id)}
                    />
                    {a.fullName}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 p-4 pt-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const ProjectTasksTab: React.FC<ProjectTasksTabProps> = ({ project, onTaskUpdate }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const hierarchyQuery = useHierarchy();

  // Who the current user is allowed to assign a project task to: themselves,
  // plus anyone below them in the hierarchy tree — mirrors the backend's
  // assignment check. Super admin (the account's root) can assign to any
  // project member.
  const assignableMembers = useMemo(() => {
    const members = [...(project.assignees || [])].sort((a, b) =>
      a.fullName.localeCompare(b.fullName),
    );
    if (!user) return members;
    if (user.role === "super_admin") return members;
    const currentUserId = Number(user.id);
    const descendantIds = new Set(
      getDescendantUserIds(hierarchyQuery.data || [], currentUserId),
    );
    return members.filter((m) => m.id === currentUserId || descendantIds.has(m.id));
  }, [project.assignees, user, hierarchyQuery.data]);

  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [activeTask, setActiveTask] = useState<ProjectTask | null>(null);
  const [addTaskStatus, setAddTaskStatus] = useState<TaskStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [openMenuTaskId, setOpenMenuTaskId] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<ProjectTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectTask | null>(null);
  const [deleting, setDeleting] = useState(false);
  const taskMenuRef = useRef<HTMLDivElement>(null);

  const updateTaskStatusMutation = useUpdateTaskStatus();
  const createProjectTaskMutation = useCreateProjectTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

  useEffect(() => {
    setTasks(flattenProjectTasks(project));
  }, [project]);

  useEffect(() => {
    if (openMenuTaskId === null) return;
    const handler = (e: MouseEvent) => {
      if (taskMenuRef.current && !taskMenuRef.current.contains(e.target as Node)) {
        setOpenMenuTaskId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuTaskId]);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const handleDragStart = (event: DragStartEvent) => {
    const id = Number(String(event.active.id).replace("task-", ""));
    setActiveTask(tasks.find((t) => t.id === id) || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const taskId = Number(String(active.id).replace("task-", ""));
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    const previousStatus = task.status;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );

    try {
      await updateTaskStatusMutation.mutateAsync({ id: taskId, status: newStatus });
      onTaskUpdate?.();
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t)),
      );
      setError(getErrorMessage(err, "Failed to update task status."));
    }
  };

  const handleCreateTask = async (payload: {
    title: string;
    description: string;
    dueDate: string;
    priority: string;
    assignedUserIds: number[];
    status: TaskStatus;
  }) => {
    await createProjectTaskMutation.mutateAsync({ projectId: project.id, payload });
    setAddTaskStatus(null);
    onTaskUpdate?.();
  };

  const handleToggleTaskMenu = (taskId: number) => {
    setOpenMenuTaskId((prev) => (prev === taskId ? null : taskId));
  };

  const handleOpenEditTask = (task: ProjectTask) => {
    setOpenMenuTaskId(null);
    setEditTarget(task);
  };

  const handleOpenDeleteTask = (task: ProjectTask) => {
    setOpenMenuTaskId(null);
    setDeleteTarget(task);
  };

  const handleSaveEdit = async (payload: {
    title: string;
    description: string;
    dueDate: string;
    priority: string;
    status: TaskStatus;
    assignedUserIds: number[];
  }) => {
    if (!editTarget) return;
    const updated = await updateTaskMutation.mutateAsync({
      id: editTarget.id,
      payload: {
        title: payload.title,
        description: payload.description,
        dueDate: payload.dueDate,
        priority: payload.priority,
        status: payload.status,
        userIds: payload.assignedUserIds,
      },
    });
    setTasks((prev) => prev.map((t) => (t.id === editTarget.id ? (updated as any) : t)));
    setEditTarget(null);
    onTaskUpdate?.();
  };

  const handleConfirmDeleteTask = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTaskMutation.mutateAsync(deleteTarget.id);
      setTasks((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
      onTaskUpdate?.();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete task."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Task Board</h3>
        <span className="text-slate-500 text-sm">{tasks.length} tasks</span>
      </div>

      {error && (
        <div className="flex items-center justify-between px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-2">
          {COLUMNS.map((col) => (
            <TaskColumn
              key={col.status}
              status={col.status}
              title={col.title}
              accent={col.accent}
              tasks={tasks.filter((t) => (t.status || "pending") === col.status)}
              canAddTask={isAdmin}
              onAddTask={() => setAddTaskStatus(col.status)}
              canManageTasks={isAdmin}
              openMenuTaskId={openMenuTaskId}
              menuRef={taskMenuRef}
              onToggleMenu={handleToggleTaskMenu}
              onEditTask={handleOpenEditTask}
              onDeleteTask={handleOpenDeleteTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="w-64">
              <TaskCardContent task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {addTaskStatus && (
        <AddTaskModal
          status={addTaskStatus}
          assignees={assignableMembers}
          onClose={() => setAddTaskStatus(null)}
          onCreate={handleCreateTask}
        />
      )}

      {editTarget && (
        <EditTaskModal
          task={editTarget}
          assignees={assignableMembers}
          onClose={() => setEditTarget(null)}
          onSave={handleSaveEdit}
        />
      )}

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDeleteTask}
        isLoading={deleting}
        title="Delete Task"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
      />
    </div>
  );
};

export default ProjectTasksTab;
