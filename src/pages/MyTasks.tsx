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
  Filter,
  Trash2,
  Users as UsersIcon,
  Calendar,
} from "lucide-react";

type AssignedUser = {
  id: number;
  fullName: string;
  email: string;
};

type User = {
  id: number;
  fullName: string;
  email: string;
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
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const MyTasks: React.FC = () => {
  const { user } = useAuth();
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
  const [newProjectName, setNewProjectName] = useState("");

  type ModalSubTask = {
    id: string;
    title: string;
    subTasks?: ModalSubTask[];
  };
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
    let sum = 0;
    let count = 0;

    const visit = (list: DetailedSubTask[]) => {
      for (const st of list) {
        const children = st.subTasks || [];
        if (children.length > 0) {
          visit(children);
        } else {
          const v = typeof st.progress === "number" ? st.progress : 0;
          const clamped = Math.max(0, Math.min(100, v));
          sum += clamped;
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
      if (Array.isArray(tasksRes.data)) {
        taskList = tasksRes.data;
      } else if (tasksRes.data?.task) {
        taskList = [tasksRes.data.task];
      } else if (tasksRes.data?.tasks) {
        taskList = tasksRes.data.tasks;
      }
      const subTasksMap = buildSubTasksMap(taskList);
      setTaskSubTasks(subTasksMap);
      setTasks(
        taskList.map((t) => {
          const detailed = subTasksMap[t.id] || [];
          if (detailed.length === 0) return t;
          return { ...t, progress: computeAverageLeafProgress(detailed) };
        }),
      );

      const sortedUsers = [...usersRes.data].sort((a, b) =>
        a.fullName.localeCompare(b.fullName),
      );
      setUsers(sortedUsers);
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
  }, []);

  const toggleCompany = (companyName: string) => {
    setExpandedCompanies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(companyName)) newSet.delete(companyName);
      else newSet.add(companyName);
      return newSet;
    });
  };

  const openPopup = (task: Task) => {
    setSelectedTask(task);
  };

  const closePopup = () => {
    setSelectedTask(null);
  };

  const openAddTaskModal = () => {
    // Pre-select current user
    if (user) {
      setNewUserIds([Number(user.id)]);
    }
    setShowAddTaskForm(true);
    setSelectedTask(null);
    setAddTaskError(null);
    setNewProgress(0);
    setNewProjectName("");
    setNewSubTasks([]);
  };

  const closeTaskModal = () => {
    setShowAddTaskForm(false);
    setSelectedTask(null);
    setAddTaskError(null);
    setUserSearchTerm("");
    setNewProgress(0);
    setNewProjectName("");
    setNewSubTasks([]);
    setNewUserIds([]);
  };

  const addModalSubTask = () => {
    setNewSubTasks([...newSubTasks, { id: Date.now().toString(), title: "" }]);
  };

  const removeModalSubTask = (id: string) => {
    const removeNested = (list: ModalSubTask[]): ModalSubTask[] =>
      list
        .filter((st) => st.id !== id)
        .map((st) => ({
          ...st,
          subTasks: st.subTasks ? removeNested(st.subTasks) : undefined,
        }));
    setNewSubTasks(removeNested(newSubTasks));
  };

  const updateModalSubTask = (id: string, title: string) => {
    const updateNested = (list: ModalSubTask[]): ModalSubTask[] =>
      list.map((st) => {
        if (st.id === id) {
          return { ...st, title };
        }
        if (st.subTasks) {
          return { ...st, subTasks: updateNested(st.subTasks) };
        }
        return st;
      });
    setNewSubTasks(updateNested(newSubTasks));
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
      if (newProjectName) formData.append("projectName", newProjectName);
      if (newFiles) {
        for (let i = 0; i < newFiles.length; i++) {
          formData.append("files", newFiles[i]);
        }
      }

      const response = await api.post<any>("/api/tasks", formData);
      const task: Task = response.data.task || response.data;
      setTasks((prev) => [task, ...prev]);
      const detailed = convertToDetailed(task.subTasks || []);
      setTaskSubTasks((prev) => ({
        ...prev,
        [task.id]: detailed,
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
        subTasks.map((st) => {
          if (st.id.toString() === parentId) {
            return { ...st, subTasks: [...st.subTasks, newSubTask] };
          }
          return { ...st, subTasks: updateNested(st.subTasks) };
        });
      updatedSubTasks = updateNested(taskSubTasks[taskId] || []);
    } else {
      updatedSubTasks = [...(taskSubTasks[taskId] || []), newSubTask];
    }

    setTaskSubTasks((prev) => ({ ...prev, [taskId]: updatedSubTasks }));

    if (!overrideTitle) {
      setNewSubTaskTitle((prev) => ({ ...prev, [taskId]: "" }));
    }

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
      console.error("Error adding sub-task", err);
      alert(
        err?.response?.data?.message ||
          err.message ||
          "Failed to save sub-task. Please try again.",
      );
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
      console.error("Error updating sub-task", err);
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
        className="overflow-hidden bg-white border rounded-xl border-slate-100"
      >
        <div
          className="flex items-center justify-between py-2 pr-3"
          style={{ paddingLeft: `${level * 20 + 12}px` }}
        >
          <div className="flex items-center gap-2">
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
                className="p-0.5 text-slate-400 hover:text-indigo-600"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <div className="w-4 h-4" />
            )}
            <span className="text-sm text-slate-700">{st.title}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="p-1.5 rounded-lg transition-all text-slate-400 hover:text-green-600 hover:bg-green-50"
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
              className="p-1.5 rounded-lg transition-all text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
              onClick={async () => {
                setEditingSubTask(st);
                try {
                  const res = await api.get(
                    `/api/tasks/${selectedTask?.id}/subtasks/${st.id}/comments`,
                  );
                  setSubTaskComments(res.data);
                } catch (err) {
                  console.error("Failed to fetch comments", err);
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
          <div className="border-t border-slate-100">
            {safeChildren.map((child) => renderSubTaskItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredTasks = tasks.filter((task) => {
    // Only show tasks where current user is in assigned users
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

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-700 border-red-200";
      case "medium":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "low":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase().replace(/\s+/g, "")) {
      case "completed":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "inprogress":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "pending":
        return "bg-amber-100 text-amber-700 border-amber-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="pb-12 space-y-8">
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">My Tasks</h2>
            <p className="mt-1 text-sm text-slate-500">
              Tasks assigned to you by admins or other users.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute w-4 h-4 -translate-y-1/2 left-4 top-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search my tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="py-3 pr-4 border pl-11 rounded-3xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <button
              onClick={openAddTaskModal}
              className="flex gap-2 items-center px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-2xl shadow-lg transition-all hover:bg-indigo-700 shadow-indigo-200 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Add My Own Task
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="space-y-1">
            <label className="ml-1 text-xs font-semibold text-slate-600">
              Project Name
            </label>
            <input
              type="text"
              placeholder="Search project..."
              value={filterProjectName}
              onChange={(e) => setFilterProjectName(e.target.value)}
              className="px-4 py-2 text-sm border rounded-2xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="ml-1 text-xs font-semibold text-slate-600">
              Priority
            </label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-2 text-sm border rounded-2xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="ml-1 text-xs font-semibold text-slate-600">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 text-sm border rounded-2xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="inprogress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {tasksLoading ? (
          <div className="flex flex-col justify-center items-center px-4 py-20 text-center bg-slate-50 rounded-[32px] border border-slate-200">
            <Loader2 className="w-10 h-10 mx-auto text-indigo-600 animate-spin" />
            <p className="mt-4 text-slate-500">Loading your tasks...</p>
          </div>
        ) : tasksError ? (
          <div className="flex items-center gap-4 p-6 font-medium border text-rose-700 bg-rose-50 rounded-2xl border-rose-100">
            <AlertCircle className="w-6 h-6" />
            {tasksError}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col justify-center items-center px-4 py-20 text-center bg-slate-50 rounded-[32px] border border-slate-200">
            <div className="flex items-center justify-center w-20 h-20 mb-6 rounded-full bg-indigo-50">
              <CheckCircle2 className="w-10 h-10 text-indigo-300" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-900">
              No tasks found
            </h3>
            <p className="max-w-sm mx-auto text-slate-500">
              You don't have any tasks matching the current filters.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTasks).map(([companyName, companyTasks]) => (
              <div key={companyName} className="overflow-hidden">
                <button
                  onClick={() => toggleCompany(companyName)}
                  className="flex items-center justify-between w-full px-4 py-3 transition-colors border bg-slate-50 rounded-2xl border-slate-200 hover:bg-slate-100"
                >
                  <div className="flex items-center gap-3">
                    {expandedCompanies.has(companyName) ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                    <Building2 className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-bold text-slate-900">
                      {companyName}
                    </span>
                    <span className="px-2.5 py-0.5 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full">
                      {companyTasks.length} task
                      {companyTasks.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </button>

                {expandedCompanies.has(companyName) && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-white border-b border-slate-100">
                          <th className="px-8 py-5 text-xs font-bold tracking-widest text-left uppercase text-slate-500">
                            Task
                          </th>
                          <th className="px-8 py-5 text-xs font-bold tracking-widest text-left uppercase text-slate-500">
                            Project Name
                          </th>
                          <th className="px-8 py-5 text-xs font-bold tracking-widest text-center uppercase text-slate-500">
                            Priority
                          </th>
                          <th className="px-8 py-5 text-xs font-bold tracking-widest text-center uppercase text-slate-500">
                            Progress & Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {companyTasks.map((task) => (
                          <tr
                            key={task.id}
                            className="transition-colors bg-white hover:bg-slate-50"
                          >
                            <td className="px-8 py-6">
                              <div className="space-y-2">
                                <button
                                  onClick={() => openPopup(task)}
                                  className="text-left"
                                >
                                  <p className="text-sm font-semibold transition-colors text-slate-900 hover:text-indigo-700">
                                    {task.title}
                                  </p>
                                </button>
                                <p className="flex items-center gap-1 text-xs text-slate-500">
                                  <Clock className="w-3 h-3" />
                                  Due {formatDate(task.dueDate)}
                                </p>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <span className="text-sm font-semibold text-indigo-700">
                                {task.projectName || "-"}
                              </span>
                            </td>
                            <td className="px-8 py-6 text-center">
                              <span
                                className={`inline-flex items-center justify-center w-24 px-2 py-1 text-xs font-bold uppercase tracking-widest rounded-full border ${getPriorityColor(task.priority)}`}
                              >
                                {task.priority}
                              </span>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex flex-col items-center gap-2 min-w-[150px]">
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600"
                                    style={{ width: `${task.progress}%` }}
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-700">
                                    {task.progress}%
                                  </span>
                                  <span
                                    className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold uppercase tracking-widest rounded-full border ${getStatusColor(task.status)}`}
                                  >
                                    {task.status}
                                  </span>
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

      {/* Task Details Popup (Matches AssignedTasks Design) */}
      {selectedTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <p className="text-xs font-bold tracking-wider uppercase text-slate-500">
                {selectedTask.companyName}
              </p>
              <button
                onClick={closePopup}
                className="p-2 transition-colors rounded-xl hover:bg-slate-200"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* First Row: Project Name, Due Date, Progress */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="p-3 border rounded-2xl bg-slate-50 border-slate-100">
                  <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
                    Project Name
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {selectedTask.projectName || "N/A"}
                  </p>
                </div>
                <div className="p-3 border rounded-2xl bg-slate-50 border-slate-100">
                  <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
                    Due Date
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {new Date(selectedTask.dueDate || "").toLocaleDateString(
                      "en-US",
                      { year: "numeric", month: "long", day: "numeric" },
                    )}
                  </p>
                </div>
                <div className="p-3 border rounded-2xl bg-slate-50 border-slate-100">
                  <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
                    Progress
                  </p>
                  <div className="flex flex-col items-start gap-2">
                    <div className="w-full h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600"
                        style={{ width: `${selectedTask.progress || 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-700">
                      {selectedTask.progress}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Second Row: Description + Assigned To */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-2xl bg-slate-50 border-slate-100">
                  <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
                    Description
                  </p>
                  <p className="text-sm whitespace-pre-wrap text-slate-700">
                    {selectedTask.description || "No description provided."}
                  </p>
                </div>
                <div className="p-4 border rounded-2xl bg-slate-50 border-slate-100">
                  <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
                    Assigned To
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.assignedUsers.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm"
                      >
                        <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full">
                          {u.fullName.charAt(0)}
                        </div>
                        <span className="text-xs font-semibold text-slate-700">
                          {u.fullName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Third Section: Sub-Tasks */}
              <div className="p-4 border rounded-2xl bg-slate-50 border-slate-100">
                <p className="mb-3 text-xs font-bold tracking-wider uppercase text-slate-500">
                  Sub-Tasks
                </p>
                {/* Add input */}
                <div className="flex gap-2 mb-3">
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
                    className="flex-1 px-4 py-2 text-sm transition-all bg-white border rounded-xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="Enter sub-task title"
                  />
                  <button
                    type="button"
                    onClick={() => addSubTaskToTask(selectedTask.id)}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-white transition-all bg-indigo-600 rounded-xl hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
                {/* Sub-task list */}
                <div className="space-y-2">
                  {(taskSubTasks[selectedTask.id] || []).length === 0 ? (
                    <p className="py-4 text-sm text-center text-slate-400">
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
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">
                Update Sub-Task
              </h3>
              <button
                onClick={() => setShowSubTaskUpdatePopup(false)}
                className="p-2 transition-colors rounded-xl hover:bg-slate-200"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-semibold text-slate-700">
                  Task Title
                </label>
                <p className="text-lg font-semibold text-slate-900">
                  {selectedTask.title || "N/A"}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-10">
                <div className="md:col-span-7 space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    New Sub-Task Update
                  </label>
                  <input
                    type="text"
                    value={newSubTaskUpdateTitle}
                    onChange={(e) => setNewSubTaskUpdateTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Enter new sub-task title"
                  />
                </div>
                <div className="md:col-span-3 space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    Attachment
                  </label>
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
                      className="flex flex-col items-center justify-center w-full gap-1 px-4 py-3 text-xs transition-all border-2 border-dashed cursor-pointer rounded-xl bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-500 hover:text-indigo-600 group"
                    >
                      <Paperclip className="w-4 h-4" />
                      {subTaskUpdateFiles?.length
                        ? `${subTaskUpdateFiles.length} file(s)`
                        : "Select file(s)"}
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    Progress
                  </label>
                  <span className="text-xs font-medium text-slate-600">
                    {subTaskProgress}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={subTaskProgress}
                  onChange={(e) => setSubTaskProgress(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-semibold text-slate-700">
                  Previous Updates
                </label>
                <div className="p-3 rounded-xl border bg-slate-50 border-slate-100 min-h-[60px] max-h-[120px] overflow-y-auto space-y-2">
                  {editingSubTask.history &&
                  editingSubTask.history.length > 0 ? (
                    editingSubTask.history.slice(0, 2).map((hist) => (
                      <div
                        key={hist.id}
                        className="text-xs text-slate-600 border-b border-slate-200 pb-1.5 last:border-0"
                      >
                        <p className="font-semibold text-slate-800">
                          {hist.title}{" "}
                          <span className="font-normal text-slate-500">
                            ({hist.progress}%)
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(hist.date).toLocaleString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="py-2 text-xs italic text-center text-slate-500">
                      No previous updates available
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubTaskUpdatePopup(false);
                    setEditingSubTask(null);
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubTaskUpdate}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-all"
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSubTaskUpdatePopup(false);
                    setShowSubTaskActivityPopup(true);
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all"
                >
                  Activity
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-task Activity Popup */}
      {showSubTaskActivityPopup && editingSubTask && selectedTask && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">
                Sub-Task Activity & Feedback
              </h3>
              <button
                onClick={() => setShowSubTaskActivityPopup(false)}
                className="p-2 transition-colors rounded-xl hover:bg-slate-200"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Sub-task History */}
              <div className="space-y-2">
                <p className="text-xs font-bold tracking-wider uppercase text-slate-500">
                  Progress History
                </p>
                {editingSubTask.history && editingSubTask.history.length > 0 ? (
                  editingSubTask.history.map((hist: any) => (
                    <div
                      key={hist.id}
                      className="p-3 rounded-xl border bg-slate-50 border-slate-100"
                    >
                      <p className="text-xs font-semibold text-slate-800">
                        {hist.title}{" "}
                        <span className="font-normal text-slate-500">
                          ({hist.progress}%)
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(hist.date).toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-xs italic text-center text-slate-500">
                    No history yet
                  </p>
                )}
              </div>

              {/* Comments & Feedback */}
              <div className="space-y-2">
                <p className="text-xs font-bold tracking-wider uppercase text-slate-500">
                  Comments & Feedback
                </p>
                {subTaskComments.map((comment: any) => (
                  <div
                    key={comment.id}
                    className="p-3 rounded-xl border bg-slate-50 border-slate-100"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex justify-center items-center w-6 h-6 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full">
                        {comment.author.fullName.charAt(0)}
                      </div>
                      <span className="text-xs font-semibold text-slate-700">
                        {comment.author.fullName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 mb-2">
                      {comment.commentText}
                    </p>
                    {comment.feedback && (
                      <div className="p-2 bg-white rounded-lg border border-indigo-100">
                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">
                          Feedback
                        </p>
                        <p className="text-xs text-slate-700">
                          {comment.feedback}
                        </p>
                      </div>
                    )}
                    {/* Add Feedback Input (for admin/assigned users) */}
                    {!comment.feedback && (
                      <div className="mt-2 flex gap-2">
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
                          className="flex-1 px-3 py-1.5 text-xs bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (!feedbackTexts[comment.id]) {
                              alert("Please enter some feedback first!");
                              return;
                            }
                            try {
                              console.log(
                                "Sending feedback from MyTasks.tsx:",
                                {
                                  selectedTaskId: selectedTask?.id,
                                  subtaskId: editingSubTask?.id,
                                  commentId: comment.id,
                                  feedback: feedbackTexts[comment.id],
                                },
                              );
                              await api.put(
                                `/api/tasks/${selectedTask?.id}/subtasks/${editingSubTask?.id}/comments/${comment.id}/feedback`,
                                {
                                  feedback: feedbackTexts[comment.id],
                                },
                              );
                              console.log("Feedback sent successfully!");
                              // Re-fetch comments to get updated feedback
                              const res = await api.get(
                                `/api/tasks/${selectedTask?.id}/subtasks/${editingSubTask?.id}/comments`,
                              );
                              setSubTaskComments(res.data);
                              setFeedbackTexts({
                                ...feedbackTexts,
                                [comment.id]: "",
                              });
                            } catch (err: any) {
                              console.error("Failed to add feedback:", err);
                              alert(
                                err?.response?.data?.message ||
                                  "Failed to send feedback!",
                              );
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg transition-all hover:bg-indigo-700"
                        >
                          Send
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add New Comment */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                    }
                  }}
                  className="flex-1 px-4 py-2 text-sm bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newCommentText.trim()) return;
                    try {
                      await api.post(
                        `/api/tasks/${selectedTask.id}/subtasks/${editingSubTask.id}/comments`,
                        {
                          commentText: newCommentText,
                        },
                      );
                      // Re-fetch comments to get the new one
                      const res = await api.get(
                        `/api/tasks/${selectedTask.id}/subtasks/${editingSubTask.id}/comments`,
                      );
                      setSubTaskComments(res.data);
                      setNewCommentText("");
                    } catch (err) {
                      console.error("Failed to add comment", err);
                    }
                  }}
                  className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl transition-all hover:bg-indigo-700"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Creation Modal (Matches AssignedTasks) */}
      {showAddTaskForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Add My Own Task
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Create a task and assign it to yourself.
                </p>
              </div>
              <button
                onClick={closeTaskModal}
                className="p-2 rounded-xl shadow-sm transition-all hover:bg-white text-slate-400 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleAddTask}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              {addTaskError && (
                <div className="flex gap-2 items-center p-3 text-xs font-medium text-rose-700 bg-rose-50 rounded-xl border border-rose-100">
                  <AlertCircle className="w-4 h-4" />
                  {addTaskError}
                </div>
              )}
              {/* Row 1: Company (Dropdown) and Project (Dropdown) */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    Company
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
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
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    Project Name
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                    >
                      <option value="" disabled>
                        Select a project
                      </option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.name}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Row 2: Task Title, Priority, Due Date */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    Task Title
                  </label>
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Task title"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    Due Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Description (full width) */}
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-semibold text-slate-700">
                  Description
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                  placeholder="Task description"
                />
              </div>

              {/* Row 4: Sub-Tasks (full width, no nested) */}
              <div className="space-y-1.5">
                <div className="flex gap-2 justify-between items-center">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    Sub-Tasks
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setNewSubTasks([
                        ...newSubTasks,
                        { id: Date.now().toString(), title: "", subTasks: [] },
                      ])
                    }
                    className="flex gap-1 items-center px-3 py-1 text-xs font-bold text-white bg-indigo-600 rounded-lg transition-all hover:bg-indigo-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Sub-Task
                  </button>
                </div>
                <div className="min-h-[100px] p-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/50">
                  {newSubTasks.length === 0 ? (
                    <div className="flex flex-col justify-center items-center py-6 text-center text-slate-400">
                      <p className="text-sm">No sub-tasks yet</p>
                      <p className="mt-1 text-xs">
                        Click "Add Sub-Task" to start
                      </p>
                    </div>
                  ) : (
                    newSubTasks.map((subTask, idx) => (
                      <div
                        key={subTask.id}
                        className="flex gap-2 items-center p-3 bg-white rounded-xl border border-slate-200"
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
                          className="flex-1 px-4 py-2 text-sm rounded-lg border transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder="Sub-task title"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const u = [...newSubTasks];
                            u.splice(idx, 1);
                            setNewSubTasks(u);
                          }}
                          className="p-2 rounded-lg transition-all text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Row 5: Attachments (full width) */}
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-semibold text-slate-700">
                  Attachments
                </label>
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
                    className="flex gap-2 justify-center items-center px-4 py-3 w-full text-sm rounded-xl border-2 border-dashed transition-all cursor-pointer bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-500 hover:text-indigo-600 group"
                  >
                    <Paperclip className="w-4 h-4 transition-transform group-hover:rotate-12" />
                    {newFiles?.length ? (
                      <span className="font-bold">
                        {newFiles.length} files selected
                      </span>
                    ) : (
                      "Upload task resources"
                    )}
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeTaskModal}
                  className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingTask}
                  className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {addingTask ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Create
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

// import React, { useEffect, useState } from "react";
// import api from "../api/axios";
// import {
//   Plus,
//   Search,
//   Clock,
//   Loader2,
//   AlertCircle,
//   Building2,
//   CheckCircle2,
//   X,
//   ChevronDown,
//   ChevronRight,
//   Edit2,
//   Paperclip,
// } from "lucide-react";

// type AssignedUser = {
//   id: number;
//   fullName: string;
//   email: string;
// };

// type Task = {
//   id: number;
//   companyName: string;
//   title: string;
//   description?: string;
//   priority: string;
//   status: string;
//   progress: number;
//   dueDate: string;
//   assignedUsers: AssignedUser[];
//   files?: string[];
//   createdAt: string;
//   subTasks: { id: number; title: string; status: string; children?: any[] }[];
//   projectName?: string;
// };

// const formatDate = (dateString: string) =>
//   new Date(dateString).toLocaleDateString(undefined, {
//     year: "numeric",
//     month: "short",
//     day: "numeric",
//   });

// const MyTasks: React.FC = () => {
//   const [tasks, setTasks] = useState<Task[]>([]);
//   const [tasksLoading, setTasksLoading] = useState(false);
//   const [tasksError, setTasksError] = useState<string | null>(null);
//   const [searchTerm, setSearchTerm] = useState("");
//   const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(
//     new Set(),
//   );

//   // Popup States
//   const [selectedTask, setSelectedTask] = useState<Task | null>(null);

//   // Filter state variables
//   const [filterProjectName, setFilterProjectName] = useState("");
//   const [filterPriority, setFilterPriority] = useState("");
//   const [filterStatus, setFilterStatus] = useState("");

//   type DetailedSubTask = {
//     id: string | number;
//     title: string;
//     progress?: number;
//     history?: { id: string; date: string; title: string; progress: number }[];
//     subTasks: DetailedSubTask[];
//   };

//   const [taskSubTasks, setTaskSubTasks] = useState<
//     Record<number, DetailedSubTask[]>
//   >({});
//   const [expandedNestedSubTasks, setExpandedNestedSubTasks] = useState<
//     Set<string>
//   >(new Set());

//   // Sub-task specific states
//   const [newSubTaskTitle, setNewSubTaskTitle] = useState<
//     Record<number, string>
//   >({});
//   const [showSubTaskUpdatePopup, setShowSubTaskUpdatePopup] = useState(false);
//   const [editingSubTask, setEditingSubTask] = useState<DetailedSubTask | null>(
//     null,
//   );
//   const [newSubTaskUpdateTitle, setNewSubTaskUpdateTitle] = useState("");
//   const [subTaskProgress, setSubTaskProgress] = useState(0);
//   const [subTaskUpdateFiles, setSubTaskUpdateFiles] = useState<FileList | null>(
//     null,
//   );
//   const [showSubTaskActivityPopup, setShowSubTaskActivityPopup] =
//     useState(false);

//   const convertToDetailed = (subTasks: any[]): DetailedSubTask[] => {
//     return subTasks.map((st) => ({
//       id: st.id,
//       title: st.title,
//       progress: st.progress || 0,
//       history: st.history || [],
//       subTasks: convertToDetailed(st.children || st.subTasks || []),
//     }));
//   };

//   const buildSubTasksMap = (taskList: Task[]) => {
//     const subTasksMap: Record<number, DetailedSubTask[]> = {};
//     taskList.forEach((task) => {
//       subTasksMap[task.id] = convertToDetailed(task.subTasks || []);
//     });
//     return subTasksMap;
//   };

//   const loadData = async () => {
//     setTasksLoading(true);
//     setTasksError(null);
//     try {
//       const tasksRes = await api.get<any>("/api/tasks");

//       let taskList: Task[] = [];
//       if (Array.isArray(tasksRes.data)) {
//         taskList = tasksRes.data;
//       } else if (tasksRes.data?.task) {
//         taskList = [tasksRes.data.task];
//       } else if (tasksRes.data?.tasks) {
//         taskList = tasksRes.data.tasks;
//       }
//       setTasks(taskList);
//       setTaskSubTasks(buildSubTasksMap(taskList));
//     } catch (err: any) {
//       setTasksError(
//         err?.response?.data?.message ||
//           err.message ||
//           "Unable to load my tasks.",
//       );
//     } finally {
//       setTasksLoading(false);
//     }
//   };

//   useEffect(() => {
//     loadData();
//   }, []);

//   const toggleCompany = (companyName: string) => {
//     setExpandedCompanies((prev) => {
//       const newSet = new Set(prev);
//       if (newSet.has(companyName)) newSet.delete(companyName);
//       else newSet.add(companyName);
//       return newSet;
//     });
//   };

//   const openPopup = (task: Task) => {
//     setSelectedTask(task);
//   };

//   const closePopup = () => {
//     setSelectedTask(null);
//   };

//   const addSubTaskToTask = async (
//     taskId: number,
//     parentId?: string,
//     overrideTitle?: string,
//   ) => {
//     const title = overrideTitle ?? (newSubTaskTitle[taskId] || "");
//     if (!title.trim()) return;

//     const newSubTask: DetailedSubTask = {
//       id: `temp-${Date.now()}`,
//       title,
//       subTasks: [],
//     };

//     let updatedSubTasks: DetailedSubTask[];
//     if (parentId) {
//       const updateNested = (subTasks: DetailedSubTask[]): DetailedSubTask[] =>
//         subTasks.map((st) => {
//           if (st.id.toString() === parentId) {
//             return { ...st, subTasks: [...st.subTasks, newSubTask] };
//           }
//           return { ...st, subTasks: updateNested(st.subTasks) };
//         });
//       updatedSubTasks = updateNested(taskSubTasks[taskId] || []);
//     } else {
//       updatedSubTasks = [...(taskSubTasks[taskId] || []), newSubTask];
//     }

//     setTaskSubTasks((prev) => ({ ...prev, [taskId]: updatedSubTasks }));

//     if (!overrideTitle) {
//       setNewSubTaskTitle((prev) => ({ ...prev, [taskId]: "" }));
//     }

//     try {
//       const res = await api.post(`/api/tasks/${taskId}/subtasks`, {
//         title,
//         parentSubTaskId: parentId,
//       });

//       if (res.data.subTasks) {
//         const detailed = convertToDetailed(res.data.subTasks);
//         setTaskSubTasks((prev) => ({ ...prev, [taskId]: detailed }));
//       }
//     } catch (err: any) {
//       console.error("Error adding sub-task", err);
//       alert(
//         err?.response?.data?.message ||
//           err.message ||
//           "Failed to save sub-task. Please try again.",
//       );
//     }
//   };

//   const handleSubTaskUpdate = async () => {
//     if (!editingSubTask || !selectedTask) return;

//     try {
//       await api.put(
//         `/api/tasks/${selectedTask.id}/subtasks/${editingSubTask.id}`,
//         {
//           title: newSubTaskUpdateTitle,
//           progress: subTaskProgress,
//         },
//       );

//       const res = await api.get(`/api/tasks/${selectedTask.id}/subtasks`);
//       const detailed = convertToDetailed(res.data);
//       setTaskSubTasks((prev) => ({ ...prev, [selectedTask.id]: detailed }));

//       setShowSubTaskUpdatePopup(false);
//       setEditingSubTask(null);
//     } catch (err: any) {
//       console.error("Error updating sub-task", err);
//       alert(err?.response?.data?.message || "Failed to update sub-task.");
//     }
//   };

//   const renderSubTaskItem = (
//     st: DetailedSubTask,
//     level: number = 0,
//   ): React.ReactNode => {
//     const safeChildren = st.subTasks || [];
//     const isExpanded = expandedNestedSubTasks.has(st.id.toString());
//     return (
//       <div
//         key={st.id}
//         className="overflow-hidden bg-white border rounded-xl border-slate-100"
//       >
//         <div
//           className="flex items-center justify-between py-2 pr-3"
//           style={{ paddingLeft: `${level * 20 + 12}px` }}
//         >
//           <div className="flex items-center gap-2">
//             {safeChildren.length > 0 ? (
//               <button
//                 type="button"
//                 onClick={() => {
//                   setExpandedNestedSubTasks((prev) => {
//                     const next = new Set(prev);
//                     if (next.has(st.id.toString()))
//                       next.delete(st.id.toString());
//                     else next.add(st.id.toString());
//                     return next;
//                   });
//                 }}
//                 className="p-0.5 text-slate-400 hover:text-indigo-600"
//               >
//                 {isExpanded ? (
//                   <ChevronDown className="w-3.5 h-3.5" />
//                 ) : (
//                   <ChevronRight className="w-3.5 h-3.5" />
//                 )}
//               </button>
//             ) : (
//               <div className="w-4 h-4" />
//             )}
//             <span className="text-sm text-slate-700">{st.title}</span>
//           </div>
//           <div className="flex gap-2">
//             <button
//               type="button"
//               className="p-1.5 rounded-lg transition-all text-slate-400 hover:text-green-600 hover:bg-green-50"
//               onClick={() => {
//                 setEditingSubTask(st);
//                 setNewSubTaskUpdateTitle(st.title);
//                 setSubTaskProgress(st.progress || 0);
//                 setShowSubTaskUpdatePopup(true);
//               }}
//             >
//               <Edit2 className="w-3.5 h-3.5" />
//             </button>
//             <button
//               type="button"
//               className="p-1.5 rounded-lg transition-all text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
//               onClick={() => setShowSubTaskActivityPopup(true)}
//             >
//               <Clock className="w-3.5 h-3.5" />
//             </button>
//           </div>
//         </div>
//         {safeChildren.length > 0 && isExpanded && (
//           <div className="border-t border-slate-100">
//             {safeChildren.map((child) => renderSubTaskItem(child, level + 1))}
//           </div>
//         )}
//       </div>
//     );
//   };

//   const filteredTasks = tasks.filter((task) => {
//     const matchesSearch =
//       task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
//       task.companyName.toLowerCase().includes(searchTerm.toLowerCase());

//     const matchesProject = filterProjectName
//       ? (task.projectName || "")
//           .toLowerCase()
//           .includes(filterProjectName.toLowerCase())
//       : true;

//     const matchesPriority = filterPriority
//       ? task.priority.toLowerCase() === filterPriority.toLowerCase()
//       : true;

//     const matchesStatus = filterStatus
//       ? task.status.toLowerCase().replace(/\s+/g, "") ===
//         filterStatus.toLowerCase().replace(/\s+/g, "")
//       : true;

//     return matchesSearch && matchesProject && matchesPriority && matchesStatus;
//   });

//   const groupedTasks = filteredTasks.reduce(
//     (acc, task) => {
//       const key = task.companyName || "Unassigned";
//       if (!acc[key]) acc[key] = [];
//       acc[key].push(task);
//       return acc;
//     },
//     {} as Record<string, Task[]>,
//   );

//   const getPriorityColor = (priority: string) => {
//     switch (priority.toLowerCase()) {
//       case "high":
//         return "bg-red-100 text-red-700 border-red-200";
//       case "medium":
//         return "bg-amber-100 text-amber-700 border-amber-200";
//       case "low":
//         return "bg-emerald-100 text-emerald-700 border-emerald-200";
//       default:
//         return "bg-slate-100 text-slate-700 border-slate-200";
//     }
//   };

//   const getStatusColor = (status: string) => {
//     switch (status.toLowerCase().replace(/\s+/g, "")) {
//       case "completed":
//         return "bg-emerald-100 text-emerald-700 border-emerald-200";
//       case "inprogress":
//         return "bg-blue-100 text-blue-700 border-blue-200";
//       case "pending":
//         return "bg-amber-100 text-amber-700 border-amber-200";
//       default:
//         return "bg-slate-100 text-slate-700 border-slate-200";
//     }
//   };

//   return (
//     <div className="pb-12 space-y-8">
//       <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6">
//         <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
//           <div>
//             <h2 className="text-2xl font-bold text-slate-900">My Tasks</h2>
//             <p className="mt-1 text-sm text-slate-500">
//               Tasks assigned to you by admins or other users.
//             </p>
//           </div>
//           <div className="relative">
//             <Search className="absolute w-4 h-4 -translate-y-1/2 left-4 top-1/2 text-slate-400" />
//             <input
//               type="text"
//               placeholder="Search my tasks..."
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//               className="py-3 pr-4 border pl-11 rounded-3xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
//             />
//           </div>
//         </div>

//         {/* Filters */}
//         <div className="flex flex-wrap gap-3 mb-6">
//           <div className="space-y-1">
//             <label className="ml-1 text-xs font-semibold text-slate-600">
//               Project Name
//             </label>
//             <input
//               type="text"
//               placeholder="Search project..."
//               value={filterProjectName}
//               onChange={(e) => setFilterProjectName(e.target.value)}
//               className="px-4 py-2 text-sm border rounded-2xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
//             />
//           </div>
//           <div className="space-y-1">
//             <label className="ml-1 text-xs font-semibold text-slate-600">
//               Priority
//             </label>
//             <select
//               value={filterPriority}
//               onChange={(e) => setFilterPriority(e.target.value)}
//               className="px-4 py-2 text-sm border rounded-2xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
//             >
//               <option value="">All</option>
//               <option value="high">High</option>
//               <option value="medium">Medium</option>
//               <option value="low">Low</option>
//             </select>
//           </div>
//           <div className="space-y-1">
//             <label className="ml-1 text-xs font-semibold text-slate-600">
//               Status
//             </label>
//             <select
//               value={filterStatus}
//               onChange={(e) => setFilterStatus(e.target.value)}
//               className="px-4 py-2 text-sm border rounded-2xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
//             >
//               <option value="">All</option>
//               <option value="pending">Pending</option>
//               <option value="inprogress">In Progress</option>
//               <option value="completed">Completed</option>
//             </select>
//           </div>
//         </div>

//         {tasksLoading ? (
//           <div className="flex flex-col justify-center items-center px-4 py-20 text-center bg-slate-50 rounded-[32px] border border-slate-200">
//             <Loader2 className="w-10 h-10 mx-auto text-indigo-600 animate-spin" />
//             <p className="mt-4 text-slate-500">Loading your tasks...</p>
//           </div>
//         ) : tasksError ? (
//           <div className="flex items-center gap-4 p-6 font-medium border text-rose-700 bg-rose-50 rounded-2xl border-rose-100">
//             <AlertCircle className="w-6 h-6" />
//             {tasksError}
//           </div>
//         ) : filteredTasks.length === 0 ? (
//           <div className="flex flex-col justify-center items-center px-4 py-20 text-center bg-slate-50 rounded-[32px] border border-slate-200">
//             <div className="flex items-center justify-center w-20 h-20 mb-6 rounded-full bg-indigo-50">
//               <CheckCircle2 className="w-10 h-10 text-indigo-300" />
//             </div>
//             <h3 className="mb-2 text-xl font-bold text-slate-900">
//               No tasks found
//             </h3>
//             <p className="max-w-sm mx-auto text-slate-500">
//               You don't have any tasks matching the current filters.
//             </p>
//           </div>
//         ) : (
//           <div className="space-y-6">
//             {Object.entries(groupedTasks).map(([companyName, companyTasks]) => (
//               <div key={companyName} className="overflow-hidden">
//                 <button
//                   onClick={() => toggleCompany(companyName)}
//                   className="flex items-center justify-between w-full px-4 py-3 transition-colors border bg-slate-50 rounded-2xl border-slate-200 hover:bg-slate-100"
//                 >
//                   <div className="flex items-center gap-3">
//                     {expandedCompanies.has(companyName) ? (
//                       <ChevronDown className="w-4 h-4 text-slate-500" />
//                     ) : (
//                       <ChevronRight className="w-4 h-4 text-slate-500" />
//                     )}
//                     <Building2 className="w-5 h-5 text-indigo-600" />
//                     <span className="text-sm font-bold text-slate-900">
//                       {companyName}
//                     </span>
//                     <span className="px-2.5 py-0.5 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full">
//                       {companyTasks.length} task
//                       {companyTasks.length !== 1 ? "s" : ""}
//                     </span>
//                   </div>
//                 </button>

//                 {expandedCompanies.has(companyName) && (
//                   <div className="mt-4 overflow-x-auto">
//                     <table className="w-full border-collapse">
//                       <thead>
//                         <tr className="bg-white border-b border-slate-100">
//                           <th className="px-8 py-5 text-xs font-bold tracking-widest text-left uppercase text-slate-500">
//                             Task
//                           </th>
//                           <th className="px-8 py-5 text-xs font-bold tracking-widest text-left uppercase text-slate-500">
//                             Project Name
//                           </th>
//                           <th className="px-8 py-5 text-xs font-bold tracking-widest text-center uppercase text-slate-500">
//                             Priority
//                           </th>
//                           <th className="px-8 py-5 text-xs font-bold tracking-widest text-center uppercase text-slate-500">
//                             Progress & Status
//                           </th>
//                         </tr>
//                       </thead>
//                       <tbody className="divide-y divide-slate-100">
//                         {companyTasks.map((task) => (
//                           <tr
//                             key={task.id}
//                             className="transition-colors bg-white hover:bg-slate-50"
//                           >
//                             <td className="px-8 py-6">
//                               <div className="space-y-2">
//                                 <button
//                                   onClick={() => openPopup(task)}
//                                   className="text-left"
//                                 >
//                                   <p className="text-sm font-semibold transition-colors text-slate-900 hover:text-indigo-700">
//                                     {task.title}
//                                   </p>
//                                 </button>
//                                 <p className="flex items-center gap-1 text-xs text-slate-500">
//                                   <Clock className="w-3 h-3" />
//                                   Due {formatDate(task.dueDate)}
//                                 </p>
//                               </div>
//                             </td>
//                             <td className="px-8 py-6">
//                               <span className="text-sm font-semibold text-indigo-700">
//                                 {task.projectName || "-"}
//                               </span>
//                             </td>
//                             <td className="px-8 py-6 text-center">
//                               <span
//                                 className={`inline-flex items-center justify-center w-24 px-2 py-1 text-xs font-bold uppercase tracking-widest rounded-full border ${getPriorityColor(task.priority)}`}
//                               >
//                                 {task.priority}
//                               </span>
//                             </td>
//                             <td className="px-8 py-6">
//                               <div className="flex flex-col items-center gap-2 min-w-[150px]">
//                                 <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
//                                   <div
//                                     className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600"
//                                     style={{ width: `${task.progress}%` }}
//                                   />
//                                 </div>
//                                 <div className="flex items-center gap-2">
//                                   <span className="text-xs font-semibold text-slate-700">
//                                     {task.progress}%
//                                   </span>
//                                   <span
//                                     className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold uppercase tracking-widest rounded-full border ${getStatusColor(task.status)}`}
//                                   >
//                                     {task.status}
//                                   </span>
//                                 </div>
//                               </div>
//                             </td>
//                           </tr>
//                         ))}
//                       </tbody>
//                     </table>
//                   </div>
//                 )}
//               </div>
//             ))}
//           </div>
//         )}
//       </div>

//       {/* Task Details Popup (Matches AssignedTasks Design) */}
//       {selectedTask && (
//         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
//           <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] overflow-y-auto">
//             <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
//               <p className="text-xs font-bold tracking-wider uppercase text-slate-500">
//                 {selectedTask.companyName}
//               </p>
//               <button
//                 onClick={closePopup}
//                 className="p-2 transition-colors rounded-xl hover:bg-slate-200"
//               >
//                 <X className="w-5 h-5 text-slate-500" />
//               </button>
//             </div>
//             <div className="p-6 space-y-6">
//               {/* First Row: Project Name, Due Date, Progress */}
//               <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
//                 <div className="p-3 border rounded-2xl bg-slate-50 border-slate-100">
//                   <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
//                     Project Name
//                   </p>
//                   <p className="text-lg font-semibold text-slate-900">
//                     {selectedTask.projectName || "N/A"}
//                   </p>
//                 </div>
//                 <div className="p-3 border rounded-2xl bg-slate-50 border-slate-100">
//                   <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
//                     Due Date
//                   </p>
//                   <p className="text-sm font-semibold text-slate-900">
//                     {new Date(selectedTask.dueDate || "").toLocaleDateString(
//                       "en-US",
//                       { year: "numeric", month: "long", day: "numeric" },
//                     )}
//                   </p>
//                 </div>
//                 <div className="p-3 border rounded-2xl bg-slate-50 border-slate-100">
//                   <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
//                     Progress
//                   </p>
//                   <div className="flex flex-col items-start gap-2">
//                     <div className="w-full h-2 overflow-hidden rounded-full bg-slate-200">
//                       <div
//                         className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600"
//                         style={{ width: `${selectedTask.progress || 0}%` }}
//                       />
//                     </div>
//                     <span className="text-sm font-bold text-slate-700">
//                       {selectedTask.progress}%
//                     </span>
//                   </div>
//                 </div>
//               </div>

//               {/* Second Row: Description + Assigned To */}
//               <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
//                 <div className="p-4 border rounded-2xl bg-slate-50 border-slate-100">
//                   <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
//                     Description
//                   </p>
//                   <p className="text-sm whitespace-pre-wrap text-slate-700">
//                     {selectedTask.description || "No description provided."}
//                   </p>
//                 </div>
//                 <div className="p-4 border rounded-2xl bg-slate-50 border-slate-100">
//                   <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
//                     Assigned To
//                   </p>
//                   <div className="flex flex-wrap gap-2">
//                     {selectedTask.assignedUsers.map((u) => (
//                       <div
//                         key={u.id}
//                         className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm"
//                       >
//                         <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full">
//                           {u.fullName.charAt(0)}
//                         </div>
//                         <span className="text-xs font-semibold text-slate-700">
//                           {u.fullName}
//                         </span>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               </div>

//               {/* Third Section: Sub-Tasks */}
//               <div className="p-4 border rounded-2xl bg-slate-50 border-slate-100">
//                 <p className="mb-3 text-xs font-bold tracking-wider uppercase text-slate-500">
//                   Sub-Tasks
//                 </p>
//                 {/* Add input */}
//                 <div className="flex gap-2 mb-3">
//                   <input
//                     type="text"
//                     value={newSubTaskTitle[selectedTask.id] || ""}
//                     onChange={(e) =>
//                       setNewSubTaskTitle((prev) => ({
//                         ...prev,
//                         [selectedTask.id]: e.target.value,
//                       }))
//                     }
//                     onKeyDown={(e) => {
//                       if (e.key === "Enter") {
//                         e.preventDefault();
//                         addSubTaskToTask(selectedTask.id);
//                       }
//                     }}
//                     className="flex-1 px-4 py-2 text-sm transition-all bg-white border rounded-xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
//                     placeholder="Enter sub-task title"
//                   />
//                   <button
//                     type="button"
//                     onClick={() => addSubTaskToTask(selectedTask.id)}
//                     className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-white transition-all bg-indigo-600 rounded-xl hover:bg-indigo-700"
//                   >
//                     <Plus className="w-4 h-4" />
//                     Add
//                   </button>
//                 </div>
//                 {/* Sub-task list */}
//                 <div className="space-y-2">
//                   {(taskSubTasks[selectedTask.id] || []).length === 0 ? (
//                     <p className="py-4 text-sm text-center text-slate-400">
//                       No sub-tasks yet
//                     </p>
//                   ) : (
//                     (taskSubTasks[selectedTask.id] || []).map((st) =>
//                       renderSubTaskItem(st),
//                     )
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Sub-task Update Popup */}
//       {showSubTaskUpdatePopup && editingSubTask && selectedTask && (
//         <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
//           <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] overflow-y-auto">
//             <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
//               <h3 className="text-xl font-bold text-slate-900">
//                 Update Sub-Task
//               </h3>
//               <button
//                 onClick={() => setShowSubTaskUpdatePopup(false)}
//                 className="p-2 transition-colors rounded-xl hover:bg-slate-200"
//               >
//                 <X className="w-5 h-5 text-slate-500" />
//               </button>
//             </div>
//             <div className="p-6 space-y-4">
//               <div className="space-y-1.5">
//                 <label className="ml-1 text-xs font-semibold text-slate-700">
//                   Task Title
//                 </label>
//                 <p className="text-lg font-semibold text-slate-900">
//                   {selectedTask.title || "N/A"}
//                 </p>
//               </div>

//               <div className="grid grid-cols-1 gap-4 md:grid-cols-10">
//                 <div className="md:col-span-7 space-y-1.5">
//                   <label className="ml-1 text-xs font-semibold text-slate-700">
//                     New Sub-Task Update
//                   </label>
//                   <input
//                     type="text"
//                     value={newSubTaskUpdateTitle}
//                     onChange={(e) => setNewSubTaskUpdateTitle(e.target.value)}
//                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
//                     placeholder="Enter new sub-task title"
//                   />
//                 </div>
//                 <div className="md:col-span-3 space-y-1.5">
//                   <label className="ml-1 text-xs font-semibold text-slate-700">
//                     Attachment
//                   </label>
//                   <div className="relative">
//                     <input
//                       type="file"
//                       multiple
//                       onChange={(e) => setSubTaskUpdateFiles(e.target.files)}
//                       className="hidden"
//                       id="subtask-attachment"
//                     />
//                     <label
//                       htmlFor="subtask-attachment"
//                       className="flex flex-col items-center justify-center w-full gap-1 px-4 py-3 text-xs transition-all border-2 border-dashed cursor-pointer rounded-xl bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-500 hover:text-indigo-600 group"
//                     >
//                       <Paperclip className="w-4 h-4" />
//                       {subTaskUpdateFiles?.length
//                         ? `${subTaskUpdateFiles.length} file(s)`
//                         : "Select file(s)"}
//                     </label>
//                   </div>
//                 </div>
//               </div>

//               <div className="space-y-1.5">
//                 <div className="flex items-center justify-between">
//                   <label className="ml-1 text-xs font-semibold text-slate-700">
//                     Progress
//                   </label>
//                   <span className="text-xs font-medium text-slate-600">
//                     {subTaskProgress}%
//                   </span>
//                 </div>
//                 <input
//                   type="range"
//                   min="0"
//                   max="100"
//                   value={subTaskProgress}
//                   onChange={(e) => setSubTaskProgress(Number(e.target.value))}
//                   className="w-full"
//                 />
//               </div>

//               <div className="space-y-1.5">
//                 <label className="ml-1 text-xs font-semibold text-slate-700">
//                   Previous Updates
//                 </label>
//                 <div className="p-3 rounded-xl border bg-slate-50 border-slate-100 min-h-[60px] max-h-[120px] overflow-y-auto space-y-2">
//                   {editingSubTask.history &&
//                   editingSubTask.history.length > 0 ? (
//                     editingSubTask.history.slice(0, 2).map((hist) => (
//                       <div
//                         key={hist.id}
//                         className="text-xs text-slate-600 border-b border-slate-200 pb-1.5 last:border-0"
//                       >
//                         <p className="font-semibold text-slate-800">
//                           {hist.title}{" "}
//                           <span className="font-normal text-slate-500">
//                             ({hist.progress}%)
//                           </span>
//                         </p>
//                         <p className="text-[10px] text-slate-400 mt-0.5">
//                           {new Date(hist.date).toLocaleString()}
//                         </p>
//                       </div>
//                     ))
//                   ) : (
//                     <p className="py-2 text-xs italic text-center text-slate-500">
//                       No previous updates available
//                     </p>
//                   )}
//                 </div>
//               </div>

//               <div className="flex gap-3 pt-4 border-t border-slate-100">
//                 <button
//                   type="button"
//                   onClick={() => {
//                     setShowSubTaskUpdatePopup(false);
//                     setEditingSubTask(null);
//                   }}
//                   className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   type="button"
//                   onClick={handleSubTaskUpdate}
//                   className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-all"
//                 >
//                   Update
//                 </button>
//                 <button
//                   type="button"
//                   onClick={() => {
//                     setShowSubTaskUpdatePopup(false);
//                     setShowSubTaskActivityPopup(true);
//                   }}
//                   className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all"
//                 >
//                   Activity
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Sub-task Activity Popup */}
//       {showSubTaskActivityPopup && (
//         <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
//           <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
//             <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
//               <h3 className="text-xl font-bold text-slate-900">
//                 Sub-Task Activity History
//               </h3>
//               <button
//                 onClick={() => setShowSubTaskActivityPopup(false)}
//                 className="p-2 transition-colors rounded-xl hover:bg-slate-200"
//               >
//                 <X className="w-5 h-5 text-slate-500" />
//               </button>
//             </div>
//             <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
//               <div className="flex gap-3 p-3 border rounded-xl bg-slate-50 border-slate-100">
//                 <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full">
//                   Y
//                 </div>
//                 <div className="flex-1">
//                   <p className="text-xs font-semibold text-slate-900">
//                     Sub-task activity placeholder
//                   </p>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default MyTasks;
