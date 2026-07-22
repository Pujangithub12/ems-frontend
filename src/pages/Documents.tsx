import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FolderOpen,
  Folder,
  Briefcase,
  FileText,
  Plus,
  Upload,
  Download,
  Trash2,
  Pencil,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { ProjectFile } from "../types";
import { formatFileSize } from "../project-components/documentsApi";
import { workspaceDownloadUrl } from "../services/workspaceDocumentsApi";
import {
  useWorkspaceFilesQuery,
  useUploadWorkspaceFileMutation,
  useCreateWorkspaceFolderMutation,
  useDeleteWorkspaceFileMutation,
  useRenameWorkspaceFileMutation,
} from "../hooks/useWorkspaceFiles";
import { getErrorMessage } from "../lib/errors";
import ConfirmationModal from "../components/ConfirmationModal";

const ALL_DOCUMENTS = "all" as const;

const FILE_TYPE_STYLES: Record<string, string> = {
  pdf: "bg-red-100 text-red-700",
  doc: "bg-blue-100 text-blue-700",
  docx: "bg-blue-100 text-blue-700",
  xls: "bg-emerald-100 text-emerald-700",
  xlsx: "bg-emerald-100 text-emerald-700",
  dwg: "bg-indigo-100 text-indigo-700",
  jpg: "bg-amber-100 text-amber-700",
  jpeg: "bg-amber-100 text-amber-700",
  png: "bg-amber-100 text-amber-700",
};

const fileTypeStyle = (type?: string | null) =>
  FILE_TYPE_STYLES[(type || "").toLowerCase()] || "bg-slate-100 text-slate-600";

const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`text-[10px] tracking-[0.1em] uppercase text-slate-400 ${className}`}
    style={{ fontFamily: "'JetBrains Mono', monospace" }}
  >
    {children}
  </div>
);

/** Builds each folder's child list from the flat array, keyed by parentId ("root" = top level). */
function groupByParent(files: ProjectFile[]) {
  const map = new Map<string, ProjectFile[]>();
  files.forEach((f) => {
    const key = f.parentId ? String(f.parentId) : "root";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  });
  return map;
}

