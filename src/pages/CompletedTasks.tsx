import React, { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import {
  Search,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Loader2,
  AlertCircle,
  Calendar,
  FolderKanban,
  ClipboardList,
  Folder,
  TrendingUp,
  FileText,
  ListChecks,
  PauseCircle,
  CheckCircle2,
  Clock,
  User as UserRoundIcon,
} from "lucide-react";

type AssignedUser = { id: number; fullName: string; email: string };
type Project = {
  id: number;
  name: string;
  description?: string;
  dueDate?: string;
  status: "pending" | "in_progress" | "completed" | "on_hold";
  priority: "high" | "medium" | "low";
  createdAt: string;
};

type Task = {
  id: number;
  title: string;
  description?: string;
  priority: string;
  status: string;
  progress: number;
  dueDate: string;
  assignedUsers: AssignedUser[];
  createdAt: string;
  subTasks: { id: number; title: string; status: string; children?: any[] }[];
  projectName?: string;
  project?: { id: number; name: string; status?: string };
  createdBy?: { id: number; fullName: string };
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const formatLongDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const getStatusMeta = (status: string) => {
  const v = status.toLowerCase().replace(/\s+/g, "_");
  if (v === "completed")
    return { label: "Completed", bg: "#DCFCE7", fg: "#15803D", Icon: CheckCircle2 };
  if (v === "in_progress")
    return { label: "In Progress", bg: "#DBEAFE", fg: "#1E3A8A", Icon: Clock };
  if (v === "on_hold")
    return { label: "On Hold", bg: "#FEE2E2", fg: "#B91C1C", Icon: PauseCircle };
  return { label: "Pending", bg: "#FEF3C7", fg: "#B45309", Icon: Clock };
};

const getDueMeta = (dueDate: string, status: string) => {
  const due = new Date(new Date(dueDate).toDateString()).getTime();
  const today = new Date(new Date().toDateString()).getTime();
  const diffDays = Math.round((due - today) / 86400000);
  if (status === "completed") return { label: "Completed", bg: "#DCFCE7", fg: "#15803D" };
  if (diffDays < 0)
    return {
      label: `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} overdue`,
      bg: "#FEE2E2",
      fg: "#B91C1C",
    };
  if (diffDays === 0) return { label: "Due today", bg: "#FEF3C7", fg: "#B45309" };
  return { label: `In ${diffDays} day${diffDays === 1 ? "" : "s"}`, bg: "#DBEAFE", fg: "#1E3A8A" };
};

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

const StatusPill: React.FC<{ type: "priority"; value: string }> = ({ value }) => {
  let bg = "#EEF1F5",
    fg = "#475569";
  const v = value.toLowerCase();
  if (v === "high") {
    bg = "#FEE2E2";
    fg = "#B91C1C";
  } else if (v === "medium") {
    bg = "#FEF3C7";
    fg = "#B45309";
  } else if (v === "low") {
    bg = "#DCFCE7";
    fg = "#15803D";
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] tracking-[0.05em] uppercase font-medium"
      style={{ fontFamily: "'JetBrains Mono', monospace", background: bg, color: fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: fg }} />
      {value}
    </span>
  );
};

const CompletedTasks: React.FC = () => {
  const { workspace } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterProjectName, setFilterProjectName] = useState("");
  const [projectFilterOpen, setProjectFilterOpen] = useState(false);
  const projectFilterRef = useRef<HTMLDivElement>(null);

  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [showAllMembers, setShowAllMembers] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        projectFilterRef.current &&
        !projectFilterRef.current.contains(e.target as Node)
      ) {
        setProjectFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [tasksRes, projectsRes] = await Promise.all([
          api.get<Task[]>("/api/tasks"),
          api.get<Project[]>("/api/projects"),
        ]);
        setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
        setProjects(projectsRes.data);
      } catch (err: any) {
        setError(
          err?.response?.data?.message || err.message || "Unable to load completed tasks.",
        );
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [workspace?.id]);

  const handleUnComplete = async (taskId: number) => {
    try {
      await api.put(`/api/tasks/${taskId}/status`, { status: "pending" });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (expandedTaskId === taskId) setExpandedTaskId(null);
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || "Status update failed");
    }
  };

  const completedTasks = tasks.filter((t) => t.status === "completed");

  const filteredTasks = completedTasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProject = filterProjectName
      ? (task.project?.name || task.projectName || "")
          .toLowerCase()
          .includes(filterProjectName.toLowerCase())
      : true;
    return matchesSearch && matchesProject;
  });

  type ProjectGroup = {
    key: string;
    name: string;
    projectId: number | null;
    tasks: Task[];
  };

  const projectGroups: ProjectGroup[] = (() => {
    const map = new Map<string, ProjectGroup>();
    filteredTasks.forEach((task) => {
      const projectId = task.project?.id ?? null;
      const name = task.project?.name || task.projectName || "No Project";
      const key = projectId != null ? `p-${projectId}` : `name-${name}`;
      if (!map.has(key)) map.set(key, { key, name, projectId, tasks: [] });
      map.get(key)!.tasks.push(task);
    });
    const groups = Array.from(map.values()).sort((a, b) => {
      if (a.name === "No Project") return 1;
      if (b.name === "No Project") return -1;
      return a.name.localeCompare(b.name);
    });
    groups.forEach((g) => {
      g.tasks.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
    });
    return groups;
  })();

  const toggleGroup = (key: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const expandAllGroups = () => setCollapsedProjects(new Set());
  const collapseAllGroups = () =>
    setCollapsedProjects(new Set(projectGroups.map((g) => g.key)));
  const allGroupsCollapsed =
    projectGroups.length > 0 &&
    projectGroups.every((g) => collapsedProjects.has(g.key));
  const toggleAllGroups = () =>
    allGroupsCollapsed ? expandAllGroups() : collapseAllGroups();

  return (
    <div className="p-6 space-y-6">
      {/* Search + Filters + Expand/Collapse toggle */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white border rounded-lg shadow-sm border-slate-200">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search completed tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-2 pr-3 text-[13px] bg-white border border-slate-200 rounded pl-9 outline-none focus:border-blue-900 transition-colors"
          />
        </div>
        <div ref={projectFilterRef} className="relative">
          <button
            type="button"
            onClick={() => setProjectFilterOpen((o) => !o)}
            className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] font-medium bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors min-w-[170px]"
          >
            <span className="truncate">{filterProjectName || "All Projects"}</span>
            <ChevronDown className="flex-shrink-0 w-3.5 h-3.5 text-slate-400" />
          </button>
          {projectFilterOpen && (
            <div className="absolute z-20 mt-1 w-full min-w-[190px] bg-white border border-slate-200 rounded shadow-lg overflow-hidden">
              <div className="max-h-[180px] overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    setFilterProjectName("");
                    setProjectFilterOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-[13px] transition-colors hover:bg-slate-50 ${
                    !filterProjectName ? "font-semibold text-blue-900 bg-blue-50" : "text-slate-700"
                  }`}
                >
                  All Projects
                </button>
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      setFilterProjectName(project.name);
                      setProjectFilterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-[13px] truncate transition-colors hover:bg-slate-50 ${
                      filterProjectName === project.name
                        ? "font-semibold text-blue-900 bg-blue-50"
                        : "text-slate-700"
                    }`}
                  >
                    {project.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={toggleAllGroups}
          className="flex items-center gap-1.5 px-3 py-2 ml-auto text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:border-slate-300 transition-colors"
        >
          {allGroupsCollapsed ? (
            <ChevronsUpDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronsDownUp className="w-3.5 h-3.5" />
          )}
          {allGroupsCollapsed ? "Expand all" : "Collapse all"}
        </button>
      </div>

      {/* Content: grouped by project */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 bg-white border rounded-md border-slate-200">
          <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
          <div
            className="text-[11px] text-slate-400 tracking-[0.1em] uppercase"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Loading completed tasks...
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-md text-red-700 text-[13px]">
          <AlertCircle className="flex-shrink-0 w-4 h-4" />
          {error}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white border rounded-md border-slate-200">
          <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
            <CheckCircle2 className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
            No completed tasks yet
          </h3>
          <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
            Tasks you mark as completed will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-3">
            {projectGroups.map((group) => {
              const isCollapsed = collapsedProjects.has(group.key);
              return (
                <div
                  key={group.key}
                  className="overflow-hidden transition-shadow bg-white border rounded-lg shadow-sm border-slate-200 hover:shadow-md"
                >
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className="flex items-center w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/60"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="flex-shrink-0 w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="flex-shrink-0 w-4 h-4 text-slate-400" />
                    )}
                    <span className="flex items-center justify-center flex-shrink-0 rounded-md w-6 h-6 bg-blue-50">
                      <FolderKanban className="w-3.5 h-3.5 text-blue-900" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[14px] text-slate-900 truncate">
                        {group.name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {group.tasks.length} completed
                      </div>
                    </div>
                    <span
                      className="text-[11px] text-white font-semibold bg-blue-900 px-2.5 py-1 rounded-md flex-shrink-0"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {group.tasks.length}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="border-t border-slate-200 px-2.5 py-2 space-y-1">
                      {group.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 px-2.5 py-2.5 rounded-md hover:bg-slate-50 transition-colors opacity-70"
                        >
                          <button
                            onClick={() => handleUnComplete(task.id)}
                            className="w-[18px] h-[18px] rounded-full border flex items-center justify-center flex-shrink-0 transition-colors bg-slate-900 border-slate-900"
                            title="Mark as pending"
                          >
                            <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                          </button>
                          <button
                            onClick={() =>
                              setExpandedTaskId(expandedTaskId === task.id ? null : task.id)
                            }
                            className="flex-1 min-w-0 text-left"
                          >
                            <p className="text-[13px] font-medium text-slate-900 truncate line-through">
                              {task.title}
                            </p>
                            <p className="flex items-center gap-1 text-[11px] mt-0.5 text-slate-500">
                              <Calendar className="w-3 h-3" /> Due {formatDate(task.dueDate)}
                              {task.createdBy && (
                                <span className="text-slate-400">
                                  {" "}
                                  · Assigned by {task.createdBy.fullName}
                                </span>
                              )}
                            </p>
                          </button>
                          <div className="flex-shrink-0">
                            <StatusPill type="priority" value={task.priority} />
                          </div>
                          <div className="flex-shrink-0 -space-x-1 flex">
                            {task.assignedUsers.length === 0 ? (
                              <span className="text-[11px] text-slate-400">Unassigned</span>
                            ) : (
                              task.assignedUsers.slice(0, 3).map((u) => (
                                <div
                                  key={u.id}
                                  className="flex items-center justify-center w-6 h-6 text-[9px] font-semibold text-white bg-blue-900 border-2 border-white rounded-full"
                                  title={u.fullName}
                                >
                                  {u.fullName.charAt(0)}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Task Details Popup */}
      {expandedTaskId &&
        (() => {
          const t = completedTasks.find((task) => task.id === expandedTaskId);
          if (!t) return null;
          const statusMeta = getStatusMeta(t.status);
          const dueMeta = getDueMeta(t.dueDate, t.status);
          const StatusIcon = statusMeta.Icon;
          return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-6">
              <div className="w-full max-w-lg bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between flex-shrink-0 px-5 py-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-full bg-blue-50">
                      <ClipboardList className="w-3.5 h-3.5 text-blue-900" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[15px] text-slate-900 truncate">
                        {t.title}
                      </h3>
                      <p className="flex items-center gap-1.5 text-[12px] text-slate-500 mt-0.5 truncate">
                        <span className="font-medium text-blue-900">
                          {t.project?.name || t.projectName || "No Project"}
                        </span>
                        <span>·</span>
                        <span>Due {formatLongDate(t.dueDate)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center flex-shrink-0 gap-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{ background: statusMeta.bg, color: statusMeta.fg }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: statusMeta.fg }}
                      />
                      {statusMeta.label}
                    </span>
                    <button
                      onClick={() => {
                        setExpandedTaskId(null);
                        setShowAllMembers(false);
                      }}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 p-5 space-y-3 overflow-y-auto">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="p-2.5 rounded-lg shadow-md shadow-slate-200/70">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg bg-blue-50">
                          <Folder className="w-3.5 h-3.5 text-blue-900" />
                        </div>
                        <Eyebrow>Project</Eyebrow>
                      </div>
                      <p className="font-semibold text-[13px] text-slate-900 truncate">
                        {t.project?.name || t.projectName || "No Project"}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg shadow-md shadow-slate-200/70">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg bg-blue-50">
                          <Calendar className="w-3.5 h-3.5 text-blue-900" />
                        </div>
                        <Eyebrow>Due Date</Eyebrow>
                      </div>
                      <p className="font-semibold text-[13px] text-slate-900">
                        {formatLongDate(t.dueDate)}
                      </p>
                      <span
                        className="inline-flex items-center gap-1.5 mt-2 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: dueMeta.bg, color: dueMeta.fg }}
                      >
                        {dueMeta.label}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg shadow-md shadow-slate-200/70">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg bg-emerald-50">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                        </div>
                        <Eyebrow>Progress</Eyebrow>
                      </div>
                      <span className="font-semibold text-[18px] tracking-tight text-slate-900">
                        {t.progress}%
                      </span>
                      <div className="w-full h-1.5 mt-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${t.progress}%`, background: statusMeta.fg }}
                        />
                      </div>
                      <div
                        className="flex items-center gap-1.5 mt-2 text-[11px] font-medium"
                        style={{ color: statusMeta.fg }}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusMeta.label}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="p-2.5 rounded-lg shadow-md shadow-slate-200/70">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="flex-shrink-0 w-3.5 h-3.5 text-slate-400" />
                        <Eyebrow>Description</Eyebrow>
                      </div>
                      <p className="text-slate-600 text-[13px] leading-relaxed whitespace-pre-wrap">
                        {t.description || "No description provided."}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg shadow-md shadow-slate-200/70">
                      <div className="flex items-center gap-2 mb-2">
                        <UserRoundIcon className="flex-shrink-0 w-3.5 h-3.5 text-slate-400" />
                        <Eyebrow>Assigned To</Eyebrow>
                      </div>
                      <div className="space-y-2">
                        {t.assignedUsers.length === 0 ? (
                          <p className="text-slate-400 text-[12px]">Unassigned</p>
                        ) : (
                          <>
                            {t.assignedUsers.slice(0, 2).map((u) => (
                              <div key={u.id} className="flex items-center gap-2">
                                <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 text-[11px] font-semibold text-white rounded-full bg-blue-900">
                                  {u.fullName.charAt(0)}
                                </div>
                                <span className="text-[13px] font-medium text-slate-800 truncate">
                                  {u.fullName}
                                </span>
                              </div>
                            ))}
                            {t.assignedUsers.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setShowAllMembers(true)}
                                className="text-[12px] font-medium text-blue-900 hover:underline"
                              >
                                View all ({t.assignedUsers.length})
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      {t.createdBy && (
                        <p className="pt-2 mt-2 text-[11px] text-slate-400 border-t border-slate-100">
                          Assigned by{" "}
                          <span className="font-medium text-slate-600">
                            {t.createdBy.fullName}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  {t.subTasks && t.subTasks.length > 0 && (
                    <div className="p-2.5 rounded-lg shadow-md shadow-slate-200/70">
                      <div className="flex items-center gap-2 mb-2">
                        <ListChecks className="flex-shrink-0 w-3.5 h-3.5 text-slate-400" />
                        <Eyebrow>Sub-Tasks</Eyebrow>
                      </div>
                      <div className="space-y-1.5">
                        {t.subTasks.map((st) => (
                          <div
                            key={st.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded bg-slate-50"
                          >
                            <CheckCircle2
                              className={`w-3.5 h-3.5 flex-shrink-0 ${
                                st.status === "completed" ? "text-emerald-600" : "text-slate-300"
                              }`}
                            />
                            <span
                              className={`text-[12px] text-slate-700 truncate ${
                                st.status === "completed" ? "line-through text-slate-400" : ""
                              }`}
                            >
                              {st.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* View All Assigned Members Popup */}
      {showAllMembers &&
        expandedTaskId &&
        (() => {
          const t = completedTasks.find((task) => task.id === expandedTaskId);
          if (!t) return null;
          return (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 p-6">
              <div className="flex flex-col w-full max-w-sm overflow-hidden bg-white border rounded-md shadow-lg border-slate-200 max-h-[80vh]">
                <div className="flex items-center justify-between flex-shrink-0 px-5 py-3 border-b border-slate-200">
                  <Eyebrow>Assigned Members ({t.assignedUsers.length})</Eyebrow>
                  <button
                    onClick={() => setShowAllMembers(false)}
                    className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 p-3 space-y-1 overflow-y-auto">
                  {t.assignedUsers.length === 0 ? (
                    <p className="py-4 text-center text-slate-400 text-[12px]">
                      No members assigned.
                    </p>
                  ) : (
                    t.assignedUsers.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-slate-50"
                      >
                        <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-[12px] font-semibold text-white rounded-full bg-blue-900">
                          {u.fullName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-slate-800 truncate">
                            {u.fullName}
                          </p>
                          {u.email && (
                            <p className="text-[11px] text-slate-400 truncate">
                              {u.email}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
};

export default CompletedTasks;
