import React from "react";

export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`text-[10px] tracking-[0.1em] uppercase text-slate-400 ${className}`}
    style={{ fontFamily: "'JetBrains Mono', monospace" }}
  >
    {children}
  </div>
);

export const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const AVATAR_COLORS = [
  "#4338CA",
  "#047857",
  "#BE123C",
  "#7C3AED",
  "#1D4ED8",
  "#475569",
  "#B45309",
];
export const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

export const ROLE_STYLES: Record<string, { bg: string; fg: string }> = {
  admin: { bg: "#EDE9FE", fg: "#6D28D9" },
  super_admin: { bg: "#FEE2E2", fg: "#B91C1C" },
  finance: { bg: "#FEF3C7", fg: "#B45309" },
  user: { bg: "#DBEAFE", fg: "#1E3A8A" },
};

export const roleOptionsFor = (viewerRole?: string) => {
  if (viewerRole === "super_admin") {
    return [
      { value: "user", label: "Standard User" },
      { value: "finance", label: "Finance" },
      { value: "admin", label: "Administrator" },
      { value: "super_admin", label: "Super Administrator" },
    ];
  }
  if (viewerRole === "admin") {
    return [
      { value: "user", label: "Standard User" },
      { value: "finance", label: "Finance" },
      { value: "admin", label: "Administrator" },
    ];
  }
  return [{ value: "user", label: "Standard User" }];
};

export type RoleKey = "super_admin" | "admin" | "finance" | "user";
export const ALL_ROLES: RoleKey[] = ["super_admin", "admin", "finance", "user"];

export const ROLE_INFO: Record<
  RoleKey,
  { label: string; initials: string; color: string; badge?: string; description: string }
> = {
  super_admin: {
    label: "Super Administrator",
    initials: "SA",
    color: "#B91C1C",
    badge: "Highest Privilege",
    description:
      "Full workspace access, including everything Administrators can do, plus promoting members to Administrator or Super Administrator.",
  },
  admin: {
    label: "Administrator",
    initials: "AD",
    color: "#6D28D9",
    badge: "Elevated",
    description:
      "Manages projects, tasks, announcements, calendar events, leave requests, and members. Can't grant Super Administrator access.",
  },
  finance: {
    label: "Finance",
    initials: "FI",
    color: "#B45309",
    badge: "Mid-tier",
    description:
      "Sits between Administrator and Standard User. Starts with document access on top of standard viewing; a super admin can grant it more from the matrix below as real finance/procurement features are added.",
  },
  user: {
    label: "Standard User",
    initials: "US",
    color: "#1E3A8A",
    badge: "Default Role",
    description:
      "Can view and work on what's assigned to them — tasks, projects, calendar, and announcements — without managing members or workspace settings.",
  },
};

export type PermissionItem = {
  /**
   * Matches a PermissionKey on the backend (backend/src/config/permissions.ts)
   * for editable items. Non-editable items have no backing route gate (they've
   * always been open to everyone — e.g. viewing a list) so there's nothing to
   * toggle or enforce; they're shown for completeness only.
   */
  key: string;
  label: string;
  editable: boolean;
  /** Default/fallback grant — authoritative for non-editable items, and used
   *  as a placeholder for editable items until the live matrix has loaded. */
  roles: RoleKey[];
};

/**
 * Mirrors the app's actual authorization gates (backend/src/routes/routes.ts
 * roleMiddleware/permissionMiddleware calls + a few inline controller checks
 * like WorkspaceController's workspace.manage check) — not an aspirational or
 * fictional list. Editable items are enforced dynamically via the RolePermission
 * table (see backend/src/config/permissions.ts); keep the two in sync.
 */
