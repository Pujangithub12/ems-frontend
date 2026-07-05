/**
 * Shared schedule row shape used across the Excel upload flow, the manual
 * "Add Schedule" modal, and the backend API. Every field is a plain string
 * so it binds cleanly to <input> elements — numeric/date parsing happens at
 * the boundaries (when building the Gantt chart, and when sending to the API).
 */
export interface ScheduleRow {
  /** The user-facing task ID, e.g. "1", "1.1". May be blank (auto-assigned). */
  id: string;
  taskName: string;
  /** Days, as a string so an empty input is representable; parsed on use. */
  duration: string;
  /** "YYYY-MM-DD", matches <input type="date"> value format. */
  startDate: string;
  /** ID of the owning summary task, or "". */
  parentId: string;
  /** Comma-separated list of predecessor IDs, or "". */
  predecessorId: string;
  /** Percent complete (0-100), as a string; blank means not tracked. */
  progress: string;
}

export function emptyScheduleRow(): ScheduleRow {
  return {
    id: "",
    taskName: "",
    duration: "",
    startDate: "",
    parentId: "",
    predecessorId: "",
    progress: "",
  };
}
