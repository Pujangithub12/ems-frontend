import React, { useEffect, useMemo, useState } from "react";
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
  Trash2,
  Flag,
  Filter,
} from "lucide-react";
import { useAuth } from "../../../../context/AuthProvider";
import { Project, ProjectTask } from "../../../../types";
import { flattenProjectTasks } from "../../../tasks/utils/taskUtils";
import ConfirmationModal from "../../../../components/ConfirmationModal";
import Drawer, { DrawerSection } from "../../../../components/Drawer";
import { useHierarchy } from "../../../hierarchy/hooks/useHierarchy";
import { getDescendantUserIds } from "../../../../lib/hierarchyAuthority";
import {
  useUpdateTaskStatus,
  useCreateProjectTask,
  useUpdateTask,
  useUpdateTaskProgress,
  useDeleteTask,
} from "../../../tasks/hooks/useTasks";
import { getErrorMessage } from "../../../../lib/errors";

interface ProjectTasksTabProps {
  project: Project;
  onTaskUpdate?: () => void;
}

type TaskStatus = "to_do" | "in_progress" | "completed" | "on_hold";

const COLUMNS: { status: TaskStatus; title: string; accent: string }[] = [
  { status: "to_do", title: "To Do", accent: "border-t-slate-400" },
  { status: "in_progress", title: "In Progress", accent: "border-t-amber-400" },
  { status: "on_hold", title: "On Hold", accent: "border-t-rose-400" },
  { status: "completed", title: "Completed", accent: "border-t-emerald-500" },
];

const PRIORITY_STYLES: Record<string, string> = {
  high: "text-rose-600",
  medium: "text-amber-600",
  low: "text-emerald-600",
};

