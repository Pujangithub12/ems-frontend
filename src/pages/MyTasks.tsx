import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import {
  Plus,
  Search,
  Clock,
  Loader2,
  AlertCircle,
  Building2,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronRight,
  Edit2,
  Paperclip,
  Trash2,
  Calendar,
} from "lucide-react";

type AssignedUser = { id: number; fullName: string; email: string };
type User = { id: number; fullName: string; email: string };
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

const COMPANY_NAMES = [
  "Janda Devi Nepal Energy Pvt Ltd",
  "Bakas Renewable energy Ltd",
  "Troika Energy Pvt Ltd",
  "RR onstruction Pvt Ltd",
  "Grid Tie Pvt Ltd",
  "Janda Devi Biomass Pvt Ltd",
  "Janda Devi Solar Pvt Ltd",
  "Bhojpur Shivalaya Power Pvt Ltd",
  "Green Leaves Pvt Ltd",
  "Usolar Janda Energy Pvt Ltd",
].sort((a, b) => a.localeCompare(b));

type Task = {
  id: number;
  companyName: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  progress: number;
  dueDate: string;
  assignedUsers: AssignedUser[];
  files?: string[];
  createdAt: string;
  subTasks: { id: number; title: string; status: string; children?: any[] }[];
  projectName?: string;
  project?: { id: number; name: string };
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// --- Design System Components ---
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

const StatusPill: React.FC<{ type: "priority" | "status"; value: string }> = ({
  type,
  value,
}) => {
  let bg = "#EEF1F5",
    fg = "#475569",
    label = value;
  const v = value.toLowerCase().replace(/\s+/g, "");
  if (type === "priority") {
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
  } else {
    if (v === "completed") {
      bg = "#DCFCE7";
      fg = "#15803D";
    } else if (v === "inprogress") {
      bg = "#DBEAFE";
      fg = "#1E3A8A";
    } else if (v === "pending") {
      bg = "#FEF3C7";
      fg = "#B45309";
    }
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] tracking-[0.05em] uppercase font-medium"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        background: bg,
        color: fg,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: fg }} />
      {label}
    </span>
  );
};

