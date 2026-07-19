import React from "react";
import { Link } from "react-router-dom";
import {
  Users,
  LogIn,
  UserPlus,
  ArrowRight,
  ShieldCheck,
  Bell,
  Search,
  ChevronUp,
  Zap,
  Lock,
  Globe,
  LifeBuoy,
  CheckSquare,
  Briefcase,
  Calendar,
  ClipboardCheck,
  Megaphone,
} from "lucide-react";

const MiniLineChart: React.FC = () => (
  <svg viewBox="0 0 200 60" className="w-full h-12" preserveAspectRatio="none">
    <defs>
      <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path
      d="M0,45 L25,38 L50,42 L75,25 L100,30 L125,15 L150,20 L175,8 L200,12 L200,60 L0,60 Z"
      fill="url(#lineFill)"
    />
    <path
      d="M0,45 L25,38 L50,42 L75,25 L100,30 L125,15 L150,20 L175,8 L200,12"
      fill="none"
      stroke="#60a5fa"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MiniDonut: React.FC<{ value: number; max: number; color: string; label: string }> = ({
  value,
  max,
  color,
  label,
}) => {
  const pct = Math.min(1, value / max);
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex items-center justify-center w-16 h-16">
      <svg viewBox="0 0 60 60" className="w-16 h-16 -rotate-90">
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </svg>
      <span className="absolute text-[13px] font-bold text-white">{label}</span>
    </div>
  );
};

const MiniCalendar: React.FC = () => {
  const days = Array.from({ length: 28 }, (_, i) => i + 1);
  const highlighted = [9, 12, 22];
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d) => (
        <div
          key={d}
          className={`flex items-center justify-center rounded text-[9px] h-4 w-4 ${
            highlighted.includes(d) ? "bg-blue-500 text-white font-semibold" : "text-slate-400"
          }`}
        >
          {d}
        </div>
      ))}
    </div>
  );
};

const sidebarItems = [
  "Overview",
  "Team",
  "Performance",
  "Attendance",
  "Leave",
  "Projects",
  "Payroll",
  "Reports",
  "Settings",
];

