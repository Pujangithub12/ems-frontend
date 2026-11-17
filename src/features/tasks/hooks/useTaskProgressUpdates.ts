import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTaskProgressUpdates,
  addTaskProgressUpdate,
  addTaskProgressFeedback,
  addStandaloneTaskFeedback,
} from "../api/comments.api";

const key = (taskId: number) => ["task-progress-updates", taskId] as const;

export function useTaskProgressUpdates(taskId: number) {
  return useQuery({
    queryKey: key(taskId),
    queryFn: () => getTaskProgressUpdates(taskId),
  });
}

export function useAddTaskProgressUpdate(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentText: string) => addTaskProgressUpdate(taskId, commentText),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(taskId) }),
  });
}

export function useAddStandaloneTaskFeedback(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (feedback: string) => addStandaloneTaskFeedback(taskId, feedback),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(taskId) }),
  });
}

export function useAddTaskProgressFeedback(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, feedback }: { commentId: number; feedback: string }) =>
      addTaskProgressFeedback(taskId, commentId, feedback),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(taskId) }),
  });
}
