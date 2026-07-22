import React, { useState } from "react";
import {
  ListTodo,
  UserRound,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  Clock,
  Hourglass,
} from "lucide-react";
import { useTasks } from "../hooks/useTasks";
import { useAuth } from "../context/AuthProvider";
import AssignedTasks from "./AssignedTasks"; // Adjust path as needed
import MyTasks from "./MyTasks"; // Adjust path as needed
import CompletedTasks from "./CompletedTasks";

type TabKey = "assigned" | "my" | "completed";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "assigned", label: "Assigned Tasks", icon: ListTodo },
  { key: "my", label: "My Tasks", icon: UserRound },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

const TasksPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("assigned");
  const { user } = useAuth();

  const { data: summaryTasks = [] } = useTasks();

  const totalTasks = summaryTasks.length;
  const doneCount = summaryTasks.filter((t) => t.status === "completed").length;
  const myTasksCount = summaryTasks.filter((t) =>
    t.assignedUsers?.some((u) => String(u.id) === user?.id),
  ).length;
  const tabCounts: Record<TabKey, number> = {
    assigned: totalTasks,
    my: myTasksCount,
    completed: doneCount,
  };
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
    <div className="flex flex-col min-h-0">
      {/* Overall Progress / Total Tasks / In Progress / Pending / Overdue summary */}
      <div className="grid flex-shrink-0 grid-cols-2 gap-3 px-6 py-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="p-3 bg-white border rounded-lg border-slate-200">
          <div className="flex items-start justify-between">
            <span className="text-[12px] font-medium text-slate-500">Overall Progress</span>
            <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg bg-blue-50">
              <CheckCircle2 className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <div className="mt-2 text-[21px] font-bold leading-none tracking-tight text-slate-900">
            {overallProgress}%
          </div>
          <div className="mt-1 text-slate-400 text-[12px]">{doneCount} of {totalTasks} done</div>
        </div>

        <div className="p-3 bg-white border rounded-lg border-slate-200">
          <div className="flex items-start justify-between">
            <span className="text-[12px] font-medium text-slate-500">Total Tasks</span>
            <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg bg-slate-100">
              <ListChecks className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <div className="mt-2 text-[21px] font-bold leading-none tracking-tight text-slate-900">
            {totalTasks}
          </div>
          <div className="mt-1 text-slate-400 text-[12px]">across all projects</div>
        </div>

        <div className="p-3 bg-white border rounded-lg border-slate-200">
          <div className="flex items-start justify-between">
            <span className="text-[12px] font-medium text-slate-500">In Progress</span>
            <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg bg-amber-50">
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="mt-2 text-[21px] font-bold leading-none tracking-tight text-slate-900">
            {inProgressCount}
          </div>
          <div className="mt-1 text-slate-400 text-[12px]">active right now</div>
        </div>

        <div className="p-3 bg-white border rounded-lg border-slate-200">
          <div className="flex items-start justify-between">
            <span className="text-[12px] font-medium text-slate-500">Pending</span>
            <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg bg-orange-50">
              <Hourglass className="w-4 h-4 text-orange-700" />
            </div>
          </div>
          <div className="mt-2 text-[21px] font-bold leading-none tracking-tight text-slate-900">
            {pendingCount}
          </div>
          <div className="mt-1 text-slate-400 text-[12px]">waiting to start</div>
        </div>

        <div className="p-3 bg-white border rounded-lg border-slate-200">
          <div className="flex items-start justify-between">
            <span className="text-[12px] font-medium text-slate-500">Overdue</span>
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 ${
                overdueCount > 0 ? "bg-red-50" : "bg-slate-100"
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 ${overdueCount > 0 ? "text-red-700" : "text-slate-400"}`}
              />
            </div>
          </div>
          <div
            className={`mt-2 text-[21px] font-bold leading-none tracking-tight ${
              overdueCount > 0 ? "text-red-600" : "text-slate-900"
            }`}
          >
            {overdueCount}
          </div>
          <div className="mt-1 text-slate-400 text-[12px]">
            {overdueCount > 0 ? "needs attention" : "all on track"}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center flex-shrink-0 gap-1 px-6 overflow-x-auto border-b border-slate-200 no-scrollbar">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 whitespace-nowrap transition-colors ${
                isActive
                  ? "text-slate-900 font-semibold"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              style={{ padding: "10px 14px", fontSize: 13 }}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              <span
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {tabCounts[tab.key]}
              </span>
              <span
                className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-slate-900 transition-opacity duration-150 ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
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
