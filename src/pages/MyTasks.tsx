import React, { useEffect, useState } from "react";
import api from "../api/axios";
import {
  Plus,
  Search,
  Clock,
  Loader2,
  AlertCircle,
  Building2,
  Users as UsersIcon,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  User,
  ListChecks,
  FileText,
  BarChart2,
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

const MyTasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(
    new Set(),
  );

  // Popup States
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [popupProgress, setPopupProgress] = useState<number>(0);
  const [savingProgress, setSavingProgress] = useState(false);

  // Filter state variables
  const [filterProjectName, setFilterProjectName] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  type DetailedSubTask = {
    id: string | number;
    title: string;
    subTasks: DetailedSubTask[];
  };

  const [taskSubTasks, setTaskSubTasks] = useState<
    Record<number, DetailedSubTask[]>
  >({});

  const convertToDetailed = (subTasks: any[]): DetailedSubTask[] => {
    return subTasks.map((st) => ({
      id: st.id,
      title: st.title,
      subTasks: convertToDetailed(st.children || st.subTasks || []),
    }));
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
      const tasksRes = await api.get<any>("/api/tasks");

      let taskList: Task[] = [];
      if (Array.isArray(tasksRes.data)) {
        taskList = tasksRes.data;
      } else if (tasksRes.data?.task) {
        taskList = [tasksRes.data.task];
      } else if (tasksRes.data?.tasks) {
        taskList = tasksRes.data.tasks;
      }
      setTasks(taskList);
      setTaskSubTasks(buildSubTasksMap(taskList));
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

  // Popup Handlers
  const openPopup = (task: Task) => {
    setSelectedTask(task);
    setPopupProgress(task.progress || 0);
  };

  const closePopup = () => {
    setSelectedTask(null);
  };

  const saveProgress = async () => {
    if (!selectedTask) return;
    setSavingProgress(true);
    try {
      await api.put<any>(`/api/tasks/${selectedTask.id}/progress`, {
        progress: popupProgress,
      });

      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTask.id ? { ...t, progress: popupProgress } : t,
        ),
      );
      setSelectedTask((prev) =>
        prev ? { ...prev, progress: popupProgress } : null,
      );
      alert("Progress updated successfully!");
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          err.message ||
          "Unable to update progress.",
      );
    } finally {
      setSavingProgress(false);
    }
  };

  // Recursive renderer for SubTasks in the modal
  const renderSubTasks = (subTasks: DetailedSubTask[], level: number = 0) => {
    if (!subTasks || subTasks.length === 0) return null;
    return (
      <ul className="space-y-1" style={{ paddingLeft: `${level * 16}px` }}>
        {subTasks.map((st) => (
          <li
            key={st.id}
            className="flex items-start gap-2 text-sm text-slate-700"
          >
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
            <div>
              <span className="font-medium">{st.title}</span>
              {st.subTasks &&
                st.subTasks.length > 0 &&
                renderSubTasks(st.subTasks, level + 1)}
            </div>
          </li>
        ))}
      </ul>
    );
  };

  const filteredTasks = tasks.filter((task) => {
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
          <div className="relative">
            <Search className="absolute w-4 h-4 -translate-y-1/2 left-4 top-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search my tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="py-3 pr-4 border pl-11 rounded-3xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
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

      {/* Task Details Popup Modal */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all bg-slate-900/60 backdrop-blur-sm"
          onClick={closePopup}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-[32px] shadow-2xl p-8 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closePopup}
              className="absolute p-2 transition-colors rounded-full top-6 right-6 hover:bg-slate-100 text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">
                  {selectedTask.title}
                </h2>
                <div className="flex items-center gap-3 mt-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${
                      selectedTask.status.toLowerCase().replace(/\s+/g, "") ===
                      "completed"
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        : "bg-amber-100 text-amber-700 border border-amber-200"
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    {selectedTask.status}
                  </span>
                  {selectedTask.dueDate && (
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      Due {new Date(selectedTask.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold tracking-wider uppercase text-slate-500">
                    <User className="w-4 h-4" /> Assigned To
                  </div>
                  <div className="p-4 font-medium border rounded-2xl bg-slate-50 border-slate-100 text-slate-800">
                    <div className="flex flex-wrap gap-2">
                      {selectedTask.assignedUsers &&
                      selectedTask.assignedUsers.length > 0 ? (
                        selectedTask.assignedUsers.map((u) => (
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
                        ))
                      ) : (
                        <span className="text-sm italic font-normal text-slate-500">
                          Unassigned
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold tracking-wider uppercase text-slate-500">
                    <ListChecks className="w-4 h-4" /> Sub Tasks
                  </div>
                  <div className="p-4 overflow-y-auto font-medium border rounded-2xl bg-slate-50 border-slate-100 text-slate-800 max-h-60">
                    {taskSubTasks[selectedTask.id] &&
                    taskSubTasks[selectedTask.id].length > 0 ? (
                      renderSubTasks(taskSubTasks[selectedTask.id])
                    ) : (
                      <p className="text-sm italic font-normal text-slate-500">
                        No subtasks defined
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold tracking-wider uppercase text-slate-500">
                  <FileText className="w-4 h-4" /> Description
                </div>
                <div className="p-4 leading-relaxed border rounded-2xl bg-slate-50 border-slate-100 text-slate-700">
                  {selectedTask.description || "No description provided."}
                </div>
              </div>

              <div className="pt-4 space-y-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <BarChart2 className="w-4 h-4 text-indigo-600" />
                    Progress
                  </div>
                  <span className="text-2xl font-bold text-indigo-600">
                    {popupProgress}%
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={popupProgress}
                  onChange={(e) => setPopupProgress(parseInt(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 accent-indigo-600"
                />

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={closePopup}
                    className="px-5 py-2.5 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    Close
                  </button>
                  <button
                    onClick={saveProgress}
                    disabled={savingProgress}
                    className="px-6 py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-70 flex items-center gap-2"
                  >
                    {savingProgress ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      "Update Progress"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTasks;