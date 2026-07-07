import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import {
  Building2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Eyebrow } from "./SettingsShared";

const WorkspaceTab: React.FC = () => {
  const { user, workspace, updateWorkspace, deleteWorkspace } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [wsName, setWsName] = useState(workspace?.name || "");
  const [wsDescription, setWsDescription] = useState(workspace?.description || "");
  const [wsSaving, setWsSaving] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [wsSuccess, setWsSuccess] = useState<string | null>(null);

  useEffect(() => {
    setWsName(workspace?.name || "");
    setWsDescription(workspace?.description || "");
  }, [workspace?.id]);

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !wsName.trim()) return;
    setWsSaving(true);
    setWsError(null);
    setWsSuccess(null);
    try {
      await updateWorkspace(workspace.id, wsName.trim(), wsDescription);
      setWsSuccess("Workspace updated.");
    } catch (err: any) {
      setWsError(err?.response?.data?.message || "Failed to update workspace.");
    } finally {
      setWsSaving(false);
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteWorkspace = async () => {
    if (!workspace) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const next = await deleteWorkspace(workspace.id, deleteConfirmText);
      setShowDeleteModal(false);
      setDeleteConfirmText("");
      if (next) navigate(`/${next.id}/dashboard`, { replace: true });
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || "Failed to delete workspace.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="max-w-2xl overflow-hidden bg-white border rounded-md border-slate-200">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200">
          <Building2 className="w-4 h-4 text-slate-400" />
          <div className="font-semibold text-[15px] text-slate-900">
            Workspace details
          </div>
        </div>
        <form onSubmit={handleSaveWorkspace} className="p-5 space-y-4">
          {wsError && (
            <div className="flex items-center gap-2 p-3 text-[12px] font-medium border text-rose-700 bg-rose-50 rounded border-rose-100">
              <AlertCircle className="flex-shrink-0 w-4 h-4" />
              {wsError}
            </div>
          )}
          {wsSuccess && (
            <div className="flex items-center gap-2 p-3 text-[12px] font-medium border text-emerald-700 bg-emerald-50 rounded border-emerald-100">
              <CheckCircle2 className="flex-shrink-0 w-4 h-4" />
              {wsSuccess}
            </div>
          )}
          <div className="space-y-1.5">
            <Eyebrow>Name</Eyebrow>
            <input
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              disabled={!isAdmin}
              required
              className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div className="space-y-1.5">
            <Eyebrow>Description</Eyebrow>
            <textarea
              value={wsDescription}
              onChange={(e) => setWsDescription(e.target.value)}
              disabled={!isAdmin}
              rows={3}
              className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors resize-none disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="What's this workspace for?"
            />
          </div>
          {isAdmin && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={wsSaving}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors disabled:opacity-70"
              >
                {wsSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          )}

          {isAdmin && (
            <div className="pt-2 mt-2 border-t border-slate-200">
              <div className="p-4 mt-4 border border-red-200 rounded-md bg-red-50/60">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="flex-shrink-0 w-4 h-4 mt-0.5 text-red-600" />
                  <div className="flex-1">
                    <h4 className="text-[13px] font-semibold text-red-700">
                      Delete this workspace
                    </h4>
                    <p className="mt-1 text-[12px] text-red-600/90 leading-relaxed">
                      Permanently deletes this workspace along with all of its
                      projects, tasks, announcements, leave requests, calendar
                      events, and files. This cannot be undone.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirmText("");
                        setDeleteError(null);
                        setShowDeleteModal(true);
                      }}
                      className="mt-3 px-3 py-1.5 text-[12px] font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                    >
                      Delete Workspace
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Delete Workspace Modal */}
      {showDeleteModal && workspace && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-6">
          <div className="w-full max-w-md overflow-hidden bg-white border rounded-md shadow-lg border-slate-200">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-red-100 bg-red-50">
              <div className="flex items-center justify-center flex-shrink-0 text-red-700 bg-red-100 rounded-full w-9 h-9">
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
    </>
  );
};

export default WorkspaceTab;
