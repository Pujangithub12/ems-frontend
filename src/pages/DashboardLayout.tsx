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
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 fixed h-full transition-all duration-300">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">E</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                EMS
              </h2>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
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

        <div className="mt-auto p-6 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 border-2 border-white shadow-sm">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {user?.name || "Guest"}
              </p>
              <p className="text-xs text-slate-500 capitalize">
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">E</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">EMS</h2>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg"
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
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <aside
            className="w-72 h-full bg-white flex flex-col"
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
            <div className="mt-auto p-6 border-t border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {user?.name || "Guest"}
                  </p>
                  <p className="text-xs text-slate-500 capitalize">
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
      <main className="flex-1 lg:ml-64 min-h-screen">
        <div className="p-4 lg:p-8 pt-20 lg:pt-8 max-w-7xl mx-auto">
          <header className="mb-8">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <span>Pages</span>
              <span>/</span>
              <span className="text-slate-900 font-medium capitalize">
                {activeSection}
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
              {currentTitle}
            </h1>
          </header>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
