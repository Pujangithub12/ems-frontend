import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchMaterialFields,
  createMaterialField,
  updateMaterialField,
  deleteMaterialField,
  SaveMaterialFieldPayload,
} from "../api/materialField.api";

export function useMaterialFieldsQuery(projectId: number | null) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.materialFields(wsId, projectId ?? -1),
    queryFn: () => fetchMaterialFields(projectId as number),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

export function useCreateMaterialField() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: number; payload: SaveMaterialFieldPayload }) =>
      createMaterialField(projectId, payload),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialFields(wsId, projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.materials(wsId, projectId) });
    },
  });
}

export function useUpdateMaterialField() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; projectId: number; payload: SaveMaterialFieldPayload }) =>
      updateMaterialField(id, payload),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialFields(wsId, projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.materials(wsId, projectId) });
    },
  });
}

export function useDeleteMaterialField() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; projectId: number }) => deleteMaterialField(id),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialFields(wsId, projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.materials(wsId, projectId) });
    },
  });
}
