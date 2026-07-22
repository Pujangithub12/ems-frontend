import api from "../../../api/axios";

export type CalendarEvent = {
  id: number;
  title: string;
  date: string;
  type: string;
};

/** GET /api/events */
export async function getEvents(): Promise<CalendarEvent[]> {
  const res = await api.get<CalendarEvent[]>("/api/events");
  return res.data;
}

/** POST /api/events */
export async function createEvent(payload: {
  title: string;
  date: string;
  type: string;
}): Promise<void> {
  await api.post("/api/events", payload);
}

/** DELETE /api/events/:id */
export async function deleteEvent(id: number): Promise<void> {
  await api.delete(`/api/events/${id}`);
}
