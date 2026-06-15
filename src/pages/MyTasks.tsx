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
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(
    new Set(),
  );

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
  const [expandedNestedSubTasks, setExpandedNestedSubTasks] = useState<
    Set<string>
  >(new Set());

  const convertToDetailed = (
    subTasks: any[],
  ): DetailedSubTask[] => {
    return subTasks.map((st) => ({
      id: st.id,
      title: st.title,
      subTasks: st.children ? convertToDetailed(st.children) : [],
    }));
  };

  const loadData = async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const tasksRes = await api.get<any>("/api/tasks");

      if (Array.isArray(tasksRes.data)) {
        setTasks(tasksRes.data);
        const subTasksMap: Record<number, DetailedSubTask[]> = {};
        tasksRes.data.forEach((task: Task) => {
          subTasksMap[task.id] = convertToDetailed(task.subTasks || []);
        });
        setTaskSubTasks(subTasksMap);
      } else if (tasksRes.data?.task) {
        setTasks([tasksRes.data.task]);
      } else if (tasksRes.data?.tasks) {
        setTasks(tasksRes.data.tasks);
      } else {
        setTasks([]);
      }
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
      if (newSet.has(companyName)) {
        newSet.delete(companyName);
      } else {
        newSet.add(companyName);
      }
      return newSet;
    });
  };

  const filteredTasks = tasks.filter((task) => {
    // Search term filter
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.companyName.toLowerCase().includes(searchTerm.toLowerCase());

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

    return (
      matchesSearch &&
      matchesProject &&
      matchesPriority &&
      matchesStatus
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
    switch (status.toLowerCase()) {
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
    <div className="space-y-8 pb-12">
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">My Tasks</h2>
            <p className="text-sm text-slate-500 mt-1">
              Tasks assigned to you by admins or other users.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search my tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-4 py-3 rounded-3xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 ml-1">
              Project Name
            </label>
            <input
              type="text"
              placeholder="Search project..."
              value={filterProjectName}
              onChange={(e) => setFilterProjectName(e.target.value)}
              className="px-4 py-2 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 ml-1">
              Priority
            </label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-2 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 ml-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
            <Loader2 className="mx-auto w-10 h-10 text-indigo-600 animate-spin" />
            <p className="mt-4 text-slate-500">
              Loading your tasks...
            </p>
          </div>
        ) : tasksError ? (
          <div className="flex gap-4 items-center p-6 font-medium text-rose-700 bg-rose-50 rounded-2xl border border-rose-100">
            <AlertCircle className="w-6 h-6" />
            {tasksError}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col justify-center items-center px-4 py-20 text-center bg-slate-50 rounded-[32px] border border-slate-200">
            <div className="flex justify-center items-center mb-6 w-20 h-20 rounded-full bg-indigo-50">
              <CheckCircle2 className="w-10 h-10 text-indigo-300" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-900">
              No tasks found
            </h3>
            <p className="mx-auto max-w-sm text-slate-500">
              You don't have any tasks matching the current filters.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTasks).map(([companyName, companyTasks]) => (
              <div key={companyName} className="overflow-hidden">
                <button
                  onClick={() => toggleCompany(companyName)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 hover:bg-slate-100 transition-colors"
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
                      {companyTasks.length} task{companyTasks.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </button>

                {expandedCompanies.has(companyName) && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-white border-b border-slate-100">
                          <th className="px-8 py-5 text-xs font-bold tracking-widest uppercase text-slate-500 text-left">
                            Task
                          </th>
                          <th className="px-8 py-5 text-xs font-bold tracking-widest uppercase text-slate-500 text-left">
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
                            className="bg-white hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-8 py-6">
                              <div className="space-y-2">
                                <button
                                  onClick={() =>
                                    setExpandedTaskId(
                                      expandedTaskId === task.id ? null : task.id,
                                    )
                                  }
                                  className="text-left"
                                >
                                  <p className="text-sm font-semibold text-slate-900 hover:text-indigo-700 transition-colors">
                                    {task.title}
                                  </p>
                                </button>
                                <p className="text-xs text-slate-500 flex items-center gap-1">
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
                                className={`inline-flex items-center justify-center w-24 px-2 py-1 text-xs font-bold uppercase tracking-widest rounded-full border ${getPriorityColor(
                                  task.priority,
                                )}`}
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
                                    className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold uppercase tracking-widest rounded-full border ${getStatusColor(
                                      task.status,
                                    )}`}
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

                    {/* Expanded task details */}
                    {expandedTaskId &&
                      companyTasks.some((t) => t.id === expandedTaskId) && (
                        <div className="mt-4 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                          {(() => {
                            const task = companyTasks.find(
                              (t) => t.id === expandedTaskId,
                            );
                            if (!task) return null;

                            return (
                              <>
                                <div className="flex justify-between items-center mb-4">
                                  <h3 className="text-lg font-bold text-slate-900">
                                    {task.title}
                                  </h3>
                                  <button
                                    onClick={() => setExpandedTaskId(null)}
                                    className="p-2 rounded-xl hover:bg-slate-200"
                                  >
                                    <X className="w-5 h-5 text-slate-500" />
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="p-4 rounded-2xl border bg-white border-slate-200">
                                    <p className="mb-2 text-xs font-bold tracking-widest uppercase text-slate-500">
                                      Sub-Tasks
                                    </p>
                                    <div className="space-y-2">
                                      {(() => {
                                        const renderSubTask = (
                                          st: DetailedSubTask,
                                          level: number = 0,
                                        ) => {
                                          const safeSubTasks = st.subTasks || [];
                                          return (
                                            <div
                                              key={st.id}
                                              className="overflow-hidden bg-slate-50 rounded-xl border border-slate-200"
                                            >
                                              <div
                                                className="flex items-center px-3 py-2"
                                                style={{
                                                  paddingLeft: `${level * 20 + 12}px`,
                                                }}
                                              >
                                                <div className="flex gap-2 items-center">
                                                  {safeSubTasks.length > 0 ? (
                                                    <button
                                                      onClick={() => {
                                                        const newExpanded = new Set(
                                                          expandedNestedSubTasks,
                                                        );
                                                        if (
                                                          newExpanded.has(
                                                            st.id.toString(),
                                                          )
                                                        )
                                                          newExpanded.delete(
                                                            st.id.toString(),
                                                          );
                                                        else
                                                          newExpanded.add(
                                                            st.id.toString(),
                                                          );
                                                        setExpandedNestedSubTasks(
                                                          newExpanded,
                                                        );
                                                      }}
                                                      className="p-0.5 text-slate-400 hover:text-indigo-600"
                                                    >
                                                      {expandedNestedSubTasks.has(
                                                        st.id.toString(),
                                                      ) ? (
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                      ) : (
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                      )}
                                                    </button>
                                                  ) : (
                                                    <div className="w-4 h-4" />
                                                  )}
                                                  <span className="text-sm text-slate-700">
                                                    {st.title}
                                                  </span>
                                                </div>
                                              </div>
                                              {safeSubTasks.length > 0 &&
                                                expandedNestedSubTasks.has(
                                                  st.id.toString(),
                                                ) && (
                                                  <div className="border-t border-slate-200">
                                                    {safeSubTasks.map((child) =>
                                                      renderSubTask(child, level + 1),
                                                    )}
                                                  </div>
                                                )}
                                            </div>
                                          );
                                        };
                                        return (taskSubTasks[task.id] || []).map((st) =>
                                          renderSubTask(st),
                                        );
                                      })()}
                                    </div>
                                  </div>
                                  <div className="p-4 rounded-2xl border bg-white border-slate-200">
                                    <p className="mb-2 text-xs font-bold tracking-widest uppercase text-slate-500">
                                      Assigned To
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {task.assignedUsers.map((u) => (
                                        <div
                                          key={u.id}
                                          className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 shadow-sm"
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
                                {task.description && (
                                  <div className="mt-4 p-4 rounded-2xl border bg-white border-slate-200">
                                    <p className="mb-2 text-xs font-bold tracking-widest uppercase text-slate-500">
                                      Description
                                    </p>
                                    <p className="text-sm text-slate-700 leading-relaxed">
                                      {task.description}
                                    </p>
                                  </div>
                                )}
                                {task.files && task.files.length > 0 && (
                                  <div className="mt-4 p-4 rounded-2xl border bg-white border-slate-200">
                                    <p className="mb-2 text-xs font-bold tracking-widest uppercase text-slate-500">
                                      Attachments
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {task.files.map((file, index) => (
                                        <a
                                          key={index}
                                          href={getFileUrl(file)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-200 shadow-sm text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors"
                                        >
                                          File {index + 1}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTasks;
