import api from "../api/axios";
import { ProjectFile } from "../types";

/** GET all files/folders for the workspace-level sidebar Documents page (flat list; nesting is via parentId). */
export async function fetchWorkspaceFiles(): Promise<ProjectFile[]> {
  const res = await api.get<{ files: ProjectFile[] }>("/api/workspace/files");
  return res.data.files ?? [];
}

/** POST create a folder, optionally nested inside another folder. */
export async function createWorkspaceFolder(
  name: string,
  parentId: number | null,
): Promise<ProjectFile> {
  const res = await api.post<{ file: ProjectFile }>("/api/workspace/folders", {
    name,
    parentId,
  });
  return res.data.file;
}

/** POST upload a file into an optional folder. */
export async function uploadWorkspaceFile(
  file: File,
  parentId: number | null,
): Promise<ProjectFile> {
  const formData = new FormData();
  formData.append("file", file);
  if (parentId !== null) {
    formData.append("parentId", String(parentId));
  }
  const res = await api.post<{ file: ProjectFile }>("/api/workspace/files", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.file;
}

/** DELETE a file, or a folder and everything inside it — same endpoint used by the project Documents tab. */
export async function deleteWorkspaceFile(fileId: number): Promise<void> {
  await api.delete(`/api/projects/files/${fileId}`);
}

/** PUT rename a file or folder — same endpoint used by the project Documents tab. */
export async function renameWorkspaceFile(
  fileId: number,
  name: string,
): Promise<ProjectFile> {
  const res = await api.put<{ file: ProjectFile }>(`/api/projects/files/${fileId}`, {
    name,
  });
  return res.data.file;
}

/** Direct download URL for a file (opened in a new tab / set as href). */
export function workspaceDownloadUrl(fileId: number): string {
  const base = (api.defaults.baseURL ?? "").replace(/\/$/, "");
  return `${base}/api/projects/files/${fileId}/download`;
}
