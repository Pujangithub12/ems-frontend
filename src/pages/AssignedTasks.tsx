import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import {
  Plus,
  Search,
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
    } else if (v === "inprogress" || v === "in_progress") {
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

const AssignedTasks: React.FC = () => {
  const { user } = useAuth();
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
    subTasks?: ModalSubTask[];
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
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.companyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany = filterCompanyName
      ? task.companyName.toLowerCase() === filterCompanyName.toLowerCase()
      : true;
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

      await api.put(
        `/api/tasks/${expandedTaskId}/subtasks/${editingSubTask.id}`,
        {
          title: newSubTaskUpdateTitle,
          progress: subTaskProgress,
        },
      );

      console.log("Subtask updated! Refreshing...");

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
              className="p-1 transition-colors rounded text-slate-400 hover:text-blue-900 hover:bg-blue-50"
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
          <div className="border-t border-slate-200 bg-slate-50/50">
            {safeChildren.map((child) => renderSubTaskItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-2 pr-3 text-[13px] bg-white border border-slate-200 rounded pl-9 outline-none focus:border-blue-900 transition-colors"
          />
        </div>
        <button
          onClick={openAddTaskModal}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Create Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <Eyebrow className="mb-1.5">Company</Eyebrow>
          <select
            value={filterCompanyName}
            onChange={(e) => setFilterCompanyName(e.target.value)}
            className="px-3 py-2 text-[13px] font-medium bg-white border border-slate-200 rounded appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors"
          >
            <option value="">All Companies</option>
            {COMPANY_NAMES.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>
        </div>
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
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <Eyebrow className="mb-1.5">Employee</Eyebrow>
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="px-3 py-2 text-[13px] font-medium bg-white border border-slate-200 rounded appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors"
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

      {/* Content */}
      <div className="space-y-5">
        {tasksLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 bg-white border rounded-md border-slate-200">
            <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
            <div
              className="text-[11px] text-slate-400 tracking-[0.1em] uppercase"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Loading your assignments...
            </div>
          </div>
        ) : tasksError ? (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-md text-red-700 text-[13px]">
            <AlertCircle className="flex-shrink-0 w-4 h-4" />
            {tasksError}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white border rounded-md border-slate-200">
            <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
              <CheckCircle2 className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
              No tasks found
            </h3>
            <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
              Either you're all caught up or no tasks match your current search.
            </p>
          </div>
        ) : (
          Object.entries(groupedTasks).map(([companyName, tasks]) => (
            <div
              key={companyName}
              className="overflow-hidden bg-white border rounded-md border-slate-200"
            >
              <button
                onClick={() => toggleCompany(companyName)}
                className="flex items-center justify-between w-full px-5 py-3 bg-[#EEF1F5]/50 hover:bg-[#EEF1F5] transition-colors text-left border-b border-slate-200"
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
                    {tasks.length} Tasks
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
                        <th className="px-5 py-2.5 font-medium">
                          Project Name
                        </th>
                        <th className="px-5 py-2.5 font-medium text-center">
                          Priority
                        </th>
                        <th className="px-5 py-2.5 font-medium text-center">
                          Progress & Status
                        </th>
                        <th className="px-5 py-2.5 font-medium text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {tasks.map((task) => (
                        <tr
                          key={task.id}
                          className="transition-colors hover:bg-slate-50"
                        >
                          <td className="px-5 py-3">
                            <div className="max-w-[300px]">
                              <button
                                onClick={() =>
                                  setExpandedTaskId(
                                    expandedTaskId === task.id ? null : task.id,
                                  )
                                }
                                className="text-left"
                              >
                                <p className="text-[13px] font-medium text-slate-900 hover:text-blue-900 transition-colors">
                                  {task.title}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(task.dueDate)}
                                  </div>
                                  <div className="flex -space-x-1">
                                    {task.assignedUsers.slice(0, 3).map((u) => (
                                      <div
                                        key={u.id}
                                        className="flex items-center justify-center w-6 h-6 text-[9px] font-semibold text-white bg-blue-900 border-2 border-white rounded-full"
                                        title={u.fullName}
                                      >
                                        {u.fullName.charAt(0)}
                                      </div>
                                    ))}
                                    {task.assignedUsers.length > 3 && (
                                      <div className="flex items-center justify-center w-6 h-6 text-[9px] font-semibold border-2 border-white rounded-full bg-slate-100 text-slate-600">
                                        +{task.assignedUsers.length - 3}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-[13px] font-medium text-blue-900">
                              {task.projectName || "-"}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <StatusPill type="priority" value={task.priority} />
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-col items-center gap-1.5 min-w-[150px]">
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
                                <select
                                  value={task.status}
                                  onChange={(e) =>
                                    handleStatusChange(task.id, e.target.value)
                                  }
                                  className="appearance-none bg-transparent cursor-pointer outline-none"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="in_progress">
                                    In Progress
                                  </option>
                                  <option value="completed">Completed</option>
                                </select>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEditClick(task)}
                                className="p-1.5 transition-colors rounded text-slate-400 hover:text-blue-900 hover:bg-blue-50"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(task.id)}
                                className="p-1.5 transition-colors rounded text-slate-400 hover:text-red-700 hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-6">
          <div className="w-full max-w-lg bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>Create Task</Eyebrow>
                <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">
                  Assign new task to team
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
              className="flex-1 p-6 space-y-4 overflow-y-auto"
            >
              {addTaskError && (
                <div className="flex items-center gap-2 p-3 text-xs font-medium border text-rose-700 bg-rose-50 rounded border-rose-100">
                  <AlertCircle className="w-4 h-4" />
                  {addTaskError}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Eyebrow className="mb-1.5">Company</Eyebrow>
                  <select
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  >
                    <option value="" disabled>
                      Select company
                    </option>
                    {COMPANY_NAMES.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Eyebrow className="mb-1.5">Project Name</Eyebrow>
                  <select
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
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
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Eyebrow className="mb-1.5">Task Title</Eyebrow>
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                    placeholder="Task title"
                  />
                </div>
                <div className="space-y-1.5">
                  <Eyebrow className="mb-1.5">Priority</Eyebrow>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] font-medium bg-white border border-slate-200 rounded appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Eyebrow className="mb-1.5">Description</Eyebrow>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors resize-none"
                  placeholder="Task description"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Eyebrow className="mb-1.5">Due Date</Eyebrow>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Eyebrow className="mb-1.5">Progress</Eyebrow>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newProgress}
                    onChange={(e) => setNewProgress(Number(e.target.value))}
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Eyebrow className="mb-1.5">Sub-Tasks</Eyebrow>
                  <button
                    type="button"
                    onClick={() =>
                      setNewSubTasks([
                        ...newSubTasks,
                        { id: Date.now().toString(), title: "", subTasks: [] },
                      ])
                    }
                    className="flex items-center gap-1 px-3 py-1 text-[11px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Sub-Task
                  </button>
                </div>
                <div className="min-h-[60px] p-3 space-y-2 rounded border border-slate-200 bg-slate-50/50">
                  {newSubTasks.length === 0 ? (
                    <p className="py-2 text-xs text-center text-slate-400">
                      No sub-tasks yet
                    </p>
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
                          className="flex-1 px-3 py-1.5 text-[13px] bg-white border rounded border-slate-200 focus:outline-none focus:border-blue-900 transition-colors"
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
              <div className="space-y-1.5">
                <Eyebrow className="mb-1.5">Attachments</Eyebrow>
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
                    className="flex flex-col items-center justify-center w-full gap-1 px-4 py-3 text-[11px] transition-all border-2 border-dashed cursor-pointer rounded bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-900 hover:text-blue-900 group"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    {newFiles?.length ? (
                      <span className="font-medium">
                        {newFiles.length} file(s) selected
                      </span>
                    ) : (
                      "Upload task resources"
                    )}
                  </label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Eyebrow className="mb-1.5">Assign To</Eyebrow>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[12px] font-medium cursor-pointer text-slate-600">
                    <input
                      type="checkbox"
                      checked={newAssignAll}
                      onChange={(e) => setNewAssignAll(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-900 rounded border-slate-300 focus:ring-blue-900"
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
                          className="w-full py-1.5 pr-3 text-[13px] transition-all border pl-9 rounded bg-slate-50 border-slate-200 focus:outline-none focus:border-blue-900"
                        />
                      </div>
                      <div className="overflow-y-auto max-h-[100px] p-2 space-y-1 bg-white rounded border border-slate-200">
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
                                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-all text-[12px] ${isSelected ? "text-blue-900 bg-blue-50" : "hover:bg-slate-50 text-slate-600"}`}
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
                                  className="w-3.5 h-3.5 text-blue-900 rounded border-slate-300 focus:ring-blue-900"
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
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeTaskModal}
                  className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingTask}
                  className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {addingTask ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Edit Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-6">
          <div className="w-full max-w-lg bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>Edit Task</Eyebrow>
                <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">
                  Update task details
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
              onSubmit={handleEditSubmit}
              className="flex-1 p-6 space-y-4 overflow-y-auto"
            >
              {editTaskError && (
                <div className="flex items-center gap-2 p-3 text-xs font-medium border text-rose-700 bg-rose-50 rounded border-rose-100">
                  <AlertCircle className="w-4 h-4" />
                  {editTaskError}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Eyebrow className="mb-1.5">Company</Eyebrow>
                  <select
                    value={editCompanyName}
                    onChange={(e) => setEditCompanyName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  >
                    <option value="" disabled>
                      Select company
                    </option>
                    {COMPANY_NAMES.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Eyebrow className="mb-1.5">Project Name</Eyebrow>
                  <select
                    value={editProjectName}
                    onChange={(e) => setEditProjectName(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
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
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Eyebrow className="mb-1.5">Task Title</Eyebrow>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                    placeholder="Task title"
                  />
                </div>
                <div className="space-y-1.5">
                  <Eyebrow className="mb-1.5">Priority</Eyebrow>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] font-medium bg-white border border-slate-200 rounded appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Eyebrow className="mb-1.5">Description</Eyebrow>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors resize-none"
                  placeholder="Task description"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Eyebrow className="mb-1.5">Due Date</Eyebrow>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Eyebrow className="mb-1.5">Progress</Eyebrow>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editProgress}
                    onChange={(e) => setEditProgress(Number(e.target.value))}
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Eyebrow className="mb-1.5">Sub-Tasks</Eyebrow>
                  <button
                    type="button"
                    onClick={() =>
                      setEditSubTasks([
                        ...editSubTasks,
                        { id: Date.now().toString(), title: "", subTasks: [] },
                      ])
                    }
                    className="flex items-center gap-1 px-3 py-1 text-[11px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Sub-Task
                  </button>
                </div>
                <div className="min-h-[60px] p-3 space-y-2 rounded border border-slate-200 bg-slate-50/50">
                  {editSubTasks.length === 0 ? (
                    <p className="py-2 text-xs text-center text-slate-400">
                      No sub-tasks yet
                    </p>
                  ) : (
                    editSubTasks.map((subTask, idx) => (
                      <div
                        key={subTask.id}
                        className="flex items-center gap-2 p-2 bg-white border rounded border-slate-200"
                      >
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
                          className="flex-1 px-3 py-1.5 text-[13px] bg-white border rounded border-slate-200 focus:outline-none focus:border-blue-900 transition-colors"
                          placeholder="Sub-task title"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const u = [...editSubTasks];
                            u.splice(idx, 1);
                            setEditSubTasks(u);
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
              <div className="space-y-1.5">
                <Eyebrow className="mb-1.5">Attachments</Eyebrow>
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setEditFiles(e.target.files)}
                    className="hidden"
                    id="edit-task-files"
                  />
                  <label
                    htmlFor="edit-task-files"
                    className="flex flex-col items-center justify-center w-full gap-1 px-4 py-3 text-[11px] transition-all border-2 border-dashed cursor-pointer rounded bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-900 hover:text-blue-900 group"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    {editFiles?.length ? (
                      <span className="font-medium">
                        {editFiles.length} file(s) selected
                      </span>
                    ) : (
                      "Upload task resources"
                    )}
                  </label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Eyebrow className="mb-1.5">Assign To</Eyebrow>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="w-full py-1.5 pr-3 text-[13px] transition-all border pl-9 rounded bg-slate-50 border-slate-200 focus:outline-none focus:border-blue-900"
                      />
                    </div>
                    <div className="overflow-y-auto max-h-[100px] p-2 space-y-1 bg-white rounded border border-slate-200">
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
                              className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-all text-[12px] ${isSelected ? "text-blue-900 bg-blue-50" : "hover:bg-slate-50 text-slate-600"}`}
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
                                className="w-3.5 h-3.5 text-blue-900 rounded border-slate-300 focus:ring-blue-900"
                              />
                              {u.fullName}
                            </label>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeTaskModal}
                  className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editingTaskLoading}
                  className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {editingTaskLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details Popup */}
      {expandedTaskId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-6">
          <div className="w-full max-w-2xl bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>
                  {
                    assignedTasks.find((t) => t.id === expandedTaskId)
                      ?.companyName
                  }
                </Eyebrow>
                <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">
                  {assignedTasks.find((t) => t.id === expandedTaskId)?.title}
                </h3>
              </div>
              <button
                onClick={() => setExpandedTaskId(null)}
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
                    {assignedTasks.find((t) => t.id === expandedTaskId)
                      ?.projectName || "N/A"}
                  </p>
                </div>
                <div className="p-3 border rounded border-slate-200">
                  <Eyebrow>Due Date</Eyebrow>
                  <p className="font-medium text-[13px] text-slate-900 mt-1">
                    {new Date(
                      assignedTasks.find((t) => t.id === expandedTaskId)
                        ?.dueDate || "",
                    ).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="p-3 border rounded border-slate-200">
                  <Eyebrow>Progress</Eyebrow>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="font-semibold text-[20px] tracking-tight text-blue-900">
                      {
                        assignedTasks.find((t) => t.id === expandedTaskId)
                          ?.progress
                      }
                      %
                    </span>
                  </div>
                  <div className="w-full h-1 mt-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-blue-900 rounded-full"
                      style={{
                        width: `${assignedTasks.find((t) => t.id === expandedTaskId)?.progress || 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="p-4 border rounded border-slate-200">
                  <Eyebrow className="mb-2">Description</Eyebrow>
                  <p className="text-slate-600 text-[13px] leading-relaxed whitespace-pre-wrap">
                    {assignedTasks.find((t) => t.id === expandedTaskId)
                      ?.description || "No description provided."}
                  </p>
                </div>
                <div className="p-4 border rounded border-slate-200">
                  <Eyebrow className="mb-2">Assigned To</Eyebrow>
                  <div className="flex flex-wrap gap-2">
                    {assignedTasks
                      .find((t) => t.id === expandedTaskId)
                      ?.assignedUsers.map((u) => (
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
                    className="flex-1 px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                    placeholder="Enter sub-task title"
                  />
                  <button
                    type="button"
                    onClick={() => addSubTaskToTask(expandedTaskId)}
                    className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {(taskSubTasks[expandedTaskId] || []).length === 0 ? (
                    <p className="py-4 text-center text-slate-400 text-[12px]">
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 p-6">
          <div className="w-full max-w-lg bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>Activity History</Eyebrow>
              </div>
              <button
                onClick={() => setShowActivityPopup(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="flex gap-3 p-3 border rounded bg-slate-50 border-slate-200">
                <div className="flex items-center justify-center flex-shrink-0 w-6 h-6 text-[10px] font-semibold text-white bg-blue-900 rounded-full">
                  Y
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-slate-900">
                    You changed the task status to "In Progress"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Task Update Popup */}
      {showSubTaskUpdatePopup && editingSubTask && expandedTaskId && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/45 p-6">
          <div className="w-full max-w-lg bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>Update Sub-Task</Eyebrow>
                <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">
                  {assignedTasks.find((t) => t.id === expandedTaskId)?.title ||
                    "N/A"}
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
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
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

      {/* Sub-Task Activity Popup */}
      {showSubTaskActivityPopup && editingSubTask && expandedTaskId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 p-6">
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
                        className="p-3 border rounded bg-slate-50 border-slate-200"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center justify-center w-6 h-6 text-[9px] font-semibold text-white bg-blue-900 rounded-full">
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
                <div className="space-y-2">
                  {subTaskComments.map((comment: any) => (
                    <div
                      key={comment.id}
                      className="p-3 border rounded bg-slate-50 border-slate-200"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex items-center justify-center w-6 h-6 text-[9px] font-semibold text-white bg-blue-900 rounded-full">
                          {comment.author.fullName.charAt(0)}
                        </div>
                        <span className="text-[12px] font-medium text-slate-700">
                          {comment.author.fullName}
                        </span>
                        <span
                          className="text-[10px] text-slate-400"
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mb-2 text-[13px] text-slate-800">
                        {comment.commentText}
                      </p>
                      {comment.feedback && (
                        <div className="p-2 bg-white border border-blue-200 rounded">
                          <p
                            className="text-[10px] font-bold text-blue-900 uppercase tracking-wider mb-1"
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
                              className="flex-1 px-3 py-1.5 text-[12px] bg-white rounded border border-slate-200 focus:outline-none focus:border-blue-900 transition-colors"
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
                                      "Failed to add feedback.",
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
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignedTasks;
