import React, { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate, Outlet, useParams } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./features/auth/pages/Login";
import DashboardLayout from "./layout/DashboardLayout";
import { AuthProvider, useAuth } from "./context/AuthProvider";
import { NotificationSocketProvider } from "./context/NotificationSocketProvider";
import AccessForbiddenModal from "./components/AccessForbiddenModal";
import { setAccessForbiddenHandler } from "./api/axios";

// Everything below is route-only — lazy-loaded so a first visit (almost
// always Login, then one dashboard page) doesn't have to download every
// other page's code up front. Home/Login/DashboardLayout stay eager above
// since they're on the critical path for every session.
const CreateAccount = lazy(() => import("./features/auth/pages/CreateAccount"));
const ForgotPassword = lazy(() => import("./features/auth/pages/ForgotPassword"));
const AcceptInvite = lazy(() => import("./features/auth/pages/AcceptInvite"));
const Dashboard = lazy(() => import("./features/dashboard/pages/Dashboard"));
const Announcements = lazy(() => import("./features/announcements/pages/Announcements"));
const Documents = lazy(() => import("./features/documents/pages/Documents"));
const Inventory = lazy(() => import("./features/inventory/pages/Inventory"));
const PurchaseRequests = lazy(() => import("./features/procurement/pages/PurchaseRequests"));
const PurchaseOrders = lazy(() => import("./features/procurement/pages/PurchaseOrders"));
const PurchaseOrderDetail = lazy(() => import("./features/procurement/pages/PurchaseOrderDetail"));
const ProformaInvoices = lazy(() => import("./features/procurement/pages/ProformaInvoices"));
const Vendors = lazy(() => import("./features/procurement/pages/Vendors"));
const Users = lazy(() => import("./features/users/pages/Users"));
const ProjectPage = lazy(() => import("./features/projects/pages/Projects"));
const ProjectDetails = lazy(() => import("./features/projects/pages/ProjectDetails"));
const CalendarPage = lazy(() => import("./features/calendar/pages/Calendar"));
const Approvals = lazy(() => import("./features/approvals/pages/Approvals"));
const Reports = lazy(() => import("./features/reports/pages/Reports"));
const Settings = lazy(() => import("./features/settings/pages/Settings"));
const Profile = lazy(() => import("./features/users/pages/Profile"));
const TasksPage = lazy(() => import("./features/tasks/pages/Tasks"));
const PlantReport = lazy(() => import("./features/plantReport/pages/PlantReport"));

/** Minimal, layout-agnostic loading state for a lazy route chunk still
 * downloading — intentionally plain since it can appear both inside
 * DashboardLayout and standalone (e.g. AcceptInvite, CreateAccount). */
const RouteFallback: React.FC = () => (
  <div className="flex items-center justify-center w-full h-screen">
    <div className="w-6 h-6 border-2 rounded-full border-slate-200 border-t-blue-900 animate-spin" />
  </div>
);

/** Same spinner, but sized to sit inside the content area instead of the
 * full viewport — used by the persistent dashboard layout route below so a
 * still-loading page chunk doesn't blank out the sidebar/header with it. */
const ContentFallback: React.FC = () => (
  <div className="flex items-center justify-center w-full h-full py-24">
    <div className="w-6 h-6 border-2 rounded-full border-slate-200 border-t-blue-900 animate-spin" />
  </div>
);

/**
 * Pathless "layout route" — mounted once and kept alive across every
 * /:organizationId/* navigation via <Outlet/>, instead of each route
 * wrapping its own fresh <DashboardLayout> instance. That old per-route
 * wrapping remounted the entire sidebar/header on every navigation (losing
 * open menus, and — once page chunks were lazy-loaded — flashing the whole
 * screen to a loading spinner instead of just the content area). The inner
 * Suspense here is scoped to just the routed page, so only the content area
 * shows a brief spinner while its chunk loads.
 */
const DashboardLayoutRoute: React.FC = () => (
  <DashboardLayout>
    <Suspense fallback={<ContentFallback />}>
      <Outlet />
    </Suspense>
  </DashboardLayout>
);

