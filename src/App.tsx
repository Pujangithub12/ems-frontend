import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./features/auth/pages/Login";
import CreateAccount from "./features/auth/pages/CreateAccount";
import ForgotPassword from "./features/auth/pages/ForgotPassword";
import AcceptInvite from "./features/auth/pages/AcceptInvite";
import Dashboard from "./features/dashboard/pages/Dashboard";
import Announcements from "./features/announcements/pages/Announcements";
import Documents from "./features/documents/pages/Documents";
import Inventory from "./features/inventory/pages/Inventory";
import PurchaseRequests from "./features/procurement/pages/PurchaseRequests";
import PurchaseOrders from "./features/procurement/pages/PurchaseOrders";
import PurchaseOrderDetail from "./features/procurement/pages/PurchaseOrderDetail";
import Vendors from "./features/procurement/pages/Vendors";
import Users from "./features/users/pages/Users";
import ProjectPage from "./features/projects/pages/Projects";
import ProjectDetails from "./features/projects/pages/ProjectDetails";
import CalendarPage from "./features/calendar/pages/Calendar";
import Approvals from "./features/approvals/pages/Approvals";
import Reports from "./features/reports/pages/Reports";
import Settings from "./features/settings/pages/Settings";
import Profile from "./features/users/pages/Profile";
import DashboardLayout from "./layout/DashboardLayout";
import { AuthProvider, useAuth } from "./context/AuthProvider";
import TasksPage from "./features/tasks/pages/Tasks";
import AccessForbiddenModal from "./components/AccessForbiddenModal";
import { setAccessForbiddenHandler } from "./api/axios";

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
      <div className="min-h-screen font-sans bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
        <GlobalAccessForbiddenModal />
        <Routes>
          <Route path="/" element={<RootPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<CreateAccount />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/login/user" element={<Navigate replace to="/login" />} />
          <Route path="/login/admin" element={<Navigate replace to="/login" />} />

          <Route
            path="/:organizationId/dashboard"
            element={
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            }
          />
          <Route
            path="/:organizationId/tasks"
            element={
              <DashboardLayout>
                <TasksPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/:organizationId/project"
            element={
              <DashboardLayout>
                <ProjectPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/:organizationId/project/:id/details"
            element={
              <DashboardLayout>
                <ProjectDetails />
              </DashboardLayout>
            }
          />
          <Route
            path="/:organizationId/announcements"
            element={
              <DashboardLayout>
                <Announcements />
              </DashboardLayout>
            }
          />
          <Route
            path="/:organizationId/documents"
            element={
              <DashboardLayout>
                <Documents />
              </DashboardLayout>
            }
          />
          <Route
            path="/:organizationId/inventory"
            element={
              <DashboardLayout>
                <Inventory />
              </DashboardLayout>
            }
          />
          <Route
            path="/:organizationId/purchase-requests"
            element={
              <DashboardLayout>
                <PurchaseRequests />
              </DashboardLayout>
            }
          />
          <Route
            path="/:organizationId/purchase-orders"
            element={
              <RequireAdmin>
                <DashboardLayout>
                  <PurchaseOrders />
                </DashboardLayout>
              </RequireAdmin>
            }
          />
          <Route
            path="/:organizationId/purchase-orders/:id"
            element={
              <RequireAdmin>
                <DashboardLayout>
                  <PurchaseOrderDetail />
                </DashboardLayout>
              </RequireAdmin>
            }
          />
          <Route
            path="/:organizationId/vendors"
            element={
              <RequireAdmin>
                <DashboardLayout>
                  <Vendors />
                </DashboardLayout>
              </RequireAdmin>
            }
          />
          <Route
            path="/:organizationId/task"
            element={
              <DashboardLayout>
                <TasksPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/:organizationId/users"
            element={
              <DashboardLayout>
                <Users />
              </DashboardLayout>
            }
          />
          <Route
            path="/:organizationId/calendar"
            element={
              <DashboardLayout>
                <CalendarPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/:organizationId/leaverequests"
            element={
              <DashboardLayout>
                <Approvals />
              </DashboardLayout>
            }
          />
          <Route
            path="/:organizationId/reports"
            element={
              <DashboardLayout>
                <Reports />
              </DashboardLayout>
            }
          />
          <Route
            path="/:organizationId/settings"
            element={
              <DashboardLayout>
                <Settings />
              </DashboardLayout>
            }
          />
          <Route
            path="/:organizationId/profile"
            element={
              <DashboardLayout>
                <Profile />
              </DashboardLayout>
            }
          />

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
