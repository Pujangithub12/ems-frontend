import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import { useWorkspaceId } from "./useWorkspaceId";
import {
  getUsers,
  inviteUser,
  updateUser,
  deleteUser,
  changeMyPassword,
  updateMyProfile,
  InviteUserPayload,
  UpdateUserPayload,
} from "../services/users.service";

export function useUsers() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.users(wsId),
    queryFn: getUsers,
    enabled: Number.isFinite(wsId),
  });
}

export function useInviteUser() {
  return useMutation({
    mutationFn: (payload: InviteUserPayload) => inviteUser(payload),
    // No User row exists until the invite is accepted — nothing to invalidate yet.
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
