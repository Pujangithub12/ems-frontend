import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthProvider";
import { Project } from "../../../types";
import { flattenProjectTasks } from "../../tasks/utils/taskUtils";
import { getErrorMessage } from "../../../lib/errors";
import ErrorBanner from "../../../components/ErrorBanner";
import { useProjects } from "../../projects/hooks/useProjects";
import { useUsers } from "../../users/hooks/useUsers";
import { useTasks } from "../../tasks/hooks/useTasks";
import { useLeaveRequests } from "../../approvals/hooks/useLeaveRequests";
import { useSiteVisitRequests } from "../../approvals/hooks/useSiteVisitRequests";
import { useDashboard } from "../hooks/useDashboard";
import { useEvents } from "../../calendar/hooks/useEvents";
import { daysRemainingLabel, getStatusMeta, isOverdue, StatusPill } from "../../tasks/utils/taskDisplay";
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
  Users as UsersIcon,
  Wand2,
  PartyPopper,
  CalendarX2,
  FolderKanban,
  ListChecks,
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
  { label: string; dot: string; text: string; bar: string; iconBg: string; ring: string }
> = {
  on_track: { label: "On Track", dot: "bg-emerald-500", text: "text-emerald-700", bar: "bg-emerald-500", iconBg: "bg-emerald-50", ring: "ring-emerald-100" },
  at_risk: { label: "At Risk", dot: "bg-amber-500", text: "text-amber-700", bar: "bg-amber-500", iconBg: "bg-amber-50", ring: "ring-amber-100" },
  delayed: { label: "Delayed", dot: "bg-red-500", text: "text-red-700", bar: "bg-red-500", iconBg: "bg-red-50", ring: "ring-red-100" },
};

// ---- Static placeholder content --------------------------------------------
// The sections below (Supply Chain, Construction Progress Today) have no
// backing feature in this app yet (no procurement/inventory tables, no
// construction-metric fields). Per product decision, they're rendered here
// as static sample data purely to match the reference design, not as live
// figures. Today's Schedule (below) is real data from the Calendar feature,
// not sample data.

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

type TeamSegment = { label: string; count: number; pct: number; color: string };

// ---- Layout helpers ----------------------------------------------------------

const Card: React.FC<{
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, action, className = "", children }) => (
  <section className={`flex flex-col overflow-hidden bg-white border shadow-sm rounded-xl border-slate-200 ${className}`}>
    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
      <h3 className="font-semibold text-[13.5px] text-slate-900">{title}</h3>
      {subtitle && <span className="text-[11px] text-slate-400">{subtitle}</span>}
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center flex-shrink-0 gap-1 ml-auto text-[11.5px] font-medium text-blue-900 hover:text-blue-700"
        >
          {action.label}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
    <div className="flex-1">{children}</div>
  </section>
);

const EmptyState: React.FC<{ icon: React.ElementType; title: string; text: string }> = ({ icon: Icon, title, text }) => (
  <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
    <div className="flex items-center justify-center w-11 h-11 mb-2.5 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
      <Icon className="w-5 h-5 text-slate-400" />
    </div>
    <div className="font-medium text-[13px] text-slate-900">{title}</div>
    <div className="text-slate-400 text-[12px] mt-0.5 max-w-xs">{text}</div>
  </div>
);

// ---- Donut chart (hand-rolled SVG, no charting dependency needed) ----------

const TeamDonut: React.FC<{ segments: TeamSegment[]; total: number }> = ({ segments, total }) => {
  const radius = 42;
  const stroke = 13;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={104} height={104} viewBox="0 0 104 104" className="flex-shrink-0">
      <g transform="translate(52,52) rotate(-90)">
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
      <text x="52" y="48" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 17, fontWeight: 700 }}>
        {total}
      </text>
      <text x="52" y="63" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 8, letterSpacing: "0.08em" }}>
        TOTAL
      </text>
    </svg>
  );
};

/** Bigger ring chart with rounded segment caps and small visual gaps between
 * segments — used for Project Status. Distinct treatment from TeamDonut
 * (which stays compact/flat for the tighter Team Availability card) so this
 * one reads as the chunkier "hero chart" in its row. */
