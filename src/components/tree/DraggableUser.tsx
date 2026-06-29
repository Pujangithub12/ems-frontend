import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { User } from "../../types";

interface DraggableUserProps {
  user: User;
}

export const DraggableUser: React.FC<DraggableUserProps> = ({ user }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `user-${user.id}`,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex gap-2.5 items-center p-2.5 bg-white rounded-md border border-slate-200 cursor-grab active:cursor-grabbing hover:bg-slate-50 hover:border-slate-300 transition-colors"
    >
      <div className="flex justify-center items-center w-7 h-7 text-[10px] font-semibold text-white bg-blue-900 rounded-full flex-shrink-0">
        {user.fullName.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-slate-900 truncate">
          {user.fullName}
        </p>
        <p className="text-[11px] text-slate-500 truncate">
          {user.jobPosition}
        </p>
      </div>
    </div>
  );
};
