import React from "react";
import {
  Calendar,
  Users,
  ListChecks,
  TrendingUp,
  CheckCircle2,
  Circle,
  Mail,
  Plus,
  UserRound,
} from "lucide-react";
import { Project } from "../types";
import { Eyebrow } from "./ProjectSharedComponents";
import { flattenProjectTasks } from "./taskUtils";
import { useActivities } from "../hooks/useActivities";
import { useScheduleQuery } from "../hooks/useSchedule";
import { dtoToRows } from "./scheduleApi";

interface ProjectOverviewTabProps {
  project: Project;
  /** Switches the parent ProjectDetails page to another tab — used by this
   * tab's "View all ..." / "Invite Member" links instead of duplicating
   * those flows here. */
  onNavigateTab?: (tab: string) => void;
}

const PRIORITY_META: Record<string, { fg: string; label: string }> = {
  high: { fg: "#B91C1C", label: "High" },
  medium: { fg: "#B45309", label: "Medium" },
  low: { fg: "#64748B", label: "Low" },
};

const STATUS_META: Record<string, { fg: string; label: string }> = {
  pending: { fg: "#B45309", label: "Pending" },
  in_progress: { fg: "#1E3A8A", label: "In Progress" },
  on_hold: { fg: "#B91C1C", label: "On Hold" },
  completed: { fg: "#15803D", label: "Completed" },
};

/** Task-status buckets that make up the "Task Overview" donut — a status
 * (state) dataset, so it takes the app's existing status colors rather than
 * a generic categorical palette. Always rendered with a legend dot + label +
 * count, never color-alone. */
