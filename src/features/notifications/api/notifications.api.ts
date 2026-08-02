import api from "../../../api/axios";

export type NotificationType =
  | "task_assigned"
  | "task_completed"
  | "approval_requested"
  | "approval_decided"
  | "announcement";

export type Notification = {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
  userId: number;
  organizationId: number | null;
};

/** GET /api/notifications */
export async function getNotifications(): Promise<Notification[]> {
  const res = await api.get<Notification[]>("/api/notifications");
  return res.data;
}

/** GET /api/notifications/unread-count */
export async function getUnreadCount(): Promise<number> {
  const res = await api.get<{ count: number }>("/api/notifications/unread-count");
  return res.data.count;
}

/** PATCH /api/notifications/:id/read */
export async function markNotificationRead(id: number): Promise<void> {
  await api.patch(`/api/notifications/${id}/read`);
}

/** PATCH /api/notifications/read-all */
export async function markAllNotificationsRead(): Promise<void> {
  await api.patch("/api/notifications/read-all");
}
