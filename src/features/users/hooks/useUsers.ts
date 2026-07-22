import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useWorkspaceId } from "../../../hooks/useWorkspaceId";
import {
  getUsers,
  inviteUser,
  updateUser,
  deleteUser,
  changeMyPassword,
  updateMyProfile,
  InviteUserPayload,
  UpdateUserPayload,
} from "../api/users.api";

export function useUsers() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.users(wsId),
    queryFn: getUsers,
    enabled: Number.isFinite(wsId),
  });
}

export function useInviteUser() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InviteUserPayload) => inviteUser(payload),
    // A brand-new email creates a pending invite (no User row until accepted,
    // so nothing to refetch). An email that already has an account elsewhere
    // is added as a member of this workspace immediately, so refresh the list
    // to reflect that right away.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users(wsId) });
    },
  });
}

export function useUpdateUser() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUserPayload }) =>
      updateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users(wsId) });
    },
  });
}

export function useDeleteUser() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users(wsId) });
    },
  });
}

export function useChangeMyPassword() {
  return useMutation({
    mutationFn: changeMyPassword,
  });
}

export function useUpdateMyProfile() {
  return useMutation({
    mutationFn: updateMyProfile,
  });
}
