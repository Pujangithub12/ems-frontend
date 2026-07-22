import api from "../../../api/axios";
import type { Workspace } from "../../../context/AuthProvider";

/** GET /api/workspaces — every workspace the caller belongs to. */
export async function getWorkspaces(): Promise<Workspace[]> {
  const res = await api.get("/api/workspaces");
  return (res.data.workspaces || []).filter(
    (w: Workspace | null | undefined): w is Workspace => w != null,
  );
}

/** GET /api/workspaces/current — the caller's active workspace (per the workspaceId cookie). */
export async function getCurrentWorkspace(): Promise<Workspace | null> {
  const res = await api.get("/api/workspaces/current");
  return res.data.workspace ?? null;
}

/** POST /api/workspaces/switch — persists the active workspace server-side (fire-and-forget from the caller's perspective). */
export async function switchWorkspace(workspaceId: number): Promise<void> {
  await api.post("/api/workspaces/switch", { workspaceId });
}

/** POST /api/workspaces */
export async function createWorkspace(
  name: string,
  description?: string,
): Promise<Workspace> {
  const res = await api.post("/api/workspaces", { name, description });
  return res.data.workspace;
}

/** PUT /api/workspaces/:id */
export async function updateWorkspace(
  workspaceId: number,
  name: string,
  description?: string,
): Promise<Workspace> {
  const res = await api.put(`/api/workspaces/${workspaceId}`, { name, description });
  return res.data.workspace;
}

/** DELETE /api/workspaces/:id — requires typing the workspace name to confirm. */
export async function deleteWorkspace(
  workspaceId: number,
  confirmName: string,
): Promise<Workspace | null> {
  const res = await api.delete(`/api/workspaces/${workspaceId}`, {
    data: { confirmName },
  });
  return res.data.workspace ?? null;
}

export type WorkspaceAccessEmployee = {
  id: number;
  fullName: string;
  email: string;
  role: string;
  /** Ids (from the returned `workspaces` list) this employee currently has access to. */
  workspaceIds: number[];
};

export type WorkspaceAccessMatrix = {
  workspaces: { id: number; name: string }[];
  employees: WorkspaceAccessEmployee[];
};

/** GET /api/workspaces/access-matrix — every workspace the caller belongs to, plus every distinct member across them. */
export async function getWorkspaceAccessMatrix(): Promise<WorkspaceAccessMatrix> {
  const res = await api.get("/api/workspaces/access-matrix");
  return res.data;
}

/**
 * PUT /api/workspaces/:workspaceId/members/:userId — grants an existing
 * employee access to one of the caller's own workspaces, with the given
 * role in that workspace (role is per-workspace now, so there's no longer
 * an existing global role to inherit — this must be sent explicitly).
 */
export async function grantWorkspaceAccess(
  workspaceId: number,
  userId: number,
  role: string,
): Promise<void> {
  await api.put(`/api/workspaces/${workspaceId}/members/${userId}`, { role });
}

/** DELETE /api/workspaces/:workspaceId/members/:userId — revokes an employee's access to one of the caller's own workspaces. */
export async function revokeWorkspaceAccess(workspaceId: number, userId: number): Promise<void> {
  await api.delete(`/api/workspaces/${workspaceId}/members/${userId}`);
}
