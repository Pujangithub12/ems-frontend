import { Project, ProjectTask } from "../types";

/** Flattens a project's heading tree + direct project tasks into a single de-duplicated list. */
export function flattenProjectTasks(project: Project): ProjectTask[] {
  const allTasks: ProjectTask[] = [];
  const taskIds = new Set<number>();

  const visit = (headings: any[]) => {
    if (!Array.isArray(headings)) return;
    headings.forEach((h) => {
      if (Array.isArray(h.tasks)) {
        h.tasks.forEach((t: ProjectTask) => {
          if (!taskIds.has(t.id)) {
            taskIds.add(t.id);
            allTasks.push(t);
          }
        });
      }
      if (h.subHeadings) visit(h.subHeadings);
    });
  };
  if (project.headings) visit(project.headings);

  if (Array.isArray(project.projectTasks)) {
    project.projectTasks.forEach((t) => {
      if (!taskIds.has(t.id)) {
        taskIds.add(t.id);
        allTasks.push(t);
      }
    });
  }

  return allTasks;
}
