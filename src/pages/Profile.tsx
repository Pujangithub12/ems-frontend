import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Edit2,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  History,
} from "lucide-react";
import { useAuth } from "../context/AuthProvider";
import { getErrorMessage } from "../lib/errors";
import { useChangeMyPassword, useUpdateMyProfile } from "../hooks/useUsers";
import { useLeaveRequests } from "../hooks/useLeaveRequests";
import { useActivities } from "../hooks/useActivities";

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

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  super_admin: { label: "Super Administrator", color: "#B91C1C", bg: "#FEE2E2" },
  admin: { label: "Administrator", color: "#6D28D9", bg: "#EDE9FE" },
  finance: { label: "Finance", color: "#B45309", bg: "#FEF3C7" },
  user: { label: "Standard User", color: "#1E3A8A", bg: "#DBEAFE" },
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

const formatActivityDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  }) +
  ", " +
  new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

const Panel: React.FC<{
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, action, children }) => (
  <div className="flex flex-col h-full overflow-hidden bg-white border rounded-md border-slate-200">
    <div className="flex items-center justify-between flex-shrink-0 px-4 py-3 border-b border-slate-200">
      <div className="font-semibold text-[14px] text-slate-900">{title}</div>
      {action}
    </div>
    <div className="flex-1 p-4">{children}</div>
  </div>
);

