import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Calendar as CalendarIcon, 
  Building2, 
  Users as UsersIcon,
  Loader2,
  ChevronRight
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

type DashboardData = {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  highPriorityTasks: Task[];
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user) return;
      setDashboardLoading(true);
      setDashboardError(null);
      try {
        const response = await api.get<DashboardData>("/api/dashboard");
        setDashboardData(response.data);
      } catch (err: any) {
        setDashboardError(
          err?.response?.data?.message || err.message || "Unable to load dashboard.",
        );
      } finally {
        setDashboardLoading(false);
      }
    };

    loadDashboard();
  }, [user]);

  const stats = [
    {
      label: "Pending",
      value: dashboardData?.pending ?? 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
    },
    {
      label: "In Progress",
      value: dashboardData?.inProgress ?? 0,
      icon: TrendingUp,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-100",
    },
    {
      label: "Completed",
      value: dashboardData?.completed ?? 0,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
    },
    {
      label: "High Priority",
      value: dashboardData?.highPriorityTasks.length ?? 0,
      icon: AlertCircle,
      color: "text-rose-600",
      bg: "bg-rose-50",
      border: "border-rose-100",
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.label}
            className={`p-6 rounded-3xl bg-white border border-slate-200 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-1`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${item.bg} ${item.color} border ${item.border}`}>
                <item.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-slate-900">{item.value}</h3>
              <span className="text-sm text-slate-500 font-medium">tasks</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 lg:p-8 border-b border-slate-100 bg-slate-50/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">High Priority Tasks</h2>
              <p className="mt-1 text-sm text-slate-500 font-medium">
                Review and manage critical tasks requiring immediate attention.
              </p>
            </div>
            {!dashboardLoading && (
              <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 rounded-full text-sm font-bold border border-rose-100">
                <AlertCircle className="w-4 h-4" />
                {dashboardData?.highPriorityTasks.length ?? 0} Critical Tasks
              </div>
            )}
          </div>
        </div>

        <div className="p-6 lg:p-8">
          {dashboardLoading ? (
            <div className="space-y-4 py-12 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-slate-500 font-medium animate-pulse">Fetching your dashboard data...</p>
            </div>
          ) : dashboardError ? (
            <div className="p-6 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-4 text-rose-700">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <p className="font-medium">{dashboardError}</p>
            </div>
          ) : dashboardData && dashboardData.highPriorityTasks.length > 0 ? (
            <div className="grid gap-6">
              {dashboardData.highPriorityTasks.map((task) => (
                <div
                  key={task.id}
                  className="group relative rounded-3xl border border-slate-100 bg-slate-50/50 p-6 transition-all duration-200 hover:bg-white hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/5"
                >
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="px-3 py-1 bg-rose-100 text-rose-700 text-[10px] font-bold uppercase tracking-widest rounded-full border border-rose-200">
                          {task.priority} Priority
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <Building2 className="w-3.5 h-3.5" />
                          {task.companyName}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {task.title}
                      </h3>
                      <p className="mt-3 text-slate-600 leading-relaxed text-sm line-clamp-2">
                        {task.description}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row lg:flex-col gap-4 min-w-[200px]">
                      <div className="flex-1 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2 text-slate-400 mb-1">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Due Date</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900">{formatDate(task.dueDate)}</p>
                      </div>
                      
                      <div className="flex-1 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2 text-slate-400 mb-1">
                          <UsersIcon className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Assigned To</span>
                        </div>
                        <div className="flex -space-x-2 overflow-hidden mt-1">
                          {task.assignedUsers.map((user, idx) => (
                            <div 
                              key={user.id} 
                              className="w-7 h-7 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700"
                              title={user.fullName}
                            >
                              {user.fullName.charAt(0)}
                            </div>
                          ))}
                          {task.assignedUsers.length === 0 && (
                            <span className="text-sm font-medium text-slate-500">None</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center px-4">
                      <button className="p-2 rounded-full bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
                <CheckCircle2 className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">All caught up!</h3>
              <p className="text-slate-500 max-w-sm mx-auto">
                No high priority tasks were found. Take a moment to review other sections of your dashboard.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
