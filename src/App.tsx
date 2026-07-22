import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./features/auth/pages/Login";
import CreateAccount from "./features/auth/pages/CreateAccount";
import ForgotPassword from "./features/auth/pages/ForgotPassword";
import AcceptInvite from "./features/auth/pages/AcceptInvite";
import Dashboard from "./features/dashboard/pages/Dashboard";
import Announcements from "./features/announcements/pages/Announcements";
import Documents from "./features/documents/pages/Documents";
import Inventory from "./features/inventory/pages/Inventory";
import Procurement from "./features/procurement/pages/Procurement";
import Users from "./features/users/pages/Users";
import ProjectPage from "./features/projects/pages/Projects";
import ProjectDetails from "./features/projects/pages/ProjectDetails";
import CalendarPage from "./features/calendar/pages/Calendar";
import Approvals from "./features/approvals/pages/Approvals";
import Activities from "./features/activities/pages/Activities";
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
 * (a blocked workspace switch/create attempt) surfaces this modal. */
const GlobalAccessForbiddenModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setAccessForbiddenHandler(() => setIsOpen(true));
    return () => setAccessForbiddenHandler(null);
  }, []);

  return <AccessForbiddenModal isOpen={isOpen} onClose={() => setIsOpen(false)} />;
};

/**
 * Resolves "/" and any unmatched path to the caller's current workspace —
 * the URL (not a shared cookie) is the source of truth for which workspace
 * is active, so every real page lives under /:workspaceId/...
 */
const RootRedirect: React.FC = () => {
  const { user, workspace, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate replace to="/login" />;
  if (workspace) return <Navigate replace to={`/${workspace.id}/dashboard`} />;
  return null;
};

/**
 * "/" specifically: logged-out visitors see the public marketing home page;
 * logged-in users still fall through to their workspace dashboard. Unmatched
 * paths (the "*" route) keep using RootRedirect's straight-to-login behavior.
 */
const RootPage: React.FC = () => {
  const { user, workspace, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Home />;
  if (workspace) return <Navigate replace to={`/${workspace.id}/dashboard`} />;
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
            path="/:workspaceId/dashboard"
            element={
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            }
          />
          <Route
            path="/:workspaceId/tasks"
            element={
              <DashboardLayout>
                <TasksPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/:workspaceId/project"
            element={
              <DashboardLayout>
                <ProjectPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/:workspaceId/project/:id/details"
            element={
              <DashboardLayout>
                <ProjectDetails />
              </DashboardLayout>
            }
          />
          <Route
            path="/:workspaceId/announcements"
            element={
              <DashboardLayout>
                <Announcements />
              </DashboardLayout>
            }
          />
          <Route
            path="/:workspaceId/documents"
            element={
              <DashboardLayout>
                <Documents />
              </DashboardLayout>
            }
          />
          <Route
            path="/:workspaceId/inventory"
            element={
              <DashboardLayout>
                <Inventory />
              </DashboardLayout>
            }
          />
          <Route
            path="/:workspaceId/procurement"
            element={
              <DashboardLayout>
                <Procurement />
              </DashboardLayout>
            }
          />
          <Route
            path="/:workspaceId/task"
            element={
              <DashboardLayout>
                <TasksPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/:workspaceId/users"
            element={
              <DashboardLayout>
                <Users />
              </DashboardLayout>
            }
          />
          <Route
            path="/:workspaceId/calendar"
            element={
              <DashboardLayout>
                <CalendarPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/:workspaceId/leaverequests"
            element={
              <DashboardLayout>
                <Approvals />
              </DashboardLayout>
            }
          />
          <Route
            path="/:workspaceId/activities"
            element={
              <DashboardLayout>
                <Activities />
              </DashboardLayout>
            }
          />
          <Route
            path="/:workspaceId/reports"
            element={
              <DashboardLayout>
                <Reports />
              </DashboardLayout>
            }
          />
          <Route
            path="/:workspaceId/settings"
            element={
              <DashboardLayout>
                <Settings />
              </DashboardLayout>
            }
          />
          <Route
            path="/:workspaceId/profile"
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
