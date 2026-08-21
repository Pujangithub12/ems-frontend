import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchMonthlyPerformance,
  upsertMonthlyPerformance,
  fetchDailyGeneration,
  upsertDailyGeneration,
  deleteDailyGeneration,
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

/** startDate/endDate are AD ISO dates — compute via bsMonthRangeAd or adMonthRangeIso
 * depending on which calendar is currently driving the daily grid. Keyed directly on
 * the range (rather than a BS month int) since the range can come from either calendar. */
export function useDailyGenerationQuery(projectId: string, startDate: string, endDate: string) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.dailyGeneration(wsId, projectId, startDate, endDate),
    queryFn: () => fetchDailyGeneration(projectId, startDate, endDate),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

/** Invalidates the daily grid (any date range, BS or AD) plus the monthly
 * table/chart (actualGeneration/buckets are derived from daily rows client-side). */
function invalidateDailyGenerationConsumers(queryClient: ReturnType<typeof useQueryClient>, wsId: number, projectId: string) {
  queryClient.invalidateQueries({ queryKey: [...queryKeys.all(wsId), "dailyGeneration", projectId] });
  queryClient.invalidateQueries({ queryKey: [...queryKeys.all(wsId), "monthlyPerformance", projectId] });
}

export function useUpsertDailyGenerationMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: UpsertDailyGenerationInput }) =>
      upsertDailyGeneration(projectId, input),
    onSuccess: (_data, { projectId }) => invalidateDailyGenerationConsumers(queryClient, wsId, projectId),
  });
}

/** Deletes one or more days at once (single delete just sends a one-element array). */
export function useDeleteDailyGenerationMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, dates }: { projectId: string; dates: string[] }) =>
      deleteDailyGeneration(projectId, dates),
    onSuccess: (_data, { projectId }) => invalidateDailyGenerationConsumers(queryClient, wsId, projectId),
  });
}

export function useGenerationBucketsQuery(
  projectId: string,
  year: number,
  buckets: GenerationSummaryBucket[],
  calendar: "bs" | "ad" = "bs",
) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.generationBuckets(wsId, projectId, year, calendar),
    queryFn: () => fetchGenerationBuckets(projectId, buckets),
    enabled: Number.isFinite(wsId) && !!projectId && buckets.length > 0,
  });
}
