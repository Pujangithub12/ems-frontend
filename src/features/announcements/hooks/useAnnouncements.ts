import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  CreateAnnouncementPayload,
} from "../api/announcements.api";

export function useAnnouncements() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.announcements(wsId),
    queryFn: getAnnouncements,
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateAnnouncement() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAnnouncementPayload) => createAnnouncement(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements(wsId) });
    },
  });
}

export function useDeleteAnnouncement() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements(wsId) });
    },
  });
}
