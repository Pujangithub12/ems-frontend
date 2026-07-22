import api from "../../../api/axios";

export type Announcement = {
  id: number;
  subject: string;
  message: string;
  targetType: string;
  targetEmails: string[];
  createdAt: string;
};

export type CreateAnnouncementPayload = {
  subject: string;
  message: string;
  targetType: "all" | "specific";
  targetEmails: string[];
};

/**
 * GET /api/announcements — the response envelope has varied across shapes
 * historically (bare array / {announcements} / {announcement} / {history});
 * normalized here so every consumer always gets a plain array.
 */
export async function getAnnouncements(): Promise<Announcement[]> {
  const res = await api.get<any>("/api/announcements");
  const data = res.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.announcements)) return data.announcements;
  if (data?.announcement) return [data.announcement];
  if (Array.isArray(data?.history)) return data.history;
  return [];
}

/** POST /api/announcements */
export async function createAnnouncement(
  payload: CreateAnnouncementPayload,
): Promise<void> {
  await api.post("/api/announcements", payload);
}

/** DELETE /api/announcements/:id */
export async function deleteAnnouncement(id: number): Promise<void> {
  await api.delete(`/api/announcements/${id}`);
}
