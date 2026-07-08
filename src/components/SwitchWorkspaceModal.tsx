import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Check, Plus, Loader2 } from "lucide-react";
import { useAuth, Workspace } from "../context/AuthProvider";

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

type SwitchWorkspaceModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const SwitchWorkspaceModal: React.FC<SwitchWorkspaceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { workspace, workspaces, createWorkspace } = useAuth();

  if (!isOpen) return null;

  const handleClose = () => {
    setShowCreateForm(false);
    setNewWorkspaceName("");
    setNewWorkspaceDescription("");
    onClose();
  };

  const handleSwitch = (workspaceId: number) => {
    handleClose();
    // The route change is what actually drives the switch — DashboardLayout
    // picks up the new :workspaceId param and syncs everything else.
    navigate(`/${workspaceId}/dashboard`);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setCreating(true);
    try {
      const created = await createWorkspace(
        newWorkspaceName,
        newWorkspaceDescription,
      );
      if (created) {
        handleClose();
        navigate(`/${created.id}/dashboard`);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/45">
      <div className="w-full max-w-md overflow-hidden bg-white border rounded-md shadow-lg border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <Eyebrow>Workspaces</Eyebrow>
            <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">
              Switch Workspace
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!showCreateForm ? (
          <>
            <div className="p-3 space-y-1 max-h-[50vh] overflow-y-auto">
              {workspaces
                .filter((w): w is Workspace => w !== null && w !== undefined)
                .map((ws) => {
                  const isCurrent = workspace?.id === ws.id;
                  return (
                    <button
                      key={ws.id}
                      onClick={() => !isCurrent && handleSwitch(ws.id)}
                      className={`flex items-center w-full gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
                        isCurrent ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-[12px] font-bold text-white rounded bg-blue-900">
                        {ws.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-slate-900 truncate">
                          {ws.name}
                        </div>
                        {isCurrent && (
                          <div className="text-[11px] text-slate-500">
                            Current workspace
                          </div>
                        )}
                      </div>
                      {isCurrent && (
                        <Check className="flex-shrink-0 w-4 h-4 text-emerald-600" />
                      )}
                    </button>
                  );
                })}
            </div>
            <div className="p-3 border-t border-slate-200">
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center w-full gap-3 px-3 py-2.5 text-left transition-colors rounded-md hover:bg-slate-50"
              >
                <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded bg-slate-100 text-slate-500">
                  <Plus className="w-4 h-4" />
                </div>
                <div className="text-[13px] font-medium text-slate-900">
                  Add workspace
                </div>
              </button>
            </div>
          </>
        ) : (
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
                autoFocus
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
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-70 transition-colors"
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SwitchWorkspaceModal;
