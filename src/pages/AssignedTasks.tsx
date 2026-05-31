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

type Task = {
  id: number;
  companyName: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string;
  assignedUsers: AssignedUser[];
  createdAt: string;
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const AssignedTasks: React.FC = () => {
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState("high");
  const [newDueDate, setNewDueDate] = useState("");
  const [newUserIds, setNewUserIds] = useState("2");
  const [newAssignAll, setNewAssignAll] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [addTaskError, setAddTaskError] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("high");
  const [editDueDate, setEditDueDate] = useState("");
  const [editUserIds, setEditUserIds] = useState("");
  const [editingTaskLoading, setEditingTaskLoading] = useState(false);
  const [editTaskError, setEditTaskError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadTasks = async () => {
      setTasksLoading(true);
      setTasksError(null);
      try {
        const response = await api.get<any>("/api/tasks");
        if (Array.isArray(response.data)) {
          setAssignedTasks(response.data);
        } else if (response.data?.task) {
          setAssignedTasks([response.data.task]);
        } else if (response.data?.tasks) {
          setAssignedTasks(response.data.tasks);
        } else {
          setAssignedTasks([]);
        }
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

    loadTasks();
  }, []);

  const handleEditClick = (task: Task) => {
    setEditingTaskId(task.id);
    setEditCompanyName(task.companyName);
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate.slice(0, 10));
    setEditUserIds(task.assignedUsers.map((u) => u.id).join(","));
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
      const userIds = editUserIds
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n));

      const payload = {
        companyName: editCompanyName,
        title: editTitle,
        description: editDescription,
        priority: editPriority,
        dueDate: editDueDate,
        userIds,
      } as any;

      const res = await api.put<any>(`/api/tasks/${editingTaskId}`, payload);
      const updated: Task = res.data.task || res.data;
      setAssignedTasks((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)),
      );
      setEditingTaskId(null);
      setShowAddTaskForm(false);
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

    const userIds = newUserIds
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !Number.isNaN(id));

    try {
      const payload = {
        companyName: newCompanyName,
        title: newTitle,
        description: newDescription,
        priority: newPriority,
        dueDate: newDueDate,
        userIds,
        assignAll: newAssignAll,
      };

      const response = await api.post<any>("/api/tasks", payload);
      const task: Task = response.data.task || response.data;
      setAssignedTasks((prev) => [task, ...prev]);
      setShowAddTaskForm(false);
      setNewCompanyName("");
      setNewTitle("");
      setNewDescription("");
      setNewPriority("high");
      setNewDueDate("");
      setNewUserIds("2");
      setNewAssignAll(false);
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
    <div className="space-y-6 pb-12">
      {/* Search and Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search tasks by title, company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={openAddTaskModal}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Create Task
          </button>
        </div>
      </div>

      {/* Tasks Table/List */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        {tasksLoading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="mt-4 text-slate-500 font-medium">
              Loading your assignments...
            </p>
          </div>
        ) : tasksError ? (
          <div className="m-8 p-6 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 flex items-center gap-4 font-medium">
            <AlertCircle className="w-6 h-6" />
            {tasksError}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              No tasks found
            </h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              Either you're all caught up or no tasks match your current search.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Task Information
                  </th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Company
                  </th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
                    Priority
                  </th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
                    Status
                  </th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="group hover:bg-slate-50/30 transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="max-w-md">
                        <p className="text-base font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
                          {task.title}
                        </p>
                        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                        <div className="flex items-center gap-4 mt-3">
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
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-100 rounded-lg">
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
                      <div className="relative inline-block text-left">
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
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-50" />
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 transition-opacity">
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
          <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-[32px]">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">
                  {isEditMode ? "Modify Assignment" : "Initialize Assignment"}
                </h3>
                <p className="text-slate-500 font-medium mt-1">
                  {isEditMode
                    ? "Refine task parameters and targets."
                    : "Set clear objectives and assign to the team."}
                </p>
              </div>
              <button
                onClick={closeTaskModal}
                className="p-3 hover:bg-white rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={isEditMode ? handleEditSubmit : handleAddTask}
              className="p-8 space-y-6"
            >
              {(isEditMode ? editTaskError : addTaskError) && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-sm font-medium flex items-center gap-3">
                  <AlertCircle className="w-5 h-5" />
                  {isEditMode ? editTaskError : addTaskError}
                </div>
              )}

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 ml-1">
                    Company Entity
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={isEditMode ? editCompanyName : newCompanyName}
                      onChange={(e) =>
                        isEditMode
                          ? setEditCompanyName(e.target.value)
                          : setNewCompanyName(e.target.value)
                      }
                      required
                      className="w-full pl-11 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="Organization name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 ml-1">
                    Assignment Title
                  </label>
                  <input
                    value={isEditMode ? editTitle : newTitle}
                    onChange={(e) =>
                      isEditMode
                        ? setEditTitle(e.target.value)
                        : setNewTitle(e.target.value)
                    }
                    required
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Clear task title"
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 ml-1">
                    Priority Matrix
                  </label>
                  <select
                    value={isEditMode ? editPriority : newPriority}
                    onChange={(e) =>
                      isEditMode
                        ? setEditPriority(e.target.value)
                        : setNewPriority(e.target.value)
                    }
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 ml-1">
                    Delivery Deadline
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={isEditMode ? editDueDate : newDueDate}
                      onChange={(e) =>
                        isEditMode
                          ? setEditDueDate(e.target.value)
                          : setNewDueDate(e.target.value)
                      }
                      required
                      className="w-full pl-11 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">
                  Detailed Requirements
                </label>
                <textarea
                  value={isEditMode ? editDescription : newDescription}
                  onChange={(e) =>
                    isEditMode
                      ? setEditDescription(e.target.value)
                      : setNewDescription(e.target.value)
                  }
                  required
                  rows={4}
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                  placeholder="Elaborate on the task objectives and deliverables..."
                />
              </div>

              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UsersIcon className="w-4 h-4 text-indigo-500" />
                    Target Assignment
                  </label>
                  {!isEditMode && (
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer group">
                      <div
                        className={`w-10 h-6 rounded-full transition-all duration-300 relative ${newAssignAll ? "bg-indigo-600" : "bg-slate-300"}`}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${newAssignAll ? "left-5" : "left-1"}`}
                        />
                      </div>
                      <input
                        type="checkbox"
                        checked={newAssignAll}
                        onChange={(e) => setNewAssignAll(e.target.checked)}
                        className="hidden"
                      />
                      Assign All Users
                    </label>
                  )}
                </div>

                {!newAssignAll && (
                  <div className="space-y-2">
                    <input
                      value={isEditMode ? editUserIds : newUserIds}
                      onChange={(e) =>
                        isEditMode
                          ? setEditUserIds(e.target.value)
                          : setNewUserIds(e.target.value)
                      }
                      className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                      placeholder="e.g. 2, 5, 8 (Comma-separated IDs)"
                    />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider ml-1">
                      Input target employee IDs separated by commas
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeTaskModal}
                  className="px-8 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditMode ? editingTaskLoading : addingTask}
                  className="flex items-center gap-2 px-10 py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {(isEditMode ? editingTaskLoading : addingTask) ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                  {isEditMode ? "Save Changes" : "Assign Task"}
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
