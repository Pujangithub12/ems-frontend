import api from "../api/axios";
import { PermissionMatrix } from "../setting-components/SettingsShared";

/** GET /api/permissions — the full role x permission matrix. */
export async function getPermissions(): Promise<PermissionMatrix> {
  const res = await api.get<{ permissions: PermissionMatrix }>("/api/permissions");
  return res.data.permissions;
}

/** PUT /api/permissions — bulk update of individual (role, permissionKey) grants. */
export async function updatePermissions(
  updates: { role: string; permissionKey: string; granted: boolean }[],
): Promise<PermissionMatrix> {
  const res = await api.put<{ permissions: PermissionMatrix }>("/api/permissions", {
    updates,
  });
  return res.data.permissions;
}
