import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  User as UserIcon,
  Trash2,
  Edit2,
  Folder,
  FileText,
  Clock,
  ExternalLink,
  Plus,
  Loader2,
  AlertCircle,
  X,
  Briefcase,
  Users as UsersIcon,
  Filter,
  Calendar,
} from "lucide-react";

// --- Types ---

type ProjectFile = {
  id: number;
  name: string;
  isFolder: boolean;
  type?: string;
  parentId?: number;
};

type ProjectTask = {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  status: string;
  progress: number;
  assignedUsers?: Array<{ id: number; fullName: string }>;
};

type ProjectHeading = {
  id: number;
  name: string;
  tasks: ProjectTask[];
  subHeadings: ProjectHeading[];
  parentHeading?: { id: number };
};

type Project = {
  id: number;
  name: string;
  description?: string;
  dueDate?: string;
  status: "pending" | "in_progress" | "completed" | "on_hold";
  priority: "high" | "medium" | "low";
  assignees?: Array<{ id: number; fullName: string }>;
  createdAt: string;
  projectTasks: ProjectTask[];
  headings: ProjectHeading[];
  files: ProjectFile[];
};

type User = {
  id: number;
  fullName: string;
};

// --- Sub-components ---

const StatusBadge: React.FC<{ status: Project["status"] }> = ({ status }) => {
  const styles = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    in_progress: "bg-emerald-100 text-emerald-700 border-emerald-200",
    on_hold: "bg-rose-100 text-rose-700 border-rose-200",
    completed: "bg-indigo-100 text-indigo-700 border-indigo-200",
  };

  const labels = {
    pending: "Pending",
    in_progress: "Active",
    on_hold: "On Hold",
    completed: "Completed",
  };

  return (
    <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  );
};

const StatusDot: React.FC<{ status: Project["status"] }> = ({ status }) => {
  const colors = {
    in_progress: "bg-emerald-500",
    pending: "bg-amber-500",
    on_hold: "bg-rose-500",
    completed: "bg-indigo-500",
  };
  return (
    <div
      className={`w-2 h-2 rounded-full ${colors[status] || colors.pending} shadow-[0_0_8px_rgba(0,0,0,0.1)]`}
    />
  );
};

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => {
  return (
    <div className="flex flex-col gap-1.5 w-full max-w-[200px]">
      <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <span>Progress</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 p-[1px]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.2)]"
        />
      </div>
    </div>
  );
};

