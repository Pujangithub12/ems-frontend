/**
 * Every key is rooted at the active workspace id — workspace switching
 * doesn't remount the app (see DashboardLayout), it just updates the
 * X-Workspace-Id header and the URL param, so cache keys must partition by
 * workspace or a switch would show stale cross-workspace data.
 */
export const queryKeys = {
  all: (wsId: number) => ["ws", wsId] as const,

  users: (wsId: number) => [...queryKeys.all(wsId), "users"] as const,
  hierarchy: (wsId: number) => [...queryKeys.all(wsId), "hierarchy"] as const,
  permissions: (wsId: number) => [...queryKeys.all(wsId), "permissions"] as const,

  projects: (wsId: number) => [...queryKeys.all(wsId), "projects"] as const,
  project: (wsId: number, projectId: string | number) =>
    [...queryKeys.projects(wsId), projectId] as const,

  dashboard: (wsId: number) => [...queryKeys.all(wsId), "dashboard"] as const,

  announcements: (wsId: number) => [...queryKeys.all(wsId), "announcements"] as const,
  leaveRequests: (wsId: number) => [...queryKeys.all(wsId), "leaveRequests"] as const,
  siteVisitRequests: (wsId: number) => [...queryKeys.all(wsId), "siteVisitRequests"] as const,
  expenseRequests: (wsId: number) => [...queryKeys.all(wsId), "expenseRequests"] as const,
  activities: (wsId: number, projectId?: string | number) =>
    projectId
      ? ([...queryKeys.all(wsId), "activities", projectId] as const)
      : ([...queryKeys.all(wsId), "activities"] as const),

  tasks: (wsId: number, scope?: "mine" | "assigned" | "completed" | "all") =>
    scope
      ? ([...queryKeys.all(wsId), "tasks", scope] as const)
      : ([...queryKeys.all(wsId), "tasks"] as const),
  subtasks: (wsId: number, taskId: string | number) =>
    [...queryKeys.all(wsId), "tasks", taskId, "subtasks"] as const,
  comments: (wsId: number, taskId: string | number, subtaskId: string | number) =>
    [...queryKeys.all(wsId), "tasks", taskId, "subtasks", subtaskId, "comments"] as const,

  events: (wsId: number) => [...queryKeys.all(wsId), "events"] as const,

  schedule: (wsId: number, projectId: string | number) =>
    [...queryKeys.all(wsId), "schedule", projectId] as const,
  projectFiles: (wsId: number, projectId: string | number) =>
    [...queryKeys.all(wsId), "projectFiles", projectId] as const,

  // Unauthenticated — no workspace context yet.
  invite: (token: string) => ["invite", token] as const,

  // Spans every workspace the caller belongs to, not just the active one —
  // deliberately not rooted at wsId (unlike everything else here), since
  // switching the active workspace doesn't change this data at all.
  workspaceAccessMatrix: () => ["workspaceAccessMatrix"] as const,
};