export const PERMISSION_GROUPS: { category: string; items: PermissionItem[] }[] = [
  {
    category: "Overview",
    items: [
      { key: "overview.view_dashboard", label: "View dashboard", editable: false, roles: [...ALL_ROLES] },
    ],
  },
  {
    category: "Projects",
    items: [
      { key: "projects.view", label: "View all projects", editable: false, roles: [...ALL_ROLES] },
      { key: "projects.manage", label: "Create, edit & delete projects", editable: true, roles: ["super_admin", "admin"] },
      { key: "projects.schedule", label: "Manage project schedule (Gantt)", editable: true, roles: ["super_admin", "admin"] },
      { key: "projects.documents", label: "Upload & manage project documents", editable: true, roles: ["super_admin", "admin"] },
    ],
  },
  {
    category: "Tasks",
    items: [
      { key: "tasks.view", label: "View tasks", editable: false, roles: [...ALL_ROLES] },
      { key: "tasks.create", label: "Create tasks & update own progress", editable: false, roles: [...ALL_ROLES] },
      { key: "tasks.edit", label: "Edit task details & assignments", editable: true, roles: ["super_admin", "admin"] },
      { key: "tasks.delete", label: "Delete tasks", editable: true, roles: ["super_admin", "admin"] },
      { key: "tasks.feedback", label: "Give feedback on comments", editable: true, roles: ["super_admin", "admin"] },
    ],
  },
  {
    category: "Announcements",
    items: [
      { key: "announcements.view", label: "View announcements", editable: false, roles: [...ALL_ROLES] },
      { key: "announcements.manage", label: "Create & delete announcements", editable: true, roles: ["super_admin", "admin"] },
    ],
  },
  {
    category: "Members",
    items: [
      { key: "members.view", label: "View members", editable: false, roles: [...ALL_ROLES] },
      { key: "members.manage", label: "Add & remove members", editable: true, roles: ["super_admin", "admin"] },
      { key: "members.promote_admin", label: "Promote members to Administrator", editable: false, roles: ["super_admin", "admin"] },
      { key: "members.promote_super_admin", label: "Promote members to Super Administrator", editable: false, roles: ["super_admin"] },
    ],
  },
  {
    category: "Leave Requests",
    items: [
      { key: "leave.view", label: "Submit & view leave requests", editable: false, roles: [...ALL_ROLES] },
      { key: "leave.manage", label: "Approve, reject or delete requests", editable: true, roles: ["super_admin", "admin"] },
    ],
  },
  {
    category: "Calendar",
    items: [
      { key: "calendar.view", label: "View calendar", editable: false, roles: [...ALL_ROLES] },
      { key: "calendar.manage", label: "Create & delete events", editable: true, roles: ["super_admin", "admin"] },
    ],
  },
  {
    category: "Workspace",
    items: [
      { key: "workspace.manage", label: "Rename or delete the workspace", editable: true, roles: ["super_admin", "admin"] },
    ],
  },
  {
    category: "Org Hierarchy",
    items: [
      { key: "hierarchy.view", label: "View org chart", editable: false, roles: [...ALL_ROLES] },
      { key: "hierarchy.manage", label: "Edit org chart & reassign", editable: true, roles: ["super_admin", "admin"] },
    ],
  },
  {
    category: "Activity History",
    items: [
      { key: "activity.view", label: "View activity log", editable: false, roles: [...ALL_ROLES] },
    ],
  },
];

export const TOTAL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items).length;

export type PermissionMatrix = Record<string, Record<string, boolean>>;

/** Resolves whether `role` has `item`, preferring the live matrix (once loaded) for editable items. */
export const hasPermission = (
  matrix: PermissionMatrix | null,
  role: RoleKey,
  item: PermissionItem,
): boolean => {
  if (item.editable && matrix?.[role] && item.key in matrix[role]) {
    return matrix[role][item.key];
  }
  return item.roles.includes(role);
};

export const permissionCountFor = (matrix: PermissionMatrix | null, role: RoleKey) =>
  PERMISSION_GROUPS.flatMap((g) => g.items).filter((item) => hasPermission(matrix, role, item))
    .length;
