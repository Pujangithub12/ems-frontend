import api from "../../../api/axios";

export type AssignedUser = { id: number; fullName: string; email: string };

export type Task = {
  id: number;
  title: string;
  description?: string;
  priority: string;
  status: string;
  progress: number;
  dueDate: string;
  assignedUsers: AssignedUser[];
  files?: string[];
  createdAt: string;
  subTasks: { id: number; title: string; status: string; estimatedDays?: number | null; children?: any[] }[];
  projectName?: string;
  project?: { id: number; name: string; status?: string };
  createdBy?: { id: number; fullName: string };
  /** Gantt-nested children (Task.parentTaskId, set via the Schedule tab's
   * "add child task") — each child is also its own entry in the fetched
   * task list (just filtered out of the top-level view client-side), this
   * is a lightweight summary for the nested display. */
  childTasks?: Array<{ id: number; title: string; status?: string; progress?: number }>;
  /** Set when this task is itself one of the above — a Gantt-nested child of
   * another task, not a top-level task. */
  parentTaskId?: number | null;
};

/** GET /api/tasks — the full organization task list (used by both the summary bar and the task list pages). */
export async function getTasks(): Promise<Task[]> {
  const res = await api.get<Task[]>("/api/tasks");
  return Array.isArray(res.data) ? res.data : [];
}

export type CreateTaskPayload = {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
  assignedUserIds?: number[];
};

export type UpdateTaskPayload = Partial<{
  title: string;
  description: string;
  dueDate: string;
  priority: string;
  status: string;
  userIds: number[];
}>;

/** POST /api/tasks — create a task not scoped to any project (FormData supports attachments). */
export async function createTask(payload: FormData): Promise<Task> {
  const res = await api.post("/api/tasks", payload);
  return res.data.task ?? res.data;
}

/** POST /api/projects/:projectId/tasks — create a task scoped to a project. */
export async function createProjectTask(
  projectId: number | string,
  payload: CreateTaskPayload,
): Promise<Task> {
  const res = await api.post(`/api/projects/${projectId}/tasks`, payload);
  return res.data.task ?? res.data;
}

/** PUT /api/tasks/:id — accepts either a plain object or FormData (for attachment updates). */
export async function updateTask(
  id: number,
  payload: UpdateTaskPayload | FormData,
): Promise<Task> {
  const res = await api.put(`/api/tasks/${id}`, payload);
  return res.data.task ?? res.data;
}

/** PUT /api/tasks/:id/status */
export async function updateTaskStatus(id: number, status: string): Promise<void> {
  await api.put(`/api/tasks/${id}/status`, { status });
}

/** PUT /api/tasks/:id/progress — dedicated endpoint, deliberately separate from
 * the general updateTask() above: PUT /api/tasks/:id recomputes progress from
 * subtasks (when the task has any) right after applying whatever was sent,
 * which would silently clobber a direct progress edit back to the subtask
 * average. This endpoint just sets the value, no recompute. */
export async function updateTaskProgress(id: number, progress: number): Promise<Task> {
  const res = await api.put(`/api/tasks/${id}/progress`, { progress });
  return res.data.task ?? res.data;
}

/** DELETE /api/tasks/:id */
export async function deleteTask(id: number): Promise<void> {
  await api.delete(`/api/tasks/${id}`);
}
