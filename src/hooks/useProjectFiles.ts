import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import { useWorkspaceId } from "./useWorkspaceId";
import {
  fetchProjectFiles,
  uploadFile,
  createFolder,
  deleteFile,
  renameFile,
} from "../project-components/documentsApi";

/** Thin query-hook wrappers around the existing documentsApi.ts service functions. */
export function useProjectFilesQuery(projectId: string) {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.projectFiles(wsId, projectId),
    queryFn: () => fetchProjectFiles(projectId),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

export function useUploadFileMutation() {
  return useMutation({
    mutationFn: ({
      projectId,
      file,
      parentId,
    }: {
      projectId: string;
      file: File;
      parentId: number | null;
    }) => uploadFile(projectId, file, parentId),
  });
}

export function useCreateFolderMutation() {
  return useMutation({
    mutationFn: ({
      projectId,
      name,
      parentId,
    }: {
      projectId: string;
      name: string;
      parentId: number | null;
    }) => createFolder(projectId, name, parentId),
  });
}

export function useDeleteFileMutation() {
  return useMutation({
    mutationFn: (fileId: number) => deleteFile(fileId),
  });
}

export function useRenameFileMutation() {
  return useMutation({
    mutationFn: ({ fileId, name }: { fileId: number; name: string }) =>
      renameFile(fileId, name),
  });
}
