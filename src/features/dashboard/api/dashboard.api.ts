import api from "../../../api/axios";
import { Task } from "../../tasks/api/tasks.api";

export type DashboardSummary = {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  highPriorityTasks: Task[];
  pendingLeaveRequests: number;
};

/** GET /api/dashboard — the aggregate KPI payload backing the dashboard's top strip. */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const res = await api.get<DashboardSummary>("/api/dashboard");
  return res.data;
}
