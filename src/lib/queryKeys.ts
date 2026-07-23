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
  procurement: (wsId: number, projectId: string | number) =>
    [...queryKeys.all(wsId), "procurement", projectId] as const,
  monthlyPerformance: (wsId: number, projectId: string | number, year: number) =>
    [...queryKeys.all(wsId), "monthlyPerformance", projectId, year] as const,
  inventory: (wsId: number, projectId: string | number) =>
    [...queryKeys.all(wsId), "inventory", projectId] as const,
  workspaceInventory: (wsId: number) => [...queryKeys.all(wsId), "workspaceInventory"] as const,
  workspaceProcurement: (wsId: number) => [...queryKeys.all(wsId), "workspaceProcurement"] as const,
  workspaceFiles: (wsId: number) => [...queryKeys.all(wsId), "workspaceFiles"] as const,
  workspaceWarehouses: (wsId: number) => [...queryKeys.all(wsId), "workspaceWarehouses"] as const,
  workspaceVendors: (wsId: number) => [...queryKeys.all(wsId), "workspaceVendors"] as const,
  workspaceItemCatalog: (wsId: number) => [...queryKeys.all(wsId), "workspaceItemCatalog"] as const,
  workspacePendingTransfers: (wsId: number) =>
    [...queryKeys.all(wsId), "workspacePendingTransfers"] as const,
  workspaceInventoryTransactions: (wsId: number) =>
    [...queryKeys.all(wsId), "workspaceInventoryTransactions"] as const,
  inventoryItemDetail: (wsId: number, itemId: number) =>
    [...queryKeys.all(wsId), "inventoryItemDetail", itemId] as const,
  procurementItemDetail: (wsId: number, itemId: number) =>
    [...queryKeys.all(wsId), "procurementItemDetail", itemId] as const,
  reportSummary: (wsId: number, filters: Record<string, string | number | undefined>) =>
    [...queryKeys.all(wsId), "reportSummary", filters] as const,
  reportActivity: (wsId: number, action?: string) =>
    [...queryKeys.all(wsId), "reportActivity", action ?? "all"] as const,
  reportComments: (wsId: number, key: string) =>
    [...queryKeys.all(wsId), "reportComments", key] as const,

  // Unauthenticated — no workspace context yet.
  invite: (token: string) => ["invite", token] as const,

  // Spans every workspace the caller belongs to, not just the active one —
  // deliberately not rooted at wsId (unlike everything else here), since
  // switching the active workspace doesn't change this data at all.
  workspaceAccessMatrix: () => ["workspaceAccessMatrix"] as const,
};