const MyTasks: React.FC = () => {
  const { user, workspace } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(
    new Set(),
  );
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Add Task Form States
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState("high");
  const [newDueDate, setNewDueDate] = useState("");
  const [newUserIds, setNewUserIds] = useState<number[]>([]);
  const [newAssignAll, setNewAssignAll] = useState(false);
  const [newFiles, setNewFiles] = useState<FileList | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [addTaskError, setAddTaskError] = useState<string | null>(null);
  const [newProgress, setNewProgress] = useState(0);
  const [newProjectId, setNewProjectId] = useState<number | null>(null);

  type ModalSubTask = { id: string; title: string; subTasks?: ModalSubTask[] };
  const [newSubTasks, setNewSubTasks] = useState<ModalSubTask[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState("");

  // Popup States
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Filter state variables
  const [filterProjectName, setFilterProjectName] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  type DetailedSubTask = {
    id: string | number;
    title: string;
    progress?: number;
    history?: { id: string; date: string; title: string; progress: number }[];
    subTasks: DetailedSubTask[];
  };

  const [taskSubTasks, setTaskSubTasks] = useState<
    Record<number, DetailedSubTask[]>
  >({});
  const [expandedNestedSubTasks, setExpandedNestedSubTasks] = useState<
    Set<string>
  >(new Set());

  // Sub-task specific states
  const [newSubTaskTitle, setNewSubTaskTitle] = useState<
    Record<number, string>
  >({});
  const [showSubTaskUpdatePopup, setShowSubTaskUpdatePopup] = useState(false);
  const [editingSubTask, setEditingSubTask] = useState<DetailedSubTask | null>(
    null,
  );
  const [newSubTaskUpdateTitle, setNewSubTaskUpdateTitle] = useState("");
  const [subTaskProgress, setSubTaskProgress] = useState(0);
  const [subTaskUpdateFiles, setSubTaskUpdateFiles] = useState<FileList | null>(
    null,
  );
  const [showSubTaskActivityPopup, setShowSubTaskActivityPopup] =
    useState(false);
  const [subTaskComments, setSubTaskComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [feedbackTexts, setFeedbackTexts] = useState<Record<number, string>>(
    {},
  );

  const convertToDetailed = (subTasks: any[]): DetailedSubTask[] => {
    return subTasks.map((st) => ({
      id: st.id,
      title: st.title,
      progress: st.progress || 0,
      history: st.history || [],
      subTasks: convertToDetailed(st.children || st.subTasks || []),
    }));
  };

  const computeAverageLeafProgress = (subTasks: DetailedSubTask[]): number => {
    let sum = 0,
      count = 0;
    const visit = (list: DetailedSubTask[]) => {
      for (const st of list) {
        const children = st.subTasks || [];
        if (children.length > 0) visit(children);
        else {
          sum += Math.max(
            0,
            Math.min(100, typeof st.progress === "number" ? st.progress : 0),
          );
          count += 1;
        }
      }
    };
    visit(subTasks || []);
    return count === 0 ? 0 : Math.round(sum / count);
  };

  const buildSubTasksMap = (taskList: Task[]) => {
    const subTasksMap: Record<number, DetailedSubTask[]> = {};
    taskList.forEach((task) => {
      subTasksMap[task.id] = convertToDetailed(task.subTasks || []);
    });
    return subTasksMap;
  };

  const loadData = async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const [tasksRes, usersRes, projectsRes] = await Promise.all([
        api.get<any>("/api/tasks"),
        api.get<User[]>("/api/users"),
        api.get<Project[]>("/api/projects"),
      ]);
      let taskList: Task[] = [];
      if (Array.isArray(tasksRes.data)) taskList = tasksRes.data;
      else if (tasksRes.data?.task) taskList = [tasksRes.data.task];
      else if (tasksRes.data?.tasks) taskList = tasksRes.data.tasks;

      const subTasksMap = buildSubTasksMap(taskList);
      setTaskSubTasks(subTasksMap);
      setTasks(
        taskList.map((t) => {
          const detailed = subTasksMap[t.id] || [];
          return detailed.length === 0
            ? t
            : { ...t, progress: computeAverageLeafProgress(detailed) };
        }),
      );
      setUsers(
        [...usersRes.data].sort((a, b) => a.fullName.localeCompare(b.fullName)),
      );
      setProjects(projectsRes.data);
    } catch (err: any) {
      setTasksError(
        err?.response?.data?.message ||
          err.message ||
          "Unable to load my tasks.",
      );
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspace?.id]);

  const toggleCompany = (companyName: string) => {
    setExpandedCompanies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(companyName)) newSet.delete(companyName);
      else newSet.add(companyName);
      return newSet;
    });
  };

  const openPopup = (task: Task) => setSelectedTask(task);
  const closePopup = () => setSelectedTask(null);

  const openAddTaskModal = () => {
    if (user) setNewUserIds([Number(user.id)]);
    setShowAddTaskForm(true);
    setSelectedTask(null);
    setAddTaskError(null);
    setNewProgress(0);
    setNewProjectId(null);
    setNewSubTasks([]);
  };

  const closeTaskModal = () => {
    setShowAddTaskForm(false);
    setSelectedTask(null);
    setAddTaskError(null);
    setUserSearchTerm("");
    setNewProgress(0);
    setNewProjectId(null);
    setNewSubTasks([]);
    setNewUserIds([]);
  };

  const handleAddTask = async (event: React.FormEvent) => {
    event.preventDefault();
    setAddTaskError(null);
    setAddingTask(true);
    try {
      const formData = new FormData();
      formData.append("companyName", newCompanyName);
      formData.append("title", newTitle);
      formData.append("description", newDescription);
      formData.append("priority", newPriority);
      formData.append("dueDate", newDueDate);
      formData.append("assignAll", String(newAssignAll));
      formData.append("userIds", newUserIds.join(","));
      formData.append("progress", String(newProgress));
      formData.append("subTasks", JSON.stringify(newSubTasks));
      if (newProjectId) {
        const selectedProject = projects.find((p) => p.id === newProjectId);
        formData.append("projectId", String(newProjectId));
        if (selectedProject)
          formData.append("projectName", selectedProject.name);
      }
      if (newFiles)
        for (let i = 0; i < newFiles.length; i++)
          formData.append("files", newFiles[i]);

      const response = await api.post<any>("/api/tasks", formData);
      const task: Task = response.data.task || response.data;
      setTasks((prev) => [task, ...prev]);
      setTaskSubTasks((prev) => ({
        ...prev,
        [task.id]: convertToDetailed(task.subTasks || []),
      }));
      closeTaskModal();
    } catch (err: any) {
      setAddTaskError(
        err?.response?.data?.message || err.message || "Unable to add task.",
      );
    } finally {
      setAddingTask(false);
    }
  };

  const addSubTaskToTask = async (
    taskId: number,
    parentId?: string,
    overrideTitle?: string,
  ) => {
    const title = overrideTitle ?? (newSubTaskTitle[taskId] || "");
    if (!title.trim()) return;
    const newSubTask: DetailedSubTask = {
      id: `temp-${Date.now()}`,
      title,
      subTasks: [],
    };
    let updatedSubTasks: DetailedSubTask[];
    if (parentId) {
      const updateNested = (subTasks: DetailedSubTask[]): DetailedSubTask[] =>
        subTasks.map((st) =>
          st.id.toString() === parentId
            ? { ...st, subTasks: [...st.subTasks, newSubTask] }
            : { ...st, subTasks: updateNested(st.subTasks) },
        );
      updatedSubTasks = updateNested(taskSubTasks[taskId] || []);
    } else {
      updatedSubTasks = [...(taskSubTasks[taskId] || []), newSubTask];
    }
    setTaskSubTasks((prev) => ({ ...prev, [taskId]: updatedSubTasks }));
    if (!overrideTitle)
      setNewSubTaskTitle((prev) => ({ ...prev, [taskId]: "" }));

    try {
      const res = await api.post(`/api/tasks/${taskId}/subtasks`, {
        title,
        parentSubTaskId: parentId,
      });
      if (res.data.subTasks) {
        const detailed = convertToDetailed(res.data.subTasks);
        setTaskSubTasks((prev) => ({ ...prev, [taskId]: detailed }));
        const avg = computeAverageLeafProgress(detailed);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, progress: avg } : t)),
        );
        setSelectedTask((prev) =>
          prev && prev.id === taskId ? { ...prev, progress: avg } : prev,
        );
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to save sub-task.");
    }
  };

  const handleSubTaskUpdate = async () => {
    if (!editingSubTask || !selectedTask) return;
    try {
      const taskId = selectedTask.id;
      await api.put(`/api/tasks/${taskId}/subtasks/${editingSubTask.id}`, {
        title: newSubTaskUpdateTitle,
        progress: subTaskProgress,
      });
      const res = await api.get(`/api/tasks/${taskId}/subtasks`);
      const detailed = convertToDetailed(res.data);
      setTaskSubTasks((prev) => ({ ...prev, [taskId]: detailed }));
      const avg = computeAverageLeafProgress(detailed);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, progress: avg } : t)),
      );
      setSelectedTask((prev) =>
        prev && prev.id === taskId ? { ...prev, progress: avg } : prev,
      );
      setShowSubTaskUpdatePopup(false);
      setEditingSubTask(null);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to update sub-task.");
    }
  };

  const renderSubTaskItem = (
    st: DetailedSubTask,
    level: number = 0,
  ): React.ReactNode => {
    const safeChildren = st.subTasks || [];
    const isExpanded = expandedNestedSubTasks.has(st.id.toString());
    return (
      <div
        key={st.id}
        className="overflow-hidden border rounded border-slate-200"
      >
        <div
          className="flex items-center justify-between py-2 pr-2 transition-colors bg-white hover:bg-slate-50"
          style={{ paddingLeft: `${level * 16 + 10}px` }}
        >
          <div className="flex items-center min-w-0 gap-2">
            {safeChildren.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setExpandedNestedSubTasks((prev) => {
                    const next = new Set(prev);
                    if (next.has(st.id.toString()))
                      next.delete(st.id.toString());
                    else next.add(st.id.toString());
                    return next;
                  });
                }}
                className="p-0.5 text-slate-400 hover:text-blue-900 flex-shrink-0"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <div className="flex-shrink-0 w-4 h-4" />
            )}
            <span className="text-[13px] text-slate-700 truncate">
              {st.title}
            </span>
          </div>
          <div className="flex flex-shrink-0 gap-1">
            <button
              type="button"
              className="p-1 transition-colors rounded text-slate-400 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={() => {
                setEditingSubTask(st);
                setNewSubTaskUpdateTitle(st.title);
                setSubTaskProgress(st.progress || 0);
                setShowSubTaskUpdatePopup(true);
              }}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="p-1 transition-colors rounded text-slate-400 hover:text-blue-900 hover:bg-blue-50"
              onClick={async () => {
                setEditingSubTask(st);
                try {
                  const res = await api.get(
                    `/api/tasks/${selectedTask?.id}/subtasks/${st.id}/comments`,
                  );
                  setSubTaskComments(res.data);
                } catch (err) {
                  setSubTaskComments([]);
                }
                setShowSubTaskActivityPopup(true);
              }}
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {safeChildren.length > 0 && isExpanded && (
          <div className="border-t border-slate-200 bg-slate-50/50">
            {safeChildren.map((child) => renderSubTaskItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredTasks = tasks.filter((task) => {
    const isAssigned = user
      ? task.assignedUsers.some((u) => u.id === Number(user.id))
      : false;
    if (!isAssigned) return false;
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.companyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProject = filterProjectName
      ? (task.projectName || "")
          .toLowerCase()
          .includes(filterProjectName.toLowerCase())
      : true;
    const matchesPriority = filterPriority
      ? task.priority.toLowerCase() === filterPriority.toLowerCase()
      : true;
    const matchesStatus = filterStatus
      ? task.status.toLowerCase().replace(/\s+/g, "") ===
        filterStatus.toLowerCase().replace(/\s+/g, "")
      : true;
    return matchesSearch && matchesProject && matchesPriority && matchesStatus;
  });

  const groupedTasks = filteredTasks.reduce(
    (acc, task) => {
      const key = task.companyName || "Unassigned";
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    },
    {} as Record<string, Task[]>,
  );

  return (
    <div className="p-6 space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search my tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-2 pr-3 text-[13px] bg-white border border-slate-200 rounded pl-9 outline-none focus:border-blue-900 transition-colors"
          />
        </div>
        <button
          onClick={openAddTaskModal}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add My Own Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <Eyebrow className="mb-1.5">Project Name</Eyebrow>
          <input
            type="text"
            placeholder="Search project..."
            value={filterProjectName}
            onChange={(e) => setFilterProjectName(e.target.value)}
            className="px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
          />
        </div>
        <div>
          <Eyebrow className="mb-1.5">Priority</Eyebrow>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 text-[13px] font-medium bg-white border border-slate-200 rounded appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors"
          >
            <option value="">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <Eyebrow className="mb-1.5">Status</Eyebrow>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-[13px] font-medium bg-white border border-slate-200 rounded appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="inprogress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Content Table */}
      <div className="overflow-hidden bg-white border rounded-md border-slate-200">
        {tasksLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
            <div
              className="text-[11px] text-slate-400 tracking-[0.1em] uppercase"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Loading tasks
            </div>
          </div>
        ) : tasksError ? (
          <div className="m-6 p-4 bg-red-50 border border-red-100 rounded flex items-center gap-3 text-red-700 text-[13px]">
            <AlertCircle className="flex-shrink-0 w-4 h-4" />
            <span>{tasksError}</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
              <CheckCircle2 className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
              No tasks found
            </h3>
            <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
              You don't have any tasks matching the current filters.
            </p>
          </div>
        ) : (
          <div>
            {Object.entries(groupedTasks).map(([companyName, companyTasks]) => (
              <div
                key={companyName}
                className="border-b border-slate-200 last:border-0"
              >
                <button
                  onClick={() => toggleCompany(companyName)}
                  className="flex items-center justify-between w-full px-5 py-3 bg-[#EEF1F5]/50 hover:bg-[#EEF1F5] transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    {expandedCompanies.has(companyName) ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <Building2 className="w-4 h-4 text-blue-900" />
                    <span className="text-[13px] font-medium text-slate-900">
                      {companyName}
                    </span>
                    <span
                      className="px-1.5 py-0.5 text-[10px] font-medium bg-white border border-slate-200 rounded text-slate-500"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {companyTasks.length} tasks
                    </span>
                  </div>
                </button>

                {expandedCompanies.has(companyName) && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead
                        className="bg-[#EEF1F5]/30 text-left text-slate-400"
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        <tr>
                          <th className="px-5 py-2.5 font-medium">Task</th>
                          <th className="px-5 py-2.5 font-medium">Project</th>
                          <th className="px-5 py-2.5 font-medium text-center">
                            Priority
                          </th>
                          <th className="px-5 py-2.5 font-medium text-center">
                            Progress & Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {companyTasks.map((task) => (
                          <tr
                            key={task.id}
                            className="transition-colors border-t border-slate-200 hover:bg-slate-50"
                          >
                            <td className="px-5 py-3">
                              <button
                                onClick={() => openPopup(task)}
                                className="text-left"
                              >
                                <p className="text-[13px] font-medium text-slate-900 hover:text-blue-900 transition-colors">
                                  {task.title}
                                </p>
                                <p className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                                  <Clock className="w-3 h-3" /> Due{" "}
                                  {formatDate(task.dueDate)}
                                </p>
                              </button>
                            </td>
                            <td className="px-5 py-3">
                              <span className="text-[13px] font-medium text-blue-900">
                                {task.projectName || "-"}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <StatusPill
                                type="priority"
                                value={task.priority}
                              />
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex flex-col items-center gap-1.5 min-w-[120px]">
                                <div className="w-full h-1 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full bg-blue-900 rounded-full"
                                    style={{ width: `${task.progress}%` }}
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="text-[11px] font-medium text-slate-700"
                                    style={{
                                      fontFamily: "'JetBrains Mono', monospace",
                                    }}
                                  >
                                    {task.progress}%
                                  </span>
                                  <StatusPill
                                    type="status"
                                    value={task.status}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Details Popup */}
      {selectedTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/45">
          <div className="w-full max-w-2xl bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>{selectedTask.companyName}</Eyebrow>
                <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">
                  {selectedTask.title}
                </h3>
              </div>
              <button
                onClick={closePopup}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="p-3 border rounded border-slate-200">
                  <Eyebrow>Project Name</Eyebrow>
                  <p className="font-semibold text-[15px] text-slate-900 mt-1">
                    {selectedTask.projectName || "N/A"}
                  </p>
                </div>
                <div className="p-3 border rounded border-slate-200">
                  <Eyebrow>Due Date</Eyebrow>
                  <p className="font-medium text-[13px] text-slate-900 mt-1">
                    {new Date(selectedTask.dueDate || "").toLocaleDateString(
                      "en-US",
                      { year: "numeric", month: "long", day: "numeric" },
                    )}
                  </p>
                </div>
                <div className="p-3 border rounded border-slate-200">
                  <Eyebrow>Progress</Eyebrow>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="font-semibold text-[20px] tracking-tight text-blue-900">
                      {selectedTask.progress}%
                    </span>
                  </div>
                  <div className="w-full h-1 mt-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-blue-900 rounded-full"
                      style={{ width: `${selectedTask.progress || 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="p-4 border rounded border-slate-200">
                  <Eyebrow className="mb-2">Description</Eyebrow>
                  <p className="text-slate-600 text-[13px] leading-relaxed whitespace-pre-wrap">
                    {selectedTask.description || "No description provided."}
                  </p>
                </div>
                <div className="p-4 border rounded border-slate-200">
                  <Eyebrow className="mb-2">Assigned To</Eyebrow>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.assignedUsers.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded"
                      >
                        <div className="w-5 h-5 rounded-full bg-blue-900 flex items-center justify-center text-white text-[9px] font-semibold">
                          {u.fullName.charAt(0)}
                        </div>
                        <span className="text-[12px] font-medium text-slate-700">
                          {u.fullName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded border-slate-200">
                <Eyebrow className="mb-3">Sub-Tasks</Eyebrow>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newSubTaskTitle[selectedTask.id] || ""}
                    onChange={(e) =>
                      setNewSubTaskTitle((prev) => ({
                        ...prev,
                        [selectedTask.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSubTaskToTask(selectedTask.id);
                      }
                    }}
                    className="flex-1 px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                    placeholder="Enter sub-task title"
                  />
                  <button
                    type="button"
                    onClick={() => addSubTaskToTask(selectedTask.id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {(taskSubTasks[selectedTask.id] || []).length === 0 ? (
                    <p className="py-4 text-center text-slate-400 text-[12px]">
                      No sub-tasks yet
                    </p>
                  ) : (
                    (taskSubTasks[selectedTask.id] || []).map((st) =>
                      renderSubTaskItem(st),
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-task Update Popup */}
      {showSubTaskUpdatePopup && editingSubTask && selectedTask && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-6 bg-slate-900/45">
          <div className="w-full max-w-lg bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>Update Sub-Task</Eyebrow>
                <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">
                  {selectedTask.title}
                </h3>
              </div>
              <button
                onClick={() => setShowSubTaskUpdatePopup(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-6 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-10">
                <div className="md:col-span-7">
                  <Eyebrow className="mb-1.5">New Sub-Task Update</Eyebrow>
                  <input
                    type="text"
                    value={newSubTaskUpdateTitle}
                    onChange={(e) => setNewSubTaskUpdateTitle(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                    placeholder="Enter new sub-task title"
                  />
                </div>
                <div className="md:col-span-3">
                  <Eyebrow className="mb-1.5">Attachment</Eyebrow>
                  <div className="relative">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => setSubTaskUpdateFiles(e.target.files)}
                      className="hidden"
                      id="subtask-attachment"
                    />
                    <label
                      htmlFor="subtask-attachment"
                      className="flex flex-col items-center justify-center w-full gap-1 px-3 py-2 text-[11px] transition-all border-2 border-dashed cursor-pointer rounded bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-900 hover:text-blue-900 group"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      {subTaskUpdateFiles?.length
                        ? `${subTaskUpdateFiles.length} file(s)`
                        : "Select"}
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Eyebrow>Progress</Eyebrow>
                  <span
                    className="text-[12px] font-medium text-slate-600"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {subTaskProgress}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={subTaskProgress}
                  onChange={(e) => setSubTaskProgress(Number(e.target.value))}
                  className="w-full accent-blue-900"
                />
              </div>

              <div>
                <Eyebrow className="mb-1.5">Previous Updates</Eyebrow>
                <div className="p-3 rounded border border-slate-200 bg-slate-50/50 min-h-[60px] max-h-[120px] overflow-y-auto space-y-2">
                  {editingSubTask.history &&
                  editingSubTask.history.length > 0 ? (
                    editingSubTask.history.slice(0, 2).map((hist) => (
                      <div
                        key={hist.id}
                        className="text-[12px] text-slate-600 border-b border-slate-200 pb-1.5 last:border-0"
                      >
                        <p className="font-medium text-slate-800">
                          {hist.title}{" "}
                          <span className="font-normal text-slate-500">
                            ({hist.progress}%)
                          </span>
                        </p>
                        <p
                          className="text-[10px] text-slate-400 mt-0.5"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {new Date(hist.date).toLocaleString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="py-2 text-[12px] italic text-center text-slate-500">
                      No previous updates available
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
              <button
                type="button"
                onClick={() => {
                  setShowSubTaskUpdatePopup(false);
                  setEditingSubTask(null);
                }}
                className="flex-1 px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubTaskUpdate}
                className="flex-1 px-4 py-2 text-[13px] font-medium text-white bg-emerald-700 rounded hover:bg-emerald-800 transition-colors"
              >
                Update
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSubTaskUpdatePopup(false);
                  setShowSubTaskActivityPopup(true);
                }}
                className="flex-1 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
              >
                Activity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-task Activity Popup */}
      {showSubTaskActivityPopup && editingSubTask && selectedTask && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-slate-900/45">
          <div className="w-full max-w-lg bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>Activity & Feedback</Eyebrow>
                <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">
                  {editingSubTask.title}
                </h3>
              </div>
              <button
                onClick={() => setShowSubTaskActivityPopup(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-6 space-y-5 overflow-y-auto">
              <div>
                <Eyebrow className="mb-2">Progress History</Eyebrow>
                <div className="space-y-2">
                  {editingSubTask.history &&
                  editingSubTask.history.length > 0 ? (
                    editingSubTask.history.map((hist: any) => (
                      <div
                        key={hist.id}
                        className="p-3 border rounded border-slate-200"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-5 h-5 rounded-full bg-blue-900 flex items-center justify-center text-white text-[9px] font-semibold">
                            {hist.authorName?.charAt(0) || "U"}
                          </div>
                          <span className="text-[12px] font-medium text-slate-700">
                            {hist.authorName || "Unknown User"}
                          </span>
                          <span
                            className="text-[10px] text-slate-400"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {new Date(hist.date).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[12px] font-medium text-slate-800">
                          {hist.title}{" "}
                          <span className="font-normal text-slate-500">
                            ({hist.progress}%)
                          </span>
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="py-2 text-[12px] italic text-center text-slate-500">
                      No history yet
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Eyebrow className="mb-2">Comments & Feedback</Eyebrow>
                <div className="space-y-3">
                  {subTaskComments.map((comment: any) => (
                    <div
                      key={comment.id}
                      className="p-3 border rounded border-slate-200"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-5 h-5 rounded-full bg-blue-900 flex items-center justify-center text-white text-[9px] font-semibold">
                          {comment.author.fullName.charAt(0)}
                        </div>
                        <span className="text-[12px] font-medium text-slate-700">
                          {comment.author.fullName}
                        </span>
                        <span
                          className="text-[10px] text-slate-400"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mb-2 text-[13px] text-slate-800">
                        {comment.commentText}
                      </p>
                      {comment.feedback && (
                        <div className="p-2 border border-blue-100 rounded bg-blue-50">
                          <p
                            className="text-[10px] font-bold text-blue-900 uppercase tracking-wider mb-0.5"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            Feedback
                          </p>
                          <p className="text-[12px] text-slate-700">
                            {comment.feedback}
                          </p>
                        </div>
                      )}
                      {!comment.feedback &&
                        (user?.role === "admin" ||
                          user?.role === "super_admin") && (
                          <div className="flex gap-2 mt-2">
                            <input
                              type="text"
                              placeholder="Add feedback..."
                              value={feedbackTexts[comment.id] || ""}
                              onChange={(e) =>
                                setFeedbackTexts({
                                  ...feedbackTexts,
                                  [comment.id]: e.target.value,
                                })
                              }
                              className="flex-1 px-2.5 py-1.5 text-[12px] bg-white rounded border border-slate-200 outline-none focus:border-blue-900 transition-colors"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                if (!feedbackTexts[comment.id]) {
                                  alert("Please enter some feedback first!");
                                  return;
                                }
                                try {
                                  await api.put(
                                    `/api/tasks/${selectedTask?.id}/subtasks/${editingSubTask?.id}/comments/${comment.id}/feedback`,
                                    { feedback: feedbackTexts[comment.id] },
                                  );
                                  const res = await api.get(
                                    `/api/tasks/${selectedTask?.id}/subtasks/${editingSubTask?.id}/comments`,
                                  );
                                  setSubTaskComments(res.data);
                                  setFeedbackTexts({
                                    ...feedbackTexts,
                                    [comment.id]: "",
                                  });
                                } catch (err: any) {
                                  alert(
                                    err?.response?.data?.message ||
                                      "Failed to send feedback!",
                                  );
                                }
                              }}
                              className="px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
                            >
                              Send
                            </button>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
              <input
                type="text"
                placeholder="Add a comment..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && newCommentText.trim()) {
                    e.preventDefault();
                    try {
                      await api.post(
                        `/api/tasks/${selectedTask.id}/subtasks/${editingSubTask.id}/comments`,
                        { commentText: newCommentText },
                      );
                      const res = await api.get(
                        `/api/tasks/${selectedTask.id}/subtasks/${editingSubTask.id}/comments`,
                      );
                      setSubTaskComments(res.data);
                      setNewCommentText("");
                    } catch (err) {
                      console.error("Failed to add comment", err);
                    }
                  }
                }}
                className="flex-1 px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!newCommentText.trim()) return;
                  try {
                    await api.post(
                      `/api/tasks/${selectedTask.id}/subtasks/${editingSubTask.id}/comments`,
                      { commentText: newCommentText },
                    );
                    const res = await api.get(
                      `/api/tasks/${selectedTask.id}/subtasks/${editingSubTask.id}/comments`,
                    );
                    setSubTaskComments(res.data);
                    setNewCommentText("");
                  } catch (err) {
                    console.error("Failed to add comment", err);
                  }
                }}
                className="px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Creation Modal */}
      {showAddTaskForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/45">
          <div className="w-full max-w-lg bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>New Task</Eyebrow>
                <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">
                  Add My Own Task
                </h3>
              </div>
              <button
                onClick={closeTaskModal}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={handleAddTask}
              className="flex-1 p-6 space-y-5 overflow-y-auto"
            >
              {addTaskError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded flex items-center gap-2 text-[13px]">
                  <AlertCircle className="flex-shrink-0 w-4 h-4" />
                  <span>{addTaskError}</span>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Eyebrow className="mb-1.5">Company</Eyebrow>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      required
                      className="w-full pl-9 pr-4 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors appearance-none"
                    >
                      <option value="" disabled>
                        Select company
                      </option>
                      {COMPANY_NAMES.map((company, idx) => (
                        <option key={idx} value={company}>
                          {company}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <Eyebrow className="mb-1.5">Project Name</Eyebrow>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={newProjectId || ""}
                      onChange={(e) =>
                        setNewProjectId(
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                      className="w-full pl-9 pr-4 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors appearance-none"
                    >
                      <option value="" disabled>
                        Select a project
                      </option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Eyebrow className="mb-1.5">Task Title</Eyebrow>
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                    placeholder="Task title"
                  />
                </div>
                <div>
                  <Eyebrow className="mb-1.5">Priority</Eyebrow>
                  <div className="relative">
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors appearance-none"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <Eyebrow className="mb-1.5">Due Date</Eyebrow>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Eyebrow className="mb-1.5">Description</Eyebrow>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 resize-none transition-colors"
                  placeholder="Task description"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <Eyebrow>Sub-Tasks</Eyebrow>
                  <button
                    type="button"
                    onClick={() =>
                      setNewSubTasks([
                        ...newSubTasks,
                        { id: Date.now().toString(), title: "", subTasks: [] },
                      ])
                    }
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="min-h-[80px] p-3 space-y-2 rounded border border-slate-200 bg-slate-50/50">
                  {newSubTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-4 text-center text-slate-400">
                      <p className="text-[12px]">No sub-tasks yet</p>
                    </div>
                  ) : (
                    newSubTasks.map((subTask, idx) => (
                      <div
                        key={subTask.id}
                        className="flex items-center gap-2 p-2 bg-white border rounded border-slate-200"
                      >
                        <input
                          value={subTask.title}
                          onChange={(e) => {
                            const updated = [...newSubTasks];
                            updated[idx] = {
                              ...subTask,
                              title: e.target.value,
                            };
                            setNewSubTasks(updated);
                          }}
                          className="flex-1 px-2.5 py-1.5 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                          placeholder="Sub-task title"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const u = [...newSubTasks];
                            u.splice(idx, 1);
                            setNewSubTasks(u);
                          }}
                          className="p-1 transition-colors rounded text-slate-400 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <Eyebrow className="mb-1.5">Attachments</Eyebrow>
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setNewFiles(e.target.files)}
                    className="hidden"
                    id="mytask-files"
                  />
                  <label
                    htmlFor="mytask-files"
                    className="flex items-center justify-center w-full gap-2 px-4 py-3 text-[12px] transition-all border-2 border-dashed cursor-pointer rounded bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-900 hover:text-blue-900 group"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    {newFiles?.length ? (
                      <span className="font-medium">
                        {newFiles.length} files selected
                      </span>
                    ) : (
                      "Upload task resources"
                    )}
                  </label>
                </div>
              </div>

              <div className="flex justify-end flex-shrink-0 gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
                <button
                  type="button"
                  onClick={closeTaskModal}
                  className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingTask}
                  className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-70 transition-colors"
                >
                  {addingTask ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}{" "}
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTasks;
