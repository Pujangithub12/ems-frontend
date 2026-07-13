import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { Project } from "../types";
import { flattenProjectTasks } from "../project-components/taskUtils";
import { getErrorMessage } from "../lib/errors";
import ErrorBanner from "../components/ErrorBanner";
import { useProjects } from "../hooks/useProjects";
import { useUsers } from "../hooks/useUsers";
import { useTasks } from "../hooks/useTasks";
import { useLeaveRequests } from "../hooks/useLeaveRequests";
import { useSiteVisitRequests } from "../hooks/useSiteVisitRequests";
import { useActivities } from "../hooks/useActivities";
import { useDashboard } from "../hooks/useDashboard";
import { useEvents } from "../hooks/useEvents";
import {
  Cloud,
  Clock,
  SquarePen,
  CalendarDays,
  AlertTriangle,
  Flag,
  UserCheck,
  CheckCircle2,
  Building2,
  Loader2,
  ArrowRight,
  Bell,
  Activity as ActivityIcon,
  Package,
  Truck,
  PackageX,
  PackageSearch,
  Boxes,
  Warehouse,
  Users as UsersIcon,
  Layers,
  Cable,
  Sparkles,
  Wand2,
  PartyPopper,
  CalendarX2,
} from "lucide-react";

// ---- Types ---------------------------------------------------------------

type ScheduleHealth = "on_track" | "at_risk" | "delayed";

type OngoingProject = Project & {
  progress: number;
  health: ScheduleHealth;
  scheduleLabel: string;
};

// ---- Helpers --------------------------------------------------------------

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const daysBetween = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / 86400000);

/** "10 min ago" / "2 hrs ago" / "3 days ago" — coarse, human relative time. */
const timeAgo = (dateString: string) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

/**
 * Derives a project's schedule health by comparing actual progress against
 * the progress you'd "expect" given how much of the createdAt -> dueDate
 * window has elapsed. Real, computed data — not a stored field — since the
 * app doesn't track an explicit "planned pace" per project.
 */
function scheduleHealth(
  progress: number,
  createdAt: string | undefined,
  dueDate: string | undefined,
): { health: ScheduleHealth; scheduleLabel: string } {
  const today = new Date();
  if (!dueDate) return { health: "on_track", scheduleLabel: "No deadline set" };

  const due = new Date(dueDate);
  const start = createdAt ? new Date(createdAt) : today;
  const totalDays = Math.max(1, daysBetween(start, due));
  const elapsedDays = Math.min(totalDays, Math.max(0, daysBetween(start, today)));
  const expectedProgress = (elapsedDays / totalDays) * 100;
  const deltaDays = Math.round(((progress - expectedProgress) / 100) * totalDays);

  if (today.getTime() > due.getTime() && progress < 100) {
    return { health: "delayed", scheduleLabel: `${Math.abs(daysBetween(due, today))} days behind` };
  }
  if (deltaDays <= -3) {
    return { health: "at_risk", scheduleLabel: `${Math.abs(deltaDays)} days behind` };
  }
  if (deltaDays > 0) {
    return { health: "on_track", scheduleLabel: `${deltaDays} days ahead` };
  }
  return { health: "on_track", scheduleLabel: "On schedule" };
}

const HEALTH_META: Record<
  ScheduleHealth,
  { label: string; dot: string; text: string; bar: string; iconBg: string }
