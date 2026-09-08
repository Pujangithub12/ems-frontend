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
  ProjectPerformanceTab,
  ProjectInventoryTab,
  ProjectTeamTab,
} from "../components/tabs";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "tasks", label: "Task", icon: CheckSquare },
  { id: "documents", label: "Documents", icon: FolderOpen },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "performance", label: "Energy Performance", icon: Zap },
  { id: "team", label: "Team", icon: Users },
];

const ProjectDetails: React.FC = () => {
  const { organizationId, id } = useParams<{ organizationId: string; id: string }>();
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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 bg-white">
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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-center bg-white">
        <div className="flex items-center justify-center w-12 h-12 mb-1 rounded-full bg-gradient-to-br from-red-50 to-red-100 ring-1 ring-red-100">
          <AlertCircle className="w-6 h-6 text-red-700" />
        </div>
        <h2 className="font-semibold text-[15px] text-slate-900">
          Project not found
        </h2>
        <p className="text-slate-500 text-[12px] max-w-xs mb-4">
          {error || "The project you are looking for does not exist."}
        </p>
        <button
          onClick={() => navigate(`/${organizationId}/project`)}
          className="px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 transition-colors"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return <ProjectOverviewTab project={project} onNavigateTab={setActiveTab} />;
      case "schedule":
        return <ProjectScheduleTab projectId={String(project.id)} onScheduleUpdate={loadProject} />;
      case "tasks":
        return <ProjectTasksTab project={project} onTaskUpdate={loadProject} />;
      case "documents":
        return <ProjectDocumentsTab projectId={String(project.id)} />;
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
      {/* Tabs & Content — fills the remaining page height */}
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        <div className="flex flex-shrink-0 px-2 overflow-x-auto border-b border-slate-200 bg-slate-50/60 lg:px-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-3 text-[13px] border-b-2 whitespace-nowrap transition-colors
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
        <div className={`flex-1 p-6 bg-white ${activeTab === "schedule" ? "overflow-hidden" : "overflow-auto"}`}>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;
