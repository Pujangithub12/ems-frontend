import React from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { setActiveOrganizationId } from "../api/axios";
import {
  LayoutDashboard,
  Briefcase,
  CheckSquare,
  Megaphone,
  Users as UsersIcon,
  FolderOpen,
  Package,
  ShoppingCart,
  Calendar,
  ClipboardCheck,
  LogOut,
  Menu,
  X,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Settings,
  RefreshCcw,
  User as UserRoundIcon,
  UserPlus,
  Truck,
  Building2,
  FileText,
  BellOff,
  Factory,
} from "lucide-react";

import SwitchOrganizationModal from "../components/SwitchOrganizationModal";
import NotificationBell from "../components/NotificationBell";
import NotificationSettingsPanel from "../components/NotificationSettingsPanel";
import { useNotificationMute } from "../features/notifications/hooks/useNotificationMute";
import SidebarLink from "../components/SidebarLink";
import SidebarDropdown from "../components/SidebarDropdown";
import { useLeaveRequests } from "../features/approvals/hooks/useLeaveRequests";
import { useSiteVisitRequests } from "../features/approvals/hooks/useSiteVisitRequests";
import { useExpenseRequests } from "../features/approvals/hooks/useExpenseRequests";
import { useHierarchy } from "../features/hierarchy/hooks/useHierarchy";
import { useTasks } from "../features/tasks/hooks/useTasks";
import { useAnnouncements } from "../features/announcements/hooks/useAnnouncements";
import { canApprove as hierarchyCanApprove } from "../lib/hierarchyAuthority";
import { useSidebarBadgeSeen } from "../hooks/useSidebarBadgeSeen";

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
  const { user, logout, loading, organization, organizations, selectOrganization } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { organizationId: organizationIdParam } = useParams<{ organizationId: string }>();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = React.useState(false);
  const [showSwitchOrganizationModal, setShowSwitchOrganizationModal] =
    React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const { isMuted: notificationsMuted } = useNotificationMute();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const paramOrganizationId = organizationIdParam ? Number(organizationIdParam) : null;
  const isValidParamId = paramOrganizationId !== null && Number.isInteger(paramOrganizationId);

  // Every outgoing request is scoped to whatever organization the URL says, set
  // synchronously during render (not an effect) so it's already correct
  // before any child page's data-fetching effect can fire on this same pass —
  // this is what makes switching organizations take effect immediately.
  if (isValidParamId) {
    setActiveOrganizationId(paramOrganizationId);
  }

  React.useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, navigate]);

  // Keep the display context (organization name, etc.) in sync with the URL,
  // and bounce away from an organization id the user isn't actually a member of
  // (stale bookmark, removed membership, ...).
  React.useEffect(() => {
    if (loading || !user || !isValidParamId || organizations.length === 0) return;

    const targetExists = organizations.some((w) => w.id === paramOrganizationId);
    if (!targetExists) {
      const fallback = organization ?? organizations[0];
      if (fallback) navigate(`/${fallback.id}/dashboard`, { replace: true });
      return;
    }

    if (organization?.id !== paramOrganizationId) {
      selectOrganization(paramOrganizationId!);
    }
  }, [loading, user, isValidParamId, paramOrganizationId, organizations, organization, navigate, selectOrganization]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
        setNotificationSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sidebar badge counts — "pending/open items" for the caller right now,
  // not a true unread-since-last-visit tracker (this app has no per-user
  // read-state anywhere yet). Called unconditionally (before the loading
  // early-return below) to keep hook order stable.
  const { data: hierarchyPeople = [] } = useHierarchy();
  const { data: leaveRequests = [] } = useLeaveRequests();
  const { data: siteVisitRequests = [] } = useSiteVisitRequests();
  const { data: expenseRequests = [] } = useExpenseRequests();
  const { data: allTasks = [] } = useTasks();
  const { data: allAnnouncements = [] } = useAnnouncements();

  const currentUserId = user?.id ? Number(user.id) : null;
  const currentUserRole = user?.role || "";

  const approvalsBadgeCount = React.useMemo(() => {
    if (!currentUserId) return 0;
    const canManage = {
      leave: currentUserRole === "admin" || currentUserRole === "super_admin",
      sitevisit: currentUserRole === "admin" || currentUserRole === "super_admin",
      expense:
        currentUserRole === "admin" ||
        currentUserRole === "super_admin" ||
        currentUserRole === "finance",
    };
    const canActOn = (type: "leave" | "sitevisit" | "expense", requesterUserId?: number) => {
      if (!canManage[type] || requesterUserId == null) return false;
      if (type === "expense" && currentUserRole === "finance") return true;
      if (currentUserRole === "super_admin") return true;
      return hierarchyCanApprove(hierarchyPeople, currentUserId, currentUserRole, requesterUserId);
    };

    const pending: Array<{ type: "leave" | "sitevisit" | "expense"; userId?: number }> = [
      ...leaveRequests
        .filter((r) => r.status === "pending")
        .map((r) => ({ type: "leave" as const, userId: r.user?.id })),
      ...siteVisitRequests
        .filter((r) => r.status === "pending")
        .map((r) => ({ type: "sitevisit" as const, userId: r.user?.id })),
      ...expenseRequests
        .filter((r) => r.status === "pending")
        .map((r) => ({ type: "expense" as const, userId: r.user?.id })),
    ];

    const actionable = pending.filter((r) => canActOn(r.type, r.userId)).length;
    if (actionable > 0) return actionable;

    // Not an approver for anyone right now — fall back to "my own requests
    // still awaiting approval" so the badge stays meaningful for regular employees.
    return pending.filter((r) => r.userId === currentUserId).length;
  }, [currentUserId, currentUserRole, hierarchyPeople, leaveRequests, siteVisitRequests, expenseRequests]);

  const tasksBadgeCount = React.useMemo(() => {
    if (!currentUserId) return 0;
    return allTasks.filter(
      (t) => t.status !== "completed" && t.assignedUsers?.some((u) => u.id === currentUserId),
    ).length;
  }, [allTasks, currentUserId]);

  const announcementsBadgeCount = React.useMemo(() => {
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - THREE_DAYS_MS;
    return allAnnouncements.filter((a) => new Date(a.createdAt).getTime() >= cutoff).length;
  }, [allAnnouncements]);

  // Clears the sidebar red dot once the caller has actually viewed the
  // Announcements/Approvals page — it reappears if the live count grows
  // again after that visit (e.g. a new pending request comes in).
  const isOnAnnouncementsPage = location.pathname === `/${paramOrganizationId}/announcements`;
  const isOnApprovalsPage = location.pathname === `/${paramOrganizationId}/approvals`;
  const visibleAnnouncementsBadgeCount = useSidebarBadgeSeen(
    "announcements",
    paramOrganizationId,
    currentUserId,
    isOnAnnouncementsPage,
    announcementsBadgeCount,
  );
  const visibleApprovalsBadgeCount = useSidebarBadgeSeen(
    "approvals",
    paramOrganizationId,
    currentUserId,
    isOnApprovalsPage,
    approvalsBadgeCount,
  );

  if (loading || !isValidParamId) {
    return (
      <div className="fixed inset-0 flex items-center justify-center flex-col gap-4 bg-[#F6F7F9]">
        <div className="w-8 h-8 border-2 rounded-full border-slate-200 border-t-blue-900 animate-spin" />
        <div
          className="text-[12px] text-slate-400 tracking-[0.1em] uppercase"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Loading organization
        </div>
      </div>
    );
  }

  if (!user) return null;

  const prefix = `/${paramOrganizationId}`;

  // Combined into a single "Tasks" route and removed "/mytask"
  const navItems = [
    {
      path: `${prefix}/dashboard`,
      label: "Overview",
      icon: LayoutDashboard,
      id: "overview",
    },
    {
      path: `${prefix}/project`,
      label: "Projects",
      icon: Briefcase,
      id: "project",
    },
    {
      path: `${prefix}/documents`,
      label: "Documents",
      icon: FolderOpen,
      id: "documents",
    },
    {
      path: `${prefix}/inventory`,
      label: "Inventory",
      icon: Package,
      id: "inventory",
    },
    {
      path: `${prefix}/purchase-requests`,
      label: "Purchase Requests",
      icon: ShoppingCart,
      id: "procurement",
    },
    {
      path: `${prefix}/purchase-orders`,
      label: "Purchase Orders",
      icon: Truck,
      id: "purchase-orders",
    },
    {
      path: `${prefix}/vendors`,
      label: "Vendors",
      icon: Building2,
      id: "vendors",
    },
    {
      path: `${prefix}/proforma-invoices`,
      label: "Proforma Invoices",
      icon: FileText,
      id: "proforma-invoices",
    },
    {
      path: `${prefix}/tasks`,
      label: "Tasks",
      icon: CheckSquare,
      id: "tasks",
      badgeCount: tasksBadgeCount,
    },
    {
      path: `${prefix}/announcements`,
      label: "Announcements",
      icon: Megaphone,
      id: "announcements",
      badgeCount: visibleAnnouncementsBadgeCount,
    },
    { path: `${prefix}/calendar`, label: "Calendar", icon: Calendar, id: "calendar" },
    {
      path: `${prefix}/approvals`,
      label: "Approvals",
      icon: ClipboardCheck,
      id: "approvals",
      badgeCount: visibleApprovalsBadgeCount,
    },
  ];

  const reports = [
    {
      path: `${prefix}/reports`,
      label: "Reports",
      icon: BarChart3,
      id: "reports",
    },
    {
      path: `${prefix}/plant-report`,
      label: "Plant Report",
      icon: Factory,
      id: "plant-report",
    },
  ];

  const system = [
    {
      path: `${prefix}/users`,
      label: "People",
      icon: UsersIcon,
      id: "users",
    },
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
  // Nested project details route (/:organizationId/project/:id/details) has no
  // exact navItems match, so it falls through to a breadcrumb instead of a title.
  const isProjectDetails = /^\/[^/]+\/project\/[^/]+\/details/.test(location.pathname);

  // One-line blurb shown under the page title in the topbar — previously just
  // repeated currentTitle verbatim (e.g. "Tasks" under "Tasks").
  const sectionDescriptions: Record<string, string> = {
    project: "Track and manage all your projects",
    documents: "Browse and manage organization files",
    inventory: "Stock items across all your projects",
    "plant-report": "Daily boiler/plant operations log and monthly summary",
    procurement: "Purchase requests across all your projects",
    "purchase-orders": "Purchase orders across all your projects",
    vendors: "Suppliers and vendors across all your projects",
    "proforma-invoices": "Proforma invoices across all your purchase orders",
    tasks: "Assign, track and update tasks",
    announcements: "Company-wide updates and notices",
    calendar: "Events, deadlines and schedules",
    approvals: "Review and approve requests",
    reports: "Inventory & procurement analytics",
    users: "Manage people and permissions",
    settings: "Organization configuration and preferences",
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-[#F6F7F9]">
      {/* Desktop Sidebar */}
      <aside className="sticky top-0 flex-col flex-shrink-0 hidden w-56 h-screen border-r shadow-2xl lg:flex bg-slate-900 border-slate-800 z-20">
        {/* Brand / Current Organization */}
        <div className="p-3 border-b border-slate-800">
          <div className="flex items-center w-full gap-2.5 px-2.5 py-2.5">
            <div className="w-[26px] h-[26px] bg-blue-900 rounded-lg shadow-sm ring-1 ring-white/10 flex items-center justify-center text-white font-bold text-[10px] tracking-[0.05em] flex-shrink-0">
              {organization?.name.charAt(0).toUpperCase() || "EM"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold tracking-tight leading-tight truncate text-[14px] text-white">
                {organization?.name || "EMS Organization"}
              </div>
              <div
                className="text-[10px] text-slate-400 tracking-[0.08em] uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Management
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-3 overflow-y-auto">
          <Eyebrow className="pl-2.5">Operations</Eyebrow>
          <div className="h-1.5" />
          <div className="flex flex-col gap-0.5">
            {navItems.map((it) => {
              if (it.id === "purchase-orders" || it.id === "vendors" || it.id === "proforma-invoices") return null;
              if (it.id === "procurement") {
                if (!isAdmin) {
                  return (
                    <SidebarLink
                      key={it.id}
                      to={it.path}
                      icon={it.icon}
                      label={it.label}
                      badgeCount={it.badgeCount}
                    />
                  );
                }
                const purchaseOrders = navItems.find((n) => n.id === "purchase-orders")!;
                const vendorsItem = navItems.find((n) => n.id === "vendors")!;
                const proformaInvoicesItem = navItems.find((n) => n.id === "proforma-invoices")!;
                return (
                  <SidebarDropdown
                    key="purchase"
                    icon={ShoppingCart}
                    label="Procurement"
                    items={[
                      { to: it.path, label: "Purchase Requests" },
                      { to: purchaseOrders.path, label: "Purchase Orders" },
                      { to: proformaInvoicesItem.path, label: "Proforma Invoices" },
                      { to: vendorsItem.path, label: "Vendors" },
                    ]}
                  />
                );
              }
              return (
                <SidebarLink
                  key={it.id}
                  to={it.path}
                  icon={it.icon}
                  label={it.label}
                  badgeCount={it.badgeCount}
                />
              );
            })}
          </div>
          <div className="h-3" />
          <Eyebrow className="pl-2.5">Reports</Eyebrow>
          <div className="h-1.5" />
          <div className="flex flex-col gap-0.5 pb-3">
            {reports.map((it) => (
              <SidebarLink key={it.id} to={it.path} icon={it.icon} label={it.label} />
            ))}
          </div>
        </nav>
      </aside>

      {/* Mobile sidebar */}
      {isMobileMenuOpen && (
        <>
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/45 lg:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex flex-col border-r shadow-2xl w-60 bg-slate-900 border-slate-800 lg:hidden">
            <div className="flex items-center justify-between p-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-[26px] h-[26px] bg-blue-900 rounded-lg shadow-sm ring-1 ring-white/10 flex items-center justify-center text-white font-bold text-[10px]">
                  EM
                </div>
                <span className="font-bold text-[14px] text-white">
                  EMS
                </span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:bg-white/5 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-3 overflow-y-auto">
              <Eyebrow className="pl-2.5">Operations</Eyebrow>
              <div className="h-1.5" />
              <div className="flex flex-col gap-0.5">
                {navItems.map((it) => {
                  if (it.id === "purchase-orders" || it.id === "vendors" || it.id === "proforma-invoices") return null;
                  if (it.id === "procurement") {
                    if (!isAdmin) {
                      return (
                        <SidebarLink
                          key={it.id}
                          to={it.path}
                          icon={it.icon}
                          label={it.label}
                          badgeCount={it.badgeCount}
                          onClick={() => setIsMobileMenuOpen(false)}
                        />
                      );
                    }
                    const purchaseOrders = navItems.find((n) => n.id === "purchase-orders")!;
                    const vendorsItem = navItems.find((n) => n.id === "vendors")!;
                    const proformaInvoicesItem = navItems.find((n) => n.id === "proforma-invoices")!;
                    return (
                      <SidebarDropdown
                        key="purchase"
                        icon={ShoppingCart}
                        label="Procurement"
                        items={[
                          { to: it.path, label: "Purchase Requests" },
                          { to: purchaseOrders.path, label: "Purchase Orders" },
                          { to: proformaInvoicesItem.path, label: "Proforma Invoices" },
                          { to: vendorsItem.path, label: "Vendors" },
                        ]}
                        onNavigate={() => setIsMobileMenuOpen(false)}
                      />
                    );
                  }
                  return (
                    <SidebarLink
                      key={it.id}
                      to={it.path}
                      icon={it.icon}
                      label={it.label}
                      badgeCount={it.badgeCount}
                      onClick={() => setIsMobileMenuOpen(false)}
                    />
                  );
                })}
              </div>
              <div className="h-3" />
              <Eyebrow className="pl-2.5">Reports</Eyebrow>
              <div className="h-1.5" />
              <div className="flex flex-col gap-0.5">
                {reports.map((it) => (
                  <SidebarLink
                    key={it.id}
                    to={it.path}
                    icon={it.icon}
                    label={it.label}
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                ))}
              </div>
            </nav>
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex items-center flex-shrink-0 h-16 gap-4 px-6 bg-white border-b border-slate-200 shadow-sm z-30">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            {isProjectDetails ? (
              <h1 className="flex gap-1.5 items-center font-semibold leading-tight truncate text-[17px] text-slate-900">
                <Link
                  to={`${prefix}/project`}
                  className="transition-colors text-slate-500 hover:text-slate-700"
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
                  ? "EMS Organization · Management"
                  : sectionDescriptions[activeSection] || currentTitle}
            </div>
          </div>

          {/* Space */}
          <div className="relative hidden ml-auto md:block"></div>

          {/* Notifications */}
          <NotificationBell />

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg p-1.5 pr-2 hover:bg-slate-100"
            >
              <Avatar name={user?.fullName || "Guest"} size={28} dark />
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] bg-white rounded-xl border border-slate-200/70 w-64 z-50 shadow-2xl overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-2.5 border-b border-slate-200 bg-slate-50/60">
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
                <div className="py-1.5">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate(`${prefix}/profile`);
                    }}
                    className="w-[calc(100%-12px)] mx-1.5 mb-0.5 flex items-center gap-3 px-2.5 py-2 text-left text-[13px] text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <UserRoundIcon className="w-3.5 h-3.5 opacity-70" />
                    My Profile
                  </button>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate(`${prefix}/users`);
                    }}
                    className="w-[calc(100%-12px)] mx-1.5 mb-0.5 flex items-center gap-3 px-2.5 py-2 text-left text-[13px] text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <UsersIcon className="w-3.5 h-3.5 opacity-70" />
                    People
                  </button>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate(`${prefix}/settings`);
                    }}
                    className="w-[calc(100%-12px)] mx-1.5 mb-0.5 flex items-center gap-3 px-2.5 py-2 text-left text-[13px] text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 opacity-70" />
                    Settings
                  </button>
                  {(user?.role === "admin" || user?.role === "super_admin") && (
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate(`${prefix}/users`, { state: { openInvite: true } });
                      }}
                      className="w-[calc(100%-12px)] mx-1.5 mb-0.5 flex items-center gap-3 px-2.5 py-2 text-left text-[13px] text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5 opacity-70" />
                      Invite Members
                    </button>
                  )}
                  <button
                    onClick={() => setNotificationSettingsOpen((o) => !o)}
                    className="w-[calc(100%-12px)] mx-1.5 mb-0.5 flex items-center gap-3 px-2.5 py-2 text-left text-[13px] text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <BellOff className="w-3.5 h-3.5 opacity-70" />
                    Notification Settings
                    <span className="ml-auto flex items-center gap-1.5">
                      {notificationsMuted && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                          Muted
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setShowSwitchOrganizationModal(true);
                    }}
                    className="w-[calc(100%-12px)] mx-1.5 mb-0.5 flex items-center gap-3 px-2.5 py-2 text-left text-[13px] text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCcw className="w-3.5 h-3.5 opacity-70" />
                    Switch organization
                  </button>
                  <div className="mt-1 pt-1 border-t border-slate-100">
                    <button
                      onClick={handleLogout}
                      className="w-[calc(100%-12px)] mx-1.5 flex items-center gap-3 px-2.5 py-2 text-left text-[13px] text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5 opacity-70" />
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            )}
            {notificationSettingsOpen && (
              <div className="absolute right-[272px] top-[calc(100%+8px)] z-50">
                <NotificationSettingsPanel onClose={() => setNotificationSettingsOpen(false)} />
              </div>
            )}
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto no-scrollbar">
          <div
            key={paramOrganizationId ?? "default"}
            className="duration-300 animate-in fade-in slide-in-from-bottom-2"
          >
            {children}
          </div>
        </div>
      </main>

      <SwitchOrganizationModal
        isOpen={showSwitchOrganizationModal}
        onClose={() => setShowSwitchOrganizationModal(false)}
      />
    </div>
  );
};

export default DashboardLayout;
