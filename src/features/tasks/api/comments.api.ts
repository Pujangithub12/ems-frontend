import api from "../../../api/axios";

/** A task-level progress update written by an assignee, with the assigner's optional feedback. */
export type TaskProgressUpdate = {
  id: number;
  commentText: string;
  feedback: string | null;
  createdAt: string;
  author?: { id: number; fullName: string; email?: string } | null;
};

/** GET /api/tasks/:taskId/comments */
export async function getTaskProgressUpdates(taskId: number): Promise<TaskProgressUpdate[]> {
  const res = await api.get<TaskProgressUpdate[]>(`/api/tasks/${taskId}/comments`);
  return res.data;
}

/** POST /api/tasks/:taskId/comments */
export async function addTaskProgressUpdate(taskId: number, commentText: string): Promise<void> {
  await api.post(`/api/tasks/${taskId}/comments`, { commentText });
}

/** POST /api/tasks/:taskId/feedback — assigner feedback not tied to any progress update. */
export async function addStandaloneTaskFeedback(taskId: number, feedback: string): Promise<void> {
  await api.post(`/api/tasks/${taskId}/feedback`, { feedback });
}

/** PUT /api/tasks/:taskId/comments/:commentId/feedback */
export async function addTaskProgressFeedback(
  taskId: number,
  commentId: number,
  feedback: string,
): Promise<void> {
  await api.put(`/api/tasks/${taskId}/comments/${commentId}/feedback`, { feedback });
}

/** GET /api/tasks/:taskId/subtasks/:subTaskId/comments */
export async function getComments(taskId: number, subTaskId: number): Promise<any[]> {
  const res = await api.get<any[]>(`/api/tasks/${taskId}/subtasks/${subTaskId}/comments`);
  return res.data;
}

/** POST /api/tasks/:taskId/subtasks/:subTaskId/comments */
export async function addComment(
  taskId: number,
  subTaskId: number,
  commentText: string,
): Promise<void> {
  await api.post(`/api/tasks/${taskId}/subtasks/${subTaskId}/comments`, { commentText });
}

/** PUT /api/tasks/:taskId/subtasks/:subTaskId/comments/:commentId/feedback */
export async function updateCommentFeedback(
  taskId: number,
  subTaskId: number,
  commentId: number,
  feedback: string,
): Promise<void> {
  await api.put(
    `/api/tasks/${taskId}/subtasks/${subTaskId}/comments/${commentId}/feedback`,
    { feedback },
  );
}
