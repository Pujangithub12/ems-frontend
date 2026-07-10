import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import { useWorkspaceId } from "./useWorkspaceId";
import { getPermissions, updatePermissions } from "../services/permissions.service";

export function usePermissions() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.permissions(wsId),
    queryFn: getPermissions,
    enabled: Number.isFinite(wsId),
  });
}

export function useUpdatePermissions() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePermissions,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.permissions(wsId), data);
    },
  });
}
