import api from "../../../api/axios";
import { ScheduleRow } from "../schema/schedule.types";

/** Wire shape for a single schedule row, as sent/received by the backend. */
export interface ScheduleTaskDto {
  id: string;
  taskName: string;
  duration: number | null;
  startDate: string | null;
  parentId: string | null;
  predecessorId: string | null;
  progress: number | null;
  status: string;
}

/** ScheduleRow (all-string, form-friendly) -> ScheduleTaskDto (typed, for the wire). */
export function rowsToDto(rows: ScheduleRow[]): ScheduleTaskDto[] {
  return rows.map((row) => ({
    id: row.id.trim(),
    taskName: row.taskName.trim(),
    duration:
      row.duration.trim() === "" || Number.isNaN(Number(row.duration))
        ? null
        : Number(row.duration),
    startDate: row.startDate.trim() === "" ? null : row.startDate.trim(),
    parentId: row.parentId.trim() === "" ? null : row.parentId.trim(),
    predecessorId:
      row.predecessorId.trim() === "" ? null : row.predecessorId.trim(),
    progress:
      row.progress.trim() === "" || Number.isNaN(Number(row.progress))
        ? null
        : Math.max(0, Math.min(100, Number(row.progress))),
    status: row.status.trim() === "" ? "pending" : row.status.trim(),
  }));
}

/** ScheduleTaskDto (from the backend) -> ScheduleRow (for the modal/Gantt builder). */
export function dtoToRows(dtos: ScheduleTaskDto[]): ScheduleRow[] {
  return dtos.map((dto) => ({
    id: dto.id ?? "",
    taskName: dto.taskName ?? "",
    duration: dto.duration != null ? String(dto.duration) : "",
    startDate: dto.startDate ?? "",
    parentId: dto.parentId ?? "",
    predecessorId: dto.predecessorId ?? "",
    progress: dto.progress != null ? String(dto.progress) : "",
    status: dto.status ?? "",
  }));
}

/** GET the previously saved schedule for a project. Returns [] if none saved yet. */
export async function fetchSchedule(
  projectId: string,
): Promise<ScheduleTaskDto[]> {
  const res = await api.get<{ tasks: ScheduleTaskDto[] }>(
    `/api/projects/${projectId}/schedule`,
  );
  return res.data.tasks ?? [];
}

/** PUT — full replace of a project's schedule. Returns the tasks as saved. */
export async function saveSchedule(
  projectId: string,
  tasks: ScheduleTaskDto[],
): Promise<ScheduleTaskDto[]> {
  const res = await api.put<{ tasks: ScheduleTaskDto[] }>(
    `/api/projects/${projectId}/schedule`,
    { tasks },
  );
  return res.data.tasks ?? [];
}
