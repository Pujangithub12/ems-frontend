import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { Eye, EyeOff, Loader2, ShieldCheck, ArrowRight } from "lucide-react";

type Lang = "en" | "ne";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    help: "Help",
    eyebrow: "Operations platform",
    h1a: "The fleet is",
    h1accent: "online",
    h1b: "Pick up where you left off.",
    lede:
      "Plants, projects, approvals, and people — one workspace for your entire operation, from intake to grid.",
    fleetOutput: "Fleet output",
    plantsOnline: "plants online",
    availability: "Availability",
    updated: "Updated",
    ago: "ago",
    location: "Kathmandu · Nepal",
    operational: "All systems operational",
    chip: "EMS workspace sign-in",
    title: "Sign in",
    sub: "Enter your credentials to access your dashboard.",
    email: "Work email",
    password: "Password",
    signin: "Sign in",
    note: "New here?",
    noteLink: "Create an account",
    privacy: "Privacy",
    terms: "Terms",
    status: "Status",
  },
  ne: {
    help: "सहायता",
    eyebrow: "अपरेसन प्लेटफर्म",
    h1a: "फ्लिट",
    h1accent: "अनलाइन",
    h1b: "छ। जहाँबाट छोड्नुभएको थियो त्यहीँबाट सुरु गर्नुहोस्।",
    lede:
      "प्लान्ट, प्रोजेक्ट, स्वीकृति, र कर्मचारी — तपाईंको सम्पूर्ण अपरेसनको लागि एउटै वर्कस्पेस।",
    fleetOutput: "फ्लिट आउटपुट",
    plantsOnline: "प्लान्ट अनलाइन",
    availability: "उपलब्धता",
    updated: "अपडेट भयो",
    ago: "अघि",
    location: "काठमाडौं · नेपाल",
    operational: "सबै प्रणाली सुचारु छन्",
    chip: "EMS वर्कस्पेस साइन-इन",
    title: "साइन इन गर्नुहोस्",
    sub: "आफ्नो ड्यासबोर्ड पहुँच गर्न आफ्नो प्रमाण पत्र प्रविष्ट गर्नुहोस्।",
    email: "कार्य इमेल",
    password: "पासवर्ड",
    signin: "साइन इन गर्नुहोस्",
    note: "नयाँ हुनुहुन्छ?",
    noteLink: "खाता सिर्जना गर्नुहोस्",
    privacy: "गोपनीयता",
    terms: "सर्तहरू",
    status: "स्थिति",
  },
};

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

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [lang, setLang] = useState<Lang>("en");

  const auth = useAuth();
  const nav = useNavigate();
  const t = STRINGS[lang];
  const nptClock = useNptClock();
  const mw = useAnimatedCounter(87.4);
  const sparkRef = useRef<SVGPathElement>(null);

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

        <div className="relative z-10 flex flex-col justify-center flex-1 min-h-0 py-6">
          <div
            className="flex items-center gap-2.5 text-[10px] uppercase tracking-[0.2em] mb-4"
            style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#6E7FA3" }}
          >
            {t.eyebrow}
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
            {t.h1a} <span style={{ color: "#5B9BFF" }}>{t.h1accent}</span>.
            <br />
            {t.h1b}
          </h1>
          <p
            className="mt-3.5 max-w-[410px] leading-relaxed text-[13.5px]"
            style={{ color: "#91A0BE" }}
          >
            {t.lede}
          </p>

          <div
            className="p-4 pt-3 pb-3 mt-5 rounded-xl"
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
                {t.fleetOutput}
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
                  <linearGradient id="ems-sparkfill" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#ems-sparkfill)"
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
                <b style={{ color: "#AEBDD8", fontWeight: 500 }}>3</b>{" "}
                {t.plantsOnline}
              </span>
              <span>
                {t.availability}{" "}
                <b style={{ color: "#AEBDD8", fontWeight: 500 }}>99.2%</b>
              </span>
              <span>
                {t.updated} <b style={{ color: "#AEBDD8", fontWeight: 500 }}>2 min</b>{" "}
                {t.ago}
              </span>
            </div>
          </div>
        </div>

        <div
          className="relative z-10 flex justify-between items-center text-[9.5px] uppercase tracking-[0.12em]"
          style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#56668A" }}
        >
          <span>{t.location}</span>
          <span className="flex items-center gap-1.5">
            <i
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: "#34C77B" }}
            />
            {t.operational}
          </span>
          <span>EMS v1.0</span>
        </div>
      </aside>

      {/* RIGHT: Sign-in panel */}
      <main className="relative flex flex-col flex-1 px-6 py-4 overflow-hidden sm:px-10">
        <div className="flex items-center justify-end gap-4">
          <div
            className="inline-flex overflow-hidden bg-white rounded-lg"
            style={{ border: "1px solid #D8DDE7", boxShadow: "0 1px 2px rgba(16,20,31,0.04)" }}
            role="group"
            aria-label="Language"
          >
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                lang === "en" ? "bg-[#10141F] text-white" : "text-[#7A8499]"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang("ne")}
              className={`px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                lang === "ne" ? "bg-[#10141F] text-white" : "text-[#7A8499]"
              }`}
              style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif" }}
            >
              नेपाली
            </button>
          </div>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="text-[12.5px] font-medium text-[#7A8499] hover:text-[#10141F]"
          >
            {t.help}
          </a>
        </div>

        <div className="flex items-center justify-center flex-1 min-h-0 py-2">
          <div
            className="w-full p-6 pb-5 bg-white rounded-2xl"
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
              <span className="text-[12.5px] text-[#454F63]">{t.chip}</span>
            </div>

            <h2
              className="font-semibold text-[27px]"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              {t.title}
            </h2>
            <p className="text-[#7A8499] text-[13.5px] mt-1 mb-4 leading-relaxed">
              {t.sub}
            </p>

            <form onSubmit={submit} className="space-y-3">
              {error && (
                <div className="p-3 bg-[#FEE2E2] border border-[#FECACA] rounded-md flex items-start gap-2 text-[#B91C1C] text-[13px]">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block mb-1 text-[12.5px] font-semibold text-[#454F63]">
                  {t.email}
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                  autoComplete="email"
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

              <div>
                <label className="block mb-1 text-[12.5px] font-semibold text-[#454F63]">
                  {t.password}
                </label>
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
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

              <button
                disabled={loading}
                className="w-full h-10 flex items-center justify-center gap-2 text-[14px] font-semibold text-white bg-[#1E3A8A] rounded-[10px] hover:bg-[#19306F] active:translate-y-px disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                style={{ boxShadow: "0 1px 2px rgba(16,20,31,0.2)" }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>{t.signin}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-4 text-[12.5px] text-[#7A8499] text-center leading-relaxed">
              {t.note}{" "}
              <Link
                to="/register"
                className="font-semibold text-[#1E3A8A] hover:underline"
              >
                {t.noteLink}
              </Link>
            </p>
          </div>
        </div>

        <div
          className="flex justify-center items-center gap-1.5 text-[10px]"
          style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#A6AFC0" }}
        >
          <span>© {new Date().getFullYear()} EMS</span>
          <span style={{ color: "#D4D9E2" }}>·</span>
          <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-[#454F63]">
            {t.privacy}
          </a>
          <span style={{ color: "#D4D9E2" }}>·</span>
          <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-[#454F63]">
            {t.terms}
          </a>
          <span style={{ color: "#D4D9E2" }}>·</span>
          <a href="#" onClick={(e) => e.preventDefault()} className="hover:text-[#454F63]">
            {t.status}
          </a>
        </div>
      </main>
    </div>
  );
};

export default Login;
