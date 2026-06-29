import React, { useState } from "react";
import AssignedTasks from "./AssignedTasks"; // Adjust path as needed
import MyTasks from "./MyTasks"; // Adjust path as needed

const TasksPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"assigned" | "my">("assigned");

  return (
    <div className="flex flex-col min-h-0 overflow-hidden bg-white border rounded-md border-slate-200">
      {/* Tab Bar */}
      <div className="flex items-end flex-shrink-0 gap-1 px-6 pt-3 overflow-x-auto border-b border-slate-200">
        <button
          onClick={() => setActiveTab("assigned")}
          className={`flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "assigned"
              ? "border-slate-900 text-slate-900 font-medium"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
          style={{ padding: "10px 14px", fontSize: 13, marginBottom: -1 }}
        >
          Assigned Tasks
        </button>

        <button
          onClick={() => setActiveTab("my")}
          className={`flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            activeTab === "my"
              ? "border-slate-900 text-slate-900 font-medium"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
          style={{ padding: "10px 14px", fontSize: 13, marginBottom: -1 }}
        >
          My Tasks
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto bg-[#F6F7F9]">
        {activeTab === "assigned" ? <AssignedTasks /> : <MyTasks />}
      </div>
    </div>
  );
};

export default TasksPage;