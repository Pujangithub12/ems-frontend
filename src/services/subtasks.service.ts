import api from "../api/axios";

export type SubTask = {
  id: number;
  title: string;
  status: string;
  progress?: number;
  children?: SubTask[];
};

/** GET /api/tasks/:taskId/subtasks */
export async function getSubtasks(taskId: number): Promise<SubTask[]> {
  const res = await api.get(`/api/tasks/${taskId}/subtasks`);
  return res.data;
}

/** POST /api/tasks/:taskId/subtasks */
export async function createSubtask(
  taskId: number,
  payload: { title: string; parentSubTaskId?: number | null },
): Promise<any> {
  const res = await api.post(`/api/tasks/${taskId}/subtasks`, payload);
  return res.data;
}

/** PUT /api/tasks/:taskId/subtasks/:subTaskId */
export async function updateSubtask(
  taskId: number,
  subTaskId: number,
  payload: { title?: string; progress?: number },
): Promise<any> {
  const res = await api.put(`/api/tasks/${taskId}/subtasks/${subTaskId}`, payload);
  return res.data;
}
