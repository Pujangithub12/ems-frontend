import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { fetchSchedule, saveSchedule, ScheduleDto } from "../api/schedule.api";

/** Thin query-hook wrapper around the existing scheduleApi.ts service functions. */
export function useScheduleQuery(projectId: string | undefined) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.schedule(wsId, projectId ?? ""),
    queryFn: () => fetchSchedule(projectId!),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

export function useSaveScheduleMutation(projectId: string | undefined) {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schedule: ScheduleDto) => saveSchedule(projectId!, schedule),
    onSuccess: (data) => {
      if (projectId) {
        queryClient.setQueryData(queryKeys.schedule(wsId, projectId), data);
      }
      // Schedule and Task tabs now share the same Task rows (see
      // schedule.service.ts) — a schedule save can create/update tasks the
      // Kanban board (and any other useTasks()-backed view) needs to see too.
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(wsId) });
    },
  });
}
