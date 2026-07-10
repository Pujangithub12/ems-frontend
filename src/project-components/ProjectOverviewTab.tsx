import React from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import {
  Calendar,
  Users,
  ListChecks,
  Clock,
  User as UserIcon,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Project } from "../types";
import { Eyebrow } from "./ProjectSharedComponents";
import { flattenProjectTasks } from "./taskUtils";

interface ProjectOverviewTabProps {
  project: Project;
}

const PRIORITY_COLORS: Record<string, { bg: string; fg: string }> = {
  high: { bg: "#FEE2E2", fg: "#B91C1C" },
  medium: { bg: "#FEF3C7", fg: "#B45309" },
  low: { bg: "#EEF1F5", fg: "#94A3B8" },
};

function dueDateInfo(dueDate?: string): { label: string; tone: string } | null {
  if (!dueDate) return null;
  const diffMs = new Date(dueDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  const days = Math.round(diffMs / 86400000);
  if (days < 0) return { label: `Overdue by ${Math.abs(days)}d`, tone: "text-red-700" };
  if (days === 0) return { label: "Due today", tone: "text-amber-700" };
  if (days <= 7) return { label: `${days}d left`, tone: "text-amber-700" };
  return { label: `${days}d left`, tone: "text-blue-700" };
}

const ProjectOverviewTab: React.FC<ProjectOverviewTabProps> = ({ project }) => {
  const ongoingTasks = flattenProjectTasks(project).filter(
    (t) => (t.status || "pending") === "in_progress",
  );
  const deadline = dueDateInfo(project.dueDate);
  const progress = project.progress ?? 0;
  const isComplete = progress >= 100;

  const statCards = [
    {
      label: "Total Tasks",
      value: project.tasksCount,
      icon: ListChecks,
      sub: "Tasks",
      subTone: "text-slate-400",
    },
    {
      label: "Team Members",
      value: project.membersCount,
      icon: Users,
      sub: "Members",
      subTone: "text-slate-400",
    },
    {
      label: "Deadline",
      value: project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "Not set",
      icon: Calendar,
      sub: deadline?.label,
      subTone: deadline?.tone || "text-slate-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero: Progress + stats */}
      <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-5">
          <div className="flex items-center gap-5 p-6 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/60 lg:col-span-2">
            <div className="relative w-28 h-28 shrink-0">
              <CircularProgressbar
                value={progress}
                text={`${progress}%`}
                styles={buildStyles({
                  pathColor: isComplete ? "#059669" : "#1e3a8a",
                  trailColor: "#e2e8f0",
                  textColor: "#0f172a",
                  textSize: "26px",
                  pathTransitionDuration: 0.6,
                })}
              />
            </div>
            <div className="min-w-0">
              <Eyebrow>Project Progress</Eyebrow>
              <div className="flex items-center gap-1.5 mt-1">
                {isComplete && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                <span className="font-bold text-[16px] text-slate-900">
                  {isComplete
                    ? "Complete"
                    : progress >= 50
                      ? "On track"
                      : "Getting started"}
                </span>
              </div>
              <p className="text-slate-500 text-[12px] mt-2 leading-relaxed line-clamp-3">
                {project.description || "No description provided."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 lg:col-span-3">
            {statCards.map((stat) => (
              <div key={stat.label} className="p-6">
                <Eyebrow>{stat.label}</Eyebrow>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-full bg-blue-50">
                    <stat.icon className="w-[18px] h-[18px] text-blue-700" />
                  </div>
                  <span className="font-bold text-[26px] tracking-tight text-slate-900 leading-none">
                    {stat.value}
                  </span>
                </div>
                {stat.sub && (
                  <div className={`mt-2 text-[12px] font-medium ${stat.subTone}`}>
                    {stat.sub}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ongoing Tasks */}
      <div className="bg-white border rounded-md border-slate-200 overflow-hidden">
        <div className="flex items-center px-5 py-4 border-b border-slate-200">
          <div>
            <Eyebrow>Ongoing tasks</Eyebrow>
            <div className="font-semibold mt-0.5 text-[15px] text-slate-900">
              Currently in progress
            </div>
          </div>
          <span
            className="ml-auto inline-flex items-center gap-1.5 rounded bg-blue-100 text-blue-900 px-2 py-0.5 text-[10px] tracking-[0.05em] uppercase font-medium"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-900" />
            {ongoingTasks.length} Active
          </span>
        </div>

        <div className="p-5">
          {ongoingTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-slate-100">
                <Clock className="w-6 h-6 text-slate-400" />
              </div>
              <div className="font-semibold text-[14px] text-slate-900 mb-1">
                Nothing in progress
              </div>
              <div className="text-slate-500 text-[12px] max-w-xs">
                Tasks moved to "In Progress" on the Task board will show up here.
              </div>
            </div>
          ) : (
            <div>
              {ongoingTasks.map((task, idx) => {
                const priority = PRIORITY_COLORS[task.priority || "medium"] || PRIORITY_COLORS.medium;
                return (
                  <div
                    key={task.id}
                    className={`py-3.5 flex items-center gap-3 px-2 -mx-2 rounded hover:bg-slate-50 ${
                      idx < ongoingTasks.length - 1 ? "border-b border-slate-200" : ""
                    }`}
                  >
                    <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 bg-amber-100 rounded">
                      <Zap className="w-4 h-4 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-slate-900 truncate">
                        {task.title}
                      </div>
                      <div className="text-slate-500 text-[12px] mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <UserIcon className="w-3 h-3" />
                          {task.assignedUsers && task.assignedUsers.length > 0
                            ? task.assignedUsers[0]?.fullName
                            : "Unassigned"}
                        </span>
                        {task.dueDate && (
                          <>
                            <span>&middot;</span>
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" />
                              Due {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {task.priority && (
                      <span
                        className="rounded text-[10px] px-2 py-0.5 tracking-[0.05em] uppercase font-medium flex-shrink-0"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          background: priority.bg,
                          color: priority.fg,
                        }}
                      >
                        {task.priority}
                      </span>
                    )}
                    <div className="items-center hidden gap-2 w-28 shrink-0 sm:flex">
                      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full transition-all rounded-full bg-amber-400"
                          style={{ width: `${task.progress ?? 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 w-7 text-right">
                        {task.progress ?? 0}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectOverviewTab;
