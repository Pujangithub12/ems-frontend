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
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex gap-3 items-center p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-grab active:cursor-grabbing hover:bg-slate-100 transition-colors"
    >
      <div className="flex justify-center items-center w-8 h-8 font-bold text-indigo-700 bg-indigo-100 rounded-full border-2 border-white shadow-sm">
        {user.fullName.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 truncate">
          {user.fullName}
        </p>
        <p className="text-xs font-medium text-slate-500 truncate">
          {user.jobPosition}
        </p>
      </div>
    </div>
  );
};
