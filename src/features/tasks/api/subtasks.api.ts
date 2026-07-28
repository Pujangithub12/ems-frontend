import api from "../../../api/axios";

export type SubTask = {
  id: number;
  title: string;
  status: string;
  progress?: number;
  /** Relative size/effort (e.g. days), used to weight this subtask's
   * contribution to its parent task's rolled-up progress instead of every
   * subtask counting equally. Unset/blank falls back to equal weighting. */
  estimatedDays?: number | null;
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
  payload: { title: string; parentSubTaskId?: number | null; estimatedDays?: number | null },
): Promise<any> {
  const res = await api.post(`/api/tasks/${taskId}/subtasks`, payload);
  return res.data;
}

/** DELETE /api/tasks/:taskId/subtasks/:subTaskId */
export async function deleteSubtask(taskId: number, subTaskId: number): Promise<any> {
  const res = await api.delete(`/api/tasks/${taskId}/subtasks/${subTaskId}`);
  return res.data;
}

/** PUT /api/tasks/:taskId/subtasks/:subTaskId */
export async function updateSubtask(
  taskId: number,
  subTaskId: number,
  payload: {
    title?: string;
    name?: string;
    progress?: number;
    status?: string;
    estimatedDays?: number | null;
  },
): Promise<any> {
  const res = await api.put(`/api/tasks/${taskId}/subtasks/${subTaskId}`, payload);
  return res.data;
}
