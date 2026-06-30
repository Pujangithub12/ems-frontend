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
        { value: "admin", label: "Administrator" },
        { value: "super_admin", label: "Super Administrator" },
      ];
    }
    return [{ value: "user", label: "Standard User" }];
  };

  return (
    <div className="flex fixed inset-0 z-50 justify-center items-center p-4 backdrop-blur-sm bg-slate-900/50 animate-in fade-in">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden bg-white rounded-3xl border shadow-2xl duration-200 border-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex flex-shrink-0 justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {editingUser
                ? "Update User Information"
                : "Create New User Account"}
            </h3>
            <p className="text-sm text-slate-500">
              Fill in the details below to {editingUser ? "update" : "create"}{" "}
              the employee profile.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl shadow-sm transition-all hover:bg-white text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="overflow-y-auto flex-1 p-6 space-y-6 lg:p-8"
        >
          {userFormError && (
            <div className="flex gap-3 items-center p-4 text-sm font-medium text-rose-700 bg-rose-50 rounded-2xl border border-rose-100">
              <AlertCircle className="w-5 h-5" />
              {userFormError}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="ml-1 text-sm font-semibold text-slate-700">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={userForm.fullName}
                  onChange={(e) => onFieldChange("fullName", e.target.value)}
                  required
                  className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-sm font-semibold text-slate-700">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => onFieldChange("email", e.target.value)}
                  required
                  className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-sm font-semibold text-slate-700">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={userForm.phoneNumber}
                  onChange={(e) => onFieldChange("phoneNumber", e.target.value)}
                  required
                  className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-sm font-semibold text-slate-700">
                Job Position
              </label>
              <div className="relative">
                <Briefcase className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={userForm.jobPosition}
                  onChange={(e) => onFieldChange("jobPosition", e.target.value)}
                  required
                  className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Senior Developer"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-sm font-semibold text-slate-700">
                Join Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={userForm.joinDate}
                  onChange={(e) => onFieldChange("joinDate", e.target.value)}
                  required
                  className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-sm font-semibold text-slate-700">
                User Role
              </label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={userForm.role}
                  onChange={(e) => onFieldChange("role", e.target.value)}
                  className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all appearance-none bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
            <label className="ml-1 text-sm font-semibold text-slate-700">
              Residential Address
            </label>
            <div className="relative">
              <MapPin className="absolute top-4 left-4 w-4 h-4 text-slate-400" />
              <textarea
                value={userForm.address}
                onChange={(e) => onFieldChange("address", e.target.value)}
                required
                rows={2}
                className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="123 Street Name, City, Country"
              />
            </div>
          </div>

          <div className="space-y-2 max-w-md">
            <label className="ml-1 text-sm font-semibold text-slate-700">
              Account Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={userForm.password}
                onChange={(e) => onFieldChange("password", e.target.value)}
                className="py-3 pr-4 pl-11 w-full text-sm rounded-2xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder={
                  editingUser
                    ? "Leave empty to keep current"
                    : "Set a secure password"
                }
                {...(!editingUser ? { required: true } : {})}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 bg-white border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-sm font-bold bg-white rounded-2xl border transition-all border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={userFormSubmitting}
              className="flex gap-2 items-center px-8 py-3 text-sm font-bold text-white bg-indigo-600 rounded-2xl shadow-lg transition-all hover:bg-indigo-700 shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {userFormSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {editingUser ? "Update Profile" : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;
