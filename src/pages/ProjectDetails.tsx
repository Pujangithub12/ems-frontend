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
  Activity,
  Loader2,
  AlertCircle,
  Plus,
  Calendar,
  User as UserIcon,
} from "lucide-react";
import FileExplorer from "./FileExplorer";
import { Project, ProjectHeading, ProjectTask } from "../types";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "team", label: "Team", icon: Users },
  { id: "activity", label: "Activity", icon: Activity },
];

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

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    pending: { bg: "#FEF3C7", fg: "#B45309", label: "Pending" },
    in_progress: { bg: "#DBEAFE", fg: "#1E3A8A", label: "Active" },
    on_hold: { bg: "#FEE2E2", fg: "#B91C1C", label: "On Hold" },
    completed: { bg: "#DCFCE7", fg: "#15803D", label: "Completed" },
  };
  const s = styles[status] || { bg: "#EEF1F5", fg: "#475569", label: status };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] tracking-[0.05em] uppercase font-medium"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        background: s.bg,
        color: s.fg,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.fg }} />
      {s.label}
    </span>
  );
};

const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
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
          onClick={() => navigate("/project")}
          className="px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  const renderTabContent = () => {
    // Get all tasks
    const allTasks: ProjectTask[] = [];
    const taskIds = new Set<number>();
    console.log("Rendering tasks tab. Project data:", project);
    const flattenTasks = (headings: any[]) => {
      if (!Array.isArray(headings)) return;
      headings.forEach((h) => {
        console.log("Heading:", h);
        if (h.tasks && Array.isArray(h.tasks)) {
          h.tasks.forEach((t: ProjectTask) => {
            if (!taskIds.has(t.id)) {
              console.log("Adding task in render:", t.id, t.title);
              taskIds.add(t.id);
              allTasks.push(t);
            }
          });
        }
        if (h.subHeadings) flattenTasks(h.subHeadings);
      });
    };
    if (project.headings) flattenTasks(project.headings);
    console.log("After headings, allTasks:", allTasks);
    if (
      (project as any).projectTasks &&
      Array.isArray((project as any).projectTasks)
    ) {
      console.log(
        "projectTasks found in render:",
        (project as any).projectTasks,
      );
      (project as any).projectTasks.forEach((t: ProjectTask) => {
        if (!taskIds.has(t.id)) {
          console.log("Adding projectTask in render:", t.id, t.title);
          taskIds.add(t.id);
          allTasks.push(t);
        }
      });
    } else {
      console.log("No projectTasks found in render");
    }
    console.log("Final allTasks for render:", allTasks);

    switch (activeTab) {
      case "overview":
        return <FileExplorer project={project} />;
      case "tasks":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">All Tasks</h3>
              <span className="text-slate-500 text-sm">
                {allTasks.length} tasks
              </span>
            </div>
            <div className="space-y-3">
              {allTasks.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <CheckSquare className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-500">No tasks yet</p>
                </div>
              ) : (
                allTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-slate-900">
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-slate-500 text-sm mt-1">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <StatusPill status={task.status || "pending"} />
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      {task.dueDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <UserIcon className="w-4 h-4" />
                        <span>{task.assignedUsers?.length || 0} assigned</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-600 font-medium">
                          {task.progress ?? 0}% complete
                        </span>
                      </div>
                    </div>

                    {task.assignedUsers && task.assignedUsers.length > 0 && (
                      <div className="mt-3 flex -space-x-2">
                        {task.assignedUsers.slice(0, 4).map((user) => (
                          <div
                            key={user.id}
                            className="w-8 h-8 rounded-full bg-blue-900 border-2 border-white flex items-center justify-center text-white text-xs font-semibold"
                            title={user.fullName}
                          >
                            {user.fullName.charAt(0)}
                          </div>
                        ))}
                        {task.assignedUsers.length > 4 && (
                          <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-slate-500 text-xs font-semibold">
                            +{task.assignedUsers.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      case "files":
        return (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded border-slate-200">
            <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
              <FolderOpen className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
              Project Files
            </h3>
            <p className="text-slate-500 text-[12px] max-w-xs mx-auto mb-4">
              Access all documentation and resources uploaded for this project.
            </p>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded text-[12px] font-medium hover:bg-blue-800 transition-colors">
              <Plus size={14} /> Upload File
            </button>
          </div>
        );
      case "team":
        return (
          <div>
            <Eyebrow className="mb-4">Assigned Members</Eyebrow>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {project.assignees?.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-4 transition-colors border rounded border-slate-200 hover:bg-slate-50"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0">
                    {member.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-[13px] text-slate-900 truncate">
                      {member.fullName}
                    </p>
                    <p className="text-[11px] text-slate-500">Project Member</p>
                  </div>
                </div>
              ))}
              {(!project.assignees || project.assignees.length === 0) && (
                <p className="text-slate-500 text-[12px] italic col-span-full">
                  No members assigned to this project.
                </p>
              )}
            </div>
          </div>
        );
      case "activity":
        return (
          <div>
            <Eyebrow className="mb-4">Recent Activity</Eyebrow>
            <div className="space-y-0">
              {[
                {
                  action: "Updated status",
                  target: "Login Module",
                  time: "3 hours ago",
                  user: "John Doe",
                },
                {
                  action: "Added a comment",
                  target: "Dashboard UI",
                  time: "5 hours ago",
                  user: "Jane Smith",
                },
                {
                  action: "Created project",
                  target: project.name,
                  time: "2 days ago",
                  user: "Admin",
                },
              ].map((act, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 py-3 border-b border-slate-200 last:border-0"
                >
                  <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Activity className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-slate-900">
                      <span className="font-medium">{act.user}</span>{" "}
                      <span className="text-slate-500">{act.action}</span>{" "}
                      <span className="font-medium">{act.target}</span>
                    </p>
                    <p
                      className="text-[11px] text-slate-400 mt-0.5"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {act.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl px-6 py-8 mx-auto lg:px-8 lg:py-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/project")}
          className="p-2 transition-colors border rounded border-slate-200 hover:bg-slate-50 text-slate-500"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <Eyebrow>Project Details</Eyebrow>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="font-semibold text-[22px] tracking-tight text-slate-900 truncate">
              {project.name}
            </h1>
            <StatusPill status={project.status} />
          </div>
        </div>
      </div>

      {/* Progress & Metrics Card */}
      <div className="p-6 mb-6 bg-white border rounded-md border-slate-200">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <Eyebrow>Project Progress</Eyebrow>
            <div className="flex items-baseline gap-2 mt-2 mb-3">
              <span className="font-semibold text-[30px] tracking-tight text-blue-900">
                {project.progress}%
              </span>
              <span className="text-[11px] text-slate-400">complete</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500 bg-blue-900 rounded-full"
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <p className="text-slate-500 text-[12px] mt-3 leading-relaxed line-clamp-2">
              {project.description || "No description provided."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border rounded border-slate-200">
              <Eyebrow>Total Tasks</Eyebrow>
              <div className="font-semibold text-[20px] tracking-tight text-slate-900 mt-1">
                {project.tasksCount}
              </div>
            </div>
            <div className="p-3 border rounded border-slate-200">
              <Eyebrow>Team Members</Eyebrow>
              <div className="font-semibold text-[20px] tracking-tight text-slate-900 mt-1">
                {project.membersCount}
              </div>
            </div>
            <div className="col-span-2 p-3 border rounded border-slate-200">
              <Eyebrow>Deadline</Eyebrow>
              <div className="font-medium text-[13px] text-slate-900 mt-1 flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-slate-400" />
                {project.dueDate
                  ? new Date(project.dueDate).toLocaleDateString()
                  : "Not set"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="overflow-hidden bg-white border rounded-md border-slate-200">
        <div className="flex gap-1 px-2 overflow-x-auto border-b border-slate-200">
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
