import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import { useWorkspaceId } from "./useWorkspaceId";
import { getDashboardSummary } from "../services/dashboard.service";

export function useDashboard() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.dashboard(wsId),
    queryFn: getDashboardSummary,
    enabled: Number.isFinite(wsId),
  });
}
