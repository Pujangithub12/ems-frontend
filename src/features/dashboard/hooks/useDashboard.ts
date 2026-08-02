import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { getDashboardSummary } from "../api/dashboard.api";

export function useDashboard() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.dashboard(wsId),
    queryFn: getDashboardSummary,
    enabled: Number.isFinite(wsId),
  });
}
