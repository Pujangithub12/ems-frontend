import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import { useWorkspaceId } from "./useWorkspaceId";
import { getHierarchy, saveHierarchy } from "../services/hierarchy.service";
import { HierarchyPerson } from "../types";

export function useHierarchy() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.hierarchy(wsId),
    queryFn: getHierarchy,
    enabled: Number.isFinite(wsId),
  });
}

/**
 * Optimistic: the org tree's drag-and-drop feels instant only if the cache
 * updates immediately, before the server confirms — rolled back on error.
 */
export function useSaveHierarchy() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveHierarchy,
    onMutate: async (updated: HierarchyPerson[]) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.hierarchy(wsId) });
      const previous = queryClient.getQueryData<HierarchyPerson[]>(queryKeys.hierarchy(wsId));
      queryClient.setQueryData(queryKeys.hierarchy(wsId), updated);
      return { previous };
    },
    onError: (_err, _updated, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.hierarchy(wsId), context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.hierarchy(wsId), data);
    },
  });
}
