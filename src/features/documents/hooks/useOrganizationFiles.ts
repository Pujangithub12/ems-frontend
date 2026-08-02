import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchOrganizationFiles,
  uploadOrganizationFile,
  createOrganizationFolder,
  deleteOrganizationFile,
  renameOrganizationFile,
} from "../api/organizationDocuments.api";

/** Thin query-hook wrappers around organizationDocumentsApi.ts, for the sidebar Documents page. */
export function useOrganizationFilesQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.organizationFiles(wsId),
    queryFn: () => fetchOrganizationFiles(),
    enabled: Number.isFinite(wsId),
  });
}

export function useUploadOrganizationFileMutation() {
  return useMutation({
    mutationFn: ({ file, parentId }: { file: File; parentId: number | null }) =>
      uploadOrganizationFile(file, parentId),
  });
}

export function useCreateOrganizationFolderMutation() {
  return useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) =>
      createOrganizationFolder(name, parentId),
  });
}

export function useDeleteOrganizationFileMutation() {
  return useMutation({
    mutationFn: (fileId: number) => deleteOrganizationFile(fileId),
  });
}

export function useRenameOrganizationFileMutation() {
  return useMutation({
    mutationFn: ({ fileId, name }: { fileId: number; name: string }) =>
      renameOrganizationFile(fileId, name),
  });
}
