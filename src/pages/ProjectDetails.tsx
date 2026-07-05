import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import {
  ArrowLeft,
  LayoutDashboard,
  CheckSquare,
  FolderOpen,
  Users,
  Loader2,
  AlertCircle,
  Plus,
  Calendar,
} from "lucide-react";
import { Project, ProjectTask } from "../types";
import {
  ProjectOverviewTab,
  ProjectScheduleTab,
  ProjectTasksTab,
  ProjectDocumentsTab,
  ProjectInventoryTab,
  ProjectProcurementTab,
  ProjectTeamTab,
  Eyebrow,
  StatusPill,
} from "../project-components";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "tasks", label: "Task", icon: CheckSquare },
  { id: "documents", label: "Documents", icon: FolderOpen },
  { id: "inventory", label: "Inventory", icon: Plus },
  { id: "procurement", label: "Procurement", icon: Plus },
  { id: "team", label: "Team", icon: Users },
];

const ProjectDetails: React.FC = () => {
  const { workspaceId, id } = useParams<{ workspaceId: string; id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const loadProject = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await api.get<any>(`/api/projects/${id}`);
      const data = response.data;
      console.log("Project data loaded:", data);
      console.log("projectTasks:", data.projectTasks);
      console.log("headings:", data.headings);

      const allTasks: ProjectTask[] = [];
      const taskIds = new Set<number>();

      const flattenTasks = (headings: any[]) => {
        if (!Array.isArray(headings)) return;
        headings.forEach((h) => {
          // Add tasks from this heading
          if (h.tasks && Array.isArray(h.tasks)) {
            h.tasks.forEach((t: ProjectTask) => {
              if (!taskIds.has(t.id)) {
                console.log(
                  "Adding task from heading/subheading:",
                  t.id,
                  t.title,
                );
                taskIds.add(t.id);
                allTasks.push(t);
              }
            });
          }
          // Recursively process subheadings
          if (h.subHeadings) flattenTasks(h.subHeadings);
        });
      };
      if (data.headings) flattenTasks(data.headings);
      // Also add all projectTasks that are associated directly (without heading)
      if (data.projectTasks && Array.isArray(data.projectTasks)) {
        console.log("Adding projectTasks:", data.projectTasks.length);
        data.projectTasks.forEach((t: ProjectTask) => {
          if (!taskIds.has(t.id)) {
            console.log("Adding projectTask:", t.id, t.title);
            taskIds.add(t.id);
            allTasks.push(t);
          }
        });
      } else {
        console.log("No projectTasks found");
      }

      const completedTasks = allTasks.filter(
        (t) => t.status === "completed",
      ).length;
      const progress =
        allTasks.length > 0
          ? Math.round((completedTasks / allTasks.length) * 100)
          : 0;

      setProject({
        ...data,
        progress: data.progress ?? progress,
        tasksCount: data.tasksCount ?? allTasks.length,
        membersCount: data.membersCount ?? (data.assignees?.length || 0),
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Unable to load project.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id]);

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
        <div className="flex justify-center items-center mb-1 w-12 h-12 bg-red-100 rounded">
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

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return <ProjectOverviewTab project={project} />;
      case "schedule":
        return <ProjectScheduleTab projectId={String(project.id)} />;
      case "tasks":
        return <ProjectTasksTab project={project} onTaskUpdate={loadProject} />;
      case "documents":
        return <ProjectDocumentsTab projectId={String(project.id)} />;
      case "inventory":
        return <ProjectInventoryTab />;
      case "procurement":
        return <ProjectProcurementTab />;
      case "team":
        return <ProjectTeamTab project={project} />;
      default:
        return null;
    }
  };

  return (
    <div className="px-6 py-8 w-full lg:px-8 lg:py-10">
      {/* Back link — sits above and to the corner, separate from the title row */}
      <button
        onClick={() => navigate(`/${workspaceId}/project`)}
        className="flex gap-1.5 items-center mb-4 text-[13px] font-medium transition-colors text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={14} />
        Back to Projects
      </button>

      {/* Header */}
      <div className="flex gap-4 items-center mb-6">
        <div className="flex-1 min-w-0">
          <Eyebrow>Project Details</Eyebrow>
          <div className="flex gap-3 items-center mt-1">
            <h1 className="font-semibold text-[22px] tracking-tight text-slate-900 truncate">
              {project.name}
            </h1>
            <StatusPill status={project.status} />
          </div>
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="overflow-hidden w-full bg-white rounded-md border border-slate-200">
        <div className="flex overflow-x-auto gap-1 px-2 border-b border-slate-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 whitespace-nowrap transition-colors
                  ${
                    activeTab === tab.id
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
              >
                <Icon size={14} className="opacity-70" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="p-6 min-h-[400px]">{renderTabContent()}</div>
      </div>
    </div>
  );
};

export default ProjectDetails;