const DONUT_BUCKETS: { key: string; label: string; color: string; statuses: string[] }[] = [
  { key: "completed", label: "Completed", color: "#10b981", statuses: ["completed"] },
  { key: "in_progress", label: "In Progress", color: "#3b82f6", statuses: ["in_progress"] },
  { key: "to_do", label: "To Do", color: "#94a3b8", statuses: ["pending"] },
  { key: "blocked", label: "Blocked", color: "#f43f5e", statuses: ["on_hold"] },
];

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function dueDateInfo(dueDate?: string): { label: string; tone: string } | null {
  if (!dueDate) return null;
  const diffMs = new Date(dueDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  const days = Math.round(diffMs / 86400000);
  if (days < 0) return { label: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`, tone: "text-red-600" };
  if (days === 0) return { label: "Due today", tone: "text-amber-600" };
  return { label: `${days} day${days === 1 ? "" : "s"} remaining`, tone: "text-slate-500" };
}

/** Small local presentational card shell — every section in this tab shares
 * this same bordered-card language. */
const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = "",
  children,
}) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
    {children}
  </div>
);

const CardHeader: React.FC<{
  title: string;
  action?: { label: string; onClick: () => void };
}> = ({ title, action }) => (
  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
    <span className="font-semibold text-[14px] text-slate-900">{title}</span>
    {action && (
      <button
        onClick={action.onClick}
        className="text-[12px] font-medium text-blue-900 hover:underline whitespace-nowrap"
      >
        {action.label} &rarr;
      </button>
    )}
  </div>
);

/** Hand-rolled donut (no new chart dependency) — stroke-based ring segments
 * with a 2px surface gap between each, a hero total in the center, and a
 * native-tooltip on every segment. */
const TaskStatusDonut: React.FC<{
  counts: Record<string, number>;
  total: number;
}> = ({ counts, total }) => {
  const size = 168;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 0 ? 3 : 0;

  let offset = 0;
  const segments = DONUT_BUCKETS.map((bucket) => {
    const count = counts[bucket.key] || 0;
    const fraction = total > 0 ? count / total : 0;
    const length = Math.max(0, fraction * circumference - gap);
    const segment = { ...bucket, count, fraction, length, offset };
    offset += fraction * circumference;
    return segment;
  });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            segments
              .filter((s) => s.count > 0)
              .map((s) => (
                <circle
                  key={s.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${s.length} ${circumference - s.length}`}
                  strokeDashoffset={-s.offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  strokeLinecap="butt"
                >
                  <title>
                    {s.label}: {s.count} ({Math.round(s.fraction * 100)}%)
                  </title>
                </circle>
              ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold text-[32px] leading-none tracking-tight text-slate-900">
            {total}
          </span>
          <span className="text-[11px] text-slate-500 mt-1">Total Tasks</span>
        </div>
      </div>

      <div className="w-full space-y-2.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-[13px]">
            <span
              className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
              style={{ background: s.color }}
            />
            <span className="text-slate-600">{s.label}</span>
            <span className="ml-auto font-medium text-slate-900">
              {s.count} ({Math.round(s.fraction * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ProjectOverviewTab: React.FC<ProjectOverviewTabProps> = ({ project, onNavigateTab }) => {
  const allTasks = flattenProjectTasks(project);
  const total = project.tasksCount ?? allTasks.length;
  const completedCount = allTasks.filter((t) => (t.status || "pending") === "completed").length;
  const remaining = Math.max(0, total - completedCount);
  const progress = project.progress ?? (total > 0 ? Math.round((completedCount / total) * 100) : 0);
  const deadline = dueDateInfo(project.dueDate);
  const projectManager = project.assignees?.[0];
  const priority = PRIORITY_META[project.priority || "medium"] || PRIORITY_META.medium;
  const status = STATUS_META[project.status] || { fg: "#475569", label: project.status };

  const donutCounts = DONUT_BUCKETS.reduce<Record<string, number>>((acc, bucket) => {
    acc[bucket.key] = allTasks.filter((t) => bucket.statuses.includes(t.status || "pending")).length;
    return acc;
  }, {});

  const activitiesQuery = useActivities({ projectId: project.id });
  const recentActivity = (activitiesQuery.data || []).slice(0, 4);

  const scheduleQuery = useScheduleQuery(String(project.id));
  const milestones = (dtoToRows(scheduleQuery.data || []) || [])
    .filter((row) => row.duration.trim() === "0" && row.startDate.trim() !== "")
    .map((row) => ({ id: row.id, name: row.taskName, date: new Date(row.startDate) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const today = new Date().setHours(0, 0, 0, 0);
  const nextUpcomingIdx = milestones.findIndex((m) => m.date.getTime() >= today);

  const teamMembers = project.assignees || [];

  return (
    <div className="space-y-4">
      {/* Stat row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <Eyebrow>Progress</Eyebrow>
          <div className="mt-2 font-bold text-[26px] tracking-tight text-slate-900">
            {progress}%
          </div>
          <div className="w-full h-1.5 mt-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full transition-all rounded-full bg-blue-600"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <div className="mt-2 text-[12px] text-slate-500">
            {completedCount} of {total} tasks completed
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <Eyebrow>Tasks</Eyebrow>
            <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50">
              <ListChecks className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <div className="mt-2 font-bold text-[26px] tracking-tight text-slate-900">
            {completedCount} <span className="text-slate-300">/</span> {total}
          </div>
          <div className="mt-2 text-[12px] text-slate-500">{remaining} tasks remaining</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <Eyebrow>Team</Eyebrow>
            <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-50">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="mt-2 font-bold text-[26px] tracking-tight text-slate-900">
            {project.membersCount ?? teamMembers.length}
          </div>
          <div className="mt-2 text-[12px] text-slate-500">Members</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <Eyebrow>Due Date</Eyebrow>
            <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg bg-amber-50">
              <Calendar className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="mt-2 font-bold text-[17px] tracking-tight text-slate-900">
            {project.dueDate ? formatDate(project.dueDate) : "Not set"}
          </div>
          {deadline && (
            <div className={`mt-2 text-[12px] ${deadline.tone}`}>{deadline.label}</div>
          )}
        </Card>
      </div>

      {/* Summary + Task Overview + Milestones */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Project Summary" />
          <div className="p-5 space-y-4">
            <p className="text-[13px] text-slate-600 leading-relaxed">
              {project.description || "No description provided."}
            </p>
            <div className="pt-1 space-y-3 text-[13px] border-t border-slate-100">
              <div className="flex items-center justify-between pt-3">
                <span className="text-slate-500">Project Manager</span>
                {projectManager ? (
                  <span className="flex items-center gap-2 font-medium text-slate-900">
                    <span className="flex items-center justify-center flex-shrink-0 w-6 h-6 text-[10px] font-semibold text-white rounded-full bg-blue-900">
                      {initials(projectManager.fullName)}
                    </span>
                    {projectManager.fullName}
                  </span>
                ) : (
                  <span className="text-slate-400">Unassigned</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Start Date</span>
                <span className="font-medium text-slate-900">
                  {project.createdAt ? formatDate(project.createdAt) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Priority</span>
                <span className="flex items-center gap-1.5 font-medium text-slate-900">
                  <span className="w-2 h-2 rounded-full" style={{ background: priority.fg }} />
                  {priority.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status</span>
                <span className="flex items-center gap-1.5 font-medium text-slate-900">
                  <span className="w-2 h-2 rounded-full" style={{ background: status.fg }} />
                  {status.label}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Task Overview"
            action={{ label: "View all tasks", onClick: () => onNavigateTab?.("tasks") }}
          />
          <div className="p-5">
            <TaskStatusDonut counts={donutCounts} total={total} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Upcoming Milestones"
            action={{ label: "View full schedule", onClick: () => onNavigateTab?.("schedule") }}
          />
          <div className="p-5">
            {milestones.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-[12px]">
                No milestones scheduled yet.
              </div>
            ) : (
              <div className="space-y-0">
                {milestones.slice(0, 4).map((m, idx) => {
                  const isDone = nextUpcomingIdx === -1 ? true : idx < nextUpcomingIdx;
                  const isCurrent = idx === nextUpcomingIdx;
                  const isLast = idx === milestones.slice(0, 4).length - 1;
                  return (
                    <div key={m.id} className="flex gap-3">
                      <div className="flex flex-col items-center flex-shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : isCurrent ? (
                          <span className="w-4 h-4 rounded-full border-2 border-blue-600 bg-blue-50 flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-300" />
                        )}
                        {!isLast && <div className="w-px flex-1 my-1 bg-slate-200 min-h-[20px]" />}
                      </div>
                      <div className={`min-w-0 ${isLast ? "" : "pb-4"}`}>
                        <div className="text-[13px] font-medium text-slate-900 truncate">
                          {m.name}
                        </div>
                        <div className="text-[12px] text-slate-500 mt-0.5">
                          {formatDate(m.date)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Activity + Team Members */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent Activity" />
          <div className="p-5">
            {activitiesQuery.isLoading ? (
              <div className="py-8 text-center text-slate-400 text-[12px]">Loading activity...</div>
            ) : recentActivity.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-[12px]">
                No activity recorded for this project yet.
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-[11px] font-semibold text-white rounded-full bg-slate-400">
                      {activity.user ? initials(activity.user.fullName) : <UserRound className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <span className="text-[13px] text-slate-700">{activity.description}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0 pt-1">
                      {timeAgo(activity.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Team Members"
            action={{ label: "View all team", onClick: () => onNavigateTab?.("team") }}
          />
          <div className="p-5 space-y-3">
            {teamMembers.slice(0, 4).map((member) => (
              <div key={member.id} className="flex items-center gap-2.5">
                <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-[11px] font-semibold text-white rounded-full bg-blue-900">
                  {initials(member.fullName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-slate-900 truncate">
                    {member.fullName}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {member.jobPosition || "Member"}
                  </div>
                </div>
                {member.email && (
                  <a
                    href={`mailto:${member.email}`}
                    className="flex-shrink-0 p-1.5 text-slate-400 hover:text-blue-900 hover:bg-slate-50 rounded transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
            {teamMembers.length === 0 && (
              <div className="py-4 text-center text-slate-400 text-[12px]">No members yet.</div>
            )}

            <button
              onClick={() => onNavigateTab?.("team")}
              className="flex items-center w-full gap-2.5 pt-3 mt-1 border-t border-slate-100 text-left"
            >
              <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 border rounded-full border-dashed border-slate-300 text-slate-400">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[13px] font-medium text-slate-700">Invite Member</div>
                <div className="text-[11px] text-slate-400">Add to project</div>
              </div>
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ProjectOverviewTab;
