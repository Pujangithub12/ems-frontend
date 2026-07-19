import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthProvider";
import { getErrorMessage } from "../lib/errors";
import {
  useTasks as useTasksQuery,
  useCreateTask,
  useUpdateTask,
  useUpdateTaskStatus,
  useDeleteTask,
} from "../hooks/useTasks";
import { useUsers } from "../hooks/useUsers";
import { useProjects } from "../hooks/useProjects";
import { useCreateSubtask, useUpdateSubtask, useSubtasksFetch } from "../hooks/useSubtasks";
import {
  useCommentsFetch,
  useAddComment,
  useUpdateCommentFeedback,
} from "../hooks/useComments";
import {
  Plus,
  Search,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Edit2,
  Paperclip,
  Trash2,
  Calendar,
  FolderKanban,
  Folder,
  TrendingUp,
  FileText,
  ListChecks,
  PauseCircle,
  User as UserRoundIcon,
  UserPlus,
  MessageSquare,
} from "lucide-react";
import ConfirmationModal from "../components/ConfirmationModal";

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

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

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

const MyTasks: React.FC = () => {
  const { user } = useAuth();
  const tasksQuery = useTasksQuery();
  const usersQuery = useUsers();
  const projectsQuery = useProjects();
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const updateTaskStatusMutation = useUpdateTaskStatus();
  const deleteTaskMutation = useDeleteTask();
  const createSubtaskMutation = useCreateSubtask();
  const updateSubtaskMutation = useUpdateSubtask();
  const subtasksFetchMutation = useSubtasksFetch();
  const commentsFetchMutation = useCommentsFetch();
  const addCommentMutation = useAddComment();
  const updateCommentFeedbackMutation = useUpdateCommentFeedback();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Add Task Form States
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
  const [newProgress, setNewProgress] = useState(0);
  const [newProjectId, setNewProjectId] = useState<number | null>(null);

  type ModalSubTask = { id: string; title: string; subTasks?: ModalSubTask[] };
  const [newSubTasks, setNewSubTasks] = useState<ModalSubTask[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState("");

  // Popup States
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<number | null>(null);

  const [showAddMemberPopover, setShowAddMemberPopover] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [pendingMemberIds, setPendingMemberIds] = useState<number[]>([]);
  const [savingMembers, setSavingMembers] = useState(false);
  const addMemberRef = useRef<HTMLDivElement>(null);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);

  // Filter state variables
  const [filterProjectName, setFilterProjectName] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
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
      if (
        addMemberRef.current &&
        !addMemberRef.current.contains(e.target as Node)
      ) {
        setShowAddMemberPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(
    new Set(),
  );

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

  type SubTaskFeedbackItem = {
    subTaskId: number;
    subTaskTitle: string;
    commentId: number;
    commentText: string;
    feedback: string | null;
    authorName?: string;
    date: string;
  };
  const [showTaskFeedbackPopup, setShowTaskFeedbackPopup] = useState(false);
  const [feedbackPopupTaskId, setFeedbackPopupTaskId] = useState<number | null>(null);
  const [taskFeedbackList, setTaskFeedbackList] = useState<
    SubTaskFeedbackItem[]
  >([]);
  const [loadingTaskFeedback, setLoadingTaskFeedback] = useState(false);
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

  // Re-derives local state (tasks/users/projects + the subtask detail map)
  // whenever the underlying query data changes — mutations below patch
  // `tasks` locally for instant feedback, and also invalidate these queries
  // so a background refetch keeps everything eventually consistent.
  useEffect(() => {
    setTasksLoading(tasksQuery.isLoading || usersQuery.isLoading || projectsQuery.isLoading);
    if (tasksQuery.isError) {
      setTasksError(getErrorMessage(tasksQuery.error, "Unable to load my tasks."));
      return;
    }
    setTasksError(null);
    if (!tasksQuery.data) return;

    const taskList: Task[] = tasksQuery.data as unknown as Task[];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksQuery.data, tasksQuery.isLoading, tasksQuery.isError, usersQuery.isLoading, projectsQuery.isLoading]);

  useEffect(() => {
    if (usersQuery.data) {
      setUsers([...usersQuery.data].sort((a, b) => a.fullName.localeCompare(b.fullName)));
    }
  }, [usersQuery.data]);

  useEffect(() => {
    if (projectsQuery.data) {
      setProjects(projectsQuery.data as unknown as Project[]);
    }
  }, [projectsQuery.data]);

  const openPopup = (task: Task) => setSelectedTask(task);
  const closePopup = () => {
    setSelectedTask(null);
    setShowAllMembers(false);
  };

  const openAddTaskModal = (projectId?: number) => {
    if (user) setNewUserIds([Number(user.id)]);
    setShowAddTaskForm(true);
    setSelectedTask(null);
    setAddTaskError(null);
    setNewProgress(0);
    setNewProjectId(projectId ?? null);
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

      const task: Task = (await createTaskMutation.mutateAsync(formData)) as unknown as Task;
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

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    try {
      await updateTaskStatusMutation.mutateAsync({ id: taskId, status: newStatus });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      );
    } catch (err) {
      setActionError(getErrorMessage(err, "Status update failed"));
    }
  };

  const handleAddMembers = async (taskId: number) => {
    if (pendingMemberIds.length === 0 || !selectedTask) return;
    setSavingMembers(true);
    try {
      const nextIds = Array.from(
        new Set([
          ...selectedTask.assignedUsers.map((u) => u.id),
          ...pendingMemberIds,
        ]),
      );
      const formData = new FormData();
      formData.append("userIds", nextIds.join(","));
      const updated: Task = (await updateTaskMutation.mutateAsync({
        id: taskId,
        payload: formData,
      })) as unknown as Task;
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setSelectedTask(updated);
      setPendingMemberIds([]);
      setMemberSearchTerm("");
      setShowAddMemberPopover(false);
    } catch (err) {
      setActionError(getErrorMessage(err, "Unable to add members"));
    } finally {
      setSavingMembers(false);
    }
  };

  const handleRemoveMember = async (taskId: number, userId: number) => {
    if (!selectedTask) return;
    setRemovingMemberId(userId);
    try {
      const nextIds = selectedTask.assignedUsers
        .filter((u) => u.id !== userId)
        .map((u) => u.id);
      const formData = new FormData();
      formData.append("userIds", nextIds.join(","));
      const updated: Task = (await updateTaskMutation.mutateAsync({
        id: taskId,
        payload: formData,
      })) as unknown as Task;
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setSelectedTask(updated);
    } catch (err) {
      setActionError(getErrorMessage(err, "Unable to remove member"));
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleDeleteClick = (taskId: number) => {
    setTaskToDelete(taskId);
    setShowDeleteModal(true);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await deleteTaskMutation.mutateAsync(taskToDelete);
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete));
      if (selectedTask?.id === taskToDelete) setSelectedTask(null);
      setShowDeleteModal(false);
      setTaskToDelete(null);
    } catch (err) {
      setActionError(getErrorMessage(err, "Delete failed"));
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
      const data = await createSubtaskMutation.mutateAsync({
        taskId,
        title,
        parentSubTaskId: parentId ? Number(parentId) : null,
      });
      if (data.subTasks) {
        const detailed = convertToDetailed(data.subTasks);
        setTaskSubTasks((prev) => ({ ...prev, [taskId]: detailed }));
        const avg = computeAverageLeafProgress(detailed);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, progress: avg } : t)),
        );
        setSelectedTask((prev) =>
          prev && prev.id === taskId ? { ...prev, progress: avg } : prev,
        );
      }
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to save sub-task."));
    }
  };

  const flattenSubTasks = (list: DetailedSubTask[]): DetailedSubTask[] =>
    list.flatMap((st) => [st, ...flattenSubTasks(st.subTasks || [])]);

  const handleShowTaskFeedback = async (taskId: number) => {
    setShowTaskFeedbackPopup(true);
    setFeedbackPopupTaskId(taskId);
    setLoadingTaskFeedback(true);
    try {
      const flatSubTasks = flattenSubTasks(taskSubTasks[taskId] || []);
      const results = await Promise.all(
        flatSubTasks.map(async (st) => {
          try {
            const data = await commentsFetchMutation.mutateAsync({
              taskId,
              subTaskId: Number(st.id),
            });
            return (data || []).map((c: any) => ({
              subTaskId: Number(st.id),
              subTaskTitle: st.title,
              commentId: c.id,
              commentText: c.commentText,
              feedback: c.feedback || null,
              authorName: c.author?.fullName,
              date: c.createdAt,
            }));
          } catch {
            return [];
          }
        }),
      );
      setTaskFeedbackList(
        results.flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      );
    } catch {
      setTaskFeedbackList([]);
    } finally {
      setLoadingTaskFeedback(false);
    }
  };

  const handleSendTaskFeedback = async (item: SubTaskFeedbackItem) => {
    const value = feedbackTexts[item.commentId];
    if (!value?.trim() || feedbackPopupTaskId == null) return;
    try {
      await updateCommentFeedbackMutation.mutateAsync({
        taskId: feedbackPopupTaskId,
        subTaskId: item.subTaskId,
        commentId: item.commentId,
        feedback: value,
      });
      setFeedbackTexts((prev) => ({ ...prev, [item.commentId]: "" }));
      await handleShowTaskFeedback(feedbackPopupTaskId);
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to add feedback."));
    }
  };

  const handleSubTaskUpdate = async () => {
    if (!editingSubTask || !selectedTask) return;
    try {
      const taskId = selectedTask.id;
      await updateSubtaskMutation.mutateAsync({
        taskId,
        subTaskId: Number(editingSubTask.id),
        title: newSubTaskUpdateTitle,
        progress: subTaskProgress,
      });
      const data = await subtasksFetchMutation.mutateAsync(taskId);
      const detailed = convertToDetailed(data);
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
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to update sub-task."));
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
        className="overflow-hidden border rounded-lg border-slate-100"
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
                  const data = await commentsFetchMutation.mutateAsync({
                    taskId: Number(selectedTask?.id),
                    subTaskId: Number(st.id),
                  });
                  setSubTaskComments(data);
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
    return matchesSearch && matchesProject && matchesPriority && matchesStatus;
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
  const allGroupsCollapsed =
    projectGroups.length > 0 &&
    projectGroups.every((g) => collapsedProjects.has(g.key));
  const toggleAllGroups = () =>
    allGroupsCollapsed ? expandAllGroups() : collapseAllGroups();

  return (
    <>
    <div className="p-6 space-y-6">
      {/* Search + Filters + Expand/Collapse toggle + Add Task */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[140px] max-w-[220px]">
          <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search my tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-2 pr-3 text-[13px] bg-white border border-slate-200 rounded-lg pl-9 outline-none focus:border-blue-900 transition-colors"
          />
        </div>
        <div ref={projectFilterRef} className="relative">
          <button
            type="button"
            onClick={() => setProjectFilterOpen((o) => !o)}
            className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-900 transition-colors min-w-[170px]"
          >
            <span className="truncate">{filterProjectName || "All Projects"}</span>
            <ChevronDown className="flex-shrink-0 w-3.5 h-3.5 text-slate-400" />
          </button>
          {projectFilterOpen && (
            <div className="absolute z-20 mt-1 w-full min-w-[190px] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
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
        <div className="relative">
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="pl-3 pr-8 py-2 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors"
          >
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="pl-3 pr-8 py-2 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="inprogress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <button
          onClick={toggleAllGroups}
          className="flex items-center gap-1.5 px-3 py-2 ml-auto text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
        >
          {allGroupsCollapsed ? (
            <ChevronsUpDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronsDownUp className="w-3.5 h-3.5" />
          )}
          {allGroupsCollapsed ? "Expand all" : "Collapse all"}
        </button>
        <button
          onClick={() => openAddTaskModal()}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add My Own Task
        </button>
      </div>

      {actionError && (
        <div className="p-4 mb-4 bg-red-50 border border-red-100 rounded flex items-center justify-between gap-3 text-red-700 text-[13px]">
          <span className="flex items-center gap-3">
            <AlertCircle className="flex-shrink-0 w-4 h-4" />
            {actionError}
          </span>
          <button onClick={() => setActionError(null)} className="text-red-700 hover:text-red-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Content: grouped by project */}
      {tasksLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 bg-white border rounded-md border-slate-200">
          <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
          <div
            className="text-[11px] text-slate-400 tracking-[0.1em] uppercase"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Loading tasks
          </div>
        </div>
      ) : tasksError ? (
        <div className="p-4 bg-red-50 border border-red-100 rounded flex items-center gap-3 text-red-700 text-[13px]">
          <AlertCircle className="flex-shrink-0 w-4 h-4" />
          <span>{tasksError}</span>
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
            You don't have any tasks matching the current filters.
          </p>
        </div>
      ) : (
        <>
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
                        const statusColor =
                          task.status === "completed"
                            ? "text-emerald-600"
                            : task.status === "in_progress"
                              ? "text-amber-600"
                              : task.status === "on_hold"
                                ? "text-orange-600"
                                : "text-slate-500";
                        return (
                          <div
                            key={task.id}
                            className={`group flex items-center gap-3 px-2.5 py-2.5 rounded-md hover:bg-slate-50/60 transition-colors ${
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
                              className={`w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                completed
                                  ? "bg-emerald-600 border-emerald-600"
                                  : "border-slate-300 hover:border-blue-900"
                              }`}
                              title="Mark as completed"
                            >
                              {completed && (
                                <Check
                                  className="w-3 h-3 text-white"
                                  strokeWidth={3}
                                />
                              )}
                            </button>
                            <button
                              onClick={() => openPopup(task)}
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
                                <Clock className="w-3 h-3" /> Due{" "}
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
                            <div className="flex-shrink-0 hidden sm:block">
                              <select
                                value={task.status}
                                onChange={(e) =>
                                  handleStatusChange(task.id, e.target.value)
                                }
                                className={`text-[12px] font-medium bg-transparent outline-none appearance-none cursor-pointer text-right ${statusColor}`}
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
                            <div className="items-center flex-shrink-0 hidden gap-1 sm:flex">
                              <button
                                onClick={() => handleShowTaskFeedback(task.id)}
                                className="p-1.5 transition-colors rounded text-slate-400 hover:text-emerald-700 hover:bg-emerald-50"
                                title="Show Feedback"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(task.id)}
                                className="p-1.5 transition-colors rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                                title="Delete task"
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
                        className="flex items-center w-full gap-1.5 px-2.5 py-2.5 mt-1 text-[12px] text-slate-500 border-t border-slate-100 hover:text-blue-900 hover:bg-slate-50/60 transition-colors"
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
        </>
      )}

    </div>

      {/* Task Details Popup */}
      {selectedTask &&
        (() => {
          const t = selectedTask;
          const statusMeta = getStatusMeta(t.status);
          return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/45">
              <div className="w-full max-w-lg bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b border-slate-200">
                  <div className="min-w-0">
                    <Eyebrow>Task Details</Eyebrow>
                    <h3 className="font-semibold text-[16px] text-slate-900 truncate mt-0.5">
                      {t.title}
                    </h3>
                    <p className="flex items-center gap-1.5 text-[12px] text-slate-500 mt-1 truncate">
                      <span className="font-medium text-blue-900">
                        {t.project?.name || t.projectName || "No Project"}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Calendar className="w-3 h-3" />
                        Due {formatLongDate(t.dueDate)}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 gap-1.5">
                    <div className="flex items-center gap-2.5">
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
                        onClick={closePopup}
                        className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 w-28">
                      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${t.progress}%`, background: statusMeta.fg }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-slate-500 flex-shrink-0">
                        {t.progress}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 p-6 space-y-3 overflow-y-auto">
                  <div className="p-3 rounded border border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="flex-shrink-0 w-3.5 h-3.5 text-slate-400" />
                      <Eyebrow>Description</Eyebrow>
                    </div>
                    <p className="text-slate-600 text-[13px] leading-relaxed whitespace-pre-wrap">
                      {t.description || "No description provided."}
                    </p>
                  </div>

                  <div className="p-3 rounded border border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <ListChecks className="flex-shrink-0 w-3.5 h-3.5 text-slate-400" />
                      <Eyebrow>Sub-Tasks</Eyebrow>
                    </div>
                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        value={newSubTaskTitle[t.id] || ""}
                        onChange={(e) =>
                          setNewSubTaskTitle((prev) => ({
                            ...prev,
                            [t.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addSubTaskToTask(t.id);
                          }
                        }}
                        className="flex-1 px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                        placeholder="Enter sub-task title"
                      />
                      <button
                        type="button"
                        onClick={() => addSubTaskToTask(t.id)}
                        className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(taskSubTasks[t.id] || []).length === 0 ? (
                        <p className="py-4 text-center text-slate-400 text-[12px]">
                          No sub-tasks yet
                        </p>
                      ) : (
                        (taskSubTasks[t.id] || []).map((st) => renderSubTaskItem(st))
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded border border-slate-200 bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <UserRoundIcon className="flex-shrink-0 w-3.5 h-3.5 text-slate-400" />
                        <Eyebrow>Assigned To</Eyebrow>
                      </div>
                        <div ref={addMemberRef} className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setPendingMemberIds([]);
                              setMemberSearchTerm("");
                              setShowAddMemberPopover((o) => !o);
                            }}
                            className="flex items-center gap-1 px-1.5 py-1 text-[11px] font-medium text-blue-900 rounded hover:bg-blue-50 transition-colors"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Add
                          </button>
                          {showAddMemberPopover && (
                            <div className="absolute right-0 z-30 mt-1 bg-white border rounded-md shadow-lg w-60 border-slate-200">
                              <div className="p-2 border-b border-slate-100">
                                <div className="relative">
                                  <Search className="absolute w-3 h-3 -translate-y-1/2 left-2.5 top-1/2 text-slate-400" />
                                  <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search users..."
                                    value={memberSearchTerm}
                                    onChange={(e) =>
                                      setMemberSearchTerm(e.target.value)
                                    }
                                    className="w-full py-1.5 pr-2 text-[12px] border rounded outline-none pl-7 border-slate-200 focus:border-blue-900"
                                  />
                                </div>
                              </div>
                              <div className="overflow-y-auto max-h-40">
                                {users
                                  .filter(
                                    (u) =>
                                      !t.assignedUsers.some((a) => a.id === u.id) &&
                                      u.fullName
                                        .toLowerCase()
                                        .includes(memberSearchTerm.toLowerCase()),
                                  )
                                  .map((u) => (
                                    <label
                                      key={u.id}
                                      className="flex items-center gap-2 px-3 py-1.5 text-[12px] cursor-pointer text-slate-700 hover:bg-slate-50"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={pendingMemberIds.includes(u.id)}
                                        onChange={(e) => {
                                          if (e.target.checked)
                                            setPendingMemberIds((prev) => [
                                              ...prev,
                                              u.id,
                                            ]);
                                          else
                                            setPendingMemberIds((prev) =>
                                              prev.filter((id) => id !== u.id),
                                            );
                                        }}
                                        className="w-3.5 h-3.5 text-blue-900 border-slate-300 rounded focus:ring-blue-900"
                                      />
                                      {u.fullName}
                                    </label>
                                  ))}
                                {users.filter(
                                  (u) =>
                                    !t.assignedUsers.some((a) => a.id === u.id) &&
                                    u.fullName
                                      .toLowerCase()
                                      .includes(memberSearchTerm.toLowerCase()),
                                ).length === 0 && (
                                  <p className="px-3 py-2 text-[11px] italic text-slate-400">
                                    No users to add.
                                  </p>
                                )}
                              </div>
                              <div className="p-2 border-t border-slate-100">
                                <button
                                  type="button"
                                  disabled={
                                    pendingMemberIds.length === 0 || savingMembers
                                  }
                                  onClick={() => handleAddMembers(t.id)}
                                  className="flex items-center justify-center w-full gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white transition-colors rounded bg-blue-900 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {savingMembers && (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  )}
                                  Add{" "}
                                  {pendingMemberIds.length > 0
                                    ? `(${pendingMemberIds.length})`
                                    : ""}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {t.assignedUsers.length === 0 ? (
                          <p className="text-slate-400 text-[12px]">Unassigned</p>
                        ) : (
                          <>
                            {t.assignedUsers.slice(0, 2).map((u) => (
                              <div
                                key={u.id}
                                className="flex items-center gap-2 px-1.5 py-1 -mx-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                              >
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
                </div>
              </div>
          );
        })()}

      {/* View All Assigned Members Popup */}
      {showAllMembers && selectedTask && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 p-6">
          <div className="flex flex-col w-full max-w-sm overflow-hidden bg-white border rounded-md shadow-lg border-slate-200 max-h-[80vh]">
            <div className="flex items-center justify-between flex-shrink-0 px-5 py-3 border-b border-slate-200">
              <Eyebrow>Assigned Members ({selectedTask.assignedUsers.length})</Eyebrow>
              <button
                onClick={() => setShowAllMembers(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-3 space-y-1 overflow-y-auto">
              {selectedTask.assignedUsers.length === 0 ? (
                <p className="py-4 text-center text-slate-400 text-[12px]">
                  No members assigned.
                </p>
              ) : (
                selectedTask.assignedUsers.map((u) => (
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
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(selectedTask.id, u.id)}
                      disabled={removingMemberId === u.id}
                      className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Remove member"
                    >
                      {removingMemberId === u.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Sub-Task Feedback Popup */}
      {showTaskFeedbackPopup && (() => {
        const feedbackTask = tasks.find((task) => task.id === feedbackPopupTaskId);
        // Only the person who assigned this task may give feedback — matches
        // the same check enforced on the backend.
        const canGiveFeedback = feedbackTask?.createdBy?.id === user?.id;
        return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 p-6">
          <div className="flex flex-col w-full max-w-lg overflow-hidden bg-white border rounded-md shadow-lg border-slate-200 max-h-[80vh]">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>Sub-Task Updates</Eyebrow>
                <h3 className="font-semibold text-[15px] text-slate-900 mt-0.5">
                  {feedbackTask?.title || "Updates on this task's sub-tasks"}
                </h3>
              </div>
              <button
                onClick={() => setShowTaskFeedbackPopup(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-5 space-y-3 overflow-y-auto">
              {loadingTaskFeedback ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
                </div>
              ) : taskFeedbackList.length === 0 ? (
                <p className="py-8 text-center text-slate-400 text-[12px]">
                  No updates have been posted on this task's sub-tasks yet.
                </p>
              ) : (
                taskFeedbackList.map((fb) => (
                  <div
                    key={fb.commentId}
                    className="p-3 border rounded-lg border-slate-200 bg-slate-50/50"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-semibold text-blue-900 truncate">
                        {fb.subTaskTitle}
                      </span>
                      <span
                        className="flex-shrink-0 text-[10px] text-slate-400"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {new Date(fb.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[12px] text-slate-500 italic">
                      "{fb.commentText}"
                      {fb.authorName && (
                        <span className="not-italic text-slate-400"> — {fb.authorName}</span>
                      )}
                    </p>
                    {fb.feedback ? (
                      <div className="flex items-start gap-2 p-2 mt-2 border rounded bg-white border-slate-200">
                        <MessageSquare className="flex-shrink-0 w-3.5 h-3.5 mt-0.5 text-emerald-700" />
                        <p className="text-[12px] text-slate-800">{fb.feedback}</p>
                      </div>
                    ) : (
                      canGiveFeedback && (
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            placeholder="Add feedback..."
                            value={feedbackTexts[fb.commentId] || ""}
                            onChange={(e) =>
                              setFeedbackTexts({
                                ...feedbackTexts,
                                [fb.commentId]: e.target.value,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSendTaskFeedback(fb);
                            }}
                            className="flex-1 px-2.5 py-1.5 text-[12px] bg-white rounded border border-slate-200 outline-none focus:border-blue-900 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => handleSendTaskFeedback(fb)}
                            className="px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
                          >
                            Send
                          </button>
                        </div>
                      )
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Sub-task Update Popup */}
      {showSubTaskUpdatePopup && editingSubTask && selectedTask && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-6 bg-slate-900/45">
          <div className="w-full max-w-lg bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-full bg-blue-50">
                  <Edit2 className="w-4 h-4 text-blue-900" />
                </div>
                <div className="min-w-0">
                  <Eyebrow>Update Sub-Task</Eyebrow>
                  <h3 className="font-semibold text-[15px] text-slate-900 truncate mt-0.5">
                    {editingSubTask.title}
                  </h3>
                </div>
              </div>
              <div className="flex items-center flex-shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubTaskUpdatePopup(false);
                    setShowSubTaskActivityPopup(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-blue-900 rounded hover:bg-blue-50 transition-colors"
                >
                  <Clock className="w-3.5 h-3.5" /> Activity
                </button>
                <button
                  onClick={() => setShowSubTaskUpdatePopup(false)}
                  className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-5 space-y-3 overflow-y-auto">
              <div className="p-2.5 rounded-lg shadow-md shadow-slate-200/70">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center flex-shrink-0 w-7 h-7 rounded-lg bg-emerald-50">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                    </div>
                    <Eyebrow>Progress</Eyebrow>
                  </div>
                  <span
                    className="font-semibold text-[16px] text-slate-900"
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

              <div className="p-2.5 rounded-lg shadow-md shadow-slate-200/70">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="flex-shrink-0 w-3.5 h-3.5 text-slate-400" />
                  <Eyebrow>Update Description</Eyebrow>
                </div>
                <textarea
                  value={newSubTaskUpdateTitle}
                  onChange={(e) => setNewSubTaskUpdateTitle(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors resize-none"
                  rows={3}
                  placeholder="Describe your update..."
                />
                <input
                  type="file"
                  multiple
                  onChange={(e) => setSubTaskUpdateFiles(e.target.files)}
                  className="hidden"
                  id="subtask-attachment"
                />
                <label
                  htmlFor="subtask-attachment"
                  className="inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1.5 text-[11px] font-medium transition-colors border rounded cursor-pointer border-slate-200 text-slate-600 hover:border-blue-900 hover:text-blue-900"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  {subTaskUpdateFiles?.length
                    ? `${subTaskUpdateFiles.length} file(s) attached`
                    : "Attach files"}
                </label>
              </div>

              <div className="p-2.5 rounded-lg shadow-md shadow-slate-200/70">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="flex-shrink-0 w-3.5 h-3.5 text-slate-400" />
                  <Eyebrow>Previous Updates</Eyebrow>
                </div>
                <div className="space-y-2 max-h-[120px] overflow-y-auto">
                  {editingSubTask.history &&
                  editingSubTask.history.length > 0 ? (
                    editingSubTask.history.slice(0, 3).map((hist) => (
                      <div
                        key={hist.id}
                        className="flex items-start justify-between gap-2 pb-2 text-[12px] border-b border-slate-100 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">
                            {hist.title}
                          </p>
                          <p
                            className="text-[10px] text-slate-400 mt-0.5"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {new Date(hist.date).toLocaleString()}
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-[11px] font-semibold text-slate-600">
                          {hist.progress}%
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="py-2 text-[12px] italic text-center text-slate-400">
                      No previous updates available
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-shrink-0 justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowSubTaskUpdatePopup(false);
                  setEditingSubTask(null);
                }}
                className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubTaskUpdate}
                className="px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
              >
                Save Update
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
                        selectedTask?.createdBy?.id === user?.id && (
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
                                  await updateCommentFeedbackMutation.mutateAsync({
                                    taskId: Number(selectedTask?.id),
                                    subTaskId: Number(editingSubTask?.id),
                                    commentId: comment.id,
                                    feedback: feedbackTexts[comment.id],
                                  });
                                  const data = await commentsFetchMutation.mutateAsync({
                                    taskId: Number(selectedTask?.id),
                                    subTaskId: Number(editingSubTask?.id),
                                  });
                                  setSubTaskComments(data);
                                  setFeedbackTexts({
                                    ...feedbackTexts,
                                    [comment.id]: "",
                                  });
                                } catch (err) {
                                  setActionError(getErrorMessage(err, "Failed to send feedback!"));
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
                      await addCommentMutation.mutateAsync({
                        taskId: selectedTask.id,
                        subTaskId: Number(editingSubTask.id),
                        commentText: newCommentText,
                      });
                      const data = await commentsFetchMutation.mutateAsync({
                        taskId: selectedTask.id,
                        subTaskId: Number(editingSubTask.id),
                      });
                      setSubTaskComments(data);
                      setNewCommentText("");
                    } catch (err) {
                      setActionError(getErrorMessage(err, "Failed to add comment"));
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
                    await addCommentMutation.mutateAsync({
                      taskId: selectedTask.id,
                      subTaskId: Number(editingSubTask.id),
                      commentText: newCommentText,
                    });
                    const data = await commentsFetchMutation.mutateAsync({
                      taskId: selectedTask.id,
                      subTaskId: Number(editingSubTask.id),
                    });
                    setSubTaskComments(data);
                    setNewCommentText("");
                  } catch (err) {
                    setActionError(getErrorMessage(err, "Failed to add comment"));
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
              <div>
                <Eyebrow className="mb-1.5">Project Name</Eyebrow>
                <div className="relative">
                  <select
                    value={newProjectId || ""}
                    onChange={(e) =>
                      setNewProjectId(
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    className="w-full px-4 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors appearance-none"
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
    </>
  );
};

export default MyTasks;
