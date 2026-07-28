import React, { useState } from "react";
import { ShieldCheck, Users as UsersIcon, Building2 } from "lucide-react";
import OrganizationTab from "../components/OrganizationTab";
import MembersTab from "../components/MembersTab";
import RolesPermissionsTab from "../components/RolesPermissionsTab";

type Tab = "organization" | "members" | "roles";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "roles", label: "Roles & Permissions", icon: ShieldCheck },
  { id: "members", label: "Members", icon: UsersIcon },
  { id: "organization", label: "Organization", icon: Building2 },
];

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("roles");

  return (
    <div className="w-full px-6 py-8 lg:px-8 lg:py-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="font-semibold text-[28px] tracking-tight text-slate-900">
          Settings
        </h2>
        <p className="text-slate-500 text-[14px] mt-1">
          Manage your organization, members, and roles.
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

      {activeTab === "organization" && <OrganizationTab />}

      {activeTab === "members" && <MembersTab />}

      {activeTab === "roles" && <RolesPermissionsTab />}
    </div>
  );
};

export default Settings;
