import api from "../../../api/axios";

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
