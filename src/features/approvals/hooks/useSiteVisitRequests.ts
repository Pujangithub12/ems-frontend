import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useWorkspaceId } from "../../../hooks/useWorkspaceId";
import {
  getSiteVisitRequests,
  createSiteVisitRequest,
  updateSiteVisitRequestStatus,
  CreateSiteVisitRequestPayload,
} from "../api/siteVisitRequests.api";

export function useSiteVisitRequests() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.siteVisitRequests(wsId),
    queryFn: getSiteVisitRequests,
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateSiteVisitRequest() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSiteVisitRequestPayload) => createSiteVisitRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteVisitRequests(wsId) });
    },
  });
}

export function useUpdateSiteVisitRequestStatus() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      updateSiteVisitRequestStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteVisitRequests(wsId) });
    },
  });
}
