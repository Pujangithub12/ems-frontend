import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import KanbanBoard from "./KanbanBoard";
import FileExplorer from "./FileExplorer";

// --- Types ---

type ProjectTask = {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed";
  progress: number;
  assignedUsers?: Array<{ id: number; fullName: string }>;
};

type ProjectHeading = {
  id: number;
  name: string;
  tasks: ProjectTask[];
  subHeadings: ProjectHeading[];
};

type Project = {
  id: number;
  name: string;
  description?: string;
  progress: number;
  tasksCount: number;
  membersCount: number;
  dueDate?: string;
  status: string;
  assignees?: Array<{ id: number; fullName: string }>;
  headings: ProjectHeading[];
  files: any[];
};

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "team", label: "Team", icon: Users },
  { id: "activity", label: "Activity", icon: Activity },
];

const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const loadProject = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await api.get<any>(`/api/projects/${id}`);
      // The backend might not return progress/tasksCount/membersCount directly
      // we might need to calculate them if they are missing
      const data = response.data;
      
      // Basic calculations if needed
      const allTasks: ProjectTask[] = [];
      const flattenTasks = (headings: any[]) => {
        headings.forEach(h => {
          if (h.tasks) allTasks.push(...h.tasks);
          if (h.subHeadings) flattenTasks(h.subHeadings);
        });
      };
      if (data.headings) flattenTasks(data.headings);
      
      const completedTasks = allTasks.filter(t => t.status === "completed").length;
      const progress = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0;

      setProject({
        ...data,
        progress: data.progress ?? progress,
        tasksCount: data.tasksCount ?? allTasks.length,
        membersCount: data.membersCount ?? (data.assignees?.length || 0),
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Unable to load project.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="font-medium text-slate-500">Loading project details...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-rose-50">
          <AlertCircle className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Project not found</h2>
        <p className="mb-6 text-slate-500">{error || "The project you are looking for does not exist."}</p>
        <button
          onClick={() => navigate("/project")}
          className="px-6 py-2 font-bold text-white transition-all bg-indigo-600 rounded-xl hover:bg-indigo-700"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return <FileExplorer project={project} />;
      case "tasks":
        return <KanbanBoard project={project} onUpdate={loadProject} />;
      case "files":
        return (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-3xl border-dashed">
             <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Project Files</h3>
              <p className="text-slate-500 max-w-xs mx-auto mb-6">Access all documentation and resources uploaded for this project.</p>
              <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all mx-auto">
                <Plus size={18} />
                Upload File
              </button>
          </div>
        );
      case "team":
        return (
          <div className="p-6 bg-white border border-slate-200 rounded-3xl">
            <h3 className="mb-6 text-lg font-bold text-slate-900">Team Members</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {project.assignees?.map((member, i) => (
                <div key={member.id} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-center w-12 h-12 font-bold text-indigo-700 bg-indigo-100 rounded-2xl">
                    {member.fullName.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{member.fullName}</p>
                    <p className="text-xs font-medium text-slate-500">Project Member</p>
                  </div>
                </div>
              ))}
              {(!project.assignees || project.assignees.length === 0) && (
                <p className="text-slate-500 italic">No members assigned to this project.</p>
              )}
            </div>
          </div>
        );
      case "activity":
        return (
          <div className="p-6 bg-white border border-slate-200 rounded-3xl">
            <h3 className="mb-6 text-lg font-bold text-slate-900">Recent Activity</h3>
            <div className="space-y-6">
              {[
                { action: "Updated status", target: "Login Module", time: "3 hours ago", user: "John Doe" },
                { action: "Added a comment", target: "Dashboard UI", time: "5 hours ago", user: "Jane Smith" },
                { action: "Created project", target: project.name, time: "2 days ago", user: "Admin" },
              ].map((act, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-2 h-2 mt-2 bg-indigo-500 rounded-full shrink-0" />
                  <div>
                    <p className="text-sm text-slate-900">
                      <span className="font-bold">{act.user}</span> {act.action} <span className="font-bold">{act.target}</span>
                    </p>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">{act.time}</p>
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
    <div className="space-y-8 pb-12">
      {/* Navigation & Title */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/project")}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-slate-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
               <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
               <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border bg-indigo-50 text-indigo-700 border-indigo-100`}>
                {project.status || "Active"}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500">Manage tasks, files and team progress.</p>
          </div>
        </div>
      </div>

      {/* Progress Card */}
      <div className="p-8 bg-indigo-600 rounded-[32px] text-white shadow-xl shadow-indigo-100 flex flex-col md:flex-row items-center gap-8">
        <div className="flex-1 space-y-4 w-full">
           <div className="flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-widest opacity-80">Project Progress</span>
              <span className="text-2xl font-bold">{project.progress}%</span>
           </div>
           <div className="h-3 bg-white/20 rounded-full overflow-hidden p-[2px]">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${project.progress}%` }}
                className="h-full bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)]"
              />
           </div>
           <div className="flex justify-between text-xs font-medium opacity-60">
              <span>0% Initialized</span>
              <span>100% Completed</span>
           </div>
        </div>
        <div className="grid grid-cols-2 gap-4 shrink-0 w-full md:w-auto">
           <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
              <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Total Tasks</p>
              <p className="text-xl font-bold">{project.tasksCount}</p>
           </div>
           <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
              <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Team Members</p>
              <p className="text-xl font-bold">{project.membersCount}</p>
           </div>
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-100 px-4 bg-slate-50/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-5 text-sm font-bold border-b-2 transition-all whitespace-nowrap
                  ${activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600 bg-white shadow-[0_-4px_0_inset_#4f46e5]"
                    : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50"
                  }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="p-8 min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;
