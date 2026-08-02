import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { fetchFileAccess, setFileAccess } from "../api/documents.api";

/** Explicit grants set directly on one file/folder — shared by both the project Documents tab and the organization Documents page. */
export function useFileAccessQuery(fileId: number | null) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.fileAccess(wsId, fileId ?? -1),
    queryFn: () => fetchFileAccess(fileId as number),
    enabled: Number.isFinite(wsId) && !!fileId,
  });
}

export function useSetFileAccessMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fileId,
      grants,
    }: {
      fileId: number;
      grants: { granteeType: "user" | "role"; userId?: number; role?: string; level: "none" | "read" | "write" }[];
    }) => setFileAccess(fileId, grants),
    onSuccess: (_data, { fileId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fileAccess(wsId, fileId) });
    },
  });
}
