import api from "../api/axios";
import { ProjectFile } from "../types";

/** GET all files/folders for a project's Documents tab (flat list; nesting is via parentId). */
export async function fetchProjectFiles(
  projectId: string,
): Promise<ProjectFile[]> {
  const res = await api.get<{ files: ProjectFile[] }>(
    `/api/projects/${projectId}/files`,
  );
  return res.data.files ?? [];
}

/** POST create a folder, optionally nested inside another folder. */
export async function createFolder(
  projectId: string,
  name: string,
  parentId: number | null,
): Promise<ProjectFile> {
  const res = await api.post<{ file: ProjectFile }>(
    `/api/projects/${projectId}/folders`,
    { name, parentId },
  );
  return res.data.file;
}

/** POST upload a file into an optional folder. */
export async function uploadFile(
  projectId: string,
  file: File,
  parentId: number | null,
): Promise<ProjectFile> {
  const formData = new FormData();
  formData.append("file", file);
  if (parentId !== null) {
    formData.append("parentId", String(parentId));
  }
  const res = await api.post<{ file: ProjectFile }>(
    `/api/projects/${projectId}/files`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data.file;
}

/** DELETE a file, or a folder and everything inside it. */
export async function deleteFile(fileId: number): Promise<void> {
  await api.delete(`/api/projects/files/${fileId}`);
}

/** PUT rename a file or folder. */
export async function renameFile(
  fileId: number,
  name: string,
): Promise<ProjectFile> {
  const res = await api.put<{ file: ProjectFile }>(
    `/api/projects/files/${fileId}`,
    { name },
  );
  return res.data.file;
}

/** Direct download URL for a file (opened in a new tab / set as href). */
export function downloadUrl(fileId: number): string {
  const base = (api.defaults.baseURL ?? "").replace(/\/$/, "");
  return `${base}/api/projects/files/${fileId}/download`;
}

/** Human-readable file size, e.g. "2.4 MB". */
export function formatFileSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return "--";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
}
