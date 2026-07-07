import React from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { setActiveWorkspaceId } from "../api/axios";
import {
  LayoutDashboard,
  Briefcase,
  CheckSquare,
  Megaphone,
  Users as UsersIcon,
  Calendar,
  LogOut,
  Menu,
  X,
  History,
  Bell,
  ChevronDown,
  Settings,
} from "lucide-react";

import WorkspaceSwitcher from "../components/WorkspaceSwitcher";
import SidebarLink from "../components/SidebarLink";

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

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout, loading, workspace, workspaces, selectWorkspace } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { workspaceId: workspaceIdParam } = useParams<{ workspaceId: string }>();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  const paramWorkspaceId = workspaceIdParam ? Number(workspaceIdParam) : null;
  const isValidParamId = paramWorkspaceId !== null && Number.isInteger(paramWorkspaceId);

  // Every outgoing request is scoped to whatever workspace the URL says, set
  // synchronously during render (not an effect) so it's already correct
  // before any child page's data-fetching effect can fire on this same pass —
  // this is what makes switching workspaces take effect immediately.
  if (isValidParamId) {
    setActiveWorkspaceId(paramWorkspaceId);
  }

  React.useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, navigate]);

  // Keep the display context (workspace name, etc.) in sync with the URL,
  // and bounce away from a workspace id the user isn't actually a member of
  // (stale bookmark, removed membership, ...).
  React.useEffect(() => {
    if (loading || !user || !isValidParamId || workspaces.length === 0) return;

    const targetExists = workspaces.some((w) => w.id === paramWorkspaceId);
    if (!targetExists) {
      const fallback = workspace ?? workspaces[0];
      if (fallback) navigate(`/${fallback.id}/dashboard`, { replace: true });
      return;
    }

    if (workspace?.id !== paramWorkspaceId) {
      selectWorkspace(paramWorkspaceId!);
    }
  }, [loading, user, isValidParamId, paramWorkspaceId, workspaces, workspace, navigate, selectWorkspace]);

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

  if (loading || !isValidParamId) {
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

  const prefix = `/${paramWorkspaceId}`;

  // Combined into a single "Tasks" route and removed "/mytask"
  const navItems = [
    {
      path: `${prefix}/dashboard`,
      label: "Overview",
      icon: LayoutDashboard,
      id: "overview",
    },
    { path: `${prefix}/project`, label: "Projects", icon: Briefcase, id: "project" },
    {
      path: `${prefix}/tasks`,
      label: "Tasks",
      icon: CheckSquare,
      id: "tasks",
    },
    {
      path: `${prefix}/announcements`,
      label: "Announcements",
      icon: Megaphone,
      id: "announcements",
    },
    { path: `${prefix}/users`, label: "Users", icon: UsersIcon, id: "users" },
    { path: `${prefix}/calendar`, label: "Calendar", icon: Calendar, id: "calendar" },
    {
      path: `${prefix}/leaverequests`,
      label: "Leave Requests",
      icon: Calendar,
      id: "leaverequests",
    },
  ];

  const reports = [
    {
      path: `${prefix}/activities`,
      label: "Activity History",
      icon: History,
      id: "activities",
    },
  ];

  const system = [
    {
      path: `${prefix}/settings`,
      label: "Settings",
      icon: Settings,
      id: "settings",
    },
  ];

  const activeSection =
    navItems.find((item) => item.path === location.pathname)?.id ||
    reports.find((item) => item.path === location.pathname)?.id ||
    system.find((item) => item.path === location.pathname)?.id ||
    "overview";
  const currentTitle =
    navItems.find((item) => item.path === location.pathname)?.label ||
    reports.find((item) => item.path === location.pathname)?.label ||
    system.find((item) => item.path === location.pathname)?.label ||
    "Dashboard";
  // Nested project details route (/:workspaceId/project/:id/details) has no
  // exact navItems match, so it falls through to a breadcrumb instead of a title.
  const isProjectDetails = /^\/[^/]+\/project\/[^/]+\/details/.test(location.pathname);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-[#F6F7F9]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-56 bg-slate-900 border-r border-slate-800 flex-col h-screen sticky top-0 flex-shrink-0">
        {/* Brand / Workspace Switcher */}
        <div className="p-3">
          <WorkspaceSwitcher />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 overflow-y-auto">
          <Eyebrow>Operations</Eyebrow>
          <div className="h-1.5" />
          {navItems.map((it) => (
            <SidebarLink key={it.id} to={it.path} icon={it.icon} label={it.label} />
          ))}
          <div className="h-3" />
          <Eyebrow>Reports</Eyebrow>
          <div className="h-1.5" />
          {reports.map((it) => (
            <SidebarLink key={it.id} to={it.path} icon={it.icon} label={it.label} />
          ))}
          <div className="h-3" />
          <Eyebrow>System</Eyebrow>
          <div className="h-1.5" />
          {system.map((it) => (
            <SidebarLink key={it.id} to={it.path} icon={it.icon} label={it.label} />
          ))}
        </nav>

        {/* User footer */}
        <div className="flex items-center gap-3 p-4 border-t border-slate-800">
          <Avatar name={user?.fullName || "Guest"} size={32} dark />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate text-[13px] text-white">
              {user?.fullName || "Guest"}
            </div>
            <div className="text-[11px] text-slate-400 truncate capitalize">
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
          <aside className="fixed inset-y-0 left-0 w-60 bg-slate-900 border-r border-slate-800 flex flex-col z-50 lg:hidden shadow-xl">
            <div className="flex items-center justify-between p-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-[26px] h-[26px] bg-blue-900 rounded flex items-center justify-center text-white font-bold text-[10px]">
                  EM
                </div>
                <span className="font-bold text-[14px] text-white">
                  EMS
                </span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-800 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-3 overflow-y-auto">
              <Eyebrow>Operations</Eyebrow>
              <div className="h-1.5" />
              {navItems.map((it) => (
                <SidebarLink
                  key={it.id}
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
                <SidebarLink
                  key={it.id}
                  to={it.path}
                  icon={it.icon}
                  label={it.label}
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              ))}
              <div className="h-3" />
              <Eyebrow>System</Eyebrow>
              <div className="h-1.5" />
              {system.map((it) => (
                <SidebarLink
                  key={it.id}
                  to={it.path}
                  icon={it.icon}
                  label={it.label}
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              ))}
            </nav>
            <div className="flex items-center gap-3 p-4 border-t border-slate-800">
              <Avatar name={user?.fullName || "Guest"} size={32} dark />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-[13px] text-white">
                  {user?.fullName || "Guest"}
                </div>
                <div className="text-[11px] text-slate-400 truncate capitalize">
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
            {isProjectDetails ? (
              <h1 className="flex gap-1.5 items-center font-semibold leading-tight truncate text-[17px] text-slate-900">
                <Link
                  to={`${prefix}/project`}
                  className="text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Projects
                </Link>
                <span className="text-slate-300">/</span>
                <span>Project Details</span>
              </h1>
            ) : (
              <h1 className="font-semibold leading-tight truncate text-[17px] text-slate-900">
                {currentTitle}
              </h1>
            )}
            <div className="text-[11px] text-slate-500 hidden sm:block truncate">
              {isProjectDetails
                ? "Projects · Details"
                : activeSection === "overview"
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
        <div className="flex-1 overflow-auto no-scrollbar">
          <div
            key={paramWorkspaceId ?? "default"}
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
