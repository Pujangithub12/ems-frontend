import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import { ProjectHeading, ProjectTask } from "../types";
import { flattenProjectTasks } from "../project-components/taskUtils";
import { StatusPill } from "../project-components/ProjectSharedComponents";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Calendar as CalendarIcon,
  Building2,
  Users as UsersIcon,
  Loader2,
  ChevronRight,
  Zap,
  ArrowRight,
  UserCheck,
  ListChecks,
} from "lucide-react";

type AssignedUser = {
  id: number;
  fullName: string;
  email: string;
};

type Task = {
  id: number;
  companyName: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string;
  assignedUsers: AssignedUser[];
  createdAt: string;
};

type DashboardData = {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  highPriorityTasks: Task[];
  pendingLeaveRequests: number;
};

type ProjectSummary = {
  id: number;
  name: string;
  status: string;
  dueDate?: string;
  headings?: ProjectHeading[];
  projectTasks?: ProjectTask[];
};

type OngoingProject = ProjectSummary & { progress: number };

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const dueDateBadge = (dueDate?: string): { label: string; tone: string } => {
  if (!dueDate) return { label: "No deadline", tone: "text-slate-400" };
  const diffDays = Math.round(
    (new Date(dueDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) /
      86400000,
  );
  if (diffDays < 0) return { label: `Overdue ${Math.abs(diffDays)}d`, tone: "text-red-700" };
  if (diffDays === 0) return { label: "Due today", tone: "text-amber-700" };
  if (diffDays <= 7) return { label: `${diffDays}d left`, tone: "text-amber-700" };
  return { label: formatDate(dueDate), tone: "text-slate-500" };
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

const STAT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "hover:border-amber-300",
  },
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-900",
    border: "hover:border-blue-300",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "hover:border-emerald-300",
  },
  red: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "hover:border-red-300",
  },
  violet: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "hover:border-violet-300",
  },
};

