/**
 * Every key is rooted at the active organization id — organization switching
 * doesn't remount the app (see DashboardLayout), it just updates the
 * X-Workspace-Id header and the URL param, so cache keys must partition by
 * organization or a switch would show stale cross-organization data.
 */
export const queryKeys = {
  all: (wsId: number) => ["ws", wsId] as const,

  users: (wsId: number) => [...queryKeys.all(wsId), "users"] as const,
  hierarchy: (wsId: number) => [...queryKeys.all(wsId), "hierarchy"] as const,
  permissions: (wsId: number) => [...queryKeys.all(wsId), "permissions"] as const,

  projects: (wsId: number) => [...queryKeys.all(wsId), "projects"] as const,
  project: (wsId: number, projectId: string | number) =>
    [...queryKeys.projects(wsId), projectId] as const,
  /** Nested under queryKeys.projects so invalidating that prefix also clears every cached page/filter combo. */
  projectsPage: (wsId: number, page: number, pageSize: number, search: string, status: string) =>
    [...queryKeys.projects(wsId), "page", page, pageSize, search, status] as const,

  dashboard: (wsId: number) => [...queryKeys.all(wsId), "dashboard"] as const,

  announcements: (wsId: number) => [...queryKeys.all(wsId), "announcements"] as const,
  notifications: (wsId: number) => [...queryKeys.all(wsId), "notifications"] as const,
  leaveRequests: (wsId: number) => [...queryKeys.all(wsId), "leaveRequests"] as const,
  siteVisitRequests: (wsId: number) => [...queryKeys.all(wsId), "siteVisitRequests"] as const,
  expenseRequests: (wsId: number) => [...queryKeys.all(wsId), "expenseRequests"] as const,

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
  purchaseOrders: (wsId: number, projectId: string | number) =>
    [...queryKeys.all(wsId), "purchaseOrders", projectId] as const,
  organizationPurchaseOrders: (wsId: number) => [...queryKeys.all(wsId), "organizationPurchaseOrders"] as const,
  purchaseOrderDetail: (wsId: number, id: number) =>
    [...queryKeys.all(wsId), "purchaseOrderDetail", id] as const,
  purchaseOrderCostSheet: (wsId: number, id: number) =>
    [...queryKeys.all(wsId), "purchaseOrderCostSheet", id] as const,
  allProformaInvoices: (wsId: number) => [...queryKeys.all(wsId), "allProformaInvoices"] as const,
  /** year/month here are Bikram Sambat values (see MonthlyPerformance type). */
  monthlyPerformance: (wsId: number, projectId: string | number, year: number) =>
    [...queryKeys.all(wsId), "monthlyPerformance", projectId, year] as const,
  /** Keyed on the actual AD date range, since it can come from either a BS or
   * an AD month depending on the tab's date-format toggle. */
  dailyGeneration: (wsId: number, projectId: string | number, startDate: string, endDate: string) =>
    [...queryKeys.all(wsId), "dailyGeneration", projectId, startDate, endDate] as const,
  /** `calendar` disambiguates a BS-year bucket set from an AD-year one — the
   * two `year` numbers are drawn from different ranges but could theoretically
   * collide, so they must not share a cache entry. */
  generationBuckets: (wsId: number, projectId: string | number, year: number, calendar: "bs" | "ad" = "bs") =>
    [...queryKeys.monthlyPerformance(wsId, projectId, year), "buckets", calendar] as const,
  inventory: (wsId: number, projectId: string | number) =>
    [...queryKeys.all(wsId), "inventory", projectId] as const,
  organizationInventory: (wsId: number) => [...queryKeys.all(wsId), "organizationInventory"] as const,
  organizationProcurement: (wsId: number) => [...queryKeys.all(wsId), "organizationProcurement"] as const,
  organizationFiles: (wsId: number) => [...queryKeys.all(wsId), "organizationFiles"] as const,
  organizationWarehouses: (wsId: number) => [...queryKeys.all(wsId), "organizationWarehouses"] as const,
  organizationVendors: (wsId: number) => [...queryKeys.all(wsId), "organizationVendors"] as const,
  organizationItemCatalog: (wsId: number) => [...queryKeys.all(wsId), "organizationItemCatalog"] as const,
  organizationPendingTransfers: (wsId: number) =>
    [...queryKeys.all(wsId), "organizationPendingTransfers"] as const,
  organizationInventoryTransactions: (wsId: number) =>
    [...queryKeys.all(wsId), "organizationInventoryTransactions"] as const,
  inventoryItemDetail: (wsId: number, itemId: number) =>
    [...queryKeys.all(wsId), "inventoryItemDetail", itemId] as const,
  procurementItemDetail: (wsId: number, itemId: number) =>
    [...queryKeys.all(wsId), "procurementItemDetail", itemId] as const,
  fileAccess: (wsId: number, fileId: number) =>
    [...queryKeys.all(wsId), "fileAccess", fileId] as const,
  reportSummary: (wsId: number, filters: Record<string, string | number | undefined>) =>
    [...queryKeys.all(wsId), "reportSummary", filters] as const,
  reportActivity: (wsId: number, action?: string) =>
    [...queryKeys.all(wsId), "reportActivity", action ?? "all"] as const,
  reportComments: (wsId: number, key: string) =>
    [...queryKeys.all(wsId), "reportComments", key] as const,

  plantReports: (wsId: number, year: number, month: number, projectId?: number | null) =>
    [...queryKeys.all(wsId), "plantReports", year, month, projectId ?? "all"] as const,
  plantReportPrefill: (wsId: number, date: string) =>
    [...queryKeys.all(wsId), "plantReportPrefill", date] as const,
  plantReportFields: (wsId: number) => [...queryKeys.all(wsId), "plantReportFields"] as const,

  // Unauthenticated — no organization context yet.
  invite: (token: string) => ["invite", token] as const,

  // Spans every organization the caller belongs to, not just the active one —
  // deliberately not rooted at wsId (unlike everything else here), since
  // switching the active organization doesn't change this data at all.
  organizationAccessMatrix: () => ["organizationAccessMatrix"] as const,
};
