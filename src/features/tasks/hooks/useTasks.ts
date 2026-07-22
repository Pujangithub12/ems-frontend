import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useWorkspaceId } from "../../../hooks/useWorkspaceId";
import {
  getTasks,
  createTask,
  createProjectTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  CreateTaskPayload,
  UpdateTaskPayload,
} from "../api/tasks.api";

export function useTasks() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.tasks(wsId),
    queryFn: getTasks,
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateTask() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: FormData) => createTask(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(wsId) });
    },
  });
}

export function useCreateProjectTask() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      payload,
    }: {
      projectId: number | string;
      payload: CreateTaskPayload;
    }) => createProjectTask(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(wsId) });
    },
  });
}

export function useUpdateTask() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateTaskPayload | FormData }) =>
      updateTask(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(wsId) });
    },
  });
}

export function useUpdateTaskStatus() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateTaskStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(wsId) });
    },
  });
}

export function useDeleteTask() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(wsId) });
    },
  });
}