const TaskCard: React.FC<{ task: ProjectTask; project: Project }> = ({
  task,
  project,
}) => {
  return (
    <div className="relative group">
      {/* Connector line */}
      <div className="absolute -left-[24px] top-1/2 w-6 h-[2px] bg-slate-200" />

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-200 group/task">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-50 rounded-lg group-hover/task:bg-indigo-50 group-hover/task:text-indigo-600 transition-colors">
                <FileText className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 leading-tight">
                {task.title}
              </h4>
            </div>
            <div className="flex gap-2 opacity-0 group-hover/task:opacity-100 transition-opacity">
              <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
                <UserIcon className="w-3 h-3 text-indigo-600" />
              </div>
              <span className="text-[11px] font-medium text-slate-600">
                {task.assignedUsers?.[0]?.fullName || "Unassigned"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium">
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            </div>

            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
                task.priority === "high"
                  ? "bg-rose-50 text-rose-600 border-rose-100"
                  : task.priority === "medium"
                    ? "bg-amber-50 text-amber-600 border-amber-100"
                    : "bg-emerald-50 text-emerald-600 border-emerald-100"
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  task.priority === "high"
                    ? "bg-rose-500"
                    : task.priority === "medium"
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
              />
              {task.priority}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-50">
            <ProgressBar progress={task.progress || 0} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md">
              {task.status || "Pending"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const HeadingView: React.FC<{
  heading: ProjectHeading;
  project: Project;
  isAdmin: boolean;
  onAddTask: (headingId: number) => void;
  onAddSubHeading: (parentId: number) => void;
}> = ({ heading, project, isAdmin, onAddTask, onAddSubHeading }) => {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between group/header">
        <div
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={() => setExpanded(!expanded)}
        >
          <div
            className={`p-1 rounded-md transition-colors ${expanded ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4 rotate-90" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Folder
              className={`w-4 h-4 ${expanded ? "text-indigo-500" : "text-slate-400"}`}
            />
            <span
              className={`text-sm font-bold tracking-tight ${expanded ? "text-slate-900" : "text-slate-500"}`}
            >
              {heading.name}
            </span>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-full">
              {heading.tasks?.length || 0}
            </span>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2 opacity-0 group-hover/header:opacity-100 transition-opacity">
            <button
              onClick={() => onAddSubHeading(heading.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              <Plus className="w-3 h-3" />
              Sub-heading
            </button>
            <button
              onClick={() => onAddTask(heading.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-100"
            >
              <Plus className="w-3 h-3" />
              Add Task
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="pl-6 space-y-4 border-l-2 border-slate-100 ml-3 overflow-hidden"
          >
            {heading.tasks?.map((task) => (
              <TaskCard key={task.id} task={task} project={project} />
            ))}
            {heading.subHeadings?.map((sub) => (
              <HeadingView
                key={sub.id}
                heading={sub}
                project={project}
                isAdmin={isAdmin}
                onAddTask={onAddTask}
                onAddSubHeading={onAddSubHeading}
              />
            ))}
            {heading.tasks?.length === 0 &&
              heading.subHeadings?.length === 0 && (
                <div className="ml-4 py-4 text-[11px] font-medium text-slate-400 italic">
                  Empty heading. Add tasks or sub-headings to get started.
                </div>
              )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [project, setProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Task Form States
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState<"high" | "medium" | "low">(
    "medium",
  );
  const [taskStatus, setTaskStatus] = useState("pending");
  const [taskAssignedUserIds, setTaskAssignedUserIds] = useState<number[]>([]);

  const loadProject = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await api.get<Project>(`/api/projects/${id}`);
      setProject(response.data);
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

  const loadUsers = async () => {
    try {
      const response = await api.get<User[]>("/api/users");
      setUsers(response.data);
    } catch (err: any) {}
  };

  useEffect(() => {
    loadProject();
    loadUsers();
  }, [id]);

  const handleAddTaskToHeading = (headingId: number) => {
    setActiveHeadingId(headingId);
    setTaskTitle("");
    setTaskDescription("");
    setTaskDueDate(new Date().toISOString().split("T")[0]);
    setTaskPriority("medium");
    setTaskStatus("pending");
    setTaskAssignedUserIds([]);
    setShowTaskModal(true);
  };

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !taskTitle ||
      !taskDescription ||
      !taskDueDate ||
      !activeHeadingId ||
      !id
    )
      return;

    try {
      await api.post(`/api/projects/${id}/tasks`, {
        title: taskTitle,
        description: taskDescription,
        dueDate: taskDueDate,
        headingId: activeHeadingId,
        priority: taskPriority,
        status: taskStatus,
        assignedUserIds: taskAssignedUserIds,
      });
      await loadProject();
      setShowTaskModal(false);
    } catch (err: any) {
      alert(
        "Failed to add task: " + (err?.response?.data?.message || err.message),
      );
    }
  };

  const handleAddSubHeading = async (parentHeadingId: number) => {
    const name = window.prompt("Enter sub-heading name:");
    if (!name || !id) return;

    try {
      await api.post(`/api/projects/${id}/headings`, { name, parentHeadingId });
      await loadProject();
    } catch (err: any) {
      alert(
        "Failed to add sub-heading: " +
          (err?.response?.data?.message || err.message),
      );
    }
  };

  const handleAddRootHeading = async () => {
    const name = window.prompt("Enter heading name:");
    if (!name || !id) return;

    try {
      await api.post(`/api/projects/${id}/headings`, { name });
      await loadProject();
    } catch (err: any) {
      alert(
        "Failed to add heading: " +
          (err?.response?.data?.message || err.message),
      );
    }
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Loading project details...</p>
      </div>
    );

  if (error || !project)
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 flex items-center gap-4 text-rose-700">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <p className="font-medium">Error: {error || "Project not found"}</p>
        </div>
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/project")}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm group"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {project.name}
              </h2>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-sm text-slate-500 font-medium flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Due: {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "No date"}
              </span>
              <span className="flex items-center gap-1.5">
                <UsersIcon className="w-4 h-4" />
                {project.assignees?.length || 0} Members
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 lg:p-8 border-b border-slate-100 bg-slate-50/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Project Overview</h3>
                <p className="text-slate-600 leading-relaxed">
                  {project.description || "No description provided for this project."}
                </p>
              </div>
              <div className="flex gap-3 self-start md:self-center">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
                  <Folder className="w-4 h-4" />
                  Project Drive
                </button>
                {isAdmin && (
                  <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
                    <Edit2 className="w-4 h-4" />
                    Edit Project
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 lg:p-8">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
                  <Briefcase className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Task Hierarchy</h3>
              </div>
              {isAdmin && (
                <button
                  onClick={handleAddRootHeading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  <Plus className="w-4 h-4" />
                  Add Root Heading
                </button>
              )}
            </div>

            <div className="space-y-8">
              {project.headings
                ?.filter((h) => !h.parentHeading)
                .map((heading) => (
                  <HeadingView
                    key={heading.id}
                    heading={heading}
                    project={project}
                    isAdmin={isAdmin}
                    onAddTask={handleAddTaskToHeading}
                    onAddSubHeading={handleAddSubHeading}
                  />
                ))}

              {(!project.headings || project.headings.length === 0) && (
                <div className="py-20 flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                    <Folder className="w-8 h-8 text-slate-200" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-1">No tasks organized yet</h4>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto mb-6">
                    Start by adding a root heading to organize your project tasks and milestones.
                  </p>
                  {isAdmin && (
                    <button
                      onClick={handleAddRootHeading}
                      className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-900 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Create First Heading
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Task Modal */}
      <AnimatePresence>
        {showTaskModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTaskModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 rounded-xl text-white">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Create New Task</h3>
                </div>
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={submitTask} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Task Title</label>
                  <input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="What needs to be done?"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Description</label>
                  <textarea
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px] resize-none"
                    placeholder="Describe the task details..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Due Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="date"
                        value={taskDueDate}
                        onChange={(e) => setTaskDueDate(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Priority</label>
                    <div className="relative">
                      <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <select
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                      >
                        <option value="high">High Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="low">Low Priority</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Status</label>
                    <div className="relative">
                      <select
                        value={taskStatus}
                        onChange={(e) => setTaskStatus(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Assign To</label>
                    <div className="relative">
                      <select
                        multiple
                        value={taskAssignedUserIds.map(String)}
                        onChange={(e) =>
                          setTaskAssignedUserIds(
                            Array.from(e.target.selectedOptions, (o) =>
                              Number(o.value),
                            ),
                          )
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px]"
                      >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  Create Task
                </button>
              </div>
            </form>
          </motion.div>
        </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectDetails;
