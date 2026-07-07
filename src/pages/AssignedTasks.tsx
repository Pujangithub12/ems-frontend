import React, { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Clock,
  AlertCircle,
  Users as UsersIcon,
  Paperclip,
  CheckCircle2,
  Check,
  X,
  Loader2,
  Calendar,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  ClipboardList,
  Folder,
  TrendingUp,
  FileText,
  ListChecks,
  PauseCircle,
  User as UserRoundIcon,
} from "lucide-react";
import ConfirmationModal from "../components/ConfirmationModal";

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
  project?: { id: number; name: string; status?: string };
  createdBy?: { id: number; fullName: string };
};

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

const getProjectStatusMeta = (status?: string) => {
  const v = (status || "").toLowerCase();
  if (v === "completed") return { label: "Completed Project", bg: "#DCFCE7", fg: "#15803D" };
  if (v === "on_hold") return { label: "On Hold", bg: "#FEE2E2", fg: "#B91C1C" };
  if (v === "pending") return { label: "Planned Project", bg: "#FEF3C7", fg: "#B45309" };
  return { label: "Active Project", bg: "#DBEAFE", fg: "#1E3A8A" };
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

const isOverdue = (dueDate: string, status: string) =>
  status !== "completed" &&
  new Date(dueDate).getTime() < new Date(new Date().toDateString()).getTime();


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
    } else if (v === "onhold" || v === "on_hold") {
      bg = "#FEE2E2";
      fg = "#B91C1C";
      label = "On Hold";
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
  const { user, workspace } = useAuth();
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
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
  const [filterProjectName, setFilterProjectName] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [projectFilterOpen, setProjectFilterOpen] = useState(false);
  const projectFilterRef = useRef<HTMLDivElement>(null);

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
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(
    new Set(),
  );
  const [editProgress, setEditProgress] = useState(0);

  const [newProjectId, setNewProjectId] = useState<number | null>(null);
  const [editProjectId, setEditProjectId] = useState<number | null>(null);

  type ModalSubTask = {
    id: string;
    title: string;
    subTasks?: ModalSubTask[];
  };
  const [newSubTasks, setNewSubTasks] = useState<ModalSubTask[]>([]);
  const [editSubTasks, setEditSubTasks] = useState<ModalSubTask[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("high");
  const [editDueDate, setEditDueDate] = useState("");
  const [editUserIds, setEditUserIds] = useState<number[]>([]);
  const [editFiles, setEditFiles] = useState<FileList | null>(null);
  const [editingTaskLoading, setEditingTaskLoading] = useState(false);
  const [editTaskError, setEditTaskError] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Delete Confirmation Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<number | null>(null);

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

  const filteredTasks = assignedTasks.filter((task) => {
    const matchesSearch = task.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesProject = filterProjectName
      ? (task.project?.name || task.projectName || "")
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
      matchesProject &&
      matchesPriority &&
      matchesStatus &&
      matchesEmployee
    );
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
      if (!map.has(key)) {
        map.set(key, { key, name, projectId, tasks: [] });
      }
      map.get(key)!.tasks.push(task);
    });
    const groups = Array.from(map.values()).sort((a, b) => {
      if (a.name === "No Project") return 1;
      if (b.name === "No Project") return -1;
      return a.name.localeCompare(b.name);
    });
    groups.forEach((g) => {
      g.tasks.sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );
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
  }, [workspace?.id]);

  const handleEditClick = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate.slice(0, 10));
    setEditUserIds(task.assignedUsers.map((u) => u.id));
    setEditProgress(task.progress);
    setEditProjectId(task.project?.id || null);
    setEditSubTasks(convertToModal(taskSubTasks[task.id] || []));
    setEditTaskError(null);
    setShowUpdateModal(true);
  };

  const handleDeleteClick = (taskId: number) => {
    setTaskToDelete(taskId);
    setShowDeleteModal(true);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await api.delete(`/api/tasks/${taskToDelete}`);
      setAssignedTasks((prev) => prev.filter((t) => t.id !== taskToDelete));
      setShowDeleteModal(false);
      setTaskToDelete(null);
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
      formData.append("title", editTitle);
      formData.append("description", editDescription);
      formData.append("priority", editPriority);
      formData.append("dueDate", editDueDate);
      formData.append("userIds", editUserIds.join(","));
      formData.append("progress", String(editProgress));
      formData.append("subTasks", JSON.stringify(editSubTasks));
      if (editProjectId) {
        const selectedProject = projects.find((p) => p.id === editProjectId);
        formData.append("projectId", String(editProjectId));
        if (selectedProject)
          formData.append("projectName", selectedProject.name);
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

      const [subTasksRes, commentsRes] = await Promise.all([
        api.get(`/api/tasks/${expandedTaskId}/subtasks`),
        api.get(
          `/api/tasks/${expandedTaskId}/subtasks/${editingSubTask.id}/comments`,
        ),
      ]);

      console.log("Refreshed subtasks from backend:", subTasksRes.data);

      const detailed = convertToDetailed(subTasksRes.data);
      console.log("Converted to detailed subtasks:", detailed);

      setTaskSubTasks((prev) => ({ ...prev, [expandedTaskId]: detailed }));
      setAssignedTasks((prev) =>
        prev.map((t) =>
          t.id === expandedTaskId
            ? { ...t, progress: computeAverageLeafProgress(detailed) }
            : t,
        ),
      );

      setSubTaskComments(commentsRes.data);

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

  const openAddTaskModal = (projectId?: number) => {
    setShowAddTaskForm(true);
    setShowUpdateModal(false);
    setEditingTaskId(null);
    setAddTaskError(null);
    setNewProgress(0);
    setNewProjectId(projectId ?? null);
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
    setNewProjectId(null);
    setNewSubTasks([]);
    setEditProgress(0);
    setEditProjectId(null);
    setEditSubTasks([]);
  };

  const handleAddTask = async (event: React.FormEvent) => {
    event.preventDefault();
    setAddTaskError(null);
    setAddingTask(true);
    try {
      const formData = new FormData();
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
      setNewTitle("");
      setNewDescription("");
      setNewPriority("high");
      setNewDueDate("");
      setNewUserIds([]);
      setNewAssignAll(false);
      setNewFiles(null);
      setNewProgress(0);
      setNewProjectId(null);
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
                setNewSubTaskUpdateTitle(""); // Clear for new update
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
          onClick={() => openAddTaskModal()}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Create Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div ref={projectFilterRef} className="relative">
          <Eyebrow className="mb-1.5">Project Name</Eyebrow>
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
                    !filterProjectName
                      ? "font-semibold text-blue-900 bg-blue-50"
                      : "text-slate-700"
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
            <option value="on_hold">On Hold</option>
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

      {/* Content: grouped by project */}
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
        <div className="space-y-5">
          <div className="flex justify-end gap-2">
            <button
              onClick={expandAllGroups}
              className="px-3 py-1.5 text-[12px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:border-slate-300 transition-colors"
            >
              Expand all
            </button>
            <button
              onClick={collapseAllGroups}
              className="px-3 py-1.5 text-[12px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:border-slate-300 transition-colors"
            >
              Collapse all
            </button>
          </div>

          <div className="space-y-3">
            {projectGroups.map((group) => {
              const isCollapsed = collapsedProjects.has(group.key);
              const doneCount = group.tasks.filter(
                (t) => t.status === "completed",
              ).length;
              const pct = group.tasks.length
                ? Math.round((doneCount / group.tasks.length) * 100)
                : 0;

              return (
                <div
                  key={group.key}
                  className="overflow-hidden bg-white border rounded-lg border-slate-200"
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
                        {doneCount} of {group.tasks.length} done
                      </div>
                    </div>
                    <div className="items-center flex-1 hidden max-w-xs gap-2 sm:flex">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-900"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span
                        className="text-[11px] text-slate-400 w-9 text-right"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {pct}%
                      </span>
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
                      {group.tasks.map((task) => {
                        const overdue = isOverdue(task.dueDate, task.status);
                        const completed = task.status === "completed";
                        return (
                          <div
                            key={task.id}
                            className={`flex items-center gap-3 px-2.5 py-2.5 rounded-md hover:bg-slate-50 transition-colors ${
                              completed ? "opacity-60" : ""
                            }`}
                          >
                            <button
                              onClick={() =>
                                handleStatusChange(
                                  task.id,
                                  completed ? "pending" : "completed",
                                )
                              }
                              className={`w-[18px] h-[18px] rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                                completed
                                  ? "bg-slate-900 border-slate-900"
                                  : "border-slate-300 hover:border-slate-400"
                              }`}
                              title="Mark as completed"
                            >
                              {completed && (
                                <Check
                                  className="w-2.5 h-2.5 text-white"
                                  strokeWidth={3}
                                />
                              )}
                            </button>
                            <button
                              onClick={() =>
                                setExpandedTaskId(
                                  expandedTaskId === task.id ? null : task.id,
                                )
                              }
                              className="flex-1 min-w-0 text-left"
                            >
                              <p
                                className={`text-[13px] font-medium text-slate-900 truncate ${
                                  completed ? "line-through" : ""
                                }`}
                              >
                                {task.title}
                              </p>
                              <p
                                className={`flex items-center gap-1 text-[11px] mt-0.5 ${
                                  overdue ? "text-red-600" : "text-slate-500"
                                }`}
                              >
                                <Calendar className="w-3 h-3" /> Due{" "}
                                {formatDate(task.dueDate)}
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
                            <div className="items-center flex-shrink-0 hidden gap-1.5 sm:flex">
                              <div className="h-1 overflow-hidden rounded-full bg-slate-100 w-14">
                                <div
                                  className="h-full rounded-full bg-blue-900"
                                  style={{ width: `${task.progress}%` }}
                                />
                              </div>
                              <select
                                value={task.status}
                                onChange={(e) =>
                                  handleStatusChange(task.id, e.target.value)
                                }
                                className="text-[11px] text-slate-600 bg-transparent outline-none appearance-none cursor-pointer"
                                style={{
                                  fontFamily: "'JetBrains Mono', monospace",
                                }}
                              >
                                <option value="pending">Pending</option>
                                <option value="in_progress">In Progress</option>
                                <option value="on_hold">On Hold</option>
                                <option value="completed">Completed</option>
                              </select>
                            </div>
                            <div className="flex-shrink-0 -space-x-1 flex">
                              {task.assignedUsers.length === 0 ? (
                                <span className="text-[11px] text-slate-400">
                                  Unassigned
                                </span>
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
                            <div className="flex items-center flex-shrink-0 gap-1">
                              <button
                                onClick={() => handleEditClick(task)}
                                className="p-1.5 transition-colors rounded text-slate-400 hover:text-blue-900 hover:bg-blue-50"
                                title="Edit"
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
                          </div>
                        );
                      })}
                      <button
                        onClick={() =>
                          openAddTaskModal(group.projectId ?? undefined)
                        }
                        className="flex items-center w-full gap-1.5 px-2.5 py-2 text-[12px] text-slate-500 border border-dashed border-slate-200 rounded-md hover:text-slate-700 hover:border-slate-300 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add task to{" "}
                        {group.name}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              <div className="space-y-1.5">
                <Eyebrow className="mb-1.5">Project Name</Eyebrow>
                <select
                  value={newProjectId || ""}
                  onChange={(e) =>
                    setNewProjectId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
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
              <div className="space-y-1.5">
                <Eyebrow className="mb-1.5">Project Name</Eyebrow>
                <select
                  value={editProjectId || ""}
                  onChange={(e) =>
                    setEditProjectId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
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
      {expandedTaskId &&
        (() => {
          const t = assignedTasks.find((task) => task.id === expandedTaskId);
          if (!t) return null;
          const statusMeta = getStatusMeta(t.status);
          const dueMeta = getDueMeta(t.dueDate, t.status);
          const projectMeta = getProjectStatusMeta(t.project?.status);
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
                      onClick={() => setExpandedTaskId(null)}
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
                      <span
                        className="inline-flex items-center gap-1.5 mt-2 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: projectMeta.bg, color: projectMeta.fg }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: projectMeta.fg }}
                        />
                        {projectMeta.label}
                      </span>
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
                      <span
                        className="font-semibold text-[18px] tracking-tight"
                        style={{ color: statusMeta.fg }}
                      >
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
                          t.assignedUsers.map((u) => (
                            <div key={u.id} className="flex items-center gap-2">
                              <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 text-[11px] font-semibold text-white rounded-full bg-blue-900">
                                {u.fullName.charAt(0)}
                              </div>
                              <span className="text-[13px] font-medium text-slate-800">
                                {u.fullName}
                              </span>
                            </div>
                          ))
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

                  <div className="p-2.5 rounded-lg shadow-md shadow-slate-200/70">
                    <div className="flex items-center gap-2 mb-2">
                      <ListChecks className="flex-shrink-0 w-3.5 h-3.5 text-slate-400" />
                      <Eyebrow>Sub-Tasks</Eyebrow>
                    </div>
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
          );
        })()}

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
                  {editingSubTask.title}
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
              {/* Show original subtask title as read-only */}
              <div className="p-3 border rounded bg-slate-50 border-slate-200">
                <Eyebrow className="mb-1.5">Original Sub-Task</Eyebrow>
                <p className="text-[13px] text-slate-800 font-medium">
                  {editingSubTask.title}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-10">
                <div className="md:col-span-7">
                  <Eyebrow className="mb-1.5">Update Description</Eyebrow>
                  <textarea
                    value={newSubTaskUpdateTitle}
                    onChange={(e) => setNewSubTaskUpdateTitle(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors resize-none"
                    rows={3}
                    placeholder="Describe your update..."
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

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setTaskToDelete(null);
        }}
        onConfirm={confirmDeleteTask}
        message="Are you sure you want to delete this task?"
      />
    </div>
  );
};

export default AssignedTasks;
