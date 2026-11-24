import React, { Suspense, lazy, useMemo, useState } from "react";
import {
  ListTodo,
  UserRound,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  Clock,
  Hourglass,
  Loader2,
} from "lucide-react";
import { useTasks } from "../hooks/useTasks";
import { useAuth } from "../../../context/AuthProvider";
import AssignedTasks from "./AssignedTasks"; // default tab — loaded up front
// The other two tabs are only downloaded when first opened.
const MyTasks = lazy(() => import("./MyTasks"));
const CompletedTasks = lazy(() => import("./CompletedTasks"));

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

  // One pass over the task list for every summary number (instead of seven separate filters per render).
  const { totalTasks, doneCount, tabCounts, overallProgress, overdueCount, inProgressCount, pendingCount } = useMemo(() => {
    const startOfToday = new Date(new Date().toDateString()).getTime();
    let done = 0;
    let mine = 0;
    let overdue = 0;
    let inProgress = 0;
    let pending = 0;
    for (const t of summaryTasks) {
      if (t.status === "completed") {
        done++;
        continue;
      }
      if (t.assignedUsers?.some((u) => String(u.id) === user?.id)) mine++;
      if (t.dueDate && new Date(t.dueDate).getTime() < startOfToday) overdue++;
      if (t.status === "in_progress") inProgress++;
      else if (t.status === "to_do") pending++;
    }
    const total = summaryTasks.length;
    return {
      totalTasks: total,
      doneCount: done,
      tabCounts: { assigned: total - done, my: mine, completed: done } as Record<TabKey, number>,
      overallProgress: total ? Math.round((done / total) * 100) : 0,
      overdueCount: overdue,
      inProgressCount: inProgress,
      pendingCount: pending,
    };
  }, [summaryTasks, user?.id]);

  const stats = [
    { label: "In Progress", value: inProgressCount, hint: "active right now", icon: Clock, tone: "text-blue-800 bg-blue-50" },
    { label: "To Do", value: pendingCount, hint: "waiting to start", icon: Hourglass, tone: "text-amber-700 bg-amber-50" },
    {
      label: "Overdue",
      value: overdueCount,
      hint: overdueCount > 0 ? "needs attention" : "all on track",
      icon: AlertTriangle,
      tone: overdueCount > 0 ? "text-red-700 bg-red-50" : "text-slate-500 bg-slate-100",
      alert: overdueCount > 0,
    },
    { label: "Total Tasks", value: totalTasks, hint: "in this organization", icon: ListChecks, tone: "text-slate-600 bg-slate-100" },
  ];

  return (
    <div className="flex flex-col w-full min-h-full overflow-hidden bg-slate-50/50">
      {/* Summary: overall progress + key counts */}
      <div className="flex-shrink-0 px-6 pt-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
          <div className="flex items-center gap-4 p-4 bg-white border shadow-sm rounded-xl border-slate-200">
            <div
              className="relative flex items-center justify-center flex-shrink-0 w-14 h-14 rounded-full"
              style={{ background: `conic-gradient(#1e3a8a ${overallProgress * 3.6}deg, #e2e8f0 0deg)` }}
            >
              <div className="flex items-center justify-center w-11 h-11 bg-white rounded-full">
                <span className="text-[13px] font-bold text-slate-900">{overallProgress}%</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-slate-500">Overall Progress</div>
              <div className="mt-0.5 text-[15px] font-semibold text-slate-900">
                {doneCount} of {totalTasks} tasks done
              </div>
              <div className="flex items-center gap-1 mt-1 text-[12px] text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> completed tasks live in the Completed tab
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="p-3 bg-white border shadow-sm rounded-xl border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center justify-center w-6 h-6 rounded-md ${s.tone}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[12px] font-medium text-slate-500 truncate">{s.label}</span>
                  </div>
                  <div className={`mt-2 text-[22px] font-bold leading-none ${s.alert ? "text-red-600" : "text-slate-900"}`}>
                    {s.value}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400 truncate">{s.hint}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center flex-shrink-0 gap-1 px-6 mt-4 overflow-x-auto border-b no-scrollbar border-slate-200 bg-slate-50/60">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? "border-slate-900 text-slate-900 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
              style={{ padding: "13px 14px", fontSize: 13, marginBottom: -1 }}
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
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {activeTab === "assigned" ? (
          <AssignedTasks />
        ) : (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
              </div>
            }
          >
            {activeTab === "my" ? <MyTasks /> : <CompletedTasks />}
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default TasksPage;
