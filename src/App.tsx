import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import CreateAccount from "./pages/CreateAccount";
import ForgotPassword from "./pages/ForgotPassword";
import AcceptInvite from "./pages/AcceptInvite";
import Dashboard from "./pages/Dashboard";
import Announcements from "./pages/Announcements";
import Users from "./pages/Users";
import ProjectPage from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";
import CalendarPage from "./pages/Calendar";
import Approvals from "./pages/Approvals";
import Activities from "./pages/Activities";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import DashboardLayout from "./layout/DashboardLayout";
import { AuthProvider, useAuth } from "./context/AuthProvider";
import TasksPage from "./pages/Tasks";
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

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen font-sans bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
        <GlobalAccessForbiddenModal />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
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
