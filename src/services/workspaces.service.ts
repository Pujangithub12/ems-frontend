import api from "../api/axios";
import type { Workspace } from "../context/AuthProvider";

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
