import api from "../../../api/axios";

export type ActivityItem = {
  id: number;
  type: string;
  description: string;
  taskId?: number;
  userId?: number;
  user?: {
    id: number;
    fullName: string;
    email: string;
  };
  task?: {
    id: number;
    title: string;
  };
  createdAt: string;
};

/** GET /api/activities — the workspace activity feed, optionally filtered to
 * one project's tasks (used by the Project Overview tab's Recent Activity). */
export async function getActivities(projectId?: number): Promise<ActivityItem[]> {
  const res = await api.get<ActivityItem[]>("/api/activities", {
    params: projectId ? { projectId } : undefined,
  });
  return Array.isArray(res.data) ? res.data : [];
}
