import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useWorkspaceId } from "../../../hooks/useWorkspaceId";
import {
  fetchReportSummary,
  fetchReportActivity,
  logReportActivity,
  fetchReportComments,
  addReportComment,
  ReportFilters,
} from "../api/reports.api";

export function useReportSummaryQuery(filters: ReportFilters) {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.reportSummary(wsId, filters as Record<string, string | number | undefined>),
    queryFn: () => fetchReportSummary(filters),
    enabled: Number.isFinite(wsId),
  });
}

export function useReportActivityQuery(action?: "viewed" | "exported") {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.reportActivity(wsId, action),
    queryFn: () => fetchReportActivity(action),
    enabled: Number.isFinite(wsId),
  });
}

export function useLogReportActivityMutation() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { reportType: string; action: "viewed" | "exported"; format?: string }) =>
      logReportActivity(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.all(wsId), "reportActivity"] });
    },
  });
}

export function useReportCommentsQuery(reportKey: string | null) {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.reportComments(wsId, reportKey ?? ""),
    queryFn: () => fetchReportComments(reportKey as string),
    enabled: Number.isFinite(wsId) && !!reportKey,
  });
}

export function useAddReportCommentMutation() {
  return useMutation({
    mutationFn: ({ reportKey, body }: { reportKey: string; body: string }) => addReportComment(reportKey, body),
  });
}
