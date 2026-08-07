import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  getPlantReportsForMonth,
  getPlantReportPrefill,
  createPlantReport,
  updatePlantReport,
  deletePlantReport,
  SavePlantReportPayload,
} from "../api/plantReport.api";

export function usePlantReportsForMonth(year: number, month: number, projectId?: number | null) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.plantReports(wsId, year, month, projectId),
    queryFn: () => getPlantReportsForMonth(year, month, projectId),
    enabled: Number.isFinite(wsId),
  });
}

/** On-demand fetch (not a stable query) — the entry form calls this itself
 * whenever the chosen date/project changes, same pattern as useSubtasksFetch. */
export function usePlantReportPrefill() {
  return useMutation({
    mutationFn: ({ date, projectId }: { date: string; projectId: number | null }) =>
      getPlantReportPrefill(date, projectId),
  });
}

export function useCreatePlantReport() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SavePlantReportPayload) => createPlantReport(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all(wsId) });
    },
  });
}

export function useUpdatePlantReport() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SavePlantReportPayload }) =>
      updatePlantReport(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all(wsId) });
    },
  });
}

export function useDeletePlantReport() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePlantReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.all(wsId) });
    },
  });
}
