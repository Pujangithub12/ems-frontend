import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  addMaterialTransaction,
  deleteMaterialTransaction,
  SaveMaterialPayload,
  AddMaterialTransactionPayload,
} from "../api/material.api";

export function useMaterialsQuery(projectId: number | null) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.materials(wsId, projectId ?? -1),
    queryFn: () => fetchMaterials(projectId as number),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

export function useCreateMaterial() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: number; payload: SaveMaterialPayload }) => createMaterial(projectId, payload),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materials(wsId, projectId) });
    },
  });
}

export function useUpdateMaterial() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; projectId: number; payload: SaveMaterialPayload }) => updateMaterial(id, payload),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materials(wsId, projectId) });
    },
  });
}

export function useDeleteMaterial() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; projectId: number }) => deleteMaterial(id),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materials(wsId, projectId) });
    },
  });
}

export function useAddMaterialTransaction() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ materialId, payload }: { materialId: number; projectId: number; payload: AddMaterialTransactionPayload }) =>
      addMaterialTransaction(materialId, payload),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materials(wsId, projectId) });
    },
  });
}

export function useDeleteMaterialTransaction() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; projectId: number }) => deleteMaterialTransaction(id),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materials(wsId, projectId) });
    },
  });
}
