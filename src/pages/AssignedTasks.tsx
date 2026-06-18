import React, { useEffect, useState } from "react";
import api from "../api/axios";
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Clock,
  AlertCircle,
  Building2,
  Users as UsersIcon,
  Paperclip,
  CheckCircle2,
  X,
  Loader2,
  Calendar,
  ChevronDown,
  ChevronRight,
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

const getFileUrl = (path: string) => {
  if (!path) return "#";
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const normalizedPath = path.replace(/\\/g, "/");
  return `${API_BASE}/${normalizedPath}`;
};

const AssignedTasks: React.FC = () => {
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
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

  const [searchTerm, setSearchTerm] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [newProgress, setNewProgress] = useState(0);
  // Filter state variables
  const [filterCompanyName, setFilterCompanyName] = useState("");
  const [filterProjectName, setFilterProjectName] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [editProgress, setEditProgress] = useState(0);

  const [newProjectName, setNewProjectName] = useState("");
  const [editProjectName, setEditProjectName] = useState("");

  type ModalSubTask = {
    id: string;
    title: string;
    subTasks?: ModalSubTask[]; // Made optional to fix TS errors
  };
  const [newSubTasks, setNewSubTasks] = useState<ModalSubTask[]>([]);
  const [editSubTasks, setEditSubTasks] = useState<ModalSubTask[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("high");
  const [editDueDate, setEditDueDate] = useState("");
  const [editUserIds, setEditUserIds] = useState<number[]>([]);
  const [editFiles, setEditFiles] = useState<FileList | null>(null);
  const [editingTaskLoading, setEditingTaskLoading] = useState(false);
  const [editTaskError, setEditTaskError] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
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
  const [newSubTaskTitle, setNewSubTaskTitle] = useState<
    Record<number, string>
  >({});
  const [expandedNestedSubTasks, setExpandedNestedSubTasks] = useState<
    Set<string>
  >(new Set());
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(
    new Set(),
  );
  const [showActivityPopup, setShowActivityPopup] = useState(false);

  // Sub-task update popup state
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

  const toggleCompany = (companyName: string) => {
    setExpandedCompanies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(companyName)) {
        newSet.delete(companyName);
      } else {
        newSet.add(companyName);
      }
      return newSet;
    });
  };

  const filteredTasks = assignedTasks.filter((task) => {
    // Search term filter
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.companyName.toLowerCase().includes(searchTerm.toLowerCase());

    // Company name filter
    const matchesCompany = filterCompanyName
      ? task.companyName.toLowerCase() === filterCompanyName.toLowerCase()
      : true;

    // Project name filter
    const matchesProject = filterProjectName
      ? (task.projectName || "")
          .toLowerCase()
          .includes(filterProjectName.toLowerCase())
      : true;

    // Priority filter
    const matchesPriority = filterPriority
      ? task.priority.toLowerCase() === filterPriority.toLowerCase()
      : true;

    // Status filter
    const matchesStatus = filterStatus
      ? task.status.toLowerCase() === filterStatus.toLowerCase()
      : true;

    // Employee filter (assigned user)
    const matchesEmployee = filterEmployee
      ? task.assignedUsers.some((u) => u.id.toString() === filterEmployee)
      : true;

    return (
      matchesSearch &&
      matchesCompany &&
      matchesProject &&
      matchesPriority &&
      matchesStatus &&
      matchesEmployee
    );
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

  // Collect all unique project names from existing tasks
  const uniqueProjectNames = Array.from(
    new Set(assignedTasks.map((task) => task.projectName).filter(Boolean)),
  ).sort();

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

  const convertToDetailed = (subTasks: any[]): DetailedSubTask[] =>
    subTasks.map((st) => ({
      id: st.id,
      title: st.title,
      progress: st.progress || 0,
      history: st.history || [],
      subTasks: convertToDetailed(st.children || st.subTasks || []),
    }));

  const convertToModal = (subTasks: DetailedSubTask[]): ModalSubTask[] =>
    subTasks.map((st) => ({
      id: st.id.toString(),
      title: st.title,
      subTasks: convertToModal(st.subTasks || []),
    }));

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

  useEffect(() => {
    const loadData = async () => {
      setTasksLoading(true);
      setTasksError(null);
      try {
        const [tasksRes, usersRes, projectsRes] = await Promise.all([
          api.get<any>("/api/tasks"),
          api.get<User[]>("/api/users"),
          api.get<Project[]>("/api/projects"),
        ]);

        const toTasksWithSubTasks = (list: Task[]) => {
          const subTasksMap: Record<number, DetailedSubTask[]> = {};
          const tasksWithProgress = list.map((task) => {
            const detailed = convertToDetailed(task.subTasks || []);
            subTasksMap[task.id] = detailed;
            if (detailed.length === 0) return task;
            return { ...task, progress: computeAverageLeafProgress(detailed) };
          });
          return { tasksWithProgress, subTasksMap };
        };

        if (Array.isArray(tasksRes.data)) {
          const { tasksWithProgress, subTasksMap } = toTasksWithSubTasks(
            tasksRes.data,
          );
          setAssignedTasks(tasksWithProgress);
          setTaskSubTasks(subTasksMap);
        } else if (tasksRes.data?.task) {
          const { tasksWithProgress, subTasksMap } = toTasksWithSubTasks([
            tasksRes.data.task,
          ]);
          setAssignedTasks(tasksWithProgress);
          setTaskSubTasks(subTasksMap);
        } else if (tasksRes.data?.tasks) {
          const { tasksWithProgress, subTasksMap } = toTasksWithSubTasks(
            tasksRes.data.tasks,
          );
          setAssignedTasks(tasksWithProgress);
          setTaskSubTasks(subTasksMap);
        } else {
          setAssignedTasks([]);
          setTaskSubTasks({});
        }

        const sortedUsers = [...usersRes.data].sort((a, b) =>
          a.fullName.localeCompare(b.fullName),
        );
        setUsers(sortedUsers);
        setProjects(projectsRes.data);
      } catch (err: any) {
        setTasksError(
          err?.response?.data?.message ||
            err.message ||
            "Unable to load assigned tasks.",
        );
      } finally {
        setTasksLoading(false);
      }
    };
    loadData();
  }, []);

  const handleEditClick = (task: Task) => {
    setEditingTaskId(task.id);
    setEditCompanyName(task.companyName);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate.slice(0, 10));
    setEditUserIds(task.assignedUsers.map((u) => u.id));
    setEditProgress(task.progress);
    setEditProjectName(task.projectName || "");
    setEditSubTasks(convertToModal(taskSubTasks[task.id] || []));
    setEditTaskError(null);
    setShowUpdateModal(true);
  };

  const handleDeleteClick = async (taskId: number) => {
    const ok = window.confirm("Are you sure you want to delete this task?");
    if (!ok) return;
    try {
      await api.delete(`/api/tasks/${taskId}`);
      setAssignedTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || "Delete failed");
    }
  };

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    try {
      const res = await api.put<any>(`/api/tasks/${taskId}/status`, {
        status: newStatus,
      });
      const updated: Task = res.data.task || res.data;
      setAssignedTasks((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)),
      );
    } catch (err: any) {
      alert(
        err?.response?.data?.message || err.message || "Status update failed",
      );
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTaskId === null) return;
    setEditTaskError(null);
    setEditingTaskLoading(true);
    try {
      const originalTask = assignedTasks.find((t) => t.id === editingTaskId);
      if (!originalTask) return;
      const formData = new FormData();
      formData.append("companyName", editCompanyName);
      formData.append("title", editTitle);
      formData.append("description", editDescription);
      formData.append("priority", editPriority);
      formData.append("dueDate", editDueDate);
      formData.append("userIds", editUserIds.join(","));
      formData.append("progress", String(editProgress));
      formData.append("subTasks", JSON.stringify(editSubTasks));
      if (editProjectName) {
        formData.append("projectName", editProjectName);
      }
      if (editFiles) {
        for (let i = 0; i < editFiles.length; i++) {
          formData.append("files", editFiles[i]);
        }
      }

      // Header removed to allow Axios to set correct multipart boundary
      const res = await api.put<any>(`/api/tasks/${editingTaskId}`, formData);
      const updatedTask: Task = res.data.task || res.data;
      const detailed = convertToDetailed(updatedTask.subTasks || []);
      setAssignedTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
      );
      setTaskSubTasks((prev) => ({ ...prev, [updatedTask.id]: detailed }));
      setShowUpdateModal(false);
      setEditFiles(null);
    } catch (err: any) {
      setEditTaskError(
        err?.response?.data?.message || err.message || "Update failed",
      );
    } finally {
      setEditingTaskLoading(false);
    }
  };

  const saveSubTasksToBackend = async (
    taskId: number,
    updatedSubTasks: DetailedSubTask[],
  ) => {
    try {
      const existingTask = assignedTasks.find((t) => t.id === taskId);
      const formData = new FormData();
      if (existingTask) {
        formData.append("companyName", existingTask.companyName);
        formData.append("title", existingTask.title);
        formData.append("description", existingTask.description || "");
        formData.append("priority", existingTask.priority);
        // Ensure date is YYYY-MM-DD, not a full ISO string
        formData.append("dueDate", existingTask.dueDate.slice(0, 10));
        formData.append("progress", String(existingTask.progress));
        formData.append(
          "userIds",
          existingTask.assignedUsers.map((u) => u.id).join(","),
        );
        if (existingTask.projectName) {
          formData.append("projectName", existingTask.projectName);
        }
      }
      formData.append("subTasks", JSON.stringify(updatedSubTasks));
      const res = await api.put<any>(`/api/tasks/${taskId}`, formData);
      const updatedTask: Task = res.data.task || res.data;
      // Only update from backend if it returned subtasks; otherwise keep optimistic state
      const backendSubTasks = updatedTask.subTasks || [];
      if (backendSubTasks.length > 0 || updatedSubTasks.length === 0) {
        const detailed = convertToDetailed(backendSubTasks);
        setTaskSubTasks((prev) => ({ ...prev, [taskId]: detailed }));
      }
      setAssignedTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
      );
    } catch (err: any) {
      console.error("Error saving sub-task", err);
      alert(
        err?.response?.data?.message ||
          err.message ||
          "Failed to save sub-task. Please try again.",
      );
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
      id: `temp-${Date.now()}`, // Temporary ID for optimistic UI
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

    // Optimistically update UI immediately
    setTaskSubTasks((prev) => ({ ...prev, [taskId]: updatedSubTasks }));

    if (!overrideTitle) {
      setNewSubTaskTitle((prev) => ({ ...prev, [taskId]: "" }));
    }

    try {
      // Call the dedicated addSubTask endpoint
      // Note: Check your backend routes file to confirm if it's /subtasks or /subtask
      const res = await api.post(`/api/tasks/${taskId}/subtasks`, {
        title,
        parentSubTaskId: parentId,
      });

      // Replace optimistic UI with the real database tree returned from backend
      if (res.data.subTasks) {
        const detailed = convertToDetailed(res.data.subTasks);
        setTaskSubTasks((prev) => ({ ...prev, [taskId]: detailed }));
        setAssignedTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, progress: computeAverageLeafProgress(detailed) }
              : t,
          ),
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
    if (!editingSubTask || !expandedTaskId) return;

    try {
      console.log("Updating sub-task:", {
        editingSubTask,
        newSubTaskUpdateTitle,
        subTaskProgress,
      });

      // 1. Send update to backend
      await api.put(
        `/api/tasks/${expandedTaskId}/subtasks/${editingSubTask.id}`,
        {
          title: newSubTaskUpdateTitle,
          progress: subTaskProgress,
        },
      );

      console.log("Subtask updated! Refreshing...");

      // 2. Refetch the subtask tree to get the updated history and progress
      const res = await api.get(`/api/tasks/${expandedTaskId}/subtasks`);
      console.log("Refreshed subtasks from backend:", res.data);

      const detailed = convertToDetailed(res.data);
      console.log("Converted to detailed subtasks:", detailed);

      setTaskSubTasks((prev) => ({ ...prev, [expandedTaskId]: detailed }));
      setAssignedTasks((prev) =>
        prev.map((t) =>
          t.id === expandedTaskId
            ? { ...t, progress: computeAverageLeafProgress(detailed) }
            : t,
        ),
      );

      // 3. Sync editingSubTask with fresh data so history renders immediately
      const findSubTask = (
        list: DetailedSubTask[],
        id: number | string,
      ): DetailedSubTask | null => {
        for (const st of list) {
          console.log("Checking st.id vs id:", st.id, id);
          if (String(st.id) === String(id)) {
            console.log("Found matching subtask!", st);
            return st;
          }
          const found = findSubTask(st.subTasks, id);
          if (found) return found;
        }
        return null;
      };

      const refreshed = findSubTask(detailed, editingSubTask.id);
      console.log("Refreshed subtask:", refreshed);
      if (refreshed) {
        setEditingSubTask(refreshed);
      }

      // 4. Keep popup open, but show success toast (we'll just keep it open for now)
    } catch (err: any) {
      console.error("Error updating sub-task", err);
      alert(err?.response?.data?.message || "Failed to update sub-task.");
    }
  };

  const removeSubTaskFromTask = async (
    taskId: number,
    subTaskId: string | number,
  ) => {
    const removeNested = (subTasks: DetailedSubTask[]): DetailedSubTask[] =>
      subTasks
        .filter((st) => st.id.toString() !== subTaskId.toString())
        .map((st) => ({ ...st, subTasks: removeNested(st.subTasks) }));

    const updatedSubTasks = removeNested(taskSubTasks[taskId] || []);
    await saveSubTasksToBackend(taskId, updatedSubTasks);
  };

  const openAddTaskModal = () => {
    setShowAddTaskForm(true);
    setShowUpdateModal(false);
    setEditingTaskId(null);
    setAddTaskError(null);
    setEditTaskError(null);
    setNewProgress(0);
    setNewProjectName("");
    setNewSubTasks([]);
  };

  const closeTaskModal = () => {
    setShowAddTaskForm(false);
    setShowUpdateModal(false);
    setEditingTaskId(null);
    setAddTaskError(null);
    setEditTaskError(null);
    setUserSearchTerm("");
    setNewProgress(0);
    setNewProjectName("");
    setNewSubTasks([]);
    setEditProgress(0);
    setEditProjectName("");
    setEditSubTasks([]);
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

      // Header removed to allow Axios to set correct multipart boundary
      const response = await api.post<any>("/api/tasks", formData);
      const task: Task = response.data.task || response.data;
      setAssignedTasks((prev) => [task, ...prev]);
      setTaskSubTasks((prev) => ({
        ...prev,
        [task.id]: convertToDetailed(task.subTasks || []),
      }));
      setShowAddTaskForm(false);
      setNewCompanyName("");
      setNewTitle("");
      setNewDescription("");
      setNewPriority("high");
      setNewDueDate("");
      setNewUserIds([]);
      setNewAssignAll(false);
      setNewFiles(null);
      setNewProgress(0);
      setNewProjectName("");
      setNewSubTasks([]);
    } catch (err: any) {
      setAddTaskError(
        err?.response?.data?.message || err.message || "Unable to add task.",
      );
    } finally {
      setAddingTask(false);
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "bg-rose-100 text-rose-700 border-rose-200";
      case "medium":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "low":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "in_progress":
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-100";
      default:
        return "bg-slate-50 text-slate-700 border-slate-100";
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
        className="overflow-hidden bg-white rounded-xl border border-slate-100"
      >
        <div
          className="flex justify-between items-center py-2 pr-3"
          style={{ paddingLeft: `${level * 20 + 12}px` }}
        >
          <div className="flex gap-2 items-center">
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
                console.log("Selected Subtask:", st);
                console.log("History:", st.history);
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
                    `/api/tasks/${expandedTaskId}/subtasks/${st.id}/comments`,
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

  return (
    <div className="pb-12 space-y-6">
      {/* Search and Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 justify-between md:flex-row md:items-center">
          <div className="relative flex-1 max-w-md group">
            <div className="flex absolute inset-y-0 left-0 items-center pl-4 pointer-events-none">
              <Search className="w-5 h-5 transition-colors text-slate-400 group-focus-within:text-indigo-500" />
            </div>
            <input
              type="text"
              placeholder="Search tasks by title, company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block py-3 pr-4 pl-11 w-full text-sm bg-white rounded-2xl border shadow-sm transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <button
            onClick={openAddTaskModal}
            className="flex gap-2 items-center px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-2xl shadow-lg transition-all hover:bg-indigo-700 shadow-indigo-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Create Task
          </button>
        </div>
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {/* Company Name Filter */}
          <select
            value={filterCompanyName}
            onChange={(e) => setFilterCompanyName(e.target.value)}
            className="px-4 py-3 text-sm bg-white rounded-2xl border shadow-sm transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="">All Companies</option>
            {COMPANY_NAMES.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>
          {/* Project Name Filter */}
          <input
            type="text"
            placeholder="Filter by Project Name"
            value={filterProjectName}
            onChange={(e) => setFilterProjectName(e.target.value)}
            className="px-4 py-3 text-sm bg-white rounded-2xl border shadow-sm transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-4 py-3 text-sm bg-white rounded-2xl border shadow-sm transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 text-sm bg-white rounded-2xl border shadow-sm transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          {/* Employee Filter */}
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="px-4 py-3 text-sm bg-white rounded-2xl border shadow-sm transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="">All Employees</option>
            {users.map((user) => (
              <option key={user.id} value={user.id.toString()}>
                {user.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tasks Table/List */}
      <div className="space-y-5">
        {tasksLoading ? (
          <div className="flex flex-col justify-center items-center py-20 bg-white rounded-[32px] border border-slate-200 shadow-sm">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="mt-4 font-medium text-slate-500">
              Loading your assignments...
            </p>
          </div>
        ) : tasksError ? (
          <div className="flex gap-4 items-center p-6 m-8 font-medium text-rose-700 bg-rose-50 rounded-2xl border border-rose-100">
            <AlertCircle className="w-6 h-6" />
            {tasksError}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col justify-center items-center px-4 py-20 text-center bg-white rounded-[32px] border border-slate-200 shadow-sm">
            <div className="flex justify-center items-center mb-6 w-20 h-20 rounded-full bg-slate-50">
              <CheckCircle2 className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-900">
              No tasks found
            </h3>
            <p className="mx-auto max-w-sm text-slate-500">
              Either you're all caught up or no tasks match your current search.
            </p>
          </div>
        ) : (
          Object.entries(groupedTasks).map(([companyName, tasks]) => (
            <div
              key={companyName}
              className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden"
            >
              <button
                onClick={() => toggleCompany(companyName)}
                className="flex justify-between items-center px-8 py-5 w-full text-left border-b transition-all bg-slate-50/50 hover:bg-slate-100 border-slate-100"
              >
                <div className="flex gap-3 items-center">
                  <Building2 className="w-5 h-5 text-slate-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    {companyName}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    {tasks.length} Tasks
                  </span>
                </div>
                <div
                  className={`transition-transform duration-300 ${expandedCompanies.has(companyName) ? "rotate-180" : ""}`}
                >
                  <ChevronDown className="w-5 h-5 text-slate-500" />
                </div>
              </button>
              {expandedCompanies.has(companyName) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="px-8 py-5 text-xs font-bold tracking-widest uppercase text-slate-500">
                          Task
                        </th>
                        <th className="px-8 py-5 text-xs font-bold tracking-widest uppercase text-slate-500">
                          Project Name
                        </th>
                        <th className="px-8 py-5 text-xs font-bold tracking-widest text-center uppercase text-slate-500">
                          Priority
                        </th>
                        <th className="px-8 py-5 text-xs font-bold tracking-widest text-center uppercase text-slate-500">
                          Progress & Status
                        </th>
                        <th className="px-8 py-5 text-xs font-bold tracking-widest text-right uppercase text-slate-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tasks.map((task) => (
                        <tr
                          key={task.id}
                          className="transition-colors group hover:bg-slate-50/30"
                        >
                          <td className="px-8 py-6">
                            <div className="max-w-[300px]">
                              <button
                                onClick={() =>
                                  setExpandedTaskId(
                                    expandedTaskId === task.id ? null : task.id,
                                  )
                                }
                                className="text-left"
                              >
                                <p className="text-base font-bold transition-colors text-slate-900 group-hover:text-indigo-600">
                                  {task.title}
                                </p>
                                <div className="flex gap-3 items-center mt-2">
                                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 border border-slate-200">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(task.dueDate)}
                                  </div>
                                  <div className="flex -space-x-1">
                                    {task.assignedUsers.slice(0, 3).map((u) => (
                                      <div
                                        key={u.id}
                                        className="flex items-center justify-center w-7 h-7 text-[10px] font-bold text-indigo-700 bg-indigo-100 border-2 border-white rounded-full shadow-sm"
                                        title={u.fullName}
                                      >
                                        {u.fullName.charAt(0)}
                                      </div>
                                    ))}
                                    {task.assignedUsers.length > 3 && (
                                      <div className="flex items-center justify-center w-7 h-7 text-[10px] font-bold border-2 border-white rounded-full shadow-sm bg-slate-100 text-slate-600">
                                        +{task.assignedUsers.length - 3}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-sm font-medium text-slate-700">
                              {task.projectName || "-"}
                            </div>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <span
                              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border ${getPriorityStyle(task.priority)}`}
                            >
                              {task.priority}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col items-center gap-2 min-w-[150px]">
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
                                  style={{ width: `${task.progress}%` }}
                                />
                              </div>
                              <div className="flex justify-between items-center w-full text-[10px] text-slate-500">
                                <span className="font-bold">
                                  {task.progress}%
                                </span>
                                <div className="inline-block relative text-left">
                                  <select
                                    value={task.status}
                                    onChange={(e) =>
                                      handleStatusChange(
                                        task.id,
                                        e.target.value,
                                      )
                                    }
                                    className={`appearance-none px-3 py-1 pr-6 rounded-full text-[10px] font-bold border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${getStatusStyle(task.status)} uppercase tracking-wider`}
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="in_progress">
                                      In Progress
                                    </option>
                                    <option value="completed">Completed</option>
                                  </select>
                                  <ChevronDown className="absolute right-2 top-1/2 w-2.5 h-2.5 opacity-50 -translate-y-1/2 pointer-events-none" />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button
                              onClick={() => handleDeleteClick(task.id)}
                              className="p-2 rounded-lg transition-all text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Task Creation Modal */}
      {showAddTaskForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Create Task
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Assign new task to team.
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
                      required
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
                    id="task-files"
                  />
                  <label
                    htmlFor="task-files"
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

              {/* Row 6: Assigned To (full width) */}
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-semibold text-slate-700">
                  Assign To
                </label>
                <div className="space-y-2">
                  <label className="flex gap-2 items-center text-xs font-medium cursor-pointer text-slate-600">
                    <input
                      type="checkbox"
                      checked={newAssignAll}
                      onChange={(e) => setNewAssignAll(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    All
                  </label>
                  {!newAssignAll && (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search users..."
                          value={userSearchTerm}
                          onChange={(e) => setUserSearchTerm(e.target.value)}
                          className="py-2 pr-4 pl-9 w-full text-sm rounded-xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                      <div className="overflow-y-auto max-h-[100px] p-2 space-y-1 bg-white rounded-xl border border-slate-200">
                        {users
                          .filter((u) =>
                            u.fullName
                              .toLowerCase()
                              .includes(userSearchTerm.toLowerCase()),
                          )
                          .map((u) => {
                            const isSelected = newUserIds.includes(u.id);
                            return (
                              <label
                                key={u.id}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all text-xs ${isSelected ? "text-indigo-700 bg-indigo-50" : "hover:bg-slate-50 text-slate-600"}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked)
                                      setNewUserIds([...newUserIds, u.id]);
                                    else
                                      setNewUserIds(
                                        newUserIds.filter((id) => id !== u.id),
                                      );
                                  }}
                                  className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                />
                                {u.fullName}
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  )}
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

      {/* Task Details Popup */}
      {expandedTaskId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex sticky top-0 justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <p className="text-xs font-bold tracking-wider uppercase text-slate-500">
                {
                  assignedTasks.find((t) => t.id === expandedTaskId)
                    ?.companyName
                }
              </p>
              <button
                onClick={() => setExpandedTaskId(null)}
                className="p-2 rounded-xl transition-colors hover:bg-slate-200"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* First Row: Project Name, Due Date, Progress */}
              {(() => {
                const task = assignedTasks.find((t) => t.id === expandedTaskId);
                return (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="p-3 rounded-2xl border bg-slate-50 border-slate-100">
                      <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
                        Project Name
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {task?.projectName || "N/A"}
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl border bg-slate-50 border-slate-100">
                      <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
                        Due Date
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {new Date(task?.dueDate || "").toLocaleDateString(
                          "en-US",
                          { year: "numeric", month: "long", day: "numeric" },
                        )}
                      </p>
                    </div>
                    <div className="p-3 rounded-2xl border bg-slate-50 border-slate-100">
                      <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
                        Progress
                      </p>
                      <div className="flex flex-col gap-2 items-start">
                        <div className="overflow-hidden w-full h-2 rounded-full bg-slate-200">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600"
                            style={{ width: `${task?.progress || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-700">
                          {task?.progress}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Second Row: Description + Assigned To */}
              {(() => {
                const task = assignedTasks.find((t) => t.id === expandedTaskId);
                return (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="p-4 rounded-2xl border bg-slate-50 border-slate-100">
                      <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
                        Description
                      </p>
                      <p className="text-sm whitespace-pre-wrap text-slate-700">
                        {task?.description || "No description provided."}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl border bg-slate-50 border-slate-100">
                      <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
                        Assigned To
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {task?.assignedUsers.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm"
                          >
                            <div className="flex justify-center items-center w-6 h-6 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full">
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
                );
              })()}

              {/* Third Section: Sub-Tasks */}
              <div className="p-4 rounded-2xl border bg-slate-50 border-slate-100">
                <p className="mb-3 text-xs font-bold tracking-wider uppercase text-slate-500">
                  Sub-Tasks
                </p>
                {/* Add input */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newSubTaskTitle[expandedTaskId] || ""}
                    onChange={(e) =>
                      setNewSubTaskTitle((prev) => ({
                        ...prev,
                        [expandedTaskId]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSubTaskToTask(expandedTaskId);
                      }
                    }}
                    className="flex-1 px-4 py-2 text-sm bg-white rounded-xl border transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="Enter sub-task title"
                  />
                  <button
                    type="button"
                    onClick={() => addSubTaskToTask(expandedTaskId)}
                    className="flex gap-1 items-center px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl transition-all hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
                {/* Sub-task list */}
                <div className="space-y-2">
                  {(taskSubTasks[expandedTaskId] || []).length === 0 ? (
                    <p className="py-4 text-sm text-center text-slate-400">
                      No sub-tasks yet
                    </p>
                  ) : (
                    (taskSubTasks[expandedTaskId] || []).map((st) =>
                      renderSubTaskItem(st),
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Popup */}
      {showActivityPopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">
                Activity History
              </h3>
              <button
                onClick={() => setShowActivityPopup(false)}
                className="p-2 rounded-xl transition-colors hover:bg-slate-200"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="flex gap-3 p-3 rounded-xl border bg-slate-50 border-slate-100">
                <div className="flex flex-shrink-0 justify-center items-center w-8 h-8 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full">
                  Y
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-900">
                    You changed the task status to "In Progress"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-task Update Popup */}
      {showSubTaskUpdatePopup && editingSubTask && expandedTaskId && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">
                Update Sub-Task
              </h3>
              <button
                onClick={() => setShowSubTaskUpdatePopup(false)}
                className="p-2 rounded-xl transition-colors hover:bg-slate-200"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* First row: Task title (parent task's title) */}
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-semibold text-slate-700">
                  Task Title
                </label>
                <p className="text-lg font-semibold text-slate-900">
                  {assignedTasks.find((t) => t.id === expandedTaskId)?.title ||
                    "N/A"}
                </p>
              </div>

              {/* Second row: New sub-task update + Attachment */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-10">
                {/* New sub-task update: ~70% width */}
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
                {/* Attachment: ~30% width */}
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
                      className="flex flex-col gap-1 justify-center items-center px-4 py-3 w-full text-xs rounded-xl border-2 border-dashed transition-all cursor-pointer bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-500 hover:text-indigo-600 group"
                    >
                      <Paperclip className="w-4 h-4" />
                      {subTaskUpdateFiles?.length
                        ? `${subTaskUpdateFiles.length} file(s)`
                        : "Select file(s)"}
                    </label>
                  </div>
                </div>
              </div>

              {/* Simplified progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
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

              {/* Last update section */}
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

              {/* Buttons at bottom */}
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
                  onClick={handleSubTaskUpdate} // Hooked up to the new function
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
      {showSubTaskActivityPopup && editingSubTask && expandedTaskId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">
                Sub-Task Activity & Feedback
              </h3>
              <button
                onClick={() => setShowSubTaskActivityPopup(false)}
                className="p-2 rounded-xl transition-colors hover:bg-slate-200"
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
                    <div className="flex gap-2 items-center mb-1">
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
                    <p className="mb-2 text-sm text-slate-800">
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
                                "Sending feedback from AssignedTasks.tsx:",
                                {
                                  expandedTaskId,
                                  subtaskId: editingSubTask?.id,
                                  commentId: comment.id,
                                  feedback: feedbackTexts[comment.id],
                                },
                              );
                              await api.put(
                                `/api/tasks/${expandedTaskId}/subtasks/${editingSubTask?.id}/comments/${comment.id}/feedback`,
                                {
                                  feedback: feedbackTexts[comment.id],
                                },
                              );
                              console.log("Feedback sent successfully!");
                              // Re-fetch comments to get updated feedback
                              const res = await api.get(
                                `/api/tasks/${expandedTaskId}/subtasks/${editingSubTask?.id}/comments`,
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
                  className="flex-1 px-4 py-2 text-sm bg-white rounded-xl border transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newCommentText.trim()) return;
                    const url = `/api/tasks/${expandedTaskId}/subtasks/${editingSubTask?.id}/comments`;
                    console.log("Calling URL to add comment:", url);
                    console.log("expandedTaskId:", expandedTaskId);
                    console.log("editingSubTask.id:", editingSubTask?.id);
                    try {
                      await api.post(url, {
                        commentText: newCommentText,
                      });
                      // Re-fetch comments to get the new one
                      const res = await api.get(url);
                      setSubTaskComments(res.data);
                      setNewCommentText("");
                    } catch (err: any) {
                      console.error("Failed to add comment", err);
                      console.error(
                        "Error details:",
                        err.response?.data || err.message,
                      );
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

      {/* Update Task Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Update Task
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Modify task details
                </p>
              </div>
              <button
                onClick={() => setShowUpdateModal(false)}
                className="p-2 rounded-xl shadow-sm transition-all hover:bg-white text-slate-400 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editTaskError && (
                <div className="flex gap-2 items-center p-3 text-xs font-medium text-rose-700 bg-rose-50 rounded-xl border border-rose-100">
                  <AlertCircle className="w-4 h-4" />
                  {editTaskError}
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
                      value={editCompanyName}
                      onChange={(e) => setEditCompanyName(e.target.value)}
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
                      value={editProjectName}
                      onChange={(e) => setEditProjectName(e.target.value)}
                      required
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
              {/* Row 2: Title, Priority, Due Date */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    Task Title
                  </label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Task title"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    Priority
                  </label>
                  <div className="relative">
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      required
                      className="w-full pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px]"
                    placeholder="Task description"
                  />
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="ml-1 text-xs font-semibold text-slate-700">
                      Due Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="ml-1 text-xs font-semibold text-slate-700">
                      Progress: {editProgress}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editProgress}
                      onChange={(e) => setEditProgress(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 accent-indigo-600"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="col-span-3 space-y-1.5">
                  <div className="flex gap-2 justify-between items-center">
                    <label className="ml-1 text-xs font-semibold text-slate-700">
                      Sub-Tasks
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditSubTasks([
                          ...editSubTasks,
                          {
                            id: Date.now().toString(),
                            title: "",
                            subTasks: [],
                          },
                        ])
                      }
                      className="flex gap-1 items-center px-3 py-1 text-xs font-bold text-white bg-indigo-600 rounded-lg transition-all hover:bg-indigo-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Sub-Task
                    </button>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {editSubTasks.map((subTask, idx) => (
                      <div
                        key={subTask.id}
                        className="p-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50"
                      >
                        <div className="flex gap-2 items-center">
                          <input
                            value={subTask.title}
                            onChange={(e) => {
                              const updated = [...editSubTasks];
                              updated[idx] = {
                                ...subTask,
                                title: e.target.value,
                              };
                              setEditSubTasks(updated);
                            }}
                            className="flex-1 px-4 py-2 text-sm bg-white rounded-xl border transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            placeholder="Sub-task title"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const u = [...editSubTasks];
                              u.splice(idx, 1);
                              setEditSubTasks(u);
                            }}
                            className="p-2 rounded-xl transition-all text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="pl-4 space-y-2">
                          {(subTask.subTasks || []).map((child, cIdx) => (
                            <div
                              key={child.id}
                              className="flex gap-2 items-center"
                            >
                              <div className="w-4 h-px bg-slate-300 shrink-0" />
                              <input
                                value={child.title}
                                onChange={(e) => {
                                  const updated = [...editSubTasks];
                                  const children = [
                                    ...(updated[idx].subTasks || []),
                                  ];
                                  children[cIdx] = {
                                    ...child,
                                    title: e.target.value,
                                  };
                                  updated[idx] = {
                                    ...updated[idx],
                                    subTasks: children,
                                  };
                                  setEditSubTasks(updated);
                                }}
                                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                placeholder="Nested sub-task"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...editSubTasks];
                                  const children = [
                                    ...(updated[idx].subTasks || []),
                                  ];
                                  children.splice(cIdx, 1);
                                  updated[idx] = {
                                    ...updated[idx],
                                    subTasks: children,
                                  };
                                  setEditSubTasks(updated);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...editSubTasks];
                              updated[idx] = {
                                ...updated[idx],
                                subTasks: [
                                  ...(updated[idx].subTasks || []),
                                  {
                                    id: Date.now().toString(),
                                    title: "",
                                    subTasks: [],
                                  },
                                ],
                              };
                              setEditSubTasks(updated);
                            }}
                            className="flex gap-1 items-center ml-5 text-xs font-semibold text-indigo-500 transition-colors hover:text-indigo-700"
                          >
                            <Plus className="w-3 h-3" />
                            Add nested sub-task
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-span-1 space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    Attachments
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => setEditFiles(e.target.files)}
                      className="hidden"
                      id="update-task-files"
                    />
                    <label
                      htmlFor="update-task-files"
                      className="flex flex-col gap-2 justify-center items-center px-4 py-6 w-full h-full text-sm rounded-xl border-2 border-dashed transition-all cursor-pointer bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-500 hover:text-indigo-600 group"
                    >
                      <Paperclip className="w-6 h-6 transition-transform group-hover:rotate-12 text-slate-400 group-hover:text-indigo-500" />
                      {editFiles?.length ? (
                        <span className="font-bold text-center">
                          {editFiles.length} files selected
                        </span>
                      ) : (
                        <span className="text-center">
                          Upload additional files
                        </span>
                      )}
                    </label>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3 rounded-2xl border bg-slate-50 border-slate-100">
                <label className="flex gap-2 items-center text-xs font-bold text-slate-900">
                  <UsersIcon className="w-3.5 h-3.5 text-indigo-500" />
                  Assign To
                </label>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div className="overflow-y-auto p-2 space-y-1 max-h-32 bg-white rounded-xl border shadow-inner border-slate-200">
                    {users
                      .filter((u) =>
                        u.fullName
                          .toLowerCase()
                          .includes(userSearchTerm.toLowerCase()),
                      )
                      .map((u) => {
                        const isSelected = editUserIds.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${isSelected ? "text-indigo-700 bg-indigo-50" : "hover:bg-slate-50 text-slate-600"}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked)
                                  setEditUserIds([...editUserIds, u.id]);
                                else
                                  setEditUserIds(
                                    editUserIds.filter((id) => id !== u.id),
                                  );
                              }}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                            />
                            <div className="flex flex-col">
                              <span className="text-xs font-bold">
                                {u.fullName}
                              </span>
                              <span className="text-[10px] opacity-60">
                                {u.email}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                  className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editingTaskLoading}
                  className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {editingTaskLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignedTasks;

// import React, { useEffect, useState } from "react";
// import api from "../api/axios";
// import {
//   Plus,
//   Search,
//   Filter,
//   Edit2,
//   Trash2,
//   Clock,
//   AlertCircle,
//   Building2,
//   Users as UsersIcon,
//   Paperclip,
//   CheckCircle2,
//   X,
//   Loader2,
//   Calendar,
//   ChevronDown,
//   ChevronRight,
// } from "lucide-react";

// type AssignedUser = {
//   id: number;
//   fullName: string;
//   email: string;
// };

// type User = {
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

// const getFileUrl = (path: string) => {
//   if (!path) return "#";
//   const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
//   const normalizedPath = path.replace(/\\/g, "/");
//   return `${API_BASE}/${normalizedPath}`;
// };

// const AssignedTasks: React.FC = () => {
//   const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
//   const [users, setUsers] = useState<User[]>([]);
//   const [tasksLoading, setTasksLoading] = useState(false);
//   const [tasksError, setTasksError] = useState<string | null>(null);
//   const [showAddTaskForm, setShowAddTaskForm] = useState(false);
//   const [newCompanyName, setNewCompanyName] = useState("");
//   const [newTitle, setNewTitle] = useState("");
//   const [newDescription, setNewDescription] = useState("");
//   const [newPriority, setNewPriority] = useState("high");
//   const [newDueDate, setNewDueDate] = useState("");
//   const [newUserIds, setNewUserIds] = useState<number[]>([]);
//   const [newAssignAll, setNewAssignAll] = useState(false);
//   const [newFiles, setNewFiles] = useState<FileList | null>(null);
//   const [addingTask, setAddingTask] = useState(false);
//   const [addTaskError, setAddTaskError] = useState<string | null>(null);

//   const [searchTerm, setSearchTerm] = useState("");
//   const [userSearchTerm, setUserSearchTerm] = useState("");
//   const [newProgress, setNewProgress] = useState(0);
//   // Filter state variables
//   const [filterCompanyName, setFilterCompanyName] = useState("");
//   const [filterProjectName, setFilterProjectName] = useState("");
//   const [filterPriority, setFilterPriority] = useState("");
//   const [filterStatus, setFilterStatus] = useState("");
//   const [filterEmployee, setFilterEmployee] = useState("");
//   const [editProgress, setEditProgress] = useState(0);

//   const [newProjectName, setNewProjectName] = useState("");
//   const [editProjectName, setEditProjectName] = useState("");

//   type ModalSubTask = {
//     id: string;
//     title: string;
//     subTasks?: ModalSubTask[]; // Made optional to fix TS errors
//   };
//   const [newSubTasks, setNewSubTasks] = useState<ModalSubTask[]>([]);
//   const [editSubTasks, setEditSubTasks] = useState<ModalSubTask[]>([]);
//   const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
//   const [editCompanyName, setEditCompanyName] = useState("");
//   const [editTitle, setEditTitle] = useState("");
//   const [editDescription, setEditDescription] = useState("");
//   const [editPriority, setEditPriority] = useState("high");
//   const [editDueDate, setEditDueDate] = useState("");
//   const [editUserIds, setEditUserIds] = useState<number[]>([]);
//   const [editFiles, setEditFiles] = useState<FileList | null>(null);
//   const [editingTaskLoading, setEditingTaskLoading] = useState(false);
//   const [editTaskError, setEditTaskError] = useState<string | null>(null);
//   const [showUpdateModal, setShowUpdateModal] = useState(false);

//   const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
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
//   const [newSubTaskTitle, setNewSubTaskTitle] = useState<
//     Record<number, string>
//   >({});
//   const [expandedNestedSubTasks, setExpandedNestedSubTasks] = useState<
//     Set<string>
//   >(new Set());
//   const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(
//     new Set(),
//   );
//   const [showActivityPopup, setShowActivityPopup] = useState(false);

//   // Sub-task update popup state
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

//   const toggleCompany = (companyName: string) => {
//     setExpandedCompanies((prev) => {
//       const newSet = new Set(prev);
//       if (newSet.has(companyName)) {
//         newSet.delete(companyName);
//       } else {
//         newSet.add(companyName);
//       }
//       return newSet;
//     });
//   };

//   const filteredTasks = assignedTasks.filter((task) => {
//     // Search term filter
//     const matchesSearch =
//       task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
//       task.companyName.toLowerCase().includes(searchTerm.toLowerCase());

//     // Company name filter
//     const matchesCompany = filterCompanyName
//       ? task.companyName.toLowerCase() === filterCompanyName.toLowerCase()
//       : true;

//     // Project name filter
//     const matchesProject = filterProjectName
//       ? (task.projectName || "")
//           .toLowerCase()
//           .includes(filterProjectName.toLowerCase())
//       : true;

//     // Priority filter
//     const matchesPriority = filterPriority
//       ? task.priority.toLowerCase() === filterPriority.toLowerCase()
//       : true;

//     // Status filter
//     const matchesStatus = filterStatus
//       ? task.status.toLowerCase() === filterStatus.toLowerCase()
//       : true;

//     // Employee filter (assigned user)
//     const matchesEmployee = filterEmployee
//       ? task.assignedUsers.some((u) => u.id.toString() === filterEmployee)
//       : true;

//     return (
//       matchesSearch &&
//       matchesCompany &&
//       matchesProject &&
//       matchesPriority &&
//       matchesStatus &&
//       matchesEmployee
//     );
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

//   // Collect all unique project names from existing tasks
//   const uniqueProjectNames = Array.from(
//     new Set(assignedTasks.map((task) => task.projectName).filter(Boolean)),
//   ).sort();

//   const COMPANY_NAMES = [
//     "Janda Devi Nepal Energy Pvt Ltd",
//     "Bakas Renewable energy Ltd",
//     "Troika Energy Pvt Ltd",
//     "RR onstruction Pvt Ltd",
//     "Grid Tie Pvt Ltd",
//     "Janda Devi Biomass Pvt Ltd",
//     "Janda Devi Solar Pvt Ltd",
//     "Bhojpur Shivalaya Power Pvt Ltd",
//     "Green Leaves Pvt Ltd",
//     "Usolar Janda Energy Pvt Ltd",
//   ].sort((a, b) => a.localeCompare(b));

//   const convertToDetailed = (subTasks: any[]): DetailedSubTask[] =>
//     subTasks.map((st) => ({
//       id: st.id,
//       title: st.title,
//       progress: st.progress || 0,
//       history: st.history || [],
//       subTasks: convertToDetailed(st.children || st.subTasks || []),
//     }));

//   const convertToModal = (subTasks: DetailedSubTask[]): ModalSubTask[] =>
//     subTasks.map((st) => ({
//       id: st.id.toString(),
//       title: st.title,
//       subTasks: convertToModal(st.subTasks || []),
//     }));

//   useEffect(() => {
//     const loadData = async () => {
//       setTasksLoading(true);
//       setTasksError(null);
//       try {
//         const [tasksRes, usersRes] = await Promise.all([
//           api.get<any>("/api/tasks"),
//           api.get<User[]>("/api/users"),
//         ]);

//         if (Array.isArray(tasksRes.data)) {
//           setAssignedTasks(tasksRes.data);
//           const subTasksMap: Record<number, DetailedSubTask[]> = {};
//           tasksRes.data.forEach((task: Task) => {
//             subTasksMap[task.id] = convertToDetailed(task.subTasks || []);
//           });
//           setTaskSubTasks(subTasksMap);
//         } else if (tasksRes.data?.task) {
//           setAssignedTasks([tasksRes.data.task]);
//         } else if (tasksRes.data?.tasks) {
//           setAssignedTasks(tasksRes.data.tasks);
//         } else {
//           setAssignedTasks([]);
//         }

//         const sortedUsers = [...usersRes.data].sort((a, b) =>
//           a.fullName.localeCompare(b.fullName),
//         );
//         setUsers(sortedUsers);
//       } catch (err: any) {
//         setTasksError(
//           err?.response?.data?.message ||
//             err.message ||
//             "Unable to load assigned tasks.",
//         );
//       } finally {
//         setTasksLoading(false);
//       }
//     };
//     loadData();
//   }, []);

//   const handleEditClick = (task: Task) => {
//     setEditingTaskId(task.id);
//     setEditCompanyName(task.companyName);
//     setEditTitle(task.title);
//     setEditDescription(task.description || "");
//     setEditPriority(task.priority);
//     setEditDueDate(task.dueDate.slice(0, 10));
//     setEditUserIds(task.assignedUsers.map((u) => u.id));
//     setEditProgress(task.progress);
//     setEditProjectName(task.projectName || "");
//     setEditSubTasks(convertToModal(taskSubTasks[task.id] || []));
//     setEditTaskError(null);
//     setShowUpdateModal(true);
//   };

//   const handleDeleteClick = async (taskId: number) => {
//     const ok = window.confirm("Are you sure you want to delete this task?");
//     if (!ok) return;
//     try {
//       await api.delete(`/api/tasks/${taskId}`);
//       setAssignedTasks((prev) => prev.filter((t) => t.id !== taskId));
//     } catch (err: any) {
//       alert(err?.response?.data?.message || err.message || "Delete failed");
//     }
//   };

//   const handleStatusChange = async (taskId: number, newStatus: string) => {
//     try {
//       const res = await api.put<any>(`/api/tasks/${taskId}/status`, {
//         status: newStatus,
//       });
//       const updated: Task = res.data.task || res.data;
//       setAssignedTasks((prev) =>
//         prev.map((t) => (t.id === updated.id ? updated : t)),
//       );
//     } catch (err: any) {
//       alert(
//         err?.response?.data?.message || err.message || "Status update failed",
//       );
//     }
//   };

//   const handleEditSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (editingTaskId === null) return;
//     setEditTaskError(null);
//     setEditingTaskLoading(true);
//     try {
//       const originalTask = assignedTasks.find((t) => t.id === editingTaskId);
//       if (!originalTask) return;
//       const formData = new FormData();
//       formData.append("companyName", originalTask.companyName);
//       formData.append("title", originalTask.title);
//       formData.append("description", editDescription);
//       formData.append("priority", originalTask.priority);
//       formData.append("dueDate", editDueDate);
//       formData.append("userIds", editUserIds.join(","));
//       formData.append("progress", String(editProgress));
//       formData.append("subTasks", JSON.stringify(editSubTasks));
//       if (originalTask.projectName) {
//         formData.append("projectName", originalTask.projectName);
//       }
//       if (editFiles) {
//         for (let i = 0; i < editFiles.length; i++) {
//           formData.append("files", editFiles[i]);
//         }
//       }

//       // Header removed to allow Axios to set correct multipart boundary
//       const res = await api.put<any>(`/api/tasks/${editingTaskId}`, formData);
//       const updatedTask: Task = res.data.task || res.data;
//       const detailed = convertToDetailed(updatedTask.subTasks || []);
//       setAssignedTasks((prev) =>
//         prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
//       );
//       setTaskSubTasks((prev) => ({ ...prev, [updatedTask.id]: detailed }));
//       setShowUpdateModal(false);
//       setEditFiles(null);
//     } catch (err: any) {
//       setEditTaskError(
//         err?.response?.data?.message || err.message || "Update failed",
//       );
//     } finally {
//       setEditingTaskLoading(false);
//     }
//   };

//   const saveSubTasksToBackend = async (
//     taskId: number,
//     updatedSubTasks: DetailedSubTask[],
//   ) => {
//     try {
//       const existingTask = assignedTasks.find((t) => t.id === taskId);
//       const formData = new FormData();
//       if (existingTask) {
//         formData.append("companyName", existingTask.companyName);
//         formData.append("title", existingTask.title);
//         formData.append("description", existingTask.description || "");
//         formData.append("priority", existingTask.priority);
//         // Ensure date is YYYY-MM-DD, not a full ISO string
//         formData.append("dueDate", existingTask.dueDate.slice(0, 10));
//         formData.append("progress", String(existingTask.progress));
//         formData.append(
//           "userIds",
//           existingTask.assignedUsers.map((u) => u.id).join(","),
//         );
//         if (existingTask.projectName) {
//           formData.append("projectName", existingTask.projectName);
//         }
//       }
//       formData.append("subTasks", JSON.stringify(updatedSubTasks));
//       const res = await api.put<any>(`/api/tasks/${taskId}`, formData);
//       const updatedTask: Task = res.data.task || res.data;
//       // Only update from backend if it returned subtasks; otherwise keep optimistic state
//       const backendSubTasks = updatedTask.subTasks || [];
//       if (backendSubTasks.length > 0 || updatedSubTasks.length === 0) {
//         const detailed = convertToDetailed(backendSubTasks);
//         setTaskSubTasks((prev) => ({ ...prev, [taskId]: detailed }));
//       }
//       setAssignedTasks((prev) =>
//         prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
//       );
//     } catch (err: any) {
//       console.error("Error saving sub-task", err);
//       alert(
//         err?.response?.data?.message ||
//           err.message ||
//           "Failed to save sub-task. Please try again.",
//       );
//     }
//   };

//   const addSubTaskToTask = async (
//     taskId: number,
//     parentId?: string,
//     overrideTitle?: string,
//   ) => {
//     const title = overrideTitle ?? (newSubTaskTitle[taskId] || "");
//     if (!title.trim()) return;

//     const newSubTask: DetailedSubTask = {
//       id: `temp-${Date.now()}`, // Temporary ID for optimistic UI
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

//     // Optimistically update UI immediately
//     setTaskSubTasks((prev) => ({ ...prev, [taskId]: updatedSubTasks }));

//     if (!overrideTitle) {
//       setNewSubTaskTitle((prev) => ({ ...prev, [taskId]: "" }));
//     }

//     try {
//       // Call the dedicated addSubTask endpoint
//       // Note: Check your backend routes file to confirm if it's /subtasks or /subtask
//       const res = await api.post(`/api/tasks/${taskId}/subtasks`, {
//         title,
//         parentSubTaskId: parentId,
//       });

//       // Replace optimistic UI with the real database tree returned from backend
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
//     if (!editingSubTask || !expandedTaskId) return;

//     try {
//       console.log("Updating sub-task:", {
//         editingSubTask,
//         newSubTaskUpdateTitle,
//         subTaskProgress,
//       });

//       // 1. Send update to backend
//       await api.put(
//         `/api/tasks/${expandedTaskId}/subtasks/${editingSubTask.id}`,
//         {
//           title: newSubTaskUpdateTitle,
//           progress: subTaskProgress,
//         },
//       );

//       console.log("Subtask updated! Refreshing...");

//       // 2. Refetch the subtask tree to get the updated history and progress
//       const res = await api.get(`/api/tasks/${expandedTaskId}/subtasks`);
//       console.log("Refreshed subtasks from backend:", res.data);

//       const detailed = convertToDetailed(res.data);
//       console.log("Converted to detailed subtasks:", detailed);

//       setTaskSubTasks((prev) => ({ ...prev, [expandedTaskId]: detailed }));

//       // 3. Sync editingSubTask with fresh data so history renders immediately
//       const findSubTask = (
//         list: DetailedSubTask[],
//         id: number | string,
//       ): DetailedSubTask | null => {
//         for (const st of list) {
//           console.log("Checking st.id vs id:", st.id, id);
//           if (String(st.id) === String(id)) {
//             console.log("Found matching subtask!", st);
//             return st;
//           }
//           const found = findSubTask(st.subTasks, id);
//           if (found) return found;
//         }
//         return null;
//       };

//       const refreshed = findSubTask(detailed, editingSubTask.id);
//       console.log("Refreshed subtask:", refreshed);
//       if (refreshed) {
//         setEditingSubTask(refreshed);
//       }

//       // 4. Keep popup open, but show success toast (we'll just keep it open for now)
//     } catch (err: any) {
//       console.error("Error updating sub-task", err);
//       alert(err?.response?.data?.message || "Failed to update sub-task.");
//     }
//   };

//   const removeSubTaskFromTask = async (
//     taskId: number,
//     subTaskId: string | number,
//   ) => {
//     const removeNested = (subTasks: DetailedSubTask[]): DetailedSubTask[] =>
//       subTasks
//         .filter((st) => st.id.toString() !== subTaskId.toString())
//         .map((st) => ({ ...st, subTasks: removeNested(st.subTasks) }));

//     const updatedSubTasks = removeNested(taskSubTasks[taskId] || []);
//     await saveSubTasksToBackend(taskId, updatedSubTasks);
//   };

//   const openAddTaskModal = () => {
//     setShowAddTaskForm(true);
//     setShowUpdateModal(false);
//     setEditingTaskId(null);
//     setAddTaskError(null);
//     setEditTaskError(null);
//     setNewProgress(0);
//     setNewProjectName("");
//     setNewSubTasks([]);
//   };

//   const closeTaskModal = () => {
//     setShowAddTaskForm(false);
//     setShowUpdateModal(false);
//     setEditingTaskId(null);
//     setAddTaskError(null);
//     setEditTaskError(null);
//     setUserSearchTerm("");
//     setNewProgress(0);
//     setNewProjectName("");
//     setNewSubTasks([]);
//     setEditProgress(0);
//     setEditProjectName("");
//     setEditSubTasks([]);
//   };

//   const handleAddTask = async (event: React.FormEvent) => {
//     event.preventDefault();
//     setAddTaskError(null);
//     setAddingTask(true);
//     try {
//       const formData = new FormData();
//       formData.append("companyName", newCompanyName);
//       formData.append("title", newTitle);
//       formData.append("description", newDescription);
//       formData.append("priority", newPriority);
//       formData.append("dueDate", newDueDate);
//       formData.append("assignAll", String(newAssignAll));
//       formData.append("userIds", newUserIds.join(","));
//       formData.append("progress", String(newProgress));
//       formData.append("subTasks", JSON.stringify(newSubTasks));
//       if (newProjectName) formData.append("projectName", newProjectName);
//       if (newFiles) {
//         for (let i = 0; i < newFiles.length; i++) {
//           formData.append("files", newFiles[i]);
//         }
//       }

//       // Header removed to allow Axios to set correct multipart boundary
//       const response = await api.post<any>("/api/tasks", formData);
//       const task: Task = response.data.task || response.data;
//       setAssignedTasks((prev) => [task, ...prev]);
//       setTaskSubTasks((prev) => ({
//         ...prev,
//         [task.id]: convertToDetailed(task.subTasks || []),
//       }));
//       setShowAddTaskForm(false);
//       setNewCompanyName("");
//       setNewTitle("");
//       setNewDescription("");
//       setNewPriority("high");
//       setNewDueDate("");
//       setNewUserIds([]);
//       setNewAssignAll(false);
//       setNewFiles(null);
//       setNewProgress(0);
//       setNewProjectName("");
//       setNewSubTasks([]);
//     } catch (err: any) {
//       setAddTaskError(
//         err?.response?.data?.message || err.message || "Unable to add task.",
//       );
//     } finally {
//       setAddingTask(false);
//     }
//   };

//   const getPriorityStyle = (priority: string) => {
//     switch (priority.toLowerCase()) {
//       case "high":
//         return "bg-rose-100 text-rose-700 border-rose-200";
//       case "medium":
//         return "bg-amber-100 text-amber-700 border-amber-200";
//       case "low":
//         return "bg-emerald-100 text-emerald-700 border-emerald-200";
//       default:
//         return "bg-slate-100 text-slate-700 border-slate-200";
//     }
//   };

//   const getStatusStyle = (status: string) => {
//     switch (status.toLowerCase()) {
//       case "completed":
//         return "bg-emerald-50 text-emerald-700 border-emerald-100";
//       case "in_progress":
//         return "bg-indigo-50 text-indigo-700 border-indigo-100";
//       case "pending":
//         return "bg-amber-50 text-amber-700 border-amber-100";
//       default:
//         return "bg-slate-50 text-slate-700 border-slate-100";
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
//         className="overflow-hidden bg-white rounded-xl border border-slate-100"
//       >
//         <div
//           className="flex justify-between items-center py-2 pr-3"
//           style={{ paddingLeft: `${level * 20 + 12}px` }}
//         >
//           <div className="flex gap-2 items-center">
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
//                 console.log("Selected Subtask:", st);
//                 console.log("History:", st.history);
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

//   return (
//     <div className="pb-12 space-y-6">
//       {/* Search and Filter Bar */}
//       <div className="space-y-4">
//         <div className="flex flex-col gap-4 justify-between md:flex-row md:items-center">
//           <div className="relative flex-1 max-w-md group">
//             <div className="flex absolute inset-y-0 left-0 items-center pl-4 pointer-events-none">
//               <Search className="w-5 h-5 transition-colors text-slate-400 group-focus-within:text-indigo-500" />
//             </div>
//             <input
//               type="text"
//               placeholder="Search tasks by title, company..."
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//               className="block py-3 pr-4 pl-11 w-full text-sm bg-white rounded-2xl border shadow-sm transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
//             />
//           </div>
//           <button
//             onClick={openAddTaskModal}
//             className="flex gap-2 items-center px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-2xl shadow-lg transition-all hover:bg-indigo-700 shadow-indigo-200 active:scale-95"
//           >
//             <Plus className="w-5 h-5" />
//             Create Task
//           </button>
//         </div>
//         {/* Filters */}
//         <div className="flex flex-wrap gap-3">
//           {/* Company Name Filter */}
//           <select
//             value={filterCompanyName}
//             onChange={(e) => setFilterCompanyName(e.target.value)}
//             className="px-4 py-3 text-sm bg-white rounded-2xl border shadow-sm transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
//           >
//             <option value="">All Companies</option>
//             {COMPANY_NAMES.map((company) => (
//               <option key={company} value={company}>
//                 {company}
//               </option>
//             ))}
//           </select>
//           {/* Project Name Filter */}
//           <input
//             type="text"
//             placeholder="Filter by Project Name"
//             value={filterProjectName}
//             onChange={(e) => setFilterProjectName(e.target.value)}
//             className="px-4 py-3 text-sm bg-white rounded-2xl border shadow-sm transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
//           />
//           {/* Priority Filter */}
//           <select
//             value={filterPriority}
//             onChange={(e) => setFilterPriority(e.target.value)}
//             className="px-4 py-3 text-sm bg-white rounded-2xl border shadow-sm transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
//           >
//             <option value="">All Priorities</option>
//             <option value="high">High</option>
//             <option value="medium">Medium</option>
//             <option value="low">Low</option>
//           </select>
//           {/* Status Filter */}
//           <select
//             value={filterStatus}
//             onChange={(e) => setFilterStatus(e.target.value)}
//             className="px-4 py-3 text-sm bg-white rounded-2xl border shadow-sm transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
//           >
//             <option value="">All Statuses</option>
//             <option value="pending">Pending</option>
//             <option value="in_progress">In Progress</option>
//             <option value="completed">Completed</option>
//           </select>
//           {/* Employee Filter */}
//           <select
//             value={filterEmployee}
//             onChange={(e) => setFilterEmployee(e.target.value)}
//             className="px-4 py-3 text-sm bg-white rounded-2xl border shadow-sm transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
//           >
//             <option value="">All Employees</option>
//             {users.map((user) => (
//               <option key={user.id} value={user.id.toString()}>
//                 {user.fullName}
//               </option>
//             ))}
//           </select>
//         </div>
//       </div>

//       {/* Tasks Table/List */}
//       <div className="space-y-5">
//         {tasksLoading ? (
//           <div className="flex flex-col justify-center items-center py-20 bg-white rounded-[32px] border border-slate-200 shadow-sm">
//             <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
//             <p className="mt-4 font-medium text-slate-500">
//               Loading your assignments...
//             </p>
//           </div>
//         ) : tasksError ? (
//           <div className="flex gap-4 items-center p-6 m-8 font-medium text-rose-700 bg-rose-50 rounded-2xl border border-rose-100">
//             <AlertCircle className="w-6 h-6" />
//             {tasksError}
//           </div>
//         ) : filteredTasks.length === 0 ? (
//           <div className="flex flex-col justify-center items-center px-4 py-20 text-center bg-white rounded-[32px] border border-slate-200 shadow-sm">
//             <div className="flex justify-center items-center mb-6 w-20 h-20 rounded-full bg-slate-50">
//               <CheckCircle2 className="w-10 h-10 text-slate-300" />
//             </div>
//             <h3 className="mb-2 text-xl font-bold text-slate-900">
//               No tasks found
//             </h3>
//             <p className="mx-auto max-w-sm text-slate-500">
//               Either you're all caught up or no tasks match your current search.
//             </p>
//           </div>
//         ) : (
//           Object.entries(groupedTasks).map(([companyName, tasks]) => (
//             <div
//               key={companyName}
//               className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden"
//             >
//               <button
//                 onClick={() => toggleCompany(companyName)}
//                 className="flex justify-between items-center px-8 py-5 w-full text-left border-b transition-all bg-slate-50/50 hover:bg-slate-100 border-slate-100"
//               >
//                 <div className="flex gap-3 items-center">
//                   <Building2 className="w-5 h-5 text-slate-600" />
//                   <h3 className="text-base font-bold text-slate-900">
//                     {companyName}
//                   </h3>
//                   <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
//                     {tasks.length} Tasks
//                   </span>
//                 </div>
//                 <div
//                   className={`transition-transform duration-300 ${expandedCompanies.has(companyName) ? "rotate-180" : ""}`}
//                 >
//                   <ChevronDown className="w-5 h-5 text-slate-500" />
//                 </div>
//               </button>
//               {expandedCompanies.has(companyName) && (
//                 <div className="overflow-x-auto">
//                   <table className="w-full text-left border-collapse">
//                     <thead>
//                       <tr className="bg-white border-b border-slate-100">
//                         <th className="px-8 py-5 text-xs font-bold tracking-widest uppercase text-slate-500">
//                           Task
//                         </th>
//                         <th className="px-8 py-5 text-xs font-bold tracking-widest uppercase text-slate-500">
//                           Project Name
//                         </th>
//                         <th className="px-8 py-5 text-xs font-bold tracking-widest text-center uppercase text-slate-500">
//                           Priority
//                         </th>
//                         <th className="px-8 py-5 text-xs font-bold tracking-widest text-center uppercase text-slate-500">
//                           Progress & Status
//                         </th>
//                         <th className="px-8 py-5 text-xs font-bold tracking-widest text-right uppercase text-slate-500">
//                           Actions
//                         </th>
//                       </tr>
//                     </thead>
//                     <tbody className="divide-y divide-slate-100">
//                       {tasks.map((task) => (
//                         <tr
//                           key={task.id}
//                           className="transition-colors group hover:bg-slate-50/30"
//                         >
//                           <td className="px-8 py-6">
//                             <div className="max-w-[300px]">
//                               <button
//                                 onClick={() =>
//                                   setExpandedTaskId(
//                                     expandedTaskId === task.id ? null : task.id,
//                                   )
//                                 }
//                                 className="text-left"
//                               >
//                                 <p className="text-base font-bold transition-colors text-slate-900 group-hover:text-indigo-600">
//                                   {task.title}
//                                 </p>
//                                 <div className="flex gap-3 items-center mt-2">
//                                   <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 border border-slate-200">
//                                     <Calendar className="w-3 h-3" />
//                                     {formatDate(task.dueDate)}
//                                   </div>
//                                   <div className="flex -space-x-1">
//                                     {task.assignedUsers.slice(0, 3).map((u) => (
//                                       <div
//                                         key={u.id}
//                                         className="flex items-center justify-center w-7 h-7 text-[10px] font-bold text-indigo-700 bg-indigo-100 border-2 border-white rounded-full shadow-sm"
//                                         title={u.fullName}
//                                       >
//                                         {u.fullName.charAt(0)}
//                                       </div>
//                                     ))}
//                                     {task.assignedUsers.length > 3 && (
//                                       <div className="flex items-center justify-center w-7 h-7 text-[10px] font-bold border-2 border-white rounded-full shadow-sm bg-slate-100 text-slate-600">
//                                         +{task.assignedUsers.length - 3}
//                                       </div>
//                                     )}
//                                   </div>
//                                 </div>
//                               </button>
//                             </div>
//                           </td>
//                           <td className="px-8 py-6">
//                             <div className="text-sm font-medium text-slate-700">
//                               {task.projectName || "-"}
//                             </div>
//                           </td>
//                           <td className="px-8 py-6 text-center">
//                             <span
//                               className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border ${getPriorityStyle(task.priority)}`}
//                             >
//                               {task.priority}
//                             </span>
//                           </td>
//                           <td className="px-8 py-6">
//                             <div className="flex flex-col items-center gap-2 min-w-[150px]">
//                               <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
//                                 <div
//                                   className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
//                                   style={{ width: `${task.progress}%` }}
//                                 />
//                               </div>
//                               <div className="flex justify-between items-center w-full text-[10px] text-slate-500">
//                                 <span className="font-bold">
//                                   {task.progress}%
//                                 </span>
//                                 <div className="inline-block relative text-left">
//                                   <select
//                                     value={task.status}
//                                     onChange={(e) =>
//                                       handleStatusChange(
//                                         task.id,
//                                         e.target.value,
//                                       )
//                                     }
//                                     className={`appearance-none px-3 py-1 pr-6 rounded-full text-[10px] font-bold border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${getStatusStyle(task.status)} uppercase tracking-wider`}
//                                   >
//                                     <option value="pending">Pending</option>
//                                     <option value="in_progress">
//                                       In Progress
//                                     </option>
//                                     <option value="completed">Completed</option>
//                                   </select>
//                                   <ChevronDown className="absolute right-2 top-1/2 w-2.5 h-2.5 opacity-50 -translate-y-1/2 pointer-events-none" />
//                                 </div>
//                               </div>
//                             </div>
//                           </td>
//                           <td className="px-8 py-6 text-right">
//                             <button
//                               onClick={() => handleDeleteClick(task.id)}
//                               className="p-2 rounded-lg transition-all text-slate-400 hover:text-rose-600 hover:bg-rose-50"
//                               title="Delete"
//                             >
//                               <Trash2 className="w-4 h-4" />
//                             </button>
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               )}
//             </div>
//           ))
//         )}
//       </div>

//       {/* Task Creation Modal */}
//       {showAddTaskForm && (
//         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
//           <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
//             <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
//               <div>
//                 <h3 className="text-xl font-bold text-slate-900">
//                   Create Task
//                 </h3>
//                 <p className="text-xs text-slate-500 font-medium mt-0.5">
//                   Assign new task to team.
//                 </p>
//               </div>
//               <button
//                 onClick={closeTaskModal}
//                 className="p-2 rounded-xl shadow-sm transition-all hover:bg-white text-slate-400 hover:text-slate-900"
//               >
//                 <X className="w-5 h-5" />
//               </button>
//             </div>
//             <form
//               onSubmit={handleAddTask}
//               className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
//             >
//               {addTaskError && (
//                 <div className="flex gap-2 items-center p-3 text-xs font-medium text-rose-700 bg-rose-50 rounded-xl border border-rose-100">
//                   <AlertCircle className="w-4 h-4" />
//                   {addTaskError}
//                 </div>
//               )}
//               {/* Row 1: Company (Dropdown) and Project (Dropdown) */}
//               <div className="grid gap-4 md:grid-cols-2">
//                 <div className="space-y-1.5">
//                   <label className="ml-1 text-xs font-semibold text-slate-700">
//                     Company
//                   </label>
//                   <div className="relative">
//                     <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
//                     <select
//                       value={newCompanyName}
//                       onChange={(e) => setNewCompanyName(e.target.value)}
//                       required
//                       className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
//                     >
//                       <option value="" disabled>
//                         Select company
//                       </option>
//                       {COMPANY_NAMES.map((company, idx) => (
//                         <option key={idx} value={company}>
//                           {company}
//                         </option>
//                       ))}
//                     </select>
//                   </div>
//                 </div>
//                 <div className="space-y-1.5">
//                   <label className="ml-1 text-xs font-semibold text-slate-700">
//                     Project Name
//                   </label>
//                   <div className="relative">
//                     <input
//                       value={newProjectName}
//                       onChange={(e) => setNewProjectName(e.target.value)}
//                       list="project-list"
//                       required
//                       className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
//                       placeholder="Select existing or type new"
//                     />
//                     <datalist id="project-list">
//                       {uniqueProjectNames.map((project, idx) => (
//                         <option key={idx} value={project}>
//                           {project}
//                         </option>
//                       ))}
//                     </datalist>
//                   </div>
//                 </div>
//               </div>

//               {/* Row 2: Task Title, Priority, Due Date */}
//               <div className="grid gap-4 md:grid-cols-3">
//                 <div className="space-y-1.5">
//                   <label className="ml-1 text-xs font-semibold text-slate-700">
//                     Task Title
//                   </label>
//                   <input
//                     value={newTitle}
//                     onChange={(e) => setNewTitle(e.target.value)}
//                     required
//                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
//                     placeholder="Task title"
//                   />
//                 </div>
//                 <div className="space-y-1.5">
//                   <label className="ml-1 text-xs font-semibold text-slate-700">
//                     Priority
//                   </label>
//                   <select
//                     value={newPriority}
//                     onChange={(e) => setNewPriority(e.target.value)}
//                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
//                   >
//                     <option value="high">High</option>
//                     <option value="medium">Medium</option>
//                     <option value="low">Low</option>
//                   </select>
//                 </div>
//                 <div className="space-y-1.5">
//                   <label className="ml-1 text-xs font-semibold text-slate-700">
//                     Due Date
//                   </label>
//                   <div className="relative">
//                     <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
//                     <input
//                       type="date"
//                       value={newDueDate}
//                       onChange={(e) => setNewDueDate(e.target.value)}
//                       required
//                       className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
//                     />
//                   </div>
//                 </div>
//               </div>

//               {/* Row 3: Description (full width) */}
//               <div className="space-y-1.5">
//                 <label className="ml-1 text-xs font-semibold text-slate-700">
//                   Description
//                 </label>
//                 <textarea
//                   value={newDescription}
//                   onChange={(e) => setNewDescription(e.target.value)}
//                   rows={3}
//                   className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
//                   placeholder="Task description"
//                 />
//               </div>

//               {/* Row 4: Sub-Tasks (full width, no nested) */}
//               <div className="space-y-1.5">
//                 <div className="flex gap-2 justify-between items-center">
//                   <label className="ml-1 text-xs font-semibold text-slate-700">
//                     Sub-Tasks
//                   </label>
//                   <button
//                     type="button"
//                     onClick={() =>
//                       setNewSubTasks([
//                         ...newSubTasks,
//                         { id: Date.now().toString(), title: "", subTasks: [] },
//                       ])
//                     }
//                     className="flex gap-1 items-center px-3 py-1 text-xs font-bold text-white bg-indigo-600 rounded-lg transition-all hover:bg-indigo-700"
//                   >
//                     <Plus className="w-3.5 h-3.5" />
//                     Add Sub-Task
//                   </button>
//                 </div>
//                 <div className="min-h-[100px] p-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/50">
//                   {newSubTasks.length === 0 ? (
//                     <div className="flex flex-col justify-center items-center py-6 text-center text-slate-400">
//                       <p className="text-sm">No sub-tasks yet</p>
//                       <p className="mt-1 text-xs">
//                         Click "Add Sub-Task" to start
//                       </p>
//                     </div>
//                   ) : (
//                     newSubTasks.map((subTask, idx) => (
//                       <div
//                         key={subTask.id}
//                         className="flex gap-2 items-center p-3 bg-white rounded-xl border border-slate-200"
//                       >
//                         <input
//                           value={subTask.title}
//                           onChange={(e) => {
//                             const updated = [...newSubTasks];
//                             updated[idx] = {
//                               ...subTask,
//                               title: e.target.value,
//                             };
//                             setNewSubTasks(updated);
//                           }}
//                           className="flex-1 px-4 py-2 text-sm rounded-lg border transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
//                           placeholder="Sub-task title"
//                         />
//                         <button
//                           type="button"
//                           onClick={() => {
//                             const u = [...newSubTasks];
//                             u.splice(idx, 1);
//                             setNewSubTasks(u);
//                           }}
//                           className="p-2 rounded-lg transition-all text-slate-400 hover:text-rose-600 hover:bg-rose-50"
//                         >
//                           <Trash2 className="w-4 h-4" />
//                         </button>
//                       </div>
//                     ))
//                   )}
//                 </div>
//               </div>

//               {/* Row 5: Attachments (full width) */}
//               <div className="space-y-1.5">
//                 <label className="ml-1 text-xs font-semibold text-slate-700">
//                   Attachments
//                 </label>
//                 <div className="relative">
//                   <input
//                     type="file"
//                     multiple
//                     onChange={(e) => setNewFiles(e.target.files)}
//                     className="hidden"
//                     id="task-files"
//                   />
//                   <label
//                     htmlFor="task-files"
//                     className="flex gap-2 justify-center items-center px-4 py-3 w-full text-sm rounded-xl border-2 border-dashed transition-all cursor-pointer bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-500 hover:text-indigo-600 group"
//                   >
//                     <Paperclip className="w-4 h-4 transition-transform group-hover:rotate-12" />
//                     {newFiles?.length ? (
//                       <span className="font-bold">
//                         {newFiles.length} files selected
//                       </span>
//                     ) : (
//                       "Upload task resources"
//                     )}
//                   </label>
//                 </div>
//               </div>

//               {/* Row 6: Assigned To (full width) */}
//               <div className="space-y-1.5">
//                 <label className="ml-1 text-xs font-semibold text-slate-700">
//                   Assign To
//                 </label>
//                 <div className="space-y-2">
//                   <label className="flex gap-2 items-center text-xs font-medium cursor-pointer text-slate-600">
//                     <input
//                       type="checkbox"
//                       checked={newAssignAll}
//                       onChange={(e) => setNewAssignAll(e.target.checked)}
//                       className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
//                     />
//                     All
//                   </label>
//                   {!newAssignAll && (
//                     <div className="space-y-2">
//                       <div className="relative">
//                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
//                         <input
//                           type="text"
//                           placeholder="Search users..."
//                           value={userSearchTerm}
//                           onChange={(e) => setUserSearchTerm(e.target.value)}
//                           className="py-2 pr-4 pl-9 w-full text-sm rounded-xl border transition-all bg-slate-50 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
//                         />
//                       </div>
//                       <div className="overflow-y-auto max-h-[100px] p-2 space-y-1 bg-white rounded-xl border border-slate-200">
//                         {users
//                           .filter((u) =>
//                             u.fullName
//                               .toLowerCase()
//                               .includes(userSearchTerm.toLowerCase()),
//                           )
//                           .map((u) => {
//                             const isSelected = newUserIds.includes(u.id);
//                             return (
//                               <label
//                                 key={u.id}
//                                 className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all text-xs ${isSelected ? "text-indigo-700 bg-indigo-50" : "hover:bg-slate-50 text-slate-600"}`}
//                               >
//                                 <input
//                                   type="checkbox"
//                                   checked={isSelected}
//                                   onChange={(e) => {
//                                     if (e.target.checked)
//                                       setNewUserIds([...newUserIds, u.id]);
//                                     else
//                                       setNewUserIds(
//                                         newUserIds.filter((id) => id !== u.id),
//                                       );
//                                   }}
//                                   className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
//                                 />
//                                 {u.fullName}
//                               </label>
//                             );
//                           })}
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>

//               {/* Buttons */}
//               <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
//                 <button
//                   type="button"
//                   onClick={closeTaskModal}
//                   className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   type="submit"
//                   disabled={addingTask}
//                   className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
//                 >
//                   {addingTask ? (
//                     <Loader2 className="w-4 h-4 animate-spin" />
//                   ) : (
//                     <CheckCircle2 className="w-4 h-4" />
//                   )}
//                   Create
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* Task Details Popup */}
//       {expandedTaskId && (
//         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
//           <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] overflow-y-auto">
//             <div className="flex sticky top-0 justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
//               <p className="text-xs font-bold tracking-wider uppercase text-slate-500">
//                 {
//                   assignedTasks.find((t) => t.id === expandedTaskId)
//                     ?.companyName
//                 }
//               </p>
//               <button
//                 onClick={() => setExpandedTaskId(null)}
//                 className="p-2 rounded-xl transition-colors hover:bg-slate-200"
//               >
//                 <X className="w-5 h-5 text-slate-500" />
//               </button>
//             </div>
//             <div className="p-6 space-y-6">
//               {/* First Row: Project Name, Due Date, Progress */}
//               {(() => {
//                 const task = assignedTasks.find((t) => t.id === expandedTaskId);
//                 return (
//                   <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
//                     <div className="p-3 rounded-2xl border bg-slate-50 border-slate-100">
//                       <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
//                         Project Name
//                       </p>
//                       <p className="text-lg font-semibold text-slate-900">
//                         {task?.projectName || "N/A"}
//                       </p>
//                     </div>
//                     <div className="p-3 rounded-2xl border bg-slate-50 border-slate-100">
//                       <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
//                         Due Date
//                       </p>
//                       <p className="text-sm font-semibold text-slate-900">
//                         {new Date(task?.dueDate || "").toLocaleDateString(
//                           "en-US",
//                           { year: "numeric", month: "long", day: "numeric" },
//                         )}
//                       </p>
//                     </div>
//                     <div className="p-3 rounded-2xl border bg-slate-50 border-slate-100">
//                       <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
//                         Progress
//                       </p>
//                       <div className="flex flex-col gap-2 items-start">
//                         <div className="overflow-hidden w-full h-2 rounded-full bg-slate-200">
//                           <div
//                             className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600"
//                             style={{ width: `${task?.progress || 0}%` }}
//                           />
//                         </div>
//                         <span className="text-sm font-bold text-slate-700">
//                           {task?.progress}%
//                         </span>
//                       </div>
//                     </div>
//                   </div>
//                 );
//               })()}

//               {/* Second Row: Description + Assigned To */}
//               {(() => {
//                 const task = assignedTasks.find((t) => t.id === expandedTaskId);
//                 return (
//                   <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
//                     <div className="p-4 rounded-2xl border bg-slate-50 border-slate-100">
//                       <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
//                         Description
//                       </p>
//                       <p className="text-sm whitespace-pre-wrap text-slate-700">
//                         {task?.description || "No description provided."}
//                       </p>
//                     </div>
//                     <div className="p-4 rounded-2xl border bg-slate-50 border-slate-100">
//                       <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">
//                         Assigned To
//                       </p>
//                       <div className="flex flex-wrap gap-2">
//                         {task?.assignedUsers.map((u) => (
//                           <div
//                             key={u.id}
//                             className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm"
//                           >
//                             <div className="flex justify-center items-center w-6 h-6 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full">
//                               {u.fullName.charAt(0)}
//                             </div>
//                             <span className="text-xs font-semibold text-slate-700">
//                               {u.fullName}
//                             </span>
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   </div>
//                 );
//               })()}

//               {/* Third Section: Sub-Tasks */}
//               <div className="p-4 rounded-2xl border bg-slate-50 border-slate-100">
//                 <p className="mb-3 text-xs font-bold tracking-wider uppercase text-slate-500">
//                   Sub-Tasks
//                 </p>
//                 {/* Add input */}
//                 <div className="flex gap-2 mb-3">
//                   <input
//                     type="text"
//                     value={newSubTaskTitle[expandedTaskId] || ""}
//                     onChange={(e) =>
//                       setNewSubTaskTitle((prev) => ({
//                         ...prev,
//                         [expandedTaskId]: e.target.value,
//                       }))
//                     }
//                     onKeyDown={(e) => {
//                       if (e.key === "Enter") {
//                         e.preventDefault();
//                         addSubTaskToTask(expandedTaskId);
//                       }
//                     }}
//                     className="flex-1 px-4 py-2 text-sm bg-white rounded-xl border transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
//                     placeholder="Enter sub-task title"
//                   />
//                   <button
//                     type="button"
//                     onClick={() => addSubTaskToTask(expandedTaskId)}
//                     className="flex gap-1 items-center px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl transition-all hover:bg-indigo-700"
//                   >
//                     <Plus className="w-4 h-4" />
//                     Add
//                   </button>
//                 </div>
//                 {/* Sub-task list */}
//                 <div className="space-y-2">
//                   {(taskSubTasks[expandedTaskId] || []).length === 0 ? (
//                     <p className="py-4 text-sm text-center text-slate-400">
//                       No sub-tasks yet
//                     </p>
//                   ) : (
//                     (taskSubTasks[expandedTaskId] || []).map((st) =>
//                       renderSubTaskItem(st),
//                     )
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Activity Popup */}
//       {showActivityPopup && (
//         <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
//           <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
//             <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
//               <h3 className="text-xl font-bold text-slate-900">
//                 Activity History
//               </h3>
//               <button
//                 onClick={() => setShowActivityPopup(false)}
//                 className="p-2 rounded-xl transition-colors hover:bg-slate-200"
//               >
//                 <X className="w-5 h-5 text-slate-500" />
//               </button>
//             </div>
//             <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
//               <div className="flex gap-3 p-3 rounded-xl border bg-slate-50 border-slate-100">
//                 <div className="flex flex-shrink-0 justify-center items-center w-8 h-8 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full">
//                   Y
//                 </div>
//                 <div className="flex-1">
//                   <p className="text-xs font-semibold text-slate-900">
//                     You changed the task status to "In Progress"
//                   </p>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Sub-task Update Popup */}
//       {showSubTaskUpdatePopup && editingSubTask && expandedTaskId && (
//         <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
//           <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] overflow-y-auto">
//             <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
//               <h3 className="text-xl font-bold text-slate-900">
//                 Update Sub-Task
//               </h3>
//               <button
//                 onClick={() => setShowSubTaskUpdatePopup(false)}
//                 className="p-2 rounded-xl transition-colors hover:bg-slate-200"
//               >
//                 <X className="w-5 h-5 text-slate-500" />
//               </button>
//             </div>
//             <div className="p-6 space-y-4">
//               {/* First row: Task title (parent task's title) */}
//               <div className="space-y-1.5">
//                 <label className="ml-1 text-xs font-semibold text-slate-700">
//                   Task Title
//                 </label>
//                 <p className="text-lg font-semibold text-slate-900">
//                   {assignedTasks.find((t) => t.id === expandedTaskId)?.title ||
//                     "N/A"}
//                 </p>
//               </div>

//               {/* Second row: New sub-task update + Attachment */}
//               <div className="grid grid-cols-1 gap-4 md:grid-cols-10">
//                 {/* New sub-task update: ~70% width */}
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
//                 {/* Attachment: ~30% width */}
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
//                       className="flex flex-col gap-1 justify-center items-center px-4 py-3 w-full text-xs rounded-xl border-2 border-dashed transition-all cursor-pointer bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-500 hover:text-indigo-600 group"
//                     >
//                       <Paperclip className="w-4 h-4" />
//                       {subTaskUpdateFiles?.length
//                         ? `${subTaskUpdateFiles.length} file(s)`
//                         : "Select file(s)"}
//                     </label>
//                   </div>
//                 </div>
//               </div>

//               {/* Simplified progress bar */}
//               <div className="space-y-1.5">
//                 <div className="flex justify-between items-center">
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

//               {/* Last update section */}
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

//               {/* Buttons at bottom */}
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
//                   onClick={handleSubTaskUpdate} // Hooked up to the new function
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
//             <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
//               <h3 className="text-xl font-bold text-slate-900">
//                 Sub-Task Activity History
//               </h3>
//               <button
//                 onClick={() => setShowSubTaskActivityPopup(false)}
//                 className="p-2 rounded-xl transition-colors hover:bg-slate-200"
//               >
//                 <X className="w-5 h-5 text-slate-500" />
//               </button>
//             </div>
//             <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
//               <div className="flex gap-3 p-3 rounded-xl border bg-slate-50 border-slate-100">
//                 <div className="flex flex-shrink-0 justify-center items-center w-8 h-8 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full">
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

//       {/* Update Task Modal */}
//       {showUpdateModal && (
//         <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
//           <div className="w-full max-w-xl bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] overflow-y-auto">
//             <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
//               <div>
//                 <h3 className="text-xl font-bold text-slate-900">
//                   Update Task
//                 </h3>
//                 <p className="text-xs text-slate-500 font-medium mt-0.5">
//                   Modify task details
//                 </p>
//               </div>
//               <button
//                 onClick={() => setShowUpdateModal(false)}
//                 className="p-2 rounded-xl shadow-sm transition-all hover:bg-white text-slate-400 hover:text-slate-900"
//               >
//                 <X className="w-5 h-5" />
//               </button>
//             </div>
//             <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
//               {editTaskError && (
//                 <div className="flex gap-2 items-center p-3 text-xs font-medium text-rose-700 bg-rose-50 rounded-xl border border-rose-100">
//                   <AlertCircle className="w-4 h-4" />
//                   {editTaskError}
//                 </div>
//               )}
//               <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
//                 <div className="space-y-1.5">
//                   <label className="ml-1 text-xs font-semibold text-slate-700">
//                     Description
//                   </label>
//                   <textarea
//                     value={editDescription}
//                     onChange={(e) => setEditDescription(e.target.value)}
//                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px]"
//                     placeholder="Task description"
//                   />
//                 </div>
//                 <div className="space-y-4">
//                   <div className="space-y-1.5">
//                     <label className="ml-1 text-xs font-semibold text-slate-700">
//                       Due Date
//                     </label>
//                     <div className="relative">
//                       <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
//                       <input
//                         type="date"
//                         value={editDueDate}
//                         onChange={(e) => setEditDueDate(e.target.value)}
//                         required
//                         className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
//                       />
//                     </div>
//                   </div>
//                   <div className="space-y-1.5">
//                     <label className="ml-1 text-xs font-semibold text-slate-700">
//                       Progress: {editProgress}%
//                     </label>
//                     <input
//                       type="range"
//                       min="0"
//                       max="100"
//                       value={editProgress}
//                       onChange={(e) => setEditProgress(Number(e.target.value))}
//                       className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 accent-indigo-600"
//                     />
//                   </div>
//                 </div>
//               </div>
//               <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
//                 <div className="col-span-3 space-y-1.5">
//                   <div className="flex gap-2 justify-between items-center">
//                     <label className="ml-1 text-xs font-semibold text-slate-700">
//                       Sub-Tasks
//                     </label>
//                     <button
//                       type="button"
//                       onClick={() =>
//                         setEditSubTasks([
//                           ...editSubTasks,
//                           {
//                             id: Date.now().toString(),
//                             title: "",
//                             subTasks: [],
//                           },
//                         ])
//                       }
//                       className="flex gap-1 items-center px-3 py-1 text-xs font-bold text-white bg-indigo-600 rounded-lg transition-all hover:bg-indigo-700"
//                     >
//                       <Plus className="w-3.5 h-3.5" />
//                       Add Sub-Task
//                     </button>
//                   </div>
//                   <div className="space-y-3 max-h-[300px] overflow-y-auto">
//                     {editSubTasks.map((subTask, idx) => (
//                       <div
//                         key={subTask.id}
//                         className="p-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50"
//                       >
//                         <div className="flex gap-2 items-center">
//                           <input
//                             value={subTask.title}
//                             onChange={(e) => {
//                               const updated = [...editSubTasks];
//                               updated[idx] = {
//                                 ...subTask,
//                                 title: e.target.value,
//                               };
//                               setEditSubTasks(updated);
//                             }}
//                             className="flex-1 px-4 py-2 text-sm bg-white rounded-xl border transition-all border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
//                             placeholder="Sub-task title"
//                           />
//                           <button
//                             type="button"
//                             onClick={() => {
//                               const u = [...editSubTasks];
//                               u.splice(idx, 1);
//                               setEditSubTasks(u);
//                             }}
//                             className="p-2 rounded-xl transition-all text-slate-400 hover:text-rose-600 hover:bg-rose-50"
//                           >
//                             <Trash2 className="w-4 h-4" />
//                           </button>
//                         </div>
//                         <div className="pl-4 space-y-2">
//                           {(subTask.subTasks || []).map((child, cIdx) => (
//                             <div
//                               key={child.id}
//                               className="flex gap-2 items-center"
//                             >
//                               <div className="w-4 h-px bg-slate-300 shrink-0" />
//                               <input
//                                 value={child.title}
//                                 onChange={(e) => {
//                                   const updated = [...editSubTasks];
//                                   const children = [
//                                     ...(updated[idx].subTasks || []),
//                                   ];
//                                   children[cIdx] = {
//                                     ...child,
//                                     title: e.target.value,
//                                   };
//                                   updated[idx] = {
//                                     ...updated[idx],
//                                     subTasks: children,
//                                   };
//                                   setEditSubTasks(updated);
//                                 }}
//                                 className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
//                                 placeholder="Nested sub-task"
//                               />
//                               <button
//                                 type="button"
//                                 onClick={() => {
//                                   const updated = [...editSubTasks];
//                                   const children = [
//                                     ...(updated[idx].subTasks || []),
//                                   ];
//                                   children.splice(cIdx, 1);
//                                   updated[idx] = {
//                                     ...updated[idx],
//                                     subTasks: children,
//                                   };
//                                   setEditSubTasks(updated);
//                                 }}
//                                 className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl transition-all"
//                               >
//                                 <Trash2 className="w-3.5 h-3.5" />
//                               </button>
//                             </div>
//                           ))}
//                           <button
//                             type="button"
//                             onClick={() => {
//                               const updated = [...editSubTasks];
//                               updated[idx] = {
//                                 ...updated[idx],
//                                 subTasks: [
//                                   ...(updated[idx].subTasks || []),
//                                   {
//                                     id: Date.now().toString(),
//                                     title: "",
//                                     subTasks: [],
//                                   },
//                                 ],
//                               };
//                               setEditSubTasks(updated);
//                             }}
//                             className="flex gap-1 items-center ml-5 text-xs font-semibold text-indigo-500 transition-colors hover:text-indigo-700"
//                           >
//                             <Plus className="w-3 h-3" />
//                             Add nested sub-task
//                           </button>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//                 <div className="col-span-1 space-y-1.5">
//                   <label className="ml-1 text-xs font-semibold text-slate-700">
//                     Attachments
//                   </label>
//                   <div className="relative">
//                     <input
//                       type="file"
//                       multiple
//                       onChange={(e) => setEditFiles(e.target.files)}
//                       className="hidden"
//                       id="update-task-files"
//                     />
//                     <label
//                       htmlFor="update-task-files"
//                       className="flex flex-col gap-2 justify-center items-center px-4 py-6 w-full h-full text-sm rounded-xl border-2 border-dashed transition-all cursor-pointer bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-500 hover:text-indigo-600 group"
//                     >
//                       <Paperclip className="w-6 h-6 transition-transform group-hover:rotate-12 text-slate-400 group-hover:text-indigo-500" />
//                       {editFiles?.length ? (
//                         <span className="font-bold text-center">
//                           {editFiles.length} files selected
//                         </span>
//                       ) : (
//                         <span className="text-center">
//                           Upload additional files
//                         </span>
//                       )}
//                     </label>
//                   </div>
//                 </div>
//               </div>
//               <div className="p-4 space-y-3 rounded-2xl border bg-slate-50 border-slate-100">
//                 <label className="flex gap-2 items-center text-xs font-bold text-slate-900">
//                   <UsersIcon className="w-3.5 h-3.5 text-indigo-500" />
//                   Assign To
//                 </label>
//                 <div className="space-y-2">
//                   <div className="relative">
//                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
//                     <input
//                       type="text"
//                       placeholder="Search users..."
//                       value={userSearchTerm}
//                       onChange={(e) => setUserSearchTerm(e.target.value)}
//                       className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
//                     />
//                   </div>
//                   <div className="overflow-y-auto p-2 space-y-1 max-h-32 bg-white rounded-xl border shadow-inner border-slate-200">
//                     {users
//                       .filter((u) =>
//                         u.fullName
//                           .toLowerCase()
//                           .includes(userSearchTerm.toLowerCase()),
//                       )
//                       .map((u) => {
//                         const isSelected = editUserIds.includes(u.id);
//                         return (
//                           <label
//                             key={u.id}
//                             className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${isSelected ? "text-indigo-700 bg-indigo-50" : "hover:bg-slate-50 text-slate-600"}`}
//                           >
//                             <input
//                               type="checkbox"
//                               checked={isSelected}
//                               onChange={(e) => {
//                                 if (e.target.checked)
//                                   setEditUserIds([...editUserIds, u.id]);
//                                 else
//                                   setEditUserIds(
//                                     editUserIds.filter((id) => id !== u.id),
//                                   );
//                               }}
//                               className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
//                             />
//                             <div className="flex flex-col">
//                               <span className="text-xs font-bold">
//                                 {u.fullName}
//                               </span>
//                               <span className="text-[10px] opacity-60">
//                                 {u.email}
//                               </span>
//                             </div>
//                           </label>
//                         );
//                       })}
//                   </div>
//                 </div>
//               </div>
//               <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
//                 <button
//                   type="button"
//                   onClick={() => setShowUpdateModal(false)}
//                   className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   type="submit"
//                   disabled={editingTaskLoading}
//                   className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
//                 >
//                   {editingTaskLoading ? (
//                     <Loader2 className="w-4 h-4 animate-spin" />
//                   ) : (
//                     <CheckCircle2 className="w-4 h-4" />
//                   )}
//                   Update
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default AssignedTasks;