> = {
  on_track: { label: "On Track", dot: "bg-emerald-500", text: "text-emerald-700", bar: "bg-emerald-500", iconBg: "bg-emerald-50" },
  at_risk: { label: "At Risk", dot: "bg-amber-500", text: "text-amber-700", bar: "bg-amber-500", iconBg: "bg-amber-50" },
  delayed: { label: "Delayed", dot: "bg-red-500", text: "text-red-700", bar: "bg-red-500", iconBg: "bg-red-50" },
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

// ---- Static placeholder content --------------------------------------------
// The sections below (Supply Chain, Team Availability, Construction Progress
// Today, AI Insights) have no backing feature in this app yet (no
// procurement/inventory tables, no attendance tracking, no
// construction-metric fields, no AI integration). Per product decision,
// they're rendered here as static sample data purely to match the reference
// design, not as live figures. Today's Schedule (below) is real data from the
// Calendar feature, not sample data.

// Matches Calendar.tsx's EVENT_STYLES exactly, plus an icon per type, so a
// "Deadline"/"Event"/"Holiday" reads the same way here as it does on the
// Calendar page itself.
const SCHEDULE_TYPE_META: Record<
  string,
  { label: string; fg: string; bg: string; icon: React.ElementType }
> = {
  event: { label: "Event", fg: "#1E3A8A", bg: "#DBEAFE", icon: CalendarDays },
  holiday: { label: "Holiday", fg: "#B91C1C", bg: "#FEE2E2", icon: PartyPopper },
  deadline: { label: "Deadline", fg: "#B45309", bg: "#FEF3C7", icon: Flag },
};
const scheduleTypeMeta = (type: string) => SCHEDULE_TYPE_META[type] || SCHEDULE_TYPE_META.event;
// Surface the most actionable items first: deadlines, then regular events, then holidays.
const SCHEDULE_TYPE_ORDER: Record<string, number> = { deadline: 0, event: 1, holiday: 2 };

const MOCK_SUPPLY_CHAIN = [
  { group: "PROCUREMENT", label: "Orders Pending", value: 5 },
  { group: "PROCUREMENT", label: "Materials in Transit", value: 8 },
  { group: "PROCUREMENT", label: "Delayed Deliveries", value: 3 },
  { group: "INVENTORY", label: "Low Stock Items", value: 12 },
  { group: "INVENTORY", label: "Out of Stock Items", value: 5 },
];

type TeamSegment = { label: string; count: number; pct: number; color: string };

const MOCK_CONSTRUCTION = [
  { label: "Piles Completed", value: "18", unit: "NOS", icon: Layers },
  { label: "Structures Installed", value: "24", unit: "NOS", icon: Building2 },
  { label: "Modules Installed", value: "420", unit: "NOS", icon: Package },
  { label: "Cable Laid", value: "850", unit: "M", icon: Cable },
  { label: "Concrete Poured", value: "12", unit: "M³", icon: Boxes },
];

const MOCK_AI_INSIGHTS = [
  { tone: "red", icon: AlertTriangle, text: "3 critical tasks are overdue by more than 5 days" },
  { tone: "amber", icon: Clock, text: "Project Hydro Power is 5 days behind schedule" },
  { tone: "amber", icon: Clock, text: "Cable stock is sufficient for only 1 more week" },
  { tone: "amber", icon: Clock, text: "2 approvals have been pending for more than 48 hours" },
  { tone: "green", icon: CheckCircle2, text: "Great job! 21 tasks completed this week" },
];
const AI_TONE_CLASSES: Record<string, string> = {
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-700",
  green: "bg-emerald-50 text-emerald-700",
};

// ---- Donut chart (hand-rolled SVG, no charting dependency needed) ----------

const TeamDonut: React.FC<{ segments: TeamSegment[]; total: number }> = ({ segments, total }) => {
  const radius = 60;
  const stroke = 18;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={150} height={150} viewBox="0 0 150 150" className="flex-shrink-0">
      <g transform="translate(75,75) rotate(-90)">
        <circle r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {segments.map((seg) => {
          const length = (seg.pct / 100) * circumference;
          const dasharray = `${length} ${circumference - length}`;
          const circle = (
            <circle
              key={seg.label}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={dasharray}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += length;
          return circle;
        })}
      </g>
      <text x="75" y="70" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 24, fontWeight: 700 }}>
        {total}
      </text>
      <text x="75" y="88" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10, letterSpacing: "0.08em" }}>
        TOTAL
      </text>
    </svg>
  );
};

// ---- Component --------------------------------------------------------------

