import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { getEvents, createEvent, deleteEvent } from "../api/events.api";

export function useEvents() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.events(wsId),
    queryFn: getEvents,
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateEvent() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events(wsId) });
    },
  });
}

export function useDeleteEvent() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events(wsId) });
    },
  });
}