const TaskCardContent: React.FC<{
  task: ProjectTask;
}> = ({ task }) => {
  return (
    <div className="p-3 bg-white border border-slate-200 rounded-md shadow-sm hover:shadow-md hover:border-slate-300 transition-all">
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-semibold text-slate-400"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          TSK-{String(task.id).padStart(4, "0")}
        </span>
        {task.priority && (
          <span
            className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide ${
              PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium
            }`}
          >
            <Flag className="w-2.5 h-2.5" fill="currentColor" strokeWidth={1.5} />
            {task.priority}
          </span>
        )}
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
  onOpenDetail?: () => void;
}> = ({ task, onOpenDetail }) => {
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
      onClick={onOpenDetail}
      className={isDragging ? "cursor-grabbing" : "cursor-pointer"}
    >
      <TaskCardContent task={task} />
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
  onOpenDetail: (task: ProjectTask) => void;
}> = ({
  status,
  title,
  accent,
  tasks,
  canAddTask,
  onAddTask,
  onOpenDetail,
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
            onOpenDetail={() => onOpenDetail(task)}
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

type TaskEditPayload = {
  title: string;
  description: string;
  dueDate: string;
  priority: string;
  status: TaskStatus;
  assignedUserIds: number[];
};

const TaskDetailDrawer: React.FC<{
  task: ProjectTask | null;
  canManage: boolean;
  assignees: Array<{ id: number; fullName: string }>;
  onClose: () => void;
  onSave: (id: number, payload: TaskEditPayload) => Promise<void>;
  onProgressSave: (id: number, progress: number) => Promise<void>;
  onDelete: (task: ProjectTask) => void;
  /** Jumps the drawer to one of this task's Gantt-nested children (see
   * task.childTasks) so they're reachable from here too, not just the
   * Schedule tab. */
  onOpenChild: (id: number) => void;
}> = ({ task, canManage, assignees, onClose, onSave, onProgressSave, onDelete, onOpenChild }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState<TaskStatus>("to_do");
  const [assignedUserIds, setAssignedUserIds] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever a different task is opened (not on every prop
  // update, so an in-flight edit isn't clobbered by a background refetch) —
  // same pattern as PurchaseOrderDetail's OverviewTab.
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description || "");
    setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
    setPriority(task.priority || "medium");
    setStatus((task.status as TaskStatus) || "to_do");
    setAssignedUserIds(task.assignedUsers?.map((u) => u.id) || []);
    setProgress(typeof task.progress === "number" ? task.progress : 0);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  const toggleAssignee = (id: number) => {
    setAssignedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (!task) return;
    if (!title.trim() || !description.trim() || !dueDate) {
      setError("Title, description and due date are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Progress goes through its own dedicated endpoint, and deliberately
      // AFTER the general field save: PUT /tasks/:id recomputes progress
      // from the task's subtasks (defaulting to 0 when there are none)
      // right after applying whatever was sent, which would otherwise
      // clobber this value straight back to 0/whatever the subtasks imply.
      await onSave(task.id, { title, description, dueDate, priority, status, assignedUserIds });
      await onProgressSave(task.id, progress);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update task."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={!!task}
      onClose={onClose}
      title={task ? task.title : ""}
      subtitle={task ? `TSK-${String(task.id).padStart(4, "0")}` : undefined}
    >
      {task && (
        <>
          {error && (
            <div className="mx-5 mt-4 px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}

          <DrawerSection title="Overview">
            <div>
              <label className="text-[11px] font-medium text-slate-500">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canManage}
                className="w-full mt-1 px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Task title"
              />
            </div>
            <div className="flex gap-3 mt-3">
              <div className="flex-1">
                <label className="text-[11px] font-medium text-slate-500">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  disabled={!canManage}
                  className="w-full mt-1 px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500"
                >
                  {COLUMNS.map((c) => (
                    <option key={c.status} value={c.status}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-medium text-slate-500">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={!canManage}
                  className="w-full mt-1 px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-medium text-slate-500">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={!canManage}
                  className="w-full mt-1 px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-slate-500">Progress</label>
                {canManage ? (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={progress}
                    onChange={(e) =>
                      setProgress(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                    }
                    className="w-16 px-2 py-1 text-[12px] text-right border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                ) : (
                  <span className="text-[12px] font-medium text-slate-500">{progress}%</span>
                )}
              </div>
              {canManage ? (
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="w-full mt-2 accent-blue-900"
                />
              ) : (
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-900 rounded-full" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          </DrawerSection>

          <DrawerSection title="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canManage}
              rows={4}
              className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400 resize-none disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="What needs to be done?"
            />
          </DrawerSection>

          {task.childTasks && task.childTasks.length > 0 && (
            <DrawerSection title="Subtasks">
              <div className="flex flex-col gap-1.5">
                {task.childTasks.map((child) => {
                  const col = COLUMNS.find((c) => c.status === (child.status || "to_do"));
                  return (
                    <button
                      key={child.id}
                      onClick={() => onOpenChild(child.id)}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 text-left border border-slate-200 rounded hover:bg-slate-50"
                    >
                      <span className="text-[13px] text-slate-700 truncate">{child.title}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400">
                          {typeof child.progress === "number" ? `${child.progress}%` : ""}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap">
                          {col?.title || child.status}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </DrawerSection>
          )}

          <DrawerSection title="Assigned To">
            {canManage && assignees.length > 0 ? (
              <div className="max-h-32 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100">
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
            ) : task.assignedUsers && task.assignedUsers.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {task.assignedUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 text-[13px] text-slate-700">
                    <UserIcon size={13} className="text-slate-400" />
                    {u.fullName}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-slate-400">Unassigned</p>
            )}
          </DrawerSection>

          {canManage && (
            <DrawerSection title="Actions">
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving && <Loader2 size={12} className="animate-spin" />}
                  Save Changes
                </button>
                <button
                  onClick={() => onDelete(task)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-red-600 border border-red-200 rounded hover:bg-red-50"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </DrawerSection>
          )}
        </>
      )}
    </Drawer>
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

  const [deleteTarget, setDeleteTarget] = useState<ProjectTask | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailTask, setDetailTask] = useState<ProjectTask | null>(null);

  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<"all" | number>("all");

  const updateTaskStatusMutation = useUpdateTaskStatus();
  const createProjectTaskMutation = useCreateProjectTask();
  const updateTaskMutation = useUpdateTask();
  const updateTaskProgressMutation = useUpdateTaskProgress();
  const deleteTaskMutation = useDeleteTask();

  useEffect(() => {
    setTasks(flattenProjectTasks(project));
  }, [project]);

  // A minimum drag distance before dnd-kit starts tracking a drag — without
  // this, the tiniest pointer jitter inside a plain click (mousedown/mouseup
  // at effectively the same spot) gets treated as a drag, and dnd-kit
  // suppresses the resulting click event to stop drag-drop from also
  // registering as a click. That swallowed onOpenDetail entirely, so a card
  // click did nothing. 8px is comfortably above normal click jitter but well
  // under an intentional drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

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

  const handleOpenDeleteTask = (task: ProjectTask) => {
    setDeleteTarget(task);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (priorityFilter !== "all" && (t.priority || "medium") !== priorityFilter) return false;
      if (assigneeFilter !== "all" && !(t.assignedUsers || []).some((u) => u.id === assigneeFilter)) {
        return false;
      }
      return true;
    });
  }, [tasks, priorityFilter, assigneeFilter]);

  // Latest data for whichever task the drawer is showing — kept live so a
  // drag-driven status change updates the open drawer instead of it going
  // stale, the same way deleteTarget would if reopened.
  const openDetailTask = detailTask
    ? tasks.find((t) => t.id === detailTask.id) ?? detailTask
    : null;

  const handleSaveDetail = async (id: number, payload: TaskEditPayload) => {
    const updated = await updateTaskMutation.mutateAsync({
      id,
      payload: {
        title: payload.title,
        description: payload.description,
        dueDate: payload.dueDate,
        priority: payload.priority,
        status: payload.status,
        userIds: payload.assignedUserIds,
      },
    });
    setTasks((prev) => prev.map((t) => (t.id === id ? (updated as any) : t)));
    setDetailTask(updated as any);
    onTaskUpdate?.();
  };

  const handleSaveProgress = async (id: number, progress: number) => {
    const updated = await updateTaskProgressMutation.mutateAsync({ id, progress });
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, progress: (updated as any).progress } : t)));
    setDetailTask((prev) => (prev && prev.id === id ? { ...prev, progress: (updated as any).progress } : prev));
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] font-medium text-slate-600 rounded-md hover:bg-slate-100">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
              className="bg-transparent focus:outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] font-medium text-slate-600 rounded-md hover:bg-slate-100">
            <UserIcon className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={assigneeFilter}
              onChange={(e) =>
                setAssigneeFilter(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              className="bg-transparent focus:outline-none"
            >
              <option value="all">All Assignees</option>
              {assignableMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <span className="text-slate-500 text-sm shrink-0">{filteredTasks.length} tasks</span>
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
              tasks={filteredTasks.filter((t) => (t.status || "to_do") === col.status)}
              canAddTask={isAdmin && col.status !== "completed"}
              onAddTask={() => setAddTaskStatus(col.status)}
              onOpenDetail={(task) => setDetailTask(task)}
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

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDeleteTask}
        isLoading={deleting}
        title="Delete Task"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
      />

      <TaskDetailDrawer
        task={openDetailTask}
        canManage={isAdmin}
        assignees={assignableMembers}
        onClose={() => setDetailTask(null)}
        onSave={handleSaveDetail}
        onProgressSave={handleSaveProgress}
        onDelete={(task) => {
          setDetailTask(null);
          handleOpenDeleteTask(task);
        }}
        onOpenChild={(id) => {
          const child = tasks.find((t) => t.id === id);
          if (child) setDetailTask(child);
        }}
      />
    </div>
  );
};

export default ProjectTasksTab;
