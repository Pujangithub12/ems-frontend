import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchMonthlyPerformance,
  upsertMonthlyPerformance,
  fetchDailyGeneration,
  upsertDailyGeneration,
  fetchGenerationBuckets,
  MonthlyPerformanceInput,
  UpsertDailyGenerationInput,
} from "../api/performance.api";
import { GenerationSummaryBucket } from "../../../types";

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

/** startDate/endDate are AD ISO dates — compute via bsMonthRangeAd for the selected BS month. */
export function useDailyGenerationQuery(
  projectId: string,
  year: number,
  month: number,
  startDate: string,
  endDate: string,
) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.dailyGeneration(wsId, projectId, year, month),
    queryFn: () => fetchDailyGeneration(projectId, startDate, endDate),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

/** On success, invalidates both the daily grid (that month) and the monthly
 * table/chart (actualGeneration is derived from daily rows client-side). */
export function useUpsertDailyGenerationMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: UpsertDailyGenerationInput }) =>
      upsertDailyGeneration(projectId, input),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.all(wsId), "monthlyPerformance", projectId] });
    },
  });
}

export function useGenerationBucketsQuery(projectId: string, year: number, buckets: GenerationSummaryBucket[]) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.generationBuckets(wsId, projectId, year),
    queryFn: () => fetchGenerationBuckets(projectId, buckets),
    enabled: Number.isFinite(wsId) && !!projectId && buckets.length > 0,
  });
}