const Dashboard: React.FC = () => {
  const { user, workspace } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [teamCount, setTeamCount] = useState<number | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user) return;
      setDashboardLoading(true);
      setDashboardError(null);
      try {
        const response = await api.get<DashboardData>("/api/dashboard");
        setDashboardData(response.data);
      } catch (err: any) {
        setDashboardError(
          err?.response?.data?.message ||
            err.message ||
            "Unable to load dashboard.",
        );
      } finally {
        setDashboardLoading(false);
      }
    };

    loadDashboard();
  }, [user, workspace?.id]);

  useEffect(() => {
    const loadProjectsAndTeam = async () => {
      if (!user) return;
      setProjectsLoading(true);
      try {
        const [projectsRes, usersRes] = await Promise.all([
          api.get<ProjectSummary[]>("/api/projects"),
          api.get<any[]>("/api/users"),
        ]);
        setProjects(projectsRes.data);
        setTeamCount(usersRes.data.length);
      } catch (err) {
        console.error("Failed to load projects for dashboard", err);
      } finally {
        setProjectsLoading(false);
      }
    };

    loadProjectsAndTeam();
  }, [user, workspace?.id]);

  const ongoingProjects: OngoingProject[] = useMemo(() => {
    return projects
      .filter((p) => p.status !== "completed")
      .map((p) => {
        const tasks = flattenProjectTasks(p);
        const doneCount = tasks.filter((t) => t.status === "completed").length;
        const progress =
          tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
        return { ...p, progress };
      })
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [projects]);

  const topProjects = ongoingProjects.slice(0, 5);
  const visibleHighPriorityTasks = dashboardData?.highPriorityTasks.slice(0, 5) ?? [];

  const today = new Date();
  const hour = today.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.fullName?.split(" ")[0] || "there";

  const stats = [
    {
      label: "Pending",
      value: dashboardData?.pending ?? 0,
      icon: Clock,
      color: "amber",
      sub: "awaiting action",
      onClick: () => navigate(`/${workspace?.id}/tasks`),
    },
    {
      label: "In Progress",
      value: dashboardData?.inProgress ?? 0,
      icon: TrendingUp,
      color: "blue",
      sub: "currently active",
      onClick: () => navigate(`/${workspace?.id}/tasks`),
    },
    {
      label: "Completed",
      value: dashboardData?.completed ?? 0,
      icon: CheckCircle2,
      color: "emerald",
      sub: "this period",
      onClick: () => navigate(`/${workspace?.id}/tasks`),
    },
    {
      label: "High Priority",
      value: dashboardData?.highPriorityTasks.length ?? 0,
      icon: AlertCircle,
      color: "red",
      sub: "needs attention",
      onClick: () => navigate(`/${workspace?.id}/tasks`),
    },
    {
      label: "Waiting Approval",
      value: dashboardData?.pendingLeaveRequests ?? 0,
      icon: UserCheck,
      color: "violet",
      sub: "leave requests",
      onClick: () => navigate(`/${workspace?.id}/leaverequests`),
    },
  ];

  return (
    <div className="max-w-6xl px-6 py-8 mx-auto lg:px-8 lg:py-10">
      {/* Greeting header */}
      <Eyebrow>{today.toDateString()}</Eyebrow>
      <h2 className="font-semibold mt-1 mb-1 text-[28px] tracking-tight text-slate-900">
        {greeting}, {firstName}
      </h2>
      <p className="text-slate-600 mb-8 text-[14px]">
        {dashboardLoading ? (
          <span className="text-slate-400">Loading your workspace…</span>
        ) : dashboardError ? (
          <span className="text-red-700">Unable to load dashboard data.</span>
        ) : (
          <>
            You have{" "}
            <span className="font-semibold text-slate-900">
              {dashboardData?.pending ?? 0} pending tasks
            </span>{" "}
            and{" "}
            <span className="font-semibold text-slate-900">
              {dashboardData?.highPriorityTasks.length ?? 0} high-priority items
            </span>{" "}
            requiring your attention.
          </>
        )}
      </p>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 mb-8 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((item) => {
          const c = STAT_COLORS[item.color];
          return (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`group p-4 text-left bg-white border rounded-lg border-slate-200 transition-all hover:shadow-md hover:-translate-y-0.5 ${c.border}`}
            >
              <div className="flex items-center justify-between">
                <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${c.bg}`}>
                  <item.icon className={`w-5 h-5 ${c.text}`} />
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-400" />
              </div>
              <div className={`mt-3 text-[26px] font-bold leading-none tracking-tight ${c.text}`}>
                {item.value}
              </div>
              <Eyebrow className="mt-2">{item.label}</Eyebrow>
              <div className="mt-0.5 text-slate-400 text-[11px]">{item.sub}</div>
            </button>
          );
        })}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* High priority tasks */}
        <div className="bg-white border rounded lg:col-span-2 border-slate-200">
          <div className="flex items-center px-5 py-4 border-b border-slate-200">
            <div>
              <Eyebrow>Your high priority tasks</Eyebrow>
              <div className="font-semibold mt-0.5 text-[15px] text-slate-900">
                Needs your attention
              </div>
            </div>
            {!dashboardLoading && dashboardData && (
              <span
                className="ml-auto inline-flex items-center gap-1.5 rounded bg-red-100 text-red-700 px-2 py-0.5 text-[10px] tracking-[0.05em] uppercase font-medium"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-700" />
                {dashboardData.highPriorityTasks.length} Critical
              </span>
            )}
          </div>

          <div className="p-5">
            {dashboardLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
                <div
                  className="text-[11px] text-slate-400 tracking-[0.1em] uppercase"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Fetching tasks
                </div>
              </div>
            ) : dashboardError ? (
              <div className="p-4 bg-red-50 border border-red-100 rounded flex items-center gap-3 text-red-700 text-[13px]">
                <AlertCircle className="flex-shrink-0 w-4 h-4" />
                <span>{dashboardError}</span>
              </div>
            ) : dashboardData && dashboardData.highPriorityTasks.length > 0 ? (
              <div>
                {visibleHighPriorityTasks.map((task, idx) => (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/${workspace?.id}/tasks`)}
                    className={`py-3.5 flex items-center gap-3 hover:bg-slate-50 cursor-pointer px-2 -mx-2 rounded ${
                      idx < visibleHighPriorityTasks.length - 1
                        ? "border-b border-slate-200"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 bg-blue-100 rounded">
                      <Zap className="w-4 h-4 text-blue-900" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px]">
                        <span className="font-semibold text-slate-900">
                          {task.title}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[12px] mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3 h-3" />
                          {task.companyName}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1.5">
                          <CalendarIcon className="w-3 h-3" />
                          Due {formatDate(task.dueDate)}
                        </span>
                      </div>
                    </div>
                    <span
                      className="rounded text-[10px] px-2 py-0.5 tracking-[0.05em] uppercase font-medium flex-shrink-0"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        background:
                          task.priority === "high"
                            ? "#FEE2E2"
                            : task.priority === "medium"
                              ? "#FEF3C7"
                              : "#EEF1F5",
                        color:
                          task.priority === "high"
                            ? "#B91C1C"
                            : task.priority === "medium"
                              ? "#B45309"
                              : "#94A3B8",
                      }}
                    >
                      {task.priority}
                    </span>
                    <div className="flex -space-x-1.5 flex-shrink-0">
                      {task.assignedUsers.slice(0, 3).map((u) => (
                        <div
                          key={u.id}
                          className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[9px] font-semibold text-slate-700"
                          title={u.fullName}
                        >
                          {u.fullName.charAt(0)}
                        </div>
                      ))}
                    </div>
                    <ChevronRight className="flex-shrink-0 w-4 h-4 text-slate-400" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-slate-100">
                  <CheckCircle2 className="w-6 h-6 text-slate-400" />
                </div>
                <div className="font-semibold text-[14px] text-slate-900 mb-1">
                  All caught up
                </div>
                <div className="text-slate-500 text-[12px] max-w-xs">
                  No high priority tasks require your attention right now.
                </div>
              </div>
            )}
          </div>
          {!dashboardLoading && !dashboardError && (
            <button
              onClick={() => navigate(`/${workspace?.id}/tasks`)}
              className="flex items-center justify-center w-full gap-1.5 py-3 text-[12px] font-medium text-blue-900 border-t border-slate-200 hover:bg-slate-50 transition-colors rounded-b"
            >
              View all tasks
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Recent activity / summary */}
        <div className="bg-white border rounded border-slate-200">
          <div className="px-5 py-4 border-b border-slate-200">
            <Eyebrow>Workspace summary</Eyebrow>
            <div className="font-semibold mt-0.5 text-[15px] text-slate-900">
              At a glance
            </div>
          </div>
          <div>
            {[
              {
                label: "Total tasks",
                value: dashboardData?.total ?? 0,
                sub: "across all statuses",
                icon: ListChecks,
                color: "blue",
              },
              {
                label: "Completion rate",
                value:
                  dashboardData && dashboardData.total > 0
                    ? Math.round(
                        (dashboardData.completed / dashboardData.total) * 100,
                      )
                    : 0,
                unit: "%",
                sub: "this period",
                icon: TrendingUp,
                color: "emerald",
              },
              {
                label: "Active projects",
                value: projectsLoading ? "…" : ongoingProjects.length,
                sub: "in progress or pending",
                icon: Building2,
                color: "amber",
              },
              {
                label: "Team members",
                value: teamCount ?? "…",
                sub: "in this workspace",
                icon: UsersIcon,
                color: "violet",
              },
            ].map((row, i) => {
              const c = STAT_COLORS[row.color];
              return (
                <div
                  key={row.label}
                  className={`px-5 py-3 flex items-center gap-3 ${
                    i < 3 ? "border-b border-slate-200" : ""
                  }`}
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded flex-shrink-0 ${c.bg}`}>
                    <row.icon className={`w-4 h-4 ${c.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-600 text-[12px]">{row.label}</div>
                    <div className="text-slate-400 text-[11px] mt-0.5">
                      {row.sub}
                    </div>
                  </div>
                  <div className="font-semibold text-[15px] text-slate-900 tracking-tight flex-shrink-0">
                    {row.value}
                    {row.unit && (
                      <span
                        className="text-slate-400 text-[11px] ml-0.5"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {row.unit}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Project progress snapshot */}
      <div className="bg-white border rounded border-slate-200 mt-6">
        <div className="flex items-center px-5 py-4 border-b border-slate-200">
          <div>
            <Eyebrow>Project progress snapshot</Eyebrow>
            <div className="font-semibold mt-0.5 text-[15px] text-slate-900">
              Ongoing work
            </div>
          </div>
          <button
            onClick={() => navigate(`/${workspace?.id}/project`)}
            className="flex items-center flex-shrink-0 gap-1 ml-auto text-[12px] font-medium text-blue-900 hover:text-blue-700"
          >
            View all
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5">
          {projectsLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
              <div
                className="text-[11px] text-slate-400 tracking-[0.1em] uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Fetching projects
              </div>
            </div>
          ) : topProjects.length > 0 ? (
            <div className="space-y-1">
              {topProjects.map((p, idx) => {
                const badge = dueDateBadge(p.dueDate);
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/${workspace?.id}/project/${p.id}/details`)}
                    className={`w-full text-left py-3.5 px-2 -mx-2 rounded hover:bg-slate-50 transition-colors ${
                      idx < topProjects.length - 1 ? "border-b border-slate-200" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center min-w-0 gap-2">
                        <span className="font-semibold text-[13px] text-slate-900 truncate">
                          {p.name}
                        </span>
                        <StatusPill status={p.status} />
                      </div>
                      <span
                        className={`text-[11px] font-medium flex-shrink-0 ${badge.tone}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all rounded-full bg-blue-900"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 w-9 text-right flex-shrink-0">
                        {p.progress}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-slate-100">
                <Building2 className="w-6 h-6 text-slate-400" />
              </div>
              <div className="font-semibold text-[14px] text-slate-900 mb-1">
                No ongoing projects
              </div>
              <div className="text-slate-500 text-[12px] max-w-xs">
                All projects are completed, or none have been created yet.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="p-5 mt-6 bg-white border rounded border-slate-200">
        <Eyebrow>Quick actions</Eyebrow>
        <div className="font-semibold mt-0.5 mb-4 text-[15px] text-slate-900">
          Jump to a module
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            {
              label: "Projects",
              sub: "Pipeline & construction",
              icon: Building2,
              path: "project",
            },
            { label: "Tasks", sub: "Assigned work", icon: CheckCircle2, path: "tasks" },
            { label: "Users", sub: "Team directory", icon: UsersIcon, path: "users" },
            {
              label: "Calendar",
              sub: "Schedule & leaves",
              icon: CalendarIcon,
              path: "calendar",
            },
          ].map((a) => (
            <button
              key={a.label}
              onClick={() => navigate(`/${workspace?.id}/${a.path}`)}
              className="flex items-start gap-3 p-3 text-left transition-colors border rounded border-slate-200 hover:bg-slate-50"
            >
              <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded bg-slate-100">
                <a.icon className="w-4 h-4 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[13px] text-slate-900">
                  {a.label}
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">{a.sub}</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 mt-1 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
