import { useMutation } from "@tanstack/react-query";
import { getSubtasks, createSubtask, updateSubtask } from "../services/subtasks.service";

/** On-demand fetch (not a stable useQuery key) — callers store the result into their own local state. */
export function useSubtasksFetch() {
  return useMutation({
    mutationFn: (taskId: number) => getSubtasks(taskId),
  });
}

export function useCreateSubtask() {
  return useMutation({
    mutationFn: ({
      taskId,
      title,
      parentSubTaskId,
    }: {
      taskId: number;
      title: string;
      parentSubTaskId?: number | null;
    }) => createSubtask(taskId, { title, parentSubTaskId }),
  });
}

export function useUpdateSubtask() {
  return useMutation({
    mutationFn: ({
      taskId,
      subTaskId,
      title,
      progress,
    }: {
      taskId: number;
      subTaskId: number;
      title?: string;
      progress?: number;
    }) => updateSubtask(taskId, subTaskId, { title, progress }),
  });
}
