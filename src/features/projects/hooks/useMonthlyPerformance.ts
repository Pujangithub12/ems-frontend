import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchMonthlyPerformance,
  upsertMonthlyPerformance,
  fetchDailyGeneration,
  upsertDailyGeneration,
  fetchGenerationSummary,
  MonthlyPerformanceInput,
} from "../api/performance.api";

/** Thin query-hook wrappers around performance.api.ts, for the project Energy Performance tab. */
export function useMonthlyPerformanceQuery(projectId: string, year: number) {
  const wsId = useOrganizationId();
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

export function useDailyGenerationQuery(projectId: string, year: number, month: number) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.dailyGeneration(wsId, projectId, year, month),
    queryFn: () => fetchDailyGeneration(projectId, year, month),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

/** On success, invalidates both the daily grid (that month) and the summary
 * chart + monthly table (actualGeneration is derived from daily rows). */
export function useUpsertDailyGenerationMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string;
      input: { date: string; generation: number | null };
    }) => upsertDailyGeneration(projectId, input),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.all(wsId), "monthlyPerformance", projectId] });
    },
  });
}

export function useGenerationSummaryQuery(projectId: string, year: number) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.generationSummary(wsId, projectId, year),
    queryFn: () => fetchGenerationSummary(projectId, year),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}
