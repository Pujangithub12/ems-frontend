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
  subTasks: { id: number; title: string; status: string; children?: any[] }[];
  projectName?: string;
  project?: { id: number; name: string; status?: string };
  createdBy?: { id: number; fullName: string };
};

/** GET /api/tasks — the full workspace task list (used by both the summary bar and the task list pages). */
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

/** DELETE /api/tasks/:id */
export async function deleteTask(id: number): Promise<void> {
  await api.delete(`/api/tasks/${id}`);
}
