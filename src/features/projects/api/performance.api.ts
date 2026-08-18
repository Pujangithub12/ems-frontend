import api from "../../../api/axios";
import { MonthlyPerformance, DailyGeneration, MonthlyGenerationSummaryRow } from "../../../types";

/** actualGeneration is intentionally absent — it's derived from daily entries
 * (see upsertDailyGeneration) and is never sent through this endpoint. */
export interface MonthlyPerformanceInput {
  year: number;
  month: number;
  contractEnergy?: number | null;
  incomeReceived?: number | null;
  monthlyExpenditure?: number | null;
  sparePartPurchase?: number | null;
}

/** GET the rows that exist for a given year on the Energy Performance tab. */
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

/** GET the full day-by-day grid for one month (gaps filled with generation: null). */
export async function fetchDailyGeneration(
  projectId: string,
  year: number,
  month: number,
): Promise<DailyGeneration[]> {
  const res = await api.get<{ days: DailyGeneration[] }>(
    `/api/projects/${projectId}/performance/daily`,
    { params: { year, month } },
  );
  return res.data.days ?? [];
}

/** PUT upsert (find-or-create) the row for one day. */
export async function upsertDailyGeneration(
  projectId: string,
  input: { date: string; generation: number | null },
): Promise<DailyGeneration> {
  const res = await api.put<{ row: DailyGeneration }>(
    `/api/projects/${projectId}/performance/daily`,
    input,
  );
  return res.data.row;
}

/** GET the 12-month trend (summed daily generation vs. contract target) for the chart. */
export async function fetchGenerationSummary(
  projectId: string,
  year: number,
): Promise<MonthlyGenerationSummaryRow[]> {
  const res = await api.get<{ rows: MonthlyGenerationSummaryRow[] }>(
    `/api/projects/${projectId}/performance/summary`,
    { params: { year } },
  );
  return res.data.rows ?? [];
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Human-readable energy, e.g. "12,000 kWh". Falls back to "--" when absent. */
export function formatEnergy(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") return "--";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "--";
  return `${num.toLocaleString()} kWh`;
}
