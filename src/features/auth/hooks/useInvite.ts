import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { getInvite } from "../api/invites.api";

/** Unauthenticated — no workspace context, so this doesn't use useWorkspaceId(). */
export function useInvite(token: string) {
  return useQuery({
    queryKey: queryKeys.invite(token),
    queryFn: () => getInvite(token),
    enabled: !!token,
    retry: false,
  });
}
