import api from "../api/axios";
import { User } from "../types";

export type InviteUserPayload = {
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  jobPosition: string;
  joinDate: string;
  role: string;
};

export type UpdateUserPayload = Partial<{
  fullName: string;
  email: string;
  password: string;
  phoneNumber: string;
  address: string;
  jobPosition: string;
  joinDate: string;
  role: string;
}>;

/** GET /api/users — every member of the current workspace. */
export async function getUsers(): Promise<User[]> {
  const res = await api.get<User[]>("/api/users");
  return res.data;
}

/** POST /api/users/invite — sends a workspace invite, no account is created yet. */
export async function inviteUser(payload: InviteUserPayload): Promise<void> {
  await api.post("/api/users/invite", payload);
}

/** PUT /api/users/:id — partial update, shared by the full-edit form and the single-field role picker. */
export async function updateUser(id: number, payload: UpdateUserPayload): Promise<void> {
  await api.put(`/api/users/${id}`, payload);
}

/** DELETE /api/users/:id — removes a member from the workspace. */
export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/api/users/${id}`);
}

/** PUT /api/me/password — shared by Profile and Settings > Security. */
export async function changeMyPassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await api.put("/api/me/password", payload);
}

/**
 * PUT /api/me — the signed-in user's own contact details. Returns `any`
 * (not the workspace-member `User` type above) since the caller feeds this
 * straight into AuthProvider's separately-typed session `User` shape.
 */
export async function updateMyProfile(payload: {
  phoneNumber?: string;
  address?: string;
}): Promise<any> {
  const res = await api.put("/api/me", payload);
  return res.data.user;
}
