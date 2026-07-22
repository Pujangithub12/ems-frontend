import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useWorkspaceId } from "../../../hooks/useWorkspaceId";
import { fetchSchedule, saveSchedule, ScheduleTaskDto } from "../api/schedule.api";

/** Thin query-hook wrapper around the existing scheduleApi.ts service functions. */
export function useScheduleQuery(projectId: string | undefined) {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.schedule(wsId, projectId ?? ""),
    queryFn: () => fetchSchedule(projectId!),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

export function useSaveScheduleMutation(projectId: string | undefined) {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tasks: ScheduleTaskDto[]) => saveSchedule(projectId!, tasks),
    onSuccess: (data) => {
      if (projectId) {
        queryClient.setQueryData(queryKeys.schedule(wsId, projectId), data);
      }
    },
  });
}