const RingChart: React.FC<{ segments: { label: string; pct: number; color: string }[]; total: number; totalLabel: string }> = ({
  segments,
  total,
  totalLabel,
}) => {
  const radius = 46;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius;
  const gap = 3;
  let offset = 0;

  return (
    <svg width={116} height={116} viewBox="0 0 116 116" className="flex-shrink-0">
      <g transform="translate(58,58) rotate(-90)">
        <circle r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {segments
          .filter((seg) => seg.pct > 0)
          .map((seg) => {
            const rawLength = (seg.pct / 100) * circumference;
            const length = Math.max(0, rawLength - gap);
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
                strokeLinecap="round"
              />
            );
            offset += rawLength;
            return circle;
          })}
      </g>
      <text x="58" y="54" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 20, fontWeight: 700 }}>
        {total}
      </text>
      <text x="58" y="70" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 8.5, letterSpacing: "0.06em" }}>
        {totalLabel}
      </text>
    </svg>
  );
};

// ---- Component --------------------------------------------------------------

const Dashboard: React.FC = () => {
  const { user, organization } = useAuth();
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
  const { data: calendarEvents = [], isLoading: eventsLoading } = useEvents();

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

  // Task Progress card — real breakdown of every task's current status.
  // on_hold is folded into "Not Started" alongside to_do since neither is
  // actively being worked, keeping this a clean 3-bucket view.
  const taskStatusBreakdown = useMemo(() => {
    const total = allTasks.length;
    const completed = allTasks.filter((t) => t.status === "completed").length;
    const inProgress = allTasks.filter((t) => t.status === "in_progress").length;
    const notStarted = Math.max(0, total - completed - inProgress);
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return [
      { label: "Not Started", count: notStarted, pct: pct(notStarted), color: "#64748b" },
      { label: "In Progress", count: inProgress, pct: pct(inProgress), color: "#7c3aed" },
      { label: "Completed", count: completed, pct: pct(completed), color: "#10b981" },
    ];
  }, [allTasks]);

  // Project Status card — real breakdown across every project: those already
  // marked completed, plus the same on_track/at_risk/delayed health used in
  // the Project Progress Snapshot below, so the two sections never disagree.
  const projectStatusBreakdown = useMemo(() => {
    const total = projects.length;
    const completedCount = projects.filter((p) => p.status === "completed").length;
    const onTrackCount = ongoingProjects.filter((p) => p.health === "on_track").length;
    const atRiskCount = ongoingProjects.filter((p) => p.health === "at_risk").length;
    const delayedCount = ongoingProjects.filter((p) => p.health === "delayed").length;
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      total,
      segments: [
        { label: "Completed", count: completedCount, pct: pct(completedCount), color: "#1e3a8a" },
        { label: "On Track", count: onTrackCount, pct: pct(onTrackCount), color: "#10b981" },
        { label: "At Risk", count: atRiskCount, pct: pct(atRiskCount), color: "#f59e0b" },
        { label: "Delayed", count: delayedCount, pct: pct(delayedCount), color: "#ef4444" },
      ],
    };
  }, [projects, ongoingProjects]);

  // Open top-level tasks assigned to the signed-in user, soonest due first.
  const myOpenTasks = useMemo(() => {
    const me = Number(user?.id);
    return allTasks
      .filter((t) => t.status !== "completed" && t.parentTaskId == null && t.assignedUsers?.some((u) => u.id === me))
      .sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return da - db;
      });
  }, [allTasks, user?.id]);
  const myUpcoming = myOpenTasks.slice(0, 6);

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
      accent: "#64748b",
      icon: SquarePen,
      iconBg: "bg-slate-100",
      iconText: "text-slate-600",
      onClick: () => navigate(`/${organization?.id}/tasks`),
    },
    {
      label: "Due Today",
      value: dueTodayCount,
      sub: "tasks",
      accent: "#2563eb",
      icon: CalendarDays,
      iconBg: "bg-blue-50",
      iconText: "text-blue-700",
      onClick: () => navigate(`/${organization?.id}/tasks`),
    },
    {
      label: "Overdue",
      value: overdueCount,
      sub: "tasks",
      accent: "#dc2626",
      icon: AlertTriangle,
      iconBg: "bg-red-50",
      iconText: "text-red-700",
      onClick: () => navigate(`/${organization?.id}/tasks`),
    },
    {
      label: "High Priority",
      value: dashboardData?.highPriorityTasks.length ?? 0,
      sub: "tasks",
      accent: "#ea580c",
      icon: Flag,
      iconBg: "bg-red-50",
      iconText: "text-red-700",
      onClick: () => navigate(`/${organization?.id}/tasks`),
    },
    {
      label: "To Approve",
      value: dashboardData?.pendingLeaveRequests ?? 0,
      sub: "requests",
      accent: "#d97706",
      icon: Clock,
      iconBg: "bg-amber-50",
      iconText: "text-amber-700",
      onClick: () => navigate(`/${organization?.id}/attendance`),
    },
    {
      label: "Done This Week",
      value: doneThisWeekCount,
      sub: "tasks",
      accent: "#059669",
      icon: CheckCircle2,
      iconBg: "bg-emerald-50",
      iconText: "text-emerald-700",
      onClick: () => navigate(`/${organization?.id}/tasks`),
    },
  ];

  // Organization overview — the headline counts, shown as one compact strip.
  const overview = [
    { label: "Active Projects", value: ongoingProjects.length, icon: Building2, color: "#10b981", onClick: () => navigate(`/${organization?.id}/project`) },
    { label: "Total Tasks", value: allTasks.length, icon: ListChecks, color: "#2563eb", onClick: () => navigate(`/${organization?.id}/tasks`) },
    { label: "Team Members", value: teamCount, icon: UsersIcon, color: "#db2777", onClick: () => navigate(`/${organization?.id}/users`) },
  ];
  const [myTasksKpi, dueTodayKpi, overdueKpi, highPriorityKpi, toApproveKpi, doneWeekKpi] = kpis;
  // Things that may need action today get their own cards; the rest sit in the overview strip.
  const attention = [dueTodayKpi, overdueKpi, highPriorityKpi, toApproveKpi];
  const quiet = [myTasksKpi, doneWeekKpi];

  const taskTotal = allTasks.length;

  return (
    <div className="w-full min-h-full px-4 py-5 bg-[#F7F8FA] sm:px-6 lg:px-8 lg:py-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p className="text-[12px] font-medium text-slate-400">
            {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h2 className="mt-0.5 font-semibold text-[22px] tracking-tight text-slate-900">
            {greeting}, {firstName}
          </h2>
          <p className="text-slate-500 mt-0.5 text-[12.5px]">Here&apos;s what needs your attention today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[12px] text-slate-600 shadow-sm">
            <Cloud className="w-3.5 h-3.5 text-blue-500" />
            26°C · Kathmandu
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[12px] text-slate-600 shadow-sm">
            <Clock className="w-3.5 h-3.5 text-violet-500" />
            {clockLabel}
          </span>
        </div>
      </div>

      {dashboardError && <ErrorBanner message={dashboardError} className="mb-4" />}

      {/* Needs attention */}
      <div className="grid grid-cols-2 gap-3 mb-4 lg:grid-cols-4">
        {attention.map((k) => {
          const hot = k.value > 0;
          return (
            <button
              key={k.label}
              onClick={k.onClick}
              className="relative p-4 overflow-hidden text-left transition-all bg-white border shadow-sm group rounded-xl border-slate-200 hover:shadow-md hover:-translate-y-0.5"
            >
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: hot ? k.accent : "#e2e8f0" }} />
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-slate-500">{k.label}</span>
                <span className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: `${k.accent}14` }}>
                  <k.icon className="w-4 h-4" style={{ color: k.accent }} />
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span
                  className="text-[26px] font-bold leading-none tracking-tight tabular-nums"
                  style={{ color: hot ? k.accent : "#0f172a" }}
                >
                  {dashboardLoading ? "…" : k.value}
                </span>
                <span className="text-[11.5px] text-slate-400">{k.sub}</span>
              </div>
              <span className="flex items-center gap-1 mt-2 text-[11px] font-medium text-slate-400 group-hover:text-blue-900">
                View <ArrowRight className="w-3 h-3" />
              </span>
            </button>
          );
        })}
      </div>

      {/* Organization overview strip */}
      <div className="px-4 mb-5 -mx-4 overflow-x-auto sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 lg:overflow-visible">
        <div className="flex bg-white border divide-x shadow-sm min-w-max rounded-xl border-slate-200 divide-slate-100 lg:min-w-0">
          {overview.map((o) => (
            <button
              key={o.label}
              onClick={o.onClick}
              className="flex items-center flex-1 gap-3 px-4 py-3 text-left transition-colors min-w-[150px] hover:bg-slate-50"
            >
              <span className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg" style={{ background: o.color }}>
                <o.icon className="w-4 h-4 text-white" />
              </span>
              <span className="min-w-0">
                <span className="block text-[18px] font-semibold leading-none text-slate-900 tabular-nums">{o.value}</span>
                <span className="block mt-1 text-[11.5px] text-slate-500 truncate">{o.label}</span>
              </span>
            </button>
          ))}
          {quiet.map((k) => (
            <button
              key={k.label}
              onClick={k.onClick}
              className="flex items-center flex-1 gap-3 px-4 py-3 text-left transition-colors min-w-[150px] hover:bg-slate-50"
            >
              <span className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg" style={{ background: `${k.accent}1A` }}>
                <k.icon className="w-4 h-4" style={{ color: k.accent }} />
              </span>
              <span className="min-w-0">
                <span className="block text-[18px] font-semibold leading-none text-slate-900 tabular-nums">
                  {dashboardLoading ? "…" : k.value}
                </span>
                <span className="block mt-1 text-[11.5px] text-slate-500 truncate">
                  {k.label} <span className="text-slate-400">· {k.sub}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* My upcoming tasks + Today's schedule */}
      <div className="grid grid-cols-1 gap-5 mb-5 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="My Upcoming Tasks"
          subtitle={myOpenTasks.length ? `${myOpenTasks.length} open` : undefined}
          action={{ label: "Open Tasks", onClick: () => navigate(`/${organization?.id}/tasks`) }}
        >
          {myUpcoming.length > 0 ? (
            <div>
              {myUpcoming.map((t) => {
                const overdue = isOverdue(t.dueDate, t.status);
                const remaining = daysRemainingLabel(t.dueDate, t.status);
                const status = getStatusMeta(t.status);
                const project = t.project?.name || t.projectName || "";
                return (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/${organization?.id}/tasks`)}
                    className="flex items-center w-full gap-3 px-4 py-3 text-left transition-colors border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                  >
                    <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ background: status.fg }} title={status.label} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium text-slate-900 truncate">{t.title}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-slate-500">
                        {project ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 max-w-[200px]">
                            <FolderKanban className="flex-shrink-0 w-3 h-3" />
                            <span className="truncate">{project}</span>
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">No project</span>
                        )}
                        <span>{status.label}</span>
                      </span>
                    </span>
                    <span className="hidden sm:block flex-shrink-0 w-[76px]">
                      <StatusPill type="priority" value={t.priority} />
                    </span>
                    <span className="flex-shrink-0 w-[112px] text-right leading-tight">
                      <span className={`block text-[12px] ${overdue ? "text-red-600 font-medium" : "text-slate-700"}`}>
                        {t.dueDate ? formatDate(t.dueDate) : "—"}
                      </span>
                      {remaining && (
                        <span
                          className={`block text-[11px] mt-0.5 ${
                            overdue ? "text-red-500" : remaining === "Due today" ? "text-amber-600" : "text-slate-400"
                          }`}
                        >
                          {remaining}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="You're all caught up" text="No open tasks are assigned to you." />
          )}
        </Card>

        {/* Today's Schedule — real events/deadlines from the Calendar for today */}
        <Card title="Today's Schedule" action={{ label: "Calendar", onClick: () => navigate(`/${organization?.id}/calendar`) }}>
          {eventsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
            </div>
          ) : todaysEvents.length > 0 ? (
            <div className="p-4 space-y-2">
              {todaysEvents.map((ev) => {
                const meta = scheduleTypeMeta(ev.type);
                return (
                  <div key={ev.id} className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg" style={{ background: meta.bg }}>
                      <meta.icon className="w-4 h-4" style={{ color: meta.fg }} />
                    </div>
                    <div className="flex-1 min-w-0 font-medium text-[12.5px] text-slate-900 truncate">{ev.title}</div>
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
            <EmptyState icon={CalendarX2} title="Nothing scheduled today" text="Add an event or deadline from the calendar." />
          )}
        </Card>
      </div>

      {/* Projects */}
      <div className="grid grid-cols-1 gap-5 mb-5 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Project Progress Snapshot"
          subtitle={ongoingProjects.length ? `${ongoingProjects.length} ongoing` : undefined}
          action={{ label: "All Projects", onClick: () => navigate(`/${organization?.id}/project`) }}
        >
          {projectsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
            </div>
          ) : topProjects.length > 0 ? (
            <div>
              {topProjects.map((p) => {
                const meta = HEALTH_META[p.health];
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/${organization?.id}/project/${p.id}/details`)}
                    className="flex items-center w-full gap-3 px-4 py-3 text-left transition-colors border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                  >
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ring-1 ${meta.iconBg} ${meta.ring}`}>
                      <Building2 className={`w-4 h-4 ${meta.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[13px] text-slate-900 truncate">{p.name}</span>
                        <span
                          className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${meta.iconBg} ${meta.text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${p.progress}%` }} />
                        </div>
                        <span className="text-[11px] text-slate-500 w-8 flex-shrink-0 text-right tabular-nums">{p.progress}%</span>
                      </div>
                    </div>
                    <div className="hidden sm:block flex-shrink-0 w-[120px] text-right leading-tight">
                      <div className="text-[12px] text-slate-700">{p.scheduleLabel}</div>
                      {p.dueDate && <div className="text-[11px] text-slate-400 mt-0.5">Due {formatDate(p.dueDate)}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={Building2} title="No ongoing projects" text="All projects are completed, or none have been created yet." />
          )}
        </Card>

        <Card title="Project Status">
          <div className="flex flex-col items-center gap-4 p-4 sm:flex-row lg:flex-col xl:flex-row">
            <RingChart segments={projectStatusBreakdown.segments} total={projectStatusBreakdown.total} totalLabel="PROJECTS" />
            <div className="flex-1 w-full min-w-0 space-y-2.5">
              {projectStatusBreakdown.segments.map((seg) => (
                <div key={seg.label}>
                  <div className="flex items-center justify-between mb-1 text-[11.5px]">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ background: seg.color }} />
                      {seg.label}
                    </span>
                    <span className="text-slate-400">
                      {seg.count}/{projectStatusBreakdown.total}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${seg.pct}%`, background: seg.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Tasks + team */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Task Progress — every task's current status as one stacked bar */}
        <Card title="Task Progress" subtitle={`${taskTotal} total`}>
          <div className="p-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
              {taskStatusBreakdown
                .filter((seg) => seg.count > 0)
                .map((seg) => (
                  <div
                    key={seg.label}
                    style={{ width: `${(seg.count / Math.max(1, taskTotal)) * 100}%`, background: seg.color }}
                    title={`${seg.label}: ${seg.count}`}
                  />
                ))}
            </div>
            <div className="mt-4 space-y-2.5">
              {taskStatusBreakdown.map((seg) => (
                <div key={seg.label} className="flex items-center gap-2 text-[12px]">
                  <span className="flex-shrink-0 w-2.5 h-2.5 rounded-sm" style={{ background: seg.color }} />
                  <span className="flex-1 text-slate-600">{seg.label}</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{seg.count}</span>
                  <span className="w-10 text-right text-slate-400 tabular-nums">{seg.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Team Availability — real counts from today's approved leave/site-visit requests */}
        <Card title="Team Availability" action={{ label: "Team", onClick: () => navigate(`/${organization?.id}/users`) }}>
          <div className="flex items-center gap-4 p-4">
            <TeamDonut segments={teamAvailability} total={teamCount} />
            <div className="flex-1 min-w-0 space-y-2">
              {teamAvailability.map((seg) => (
                <div key={seg.label} className="flex gap-2 items-center text-[12px]">
                  <span className="flex-shrink-0 w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
                  <span className="flex-1 truncate text-slate-600">{seg.label}</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{seg.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Supply Chain / Construction Progress — no backing data in the app yet */}
        <Card title="Coming Soon">
          <div className="p-4 space-y-2.5">
            <div className="flex items-center gap-3 p-3 border border-dashed rounded-lg border-slate-200">
              <span className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full bg-slate-50 ring-1 ring-slate-200">
                <Wand2 className="w-4 h-4 text-slate-400" />
              </span>
              <span className="flex-1 min-w-0 text-[12.5px] font-medium text-slate-600 truncate">Supply Chain</span>
              <span className="text-[11px] text-slate-400">Soon</span>
            </div>
            <button
              onClick={() => navigate(`/${organization?.id}/project`)}
              className="flex items-center w-full gap-3 p-3 text-left transition-colors border border-dashed rounded-lg border-slate-200 hover:bg-slate-50"
            >
              <span className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full bg-slate-50 ring-1 ring-slate-200">
                <Wand2 className="w-4 h-4 text-slate-400" />
              </span>
              <span className="flex-1 min-w-0 text-[12.5px] font-medium text-slate-600 truncate">Construction Progress</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;