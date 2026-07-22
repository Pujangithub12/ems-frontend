import api from "../api/axios";
import { ReportSummary, ReportActivity, ReportComment } from "../types";

export interface ReportFilters {
  projectId?: number;
  warehouseId?: number;
  vendorId?: number;
  category?: string;
  range?: "30d" | "month" | "3m" | "12m" | "year";
}

/** GET the single big aggregation payload the whole Reports dashboard renders from. */
export async function fetchReportSummary(filters: ReportFilters): Promise<ReportSummary> {
  const params: Record<string, string> = {};
  if (filters.projectId) params.projectId = String(filters.projectId);
  if (filters.warehouseId) params.warehouseId = String(filters.warehouseId);
  if (filters.vendorId) params.vendorId = String(filters.vendorId);
  if (filters.category) params.category = filters.category;
  if (filters.range) params.range = filters.range;
  const res = await api.get<ReportSummary>("/api/workspace/reports/summary", { params });
  return res.data;
}

/** GET recent report views/exports for the footer. */
export async function fetchReportActivity(action?: "viewed" | "exported"): Promise<ReportActivity[]> {
  const res = await api.get<{ activity: ReportActivity[] }>("/api/workspace/reports/activity", {
    params: action ? { action } : {},
  });
  return res.data.activity ?? [];
}

/** POST log a view/export action (Quick Generate buttons, Export Excel/PDF). */
export async function logReportActivity(input: {
  reportType: string;
  action: "viewed" | "exported";
  format?: string;
}): Promise<void> {
  await api.post("/api/workspace/reports/activity", input);
}

/** GET comments left on one chart/section of the dashboard. */
export async function fetchReportComments(reportKey: string): Promise<ReportComment[]> {
  const res = await api.get<{ comments: ReportComment[] }>("/api/workspace/reports/comments", {
    params: { key: reportKey },
  });
  return res.data.comments ?? [];
}

/** POST add a comment to a chart/section. */
export async function addReportComment(reportKey: string, body: string): Promise<void> {
  await api.post("/api/workspace/reports/comments", { reportKey, body });
}
