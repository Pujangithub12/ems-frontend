import api from "../../../api/axios";

export type AccessPage = "purchase-orders" | "proforma-invoices";
export type AccessLevel = "view" | "edit";

export type AccessMember = { id: number; fullName: string; email: string; role: string };

export type AccessInfo = {
  canManage: boolean;
  grants: { userId: number; level: AccessLevel }[];
  /** Admins of the organization who can be given access (empty unless the caller can manage). */
  members: AccessMember[];
};

export async function fetchAccess(page: AccessPage): Promise<AccessInfo> {
  const res = await api.get<AccessInfo>(`/api/procurement-access/${page}`);
  return res.data;
}

/** Full-replace of the page's access list. Super admin only. */
export async function saveAccess(page: AccessPage, grants: { userId: number; level: AccessLevel }[]): Promise<AccessInfo> {
  const res = await api.put<AccessInfo>(`/api/procurement-access/${page}`, { grants });
  return res.data;
}
