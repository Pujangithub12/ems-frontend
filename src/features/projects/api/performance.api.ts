import api from "../../../api/axios";
import { MonthlyPerformance } from "../../../types";

export interface MonthlyPerformanceInput {
  year: number;
  month: number;
  contractEnergy?: number | null;
  actualGeneration?: number | null;
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
