import api from "../../../api/axios";
import { MonthlyPerformance, DailyGeneration, GenerationSummaryBucket, GenerationSummaryBucketResult } from "../../../types";

/** actualGeneration is intentionally absent — it's derived from daily entries
 * (see upsertDailyGeneration) and is never sent through this endpoint. */
export interface MonthlyPerformanceInput {
  /** Bikram Sambat year/month — see performance/daily's date-range endpoints for why. */
  year: number;
  month: number;
  contractEnergy?: number | null;
  incomeReceived?: number | null;
  monthlyExpenditure?: number | null;
  sparePartPurchase?: number | null;
}

/** GET the rows that exist for a given (BS) year on the Energy Performance tab. */
export async function fetchMonthlyPerformance(
  projectId: string,
  year: number,
): Promise<MonthlyPerformance[]> {
  const res = await api.get<{ rows: MonthlyPerformance[] }>(
    `/api/projects/${projectId}/performance`,
    { params: { year } },
  );
  return res.data.rows ?? [];
}

/** PUT upsert (find-or-create) the row for one month. */
export async function upsertMonthlyPerformance(
  projectId: string,
  input: MonthlyPerformanceInput,
): Promise<MonthlyPerformance> {
  const res = await api.put<{ row: MonthlyPerformance }>(
    `/api/projects/${projectId}/performance`,
    input,
  );
  return res.data.row;
}

/** GET logged daily entries within an AD date range (computed by the caller from
 * the selected BS month via bsMonthRangeAd) — only days with a row are returned. */
export async function fetchDailyGeneration(
  projectId: string,
  startDate: string,
  endDate: string,
): Promise<DailyGeneration[]> {
  const res = await api.get<{ days: DailyGeneration[] }>(
    `/api/projects/${projectId}/performance/daily`,
    { params: { startDate, endDate } },
  );
  return res.data.days ?? [];
}

export interface UpsertDailyGenerationInput {
  date: string; // AD ISO date
  checkMeterInitial?: number | null;
  checkMeterFinal?: number | null;
  mainMeterInitial?: number | null;
  mainMeterFinal?: number | null;
}

/** PUT upsert (find-or-create) the row for one day. */
export async function upsertDailyGeneration(
  projectId: string,
  input: UpsertDailyGenerationInput,
): Promise<DailyGeneration> {
  const res = await api.put<{ row: DailyGeneration }>(
    `/api/projects/${projectId}/performance/daily`,
    input,
  );
  return res.data.row;
}

/** POST a set of AD date-range buckets (one per BS month) and get back each
 * bucket's summed generation — no calendar awareness on the backend, the
 * caller pairs the result with contractEnergy (from fetchMonthlyPerformance) itself. */
export async function fetchGenerationBuckets(
  projectId: string,
  buckets: GenerationSummaryBucket[],
): Promise<GenerationSummaryBucketResult[]> {
  const res = await api.post<{ rows: GenerationSummaryBucketResult[] }>(
    `/api/projects/${projectId}/performance/summary`,
    { buckets },
  );
  return res.data.rows ?? [];
}

/** Human-readable energy, e.g. "12,000 kWh". Falls back to "--" when absent. */
export function formatEnergy(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") return "--";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "--";
  return `${num.toLocaleString()} kWh`;
}
