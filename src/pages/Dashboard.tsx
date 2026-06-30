import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
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
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

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

const Dashboard: React.FC = () => {
  const { user, workspace } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

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
      accent: "text-amber-700",
      sub: "awaiting action",
    },
    {
      label: "In Progress",
      value: dashboardData?.inProgress ?? 0,
      icon: TrendingUp,
      accent: "text-blue-900",
      sub: "currently active",
    },
    {
      label: "Completed",
      value: dashboardData?.completed ?? 0,
      icon: CheckCircle2,
      accent: "text-green-700",
      sub: "this period",
    },
    {
      label: "High Priority",
      value: dashboardData?.highPriorityTasks.length ?? 0,
      icon: AlertCircle,
      accent: "text-red-700",
      sub: "needs attention",
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
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.label}
            className="p-5 transition-colors bg-white border rounded border-slate-200 hover:bg-slate-50"
          >
            <Eyebrow>{item.label}</Eyebrow>
            <div className="flex items-baseline gap-1 mt-2 font-semibold leading-none tracking-tight">
              <span className={`text-[30px] ${item.accent}`}>{item.value}</span>
            </div>
            <div className="mt-2 text-slate-500 text-[12px]">{item.sub}</div>
          </div>
        ))}
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
                {dashboardData.highPriorityTasks.map((task, idx) => (
                  <div
                    key={task.id}
                    className={`py-3.5 flex items-center gap-3 hover:bg-slate-50 cursor-pointer px-2 -mx-2 rounded ${
                      idx < dashboardData.highPriorityTasks.length - 1
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
              },
              {
                label: "Active projects",
                value: "—",
                sub: "check Projects module",
              },
              {
                label: "Team members",
                value: "—",
                sub: "check Users module",
              },
            ].map((row, i) => (
              <div
                key={row.label}
                className={`px-5 py-3 flex items-center justify-between ${
                  i < 3 ? "border-b border-slate-200" : ""
                }`}
              >
                <div>
                  <div className="text-slate-600 text-[12px]">{row.label}</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    {row.sub}
                  </div>
                </div>
                <div className="font-semibold text-[15px] text-slate-900 tracking-tight">
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
            ))}
          </div>
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
            },
            { label: "Tasks", sub: "Assigned work", icon: CheckCircle2 },
            { label: "Users", sub: "Team directory", icon: UsersIcon },
            { label: "Calendar", sub: "Schedule & leaves", icon: CalendarIcon },
          ].map((a) => (
            <button
              key={a.label}
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
