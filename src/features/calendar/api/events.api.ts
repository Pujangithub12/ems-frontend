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

export type CopyEventsOrgResult = {
  organizationId: number;
  organizationName: string;
  copied: number;
  skipped: number;
  /** Set when this organization couldn't be copied to (e.g. no calendar permission there). */
  error?: string;
};

/** POST /api/events/copy — copies events of the current organization into other organizations the user belongs to. */
export async function copyEvents(payload: {
  targetOrganizationIds: number[];
  eventIds?: number[];
}): Promise<CopyEventsOrgResult[]> {
  const res = await api.post<{ results: CopyEventsOrgResult[] }>("/api/events/copy", payload);
  return res.data.results;
}

/** DELETE /api/events/:id */
export async function deleteEvent(id: number): Promise<void> {
  await api.delete(`/api/events/${id}`);
}
