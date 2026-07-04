import React from "react";
import { Plus } from "lucide-react";

interface ProjectInventoryTabProps {}

const ProjectInventoryTab: React.FC<ProjectInventoryTabProps> = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded border-slate-200">
      <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
        <Plus className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
        Inventory
      </h3>
      <p className="text-slate-500 text-[12px] max-w-xs mx-auto mb-4">
        Coming soon...
      </p>
    </div>
  );
};

export default ProjectInventoryTab;
