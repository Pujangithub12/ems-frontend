import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import { useWorkspaceId } from "./useWorkspaceId";
import {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  CreateAnnouncementPayload,
} from "../services/announcements.service";

export function useAnnouncements() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.announcements(wsId),
    queryFn: getAnnouncements,
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateAnnouncement() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAnnouncementPayload) => createAnnouncement(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements(wsId) });
    },
  });
}

export function useDeleteAnnouncement() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements(wsId) });
    },
  });
}
