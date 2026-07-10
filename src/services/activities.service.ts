import api from "../api/axios";

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

/** GET /api/activities — the workspace activity feed. */
export async function getActivities(): Promise<ActivityItem[]> {
  const res = await api.get<ActivityItem[]>("/api/activities");
  return Array.isArray(res.data) ? res.data : [];
}
