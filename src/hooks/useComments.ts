import { useMutation } from "@tanstack/react-query";
import { getComments, addComment, updateCommentFeedback } from "../services/comments.service";

/** On-demand fetch (not a stable useQuery key) — callers store the result into their own local state. */
export function useCommentsFetch() {
  return useMutation({
    mutationFn: ({ taskId, subTaskId }: { taskId: number; subTaskId: number }) =>
      getComments(taskId, subTaskId),
  });
}

export function useAddComment() {
  return useMutation({
    mutationFn: ({
      taskId,
      subTaskId,
      commentText,
    }: {
      taskId: number;
      subTaskId: number;
      commentText: string;
    }) => addComment(taskId, subTaskId, commentText),
  });
}

export function useUpdateCommentFeedback() {
  return useMutation({
    mutationFn: ({
      taskId,
      subTaskId,
      commentId,
      feedback,
    }: {
      taskId: number;
      subTaskId: number;
      commentId: number;
      feedback: string;
    }) => updateCommentFeedback(taskId, subTaskId, commentId, feedback),
  });
}
