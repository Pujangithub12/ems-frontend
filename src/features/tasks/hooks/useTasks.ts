import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  getTasks,
  createTask,
  createProjectTask,
  updateTask,
  updateTaskStatus,
  updateTaskProgress,
  deleteTask,
  CreateTaskPayload,
  UpdateTaskPayload,
} from "../api/tasks.api";

export function useTasks() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.tasks(wsId),
    queryFn: getTasks,
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateTask() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: FormData) => createTask(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(wsId) });
    },
  });
}

// Schedule and Task tabs now share the same Task rows (see schedule.service.ts),
// so any mutation here also invalidates every project's schedule cache —
// broad rather than a single projectId, since useUpdateTask/useUpdateTaskStatus/
// useDeleteTask are also called from project-agnostic pages (AssignedTasks,
// MyTasks, CompletedTasks, KanbanBoard) where a specific project isn't in
// scope. This app's query volume is small enough that the blunt invalidation
// isn't a real cost.
const invalidateSchedules = (queryClient: ReturnType<typeof useQueryClient>, wsId: number) => {
  queryClient.invalidateQueries({ queryKey: [...queryKeys.all(wsId), "schedule"] });
};

export function useCreateProjectTask() {
  const wsId = useOrganizationId();
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
      invalidateSchedules(queryClient, wsId);
    },
  });
}

export function useUpdateTask() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateTaskPayload | FormData }) =>
      updateTask(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(wsId) });
      invalidateSchedules(queryClient, wsId);
    },
  });
}

export function useUpdateTaskStatus() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateTaskStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(wsId) });
      invalidateSchedules(queryClient, wsId);
    },
  });
}

export function useUpdateTaskProgress() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, progress }: { id: number; progress: number }) => updateTaskProgress(id, progress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(wsId) });
      invalidateSchedules(queryClient, wsId);
    },
  });
}

export function useDeleteTask() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(wsId) });
      invalidateSchedules(queryClient, wsId);
    },
  });
}
