import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import {
  getWorkspaceAccessMatrix,
  grantWorkspaceAccess,
  revokeWorkspaceAccess,
} from "../api/workspaces.api";

export function useWorkspaceAccessMatrix() {
  return useQuery({
    queryKey: queryKeys.workspaceAccessMatrix(),
    queryFn: getWorkspaceAccessMatrix,
  });
}

export function useGrantWorkspaceAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workspaceId,
      userId,
      role,
    }: {
      workspaceId: number;
      userId: number;
      role: string;
    }) => grantWorkspaceAccess(workspaceId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceAccessMatrix() });
    },
  });
}

export function useRevokeWorkspaceAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, userId }: { workspaceId: number; userId: number }) =>
      revokeWorkspaceAccess(workspaceId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceAccessMatrix() });
    },
  });
}
