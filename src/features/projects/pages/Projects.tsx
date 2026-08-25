import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthProvider";
import {
  Plus,
  Search,
  ChevronDown,
  X,
  Loader2,
  Filter,
  Trash2,
  Edit2,
  FolderKanban,
  Calendar,
  Users as UsersIcon,
  MoreVertical,
  AlertTriangle,
  Clock3,
} from "lucide-react";
import ConfirmationModal from "../../../components/ConfirmationModal";
import ErrorBanner from "../../../components/ErrorBanner";
import { getErrorMessage } from "../../../lib/errors";
import { Project } from "../../../types";
import { flattenProjectTasks } from "../../tasks/utils/taskUtils";
import { PriorityPill } from "../components/tabs";
import { useUsers } from "../../users/hooks/useUsers";
import Pagination from "../../../components/Pagination";
import {
  useProjectsPage,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from "../hooks/useProjects";

const PROJECT_ICON_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-amber-50", text: "text-amber-700" },
  in_progress: { bg: "bg-blue-50", text: "text-blue-900" },
  on_hold: { bg: "bg-red-50", text: "text-red-700" },
  completed: { bg: "bg-emerald-50", text: "text-emerald-700" },
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

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, organization } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // Debounce search so every keystroke doesn't fire a new request.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, pageSize]);

  const {
    data: projectsPageResult,
    isLoading: loading,
    isError: projectsIsError,
    error: projectsQueryError,
  } = useProjectsPage(page, pageSize, debouncedSearch, statusFilter);
  const projects = projectsPageResult?.data ?? [];
  const total = projectsPageResult?.total ?? 0;
  const { data: usersData = [] } = useUsers();
  const users = useMemo(
    () => [...usersData].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [usersData],
  );
  const [mutationError, setMutationError] = useState<string | null>(null);
  const error = projectsIsError
    ? getErrorMessage(projectsQueryError, "Unable to load projects.")
    : mutationError;

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const cardMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openMenuId === null) return;
    const handler = (e: MouseEvent) => {
      if (cardMenuRef.current && !cardMenuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuId]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<Project["status"]>("pending");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([]);
  const [assigneeSearchTerm, setAssigneeSearchTerm] = useState("");
  // Edit state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState<Project["status"]>("pending");
  const [editSelectedAssigneeIds, setEditSelectedAssigneeIds] = useState<
    number[]
  >([]);
  const [editAssigneeSearchTerm, setEditAssigneeSearchTerm] = useState("");

  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();
  const submitting = createProjectMutation.isPending || updateProjectMutation.isPending;
  const deletingProjectId = deleteProjectMutation.isPending
    ? projectToDelete
    : null;

  const createProject = async (event?: React.FormEvent | React.MouseEvent) => {
    if (event) event.preventDefault();
    if (!name.trim()) return;
    setMutationError(null);
    try {
      await createProjectMutation.mutateAsync({
        name,
        description,
        dueDate: dueDate || undefined,
        status,
        assigneeIds: selectedAssigneeIds,
      });
      setName("");
      setDescription("");
      setDueDate("");
      setStatus("pending");
      setSelectedAssigneeIds([]);
      setAssigneeSearchTerm("");
      setShowCreateForm(false);
    } catch (err) {
      setMutationError(getErrorMessage(err, "Unable to create project."));
    }
  };

  const deleteProject = (projectId: number) => {
    setProjectToDelete(projectId);
    setShowDeleteModal(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    setMutationError(null);
    try {
      await deleteProjectMutation.mutateAsync(projectToDelete);
      setShowDeleteModal(false);
      setProjectToDelete(null);
    } catch (err) {
      setMutationError(getErrorMessage(err, "Unable to delete project."));
    }
  };

  const handleEditClick = (project: Project) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description || "");
    setEditDueDate(project.dueDate || "");
    setEditStatus(project.status);
    setEditSelectedAssigneeIds(project.assignees?.map((a) => a.id) || []);
    setEditAssigneeSearchTerm("");
  };

  const updateProject = async (event?: React.FormEvent | React.MouseEvent) => {
    if (event) event.preventDefault();
    if (!editingProject || !editName.trim()) return;
    setMutationError(null);
    try {
      await updateProjectMutation.mutateAsync({
        id: editingProject.id,
        payload: {
          name: editName,
          description: editDescription,
          dueDate: editDueDate || undefined,
          status: editStatus,
          assigneeIds: editSelectedAssigneeIds,
        },
      });
      setEditingProject(null);
    } catch (err) {
      setMutationError(getErrorMessage(err, "Unable to update project."));
    }
  };

  const projectsWithProgress = useMemo(() => {
    const startOfToday = new Date(new Date().toDateString()).getTime();
    return projects.map((p) => {
      const tasks = flattenProjectTasks(p);
      const doneCount = tasks.filter((t) => t.status === "completed").length;
      const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
      const overdueCount = tasks.filter((t) => {
        if (t.status === "completed" || !t.dueDate) return false;
        return new Date(t.dueDate).getTime() < startOfToday;
      }).length;
      const progress =
        tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
      return {
        ...p,
        progress,
        tasksCount: tasks.length,
        doneCount,
        inProgressCount,
        overdueCount,
      };
    });
  }, [projects]);

  // Search/status filtering now happens server-side (see useProjectsPage); this only
  // re-sorts the current page so completed projects sink to the bottom within it.
  const filteredProjects = useMemo(() => {
    return [...projectsWithProgress].sort(
      (a, b) => Number(a.status === "completed") - Number(b.status === "completed"),
    );
  }, [projectsWithProgress]);

  return (
    <div className="w-full min-h-full px-6 py-6 bg-white lg:px-8 lg:py-8">
      {/* Controls */}
      <div className="flex flex-col gap-3 mb-6 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2 pr-3 text-[13px] bg-slate-50 border border-slate-200 rounded-lg pl-9 outline-none focus:border-blue-400 focus:bg-white transition-colors"
          />
        </div>
        <div className="relative sm:min-w-[160px]">
          <Filter className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none left-3 top-1/2 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full py-2 pr-8 text-[13px] font-medium bg-slate-50 border border-slate-200 rounded-lg appearance-none cursor-pointer pl-9 outline-none focus:border-blue-400 focus:bg-white transition-colors"
          >
            <option value="all">All Status</option>
            <option value="in_progress">Active</option>
            <option value="pending">Pending</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
          <ChevronDown className="absolute w-3.5 h-3.5 -translate-y-1/2 pointer-events-none right-3 top-1/2 text-slate-400" />
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        )}
      </div>

      {error && (
        <ErrorBanner
          message={error}
          onDismiss={!projectsIsError ? () => setMutationError(null) : undefined}
          className="mb-4"
        />
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-[248px] bg-white border border-slate-200 rounded-xl shadow-md animate-pulse"
            />
          ))}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProjects.map((project) => {
            const iconStyle =
              PROJECT_ICON_STYLES[project.status] || PROJECT_ICON_STYLES.pending;
            return (
            <div
              key={project.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/${organization?.id}/project/${project.id}/details`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/${organization?.id}/project/${project.id}/details`);
                }
              }}
              className="relative flex flex-col w-full h-full p-5 text-left transition-shadow bg-white border rounded-xl shadow-md cursor-pointer border-slate-200 hover:border-blue-300 hover:shadow-lg group outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {/* Top band: icon + menu */}
              <div className="flex items-start justify-between">
                <div
                  className={`flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-lg ring-1 ring-black/5 ${iconStyle.bg}`}
                >
                  <FolderKanban className={`w-5 h-5 ${iconStyle.text}`} />
                </div>

                {/* 3-dot menu (Admin Only) */}
                {isAdmin && (
                  <div className="relative z-10 flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId((id) => (id === project.id ? null : project.id));
                    }}
                    className={`flex-shrink-0 flex items-center justify-center w-7 h-7 transition-colors rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 ${
                      openMenuId === project.id ? "opacity-100 bg-slate-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                    title="Project options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {openMenuId === project.id && (
                    <div
                      ref={cardMenuRef}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 z-20 mt-1 overflow-hidden bg-white border rounded-lg shadow-lg ring-1 ring-black/5 w-28 border-slate-200"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          handleEditClick(project);
                        }}
                        className="flex items-center w-full gap-2 px-3 py-2 text-[12px] text-left transition-colors text-slate-700 hover:bg-slate-50"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          deleteProject(project.id);
                        }}
                        disabled={deletingProjectId === project.id}
                        className="flex items-center w-full gap-2 px-3 py-2 text-[12px] text-left text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingProjectId === project.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
              </div>

              {/* Name + status/priority */}
              <div className="mt-3">
                <h3 className="font-semibold text-[15px] tracking-tight text-slate-900 truncate">
                  {project.name}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <StatusPill status={project.status} />
                  {project.priority && <PriorityPill priority={project.priority} />}
                </div>
              </div>

              <p className="flex-1 mt-2 text-slate-500 text-[12.5px] line-clamp-2">
                {project.description || "No description provided."}
              </p>

              {/* Progress */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <Eyebrow>Progress</Eyebrow>
                  <span className="text-[11px] font-medium text-slate-500">
                    {project.progress || 0}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-blue-900 transition-all duration-500"
                    style={{ width: `${project.progress || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Meta grid: tasks, deadline, overdue, team */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-3 mt-3 text-[11.5px] border-t border-slate-100">
                <div className="flex items-center min-w-0 gap-1.5 text-slate-600">
                  <Clock3 className="flex-shrink-0 w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">
                    {project.doneCount || 0}/{project.tasksCount || 0} tasks
                  </span>
                </div>
                <div className="flex items-center min-w-0 gap-1.5 text-slate-600">
                  <Calendar className="flex-shrink-0 w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">
                    {project.dueDate
                      ? new Date(project.dueDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                      : "No date"}
                  </span>
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    (project.overdueCount || 0) > 0 ? "text-red-600" : "text-slate-600"
                  }`}
                >
                  <AlertTriangle className="flex-shrink-0 w-3.5 h-3.5" />
                  {project.overdueCount || 0} overdue
                </div>
                <div className="flex items-center justify-end">
                  {project.assignees && project.assignees.length > 0 ? (
                    <div className="flex flex-shrink-0 -space-x-1.5">
                      {project.assignees.slice(0, 3).map((u) => (
                        <div
                          key={u.id}
                          className="w-[22px] h-[22px] rounded-full bg-blue-900 border-2 border-white flex items-center justify-center text-white text-[9px] font-semibold"
                          title={u.fullName}
                        >
                          {u.fullName.charAt(0)}
                        </div>
                      ))}
                      {project.assignees.length > 3 && (
                        <div className="flex items-center justify-center w-[22px] h-[22px] text-[9px] font-semibold text-white border-2 border-white rounded-full bg-slate-400">
                          +{project.assignees.length - 3}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                      <UsersIcon className="w-3.5 h-3.5" /> Unassigned
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white border rounded-xl shadow-md border-slate-200">
          <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
            <svg
              className="w-6 h-6 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
            No projects found
          </h3>
          <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
            {searchQuery || statusFilter !== "all"
              ? "We couldn't find any projects matching your current filters."
              : "Your projects list is currently empty."}
          </p>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="mt-4 bg-white border rounded-xl shadow-md border-slate-200">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* Create Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[88vh] bg-white border rounded-xl shadow-2xl border-slate-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-3.5 border-b border-slate-200">
              <div>
                <Eyebrow>New Project</Eyebrow>
                <h3 className="font-semibold text-[16px] text-slate-900 mt-0.5">
                  Launch New Project
                </h3>
              </div>
              <button
                onClick={() => setShowCreateForm(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={createProject}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="flex-1 min-h-0 px-6 py-4 space-y-4 overflow-y-auto">
                <div>
                  <Eyebrow className="mb-1.5">Project Name</Eyebrow>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 transition-colors"
                    placeholder="e.g. Website Redesign"
                  />
                </div>
                <div>
                  <Eyebrow className="mb-1.5">Description</Eyebrow>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 resize-none transition-colors"
                    rows={2}
                    placeholder="Describe the project goals..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Eyebrow className="mb-1.5">Status</Eyebrow>
                    <div className="relative">
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full px-3 py-2 text-[13px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-400 transition-colors"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">Active</option>
                        <option value="on_hold">On Hold</option>
                        <option value="completed">Completed</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <Eyebrow className="mb-1.5">Deadline</Eyebrow>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] font-medium bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <Eyebrow className="mb-1.5">Assign to Users</Eyebrow>
                  <div className="relative mb-2">
                    <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users by name..."
                      value={assigneeSearchTerm}
                      onChange={(e) => setAssigneeSearchTerm(e.target.value)}
                      className="w-full py-2 pr-3 text-[13px] bg-white border border-slate-200 rounded-lg pl-9 outline-none focus:border-blue-400 transition-colors"
                    />
                  </div>
                  <div className="max-h-28 overflow-y-auto p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                    {users
                      .filter((u) =>
                        u.fullName
                          .toLowerCase()
                          .includes(assigneeSearchTerm.toLowerCase()),
                      )
                      .map((u) => (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedAssigneeIds.includes(u.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAssigneeIds([
                                  ...selectedAssigneeIds,
                                  u.id,
                                ]);
                              } else {
                                setSelectedAssigneeIds(
                                  selectedAssigneeIds.filter((id) => id !== u.id),
                                );
                              }
                            }}
                            className="w-4 h-4 text-blue-900 border-slate-300 rounded focus:ring-blue-900"
                          />
                          <span className="text-[13px] text-slate-700">
                            {u.fullName}
                          </span>
                        </label>
                      ))}
                    {users.filter((u) =>
                      u.fullName
                        .toLowerCase()
                        .includes(assigneeSearchTerm.toLowerCase()),
                    ).length === 0 && (
                      <p className="text-[12px] text-slate-400 italic">
                        No users match "{assigneeSearchTerm}".
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end flex-shrink-0 gap-2 px-6 py-3.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-70 transition-colors"
                >
                  {submitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}{" "}
                  Launch Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[88vh] bg-white border rounded-xl shadow-2xl border-slate-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-3.5 border-b border-slate-200">
              <div>
                <Eyebrow>Edit Project</Eyebrow>
                <h3 className="font-semibold text-[16px] text-slate-900 mt-0.5">
                  Update Project
                </h3>
              </div>
              <button
                onClick={() => setEditingProject(null)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={updateProject}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="flex-1 min-h-0 px-6 py-4 space-y-4 overflow-y-auto">
                <div>
                  <Eyebrow className="mb-1.5">Project Name</Eyebrow>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 transition-colors"
                    placeholder="e.g. Website Redesign"
                  />
                </div>
                <div>
                  <Eyebrow className="mb-1.5">Description</Eyebrow>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 resize-none transition-colors"
                    rows={2}
                    placeholder="Describe the project goals..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Eyebrow className="mb-1.5">Status</Eyebrow>
                    <div className="relative">
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as any)}
                        className="w-full px-3 py-2 text-[13px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-400 transition-colors"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">Active</option>
                        <option value="on_hold">On Hold</option>
                        <option value="completed">Completed</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <Eyebrow className="mb-1.5">Deadline</Eyebrow>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] font-medium bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <Eyebrow className="mb-1.5">Assign to Users</Eyebrow>
                  <div className="relative mb-2">
                    <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users by name..."
                      value={editAssigneeSearchTerm}
                      onChange={(e) => setEditAssigneeSearchTerm(e.target.value)}
                      className="w-full py-2 pr-3 text-[13px] bg-white border border-slate-200 rounded-lg pl-9 outline-none focus:border-blue-400 transition-colors"
                    />
                  </div>
                  <div className="max-h-28 overflow-y-auto p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                    {users
                      .filter((u) =>
                        u.fullName
                          .toLowerCase()
                          .includes(editAssigneeSearchTerm.toLowerCase()),
                      )
                      .map((u) => (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={editSelectedAssigneeIds.includes(u.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditSelectedAssigneeIds([
                                  ...editSelectedAssigneeIds,
                                  u.id,
                                ]);
                              } else {
                                setEditSelectedAssigneeIds(
                                  editSelectedAssigneeIds.filter(
                                    (id) => id !== u.id,
                                  ),
                                );
                              }
                            }}
                            className="w-4 h-4 text-blue-900 border-slate-300 rounded focus:ring-blue-900"
                          />
                          <span className="text-[13px] text-slate-700">
                            {u.fullName}
                          </span>
                        </label>
                      ))}
                    {users.filter((u) =>
                      u.fullName
                        .toLowerCase()
                        .includes(editAssigneeSearchTerm.toLowerCase()),
                    ).length === 0 && (
                      <p className="text-[12px] text-slate-400 italic">
                        No users match "{editAssigneeSearchTerm}".
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end flex-shrink-0 gap-2 px-6 py-3.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-70 transition-colors"
                >
                  {submitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}{" "}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setProjectToDelete(null);
        }}
        onConfirm={confirmDeleteProject}
        message="Are you sure you want to delete this project?"
      />
    </div>
  );
};

export default ProjectsPage;
