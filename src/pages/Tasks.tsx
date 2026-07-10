import React, { useState } from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import {
  ClipboardList,
  UserRound,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  Clock,
  Hourglass,
} from "lucide-react";
import { useTasks } from "../hooks/useTasks";
import AssignedTasks from "./AssignedTasks"; // Adjust path as needed
import MyTasks from "./MyTasks"; // Adjust path as needed
import CompletedTasks from "./CompletedTasks";

type TabKey = "assigned" | "my" | "completed";

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

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "assigned", label: "Assigned Tasks", icon: ClipboardList },
  { key: "my", label: "My Tasks", icon: UserRound },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

const TasksPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("assigned");

  const { data: summaryTasks = [] } = useTasks();

  const totalTasks = summaryTasks.length;
  const doneCount = summaryTasks.filter((t) => t.status === "completed").length;
  const overallProgress = totalTasks
    ? Math.round((doneCount / totalTasks) * 100)
    : 0;
  const overdueCount = summaryTasks.filter((t) => {
    if (t.status === "completed" || !t.dueDate) return false;
    return new Date(t.dueDate).getTime() < new Date(new Date().toDateString()).getTime();
  }).length;
  const inProgressCount = summaryTasks.filter((t) => t.status === "in_progress").length;
  const pendingCount = summaryTasks.filter((t) => t.status === "pending").length;

  return (
    <div className="flex flex-col min-h-0 overflow-hidden bg-white border rounded-md shadow-sm border-slate-200">
      {/* Tab Bar */}
      <div className="flex items-center flex-shrink-0 gap-1 px-6 pt-4 overflow-x-auto border-b border-slate-200 no-scrollbar">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 whitespace-nowrap transition-colors ${
                isActive
                  ? "text-blue-900 font-semibold"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              style={{ padding: "10px 14px", fontSize: 13 }}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              <span
                className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-blue-900 transition-opacity duration-150 ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Overall Progress / Total Tasks / In Progress / Pending / Overdue summary */}
      <div className="grid flex-shrink-0 grid-cols-1 divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-5 sm:divide-y-0 sm:divide-x bg-slate-50/70">
        <div className="flex items-center gap-4 px-6 py-5">
          <div className="relative flex-shrink-0 w-14 h-14">
            <CircularProgressbar
              value={overallProgress}
              text={`${overallProgress}%`}
              styles={buildStyles({
                pathColor: "#1e3a8a",
                trailColor: "#DBEAFE",
                textColor: "#0f172a",
                textSize: "28px",
                pathTransitionDuration: 0.6,
              })}
            />
          </div>
          <div className="min-w-0">
            <Eyebrow>Overall Progress</Eyebrow>
            <div className="font-semibold text-[13px] text-slate-900 mt-1">
              {doneCount} of {totalTasks} done
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-5">
          <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-full bg-blue-50">
            <ListChecks className="w-[18px] h-[18px] text-blue-700" />
          </div>
          <div>
            <Eyebrow>Total Tasks</Eyebrow>
            <div className="font-bold text-[22px] tracking-tight text-slate-900 leading-none mt-1.5">
              {totalTasks}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-5">
          <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-full bg-blue-50">
            <Clock className="w-[18px] h-[18px] text-blue-700" />
          </div>
          <div>
            <Eyebrow>In Progress</Eyebrow>
            <div className="font-bold text-[22px] tracking-tight text-slate-900 leading-none mt-1.5">
              {inProgressCount}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-5">
          <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-full bg-amber-50">
            <Hourglass className="w-[18px] h-[18px] text-amber-700" />
          </div>
          <div>
            <Eyebrow>Pending</Eyebrow>
            <div className="font-bold text-[22px] tracking-tight text-slate-900 leading-none mt-1.5">
              {pendingCount}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-5">
          <div
            className={`flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-full ${
              overdueCount > 0 ? "bg-red-50" : "bg-slate-100"
            }`}
          >
            <AlertTriangle
              className={`w-[18px] h-[18px] ${
                overdueCount > 0 ? "text-red-600" : "text-slate-400"
              }`}
            />
          </div>
          <div>
            <Eyebrow>Overdue</Eyebrow>
            <div
              className={`font-bold text-[22px] tracking-tight leading-none mt-1.5 ${
                overdueCount > 0 ? "text-red-600" : "text-slate-900"
              }`}
            >
              {overdueCount}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto bg-[#F6F7F9] no-scrollbar">
        {activeTab === "assigned" ? (
          <AssignedTasks />
        ) : activeTab === "my" ? (
          <MyTasks />
        ) : (
          <CompletedTasks />
        )}
      </div>
    </div>
  );
};

export default TasksPage;
