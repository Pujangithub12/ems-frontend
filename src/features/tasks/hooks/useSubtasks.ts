import { useMutation } from "@tanstack/react-query";
import { getSubtasks, createSubtask, updateSubtask, deleteSubtask } from "../api/subtasks.api";

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
      name,
      progress,
      status,
    }: {
      taskId: number;
      subTaskId: number;
      title?: string;
      name?: string;
      progress?: number;
      status?: string;
    }) => updateSubtask(taskId, subTaskId, { title, name, progress, status }),
  });
}

export function useDeleteSubtask() {
  return useMutation({
    mutationFn: ({ taskId, subTaskId }: { taskId: number; subTaskId: number }) =>
      deleteSubtask(taskId, subTaskId),
  });
}
