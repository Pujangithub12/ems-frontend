import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { useInvite } from "../hooks/useInvite";
import { getErrorMessage } from "../lib/errors";
import { getPasswordStrengthError } from "../lib/passwordPolicy";
import {
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  ArrowRight,
  UserCheck,
  Briefcase,
  Mail,
} from "lucide-react";

const useNptClock = () => {
  const [clock, setClock] = useState("--:-- NPT");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const npt = new Date(
        now.getTime() + (5.75 * 60 + now.getTimezoneOffset()) * 60000,
      );
      const h = npt.getHours() % 12 || 12;
      const m = String(npt.getMinutes()).padStart(2, "0");
      const ap = npt.getHours() < 12 ? "AM" : "PM";
      setClock(`${h}:${m} ${ap} NPT`);
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);
  return clock;
};

const useAnimatedCounter = (target: number) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      setValue(target);
      return;
    }
    const t0 = performance.now();
    const dur = 1500;
    let frame: number;
    const step = (t: number) => {
      const p = Math.min((t - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
};

const roleLabel = (role: string) =>
  role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const AcceptInvite: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const auth = useAuth();
  const nav = useNavigate();
  const nptClock = useNptClock();
  const mw = useAnimatedCounter(87.4);
  const sparkRef = useRef<SVGPathElement>(null);

  const {
    data: lookup,
    isLoading: inviteLoading,
    isError: inviteIsError,
    error: inviteQueryError,
  } = useInvite(token);
  const invite = lookup?.invite ?? null;
  const workspaceName = lookup?.workspaceName || "the workspace";

  const status: "loading" | "ready" | "invalid" = !token
    ? "invalid"
    : inviteLoading
      ? "loading"
      : inviteIsError || !invite
        ? "invalid"
        : "ready";
  const inviteError = !token
    ? "This invite link is missing its token."
    : getErrorMessage(inviteQueryError, "This invite is no longer valid.");

  const submitAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const passwordError = getPasswordStrengthError(password);
    if (passwordError) {
      setSubmitError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const workspace = await auth.acceptInvite(token, password);
      nav(`/${workspace.id}/dashboard`);
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.message || err.message || "Could not accept invite",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="h-screen flex text-[#10141F] overflow-hidden"
      style={{ background: "#F8F9FB" }}
    >
      <style>{`
        @keyframes ems-login-draw { to { stroke-dashoffset: 0; } }
        @keyframes ems-login-fadein { to { opacity: 1; } }
        @keyframes ems-login-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(52,199,123,0.4); } 55% { box-shadow: 0 0 0 6px transparent; } }
        .ems-login-line { stroke-dasharray: 640; stroke-dashoffset: 640; animation: ems-login-draw 2.2s cubic-bezier(0.4,0,0.3,1) 0.4s forwards; }
        .ems-login-fill { opacity: 0; animation: ems-login-fadein 1s ease-out 1.7s forwards; }
        .ems-login-dot { animation: ems-login-pulse 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ems-login-line { animation: none; stroke-dashoffset: 0; }
          .ems-login-fill { animation: none; opacity: 1; }
          .ems-login-dot { animation: none; }
        }
      `}</style>

      {/* LEFT: Operations board (hidden on mobile) */}
      <aside
        className="hidden lg:flex w-[43%] min-w-[440px] relative overflow-hidden text-[#E8EDF7] flex-col justify-between p-10"
        style={{
          background:
            "linear-gradient(172deg, #0B111F 0%, #0F1829 58%, #131F35 100%)",
        }}
      >
        <div className="relative z-10 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white font-bold text-lg"
            style={{
              background: "linear-gradient(148deg, #3563D9, #22418E)",
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.13), 0 8px 22px rgba(0,0,0,0.32)",
            }}
          >
            E
          </div>
          <div>
            <div
              className="font-bold text-[19px] leading-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              EMS
            </div>
            <div
              className="text-[9.5px] uppercase tracking-[0.16em] mt-0.5"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                color: "#7E8DAD",
              }}
            >
              Enterprise Management System
            </div>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center py-6 min-h-0">
          <div
            className="flex items-center gap-2.5 text-[10px] uppercase tracking-[0.2em] mb-4"
            style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#6E7FA3" }}
          >
            Team invite
            <span className="h-px w-11" style={{ background: "#2B3A57" }} />
          </div>
          <h1
            className="font-semibold leading-[1.18] max-w-[430px]"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(27px, 2.5vw, 33px)",
              letterSpacing: "-0.015em",
              color: "#F4F7FD",
            }}
          >
            You've been invited to <span style={{ color: "#5B9BFF" }}>{workspaceName}</span>.
          </h1>
          <p
            className="mt-3.5 max-w-[410px] leading-relaxed text-[13.5px]"
            style={{ color: "#91A0BE" }}
          >
            Set a password to join your team's workspace — tasks, projects,
            and updates, all in one place.
          </p>

          <div
            className="mt-5 rounded-xl p-4 pt-3 pb-3"
            style={{
              background: "rgba(5,10,20,0.5)",
              border: "1px solid rgba(255,255,255,0.08)",
              maxWidth: 470,
              boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div
                className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em]"
                style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#7E8DAD" }}
              >
                <span
                  className="ems-login-dot w-1.5 h-1.5 rounded-full inline-block"
                  style={{ background: "#34C77B" }}
                />
                Fleet output
              </div>
              <div
                className="text-[10.5px] tabular-nums"
                style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#7E8DAD" }}
              >
                {nptClock}
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <div
                className="font-bold leading-none tabular-nums"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 46,
                  letterSpacing: "-0.035em",
                  color: "#FBFDFF",
                }}
              >
                {mw.toFixed(1)}
              </div>
              <div
                className="text-[12px]"
                style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#7E8DAD" }}
              >
                MW
              </div>
            </div>

            <div className="relative mt-2">
              <svg
                className="block w-full h-[36px]"
                viewBox="0 0 440 52"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="ems-invite-sparkfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5B9BFF" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#5B9BFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <line
                  x1="0" y1="13" x2="440" y2="13"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
                <line
                  x1="0" y1="26" x2="440" y2="26"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
                <line
                  x1="0" y1="39" x2="440" y2="39"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
                <path
                  className="ems-login-fill"
                  fill="url(#ems-invite-sparkfill)"
                  d="M0,37 L31,33 L63,35 L94,27 L126,29 L157,21 L189,25 L220,17 L251,21 L283,13 L314,17 L346,9 L377,13 L409,7 L440,11 L440,52 L0,52 Z"
                />
                <path
                  ref={sparkRef}
                  className="ems-login-line"
                  fill="none"
                  stroke="#5B9BFF"
                  strokeWidth={1.8}
                  d="M0,37 L31,33 L63,35 L94,27 L126,29 L157,21 L189,25 L220,17 L251,21 L283,13 L314,17 L346,9 L377,13 L409,7 L440,11"
                />
              </svg>
            </div>

            <div
              className="flex gap-5 mt-2 pt-2 text-[10px] uppercase tracking-[0.08em]"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                color: "#6E7FA3",
                borderTop: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span>
                <b style={{ color: "#AEBDD8", fontWeight: 500 }}>3</b> plants online
              </span>
              <span>
                Availability <b style={{ color: "#AEBDD8", fontWeight: 500 }}>99.2%</b>
              </span>
              <span>
                Updated <b style={{ color: "#AEBDD8", fontWeight: 500 }}>2 min</b> ago
              </span>
            </div>
          </div>
        </div>

        <div
          className="relative z-10 flex justify-between items-center text-[9.5px] uppercase tracking-[0.12em]"
          style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#56668A" }}
        >
          <span>Kathmandu · Nepal</span>
          <span className="flex items-center gap-1.5">
            <i
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: "#34C77B" }}
            />
            All systems operational
          </span>
          <span>EMS v1.0</span>
        </div>
      </aside>

      {/* RIGHT: Accept invite panel */}
      <main className="flex-1 flex flex-col relative px-6 py-4 sm:px-10 overflow-hidden">
        <div className="flex justify-end items-center gap-4">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="text-[12.5px] font-medium text-[#7A8499] hover:text-[#10141F]"
          >
            Help
          </a>
        </div>

        <div className="flex-1 flex items-center justify-center py-2 min-h-0">
          <div
            className="w-full bg-white rounded-2xl p-6 pb-5"
            style={{
              maxWidth: 416,
              border: "1px solid #DDE2EB",
              boxShadow:
                "0 1px 2px rgba(16,20,31,0.05), 0 16px 48px rgba(16,20,31,0.09)",
            }}
          >
            <div
              className="inline-flex items-center gap-2.5 rounded-[10px] px-3.5 py-2 mb-4"
              style={{
                border: "1px solid #E4E7ED",
                background: "#F6F8FB",
                boxShadow: "0 1px 2px rgba(16,20,31,0.04)",
              }}
            >
              <div
                className="w-[26px] h-[26px] rounded-[7px] bg-[#1E3A8A] text-white flex items-center justify-center text-[10px] font-bold"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                E
              </div>
              <span className="text-[12.5px] text-[#454F63]">EMS workspace invite</span>
            </div>

            {status === "loading" && (
              <div className="flex flex-col items-center justify-center gap-3 py-10">
                <Loader2 className="w-6 h-6 text-[#1E3A8A] animate-spin" />
                <p className="text-[13px] text-[#7A8499]">Checking your invite…</p>
              </div>
            )}

            {status === "invalid" && (
              <>
                <h2
                  className="font-semibold text-[24px]"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Invite not available
                </h2>
                <div className="p-3 mt-3 bg-[#FEE2E2] border border-[#FECACA] rounded-md flex items-start gap-2 text-[#B91C1C] text-[13px]">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{inviteError}</span>
                </div>
                <p className="mt-4 text-[12.5px] text-[#7A8499] text-center leading-relaxed">
                  <Link to="/login" className="font-semibold text-[#1E3A8A] hover:underline">
                    Back to sign in
                  </Link>
                </p>
              </>
            )}

            {status === "ready" && invite && (
              <>
                <h2
                  className="font-semibold text-[27px]"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Join {workspaceName}
                </h2>
                <p className="text-[#7A8499] text-[13.5px] mt-1 mb-4 leading-relaxed">
                  Set a password to activate your account.
                </p>

                <div
                  className="rounded-[10px] p-3 mb-4 space-y-1.5"
                  style={{ background: "#F6F8FB", border: "1px solid #E4E7ED" }}
                >
                  <div className="flex items-center gap-2 text-[13px] text-[#10141F] font-medium">
                    <UserCheck className="w-3.5 h-3.5 text-[#7A8499]" />
                    {invite.fullName}
                    <span className="ml-auto text-[10.5px] uppercase tracking-[0.06em] text-[#1E3A8A] font-semibold">
                      {roleLabel(invite.role)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[12.5px] text-[#7A8499]">
                    <Mail className="w-3.5 h-3.5" />
                    {invite.email}
                  </div>
                  <div className="flex items-center gap-2 text-[12.5px] text-[#7A8499]">
                    <Briefcase className="w-3.5 h-3.5" />
                    {invite.jobPosition}
                  </div>
                </div>

                <form onSubmit={submitAccept} className="space-y-3">
                  {submitError && (
                    <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-md flex flex-col gap-2 text-[#B91C1C] text-[13px]">
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{submitError}</span>
                      </div>
                      {submitError.toLowerCase().includes("already exists") && (
                        <Link
                          to="/login"
                          className="font-semibold text-[#1E3A8A] hover:underline ml-6"
                        >
                          Log in instead
                        </Link>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block mb-1 text-[12.5px] font-semibold text-[#454F63]">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className="w-full h-10 pl-3.5 pr-11 bg-white rounded-[10px] text-[14px] text-[#10141F] outline-none transition-all"
                        style={{ border: "1px solid #C6CCD8" }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#1E3A8A";
                          e.currentTarget.style.boxShadow =
                            "0 0 0 3px rgba(30,58,138,0.12)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "#C6CCD8";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-[7px] flex items-center justify-center text-[#7A8499] hover:bg-[#F1F3F8] hover:text-[#454F63] transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 text-[12.5px] font-semibold text-[#454F63]">
                      Confirm password
                    </label>
                    <input
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className="w-full h-10 px-3.5 bg-white rounded-[10px] text-[14px] text-[#10141F] outline-none transition-all"
                      style={{ border: "1px solid #C6CCD8" }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "#1E3A8A";
                        e.currentTarget.style.boxShadow =
                          "0 0 0 3px rgba(30,58,138,0.12)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#C6CCD8";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  </div>

                  <button
                    disabled={submitting}
                    className="w-full h-10 flex items-center justify-center gap-2 text-[14px] font-semibold text-white bg-[#1E3A8A] rounded-[10px] hover:bg-[#19306F] active:translate-y-px disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                    style={{ boxShadow: "0 1px 2px rgba(16,20,31,0.2)" }}
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Accept invite & join</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <div
          className="flex justify-center items-center gap-1.5 text-[10px]"
          style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#A6AFC0" }}
        >
          <span>© {new Date().getFullYear()} EMS</span>
          <span style={{ color: "#D4D9E2" }}>·</span>
          <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-[#454F63]">
            Privacy
          </a>
          <span style={{ color: "#D4D9E2" }}>·</span>
          <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-[#454F63]">
            Terms
          </a>
          <span style={{ color: "#D4D9E2" }}>·</span>
          <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-[#454F63]">
            Status
          </a>
        </div>
      </main>
    </div>
  );
};

export default AcceptInvite;