const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const prefix = `/${workspaceId}`;

  const { data: allLeaveRequests = [], isLoading: leaveLoading } = useLeaveRequests();
  const { data: allActivity = [], isLoading: activityLoading } = useActivities();
  const loadingExtras = leaveLoading || activityLoading;
  const leaveRequests = allLeaveRequests.filter(
    (lr) => String(lr.user?.id) === String(user?.id),
  );
  const activity = allActivity.filter(
    (a) => String(a.user?.id) === String(user?.id),
  );

  const [showEditContact, setShowEditContact] = useState(false);
  const [editPhone, setEditPhone] = useState(user?.phoneNumber || "");
  const [editAddress, setEditAddress] = useState(user?.address || "");
  const [contactError, setContactError] = useState<string | null>(null);
  const updateProfileMutation = useUpdateMyProfile();

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const changePasswordMutation = useChangeMyPassword();

  if (!user) return null;

  const roleMeta = ROLE_META[user.role || "user"] || ROLE_META.user;

  const thisYear = new Date().getFullYear();
  const leaveThisYear = leaveRequests.filter(
    (lr) => new Date(lr.createdAt).getFullYear() === thisYear,
  );
  const approvedCount = leaveThisYear.filter((lr) => lr.status === "approved").length;
  const pendingCount = leaveThisYear.filter((lr) => lr.status === "pending").length;

  const recentActivity = activity.slice(0, 5);

  const openEditContact = () => {
    setEditPhone(user.phoneNumber || "");
    setEditAddress(user.address || "");
    setContactError(null);
    setShowEditContact(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    try {
      const updated = await updateProfileMutation.mutateAsync({
        phoneNumber: editPhone,
        address: editAddress,
      });
      updateUser(updated);
      setShowEditContact(false);
    } catch (err) {
      setContactError(getErrorMessage(err, "Unable to save changes."));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters.");
      return;
    }
    try {
      await changePasswordMutation.mutateAsync({ currentPassword, newPassword });
      setPwSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwError(getErrorMessage(err, "Failed to update password."));
    }
  };

  return (
    <div className="w-full px-6 py-8 lg:px-8 lg:py-6">
      {/* Hero */}
      <div className="mb-5 overflow-hidden bg-white border rounded-md border-slate-200">
        <div
          className="h-1.5"
          style={{
            background: `linear-gradient(90deg, ${roleMeta.color}, #1e3a8a)`,
          }}
        />
        <div className="flex flex-wrap items-center gap-5 p-5">
          <div
            className="flex items-center justify-center flex-shrink-0 text-[22px] font-bold text-white rounded-full"
            style={{ width: 72, height: 72, background: roleMeta.color }}
          >
            {initials(user.fullName || "?")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 mb-1">
              <h2 className="font-semibold text-[20px] tracking-tight text-slate-900">
                {user.fullName}
              </h2>
              <span
                className="rounded-full text-[10px] font-semibold uppercase tracking-[0.05em]"
                style={{
                  padding: "3px 10px",
                  background: roleMeta.bg,
                  color: roleMeta.color,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {roleMeta.label}
              </span>
            </div>
            <div className="text-[14px] text-slate-600 mb-2">
              {user.jobPosition || roleMeta.label}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {user.email}
              </span>
              <span
                className="flex items-center gap-1.5"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <Phone className="w-3.5 h-3.5" /> {user.phoneNumber || "Not set"}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> {user.address || "Not set"}
              </span>
            </div>
          </div>
          <button
            onClick={openEditContact}
            className="flex items-center gap-2 px-4 py-2 text-[12.5px] font-medium border rounded border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit Contact
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left column */}
        <div className="flex flex-col gap-5 lg:col-span-4">
          <Panel title="Details">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                ["Employee ID", `EMP-${String(user.id).padStart(4, "0")}`],
                ["Joined", formatDate(user.joinDate)],
                ["Job Position", user.jobPosition || "—"],
                ["Address", user.address || "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <Eyebrow>{k}</Eyebrow>
                  <div className="text-[12.5px] font-medium text-slate-900 mt-1">
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title={`Leave Requests · ${thisYear}`}
            action={
              <Link
                to={`${prefix}/leaverequests`}
                className="text-[12px] font-medium text-blue-900 hover:underline"
              >
                View all
              </Link>
            }
          >
            {loadingExtras ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 text-blue-900 animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="font-bold text-[26px] tracking-tight text-slate-900 leading-none">
                    {leaveThisYear.length}
                  </span>
                  <span className="text-[12.5px] text-slate-500">
                    request{leaveThisYear.length === 1 ? "" : "s"} this year
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-slate-500 mb-3">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {approvedCount} approved
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    {pendingCount} pending
                  </span>
                </div>
                <Link
                  to={`${prefix}/leaverequests`}
                  className="flex items-center justify-center w-full gap-2 px-3 py-2 text-[12.5px] font-medium border rounded border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" /> Request leave
                </Link>
              </>
            )}
          </Panel>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5 lg:col-span-8">
          <Panel
            title="Recent Activity"
            action={
              <Link
                to={`${prefix}/activities`}
                className="text-[12px] font-medium text-blue-900 hover:underline"
              >
                View all
              </Link>
            }
          >
            {loadingExtras ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 text-blue-900 animate-spin" />
              </div>
            ) : recentActivity.length === 0 ? (
              <p className="py-6 text-center text-slate-400 text-[12.5px]">
                No recent activity yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((a) => (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 mt-0.5 rounded-full bg-slate-100">
                      <History className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] text-slate-800">{a.description}</p>
                      <p
                        className="text-[11px] text-slate-400 mt-0.5"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {formatActivityDate(a.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Sign-in & Security">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-full bg-slate-100">
                  <Lock className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-slate-900">
                    Password
                  </div>
                  <div className="text-[11.5px] text-slate-500">
                    Keep your account secure with a strong password.
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setPwError(null);
                  setPwSuccess(null);
                  setShowChangePassword(true);
                }}
                className="px-3.5 py-1.5 text-[12px] font-medium border rounded border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Change
              </button>
            </div>
          </Panel>
        </div>
      </div>

      {/* Edit Contact Modal */}
      {showEditContact && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/45">
          <div className="w-full max-w-sm overflow-hidden bg-white border rounded-md shadow-lg border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>Profile</Eyebrow>
                <h3 className="font-semibold text-[15px] text-slate-900 mt-0.5">
                  Edit Contact Details
                </h3>
              </div>
              <button
                onClick={() => setShowEditContact(false)}
                className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveContact} className="p-5 space-y-4">
              {contactError && (
                <div className="flex items-center gap-2 p-3 text-[12px] font-medium border text-rose-700 bg-rose-50 rounded border-rose-100">
                  <AlertCircle className="flex-shrink-0 w-4 h-4" />
                  {contactError}
                </div>
              )}
              <div className="space-y-1.5">
                <Eyebrow>Phone Number</Eyebrow>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  placeholder="Enter phone number"
                />
              </div>
              <div className="space-y-1.5">
                <Eyebrow>Address</Eyebrow>
                <textarea
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors resize-none"
                  placeholder="Enter address"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditContact(false)}
                  className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-70 transition-colors"
                >
                  {updateProfileMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/45">
          <div className="w-full max-w-sm overflow-hidden bg-white border rounded-md shadow-lg border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>Security</Eyebrow>
                <h3 className="font-semibold text-[15px] text-slate-900 mt-0.5">
                  Change Password
                </h3>
              </div>
              <button
                onClick={() => setShowChangePassword(false)}
                className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="p-5 space-y-4">
              {pwError && (
                <div className="flex items-center gap-2 p-3 text-[12px] font-medium border text-rose-700 bg-rose-50 rounded border-rose-100">
                  <AlertCircle className="flex-shrink-0 w-4 h-4" />
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div className="flex items-center gap-2 p-3 text-[12px] font-medium border text-emerald-700 bg-emerald-50 rounded border-emerald-100">
                  <CheckCircle2 className="flex-shrink-0 w-4 h-4" />
                  {pwSuccess}
                </div>
              )}
              <div className="space-y-1.5">
                <Eyebrow>Current Password</Eyebrow>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <Eyebrow>New Password</Eyebrow>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  placeholder="At least 6 characters"
                />
              </div>
              <div className="space-y-1.5">
                <Eyebrow>Confirm New Password</Eyebrow>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-70 transition-colors"
                >
                  {changePasswordMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