const DashboardMockup: React.FC = () => (
  <div className="relative">
    <div className="absolute rounded-full -inset-10 bg-blue-400/20 blur-3xl" />
    <div className="relative flex overflow-hidden border shadow-2xl rounded-3xl bg-gradient-to-br from-[#0a1230] to-[#16296a] border-white/5">
      {/* sidebar */}
      <div className="flex-col flex-shrink-0 hidden gap-3 p-4 border-r sm:flex w-36 border-white/10 bg-black/10">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex items-center justify-center w-5 h-5 bg-blue-500 rounded">
            <Users className="w-3 h-3 text-white" />
          </div>
          <span className="text-[11px] font-semibold text-white">Empower</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {sidebarItems.map((item, i) => (
            <div
              key={item}
              className={`px-2 py-1 rounded text-[9.5px] ${
                i === 0 ? "bg-blue-900 text-white font-medium" : "text-slate-400"
              }`}
            >
              {item}
            </div>
          ))}
        </div>
        <div className="p-2 mt-auto text-center rounded-lg bg-white/5">
          <p className="text-[8px] text-slate-300">Upgrade Plan</p>
          <p className="text-[9px] font-semibold text-blue-300">Go Premium</p>
        </div>
      </div>

      {/* main */}
      <div className="flex-1 min-w-0 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-white">Welcome back, Alex 👋</p>
            <p className="text-[8px] text-slate-400">Here's what's happening with your team today.</p>
          </div>
          <div className="flex items-center gap-2">
            <Search className="w-3 h-3 text-slate-400" />
            <Bell className="w-3 h-3 text-slate-400" />
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Total Employees", value: "124" },
            { label: "Active Tasks", value: "98" },
            { label: "On Leave", value: "12" },
            { label: "New Hires", value: "8" },
          ].map((s) => (
            <div key={s.label} className="p-2 border rounded-lg bg-white/5 border-white/10">
              <p className="text-[13px] font-bold text-white">{s.value}</p>
              <p className="text-[6.5px] text-slate-400 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-1 p-2 border rounded-lg bg-white/5 border-white/10">
            <p className="text-[8px] font-medium text-slate-300 mb-1">Team Overview</p>
            <MiniLineChart />
          </div>
          <div className="col-span-1 p-2 border rounded-lg bg-white/5 border-white/10">
            <p className="text-[8px] font-medium text-slate-300 mb-1">Upcoming Events</p>
            <MiniCalendar />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 border rounded-lg bg-white/5 border-white/10">
            <p className="text-[8px] font-medium text-slate-300 mb-1.5">Team Members</p>
            <div className="space-y-1">
              {["Olivia Rhys", "Phoenix Baker", "Lana Steiner"].map((n) => (
                <div key={n} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-br from-slate-400 to-slate-600" />
                  <span className="text-[7px] text-slate-300">{n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 p-2 border rounded-lg bg-white/5 border-white/10">
            <p className="text-[8px] font-medium text-slate-300">Employee Performance</p>
            <MiniDonut value={4.6} max={5} color="#60a5fa" label="4.6" />
          </div>
          <div className="flex flex-col items-center justify-center gap-1 p-2 border rounded-lg bg-white/5 border-white/10">
            <p className="text-[8px] font-medium text-slate-300">Leave Overview</p>
            <MiniDonut value={18} max={24} color="#a78bfa" label="18" />
          </div>
        </div>
      </div>
    </div>

    {/* floating badge */}
    <div className="absolute flex items-center gap-2 px-3 py-2 bg-white border shadow-lg -bottom-5 left-6 rounded-xl border-slate-100">
      <div className="flex items-center justify-center bg-blue-900 rounded-lg w-7 h-7">
        <ShieldCheck className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-[10px] text-slate-500 leading-tight">Secure &amp; Compliant</p>
        <p className="text-[11px] font-bold text-slate-900 leading-tight">SOC 2 Ready</p>
      </div>
    </div>
  </div>
);

const highlights = [
  {
    icon: Zap,
    title: "Quick Setup",
    description: "Get your workspace running in minutes, no lengthy onboarding required.",
  },
  {
    icon: Lock,
    title: "Secure by Design",
    description: "Role-based access keeps sensitive HR data protected at every level.",
  },
  {
    icon: Globe,
    title: "Always Accessible",
    description: "Manage your team from anywhere, on any device, anytime.",
  },
  {
    icon: LifeBuoy,
    title: "Dedicated Support",
    description: "Help is always on hand whenever your team runs into a snag.",
  },
];

const features = [
  {
    icon: CheckSquare,
    title: "Tasks",
    description: "Assign tasks with subtasks, track progress and exchange updates and feedback.",
  },
  {
    icon: Briefcase,
    title: "Projects",
    description: "Organize work into projects with schedules, documents and a shared team view.",
  },
  {
    icon: Calendar,
    title: "Calendar",
    description: "Keep every deadline, meeting and event visible in one shared team calendar.",
  },
  {
    icon: ClipboardCheck,
    title: "Approvals",
    description: "Submit and approve leave, site-visit and expense requests in one place.",
  },
  {
    icon: Megaphone,
    title: "Announcements",
    description: "Post company-wide updates that reach everyone in your workspace.",
  },
  {
    icon: Users,
    title: "People & Hierarchy",
    description: "Manage your team directory and visualize your organization's structure.",
  },
];

const Home: React.FC = () => {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-white via-blue-50/30 to-blue-100/40">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 mx-auto max-w-7xl">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center bg-blue-900 rounded-lg w-9 h-9">
            <Users className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">WorkForce</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <LogIn className="w-4 h-4" /> Login
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            <UserPlus className="w-4 h-4" /> Sign Up
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="grid items-center grid-cols-1 gap-16 px-8 pb-24 mx-auto max-w-7xl lg:grid-cols-2 pt-14">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-900" /> Modern HR platform
          </span>
          <h1 className="text-5xl font-extrabold leading-[1.1] text-slate-900 mb-6">
            Manage your <span className="text-blue-700">workforce</span> with confidence
          </h1>
          <p className="mb-8 text-lg leading-relaxed text-slate-500">
            An all-in-one workspace to manage tasks, projects, approvals and your team's calendar
            all organized around your company's people and hierarchy.
          </p>
          <div className="flex items-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-900 rounded-lg hover:bg-blue-800"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-white border rounded-lg border-slate-300 text-slate-800 hover:bg-slate-50"
            >
              Login to Dashboard
            </Link>
          </div>
        </div>
        <DashboardMockup />
      </section>

      {/* Highlights */}
      <section className="px-8 pb-24 mx-auto max-w-7xl">
        <div className="grid grid-cols-1 bg-blue-900 border border-blue-900 divide-y divide-white/15 rounded-2xl sm:grid-cols-2 sm:divide-y-0 sm:divide-x md:grid-cols-4">
          {highlights.map((h) => (
            <div key={h.title} className="flex items-start gap-3 p-6">
              <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-full bg-white/15">
                <h.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{h.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-blue-100">{h.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-8 pb-24 mx-auto max-w-7xl">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <h2 className="text-3xl font-extrabold text-slate-900">Everything you need</h2>
          <p className="mt-3 text-slate-500">
            Powerful tools to keep your team organized and productive.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white border p-7 rounded-2xl border-slate-200"
            >
              <div className="flex items-center justify-center mb-4 bg-blue-900 rounded-xl w-11 h-11">
                <f.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="mb-1.5 text-base font-bold text-slate-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-8 pb-20 mx-auto max-w-7xl">
        <div className="px-8 py-16 text-center rounded-3xl bg-gradient-to-r from-blue-100 to-blue-200/60">
          <h2 className="text-3xl font-extrabold text-slate-900">Ready to transform your HR?</h2>
          <p className="max-w-xl mx-auto mt-3 text-slate-600">
            Join hundreds of companies streamlining their workforce with WorkForce.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-900 rounded-lg hover:bg-blue-800"
            >
              Create an account <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-white border rounded-lg border-slate-300 text-slate-800 hover:bg-slate-50"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="border-t border-slate-200">
        <div className="flex flex-col items-center justify-between gap-4 px-8 py-8 mx-auto text-sm max-w-7xl sm:flex-row text-slate-500">
          <p>© {new Date().getFullYear()} WorkForce. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-slate-900">Privacy</a>
            <a href="#" className="hover:text-slate-900">Terms</a>
            <a href="#contact" className="hover:text-slate-900">Contact</a>
          </div>
        </div>
      </footer>

      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed items-center justify-center hidden w-10 h-10 text-white bg-blue-900 rounded-full shadow-lg bottom-6 right-6 hover:bg-blue-800 lg:flex"
        aria-label="Scroll to top"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </div>
  );
};

export default Home;
