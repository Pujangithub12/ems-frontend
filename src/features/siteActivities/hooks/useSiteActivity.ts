import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchSiteActivityReport,
  fetchSiteActivityReportsRange,
  saveSiteActivityReport,
  deleteSiteActivityReport,
  uploadSiteActivityPhoto,
  deleteSiteActivityPhoto,
  SaveSiteActivityReportPayload,
} from "../api/siteActivity.api";

export function useSiteActivityReport(projectId: number | null, date: string) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.siteActivityReport(wsId, projectId ?? -1, date),
    queryFn: () => fetchSiteActivityReport(projectId as number, date),
    enabled: Number.isFinite(wsId) && !!projectId && !!date,
  });
}

/** Backs the Weekly Summary view — every report in [from, to] inclusive. */
export function useSiteActivityReportsRange(projectId: number | null, from: string, to: string) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.siteActivityReportsRange(wsId, projectId ?? -1, from, to),
    queryFn: () => fetchSiteActivityReportsRange(projectId as number, from, to),
    enabled: Number.isFinite(wsId) && !!projectId && !!from && !!to,
  });
}

export function useSaveSiteActivityReport(projectId: number | null, date: string) {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveSiteActivityReportPayload) => saveSiteActivityReport(projectId as number, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteActivityAll(wsId, projectId ?? -1) });
    },
  });
}

export function useDeleteSiteActivityReport(projectId: number | null, date: string) {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSiteActivityReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteActivityAll(wsId, projectId ?? -1) });
    },
  });
}

export function useUploadSiteActivityPhoto(projectId: number | null, date: string) {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, file, itemId, caption }: { reportId: number; file: File; itemId?: number; caption?: string }) =>
      uploadSiteActivityPhoto(reportId, file, { itemId, caption }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteActivityAll(wsId, projectId ?? -1) });
    },
  });
}

export function useDeleteSiteActivityPhoto(projectId: number | null, date: string) {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSiteActivityPhoto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteActivityAll(wsId, projectId ?? -1) });
    },
  });
}
