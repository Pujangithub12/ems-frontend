import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useWorkspaceId } from "../../../hooks/useWorkspaceId";
import {
  fetchMonthlyPerformance,
  upsertMonthlyPerformance,
  MonthlyPerformanceInput,
} from "../api/performance.api";

/** Thin query-hook wrappers around monthlyPerformanceApi.ts, for the project Energy Performance tab. */
export function useMonthlyPerformanceQuery(projectId: string, year: number) {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.monthlyPerformance(wsId, projectId, year),
    queryFn: () => fetchMonthlyPerformance(projectId, year),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

export function useUpsertMonthlyPerformanceMutation() {
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: MonthlyPerformanceInput }) =>
      upsertMonthlyPerformance(projectId, input),
  });
}