const FolderTree: React.FC<{
  files: ProjectFile[];
  childrenByParent: Map<string, ProjectFile[]>;
  parentKey: string;
  depth: number;
  selectedFolderId: number | null;
  onSelect: (folderId: number) => void;
  openMenuId: number | null;
  onToggleMenu: (folderId: number) => void;
  menuRef: React.RefObject<HTMLDivElement>;
  onRename: (folder: ProjectFile) => void;
  onDelete: (folder: ProjectFile) => void;
}> = ({
  files,
  childrenByParent,
  parentKey,
  depth,
  selectedFolderId,
  onSelect,
  openMenuId,
  onToggleMenu,
  menuRef,
  onRename,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const folders = (childrenByParent.get(parentKey) || []).filter((f) => f.isFolder);

  if (folders.length === 0) return null;

  return (
    <>
      {folders.map((folder) => {
        const hasChildren = (childrenByParent.get(String(folder.id)) || []).some(
          (f) => f.isFolder,
        );
        const isExpanded = expanded.has(folder.id);
        const isSelected = selectedFolderId === folder.id;
        const isMenuOpen = openMenuId === folder.id;
        const isProjectManaged = folder.projectId != null;
        return (
          <div key={folder.id} className="relative">
            <div
              className={`group flex items-center gap-1.5 w-full py-1.5 pr-1 text-[12px] rounded transition-colors ${
                isSelected
                  ? "bg-blue-50 text-blue-900 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <button
                onClick={() => onSelect(folder.id)}
                style={{ paddingLeft: `${12 + depth * 14}px` }}
                className="flex items-center flex-1 min-w-0 gap-1.5 text-left"
                title={folder.isProjectRoot ? "Project — Documents tab" : undefined}
              >
                {hasChildren ? (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        next.has(folder.id) ? next.delete(folder.id) : next.add(folder.id);
                        return next;
                      });
                    }}
                    className="flex items-center justify-center w-3.5 h-3.5 shrink-0"
                  >
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                {folder.isProjectRoot ? (
                  <Briefcase size={14} className="shrink-0 text-blue-900" />
                ) : (
                  <Folder size={14} className="shrink-0 text-slate-400" />
                )}
                <span className="truncate">{folder.name}</span>
              </button>
              {!isProjectManaged && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMenu(folder.id);
                  }}
                  className={`flex items-center justify-center w-5 h-5 rounded shrink-0 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-opacity ${
                    isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                  title="Folder options"
                >
                  <MoreVertical size={13} />
                </button>
              )}
            </div>

            {isMenuOpen && !isProjectManaged && (
              <div
                ref={menuRef}
                className="absolute z-20 overflow-hidden bg-white border rounded-md shadow-lg right-1 top-8 w-36 border-slate-200"
              >
                <button
                  onClick={() => onRename(folder)}
                  className="flex items-center w-full gap-2 px-3 py-2 text-[12px] text-left text-slate-700 hover:bg-slate-50"
                >
                  <Pencil size={13} className="text-slate-400" />
                  Rename
                </button>
                <button
                  onClick={() => onDelete(folder)}
                  className="flex items-center w-full gap-2 px-3 py-2 text-[12px] text-left text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            )}

            {isExpanded && (
              <FolderTree
                files={files}
                childrenByParent={childrenByParent}
                parentKey={String(folder.id)}
                depth={depth + 1}
                selectedFolderId={selectedFolderId}
                onSelect={onSelect}
                openMenuId={openMenuId}
                onToggleMenu={onToggleMenu}
                menuRef={menuRef}
                onRename={onRename}
                onDelete={onDelete}
              />
            )}
          </div>
        );
      })}
    </>
  );
};

const Documents: React.FC = () => {
  const filesQuery = useWorkspaceFilesQuery();
  const files = filesQuery.data ?? [];
  const loading = filesQuery.isLoading;
  const error = filesQuery.isError
    ? getErrorMessage(filesQuery.error, "Failed to load documents.")
    : null;
  const [refreshing, setRefreshing] = useState(false);
  const uploadFileMutation = useUploadWorkspaceFileMutation();
  const createFolderMutation = useCreateWorkspaceFolderMutation();
  const deleteFileMutation = useDeleteWorkspaceFileMutation();
  const renameFileMutation = useRenameWorkspaceFileMutation();

  const [selectedFolderId, setSelectedFolderId] = useState<number | typeof ALL_DOCUMENTS>(
    ALL_DOCUMENTS,
  );
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [renameTarget, setRenameTarget] = useState<ProjectFile | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openMenuId === null) return;
    const handler = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuId]);

  const refresh = async () => {
    setRefreshing(true);
    await filesQuery.refetch();
    setRefreshing(false);
  };

  const filesById = useMemo(() => {
    const map = new Map<number, ProjectFile>();
    files.forEach((f) => map.set(f.id, f));
    return map;
  }, [files]);

  const childrenByParent = useMemo(() => groupByParent(files), [files]);

  const folderPath = (folderId: number): ProjectFile[] => {
    const path: ProjectFile[] = [];
    let current = filesById.get(folderId);
    while (current) {
      path.unshift(current);
      current = current.parentId ? filesById.get(current.parentId) : undefined;
    }
    return path;
  };

  const visibleRows: ProjectFile[] = useMemo(() => {
    if (selectedFolderId === ALL_DOCUMENTS) {
      return files.filter((f) => !f.isFolder);
    }
    return childrenByParent.get(String(selectedFolderId)) || [];
  }, [files, selectedFolderId, childrenByParent]);

  const searchedRows = useMemo(() => {
    if (!search.trim()) return visibleRows;
    const q = search.trim().toLowerCase();
    return visibleRows.filter((f) => f.name.toLowerCase().includes(q));
  }, [visibleRows, search]);

  const folderNameOf = (file: ProjectFile): string => {
    if (!file.parentId) return "Root";
    return filesById.get(file.parentId)?.name || "Root";
  };

  const currentParentId = selectedFolderId === ALL_DOCUMENTS ? null : selectedFolderId;
  const currentFolder =
    selectedFolderId === ALL_DOCUMENTS ? null : filesById.get(selectedFolderId);
  // Anything mirrored from a project's Documents tab (the project's own
  // synthetic root folder, or a real folder/file nested under it) is
  // read-only here — uploads/new folders/renames/deletes for it happen on
  // the project's Documents tab instead.
  const isProjectScoped = currentFolder?.projectId != null;

  const handleUploadClick = () => {
    if (isProjectScoped) return;
    fileInputRef.current?.click();
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files;
    if (!chosen || chosen.length === 0 || isProjectScoped) return;
    setActionError(null);
    setUploading(true);
    try {
      for (const file of Array.from(chosen)) {
        await uploadFileMutation.mutateAsync({ file, parentId: currentParentId });
      }
      await filesQuery.refetch();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to upload file."));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreateFolder = async () => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName || isProjectScoped) return;

    // Fast local check so the user doesn't have to wait on a round trip for
    // the common case; the backend re-checks this to be authoritative.
    const siblings = childrenByParent.get(
      currentParentId === null ? "root" : String(currentParentId),
    ) || [];
    const alreadyExists = siblings.some(
      (f) => f.isFolder && f.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (alreadyExists) {
      setFolderError("A folder with this name already exists here.");
      return;
    }

    setCreatingFolder(true);
    setFolderError(null);
    try {
      await createFolderMutation.mutateAsync({ name: trimmedName, parentId: currentParentId });
      await filesQuery.refetch();
      setShowNewFolder(false);
      setNewFolderName("");
    } catch (err) {
      setFolderError(getErrorMessage(err, "Failed to create folder."));
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFileMutation.mutateAsync(deleteTarget.id);
      if (deleteTarget.isFolder && selectedFolderId === deleteTarget.id) {
        setSelectedFolderId(ALL_DOCUMENTS);
      }
      await filesQuery.refetch();
      setDeleteTarget(null);
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to delete."));
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleFolderMenu = (folderId: number) => {
    setOpenMenuId((prev) => (prev === folderId ? null : folderId));
  };

  const handleOpenRename = (folder: ProjectFile) => {
    setOpenMenuId(null);
    setRenameTarget(folder);
    setRenameValue(folder.name);
    setRenameError(null);
  };

  const handleOpenDeleteFromMenu = (folder: ProjectFile) => {
    setOpenMenuId(null);
    setDeleteTarget(folder);
  };

  const handleRenameSubmit = async () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;

    if (renameTarget.isFolder) {
      const siblings =
        childrenByParent.get(
          renameTarget.parentId ? String(renameTarget.parentId) : "root",
        ) || [];
      const alreadyExists = siblings.some(
        (f) =>
          f.isFolder &&
          f.id !== renameTarget.id &&
          f.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (alreadyExists) {
        setRenameError("A folder with this name already exists here.");
        return;
      }
    }

    setRenaming(true);
    setRenameError(null);
    try {
      await renameFileMutation.mutateAsync({ fileId: renameTarget.id, name: trimmed });
      await filesQuery.refetch();
      setRenameTarget(null);
    } catch (err) {
      setRenameError(getErrorMessage(err, "Failed to rename."));
    } finally {
      setRenaming(false);
    }
  };

  const totalDocs = files.filter((f) => !f.isFolder).length;
  const crumb = selectedFolderId === ALL_DOCUMENTS ? [] : folderPath(selectedFolderId);

  return (
    <div className="p-6 space-y-4">

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChosen}
        className="hidden"
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
          <p className="text-[12px] text-slate-400">Loading documents…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <p className="text-[13px] text-slate-600">{error}</p>
          <button
            onClick={refresh}
            className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleUploadClick}
                disabled={uploading || isProjectScoped}
                title={isProjectScoped ? "Managed from the project's Documents tab" : undefined}
                className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded text-[12px] font-medium hover:bg-blue-800 transition-colors disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                Upload
              </button>
              <button
                onClick={() => {
                  setFolderError(null);
                  setShowNewFolder(true);
                }}
                disabled={isProjectScoped}
                title={isProjectScoped ? "Managed from the project's Documents tab" : undefined}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded text-[12px] font-medium hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:hover:bg-white"
              >
                <Plus size={14} /> New Folder
              </button>
              <button
                onClick={refresh}
                className="flex items-center justify-center w-8 h-8 transition-colors border rounded text-slate-500 border-slate-200 hover:bg-slate-50"
                title="Refresh"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              </button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents..."
                className="pl-8 pr-3 py-2 w-56 text-[12px] border border-slate-200 rounded outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {actionError && (
            <div className="flex items-center justify-between px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
              <span>{actionError}</span>
              <button onClick={() => setActionError(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex gap-4">
            {/* Sidebar */}
            <div className="w-56 border rounded shrink-0 border-slate-200">
              <div className="px-3 py-2 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-200">
                Folders
              </div>
              <div className="py-1 min-h-[500px]">
                <button
                  onClick={() => setSelectedFolderId(ALL_DOCUMENTS)}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-left transition-colors ${
                    selectedFolderId === ALL_DOCUMENTS
                      ? "bg-blue-50 text-blue-900 font-medium"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <FolderOpen size={14} className="shrink-0 text-slate-400" />
                  All Documents
                </button>
                <FolderTree
                  files={files}
                  childrenByParent={childrenByParent}
                  parentKey="root"
                  depth={0}
                  selectedFolderId={selectedFolderId === ALL_DOCUMENTS ? null : selectedFolderId}
                  onSelect={(id) => setSelectedFolderId(id)}
                  openMenuId={openMenuId}
                  onToggleMenu={handleToggleFolderMenu}
                  menuRef={folderMenuRef}
                  onRename={handleOpenRename}
                  onDelete={handleOpenDeleteFromMenu}
                />
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded border-slate-200">
              {crumb.length > 0 && (
                <div className="flex items-center gap-1 px-3 py-2 text-[12px] text-slate-500 border-b border-slate-200 bg-slate-50">
                  <button
                    onClick={() => setSelectedFolderId(ALL_DOCUMENTS)}
                    className="hover:text-blue-900"
                  >
                    All Documents
                  </button>
                  {crumb.map((c) => (
                    <React.Fragment key={c.id}>
                      <ChevronRight size={12} />
                      <button
                        onClick={() => setSelectedFolderId(c.id)}
                        className="hover:text-blue-900"
                      >
                        {c.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {isProjectScoped && (
                <div className="flex items-center gap-2 px-3 py-2 text-[12px] border-b text-blue-900 bg-blue-50 border-slate-200">
                  <Briefcase size={13} className="shrink-0" />
                  Mirrored from this project's Documents tab — manage uploads and folders there.
                </div>
              )}

              {searchedRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
                    <FolderOpen className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
                    No documents yet
                  </h3>
                  <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                    Upload files or create a folder to get started.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                        <th className="px-3 py-2 font-medium text-left">Name</th>
                        {selectedFolderId === ALL_DOCUMENTS && (
                          <th className="px-3 py-2 font-medium text-left">Folder</th>
                        )}
                        <th className="px-3 py-2 font-medium text-left">Type</th>
                        <th className="px-3 py-2 font-medium text-left">Size</th>
                        <th className="px-3 py-2 font-medium text-left">Uploaded By</th>
                        <th className="px-3 py-2 font-medium text-left">Uploaded On</th>
                        <th className="px-3 py-2 font-medium text-left">Version</th>
                        <th className="px-3 py-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedRows.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                        >
                          <td className="px-3 py-2">
                            <button
                              onClick={() => row.isFolder && setSelectedFolderId(row.id)}
                              disabled={!row.isFolder}
                              className="flex items-center gap-2 text-left disabled:cursor-default"
                            >
                              {row.isFolder ? (
                                <Folder size={15} className="text-blue-900 shrink-0" />
                              ) : (
                                <span
                                  className={`flex items-center justify-center w-5 h-5 rounded shrink-0 ${fileTypeStyle(
                                    row.type,
                                  )}`}
                                >
                                  <FileText size={12} />
                                </span>
                              )}
                              <span
                                className={`truncate max-w-[220px] ${
                                  row.isFolder ? "text-blue-900 font-medium hover:underline" : "text-slate-800"
                                }`}
                              >
                                {row.name}
                              </span>
                            </button>
                          </td>
                          {selectedFolderId === ALL_DOCUMENTS && (
                            <td className="px-3 py-2 text-slate-500">{folderNameOf(row)}</td>
                          )}
                          <td className="px-3 py-2 uppercase text-slate-500">
                            {row.isFolder ? "Folder" : row.type || "--"}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {row.isFolder ? "--" : formatFileSize(row.size)}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {row.uploadedBy?.fullName || "--"}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {new Date(row.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {row.isFolder ? "--" : row.version}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              {!row.isFolder && (
                                <a
                                  href={workspaceDownloadUrl(row.id)}
                                  className="flex items-center justify-center transition-colors rounded w-7 h-7 text-slate-500 hover:text-blue-900 hover:bg-slate-100"
                                  title="Download"
                                >
                                  <Download size={14} />
                                </a>
                              )}
                              {row.projectId == null && (
                                <button
                                  onClick={() => setDeleteTarget(row)}
                                  className="flex items-center justify-center transition-colors rounded w-7 h-7 text-slate-500 hover:text-red-600 hover:bg-slate-100"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="px-3 py-2 text-[11px] text-slate-400 border-t border-slate-200">
                {searchedRows.length} item{searchedRows.length !== 1 ? "s" : ""} · {totalDocs} document
                {totalDocs !== 1 ? "s" : ""} total
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Folder modal */}
      {showNewFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">New Folder</h3>
              <button
                onClick={() => {
                  setShowNewFolder(false);
                  setNewFolderName("");
                  setFolderError(null);
                }}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {folderError && (
                <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
                  {folderError}
                </div>
              )}
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => {
                  setNewFolderName(e.target.value);
                  if (folderError) setFolderError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                placeholder="Folder name"
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex gap-2 p-4 pt-0">
              <button
                onClick={() => {
                  setShowNewFolder(false);
                  setNewFolderName("");
                  setFolderError(null);
                }}
                className="flex-1 px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
                className="flex-1 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
              >
                {creatingFolder ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">
                Rename {renameTarget.isFolder ? "Folder" : "File"}
              </h3>
              <button
                onClick={() => setRenameTarget(null)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {renameError && (
                <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
                  {renameError}
                </div>
              )}
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => {
                  setRenameValue(e.target.value);
                  if (renameError) setRenameError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
                className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex gap-2 p-4 pt-0">
              <button
                onClick={() => setRenameTarget(null)}
                className="flex-1 px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={renaming || !renameValue.trim()}
                className="flex-1 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
              >
                {renaming ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleting}
        title={deleteTarget?.isFolder ? "Delete Folder" : "Delete File"}
        message={
          deleteTarget?.isFolder
            ? "Are you sure you want to delete this folder? All the files inside it will be deleted as well."
            : `Delete "${deleteTarget?.name}"? This cannot be undone.`
        }
      />
    </div>
  );
};

export default Documents;
