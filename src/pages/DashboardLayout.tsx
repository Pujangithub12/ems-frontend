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
  LogOut,
  User as UserIcon,
  Menu,
  X,
  History,
  Bell,
  ChevronDown,
  Settings,
  HelpCircle,
} from "lucide-react";

// Import the new Workspace Switcher component
import WorkspaceSwitcher from "../components/WorkspaceSwitcher";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout, loading, workspace } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!loading && !user) {
      navigate("/login/user", { replace: true });
    }
  }, [loading, user, navigate]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center flex-col gap-4 bg-[#F6F7F9]">
        <div className="w-8 h-8 border-2 rounded-full border-slate-200 border-t-blue-900 animate-spin" />
        <div
          className="text-[12px] text-slate-400 tracking-[0.1em] uppercase"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Loading workspace
        </div>
      </div>
    );
  }

  if (!user) return null;

  // FIXED: Combined into a single "Tasks" route and removed "/mytask"
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
      label: "Tasks",
      icon: CheckSquare,
      id: "tasks",
    },
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
  ];

  const reports = [
    {
      path: "/activities",
      label: "Activity History",
      icon: History,
      id: "activities",
    },
  ];

  const activeSection =
    navItems.find((item) => item.path === location.pathname)?.id ||
    reports.find((item) => item.path === location.pathname)?.id ||
    "overview";
  const currentTitle =
    navItems.find((item) => item.path === location.pathname)?.label ||
    reports.find((item) => item.path === location.pathname)?.label ||
    "Dashboard";

  const handleLogout = () => {
    const target =
      user?.role === "admin" || user?.role === "super_admin"
        ? "/login/admin"
        : "/login/user";
    logout();
    navigate(target, { replace: true });
  };

  const NavButton: React.FC<{
    active: boolean;
    to: string;
    icon: React.ElementType;
    label: string;
    onClick?: () => void;
  }> = ({ active, to, icon: Icon, label, onClick }) => (
    <Link
      to={to}
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 pl-2.5 pr-2.5 py-2 rounded text-left text-[13px] transition-colors ${
        active
          ? "bg-white text-slate-900 font-medium"
          : "text-slate-600 hover:bg-white"
      }`}
    >
      <Icon className="w-3.5 h-3.5 opacity-70" />
      <span>{label}</span>
    </Link>
  );

  const Avatar: React.FC<{ name: string; size?: number; dark?: boolean }> = ({
    name,
    size = 32,
    dark = false,
  }) => (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${
        dark ? "bg-blue-900" : "bg-slate-500"
      }`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F6F7F9]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-56 bg-[#EEF1F5] border-r border-slate-200 flex-col h-screen sticky top-0 flex-shrink-0">
        {/* Brand / Workspace Switcher */}
        <div className="p-3">
          <WorkspaceSwitcher />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 overflow-y-auto">
          <Eyebrow>Operations</Eyebrow>
          <div className="h-1.5" />
          {navItems.map((it) => (
            <NavButton
              key={it.id}
              active={location.pathname === it.path}
              to={it.path}
              icon={it.icon}
              label={it.label}
            />
          ))}
          <div className="h-3" />
          <Eyebrow>Reports</Eyebrow>
          <div className="h-1.5" />
          {reports.map((it) => (
            <NavButton
              key={it.id}
              active={location.pathname === it.path}
              to={it.path}
              icon={it.icon}
              label={it.label}
            />
          ))}
        </nav>

        {/* User footer */}
        <div className="flex items-center gap-3 p-4 border-t border-slate-200">
          <Avatar name={user?.fullName || "Guest"} size={32} dark />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate text-[13px] text-slate-900">
              {user?.fullName || "Guest"}
            </div>
            <div className="text-[11px] text-slate-500 truncate capitalize">
              {user?.role || "No role"}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {isMobileMenuOpen && (
        <>
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/45 lg:hidden"
          />
          <aside className="fixed inset-y-0 left-0 w-60 bg-[#EEF1F5] border-r border-slate-200 flex flex-col z-50 lg:hidden shadow-xl">
            <div className="flex items-center justify-between p-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-[26px] h-[26px] bg-blue-900 rounded flex items-center justify-center text-white font-bold text-[10px]">
                  EM
                </div>
                <span className="font-bold text-[14px] text-slate-900">
                  EMS
                </span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:bg-slate-200/60 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-3 overflow-y-auto">
              <Eyebrow>Operations</Eyebrow>
              <div className="h-1.5" />
              {navItems.map((it) => (
                <NavButton
                  key={it.id}
                  active={location.pathname === it.path}
                  to={it.path}
                  icon={it.icon}
                  label={it.label}
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              ))}
              <div className="h-3" />
              <Eyebrow>Reports</Eyebrow>
              <div className="h-1.5" />
              {reports.map((it) => (
                <NavButton
                  key={it.id}
                  active={location.pathname === it.path}
                  to={it.path}
                  icon={it.icon}
                  label={it.label}
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              ))}
            </nav>
            <div className="flex items-center gap-3 p-4 border-t border-slate-200">
              <Avatar name={user?.fullName || "Guest"} size={32} dark />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-[13px] text-slate-900">
                  {user?.fullName || "Guest"}
                </div>
                <div className="text-[11px] text-slate-500 truncate capitalize">
                  {user?.role || "No role"}
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex items-center flex-shrink-0 h-16 gap-4 px-6 bg-white border-b border-slate-200">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-1.5 rounded text-slate-600 hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h1 className="font-semibold leading-tight truncate text-[17px] text-slate-900">
              {currentTitle}
            </h1>
            <div className="text-[11px] text-slate-500 hidden sm:block truncate">
              {activeSection === "overview"
                ? "EMS Workspace · Management"
                : currentTitle}
            </div>
          </div>

          {/* Space */}
          <div className="relative hidden ml-auto md:block"></div>

          {/* Notifications */}
          <button className="relative p-2 rounded hover:bg-slate-100 text-slate-600">
            <Bell className="w-4 h-4" />
            <span className="absolute w-[7px] h-[7px] rounded-full bg-red-700 top-[7px] right-[7px] border-[1.5px] border-white" />
          </button>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded p-1.5 pr-2 hover:bg-slate-100"
            >
              <Avatar name={user?.fullName || "Guest"} size={28} dark />
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-[calc(100% + 6px)] bg-white rounded border border-slate-200 w-64 z-50 shadow-lg">
                <div className="px-4 py-3 flex items-center gap-2.5 border-b border-slate-200">
                  <Avatar name={user?.fullName || "Guest"} size={36} dark />
                  <div className="min-w-0">
                    <div className="font-semibold truncate text-[13px] text-slate-900">
                      {user?.fullName}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate capitalize">
                      {user?.role}
                    </div>
                    <div
                      className="text-[10px] text-slate-500 truncate"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {user?.email}
                    </div>
                  </div>
                </div>
                <div className="py-1">
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-100">
                    <UserIcon className="w-3.5 h-3.5 opacity-70" />
                    My profile
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-100">
                    <Bell className="w-3.5 h-3.5 opacity-70" />
                    Notification settings
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-100">
                    <Settings className="w-3.5 h-3.5 opacity-70" />
                    Settings
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-100">
                    <HelpCircle className="w-3.5 h-3.5 opacity-70" />
                    Help & support
                  </button>
                </div>
                <div className="py-1 border-t border-slate-200">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left text-[13px] text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="w-3.5 h-3.5 opacity-70" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          <div
            key={workspace?.id || "default"}
            className="duration-300 animate-in fade-in slide-in-from-bottom-2"
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
