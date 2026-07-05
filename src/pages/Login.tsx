import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import {
  Lock,
  Mail,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const auth = useAuth();
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await auth.login({ email, password });
      nav("/");
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F6F7F9] font-sans text-[#0F172A]">
      {/* LEFT: Brand Panel (Hidden on mobile) */}
      <div
        className="hidden lg:flex w-[46%] relative overflow-hidden text-white flex-col justify-between p-14"
        style={{
          background: `
            radial-gradient(ellipse 800px 400px at 15% 25%, rgba(59, 130, 246, 0.18) 0%, transparent 55%),
            radial-gradient(ellipse 600px 400px at 85% 80%, rgba(139, 92, 246, 0.12) 0%, transparent 55%),
            linear-gradient(160deg, #1E3A8A 0%, #172554 60%, #0F172A 100%)
          `,
        }}
      >
        {/* Topographic Pattern Overlay */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600' fill='none'%3E%3Cpath d='M-50 250 Q 100 200, 250 240 T 550 220 T 850 250' stroke='white' stroke-width='1' fill='none'/%3E%3Cpath d='M-50 300 Q 120 250, 280 290 T 580 270 T 850 300' stroke='white' stroke-width='1' fill='none'/%3E%3Cpath d='M-50 350 Q 130 300, 290 340 T 590 320 T 850 350' stroke='white' stroke-width='1' fill='none'/%3E%3C/svg%3E")`,
            backgroundSize: "800px 600px",
            backgroundPosition: "center",
          }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center font-bold text-xl tracking-wide">
              E
            </div>
            <div className="font-bold tracking-tight text-2xl">EMS</div>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <div className="font-mono mb-4 text-xs uppercase tracking-[0.15em] text-white/55">
            Enterprise Management System
          </div>
          <h1 className="font-semibold leading-tight mb-5 text-[42px] tracking-[-0.025em]">
            Connect with your team.
          </h1>
          <p className="leading-relaxed text-[15px] text-white/70">
            Access your projects, track progress, and collaborate seamlessly.
            Your workspace is ready for you.
          </p>
        </div>

        <div className="relative z-10 flex justify-between items-center text-[11px] text-white/50 font-mono">
          <span>v2.0.1</span>
          <div className="flex gap-5">
            <a href="#" className="hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Support
            </a>
          </div>
        </div>
      </div>

      {/* RIGHT: Form Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 relative min-h-screen">
        {/* Mobile Brand Header */}
        <div className="lg:hidden mb-10 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-sm">
            E
          </div>
          <div className="font-bold tracking-tight text-xl">EMS</div>
        </div>

        <div className="w-full fade-in" style={{ maxWidth: 380 }}>
          <h2 className="font-semibold text-[24px] tracking-[-0.02em] leading-[1.2]">
            Welcome back
          </h2>
          <p className="text-[#94A3B8] mb-6 mt-1 text-[13px]">
            Enter your credentials to access your dashboard.
          </p>

          <form onSubmit={submit} className="space-y-5">
            {error && (
              <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-md flex items-start gap-2 text-[#B91C1C] text-[13px]">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block mb-1.5">
                <span className="font-mono text-[#94A3B8] text-[10px] uppercase tracking-[0.08em]">
                  Email Address
                </span>
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] group-focus-within:text-[#1E3A8A] transition-colors" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                  placeholder="you@ems.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-3 py-2.5 bg-white border border-[#E2E8F0] rounded-md text-[14px] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#1E3A8A] focus:ring-[3px] focus:ring-[#1E3A8A]/10 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label>
                  <span className="font-mono text-[#94A3B8] text-[10px] uppercase tracking-[0.08em]">
                    Password
                  </span>
                </label>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] group-focus-within:text-[#1E3A8A] transition-colors" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#E2E8F0] rounded-md text-[14px] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#1E3A8A] focus:ring-[3px] focus:ring-[#1E3A8A]/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] hover:bg-[#EEF1F5] rounded p-1 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" className="accent-[#1E3A8A] w-3.5 h-3.5" />
              <span className="text-[#475569] text-[13px]">
                Remember me on this device
              </span>
            </label>

            <button
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[14px] font-medium text-white bg-[#1E3A8A] rounded-md hover:bg-[#1E40AF] active:bg-[#172554] disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Bottom Footer */}
        <div className="absolute bottom-5 text-center text-[#94A3B8] flex items-center gap-2 text-[11px]">
          <Lock className="w-3 h-3 opacity-60" />
          <span>Protected by end-to-end encryption</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
