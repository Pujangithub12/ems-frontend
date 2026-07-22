import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useWorkspaceId } from "../../../hooks/useWorkspaceId";
import {
  fetchWorkspaceFiles,
  uploadWorkspaceFile,
  createWorkspaceFolder,
  deleteWorkspaceFile,
  renameWorkspaceFile,
} from "../api/workspaceDocuments.api";

/** Thin query-hook wrappers around workspaceDocumentsApi.ts, for the sidebar Documents page. */
export function useWorkspaceFilesQuery() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.workspaceFiles(wsId),
    queryFn: () => fetchWorkspaceFiles(),
    enabled: Number.isFinite(wsId),
  });
}

export function useUploadWorkspaceFileMutation() {
  return useMutation({
    mutationFn: ({ file, parentId }: { file: File; parentId: number | null }) =>
      uploadWorkspaceFile(file, parentId),
  });
}

export function useCreateWorkspaceFolderMutation() {
  return useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) =>
      createWorkspaceFolder(name, parentId),
  });
}

export function useDeleteWorkspaceFileMutation() {
  return useMutation({
    mutationFn: (fileId: number) => deleteWorkspaceFile(fileId),
  });
}

export function useRenameWorkspaceFileMutation() {
  return useMutation({
    mutationFn: ({ fileId, name }: { fileId: number; name: string }) =>
      renameWorkspaceFile(fileId, name),
  });
}
