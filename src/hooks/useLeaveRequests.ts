import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import { useWorkspaceId } from "./useWorkspaceId";
import {
  getLeaveRequests,
  createLeaveRequest,
  updateLeaveRequestStatus,
  CreateLeaveRequestPayload,
} from "../services/leaveRequests.service";

export function useLeaveRequests() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.leaveRequests(wsId),
    queryFn: getLeaveRequests,
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateLeaveRequest() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLeaveRequestPayload) => createLeaveRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leaveRequests(wsId) });
    },
  });
}

export function useUpdateLeaveRequestStatus() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      updateLeaveRequestStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leaveRequests(wsId) });
    },
  });
}
