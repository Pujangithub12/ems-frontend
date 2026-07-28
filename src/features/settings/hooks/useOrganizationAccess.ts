import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import {
  getOrganizationAccessMatrix,
  grantOrganizationAccess,
  revokeOrganizationAccess,
} from "../api/organizations.api";

export function useOrganizationAccessMatrix() {
  return useQuery({
    queryKey: queryKeys.organizationAccessMatrix(),
    queryFn: getOrganizationAccessMatrix,
  });
}

export function useGrantOrganizationAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      userId,
      role,
    }: {
      organizationId: number;
      userId: number;
      role: string;
    }) => grantOrganizationAccess(organizationId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationAccessMatrix() });
    },
  });
}

export function useRevokeOrganizationAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, userId }: { organizationId: number; userId: number }) =>
      revokeOrganizationAccess(organizationId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationAccessMatrix() });
    },
  });
}
