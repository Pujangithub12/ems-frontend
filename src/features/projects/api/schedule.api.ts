import api from "../../../api/axios";
import { ScheduleRow } from "../schema/schedule.types";
import {
  ScheduleLinkType,
  parsePredecessorList,
  formatPredecessorList,
  PredecessorToken,
} from "../utils/predecessorTokens";

/** Wire shape for a single schedule row, as sent/received by the backend. `predecessorId` is deprecated (superseded by the top-level `links` array) — always sent as null, and no longer read from the response. */
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

/** Wire shape for a single dependency link. */
export interface ScheduleTaskLinkDto {
  predecessorId: string;
  successorId: string;
  type: ScheduleLinkType;
  lag: number;
}

export interface ScheduleDto {
  tasks: ScheduleTaskDto[];
  links: ScheduleTaskLinkDto[];
}

/** ScheduleRow (all-string, form-friendly) -> { tasks, links } (typed, for the wire). Each row's `predecessorId` string ("3,5FS+2,7SS-1") is parsed into structured links pointing at that row as the successor. */
export function rowsToDto(rows: ScheduleRow[]): ScheduleDto {
  const tasks: ScheduleTaskDto[] = rows.map((row) => ({
    id: row.id.trim(),
    taskName: row.taskName.trim(),
    duration:
      row.duration.trim() === "" || Number.isNaN(Number(row.duration))
        ? null
        : Number(row.duration),
    startDate: row.startDate.trim() === "" ? null : row.startDate.trim(),
    parentId: row.parentId.trim() === "" ? null : row.parentId.trim(),
    predecessorId: null,
    progress:
      row.progress.trim() === "" || Number.isNaN(Number(row.progress))
        ? null
        : Math.max(0, Math.min(100, Number(row.progress))),
    status: row.status.trim() === "" ? "to_do" : row.status.trim(),
  }));

  const links: ScheduleTaskLinkDto[] = rows.flatMap((row) =>
    parsePredecessorList(row.predecessorId).map((token) => ({
      predecessorId: token.id,
      successorId: row.id.trim(),
      type: token.type,
      lag: token.lag,
    })),
  );

  return { tasks, links };
}

/** { tasks, links } (from the backend) -> ScheduleRow (for the modal/Gantt builder). Re-serializes each successor's links back into its `predecessorId` string. */
export function dtoToRows(dto: ScheduleDto): ScheduleRow[] {
  const tokensBySuccessor = new Map<string, PredecessorToken[]>();
  for (const link of dto.links) {
    const list = tokensBySuccessor.get(link.successorId) ?? [];
    list.push({ id: link.predecessorId, type: link.type, lag: link.lag });
    tokensBySuccessor.set(link.successorId, list);
  }

  return dto.tasks.map((task) => ({
    id: task.id ?? "",
    taskName: task.taskName ?? "",
    duration: task.duration != null ? String(task.duration) : "",
    startDate: task.startDate ?? "",
    parentId: task.parentId ?? "",
    predecessorId: formatPredecessorList(tokensBySuccessor.get(task.id) ?? []),
    progress: task.progress != null ? String(task.progress) : "",
    status: task.status ?? "",
  }));
}

/** GET the previously saved schedule for a project. Returns empty tasks/links if none saved yet. */
export async function fetchSchedule(projectId: string): Promise<ScheduleDto> {
  const res = await api.get<ScheduleDto>(`/api/projects/${projectId}/schedule`);
  return { tasks: res.data.tasks ?? [], links: res.data.links ?? [] };
}

/** PUT — full replace of a project's schedule (tasks + dependency links). Returns the schedule as saved. */
export async function saveSchedule(projectId: string, schedule: ScheduleDto): Promise<ScheduleDto> {
  const res = await api.put<ScheduleDto>(`/api/projects/${projectId}/schedule`, schedule);
  return { tasks: res.data.tasks ?? [], links: res.data.links ?? [] };
}