/** Mounted once near the app root — registers with the axios response
 * interceptor so a WORKSPACE_ACCESS_FORBIDDEN error from anywhere in the app
 * (a blocked organization switch/create attempt) surfaces this modal. */
const GlobalAccessForbiddenModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setAccessForbiddenHandler(() => setIsOpen(true));
    return () => setAccessForbiddenHandler(null);
  }, []);

  return <AccessForbiddenModal isOpen={isOpen} onClose={() => setIsOpen(false)} />;
};

/**
 * Resolves "/" and any unmatched path to the caller's current organization —
 * the URL (not a shared cookie) is the source of truth for which organization
 * is active, so every real page lives under /:organizationId/...
 */
const RootRedirect: React.FC = () => {
  const { user, organization, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate replace to="/login" />;
  if (organization) return <Navigate replace to={`/${organization.id}/dashboard`} />;
  return null;
};

/**
 * Purchase Orders and Vendors are admin/super_admin-only pages (any employee can raise a
 * Purchase Request, but browsing PO/vendor pricing is admin territory) — bounces anyone else
 * back to Purchase Requests. Mirrors RootRedirect's loading/no-user handling.
 */
const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const { organizationId } = useParams<{ organizationId: string }>();

  if (loading) return null;
  if (!user) return <Navigate replace to="/login" />;
  if (user.role !== "admin" && user.role !== "super_admin") {
    return <Navigate replace to={`/${organizationId}/purchase-requests`} />;
  }
  return <>{children}</>;
};

/**
 * "/" specifically: logged-out visitors see the public marketing home page;
 * logged-in users still fall through to their organization dashboard. Unmatched
 * paths (the "*" route) keep using RootRedirect's straight-to-login behavior.
 */
const RootPage: React.FC = () => {
  const { user, organization, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Home />;
  if (organization) return <Navigate replace to={`/${organization.id}/dashboard`} />;
  return null;
};

function App() {
  return (
    <AuthProvider>
      <NotificationSocketProvider>
      <div className="min-h-screen font-sans bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
        <GlobalAccessForbiddenModal />
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<RootPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<CreateAccount />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/login/user" element={<Navigate replace to="/login" />} />
          <Route path="/login/admin" element={<Navigate replace to="/login" />} />

          <Route element={<DashboardLayoutRoute />}>
            <Route path="/:organizationId/dashboard" element={<Dashboard />} />
            <Route path="/:organizationId/tasks" element={<TasksPage />} />
            <Route path="/:organizationId/project" element={<ProjectPage />} />
            <Route path="/:organizationId/project/:id/details" element={<ProjectDetails />} />
            <Route path="/:organizationId/announcements" element={<Announcements />} />
            <Route path="/:organizationId/documents" element={<Documents />} />
            <Route path="/:organizationId/inventory" element={<Inventory />} />
            <Route path="/:organizationId/purchase-requests" element={<PurchaseRequests />} />
            <Route
              path="/:organizationId/purchase-orders"
              element={
                <RequireAdmin>
                  <PurchaseOrders />
                </RequireAdmin>
              }
            />
            <Route
              path="/:organizationId/purchase-orders/:id"
              element={
                <RequireAdmin>
                  <PurchaseOrderDetail />
                </RequireAdmin>
              }
            />
            <Route
              path="/:organizationId/proforma-invoices"
              element={
                <RequireAdmin>
                  <ProformaInvoices />
                </RequireAdmin>
              }
            />
            <Route
              path="/:organizationId/vendors"
              element={
                <RequireAdmin>
                  <Vendors />
                </RequireAdmin>
              }
            />
            <Route path="/:organizationId/task" element={<TasksPage />} />
            <Route path="/:organizationId/plant-report" element={<PlantReport />} />
            <Route path="/:organizationId/users" element={<Users />} />
            <Route path="/:organizationId/calendar" element={<CalendarPage />} />
            <Route path="/:organizationId/leaverequests" element={<Approvals />} />
            <Route path="/:organizationId/reports" element={<Reports />} />
            <Route path="/:organizationId/settings" element={<Settings />} />
            <Route path="/:organizationId/profile" element={<Profile />} />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
        </Suspense>
      </div>
      </NotificationSocketProvider>
    </AuthProvider>
  );
}

export default App;
