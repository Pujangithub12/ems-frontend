import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useWorkspaceId } from "../../../hooks/useWorkspaceId";
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  ProjectPayload,
} from "../api/projects.api";

export function useProjects() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.projects(wsId),
    queryFn: getProjects,
    enabled: Number.isFinite(wsId),
  });
}

export function useProject(id: string | number | undefined) {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.project(wsId, id ?? ""),
    queryFn: () => getProject(id!),
    enabled: Number.isFinite(wsId) && !!id,
  });
}

export function useCreateProject() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectPayload) => createProject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects(wsId) });
    },
  });
}

export function useUpdateProject() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ProjectPayload }) =>
      updateProject(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects(wsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(wsId, variables.id) });
    },
  });
}

export function useDeleteProject() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects(wsId) });
    },
  });
}
