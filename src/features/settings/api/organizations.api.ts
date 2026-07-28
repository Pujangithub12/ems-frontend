import api from "../../../api/axios";
import type { Organization, OrganizationContactDetails } from "../../../context/AuthProvider";

/** GET /api/organizations — every organization the caller belongs to. */
export async function getOrganizations(): Promise<Organization[]> {
  const res = await api.get("/api/workspaces");
  return (res.data.organizations || []).filter(
    (w: Organization | null | undefined): w is Organization => w != null,
  );
}

/** GET /api/organizations/current — the caller's active organization (per the organizationId cookie). */
export async function getCurrentOrganization(): Promise<Organization | null> {
  const res = await api.get("/api/workspaces/current");
  return res.data.organization ?? null;
}

/** POST /api/organizations/switch — persists the active organization server-side (fire-and-forget from the caller's perspective). */
export async function switchOrganization(organizationId: number): Promise<void> {
  await api.post("/api/workspaces/switch", { organizationId });
}

/** POST /api/organizations */
export async function createOrganization(
  name: string,
  description?: string,
  details?: OrganizationContactDetails,
): Promise<Organization> {
  const res = await api.post("/api/workspaces", { name, description, ...details });
  return res.data.organization;
}

/** PUT /api/organizations/:id */
export async function updateOrganization(
  organizationId: number,
  name: string,
  description?: string,
  details?: OrganizationContactDetails,
): Promise<Organization> {
  const res = await api.put(`/api/workspaces/${organizationId}`, { name, description, ...details });
  return res.data.organization;
}

/** DELETE /api/organizations/:id — requires typing the organization name to confirm. */
export async function deleteOrganization(
  organizationId: number,
  confirmName: string,
): Promise<Organization | null> {
  const res = await api.delete(`/api/workspaces/${organizationId}`, {
    data: { confirmName },
  });
  return res.data.organization ?? null;
}

export type OrganizationAccessEmployee = {
  id: number;
  fullName: string;
  email: string;
  role: string;
  /** Ids (from the returned `organizations` list) this employee currently has access to. */
  organizationIds: number[];
};

export type OrganizationAccessMatrix = {
  organizations: { id: number; name: string }[];
  employees: OrganizationAccessEmployee[];
};

/** GET /api/organizations/access-matrix — every organization the caller belongs to, plus every distinct member across them. */
export async function getOrganizationAccessMatrix(): Promise<OrganizationAccessMatrix> {
  const res = await api.get("/api/workspaces/access-matrix");
  return res.data;
}

/**
 * PUT /api/organizations/:organizationId/members/:userId — grants an existing
 * employee access to one of the caller's own organizations, with the given
 * role in that organization (role is per-organization now, so there's no longer
 * an existing global role to inherit — this must be sent explicitly).
 */
export async function grantOrganizationAccess(
  organizationId: number,
  userId: number,
  role: string,
): Promise<void> {
  await api.put(`/api/workspaces/${organizationId}/members/${userId}`, { role });
}

/** DELETE /api/organizations/:organizationId/members/:userId — revokes an employee's access to one of the caller's own organizations. */
export async function revokeOrganizationAccess(organizationId: number, userId: number): Promise<void> {
  await api.delete(`/api/workspaces/${organizationId}/members/${userId}`);
}
