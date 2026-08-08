import api from "../../../api/axios";
import { ProjectFile, FileAccessGrant } from "../../../types";

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

/** GET the explicit access grants set directly on a file/folder (admin/super_admin only). */
export async function fetchFileAccess(fileId: number): Promise<FileAccessGrant[]> {
  const res = await api.get<{ grants: FileAccessGrant[] }>(
    `/api/projects/files/${fileId}/access`,
  );
  return res.data.grants ?? [];
}

/** PUT full-replace the access grants on a file/folder (admin/super_admin only). */
export async function setFileAccess(
  fileId: number,
  grants: { granteeType: "user" | "role"; userId?: number; role?: string; level: "none" | "read" | "write" }[],
): Promise<FileAccessGrant[]> {
  const res = await api.put<{ grants: FileAccessGrant[] }>(
    `/api/projects/files/${fileId}/access`,
    { grants },
  );
  return res.data.grants ?? [];
}

/** Direct download URL for a file (opened in a new tab / set as href). */
export function downloadUrl(fileId: number): string {
  const base = (api.defaults.baseURL ?? "").replace(/\/$/, "");
  return `${base}/api/projects/files/${fileId}/download`;
}

/** URL for viewing a file inline in the browser (not downloading). */
export function viewUrl(fileId: number): string {
  const base = (api.defaults.baseURL ?? "").replace(/\/$/, "");
  return `${base}/api/projects/files/${fileId}/view`;
}

/**
 * Requests a short-lived (5 min), single-file-scoped signed URL that Microsoft's
 * Office Online viewer can fetch directly (it has no way to send our auth
 * cookie). The read-access check happens server-side before this URL is ever
 * issued — see ProjectFileController.getFileViewToken.
 */
export async function getFileViewToken(fileId: number): Promise<string> {
  const res = await api.get<{ url: string }>(`/api/projects/files/${fileId}/view-token`);
  return res.data.url;
}

/** File types react-doc-viewer renders fully client-side (pdf.js / native <img> / plain text) — fetched as an authenticated blob, no signed URL needed. */
export function isClientRenderableFileType(type?: string | null): boolean {
  if (!type) return false;
  const viewable = ["pdf", "jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "txt", "csv"];
  return viewable.includes(type.toLowerCase());
}

/** Office formats previewed via Microsoft's Office Online viewer over a signed URL (see getFileViewToken) — this doesn't work against a non-public host like localhost. */
export function isOfficeFileType(type?: string | null): boolean {
  if (!type) return false;
  const office = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];
  return office.includes(type.toLowerCase());
}

/** Check if a file type can be previewed in-browser at all (either path above). */
export function isViewableFileType(type?: string | null): boolean {
  return isClientRenderableFileType(type) || isOfficeFileType(type);
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
