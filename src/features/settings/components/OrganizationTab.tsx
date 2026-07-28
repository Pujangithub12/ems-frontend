import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthProvider";
import {
  Building2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Check,
  ShieldCheck,
  Users as UsersIcon,
  Plus,
  X,
} from "lucide-react";
import { Eyebrow } from "./SettingsShared";
import {
  useOrganizationAccessMatrix,
  useGrantOrganizationAccess,
  useRevokeOrganizationAccess,
} from "../hooks/useOrganizationAccess";

/**
 * Lets a caller who belongs to more than one of their own organizations control
 * which of those organizations each employee can access — a checkbox grid
 * (employee x organization) backed by the access-matrix endpoints, rather than
 * having to re-invite the same person from each organization's Users page.
 *
 * Checkbox clicks only stage a change locally — nothing is sent to the
 * server until the admin reviews their selections and clicks "Verify
 * Changes", so a misclick can't instantly grant/revoke real access.
 */
const AccessMatrixSection: React.FC = () => {
  const { data, isLoading } = useOrganizationAccessMatrix();
  const grantMutation = useGrantOrganizationAccess();
  const revokeMutation = useRevokeOrganizationAccess();
  // Staged changes only: key -> desired access state, present only for cells
  // that differ from what the server currently has.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [verifying, setVerifying] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);
  const [matrixSuccess, setMatrixSuccess] = useState<string | null>(null);

  const cellKey = (organizationId: number, employeeId: number) => `${organizationId}-${employeeId}`;

  const effectiveAccess = (organizationId: number, employeeId: number, serverValue: boolean) => {
    const key = cellKey(organizationId, employeeId);
    return key in pending ? pending[key] : serverValue;
  };

  const toggleCell = (organizationId: number, employeeId: number, serverValue: boolean) => {
    const key = cellKey(organizationId, employeeId);
    setMatrixSuccess(null);
    setPending((prev) => {
      const current = key in prev ? prev[key] : serverValue;
      const nextValue = !current;
      const next = { ...prev };
      if (nextValue === serverValue) {
        // Toggling back to what the server already has un-stages it.
        delete next[key];
      } else {
        next[key] = nextValue;
      }
      return next;
    });
  };

  const pendingEntries = Object.entries(pending);

  const handleDiscard = () => {
    setPending({});
    setMatrixError(null);
    setMatrixSuccess(null);
  };

  const handleVerify = async () => {
    if (pendingEntries.length === 0) return;
    setVerifying(true);
    setMatrixError(null);
    setMatrixSuccess(null);

    for (const [key, desired] of pendingEntries) {
      const [wsIdStr, empIdStr] = key.split("-");
      const organizationId = Number(wsIdStr);
      const userId = Number(empIdStr);
      try {
        if (desired) {
          // This checkbox grid only grants/revokes access, it doesn't pick
          // a role per cell — new access always starts as "user" here,
          // matching the backend's own default. Bump someone to admin/super
          // admin for that organization from the Users page afterward.
          await grantMutation.mutateAsync({ organizationId, userId, role: "user" });
        } else {
          await revokeMutation.mutateAsync({ organizationId, userId });
        }
        setPending((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } catch (err: any) {
        setMatrixError(
          err?.response?.data?.message ||
            "Failed to save one of the changes. Remaining unsaved changes are still selected below.",
        );
        setVerifying(false);
        return;
      }
    }

    setVerifying(false);
    setMatrixSuccess("Access changes saved.");
  };

  return (
    <div className="mt-6 overflow-hidden bg-white border rounded-md border-slate-200">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200">
        <UsersIcon className="w-4 h-4 text-slate-400" />
        <div className="font-semibold text-[15px] text-slate-900">
          Employee Organization Access
        </div>
      </div>
      <div className="p-5">
        <p className="mb-4 text-slate-500 text-[12.5px] leading-relaxed">
          Control which of your organizations each employee can access. Check or
          uncheck boxes below, then click Verify Changes to apply them — an
          employee checked in more than one organization uses the same login and
          switches between them from the organization picker.
        </p>
        {matrixError && (
          <div className="flex items-center gap-2 p-3 mb-4 text-[12px] font-medium border text-rose-700 bg-rose-50 rounded border-rose-100">
            <AlertCircle className="flex-shrink-0 w-4 h-4" />
            {matrixError}
          </div>
        )}
        {matrixSuccess && (
          <div className="flex items-center gap-2 p-3 mb-4 text-[12px] font-medium border text-emerald-700 bg-emerald-50 rounded border-emerald-100">
            <CheckCircle2 className="flex-shrink-0 w-4 h-4" />
            {matrixSuccess}
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
          </div>
        ) : !data || data.organizations.length <= 1 ? (
          <p className="py-6 text-center text-slate-400 text-[12.5px]">
            You only have one organization right now — create another to manage
            cross-organization access.
          </p>
        ) : data.employees.length === 0 ? (
          <p className="py-6 text-center text-slate-400 text-[12.5px]">
            No employees yet.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr>
                    <th className="pb-2 font-medium text-left text-slate-400">Employee</th>
                    {data.organizations.map((w) => (
                      <th
                        key={w.id}
                        className="px-2 pb-2 font-medium text-center text-slate-400"
                      >
                        {w.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((emp) => (
                    <tr key={emp.id} className="border-t border-slate-100">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-slate-900">{emp.fullName}</div>
                        <div className="text-slate-400 text-[11px]">{emp.email}</div>
                      </td>
                      {data.organizations.map((w) => {
                        const serverValue = emp.organizationIds.includes(w.id);
                        const key = cellKey(w.id, emp.id);
                        const checked = effectiveAccess(w.id, emp.id, serverValue);
                        const isStaged = key in pending;
                        return (
                          <td key={w.id} className="px-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleCell(w.id, emp.id, serverValue)}
                              disabled={verifying}
                              title={checked ? `Uncheck to revoke access to ${w.name}` : `Check to grant access to ${w.name}`}
                              className={`inline-flex items-center justify-center w-5 h-5 rounded border transition-colors disabled:opacity-50 ${
                                checked
                                  ? "bg-blue-900 border-blue-900"
                                  : "border-slate-300 hover:border-blue-400"
                              } ${isStaged ? "ring-2 ring-offset-1 ring-amber-400" : ""}`}
                            >
                              {checked ? <Check className="w-3 h-3 text-white" /> : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-200">
              {pendingEntries.length > 0 && (
                <>
                  <span className="text-[12px] text-amber-600 font-medium mr-auto">
                    {pendingEntries.length} unsaved change{pendingEntries.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={verifying}
                    className="px-3 py-2 text-[12.5px] font-medium text-slate-600 rounded hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Discard
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying || pendingEntries.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors disabled:opacity-50"
              >
                {verifying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                Verify Changes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const OrganizationTab: React.FC = () => {
  const { user, organization, updateOrganization, deleteOrganization, createOrganization } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isSuperAdmin = user?.role === "super_admin";

  const [wsName, setWsName] = useState(organization?.name || "");
  const [wsDescription, setWsDescription] = useState(organization?.description || "");
  const [wsAddress, setWsAddress] = useState(organization?.address || "");
  const [wsContact, setWsContact] = useState(organization?.contact || "");
  const [wsEmail, setWsEmail] = useState(organization?.email || "");
  const [wsWebsite, setWsWebsite] = useState(organization?.website || "");
  const [wsSaving, setWsSaving] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [wsSuccess, setWsSuccess] = useState<string | null>(null);

  useEffect(() => {
    setWsName(organization?.name || "");
    setWsDescription(organization?.description || "");
    setWsAddress(organization?.address || "");
    setWsContact(organization?.contact || "");
    setWsEmail(organization?.email || "");
    setWsWebsite(organization?.website || "");
  }, [organization?.id]);

  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !wsName.trim()) return;
    setWsSaving(true);
    setWsError(null);
    setWsSuccess(null);
    try {
      await updateOrganization(organization.id, wsName.trim(), wsDescription, {
        address: wsAddress.trim(),
        contact: wsContact.trim(),
        email: wsEmail.trim(),
        website: wsWebsite.trim(),
      });
      setWsSuccess("Organization updated.");
    } catch (err: any) {
      setWsError(err?.response?.data?.message || "Failed to update organization.");
    } finally {
      setWsSaving(false);
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsDescription, setNewWsDescription] = useState("");
  const [newWsAddress, setNewWsAddress] = useState("");
  const [newWsContact, setNewWsContact] = useState("");
  const [newWsEmail, setNewWsEmail] = useState("");
  const [newWsWebsite, setNewWsWebsite] = useState("");
  const [addingWs, setAddingWs] = useState(false);
  const [addWsError, setAddWsError] = useState<string | null>(null);

  const closeAddModal = () => {
    setShowAddModal(false);
    setNewWsName("");
    setNewWsDescription("");
    setNewWsAddress("");
    setNewWsContact("");
    setNewWsEmail("");
    setNewWsWebsite("");
    setAddWsError(null);
  };

  const handleAddOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    setAddingWs(true);
    setAddWsError(null);
    try {
      const created = await createOrganization(newWsName.trim(), newWsDescription, {
        address: newWsAddress.trim() || undefined,
        contact: newWsContact.trim() || undefined,
        email: newWsEmail.trim() || undefined,
        website: newWsWebsite.trim() || undefined,
      });
      if (created) {
        closeAddModal();
        navigate(`/${created.id}/dashboard`);
      } else {
        setAddWsError("Failed to create organization.");
      }
    } finally {
      setAddingWs(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!organization) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const next = await deleteOrganization(organization.id, deleteConfirmText);
      setShowDeleteModal(false);
      setDeleteConfirmText("");
      if (next) navigate(`/${next.id}/dashboard`, { replace: true });
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || "Failed to delete organization.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="overflow-hidden bg-white border rounded-md border-slate-200">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200">
          <Building2 className="w-4 h-4 text-slate-400" />
          <div className="font-semibold text-[15px] text-slate-900">
            Organization details
          </div>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 ml-auto text-[12.5px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Organization
            </button>
          )}
        </div>
        <form onSubmit={handleSaveOrganization} className="p-5 space-y-4">
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
              placeholder="What's this organization for?"
            />
          </div>
          <div className="space-y-1.5">
            <Eyebrow>Address</Eyebrow>
            <textarea
              value={wsAddress}
              onChange={(e) => setWsAddress(e.target.value)}
              disabled={!isAdmin}
              rows={2}
              className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors resize-none disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="Postal address — used on generated Purchase Order PDFs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Eyebrow>Contact</Eyebrow>
              <input
                type="tel"
                value={wsContact}
                onChange={(e) => setWsContact(e.target.value)}
                disabled={!isAdmin}
                className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-1.5">
              <Eyebrow>Email</Eyebrow>
              <input
                type="email"
                value={wsEmail}
                onChange={(e) => setWsEmail(e.target.value)}
                disabled={!isAdmin}
                className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="info@example.com"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Eyebrow>Website</Eyebrow>
            <input
              type="text"
              value={wsWebsite}
              onChange={(e) => setWsWebsite(e.target.value)}
              disabled={!isAdmin}
              className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="www.example.com"
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
                      Delete this organization
                    </h4>
                    <p className="mt-1 text-[12px] text-red-600/90 leading-relaxed">
                      Permanently deletes this organization along with all of its
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
                      Delete Organization
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {isAdmin && <AccessMatrixSection />}

      {/* Add Organization Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-6">
          <div className="w-full max-w-md overflow-hidden bg-white border rounded-md shadow-lg border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>Organizations</Eyebrow>
                <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">
                  Add Organization
                </h3>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddOrganization} className="p-6 space-y-4">
              {addWsError && (
                <div className="flex items-center gap-2 p-3 text-[12px] font-medium border text-rose-700 bg-rose-50 rounded border-rose-100">
                  <AlertCircle className="flex-shrink-0 w-4 h-4" />
                  {addWsError}
                </div>
              )}
              <div className="space-y-1.5">
                <Eyebrow>Name</Eyebrow>
                <input
                  type="text"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  placeholder="My New Organization"
                />
              </div>
              <div className="space-y-1.5">
                <Eyebrow>Description (optional)</Eyebrow>
                <textarea
                  value={newWsDescription}
                  onChange={(e) => setNewWsDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors resize-none"
                  placeholder="What's this organization for?"
                />
              </div>
              <div className="space-y-1.5">
                <Eyebrow>Address (optional)</Eyebrow>
                <textarea
                  value={newWsAddress}
                  onChange={(e) => setNewWsAddress(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors resize-none"
                  placeholder="Postal address"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Eyebrow>Contact (optional)</Eyebrow>
                  <input
                    type="tel"
                    value={newWsContact}
                    onChange={(e) => setNewWsContact(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Eyebrow>Email (optional)</Eyebrow>
                  <input
                    type="email"
                    value={newWsEmail}
                    onChange={(e) => setNewWsEmail(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                    placeholder="info@example.com"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Eyebrow>Website (optional)</Eyebrow>
                <input
                  type="text"
                  value={newWsWebsite}
                  onChange={(e) => setNewWsWebsite(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  placeholder="www.example.com"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingWs}
                  className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-70 transition-colors"
                >
                  {addingWs && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Organization Modal */}
      {showDeleteModal && organization && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-6">
          <div className="w-full max-w-md overflow-hidden bg-white border rounded-md shadow-lg border-slate-200">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-red-100 bg-red-50">
              <div className="flex items-center justify-center flex-shrink-0 text-red-700 bg-red-100 rounded-full w-9 h-9">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-semibold text-[15px] text-slate-900">
                  Delete "{organization.name}"?
                </h3>
                <p className="text-[11px] text-slate-500">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[13px] text-slate-600 leading-relaxed">
                Are you sure you want to delete this organization? All projects,
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
                  Type <span className="font-semibold">{organization.name}</span>{" "}
                  to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-red-400 transition-colors"
                  placeholder={organization.name}
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
                  onClick={handleDeleteOrganization}
                  disabled={deleting || deleteConfirmText !== organization.name}
                  className="px-4 py-2 text-[13px] font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? "Deleting..." : "Delete Organization"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OrganizationTab;
