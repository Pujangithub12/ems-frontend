import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthProvider";
import { Project } from "../../../types";
import { flattenProjectTasks } from "../../tasks/utils/taskUtils";
import { getErrorMessage } from "../../../lib/errors";
import ErrorBanner from "../../../components/ErrorBanner";
import StatCard from "../../../components/StatCard";
import { useProjects } from "../../projects/hooks/useProjects";
import { useUsers } from "../../users/hooks/useUsers";
import { useTasks } from "../../tasks/hooks/useTasks";
import { useLeaveRequests } from "../../approvals/hooks/useLeaveRequests";
import { useSiteVisitRequests } from "../../approvals/hooks/useSiteVisitRequests";
import { useDashboard } from "../hooks/useDashboard";
import { useEvents } from "../../calendar/hooks/useEvents";
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

type TeamSegment = { label: string; count: number; pct: number; color: string };

// ---- Coming soon placeholder (Supply Chain / Construction Progress / AI
// Insights all depend on data this app doesn't track yet) -------------------

const ComingSoon: React.FC<{ className?: string }> = ({ className = "py-10" }) => (
  <div className={`flex flex-col items-center justify-center text-center ${className}`}>
    <div className="flex items-center justify-center w-10 h-10 mb-2 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
      <Wand2 className="w-4.5 h-4.5 text-slate-400" />
    </div>
    <div className="text-slate-400 text-[13px] font-medium">Coming soon</div>
  </div>
);

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
      onClick: () => navigate(`/${organization?.id}/approvals`),
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

  return (
    <div className="w-full min-h-full px-6 py-6 bg-[#F7F8FA] lg:px-8 lg:py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="font-semibold text-[22px] tracking-tight text-slate-900">
            {greeting}, {firstName}
          </h2>
          <p className="text-slate-500 mt-1 text-[13px]">
            Here's what's happening across your organization.
          </p>
        </div>
        <div className="flex flex-wrap items-center self-end gap-2 mt-2">
          <span className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-[13px] text-slate-600 shadow-md">
            <Cloud className="w-4 h-4 text-blue-500" />
            26°C · Kathmandu
          </span>
          <span className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-[13px] text-slate-600 shadow-md">
            <CalendarDays className="w-4 h-4 text-emerald-500" />
            {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </span>
          <span className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-[13px] text-slate-600 shadow-md">
            <Clock className="w-4 h-4 text-violet-500" />
            {clockLabel}
          </span>
        </div>
      </div>

      {dashboardError && <ErrorBanner message={dashboardError} className="mb-4" />}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((item) => (
          <StatCard
            key={item.label}
            accent={item.accent}
            label={item.label}
            value={dashboardLoading ? "…" : item.value}
            sub={item.sub}
            icon={item.icon}
            iconBg={item.iconBg}
            iconText={item.iconText}
            onClick={item.onClick}
          />
        ))}
      </div>

      {/* Project Progress Snapshot + Today's Schedule */}
      <div className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-3">
        <div className="bg-white border rounded-xl shadow-md lg:col-span-2 border-slate-200 overflow-hidden">
          <div className="flex items-center px-5 py-4 border-b border-slate-200 bg-slate-50/60">
            <div className="font-semibold text-[15px] text-slate-900">Project Progress Snapshot</div>
            <button
              onClick={() => navigate(`/${organization?.id}/project`)}
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
                    onClick={() => navigate(`/${organization?.id}/project/${p.id}/details`)}
                    className={`w-full text-left grid grid-cols-[1fr_180px_120px_120px] gap-3 items-center py-3.5 hover:bg-slate-50 transition-colors ${
                      idx < topProjects.length - 1 ? "border-b border-slate-100" : ""
                    }`}
                  >
                    <div className="flex items-center min-w-0 gap-3">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ring-1 ${meta.iconBg} ${meta.ring}`}>
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
              <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
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
        <div className="bg-white border rounded-xl shadow-md border-slate-200 overflow-hidden">
          <div className="flex items-center px-5 py-4 border-b border-slate-200 bg-slate-50/60">
            <div className="font-semibold text-[15px] text-slate-900">Today's Schedule</div>
            <button
              onClick={() => navigate(`/${organization?.id}/calendar`)}
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
                <div className="flex items-center justify-center w-10 h-10 mb-2.5 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
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

      {/* AI Insights + Supply Chain + Team Availability */}
      <div className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-3">
        {/* AI Insights — no AI feature is wired up yet */}
        <div className="bg-white border rounded-xl shadow-md border-slate-200 overflow-hidden">
          <div className="flex items-center px-5 py-3 border-b border-slate-200 bg-slate-50/60">
            <div className="font-semibold text-[15px] text-slate-900">AI Insights</div>
            <span className="flex items-center flex-shrink-0 gap-1 ml-auto text-[10px] font-medium text-violet-500 tracking-wide uppercase">
              <Sparkles className="w-3 h-3" />
              Powered by AI
            </span>
          </div>
          <ComingSoon />
        </div>

        {/* Supply Chain — procurement/inventory tracking isn't built yet */}
        <div className="bg-white border rounded-xl shadow-md border-slate-200 overflow-hidden">
          <div className="flex items-center px-5 py-3 border-b border-slate-200 bg-slate-50/60">
            <div className="font-semibold text-[15px] text-slate-900">Supply Chain</div>
          </div>
          <ComingSoon />
        </div>

        {/* Team Availability — real counts from today's approved leave/site-visit requests */}
        <div className="bg-white border rounded-xl shadow-md border-slate-200 overflow-hidden">
          <div className="flex items-center px-5 py-3 border-b border-slate-200 bg-slate-50/60">
            <div className="font-semibold text-[15px] text-slate-900">Team Availability</div>
            <button
              onClick={() => navigate(`/${organization?.id}/users`)}
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

      {/* Construction Progress Today */}
      <div className="grid grid-cols-1 gap-6">
        {/* No construction-metric fields exist on Project/Task yet */}
        <div className="bg-white border rounded-xl shadow-md border-slate-200 overflow-hidden">
          <div className="flex items-center px-5 py-4 border-b border-slate-200 bg-slate-50/60">
            <div className="font-semibold text-[15px] text-slate-900">Construction Progress Today</div>
            <button
              onClick={() => navigate(`/${organization?.id}/project`)}
              className="flex items-center flex-shrink-0 gap-1 ml-auto text-[12px] font-medium text-blue-900 hover:text-blue-700"
            >
              View Details
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <ComingSoon />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
