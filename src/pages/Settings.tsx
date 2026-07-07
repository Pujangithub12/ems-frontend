import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import { User } from "../types";
import { ShieldCheck, Users as UsersIcon, Building2, Lock } from "lucide-react";
import WorkspaceTab from "../setting-components/WorkspaceTab";
import MembersTab from "../setting-components/MembersTab";
import RolesPermissionsTab from "../setting-components/RolesPermissionsTab";
import SecurityTab from "../setting-components/SecurityTab";

type Tab = "workspace" | "members" | "roles" | "security";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "roles", label: "Roles & Permissions", icon: ShieldCheck },
  { id: "members", label: "Members", icon: UsersIcon },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "security", label: "Security", icon: Lock },
];

const Settings: React.FC = () => {
  const { workspace } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("roles");

  // Shared across the Members and Roles & Permissions tabs so switching
  // between them doesn't refetch or go out of sync with each other.
  const [members, setMembers] = useState<User[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const loadMembers = async () => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const res = await api.get<User[]>("/api/users");
      setMembers(res.data.sort((a, b) => a.fullName.localeCompare(b.fullName)));
    } catch (err: any) {
      setMembersError(
        err?.response?.data?.message || err.message || "Unable to load members.",
      );
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [workspace?.id]);

  return (
    <div className="w-full px-6 py-8 lg:px-8 lg:py-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="font-semibold text-[28px] tracking-tight text-slate-900">
          Settings
        </h2>
        <p className="text-slate-500 text-[14px] mt-1">
          Manage your workspace, members, roles, and account security.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-end gap-1 mb-6 overflow-x-auto no-scrollbar border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "border-slate-900 text-slate-900 font-medium"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
            style={{ padding: "10px 14px", fontSize: 13, marginBottom: -1 }}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "workspace" && <WorkspaceTab />}

      {activeTab === "members" && (
        <MembersTab
          members={members}
          membersLoading={membersLoading}
          membersError={membersError}
          setMembers={setMembers}
          setMembersError={setMembersError}
          reloadMembers={loadMembers}
        />
      )}

      {activeTab === "roles" && (
        <RolesPermissionsTab
          members={members}
          membersLoading={membersLoading}
          membersError={membersError}
          setMembers={setMembers}
          setMembersError={setMembersError}
        />
      )}

      {activeTab === "security" && <SecurityTab />}
    </div>
  );
};

export default Settings;
