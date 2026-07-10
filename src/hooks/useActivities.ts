import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import { useWorkspaceId } from "./useWorkspaceId";
import { getActivities } from "../services/activities.service";

/** `poll` enables the 5s auto-refresh used by the Activities page; other
 * consumers (e.g. Dashboard) just want a single fetch. */
export function useActivities(options: { poll?: boolean } = {}) {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.activities(wsId),
    queryFn: getActivities,
    enabled: Number.isFinite(wsId),
    refetchInterval: options.poll ? 5000 : undefined,
  });
}
