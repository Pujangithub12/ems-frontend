import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../api/notifications.api";

export function useNotifications() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.notifications(wsId),
    queryFn: getNotifications,
    enabled: Number.isFinite(wsId),
    // The socket keeps this list live while the tab is open — a background
    // poll interval is just a safety net for missed/dropped socket events.
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(wsId) });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(wsId) });
    },
  });
}
