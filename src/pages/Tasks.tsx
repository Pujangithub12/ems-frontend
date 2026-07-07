import React, { useEffect, useState } from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import AssignedTasks from "./AssignedTasks"; // Adjust path as needed
import MyTasks from "./MyTasks"; // Adjust path as needed
import CompletedTasks from "./CompletedTasks";

type SummaryTask = { status: string; progress: number; dueDate: string };

const TasksPage: React.FC = () => {
  const { workspace } = useAuth();
  const [activeTab, setActiveTab] = useState<"assigned" | "my" | "completed">(
    "assigned",
  );

  const [summaryTasks, setSummaryTasks] = useState<SummaryTask[]>([]);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const res = await api.get<SummaryTask[]>("/api/tasks");
        setSummaryTasks(Array.isArray(res.data) ? res.data : []);
      } catch {
        setSummaryTasks([]);
      }
    };
    loadSummary();
  }, [workspace?.id]);

  const totalTasks = summaryTasks.length;
  const doneCount = summaryTasks.filter((t) => t.status === "completed").length;
  const overallProgress = totalTasks
    ? Math.round((doneCount / totalTasks) * 100)
    : 0;
  const overdueCount = summaryTasks.filter((t) => {
    if (t.status === "completed" || !t.dueDate) return false;
    return new Date(t.dueDate).getTime() < new Date(new Date().toDateString()).getTime();
  }).length;

  return (
    <div className="space-y-4">
      {/* Overall Progress Summary */}
      <div className="flex justify-end">
        <div className="flex items-center gap-6 px-6 py-4 bg-white border rounded-md border-slate-200">
          <div className="relative flex-shrink-0 w-16 h-16">
            <CircularProgressbar
              value={overallProgress}
              text={`${overallProgress}%`}
              styles={buildStyles({
                pathColor: "#1e3a8a",
                trailColor: "#DBEAFE",
                textColor: "#0f172a",
                textSize: "26px",
                pathTransitionDuration: 0.6,
              })}
            />
          </div>
          <div>
            <div className="font-semibold text-[13px] text-slate-900">
              Overall Progress
            </div>
            <div className="text-slate-500 text-[12px] mt-0.5">
              {doneCount} of {totalTasks} done
            </div>
          </div>
          <div className="w-px h-10 bg-slate-200" />
          <div>
            <div className="font-bold text-[20px] text-slate-900 leading-none">
              {totalTasks}
            </div>
            <div className="text-slate-500 text-[12px] mt-1">Total Tasks</div>
          </div>
          <div className="w-px h-10 bg-slate-200" />
          <div>
            <div className="font-bold text-[20px] text-slate-900 leading-none">
              {overdueCount}
            </div>
            <div className="text-slate-500 text-[12px] mt-1">Overdue</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col min-h-0 overflow-hidden bg-white border rounded-md border-slate-200">
      {/* Tab Bar */}
      <div className="flex items-end flex-shrink-0 gap-1 px-6 pt-3 overflow-x-auto border-b border-slate-200 no-scrollbar">
        <button
          onClick={() => setActiveTab("assigned")}
          className={`relative flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === "assigned"
              ? "text-slate-900 font-medium"
              : "text-slate-500 hover:text-slate-700"
          }`}
          style={{ padding: "10px 14px", fontSize: 13 }}
        >
          Assigned Tasks
          <span
            className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-blue-900 transition-opacity duration-150 ${
              activeTab === "assigned" ? "opacity-100" : "opacity-0"
            }`}
          />
        </button>

        <button
          onClick={() => setActiveTab("my")}
          className={`relative flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === "my"
              ? "text-slate-900 font-medium"
              : "text-slate-500 hover:text-slate-700"
          }`}
          style={{ padding: "10px 14px", fontSize: 13 }}
        >
          My Tasks
          <span
            className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-blue-900 transition-opacity duration-150 ${
              activeTab === "my" ? "opacity-100" : "opacity-0"
            }`}
          />
        </button>

        <button
          onClick={() => setActiveTab("completed")}
          className={`relative flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === "completed"
              ? "text-slate-900 font-medium"
              : "text-slate-500 hover:text-slate-700"
          }`}
          style={{ padding: "10px 14px", fontSize: 13 }}
        >
          Completed
          <span
            className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-blue-900 transition-opacity duration-150 ${
              activeTab === "completed" ? "opacity-100" : "opacity-0"
            }`}
          />
        </button>
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
    </div>
  );
};

export default TasksPage;
