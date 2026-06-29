import React, { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Trash2 as DeleteIcon, ChevronDown, ChevronRight } from "lucide-react";
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

  const isRoot = node.id === "root";

  return (
    <div className="flex flex-col items-center">
      <div
        ref={setNodeRef}
        className={`group flex items-center gap-2.5 p-2.5 rounded-md border transition-all w-[180px] ${
          isOver
            ? "bg-blue-50 border-blue-900 border-dashed"
            : "bg-white border-slate-200 hover:bg-slate-50"
        }`}
      >
        {/* Left accent strip for non-root nodes */}
        {!isRoot && (
          <div className="w-0.5 h-8 bg-blue-900 rounded-full flex-shrink-0" />
        )}

        <div className="flex justify-center items-center w-7 h-7 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded-full flex-shrink-0">
          {node.label.charAt(0).toUpperCase()}
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[12px] font-medium text-slate-900 truncate">
            {node.label}
          </span>
          {isRoot && (
            <span
              className="text-[9px] text-slate-400 uppercase tracking-wider"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Organization
            </span>
          )}
        </div>

        {node.children.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0 p-1 transition-colors rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        )}

        {!isRoot && (
          <button
            onClick={handleDelete}
            className="flex-shrink-0 p-1 transition-colors rounded opacity-0 text-slate-400 hover:text-red-700 hover:bg-red-50 group-hover:opacity-100"
          >
            <DeleteIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      {isExpanded && node.children.length > 0 && (
        <div className="relative flex gap-6 mt-6">
          {/* Vertical line from parent down */}
          <div className="absolute top-0 w-px h-6 -translate-x-1/2 -translate-y-full left-1/2 bg-slate-200" />

          {node.children.map((child, index) => (
            <div key={child.id} className="relative flex flex-col items-center">
              {/* Horizontal line connecting siblings */}
              <div
                className="absolute top-0 h-px bg-slate-200"
                style={{
                  left: index === 0 ? "50%" : 0,
                  right: index === node.children.length - 1 ? "50%" : 0,
                  width:
                    index === 0 && node.children.length === 1 ? 0 : undefined,
                }}
              />

              {/* Vertical line down to child */}
              <div className="absolute top-0 w-px h-6 -translate-x-1/2 -translate-y-full left-1/2 bg-slate-200" />

              <TreeItem node={child} onDeleteNode={onDeleteNode} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
