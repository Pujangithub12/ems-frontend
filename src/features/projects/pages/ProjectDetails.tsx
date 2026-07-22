import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CheckSquare,
  FolderOpen,
  Users,
  Loader2,
  AlertCircle,
  Calendar,
  ShoppingCart,
  Zap,
  Package,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/errors";
import { useProject } from "../hooks/useProjects";
import {
  ProjectOverviewTab,
  ProjectScheduleTab,
  ProjectTasksTab,
  ProjectDocumentsTab,
  ProjectProcurementTab,
  ProjectPerformanceTab,
  ProjectInventoryTab,
  ProjectTeamTab,
  StatusPill,
  PriorityPill,
  formatDate,
  dueDateInfo,
} from "../components/tabs";
import { flattenProjectTasks } from "../../tasks/utils/taskUtils";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "tasks", label: "Task", icon: CheckSquare },
  { id: "documents", label: "Documents", icon: FolderOpen },
  { id: "procurement", label: "Procurement", icon: ShoppingCart },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "performance", label: "Energy Performance", icon: Zap },
  { id: "team", label: "Team", icon: Users },
];

const ProjectDetails: React.FC = () => {
  const { workspaceId, id } = useParams<{ workspaceId: string; id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const {
    data: project,
    isLoading: loading,
    isError,
    error: queryError,
    refetch,
  } = useProject(id);
  const error = isError ? getErrorMessage(queryError, "Unable to load project.") : null;
  const loadProject = async () => {
    await refetch();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
        <div
          className="text-[11px] text-slate-400 tracking-[0.1em] uppercase"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Loading project
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-center">
        <div className="flex items-center justify-center w-12 h-12 mb-1 bg-red-100 rounded">
          <AlertCircle className="w-6 h-6 text-red-700" />
        </div>
        <h2 className="font-semibold text-[15px] text-slate-900">
          Project not found
        </h2>
        <p className="text-slate-500 text-[12px] max-w-xs mb-4">
          {error || "The project you are looking for does not exist."}
        </p>
        <button
          onClick={() => navigate(`/${workspaceId}/project`)}
          className="px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  const deadline = dueDateInfo(project.dueDate);

  const allTasks = flattenProjectTasks(project);
  const total = project.tasksCount ?? allTasks.length;
  const completedCount = allTasks.filter((t) => (t.status || "pending") === "completed").length;
  const progress = project.progress ?? (total > 0 ? Math.round((completedCount / total) * 100) : 0);

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return <ProjectOverviewTab project={project} onNavigateTab={setActiveTab} />;
      case "schedule":
        return <ProjectScheduleTab projectId={String(project.id)} />;
      case "tasks":
        return <ProjectTasksTab project={project} onTaskUpdate={loadProject} />;
      case "documents":
        return <ProjectDocumentsTab projectId={String(project.id)} />;
      case "procurement":
        return <ProjectProcurementTab project={project} />;
      case "inventory":
        return <ProjectInventoryTab projectId={String(project.id)} />;
      case "performance":
        return <ProjectPerformanceTab project={project} />;
      case "team":
        return <ProjectTeamTab project={project} onTeamUpdate={loadProject} />;
      default:
        return null;
    }
  };

  return (
    // No outer padding/margin — this box is the entire page area (below the
    // top bar), edge to edge in both directions.
    <div className="flex flex-col w-full min-h-[calc(100vh-4rem)] bg-white">
      {/* Header */}
      <div className="flex items-center flex-shrink-0 gap-4 px-6 py-4 bg-white lg:px-8">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <h1 className="font-semibold text-[22px] tracking-tight text-slate-900 truncate">
              {project.name}
            </h1>
            <StatusPill status={project.status} />
            <PriorityPill priority={project.priority} />
            <span className="flex items-center gap-1.5 text-[12px] text-slate-500">
              <Calendar className="flex-shrink-0 w-3.5 h-3.5" />
              {project.dueDate ? formatDate(project.dueDate) : "No due date"}
              {deadline && <span className={`font-medium ${deadline.tone}`}>({deadline.label})</span>}
            </span>
          </div>
        </div>

        <div className="flex-shrink-0 w-52">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-500">Progress</span>
            <span className="text-[13px] font-bold text-slate-900">{progress}%</span>
          </div>
          <div className="w-full h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full transition-all rounded-full bg-blue-600"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            {completedCount} of {total} tasks completed
          </div>
        </div>
      </div>

      {/* Tabs & Content — fills the remaining page height */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        <div className="flex flex-shrink-0 gap-1 px-2 overflow-x-auto border-b border-slate-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-[13px] border-b-2 whitespace-nowrap transition-colors
                  ${
                    activeTab === tab.id
                      ? "border-slate-900 text-black font-semibold"
                      : "border-transparent font-medium text-slate-500 hover:text-slate-700"
                  }`}
              >
                <Icon size={14} className="opacity-70" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1 p-6 overflow-auto">{renderTabContent()}</div>
      </div>
    </div>
  );
};

export default ProjectDetails;
