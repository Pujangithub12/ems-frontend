import api from "../../../api/axios";
import { Project, ProjectTask } from "../../../types";

export type ProjectPayload = Partial<{
  name: string;
  description: string;
  dueDate: string;
  status: string;
  assigneeIds: number[];
  contractDate: string | null;
  kickoffDate: string | null;
  estimatedTotalCost: number | null;
  sellingPrice: number | null;
}>;

/** GET /api/projects — the workspace's project list (lighter shape, no headings/files). */
export async function getProjects(): Promise<Project[]> {
  const res = await api.get<Project[]>("/api/projects");
  return res.data;
}

/**
 * GET /api/projects/:id — the full project detail, including nested
 * headings/tasks. Flattens tasks out of the heading tree here (rather than
 * in the component) so every consumer of this function gets a consistent
 * progress/tasksCount/membersCount without re-deriving it themselves.
 */
export async function getProject(id: string | number): Promise<Project> {
  const res = await api.get<any>(`/api/projects/${id}`);
  const data = res.data;

  const allTasks: ProjectTask[] = [];
  const taskIds = new Set<number>();
  const flattenTasks = (headings: any[]) => {
    if (!Array.isArray(headings)) return;
    headings.forEach((h) => {
      if (h.tasks && Array.isArray(h.tasks)) {
        h.tasks.forEach((t: ProjectTask) => {
          if (!taskIds.has(t.id)) {
            taskIds.add(t.id);
            allTasks.push(t);
          }
        });
      }
      if (h.subHeadings) flattenTasks(h.subHeadings);
    });
  };
  if (data.headings) flattenTasks(data.headings);
  if (data.projectTasks && Array.isArray(data.projectTasks)) {
    data.projectTasks.forEach((t: ProjectTask) => {
      if (!taskIds.has(t.id)) {
        taskIds.add(t.id);
        allTasks.push(t);
      }
    });
  }

  const completedTasks = allTasks.filter((t) => t.status === "completed").length;
  const progress =
    allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0;

  return {
    ...data,
    progress: data.progress ?? progress,
    tasksCount: data.tasksCount ?? allTasks.length,
    membersCount: data.membersCount ?? (data.assignees?.length || 0),
  };
}

/** POST /api/projects */
export async function createProject(payload: ProjectPayload): Promise<void> {
  await api.post("/api/projects", payload);
}

/** PUT /api/projects/:id */
export async function updateProject(id: number, payload: ProjectPayload): Promise<void> {
  await api.put(`/api/projects/${id}`, payload);
}

/** DELETE /api/projects/:id */
export async function deleteProject(id: number): Promise<void> {
  await api.delete(`/api/projects/${id}`);
}
