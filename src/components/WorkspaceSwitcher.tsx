import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Check, Plus, Settings, AlertTriangle, X } from "lucide-react";
import { useAuth, Workspace } from "../context/AuthProvider";

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="text-[10px] tracking-[0.1em] uppercase text-slate-400 px-3 pt-2.5 pb-1.5"
    style={{ fontFamily: "'JetBrains Mono', monospace" }}
  >
    {children}
  </div>
);

const WorkspaceSwitcher: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const {
    user,
    workspace,
    workspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
  } = useAuth();

  const isWorkspaceAdmin = user?.role === "admin" || user?.role === "super_admin";

  // Workspace settings modal (rename)
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsDescription, setSettingsDescription] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Delete workspace confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSwitch = (workspaceId: number) => {
    setOpen(false);
    // The route change is what actually drives the switch — DashboardLayout
    // picks up the new :workspaceId param and syncs everything else.
    navigate(`/${workspaceId}/dashboard`);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    const created = await createWorkspace(newWorkspaceName, newWorkspaceDescription);
    setShowCreateModal(false);
    setNewWorkspaceName("");
    setNewWorkspaceDescription("");
    if (created) {
      navigate(`/${created.id}/dashboard`);
    }
  };

  const openSettings = () => {
    setSettingsName(workspace?.name || "");
    setSettingsDescription(workspace?.description || "");
    setSettingsError(null);
    setShowSettingsModal(true);
    setOpen(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !settingsName.trim()) return;
    setSavingSettings(true);
    setSettingsError(null);
    try {
      await updateWorkspace(workspace.id, settingsName.trim(), settingsDescription);
      setShowSettingsModal(false);
    } catch (err: any) {
      setSettingsError(
        err?.response?.data?.message || "Failed to update workspace.",
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const openDeleteModal = () => {
    setDeleteConfirmText("");
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const handleDeleteWorkspace = async () => {
    if (!workspace) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const nextWorkspace = await deleteWorkspace(workspace.id, deleteConfirmText);
      setShowDeleteModal(false);
      setShowSettingsModal(false);
      setDeleteConfirmText("");
      if (nextWorkspace) {
        navigate(`/${nextWorkspace.id}/dashboard`, { replace: true });
      }
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.message || "Failed to delete workspace.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative w-full" ref={ref}>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 hover:bg-slate-800 rounded px-2.5 py-2.5 text-left transition-colors"
      >
        <div className="w-[26px] h-[26px] bg-blue-900 rounded flex items-center justify-center text-white font-bold text-[10px] tracking-[0.05em] flex-shrink-0">
          {workspace?.name.charAt(0).toUpperCase() || "EM"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold tracking-tight leading-tight truncate text-[14px] text-white">
            {workspace?.name || "EMS Workspace"}
          </div>
          <div
            className="text-[10px] text-slate-400 tracking-[0.08em] uppercase"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Management
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {/* Dropdown Popup */}
      {open && (
        <div
          className="absolute left-0 top-[calc(100% + 6px)] w-full bg-white rounded-md border border-slate-200 z-50 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ minWidth: 228 }}
        >
          {/* Current Workspace Section */}
          <Eyebrow>Current workspace</Eyebrow>
          <div className="px-3 py-2 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-900 rounded flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0">
              {workspace?.name.charAt(0).toUpperCase() || "EM"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate text-[13px] text-slate-900">
                {workspace?.name || "EMS Workspace"}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Management · {workspaces.length} Workspaces
              </div>
            </div>
            <Check className="flex-shrink-0 w-4 h-4 text-emerald-600" />
          </div>

          <div className="h-px my-1 bg-slate-200" />

          {/* Switch Workspace Section */}
          <Eyebrow>Switch workspace</Eyebrow>
          {workspaces
            .filter((w): w is Workspace => w !== null && w !== undefined) // Type guard to filter out null/undefined
            .filter((w) => workspace?.id && w.id !== workspace.id)
            .map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSwitch(ws.id)}
                className="flex items-center w-full gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-100"
              >
                <div className="w-6 h-6 bg-slate-200 rounded flex items-center justify-center text-slate-600 font-bold text-[9px] flex-shrink-0">
                  {ws.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-slate-900 truncate">
                    {ws.name}
                </div>
                </div>
              </button>
            ))}

          <div className="h-px my-1 bg-slate-200" />

          {/* Add Workspace Section */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center w-full gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-100"
          >
            <div className="flex items-center justify-center flex-shrink-0 w-6 h-6 rounded bg-slate-100 text-slate-500">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <div className="text-[13px] font-medium text-slate-900">
              Add workspace
            </div>
          </button>

          {isWorkspaceAdmin && (
            <button
              onClick={openSettings}
              className="flex items-center w-full gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-100"
            >
              <div className="flex items-center justify-center flex-shrink-0 w-6 h-6 rounded bg-slate-100 text-slate-500">
                <Settings className="w-3.5 h-3.5" />
              </div>
              <div className="text-[13px] font-medium text-slate-900">
                Workspace settings
              </div>
            </button>
          )}
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-6">
          <div className="w-full max-w-md bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>Create Workspace</Eyebrow>
                <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">
                  Create a new workspace
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
              >
                <Plus className="w-4 h-4 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleCreateWorkspace} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-600">
                  Name
                </label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  placeholder="My New Workspace"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-600">
                  Description (optional)
                </label>
                <textarea
                  value={newWorkspaceDescription}
                  onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors resize-none"
                  placeholder="This is a new workspace"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Workspace Settings Modal */}
      {showSettingsModal && workspace && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-6">
          <div className="w-full max-w-md bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>Workspace Settings</Eyebrow>
                <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">
                  {workspace.name}
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSettings} className="p-6 space-y-4">
              {settingsError && (
                <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
                  {settingsError}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-600">
                  Name
                </label>
                <input
                  type="text"
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-600">
                  Description (optional)
                </label>
                <textarea
                  value={settingsDescription}
                  onChange={(e) => setSettingsDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors disabled:opacity-60"
                >
                  {savingSettings ? "Saving..." : "Save Changes"}
                </button>
              </div>

              {/* Danger Zone */}
              <div className="pt-2 mt-2 border-t border-slate-200">
                <div className="p-4 mt-4 border rounded-md border-red-200 bg-red-50/60">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="flex-shrink-0 w-4 h-4 mt-0.5 text-red-600" />
                    <div className="flex-1">
                      <h4 className="text-[13px] font-semibold text-red-700">
                        Delete this workspace
                      </h4>
                      <p className="mt-1 text-[12px] text-red-600/90 leading-relaxed">
                        Permanently deletes this workspace along with all of its
                        projects, tasks, announcements, leave requests,
                        calendar events, and files. This cannot be undone.
                      </p>
                      <button
                        type="button"
                        onClick={openDeleteModal}
                        className="mt-3 px-3 py-1.5 text-[12px] font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                      >
                        Delete Workspace
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Workspace Confirmation Modal */}
      {showDeleteModal && workspace && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-6">
          <div className="w-full max-w-md bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-red-100 bg-red-50">
              <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-red-700 bg-red-100 rounded-full">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-semibold text-[15px] text-slate-900">
                  Delete "{workspace.name}"?
                </h3>
                <p className="text-[11px] text-slate-500">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[13px] text-slate-600 leading-relaxed">
                Are you sure you want to delete this workspace? All projects,
                tasks, announcements, leave requests, calendar events,
                activities, and files inside it will be permanently deleted.
                Members will simply be removed from it — their accounts are
                not affected.
              </p>
              {deleteError && (
                <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
                  {deleteError}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-600">
                  Type <span className="font-semibold">{workspace.name}</span>{" "}
                  to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-red-400 transition-colors"
                  placeholder={workspace.name}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteWorkspace}
                  disabled={deleting || deleteConfirmText !== workspace.name}
                  className="px-4 py-2 text-[13px] font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? "Deleting..." : "Delete Workspace"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceSwitcher;
