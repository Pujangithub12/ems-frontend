import React, { useState } from "react";
import { Lock, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Eyebrow } from "./SettingsShared";
import { getErrorMessage } from "../lib/errors";
import { useChangeMyPassword } from "../hooks/useUsers";

const SecurityTab: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const changePasswordMutation = useChangeMyPassword();

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
    <div className="max-w-2xl overflow-hidden bg-white border rounded-md border-slate-200">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200">
        <Lock className="w-4 h-4 text-slate-400" />
        <div className="font-semibold text-[15px] text-slate-900">
          Change your password
        </div>
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
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={changePasswordMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors disabled:opacity-70"
          >
            {changePasswordMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Update Password
          </button>
        </div>
      </form>
    </div>
  );
};

export default SecurityTab;