const Dashboard: React.FC = () => {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();

  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    isError: dashboardIsError,
    error: dashboardQueryError,
  } = useDashboard();
  const dashboardError = dashboardIsError
    ? getErrorMessage(dashboardQueryError, "Unable to load dashboard.")
    : null;

  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: usersData = [] } = useUsers();
  const teamCount = usersData.length;
  const { data: allTasks = [] } = useTasks();
  // Non-critical widgets: a failed fetch here degrades to "no data" rather
  // than blocking the rest of the dashboard, matching the previous
  // catch-to-empty-array behavior.
  const { data: leaveRequests = [] } = useLeaveRequests();
  const { data: siteVisitRequests = [] } = useSiteVisitRequests();
  const { data: activities = [] } = useActivities();
  const { data: calendarEvents = [], isLoading: eventsLoading } = useEvents();

  const [notifTab, setNotifTab] = useState<"notifications" | "activity">("notifications");

  const [now, setNow] = useState(new Date());

  // Live clock, matching the reference header's ticking time pill.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const ongoingProjects: OngoingProject[] = useMemo(() => {
    return projects
      .filter((p) => p.status !== "completed")
      .map((p) => {
        const tasks = flattenProjectTasks(p);
        const doneCount = tasks.filter((t) => t.status === "completed").length;
        const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
        const { health, scheduleLabel } = scheduleHealth(progress, p.createdAt, p.dueDate);
        return { ...p, progress, health, scheduleLabel };
      })
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [projects]);

  const topProjects = ongoingProjects.slice(0, 5);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const dueTodayCount = useMemo(
    () =>
      allTasks.filter((t) => t.status !== "completed" && t.dueDate && isSameDay(new Date(t.dueDate), new Date())).length,
    [allTasks],
  );
  const overdueCount = useMemo(
    () =>
      allTasks.filter(
        (t) => t.status !== "completed" && t.dueDate && new Date(t.dueDate).getTime() < todayStart.getTime(),
      ).length,
    [allTasks, todayStart],
  );
  // No separate "completedAt" is tracked on Task, so this approximates
  // "done this week" via createdAt as the closest available real signal.
  const doneThisWeekCount = useMemo(
    () =>
      allTasks.filter(
        (t) => t.status === "completed" && daysBetween(new Date(t.createdAt), new Date()) <= 7,
      ).length,
    [allTasks],
  );

  const pendingLeaveRequests = useMemo(
    () => leaveRequests.filter((lr) => lr.status === "pending"),
    [leaveRequests],
  );

  // Present / On Leave / On Site Visit — derived from today's *approved*
  // leave and site-visit requests (a pending request doesn't take someone
  // off the roster yet). A person on leave and site-visited the same day
  // (unlikely, but not impossible data-wise) counts as on leave so the three
  // buckets never double-count someone in the "present" math below.
  const teamAvailability = useMemo((): TeamSegment[] => {
    const total = teamCount;
    const today = new Date();

    const onLeaveIds = new Set<number>();
    leaveRequests.forEach((lr) => {
      if (lr.status !== "approved" || !lr.user) return;
      const start = new Date(lr.startDate);
      const end = new Date(lr.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      if (today.getTime() >= start.getTime() && today.getTime() <= end.getTime()) {
        onLeaveIds.add(lr.user.id);
      }
    });

    const onSiteVisitIds = new Set<number>();
    siteVisitRequests.forEach((sv) => {
      if (sv.status !== "approved" || !sv.user) return;
      if (isSameDay(new Date(sv.visitDate), today)) {
        onSiteVisitIds.add(sv.user.id);
      }
    });
    onLeaveIds.forEach((id) => onSiteVisitIds.delete(id));

    const onLeaveCount = onLeaveIds.size;
    const onSiteVisitCount = onSiteVisitIds.size;
    const presentCount = Math.max(0, total - onLeaveCount - onSiteVisitCount);
    const pct = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

    return [
      { label: "Present", count: presentCount, pct: pct(presentCount), color: "#10b981" },
      { label: "On Leave", count: onLeaveCount, pct: pct(onLeaveCount), color: "#ef4444" },
      { label: "On Site Visit", count: onSiteVisitCount, pct: pct(onSiteVisitCount), color: "#6D28D9" },
    ];
  }, [teamCount, leaveRequests, siteVisitRequests]);

  const todaysEvents = useMemo(() => {
    const now = new Date();
    return calendarEvents
      .filter((ev) => isSameDay(new Date(ev.date), now))
      .sort((a, b) => {
        const orderDelta = (SCHEDULE_TYPE_ORDER[a.type] ?? 1) - (SCHEDULE_TYPE_ORDER[b.type] ?? 1);
        return orderDelta !== 0 ? orderDelta : a.title.localeCompare(b.title);
      });
  }, [calendarEvents]);

  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.fullName?.split(" ")[0] || "there";
  const clockLabel = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const kpis = [
    {
      label: "My Tasks",
      value: dashboardData?.total ?? 0,
      sub: "assigned",
      icon: SquarePen,
      iconBg: "bg-slate-100",
      iconText: "text-slate-600",
      valueText: "text-slate-900",
      onClick: () => navigate(`/${workspace?.id}/tasks`),
    },
    {
      label: "Due Today",
      value: dueTodayCount,
      sub: "tasks",
      icon: CalendarDays,
      iconBg: "bg-blue-50",
      iconText: "text-blue-700",
      valueText: "text-slate-900",
      onClick: () => navigate(`/${workspace?.id}/tasks`),
    },
    {
      label: "Overdue",
      value: overdueCount,
      sub: "tasks",
      icon: AlertTriangle,
      iconBg: "bg-red-50",
      iconText: "text-red-700",
      valueText: "text-red-600",
      onClick: () => navigate(`/${workspace?.id}/tasks`),
    },
    {
      label: "High Priority",
      value: dashboardData?.highPriorityTasks.length ?? 0,
      sub: "tasks",
      icon: Flag,
      iconBg: "bg-red-50",
      iconText: "text-red-700",
      valueText: "text-slate-900",
      onClick: () => navigate(`/${workspace?.id}/tasks`),
    },
    {
      label: "To Approve",
      value: dashboardData?.pendingLeaveRequests ?? 0,
      sub: "requests",
      icon: Clock,
      iconBg: "bg-amber-50",
      iconText: "text-amber-700",
      valueText: "text-slate-900",
      onClick: () => navigate(`/${workspace?.id}/leaverequests`),
    },
    {
      label: "Done This Week",
      value: doneThisWeekCount,
      sub: "tasks",
      icon: CheckCircle2,
      iconBg: "bg-emerald-50",
      iconText: "text-emerald-700",
      valueText: "text-emerald-600",
      onClick: () => navigate(`/${workspace?.id}/tasks`),
    },
  ];

  return (
    <div className="w-full px-6 py-8 lg:px-8 lg:py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="font-semibold text-[28px] tracking-tight text-slate-900">
            {greeting}, {firstName}
          </h2>
          <p className="text-slate-500 mt-1 text-[14px]">
            Here's what's happening across your workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center self-end gap-2 mt-2">
          <span className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-[13px] text-slate-600">
            <Cloud className="w-4 h-4 text-blue-500" />
            26°C · Kathmandu
          </span>
          <span className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-[13px] text-slate-600">
            <CalendarDays className="w-4 h-4 text-emerald-500" />
            {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </span>
          <span className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-[13px] text-slate-600">
            <Clock className="w-4 h-4 text-violet-500" />
            {clockLabel}
          </span>
        </div>
      </div>

      {dashboardError && <ErrorBanner message={dashboardError} className="mb-4" />}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className="p-4 text-left transition-shadow bg-white border rounded-lg border-slate-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="text-[12px] font-medium text-slate-500">{item.label}</span>
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${item.iconBg}`}>
                <item.icon className={`w-4 h-4 ${item.iconText}`} />
              </div>
            </div>
            <div className={`mt-3 text-[26px] font-bold leading-none tracking-tight ${item.valueText}`}>
              {dashboardLoading ? "…" : item.value}
            </div>
            <div className="mt-1.5 text-slate-400 text-[12px]">{item.sub}</div>
          </button>
        ))}
      </div>

      {/* Project Progress Snapshot + Today's Schedule */}
      <div className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-3">
        <div className="bg-white border rounded-lg lg:col-span-2 border-slate-200">
          <div className="flex items-center px-5 py-4 border-b border-slate-200">
            <div className="font-semibold text-[15px] text-slate-900">Project Progress Snapshot</div>
            <button
              onClick={() => navigate(`/${workspace?.id}/project`)}
              className="flex items-center flex-shrink-0 gap-1 ml-auto text-[12px] font-medium text-blue-900 hover:text-blue-700"
            >
              View All Projects
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {projectsLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
            </div>
          ) : topProjects.length > 0 ? (
            <div className="px-5">
              <div className="grid grid-cols-[1fr_180px_120px_120px] gap-3 py-2 text-[10px] tracking-[0.08em] uppercase text-slate-400 font-mono border-b border-slate-100">
                <span>Project</span>
                <span>Progress</span>
                <span>Status</span>
                <span>Schedule</span>
              </div>
              {topProjects.map((p, idx) => {
                const meta = HEALTH_META[p.health];
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/${workspace?.id}/project/${p.id}/details`)}
                    className={`w-full text-left grid grid-cols-[1fr_180px_120px_120px] gap-3 items-center py-3.5 hover:bg-slate-50 transition-colors ${
                      idx < topProjects.length - 1 ? "border-b border-slate-100" : ""
                    }`}
                  >
                    <div className="flex items-center min-w-0 gap-3">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${meta.iconBg}`}>
                        <Building2 className={`w-4 h-4 ${meta.text}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[13px] text-slate-900 truncate">{p.name}</div>
                        {p.description && (
                          <div className="text-slate-400 text-[11px] truncate">{p.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${p.progress}%` }} />
                      </div>
                      <span className="text-[11px] text-slate-500 w-8 flex-shrink-0">{p.progress}%</span>
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide ${meta.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </div>
                    <div className="text-[12px] text-slate-500">{p.scheduleLabel}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-slate-100">
                <Building2 className="w-6 h-6 text-slate-400" />
              </div>
              <div className="font-semibold text-[14px] text-slate-900 mb-1">No ongoing projects</div>
              <div className="text-slate-500 text-[12px] max-w-xs">
                All projects are completed, or none have been created yet.
              </div>
            </div>
          )}
          <div className="h-2" />
        </div>

        {/* Today's Schedule — real events/deadlines from the Calendar for today */}
        <div className="bg-white border rounded-lg border-slate-200">
          <div className="flex items-center px-5 py-4 border-b border-slate-200">
            <div className="font-semibold text-[15px] text-slate-900">Today's Schedule</div>
            <button
              onClick={() => navigate(`/${workspace?.id}/calendar`)}
              className="flex items-center flex-shrink-0 gap-1 ml-auto text-[12px] font-medium text-blue-900 hover:text-blue-700"
            >
              View Calendar
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-5">
            {eventsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
              </div>
            ) : todaysEvents.length > 0 ? (
              <div className="space-y-3">
                {todaysEvents.map((ev) => {
                  const meta = scheduleTypeMeta(ev.type);
                  return (
                    <div key={ev.id} className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-lg"
                        style={{ background: meta.bg }}
                      >
                        <meta.icon className="w-4 h-4" style={{ color: meta.fg }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[13px] text-slate-900 truncate">{ev.title}</div>
                      </div>
                      <span
                        className="flex-shrink-0 text-[9.5px] uppercase tracking-[0.04em] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: meta.bg, color: meta.fg }}
                      >
                        {meta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex items-center justify-center w-10 h-10 mb-2.5 rounded-full bg-slate-100">
                  <CalendarX2 className="w-5 h-5 text-slate-400" />
                </div>
                <div className="font-medium text-[13px] text-slate-900">Nothing scheduled today</div>
                <div className="text-slate-400 text-[12px] mt-0.5">
                  Add an event or deadline from the calendar.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notifications/Activity + Supply Chain + Team Availability */}
      <div className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-3">
        <div className="bg-white border rounded-lg border-slate-200">
          <div className="flex items-center gap-5 px-5 pt-3 border-b border-slate-200">
            <button
              onClick={() => setNotifTab("notifications")}
              className={`pb-3 text-[13px] font-medium border-b-2 transition-colors ${
                notifTab === "notifications" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Notifications
            </button>
            <button
              onClick={() => setNotifTab("activity")}
              className={`pb-3 text-[13px] font-medium border-b-2 transition-colors ${
                notifTab === "activity" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Recent Activity
            </button>
            <button
              onClick={() => navigate(`/${workspace?.id}/activities`)}
              className="flex items-center flex-shrink-0 gap-1 ml-auto mb-3 text-[12px] font-medium text-blue-900 hover:text-blue-700"
            >
              View All
            </button>
          </div>
          <div className="p-4 space-y-3 max-h-[200px] overflow-y-auto">
            {notifTab === "notifications" ? (
              pendingLeaveRequests.length > 0 ? (
                pendingLeaveRequests.slice(0, 6).map((lr) => (
                  <div key={lr.id} className="flex gap-2.5 items-start">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13px] text-slate-700">
                        <span className="font-semibold text-slate-900">Leave request from {lr.user?.fullName || "a team member"}</span>{" "}
                        needs your approval
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5">{timeAgo(lr.createdAt)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex gap-2.5 items-start">
                  <Bell className="mt-0.5 w-4 h-4 text-slate-300 flex-shrink-0" />
                  <div className="text-slate-400 text-[13px]">Nothing needs your attention right now.</div>
                </div>
              )
            ) : activities.length > 0 ? (
              activities.slice(0, 6).map((a) => (
                <div key={a.id} className="flex gap-2.5 items-start">
                  <ActivityIcon className="mt-0.5 w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[13px] text-slate-700">{a.description}</div>
                    <div className="text-slate-400 text-[11px] mt-0.5">{timeAgo(a.createdAt)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-400 text-[13px]">No recent activity yet.</div>
            )}
          </div>
        </div>

        {/* Supply Chain (sample data — procurement/inventory tracking isn't built yet) */}
        <div className="bg-white border rounded-lg border-slate-200">
          <div className="flex items-center px-5 py-3 border-b border-slate-200">
            <div className="font-semibold text-[15px] text-slate-900">Supply Chain</div>
            <span className="flex items-center flex-shrink-0 gap-1 ml-auto text-[12px] font-medium text-blue-900">
              View All
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {MOCK_SUPPLY_CHAIN.map((row) => (
              <div key={row.label} className="flex items-center gap-3 px-5 py-2">
                <span
                  className="font-mono text-[9px] tracking-[0.08em] uppercase text-slate-400 w-24 flex-shrink-0"
                >
                  {row.group}
                </span>
                <span className="flex-1 text-[13px] text-slate-700">{row.label}</span>
                <span className="flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded-full bg-amber-50 text-amber-700 text-[12px] font-semibold">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Team Availability — real counts from today's approved leave/site-visit requests */}
        <div className="bg-white border rounded-lg border-slate-200">
          <div className="flex items-center px-5 py-3 border-b border-slate-200">
            <div className="font-semibold text-[15px] text-slate-900">Team Availability</div>
            <button
              onClick={() => navigate(`/${workspace?.id}/users`)}
              className="flex items-center flex-shrink-0 gap-1 ml-auto text-[12px] font-medium text-blue-900 hover:text-blue-700"
            >
              View Team
            </button>
          </div>
          <div className="flex items-center gap-5 p-4">
            <TeamDonut segments={teamAvailability} total={teamCount} />
            <div className="flex-1 space-y-1.5 min-w-0">
              {teamAvailability.map((seg) => (
                <div key={seg.label} className="flex gap-2 items-center text-[12px]">
                  <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                  <span className="flex-1 truncate text-slate-600">{seg.label}</span>
                  <span className="font-semibold text-slate-900">{seg.count}</span>
                  <span className="w-10 text-right text-slate-400">({seg.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Construction Progress Today + AI Insights */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Sample data — no construction-metric fields exist on Project/Task yet */}
        <div className="bg-white border rounded-lg lg:col-span-3 border-slate-200">
          <div className="flex items-center px-5 py-4 border-b border-slate-200">
            <div className="font-semibold text-[15px] text-slate-900">Construction Progress Today</div>
            <button
              onClick={() => navigate(`/${workspace?.id}/project`)}
              className="flex items-center flex-shrink-0 gap-1 ml-auto text-[12px] font-medium text-blue-900 hover:text-blue-700"
            >
              View Details
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-5">
            {MOCK_CONSTRUCTION.map((item) => (
              <div key={item.label} className="text-center">
                <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 rounded-lg bg-blue-50">
                  <item.icon className="w-4.5 h-4.5 text-blue-700" />
                </div>
                <div className="font-bold text-[20px] text-slate-900 tracking-tight">{item.value}</div>
                <div className="text-slate-400 text-[10px] tracking-wide">{item.unit}</div>
                <div className="text-slate-500 text-[11px] mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insights (sample data — no AI feature is wired up yet) */}
        <div className="bg-white border rounded-lg lg:col-span-2 border-slate-200">
          <div className="flex items-center px-5 py-4 border-b border-slate-200">
            <div className="font-semibold text-[15px] text-slate-900">AI Insights</div>
            <span className="flex items-center flex-shrink-0 gap-1 ml-auto text-[10px] font-medium text-violet-500 tracking-wide uppercase">
              <Sparkles className="w-3 h-3" />
              Powered by AI
            </span>
          </div>
          <div className="p-4 space-y-2">
            {MOCK_AI_INSIGHTS.map((insight, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 items-center px-3 py-2.5 rounded-md text-[12.5px] ${AI_TONE_CLASSES[insight.tone]}`}
              >
                <insight.icon className="flex-shrink-0 w-4 h-4" />
                {insight.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
