import React, { useEffect, useState } from "react";
import api from "../api/axios";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  Clock,
  AlertCircle,
  Building2,
  Users as UsersIcon,
  Paperclip,
  FileText as FileIcon,
  CheckCircle2,
  X,
  Loader2,
  Calendar,
  LayoutGrid,
  List,
  ChevronDown,
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
  description: string;
  priority: string;
  status: string;
  dueDate: string;
  assignedUsers: AssignedUser[];
  files?: string[];
  createdAt: string;
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
  // Convert backslashes to forward slashes if any
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
  const [searchTerm, setSearchTerm] = useState("");

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
        } else if (tasksRes.data?.task) {
          setAssignedTasks([tasksRes.data.task]);
        } else if (tasksRes.data?.tasks) {
          setAssignedTasks(tasksRes.data.tasks);
        } else {
          setAssignedTasks([]);
        }

        setUsers(usersRes.data);
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
    setEditDescription(task.description);
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate.slice(0, 10));
    setEditUserIds(task.assignedUsers.map((u) => u.id));
    setEditTaskError(null);
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
      const formData = new FormData();
      formData.append("companyName", editCompanyName);
      formData.append("title", editTitle);
      formData.append("description", editDescription);
      formData.append("priority", editPriority);
      formData.append("dueDate", editDueDate);
      formData.append("userIds", editUserIds.join(","));

      if (editFiles) {
        for (let i = 0; i < editFiles.length; i++) {
          formData.append("files", editFiles[i]);
        }
      }

      const res = await api.put<any>(`/api/tasks/${editingTaskId}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      const updatedTask: Task = res.data.task || res.data;
      setAssignedTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
      );
      setEditingTaskId(null);
      setShowAddTaskForm(false);
      setEditFiles(null);
    } catch (err: any) {
      setEditTaskError(
        err?.response?.data?.message || err.message || "Update failed",
      );
    } finally {
      setEditingTaskLoading(false);
    }
  };

  const isTaskModalOpen = showAddTaskForm || editingTaskId !== null;
  const isEditMode = editingTaskId !== null;

  const openAddTaskModal = () => {
    setShowAddTaskForm(true);
    setEditingTaskId(null);
    setAddTaskError(null);
    setEditTaskError(null);
  };

  const closeTaskModal = () => {
    setShowAddTaskForm(false);
    setEditingTaskId(null);
    setAddTaskError(null);
    setEditTaskError(null);
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

      if (newFiles) {
        for (let i = 0; i < newFiles.length; i++) {
          formData.append("files", newFiles[i]);
        }
      }

      const response = await api.post<any>("/api/tasks", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      const task: Task = response.data.task || response.data;
      setAssignedTasks((prev) => [task, ...prev]);
      setShowAddTaskForm(false);
      setNewCompanyName("");
      setNewTitle("");
      setNewDescription("");
      setNewPriority("high");
      setNewDueDate("");
      setNewUserIds([]);
      setNewAssignAll(false);
      setNewFiles(null);
    } catch (err: any) {
      setAddTaskError(
        err?.response?.data?.message || err.message || "Unable to add task.",
      );
    } finally {
      setAddingTask(false);
    }
  };

  const filteredTasks = assignedTasks.filter(
    (task) =>
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase()),
  );

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

  return (
    <div className="pb-12 space-y-6">
      {/* Search and Action Bar */}
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

        <div className="flex gap-3 items-center">
          <button className="flex gap-2 items-center px-4 py-3 text-sm font-semibold bg-white rounded-2xl border shadow-sm transition-all border-slate-200 text-slate-600 hover:bg-slate-50">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={openAddTaskModal}
            className="flex gap-2 items-center px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-2xl shadow-lg transition-all hover:bg-indigo-700 shadow-indigo-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Create Task
          </button>
        </div>
      </div>

      {/* Tasks Table/List */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        {tasksLoading ? (
          <div className="flex flex-col justify-center items-center py-20">
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
          <div className="flex flex-col justify-center items-center px-4 py-20 text-center">
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50/50 border-slate-100">
                  <th className="px-8 py-5 text-xs font-bold tracking-widest uppercase text-slate-500">
                    Task Information
                  </th>
                  <th className="px-8 py-5 text-xs font-bold tracking-widest uppercase text-slate-500">
                    Company
                  </th>
                  <th className="px-8 py-5 text-xs font-bold tracking-widest text-center uppercase text-slate-500">
                    Priority
                  </th>
                  <th className="px-8 py-5 text-xs font-bold tracking-widest text-center uppercase text-slate-500">
                    Status
                  </th>
                  <th className="px-8 py-5 text-xs font-bold tracking-widest text-right uppercase text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="transition-colors group hover:bg-slate-50/30"
                  >
                    <td className="px-8 py-6">
                      <div className="max-w-md">
                        <p className="mb-1 text-base font-bold transition-colors text-slate-900 group-hover:text-indigo-600">
                          {task.title}
                        </p>
                        <p className="text-sm leading-relaxed text-slate-500 line-clamp-2">
                          {task.description}
                        </p>
                        {task.files && task.files.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {task.files.map((filePath, idx) => {
                              const fileName =
                                filePath.split(/[\\/]/).pop() || "File";
                              return (
                                <a
                                  key={idx}
                                  href={getFileUrl(filePath)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-all group/file"
                                >
                                  <FileIcon className="w-3.5 h-3.5 group-hover/file:scale-110 transition-transform" />
                                  <span className="max-w-[150px] truncate">
                                    {fileName}
                                  </span>
                                </a>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex gap-4 items-center mt-3">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            Due {formatDate(task.dueDate)}
                          </span>
                          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                            <div className="flex -space-x-1.5">
                              {task.assignedUsers.slice(0, 3).map((u) => (
                                <div
                                  key={u.id}
                                  className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700"
                                  title={u.fullName}
                                >
                                  {u.fullName.charAt(0)}
                                </div>
                              ))}
                              {task.assignedUsers.length > 3 && (
                                <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">
                                  +{task.assignedUsers.length - 3}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex gap-2 items-center">
                        <div className="p-2 rounded-lg bg-slate-100">
                          <Building2 className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-sm font-bold text-slate-700">
                          {task.companyName}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span
                        className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border ${getPriorityStyle(task.priority)}`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="inline-block relative text-left">
                        <select
                          value={task.status}
                          onChange={(e) =>
                            handleStatusChange(task.id, e.target.value)
                          }
                          className={`appearance-none px-4 py-1.5 pr-8 rounded-full text-xs font-bold border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${getStatusStyle(task.status)}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 w-3 h-3 opacity-50 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex gap-2 justify-end items-center transition-opacity">
                        <button
                          onClick={() => handleEditClick(task)}
                          className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                          title="Edit Task"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(task.id)}
                          className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="Delete Task"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Task Creation/Editing Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {isEditMode ? "Modify Task" : "Create Task"}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {isEditMode
                    ? "Update assignment details."
                    : "Assign new task to team."}
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
              onSubmit={isEditMode ? handleEditSubmit : handleAddTask}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              {(isEditMode ? editTaskError : addTaskError) && (
                <div className="flex gap-2 items-center p-3 text-xs font-medium text-rose-700 bg-rose-50 rounded-xl border border-rose-100">
                  <AlertCircle className="w-4 h-4" />
                  {isEditMode ? editTaskError : addTaskError}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    Company
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      value={isEditMode ? editCompanyName : newCompanyName}
                      onChange={(e) =>
                        isEditMode
                          ? setEditCompanyName(e.target.value)
                          : setNewCompanyName(e.target.value)
                      }
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="Company name"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    Task Title
                  </label>
                  <input
                    value={isEditMode ? editTitle : newTitle}
                    onChange={(e) =>
                      isEditMode
                        ? setEditTitle(e.target.value)
                        : setNewTitle(e.target.value)
                    }
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Task title"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="ml-1 text-xs font-semibold text-slate-700">
                    Priority
                  </label>
                  <select
                    value={isEditMode ? editPriority : newPriority}
                    onChange={(e) =>
                      isEditMode
                        ? setEditPriority(e.target.value)
                        : setNewPriority(e.target.value)
                    }
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
                      value={isEditMode ? editDueDate : newDueDate}
                      onChange={(e) =>
                        isEditMode
                          ? setEditDueDate(e.target.value)
                          : setNewDueDate(e.target.value)
                      }
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-semibold text-slate-700">
                  Description
                </label>
                <textarea
                  value={isEditMode ? editDescription : newDescription}
                  onChange={(e) =>
                    isEditMode
                      ? setEditDescription(e.target.value)
                      : setNewDescription(e.target.value)
                  }
                  required
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                  placeholder="Task details..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="ml-1 text-xs font-semibold text-slate-700">
                  Attachments
                </label>
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    onChange={(e) =>
                      isEditMode
                        ? setEditFiles(e.target.files)
                        : setNewFiles(e.target.files)
                    }
                    className="hidden"
                    id="task-files"
                  />
                  <label
                    htmlFor="task-files"
                    className="flex gap-2 justify-center items-center px-4 py-3 w-full text-sm rounded-xl border-2 border-dashed transition-all cursor-pointer bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-500 hover:text-indigo-600 group"
                  >
                    <Paperclip className="w-4 h-4 transition-transform group-hover:rotate-12" />
                    {(isEditMode ? editFiles : newFiles)?.length ? (
                      <span className="font-bold">
                        {(isEditMode ? editFiles : newFiles)?.length} files
                        selected
                      </span>
                    ) : (
                      "Upload task resources"
                    )}
                  </label>
                </div>
              </div>

              <div className="p-4 space-y-3 rounded-2xl border bg-slate-50 border-slate-100">
                <div className="flex justify-between items-center">
                  <label className="flex gap-2 items-center text-xs font-bold text-slate-900">
                    <UsersIcon className="w-3.5 h-3.5 text-indigo-500" />
                    Assign To
                  </label>
                  {!isEditMode && (
                    <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 cursor-pointer group">
                      <div
                        className={`w-8 h-4.5 rounded-full transition-all duration-300 relative ${newAssignAll ? "bg-indigo-600" : "bg-slate-300"}`}
                      >
                        <div
                          className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all duration-300 ${newAssignAll ? "left-4" : "left-0.5"}`}
                        />
                      </div>
                      <input
                        type="checkbox"
                        checked={newAssignAll}
                        onChange={(e) => setNewAssignAll(e.target.checked)}
                        className="hidden"
                      />
                      All
                    </label>
                  )}
                </div>

                {!newAssignAll && (
                  <div className="space-y-2">
                    <div className="overflow-y-auto p-2 space-y-1 max-h-32 bg-white rounded-xl border shadow-inner border-slate-200">
                      {users.length === 0 ? (
                        <p className="p-2 text-xs text-center text-slate-400">
                          No users available
                        </p>
                      ) : (
                        users.map((u) => {
                          const isSelected = isEditMode
                            ? editUserIds.includes(u.id)
                            : newUserIds.includes(u.id);
                          return (
                            <label
                              key={u.id}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${isSelected ? "text-indigo-700 bg-indigo-50" : "hover:bg-slate-50 text-slate-600"}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const setter = isEditMode
                                    ? setEditUserIds
                                    : setNewUserIds;
                                  const current = isEditMode
                                    ? editUserIds
                                    : newUserIds;
                                  if (checked) {
                                    setter([...current, u.id]);
                                  } else {
                                    setter(current.filter((id) => id !== u.id));
                                  }
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
                        })
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider ml-1">
                      Select multiple users to assign this task
                    </p>
                  </div>
                )}
              </div>

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
                  disabled={isEditMode ? editingTaskLoading : addingTask}
                  className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {(isEditMode ? editingTaskLoading : addingTask) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {isEditMode ? "Update" : "Create"}
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
