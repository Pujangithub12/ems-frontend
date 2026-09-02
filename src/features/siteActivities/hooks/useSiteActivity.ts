import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchSiteActivityOptions,
  addSiteActivityOption,
  SiteActivityOptionKind,
  fetchSiteActivityReport,
  fetchSiteActivityReportsRange,
  saveSiteActivityReport,
  deleteSiteActivityReport,
  uploadSiteActivityPhoto,
  deleteSiteActivityPhoto,
  SaveSiteActivityReportPayload,
} from "../api/siteActivity.api";

/** The org's reusable predefined-options vocabulary for one dropdown kind —
 * backs the Work Activities / Equipment / Materials tables' select-only
 * dropdowns. */
export function useSiteActivityOptions(kind: SiteActivityOptionKind) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.siteActivityOptions(wsId, kind),
    queryFn: () => fetchSiteActivityOptions(kind),
    enabled: Number.isFinite(wsId),
  });
}

/** Backs the "+" popup next to a predefined-options dropdown — adds a new
 * option for that kind and refreshes the list so it can be selected right away. */
export function useAddSiteActivityOption(kind: SiteActivityOptionKind) {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => addSiteActivityOption(kind, name),
    onSuccess: (options) => {
      queryClient.setQueryData(queryKeys.siteActivityOptions(wsId, kind), options);
    },
  });
}

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
      // A save may have introduced new predefined-option values — refresh all three dropdowns.
      queryClient.invalidateQueries({ queryKey: queryKeys.siteActivityOptions(wsId, "activity") });
      queryClient.invalidateQueries({ queryKey: queryKeys.siteActivityOptions(wsId, "equipment") });
      queryClient.invalidateQueries({ queryKey: queryKeys.siteActivityOptions(wsId, "material") });
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
