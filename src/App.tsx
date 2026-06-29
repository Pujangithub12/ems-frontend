import React from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import AdminLogin from "./pages/AdminLogin";
import UserLogin from "./pages/UserLogin";
import Dashboard from "./pages/Dashboard";
import AssignedTasks from "./pages/AssignedTasks";
import Announcements from "./pages/Announcements";
import Users from "./pages/Users";
import ProjectPage from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";
import MyTasks from "./pages/MyTasks";
import CalendarPage from "./pages/Calendar";
import LeaveRequests from "./pages/LeaveRequests";
import Activities from "./pages/Activities";
import DashboardLayout from "./pages/DashboardLayout";
import { AuthProvider } from "./context/AuthProvider";
import TasksPage from "./pages/Tasks";

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen font-sans bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
        <Routes>
          <Route path="/" element={<Navigate replace to="/dashboard" />} />
          <Route path="/login/user" element={<UserLogin />} />
          <Route path="/login/admin" element={<AdminLogin />} />

          <Route
            path="/dashboard"
            element={
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            }
          />
          <Route
            path="/tasks"
            element={
              <DashboardLayout>
                <TasksPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/project"
            element={
              <DashboardLayout>
                <ProjectPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/project/:id/details"
            element={
              <DashboardLayout>
                <ProjectDetails />
              </DashboardLayout>
            }
          />
          <Route
            path="/announcements"
            element={
              <DashboardLayout>
                <Announcements />
              </DashboardLayout>
            }
          />
          <Route
            path="/task"
            element={
              <DashboardLayout>
                <TasksPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/users"
            element={
              <DashboardLayout>
                <Users />
              </DashboardLayout>
            }
          />
          <Route
            path="/calendar"
            element={
              <DashboardLayout>
                <CalendarPage />
              </DashboardLayout>
            }
          />
          <Route
            path="/leaverequests"
            element={
              <DashboardLayout>
                <LeaveRequests />
              </DashboardLayout>
            }
          />
          <Route
            path="/activities"
            element={
              <DashboardLayout>
                <Activities />
              </DashboardLayout>
            }
          />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
