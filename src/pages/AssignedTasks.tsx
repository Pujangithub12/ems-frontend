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
  const [editProgress, setEditProgress] = useState(0);

  const [newProjectName, setNewProjectName] = useState("");
  const [editProjectName, setEditProjectName] = useState("");

    type ModalSubTask = {
    id: string;
    title: string;
    subTasks: ModalSubTask[]; // Changed to self-reference for infinite nesting
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

  const filteredTasks = assignedTasks.filter(
    (task) =>
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.companyName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const groupedTasks = filteredTasks.reduce(
    (acc, task) => {
      const key = task.companyName || "Unassigned";
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    },
    {} as Record<string, Task[]>,
  );

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

  // Helper: convert backend subtask (with children) to DetailedSubTask
  const convertToDetailed = (subTasks: any[]): DetailedSubTask[] =>
    subTasks.map((st) => ({
      id: st.id,
      title: st.title,
      subTasks: convertToDetailed(st.children || st.subTasks || []),
    }));

  // Helper: convert DetailedSubTask to ModalSubTask for the update modal
  const convertToModal = (subTasks: DetailedSubTask[]): ModalSubTask[] =>
    subTasks.map((st) => ({
      id: st.id.toString(),
      title: st.title,
      subTasks: convertToModal(st.subTasks || []),
    }));

  useEffect(() => {
    const loadData = async () => {
      setTasksLoading(true);
      setTasksError(null);
      try {
        const [tasksRes, usersRes] = await Promise.all([
          api.get<any>("/api/tasks"),
          api.get<User[]>("/api/users"),
        ]);

        if (Array.isArray(tasksRes.data)) {
          setAssignedTasks(tasksRes.data);
          const subTasksMap: Record<number, DetailedSubTask[]> = {};
          tasksRes.data.forEach((task: Task) => {
            subTasksMap[task.id] = convertToDetailed(task.subTasks || []);
          });
          setTaskSubTasks(subTasksMap);
        } else if (tasksRes.data?.task) {
          setAssignedTasks([tasksRes.data.task]);
        } else if (tasksRes.data?.tasks) {
          setAssignedTasks(tasksRes.data.tasks);
        } else {
          setAssignedTasks([]);
        }

        const sortedUsers = [...usersRes.data].sort((a, b) =>
          a.fullName.localeCompare(b.fullName),
        );
        setUsers(sortedUsers);
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
    // Seed from taskSubTasks (full nested structure with real DB IDs)
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
      formData.append("companyName", originalTask.companyName);
      formData.append("title", originalTask.title);
      formData.append("description", editDescription);
      formData.append("priority", originalTask.priority);
      formData.append("dueDate", editDueDate);
      formData.append("userIds", editUserIds.join(","));
      formData.append("progress", String(editProgress));
      formData.append("subTasks", JSON.stringify(editSubTasks));
      if (originalTask.projectName) {
        formData.append("projectName", originalTask.projectName);
      }
      if (editFiles) {
        for (let i = 0; i < editFiles.length; i++) {
          formData.append("files", editFiles[i]);
        }
      }

      const res = await api.put<any>(`/api/tasks/${editingTaskId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
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

  // Save updated subtask list to backend and sync state from server response
  const saveSubTasksToBackend = async (
    taskId: number,
    updatedSubTasks: DetailedSubTask[],
  ) => {
    try {
      const formData = new FormData();
      formData.append("subTasks", JSON.stringify(updatedSubTasks));
      const res = await api.put<any>(`/api/tasks/${taskId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const updatedTask: Task = res.data.task || res.data;
      // Sync from server so IDs are real DB IDs (not Date.now() strings)
      const detailed = convertToDetailed(updatedTask.subTasks || []);
      setTaskSubTasks((prev) => ({ ...prev, [taskId]: detailed }));
      setAssignedTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
      );
    } catch (err) {
      console.error("Error saving sub-task", err);
    }
  };

  const addSubTaskToTask = async (taskId: number, parentId?: string, overrideTitle?: string) => {
    const title = overrideTitle ?? (newSubTaskTitle[taskId] || "");
    if (!title.trim()) return;

    const newSubTask: DetailedSubTask = {
      id: Date.now().toString(),
      title,
      subTasks: [],
    };

    // Build updated list synchronously before any state update
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

    // Clear input immediately
    if (!overrideTitle) {
      setNewSubTaskTitle((prev) => ({ ...prev, [taskId]: "" }));
    }

    await saveSubTasksToBackend(taskId, updatedSubTasks);
  };

    const removeSubTaskFromTask = async (
    taskId: number,
    subTaskId: string | number,
  ) => {
    const removeNested = (subTasks: DetailedSubTask[]): DetailedSubTask[] =>
      subTasks
        // FIX: Use .toString() to prevent Number vs String mismatch
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
      const response = await api.post<any>("/api/tasks", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
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
      case "high": return "bg-rose-100 text-rose-700 border-rose-200";
      case "medium": return "bg-amber-100 text-amber-700 border-amber-200";
      case "low": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed": return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "in_progress": return "bg-indigo-50 text-indigo-700 border-indigo-100";
      case "pending": return "bg-amber-50 text-amber-700 border-amber-100";
      default: return "bg-slate-50 text-slate-700 border-slate-100";
    }
  };

  return (
    <div className="pb-12 space-y-6">
      {/* Search and Action Bar */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-md group">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <Search className="w-5 h-5 transition-colors text-slate-400 group-focus-within:text-indigo-500" />
          </div>
          <input
            type="text"
            placeholder="Search tasks by title, company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full py-3 pr-4 text-sm transition-all bg-white border shadow-sm pl-11 rounded-2xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all bg-white border shadow-sm rounded-2xl border-slate-200 text-slate-600 hover:bg-slate-50">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={openAddTaskModal}
            className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white transition-all bg-indigo-600 shadow-lg rounded-2xl hover:bg-indigo-700 shadow-indigo-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Create Task
          </button>
        </div>
      </div>

      {/* Tasks Table/List */}
      <div className="space-y-5">
        {tasksLoading ? (
          <div className="flex flex-col justify-center items-center py-20 bg-white rounded-[32px] border border-slate-200 shadow-sm">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="mt-4 font-medium text-slate-500">Loading your assignments...</p>
          </div>
        ) : tasksError ? (
          <div className="flex items-center gap-4 p-6 m-8 font-medium border text-rose-700 bg-rose-50 rounded-2xl border-rose-100">
            <AlertCircle className="w-6 h-6" />
            {tasksError}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col justify-center items-center px-4 py-20 text-center bg-white rounded-[32px] border border-slate-200 shadow-sm">
            <div className="flex items-center justify-center w-20 h-20 mb-6 rounded-full bg-slate-50">
              <CheckCircle2 className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-900">No tasks found</h3>
            <p className="max-w-sm mx-auto text-slate-500">
              Either you're all caught up or no tasks match your current search.
            </p>
          </div>
        ) : (
          Object.entries(groupedTasks).map(([companyName, tasks]) => (
            <div key={companyName} className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleCompany(companyName)}
                className="flex items-center justify-between w-full px-8 py-5 text-left transition-all border-b bg-slate-50/50 hover:bg-slate-100 border-slate-100"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-slate-600" />
                  <h3 className="text-base font-bold text-slate-900">{companyName}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    {tasks.length} Tasks
                  </span>
                </div>
                <div className={`transition-transform duration-300 ${expandedCompanies.has(companyName) ? "rotate-180" : ""}`}>
                  <ChevronDown className="w-5 h-5 text-slate-500" />
                </div>
              </button>
              {expandedCompanies.has(companyName) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="px-8 py-5 text-xs font-bold tracking-widest uppercase text-slate-500">Task</th>
                        <th className="px-8 py-5 text-xs font-bold tracking-widest uppercase text-slate-500">Assigned To</th>
                        <th className="px-8 py-5 text-xs font-bold tracking-widest text-center uppercase text-slate-500">Priority</th>
                        <th className="px-8 py-5 text-xs font-bold tracking-widest text-center uppercase text-slate-500">Progress & Status</th>
                        <th className="px-8 py-5 text-xs font-bold tracking-widest text-right uppercase text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tasks.map((task) => (
                        <tr key={task.id} className="transition-colors group hover:bg-slate-50/30">
                          <td className="px-8 py-6">
                            <div className="max-w-[250px]">
                              <button
                                onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                                className="text-left"
                              >
                                <p className="text-base font-bold transition-colors text-slate-900 group-hover:text-indigo-600">{task.title}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 border border-slate-200">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(task.dueDate)}
                                  </div>
                                  <span className={`text-[9px] font-bold uppercase tracking-wider ${new Date(task.dueDate) < new Date() && task.status !== "completed" ? "text-rose-600" : "text-slate-400"}`}>
                                    {new Date(task.dueDate) < new Date() && task.status !== "completed" ? "• Overdue" : "• Remaining"}
                                  </span>
                                </div>
                              </button>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex -space-x-2">
                              {task.assignedUsers.slice(0, 3).map((u) => (
                                <div key={u.id} className="flex items-center justify-center w-8 h-8 text-xs font-bold text-indigo-700 bg-indigo-100 border-2 border-white rounded-full shadow-sm" title={u.fullName}>
                                  {u.fullName.charAt(0)}
                                </div>
                              ))}
                              {task.assignedUsers.length > 3 && (
                                <div className="flex items-center justify-center w-8 h-8 text-xs font-bold border-2 border-white rounded-full shadow-sm bg-slate-100 text-slate-600">
                                  +{task.assignedUsers.length - 3}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border ${getPriorityStyle(task.priority)}`}>
                              {task.priority}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col items-center gap-2 min-w-[150px]">
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div className="h-full transition-all duration-500 ease-out rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600" style={{ width: `${task.progress}%` }} />
                              </div>
                              <div className="flex justify-between items-center w-full text-[10px] text-slate-500">
                                <span className="font-bold">{task.progress}%</span>
                                <div className="relative inline-block text-left">
                                  <select
                                    value={task.status}
                                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                    className={`appearance-none px-3 py-1 pr-6 rounded-full text-[10px] font-bold border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${getStatusStyle(task.status)} uppercase tracking-wider`}
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                  </select>
                                  <ChevronDown className="absolute right-2 top-1/2 w-2.5 h-2.5 opacity-50 -translate-y-1/2 pointer-events-none" />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button onClick={() => handleDeleteClick(task.id)} className="p-2 transition-all rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Delete">
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
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Create Task</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Assign new task to team.</p>
              </div>
              <button onClick={closeTaskModal} className="p-2 transition-all shadow-sm rounded-xl hover:bg-white text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddTask} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {addTaskError && (
                <div className="flex items-center gap-2 p-3 text-xs font-medium border text-rose-700 bg-rose-50 rounded-xl border-rose-100">
                  <AlertCircle className="w-4 h-4" />
                  {addTaskError}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">Company</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                    >
                      <option value="" disabled>Select company</option>
                      {COMPANY_NAMES.map((company, idx) => (
                        <option key={idx} value={company}>{company}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">Task Title</label>
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Task title"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">Priority</label>
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
                  <label className="ml-1 text-xs font-semibold text-slate-700">Due Date</label>
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
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-semibold text-slate-700">Project Name (Optional)</label>
                <input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="Project name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-semibold text-slate-700">Progress: {newProgress}%</label>
                <input
                  type="range" min="0" max="100" value={newProgress}
                  onChange={(e) => setNewProgress(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 accent-indigo-600"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="ml-1 text-xs font-semibold text-slate-700">Sub-Tasks</label>
                  <button
                    type="button"
                    onClick={() => setNewSubTasks([...newSubTasks, { id: Date.now().toString(), title: "", subTasks: [] }])}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-white transition-all bg-indigo-600 rounded-lg hover:bg-indigo-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Sub-Task
                  </button>
                </div>
                <div className="space-y-3">
                  {newSubTasks.map((subTask, idx) => (
                    <div key={subTask.id} className="p-3 space-y-2 border rounded-xl border-slate-200 bg-slate-50">
                      <div className="flex items-center gap-2">
                        <input
                          value={subTask.title}
                          onChange={(e) => {
                            const updated = [...newSubTasks];
                            updated[idx] = { ...subTask, title: e.target.value };
                            setNewSubTasks(updated);
                          }}
                          className="flex-1 px-4 py-2 text-sm transition-all bg-white border rounded-xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder="Sub-task title"
                        />
                        <button type="button" onClick={() => { const u = [...newSubTasks]; u.splice(idx, 1); setNewSubTasks(u); }} className="p-2 transition-all rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="pl-4 space-y-2">
                        {subTask.subTasks.map((child, cIdx) => (
                          <div key={child.id} className="flex items-center gap-2">
                            <div className="w-4 h-px bg-slate-300 shrink-0" />
                            <input
                              value={child.title}
                              onChange={(e) => {
                                const updated = [...newSubTasks];
                                const children = [...updated[idx].subTasks];
                                children[cIdx] = { ...child, title: e.target.value };
                                updated[idx] = { ...updated[idx], subTasks: children };
                                setNewSubTasks(updated);
                              }}
                              className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                              placeholder="Nested sub-task"
                            />
                            <button type="button" onClick={() => {
                              const updated = [...newSubTasks];
                              const children = [...updated[idx].subTasks];
                              children.splice(cIdx, 1);
                              updated[idx] = { ...updated[idx], subTasks: children };
                              setNewSubTasks(updated);
                            }} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={() => {
                          const updated = [...newSubTasks];
                          updated[idx] = { ...updated[idx], subTasks: [...updated[idx].subTasks, { id: Date.now().toString(), title: "" }] };
                          setNewSubTasks(updated);
                        }} className="flex items-center gap-1 ml-5 text-xs font-semibold text-indigo-500 transition-colors hover:text-indigo-700">
                          <Plus className="w-3 h-3" />
                          Add nested sub-task
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-semibold text-slate-700">Attachments</label>
                <div className="relative">
                  <input type="file" multiple onChange={(e) => setNewFiles(e.target.files)} className="hidden" id="task-files" />
                  <label htmlFor="task-files" className="flex items-center justify-center w-full gap-2 px-4 py-3 text-sm transition-all border-2 border-dashed cursor-pointer rounded-xl bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-500 hover:text-indigo-600 group">
                    <Paperclip className="w-4 h-4 transition-transform group-hover:rotate-12" />
                    {newFiles?.length ? <span className="font-bold">{newFiles.length} files selected</span> : "Upload task resources"}
                  </label>
                </div>
              </div>
              <div className="p-4 space-y-3 border rounded-2xl bg-slate-50 border-slate-100">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <UsersIcon className="w-3.5 h-3.5 text-indigo-500" />
                      Assign To
                    </label>
                    <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 cursor-pointer group">
                      <div className={`w-8 h-4.5 rounded-full transition-all duration-300 relative ${newAssignAll ? "bg-blue-600" : "bg-blue-300"}`}>
                        <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all duration-300 ${newAssignAll ? "left-4" : "left-0.5"}`} />
                      </div>
                      <input type="checkbox" checked={newAssignAll} onChange={(e) => setNewAssignAll(e.target.checked)} className="hidden" />
                      All
                    </label>
                  </div>
                  {!newAssignAll && (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input type="text" placeholder="Search users..." value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                      </div>
                      <div className="p-2 space-y-1 overflow-y-auto bg-white border shadow-inner max-h-32 rounded-xl border-slate-200">
                        {users.filter((u) => u.fullName.toLowerCase().includes(userSearchTerm.toLowerCase())).map((u) => {
                          const isSelected = newUserIds.includes(u.id);
                          return (
                            <label key={u.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${isSelected ? "text-indigo-700 bg-indigo-50" : "hover:bg-slate-50 text-slate-600"}`}>
                              <input type="checkbox" checked={isSelected} onChange={(e) => { if (e.target.checked) setNewUserIds([...newUserIds, u.id]); else setNewUserIds(newUserIds.filter((id) => id !== u.id)); }} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                              <div className="flex flex-col">
                                <span className="text-xs font-bold">{u.fullName}</span>
                                <span className="text-[10px] opacity-60">{u.email}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={closeTaskModal} className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
                <button type="submit" disabled={addingTask} className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed">
                  {addingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
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
            <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <p className="text-xs font-bold tracking-wider uppercase text-slate-500">
                {assignedTasks.find((t) => t.id === expandedTaskId)?.companyName}
              </p>
              <button onClick={() => setExpandedTaskId(null)} className="p-2 transition-colors rounded-xl hover:bg-slate-200">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="p-3 border rounded-2xl bg-slate-50 border-slate-100">
                    <p className="text-lg font-semibold text-slate-900">
                      {assignedTasks.find((t) => t.id === expandedTaskId)?.projectName || "N/A"}
                    </p>
                  </div>
                  <div className="p-3 border rounded-2xl bg-slate-50 border-slate-100">
                    <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">Due Date</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {new Date(assignedTasks.find((t) => t.id === expandedTaskId)?.dueDate || "").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="p-3 border rounded-2xl bg-slate-50 border-slate-100">
                  <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">Progress</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600" style={{ width: `${assignedTasks.find((t) => t.id === expandedTaskId)?.progress || 0}%` }} />
                    </div>
                    <span className="text-sm font-bold text-slate-700">{assignedTasks.find((t) => t.id === expandedTaskId)?.progress}%</span>
                  </div>
                </div>
              </div>
              <div className="p-4 border rounded-2xl bg-slate-50 border-slate-100">
                <p className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">Description</p>
                <p className="text-sm whitespace-pre-wrap text-slate-700">
                  {assignedTasks.find((t) => t.id === expandedTaskId)?.description || "No description provided."}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Sub-Tasks */}
                <div className="p-4 border rounded-2xl bg-slate-50 border-slate-100">
                  <p className="mb-3 text-xs font-bold tracking-wider uppercase text-slate-500">Sub-Tasks</p>
                  <div className="space-y-2">
                    {(() => {
                      const renderSubTask = (st: DetailedSubTask, level: number = 0) => {
                        const safeSubTasks = st.subTasks || [];
                        return (
                          <div key={st.id} className="overflow-hidden bg-white border rounded-xl border-slate-100">
                            <div className="flex items-center justify-between px-3 py-2" style={{ paddingLeft: `${level * 20 + 12}px` }}>
                              <div className="flex items-center gap-2">
                                {safeSubTasks.length > 0 ? (
                                  <button onClick={() => {
                                    const newExpanded = new Set(expandedNestedSubTasks);
                                    if (newExpanded.has(st.id.toString())) newExpanded.delete(st.id.toString());
                                    else newExpanded.add(st.id.toString());
                                    setExpandedNestedSubTasks(newExpanded);
                                  }} className="p-0.5 text-slate-400 hover:text-indigo-600">
                                    {expandedNestedSubTasks.has(st.id.toString()) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                  </button>
                                ) : <div className="w-4 h-4" />}
                                <span className="text-sm text-slate-700">{st.title}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    const nestedTitle = prompt("Enter nested sub-task title:");
                                    if (nestedTitle?.trim()) {
                                      addSubTaskToTask(expandedTaskId, st.id.toString(), nestedTitle.trim());
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => removeSubTaskFromTask(expandedTaskId, st.id)} className="p-1.5 text-slate-400 hover:text-rose-600">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            {safeSubTasks.length > 0 && expandedNestedSubTasks.has(st.id.toString()) && (
                              <div className="border-t border-slate-100">
                                {safeSubTasks.map((child) => renderSubTask(child, level + 1))}
                              </div>
                            )}
                          </div>
                        );
                      };
                      return (taskSubTasks[expandedTaskId] || []).map((st) => renderSubTask(st));
                    })()}
                    <div className="flex gap-2 mt-3">
                      <input
                        type="text"
                        value={newSubTaskTitle[expandedTaskId] || ""}
                        onChange={(e) => setNewSubTaskTitle((prev) => ({ ...prev, [expandedTaskId]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && addSubTaskToTask(expandedTaskId)}
                        placeholder="Add a new sub-task..."
                        className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      <button onClick={() => addSubTaskToTask(expandedTaskId)} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors">
                        Add
                      </button>
                    </div>
                  </div>
                </div>
                {/* Assigned To */}
                <div className="p-4 border rounded-2xl bg-slate-50 border-slate-100">
                  <p className="mb-3 text-xs font-bold tracking-wider uppercase text-slate-500">Assigned To</p>
                  <div className="flex flex-wrap gap-2">
                    {assignedTasks.find((t) => t.id === expandedTaskId)?.assignedUsers.map((u) => (
                      <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-center w-6 h-6 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full">{u.fullName.charAt(0)}</div>
                        <span className="text-xs font-semibold text-slate-700">{u.fullName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => { const task = assignedTasks.find((t) => t.id === expandedTaskId); if (task) handleEditClick(task); }}
                  className="flex gap-2 items-center px-6 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Update
                </button>
                <button onClick={() => setShowActivityPopup(true)} className="flex gap-2 items-center px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors">
                  <Clock className="w-4 h-4" />
                  View Activity
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Popup */}
      {showActivityPopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Activity History</h3>
              <button onClick={() => setShowActivityPopup(false)} className="p-2 transition-colors rounded-xl hover:bg-slate-200">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="flex gap-3 p-3 border rounded-xl bg-slate-50 border-slate-100">
                <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full">Y</div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-900">You changed the task status to "In Progress"</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Task Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Update Task</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Modify task details</p>
              </div>
              <button onClick={() => setShowUpdateModal(false)} className="p-2 transition-all shadow-sm rounded-xl hover:bg-white text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editTaskError && (
                <div className="flex items-center gap-2 p-3 text-xs font-medium border text-rose-700 bg-rose-50 rounded-xl border-rose-100">
                  <AlertCircle className="w-4 h-4" />
                  {editTaskError}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">Description</label>
                  <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px]" placeholder="Task description" />
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="ml-1 text-xs font-semibold text-slate-700">Due Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} required className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="ml-1 text-xs font-semibold text-slate-700">Progress: {editProgress}%</label>
                    <input type="range" min="0" max="100" value={editProgress} onChange={(e) => setEditProgress(Number(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 accent-indigo-600" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="col-span-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="ml-1 text-xs font-semibold text-slate-700">Sub-Tasks</label>
                    <button type="button" onClick={() => setEditSubTasks([...editSubTasks, { id: Date.now().toString(), title: "", subTasks: [] }])} className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-white transition-all bg-indigo-600 rounded-lg hover:bg-indigo-700">
                      <Plus className="w-3.5 h-3.5" />
                      Add Sub-Task
                    </button>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {editSubTasks.map((subTask, idx) => (
                      <div key={subTask.id} className="p-3 space-y-2 border rounded-xl border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-2">
                          <input
                            value={subTask.title}
                            onChange={(e) => {
                              const updated = [...editSubTasks];
                              updated[idx] = { ...subTask, title: e.target.value };
                              setEditSubTasks(updated);
                            }}
                            className="flex-1 px-4 py-2 text-sm transition-all bg-white border rounded-xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            placeholder="Sub-task title"
                          />
                          <button type="button" onClick={() => { const u = [...editSubTasks]; u.splice(idx, 1); setEditSubTasks(u); }} className="p-2 transition-all rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="pl-4 space-y-2">
                          {subTask.subTasks.map((child, cIdx) => (
                            <div key={child.id} className="flex items-center gap-2">
                              <div className="w-4 h-px bg-slate-300 shrink-0" />
                              <input
                                value={child.title}
                                onChange={(e) => {
                                  const updated = [...editSubTasks];
                                  const children = [...updated[idx].subTasks];
                                  children[cIdx] = { ...child, title: e.target.value };
                                  updated[idx] = { ...updated[idx], subTasks: children };
                                  setEditSubTasks(updated);
                                }}
                                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                placeholder="Nested sub-task"
                              />
                              <button type="button" onClick={() => {
                                const updated = [...editSubTasks];
                                const children = [...updated[idx].subTasks];
                                children.splice(cIdx, 1);
                                updated[idx] = { ...updated[idx], subTasks: children };
                                setEditSubTasks(updated);
                              }} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={() => {
                            const updated = [...editSubTasks];
                            updated[idx] = { ...updated[idx], subTasks: [...updated[idx].subTasks, { id: Date.now().toString(), title: "" }] };
                            setEditSubTasks(updated);
                          }} className="flex items-center gap-1 ml-5 text-xs font-semibold text-indigo-500 transition-colors hover:text-indigo-700">
                            <Plus className="w-3 h-3" />
                            Add nested sub-task
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-span-1 space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">Attachments</label>
                  <div className="relative">
                    <input type="file" multiple onChange={(e) => setEditFiles(e.target.files)} className="hidden" id="update-task-files" />
                    <label htmlFor="update-task-files" className="flex flex-col items-center justify-center w-full h-full gap-2 px-4 py-6 text-sm transition-all border-2 border-dashed cursor-pointer rounded-xl bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-500 hover:text-indigo-600 group">
                      <Paperclip className="w-6 h-6 transition-transform group-hover:rotate-12 text-slate-400 group-hover:text-indigo-500" />
                      {editFiles?.length ? <span className="font-bold text-center">{editFiles.length} files selected</span> : <span className="text-center">Upload additional files</span>}
                    </label>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3 border rounded-2xl bg-slate-50 border-slate-100">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <UsersIcon className="w-3.5 h-3.5 text-indigo-500" />
                  Assign To
                </label>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input type="text" placeholder="Search users..." value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                  </div>
                  <div className="p-2 space-y-1 overflow-y-auto bg-white border shadow-inner max-h-32 rounded-xl border-slate-200">
                    {users.filter((u) => u.fullName.toLowerCase().includes(userSearchTerm.toLowerCase())).map((u) => {
                      const isSelected = editUserIds.includes(u.id);
                      return (
                        <label key={u.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${isSelected ? "text-indigo-700 bg-indigo-50" : "hover:bg-slate-50 text-slate-600"}`}>
                          <input type="checkbox" checked={isSelected} onChange={(e) => { if (e.target.checked) setEditUserIds([...editUserIds, u.id]); else setEditUserIds(editUserIds.filter((id) => id !== u.id)); }} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold">{u.fullName}</span>
                            <span className="text-[10px] opacity-60">{u.email}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowUpdateModal(false)} className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
                <button type="submit" disabled={editingTaskLoading} className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed">
                  {editingTaskLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
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