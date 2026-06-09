import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  ChevronDown,
  X,
  Loader2,
  Briefcase,
  Calendar,
  Users as UsersIcon,
  Filter,
  ExternalLink,
  AlertCircle
} from "lucide-react";

// --- Types ---

type Project = {
  id: number;
  name: string;
  description?: string;
  dueDate?: string;
  status: "pending" | "in_progress" | "completed" | "on_hold";
  priority: "high" | "medium" | "low";
  assignees?: Array<{ id: number; fullName: string }>;
  createdAt: string;
  progress?: number;
  tasksCount?: number;
};

// --- Sub-components ---

const StatusBadge: React.FC<{ status: Project["status"] }> = ({ status }) => {
  const styles = {
    pending: "bg-amber-50 text-amber-600 border-amber-100",
    in_progress: "bg-emerald-50 text-emerald-600 border-emerald-100",
    on_hold: "bg-rose-50 text-rose-600 border-rose-100",
    completed: "bg-indigo-50 text-indigo-600 border-indigo-100",
  };

  const labels = {
    pending: "Pending",
    in_progress: "Active",
    on_hold: "On Hold",
    completed: "Completed",
  };

  return (
    <span
      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border ${styles[status] || styles.pending}`}
    >
      {labels[status] || status}
    </span>
  );
};

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create Form States
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<Project["status"]>("pending");
  const [submitting, setSubmitting] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await api.get<Project[]>("/api/projects");
      setProjects(response.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Unable to load projects.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const createProject = async (event?: React.FormEvent | React.MouseEvent) => {
    if (event) event.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/api/projects", {
        name,
        description,
        dueDate: dueDate || undefined,
        status,
      });
      setName("");
      setDescription("");
      setDueDate("");
      setStatus("pending");
      await loadProjects();
      setShowCreateForm(false);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Unable to create project.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  return (
    <div className="pb-12 space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="p-3 text-indigo-600 border border-indigo-100 bg-white shadow-sm rounded-2xl">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Projects Library
              </h2>
              <p className="text-sm font-medium text-slate-500">
                Manage and track all company projects
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white transition-all bg-indigo-600 shadow-lg rounded-2xl hover:bg-indigo-700 shadow-indigo-200 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              New Project
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1 group">
            <Search className="absolute w-4 h-4 transition-colors -translate-y-1/2 left-4 top-1/2 text-slate-400 group-focus-within:text-indigo-500" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-3 pr-4 text-sm transition-all bg-white border shadow-sm pl-11 border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="relative min-w-[180px]">
            <Filter className="absolute w-4 h-4 -translate-y-1/2 pointer-events-none left-4 top-1/2 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-3 pr-10 text-sm font-medium transition-all bg-white border shadow-sm appearance-none cursor-pointer pl-11 border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="in_progress">Active</option>
              <option value="pending">Pending</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
            <ChevronDown className="absolute w-4 h-4 -translate-y-1/2 pointer-events-none right-4 top-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <AnimatePresence mode="popLayout">
        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[320px] bg-white rounded-[32px] border border-slate-200 animate-pulse"
              />
            ))}
          </div>
        ) : filteredProjects.length > 0 ? (
          <motion.div
            layout
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {filteredProjects.map((project) => (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -4 }}
                className="flex flex-col h-full p-6 transition-all duration-300 bg-white border shadow-sm group rounded-[32px] border-slate-200 hover:shadow-xl hover:shadow-indigo-500/5"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 transition-colors border bg-slate-50 rounded-2xl group-hover:bg-indigo-50 group-hover:text-indigo-600 border-slate-100">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <StatusBadge status={project.status} />
                </div>

                <div className="flex-1">
                  <h3 className="mb-2 text-xl font-bold transition-colors text-slate-900 group-hover:text-indigo-600 line-clamp-1">
                    {project.name}
                  </h3>
                  <p className="mb-6 text-sm leading-relaxed text-slate-500 line-clamp-3">
                    {project.description || "No description provided."}
                  </p>
                </div>

                <div className="pt-6 space-y-4 border-t border-slate-100">
                   {/* Progress */}
                   <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>Progress</span>
                        <span>{project.progress || 0}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                          style={{ width: `${project.progress || 0}%` }} 
                        />
                      </div>
                   </div>

                  <div className="flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Calendar className="w-4 h-4" />
                      <span className="font-bold">
                        {project.dueDate
                          ? new Date(project.dueDate).toLocaleDateString()
                          : "No date"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <UsersIcon className="w-4 h-4" />
                      <span className="font-bold">{project.assignees?.length || 0} Members</span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/project/${project.id}/details`)}
                    className="flex items-center justify-center w-full gap-2 py-3.5 text-sm font-bold transition-all bg-slate-50 hover:bg-indigo-600 hover:text-white text-slate-700 rounded-2xl group/btn border border-slate-100"
                  >
                    View Details
                    <ExternalLink className="w-4 h-4 transition-all -translate-x-2 opacity-0 group-hover/btn:opacity-100 group-hover/btn:translate-x-0" />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-[32px] border border-slate-200 border-dashed"
          >
            <div className="flex items-center justify-center w-20 h-20 mb-6 rounded-full bg-slate-50">
              <Briefcase className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-900">
              No projects found
            </h3>
            <p className="max-w-sm px-4 mx-auto font-medium leading-relaxed text-slate-500">
              {searchQuery || statusFilter !== "all"
                ? "We couldn't find any projects matching your current filters."
                : "Your projects list is currently empty."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Project Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateForm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl p-8 space-y-8 overflow-hidden"
            >
              <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    Launch New Project
                  </h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Define project scope and workspace.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="p-3 transition-all hover:bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={createProject} className="space-y-6">
                <div className="space-y-2">
                  <label className="ml-1 text-sm font-bold text-slate-700">
                    Project Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-5 py-4 font-medium transition-all border bg-slate-50 border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="e.g. Website Redesign"
                  />
                </div>
                <div className="space-y-2">
                  <label className="ml-1 text-sm font-bold text-slate-700">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-5 py-4 font-medium transition-all border resize-none bg-slate-50 border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    rows={3}
                    placeholder="Describe the project goals..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="ml-1 text-sm font-bold text-slate-700">
                      Status
                    </label>
                    <div className="relative">
                       <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full px-5 py-4 font-medium border appearance-none cursor-pointer bg-slate-50 border-slate-200 rounded-2xl focus:outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">Active</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-sm font-bold text-slate-700">
                      Deadline
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-5 py-4 font-medium border bg-slate-50 border-slate-200 rounded-2xl focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-8 py-4 text-sm font-bold transition-all bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-10 py-4 text-sm font-bold text-white transition-all bg-indigo-600 shadow-lg rounded-2xl hover:bg-indigo-700 shadow-indigo-200 disabled:opacity-70 active:scale-95"
                  >
                     {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Launch Project"}
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

export default ProjectsPage;
