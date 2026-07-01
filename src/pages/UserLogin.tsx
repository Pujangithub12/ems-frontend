import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import {
  Lock,
  Mail,
  Loader2,
  User,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

const UserLogin: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await auth.login({ email, password, role: "user" });
      nav("/");
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F7F9] px-4">
      <div className="max-w-md w-full">
        {/* Branding Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-900 rounded-full flex items-center justify-center text-white mx-auto mb-4">
            <User className="w-8 h-8" />
          </div>
          <div
            className="text-[10px] tracking-[0.1em] uppercase text-slate-400 mb-2"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Employee Access
          </div>
          <h1 className="font-semibold text-[24px] tracking-tight text-slate-900">
            User Portal
          </h1>
          <p className="text-slate-500 text-[14px] mt-1">
            Welcome back. Please enter your credentials.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white border border-slate-200 rounded-md p-8">
          <form onSubmit={submit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded flex items-center gap-2 text-red-700 text-[13px]">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <div
                className="text-[10px] tracking-[0.1em] uppercase text-slate-400 mb-1.5"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Email Address
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                  placeholder="employee@ems.com"
                  className="w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                />
              </div>
            </div>

            <div>
              <div
                className="text-[10px] tracking-[0.1em] uppercase text-slate-400 mb-1.5"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Password
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                />
              </div>
            </div>

            <button
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-70 transition-colors"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>Sign in to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <p className="text-slate-500 text-[13px]">
              Are you an admin?{" "}
              <Link
                to="/login/admin"
                className="text-blue-900 font-medium hover:text-blue-800 transition-colors"
              >
                Sign in as Admin
              </Link>
            </p>
          </div>
        </div>

        <p
          className="mt-8 text-center text-slate-400"
          style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
        >
          &copy; 2026 EMS Management System. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default UserLogin;
