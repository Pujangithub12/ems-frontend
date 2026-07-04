import React from "react";
import { Project } from "../types";
import { Eyebrow } from "./ProjectSharedComponents";

interface ProjectTeamTabProps {
  project: Project;
}

const ProjectTeamTab: React.FC<ProjectTeamTabProps> = ({ project }) => {
  return (
    <div>
      <Eyebrow className="mb-4">Assigned Members</Eyebrow>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {project.assignees?.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-3 p-4 transition-colors border rounded border-slate-200 hover:bg-slate-50"
          >
            <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0">
              {member.fullName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-[13px] text-slate-900 truncate">
                {member.fullName}
              </p>
              <p className="text-[11px] text-slate-500">Project Member</p>
            </div>
          </div>
        ))}
        {(!project.assignees || project.assignees.length === 0) && (
          <p className="text-slate-500 text-[12px] italic col-span-full">
            No members assigned to this project.
          </p>
        )}
      </div>
    </div>
  );
};

export default ProjectTeamTab;
