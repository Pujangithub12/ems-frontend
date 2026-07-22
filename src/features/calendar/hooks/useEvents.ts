import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useWorkspaceId } from "../../../hooks/useWorkspaceId";
import { getEvents, createEvent, deleteEvent } from "../api/events.api";

export function useEvents() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.events(wsId),
    queryFn: getEvents,
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateEvent() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events(wsId) });
    },
  });
}

export function useDeleteEvent() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events(wsId) });
    },
  });
}
