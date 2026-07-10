import React from "react";
import {
  X,
  AlertCircle,
  User as UserIcon,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  Shield,
  MapPin,
  Lock,
  Loader2,
  Send,
} from "lucide-react";
import { User } from "../types";

type UserFormModalProps = {
  isOpen: boolean;
  editingUser: User | null;
  userForm: any;
  userFormError: string | null;
  userFormSubmitting: boolean;
  currentUserRole?: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onFieldChange: (field: any, value: string) => void;
};

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

const UserFormModal: React.FC<UserFormModalProps> = ({
  isOpen,
  editingUser,
  userForm,
  userFormError,
  userFormSubmitting,
  currentUserRole,
  onClose,
  onSubmit,
  onFieldChange,
}) => {
  if (!isOpen) return null;

  const getRoleOptions = () => {
    if (currentUserRole === "super_admin") {
      return [
        { value: "user", label: "Standard User" },
        { value: "finance", label: "Finance" },
        { value: "admin", label: "Administrator" },
        { value: "super_admin", label: "Super Administrator" },
      ];
    }
    if (currentUserRole === "admin") {
      return [
        { value: "user", label: "Standard User" },
        { value: "finance", label: "Finance" },
        { value: "admin", label: "Administrator" },
      ];
    }
    return [{ value: "user", label: "Standard User" }];
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 backdrop-blur-sm bg-slate-900/45">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden bg-white rounded-md border border-slate-200 shadow-lg">
        <div className="flex flex-shrink-0 justify-between items-center p-6 border-b border-slate-200">
          <div>
            <Eyebrow>
              {editingUser ? "Edit User" : "Invite Member"}
            </Eyebrow>
            <h3 className="font-semibold text-[17px] text-slate-900 mt-1">
              {editingUser
                ? "Update User Information"
                : "Send a Workspace Invite"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="overflow-y-auto flex-1 p-6 space-y-6"
        >
          {userFormError && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-md text-red-700 text-[13px]">
              <AlertCircle className="flex-shrink-0 w-4 h-4" />
              {userFormError}
            </div>
          )}

          {!editingUser && (
            <p className="text-[13px] text-slate-500 -mt-2">
              They'll get an email with a link to set their own password and
              join the workspace.
            </p>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Eyebrow>Full Name</Eyebrow>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  name="new-user-full-name"
                  autoComplete="off"
                  value={userForm.fullName}
                  onChange={(e) => onFieldChange("fullName", e.target.value)}
                  required
                  className="py-2 pr-3 pl-9 w-full text-[13px] rounded bg-white border border-slate-200 focus:outline-none focus:border-blue-900 transition-colors"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Eyebrow>Email Address</Eyebrow>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  name="new-user-email"
                  autoComplete="off"
                  value={userForm.email}
                  onChange={(e) => onFieldChange("email", e.target.value)}
                  required
                  className="py-2 pr-3 pl-9 w-full text-[13px] rounded bg-white border border-slate-200 focus:outline-none focus:border-blue-900 transition-colors"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Eyebrow>Phone Number</Eyebrow>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  name="new-user-phone"
                  autoComplete="off"
                  value={userForm.phoneNumber}
                  onChange={(e) => onFieldChange("phoneNumber", e.target.value)}
                  required
                  className="py-2 pr-3 pl-9 w-full text-[13px] rounded bg-white border border-slate-200 focus:outline-none focus:border-blue-900 transition-colors"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Eyebrow>Job Position</Eyebrow>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  name="new-user-job-position"
                  autoComplete="off"
                  value={userForm.jobPosition}
                  onChange={(e) => onFieldChange("jobPosition", e.target.value)}
                  required
                  className="py-2 pr-3 pl-9 w-full text-[13px] rounded bg-white border border-slate-200 focus:outline-none focus:border-blue-900 transition-colors"
                  placeholder="Senior Developer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Eyebrow>Join Date</Eyebrow>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={userForm.joinDate}
                  onChange={(e) => onFieldChange("joinDate", e.target.value)}
                  required
                  className="py-2 pr-3 pl-9 w-full text-[13px] rounded bg-white border border-slate-200 focus:outline-none focus:border-blue-900 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Eyebrow>User Role</Eyebrow>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-slate-400" />
                <select
                  value={userForm.role}
                  onChange={(e) => onFieldChange("role", e.target.value)}
                  className="py-2 pr-3 pl-9 w-full text-[13px] rounded bg-white border border-slate-200 focus:outline-none focus:border-blue-900 transition-colors appearance-none"
                >
                  {getRoleOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Eyebrow>Residential Address</Eyebrow>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
              <textarea
                name="new-user-address"
                autoComplete="off"
                value={userForm.address}
                onChange={(e) => onFieldChange("address", e.target.value)}
                required
                rows={2}
                className="py-2 pr-3 pl-9 w-full text-[13px] rounded bg-white border border-slate-200 focus:outline-none focus:border-blue-900 transition-colors"
                placeholder="123 Street Name, City, Country"
              />
            </div>
          </div>

          {editingUser && (
            <div className="space-y-2 max-w-md">
              <Eyebrow>Account Password</Eyebrow>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  name="new-user-password"
                  autoComplete="new-password"
                  value={userForm.password}
                  onChange={(e) => onFieldChange("password", e.target.value)}
                  className="py-2 pr-3 pl-9 w-full text-[13px] rounded bg-white border border-slate-200 focus:outline-none focus:border-blue-900 transition-colors"
                  placeholder="Leave empty to keep current"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium bg-white rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={userFormSubmitting}
              className="flex gap-2 items-center px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {userFormSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : editingUser ? null : (
                <Send className="w-3.5 h-3.5" />
              )}
              {editingUser ? "Update Profile" : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;
