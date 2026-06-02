import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import {
  LayoutDashboard,
  Briefcase,
  CheckSquare,
  Megaphone,
  Users as UsersIcon,
  Calendar,
  RefreshCw,
  LogOut,
  User as UserIcon,
  Menu,
  X,
} from "lucide-react";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !user) {
      navigate("/login/user", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50">
        <div className="flex flex-col gap-4 items-center">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-600 animate-spin border-t-transparent"></div>
          <p className="font-medium text-slate-500">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const navItems = [
    {
      path: "/dashboard",
      label: "Overview",
      icon: LayoutDashboard,
      id: "overview",
    },
    { path: "/project", label: "Projects", icon: Briefcase, id: "project" },
    {
      path: "/tasks",
      label: "Assigned tasks",
      icon: CheckSquare,
      id: "assigned",
    },
    { path: "/mytask", label: "My Tasks", icon: CheckSquare, id: "mytask" },
    {
      path: "/announcements",
      label: "Announcements",
      icon: Megaphone,
      id: "announcements",
    },
    { path: "/users", label: "Users", icon: UsersIcon, id: "users" },
    { path: "/calendar", label: "Calendar", icon: Calendar, id: "calendar" },
    {
      path: "/leaverequests",
      label: "Leave Requests",
      icon: Calendar,
      id: "leaverequests",
    },
    {
      path: "/dateconverter",
      label: "Date Converter",
      icon: RefreshCw,
      id: "dateconverter",
    },
  ];

  const activeSection =
    navItems.find((item) => item.path === location.pathname)?.id || "overview";
  const currentTitle =
    navItems.find((item) => item.path === location.pathname)?.label ||
    "Dashboard";

  const handleLogout = () => {
    const target = user?.role === "admin" ? "/login/admin" : "/login/user";
    logout();
    navigate(target, { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar for Desktop */}
      <aside className="hidden fixed flex-col w-64 h-full bg-white border-r transition-all duration-300 lg:flex border-slate-200">
        <div className="p-6">
          <div className="flex gap-3 items-center mb-8">
            <div className="flex justify-center items-center w-10 h-10 bg-indigo-600 rounded-xl">
              <span className="text-xl font-bold text-white">E</span>
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                EMS
              </h2>
              <p className="text-xs font-medium tracking-wider uppercase text-slate-500">
                Management
              </p>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname === item.path
                    ? "bg-indigo-50 text-indigo-700 shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <item.icon
                  className={`w-5 h-5 ${location.pathname === item.path ? "text-indigo-600" : "text-slate-400"}`}
                />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="p-6 mt-auto border-t border-slate-100 bg-slate-50/50">
          <div className="flex gap-3 items-center mb-4">
            <div className="flex justify-center items-center w-10 h-10 text-indigo-700 bg-indigo-100 rounded-full border-2 border-white shadow-sm">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate text-slate-900">
                {user?.fullName || "Guest"}
              </p>
              <p className="text-xs capitalize text-slate-500">
                {user?.role || "No role"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-100 hover:text-rose-700 transition-all duration-200 shadow-sm group"
          >
            <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex fixed top-0 right-0 left-0 z-50 justify-between items-center px-4 py-3 bg-white border-b lg:hidden border-slate-200">
        <div className="flex gap-3 items-center">
          <div className="flex justify-center items-center w-8 h-8 bg-indigo-600 rounded-lg">
            <span className="text-lg font-bold text-white">E</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">EMS</h2>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-50"
        >
          {isMobileMenuOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-sm lg:hidden bg-slate-900/50"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <aside
            className="flex flex-col w-72 h-full bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pt-20">
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      location.pathname === item.path
                        ? "bg-indigo-50 text-indigo-700 shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <item.icon
                      className={`w-5 h-5 ${location.pathname === item.path ? "text-indigo-600" : "text-slate-400"}`}
                    />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="p-6 mt-auto border-t border-slate-100 bg-slate-50/50">
              <div className="flex gap-3 items-center mb-4">
                <div className="flex justify-center items-center w-10 h-10 text-indigo-700 bg-indigo-100 rounded-full">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {user?.fullName || "Guest"}
                  </p>
                  <p className="text-xs capitalize text-slate-500">
                    {user?.role || "No role"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-rose-600"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-h-screen lg:ml-64">
        <div className="p-4 pt-20 mx-auto max-w-7xl lg:p-8 lg:pt-8">
          <header className="mb-8">
            <div className="flex gap-2 items-center mb-1 text-sm text-slate-500">
              <span>Pages</span>
              <span>/</span>
              <span className="font-medium capitalize text-slate-900">
                {activeSection}
              </span>
            </div>
            <h1 className="text-2xl font-bold lg:text-3xl text-slate-900">
              {currentTitle}
            </h1>
          </header>

          <div className="duration-500 animate-in fade-in slide-in-from-bottom-4">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
