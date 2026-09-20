import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchMaterialCustomTables,
  fetchMaterialCustomTableDetail,
  createMaterialCustomTable,
  updateMaterialCustomTable,
  deleteMaterialCustomTable,
  createMaterialCustomColumn,
  updateMaterialCustomColumn,
  deleteMaterialCustomColumn,
  createMaterialCustomRow,
  updateMaterialCustomRow,
  deleteMaterialCustomRow,
  importMaterialCustomSheet,
  SaveMaterialCustomTablePayload,
  SaveMaterialCustomColumnPayload,
  SaveMaterialCustomRowPayload,
  ImportMaterialSheetPayload,
} from "../api/materialCustomTable.api";

export function useMaterialCustomTables(projectId: number | null) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.materialCustomTables(wsId, projectId ?? -1),
    queryFn: () => fetchMaterialCustomTables(projectId as number),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

export function useMaterialCustomTableDetail(tableId: number | null) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.materialCustomTableDetail(wsId, tableId ?? -1),
    queryFn: () => fetchMaterialCustomTableDetail(tableId as number),
    enabled: Number.isFinite(wsId) && !!tableId,
  });
}

export function useCreateMaterialCustomTable() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: number; payload: SaveMaterialCustomTablePayload }) =>
      createMaterialCustomTable(projectId, payload),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialCustomTables(wsId, projectId) });
    },
  });
}

export function useUpdateMaterialCustomTable() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; projectId: number; payload: SaveMaterialCustomTablePayload }) =>
      updateMaterialCustomTable(id, payload),
    onSuccess: (_data, { projectId, id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialCustomTables(wsId, projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.materialCustomTableDetail(wsId, id) });
    },
  });
}

export function useDeleteMaterialCustomTable() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; projectId: number }) => deleteMaterialCustomTable(id),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialCustomTables(wsId, projectId) });
    },
  });
}

export function useCreateMaterialCustomColumn() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, payload }: { tableId: number; payload: SaveMaterialCustomColumnPayload }) =>
      createMaterialCustomColumn(tableId, payload),
    onSuccess: (_data, { tableId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialCustomTableDetail(wsId, tableId) });
    },
  });
}

export function useUpdateMaterialCustomColumn() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; tableId: number; payload: SaveMaterialCustomColumnPayload }) =>
      updateMaterialCustomColumn(id, payload),
    onSuccess: (_data, { tableId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialCustomTableDetail(wsId, tableId) });
    },
  });
}

export function useDeleteMaterialCustomColumn() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; tableId: number }) => deleteMaterialCustomColumn(id),
    onSuccess: (_data, { tableId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialCustomTableDetail(wsId, tableId) });
    },
  });
}

export function useCreateMaterialCustomRow() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, payload }: { tableId: number; payload: SaveMaterialCustomRowPayload }) =>
      createMaterialCustomRow(tableId, payload),
    onSuccess: (_data, { tableId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialCustomTableDetail(wsId, tableId) });
    },
  });
}

export function useUpdateMaterialCustomRow() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; tableId: number; payload: SaveMaterialCustomRowPayload }) =>
      updateMaterialCustomRow(id, payload),
    onSuccess: (_data, { tableId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialCustomTableDetail(wsId, tableId) });
    },
  });
}

export function useDeleteMaterialCustomRow() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; tableId: number }) => deleteMaterialCustomRow(id),
    onSuccess: (_data, { tableId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialCustomTableDetail(wsId, tableId) });
    },
  });
}

export function useImportMaterialCustomSheet() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, payload }: { tableId: number; payload: ImportMaterialSheetPayload }) =>
      importMaterialCustomSheet(tableId, payload),
    onSuccess: (_data, { tableId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.materialCustomTableDetail(wsId, tableId) });
    },
  });
}
