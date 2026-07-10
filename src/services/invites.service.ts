import api from "../api/axios";

export type InvitePreview = {
  fullName: string;
  email: string;
  jobPosition: string;
  role: string;
};

export type InviteLookup = {
  invite: InvitePreview;
  workspaceName: string;
};

/** GET /api/invites/:token — public, unauthenticated. Resolves an invite token to its preview details. */
export async function getInvite(token: string): Promise<InviteLookup> {
  const res = await api.get(`/api/invites/${token}`);
  return {
    invite: res.data.invite,
    workspaceName: res.data.workspace?.name || "the workspace",
  };
}
