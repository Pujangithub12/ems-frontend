import React, { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { GripVertical, Trash2 as DeleteIcon } from "lucide-react";
import { TreeNode } from "../../types";

interface TreeItemProps {
  node: TreeNode;
  onDeleteNode: (nodeId: string) => void;
}

export const TreeItem: React.FC<TreeItemProps> = ({ node, onDeleteNode }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { setNodeRef, isOver } = useDroppable({
    id: node.id,
  });

  const handleDelete = () => {
    if (node.id === "root") return;
    onDeleteNode(node.id);
  };

  return (
    <div className="flex flex-col items-center">
      <div
        ref={setNodeRef}
        className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all shadow-md ${
          isOver ? "bg-indigo-100 border-indigo-400" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex justify-center items-center w-12 h-12 text-xl font-bold text-white bg-indigo-500 rounded-full shadow-lg">
          {node.label.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-800">
            {node.label}
          </span>
        </div>
        {node.id !== "root" && (
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <DeleteIcon className="w-4 h-4" />
          </button>
        )}
        {node.children.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {isExpanded ? (
              <span className="text-xs font-bold">▼</span>
            ) : (
              <span className="text-xs font-bold">▶</span>
            )}
          </button>
        )}
      </div>

      {isExpanded && node.children.length > 0 && (
        <div className="relative mt-6 flex gap-8">
          {/* Connecting lines from parent to children */}
          {node.children.length > 0 && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full w-px h-6 bg-slate-300" />
          )}

          {node.children.map((child, index) => (
            <div key={child.id} className="flex flex-col items-center relative">
              {/* Horizontal line to child */}
              <div
                className="absolute top-0 w-1/2 h-px bg-slate-300"
                style={{
                  left: index === 0 ? "50%" : 0,
                  right: index === node.children.length - 1 ? "50%" : 0,
                }}
              />

              {/* Vertical line to child node */}
              <div className="absolute top-0 left-1/2 w-px h-6 -translate-x-1/2 -translate-y-full bg-slate-300" />

              <TreeItem node={child} onDeleteNode={onDeleteNode} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
