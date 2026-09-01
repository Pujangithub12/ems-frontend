import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchPlantReportTables,
  fetchPlantReportTableDetail,
  createPlantReportTable,
  updatePlantReportTable,
  deletePlantReportTable,
  createPlantReportColumn,
  updatePlantReportColumn,
  deletePlantReportColumn,
  createPlantReportRow,
  updatePlantReportRow,
  deletePlantReportRow,
  importPlantReportSheet,
  SavePlantReportTablePayload,
  SavePlantReportColumnPayload,
  SavePlantReportRowPayload,
  ImportSheetPayload,
} from "../api/plantReport.api";

export function usePlantReportTables(projectId: number | null) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.plantReportTables(wsId, projectId ?? -1),
    queryFn: () => fetchPlantReportTables(projectId as number),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

export function usePlantReportTableDetail(tableId: number | null) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.plantReportTableDetail(wsId, tableId ?? -1),
    queryFn: () => fetchPlantReportTableDetail(tableId as number),
    enabled: Number.isFinite(wsId) && !!tableId,
  });
}

export function useCreatePlantReportTable() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: number; payload: SavePlantReportTablePayload }) =>
      createPlantReportTable(projectId, payload),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plantReportTables(wsId, projectId) });
    },
  });
}

export function useUpdatePlantReportTable() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; projectId: number; payload: SavePlantReportTablePayload }) =>
      updatePlantReportTable(id, payload),
    onSuccess: (_data, { projectId, id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plantReportTables(wsId, projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.plantReportTableDetail(wsId, id) });
    },
  });
}

export function useDeletePlantReportTable() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; projectId: number }) => deletePlantReportTable(id),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plantReportTables(wsId, projectId) });
    },
  });
}

export function useCreatePlantReportColumn() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, payload }: { tableId: number; payload: SavePlantReportColumnPayload }) =>
      createPlantReportColumn(tableId, payload),
    onSuccess: (_data, { tableId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plantReportTableDetail(wsId, tableId) });
    },
  });
}

export function useUpdatePlantReportColumn() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; tableId: number; payload: SavePlantReportColumnPayload }) =>
      updatePlantReportColumn(id, payload),
    onSuccess: (_data, { tableId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plantReportTableDetail(wsId, tableId) });
    },
  });
}

export function useDeletePlantReportColumn() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; tableId: number }) => deletePlantReportColumn(id),
    onSuccess: (_data, { tableId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plantReportTableDetail(wsId, tableId) });
    },
  });
}

export function useCreatePlantReportRow() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, payload }: { tableId: number; payload: SavePlantReportRowPayload }) =>
      createPlantReportRow(tableId, payload),
    onSuccess: (_data, { tableId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plantReportTableDetail(wsId, tableId) });
    },
  });
}

export function useUpdatePlantReportRow() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; tableId: number; payload: SavePlantReportRowPayload }) =>
      updatePlantReportRow(id, payload),
    onSuccess: (_data, { tableId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plantReportTableDetail(wsId, tableId) });
    },
  });
}

export function useDeletePlantReportRow() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; tableId: number }) => deletePlantReportRow(id),
    onSuccess: (_data, { tableId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plantReportTableDetail(wsId, tableId) });
    },
  });
}

export function useImportPlantReportSheet() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, payload }: { tableId: number; payload: ImportSheetPayload }) => importPlantReportSheet(tableId, payload),
    onSuccess: (_data, { tableId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plantReportTableDetail(wsId, tableId) });
    },
  });
}
