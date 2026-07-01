import React, { useState } from "react";
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FileCode, 
  FileText, 
  File,
  Terminal,
  Cpu,
  Globe,
  Database,
  Cloud,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { Project, ProjectHeading, ProjectTask } from "../types";

interface TreeItemProps {
  item: any;
  depth?: number;
  type: 'heading' | 'task';
}

const TreeItem: React.FC<TreeItemProps> = ({ item, depth = 0, type }) => {
  const [isOpen, setIsOpen] = useState(true);
  const isHeading = type === 'heading';

  const getHeadingIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("frontend") || n.includes("ui") || n.includes("web")) 
      return <Globe size={18} className="text-sky-500" />;
    if (n.includes("backend") || n.includes("api") || n.includes("server")) 
      return <Cpu size={18} className="text-amber-500" />;
    if (n.includes("database") || n.includes("db") || n.includes("data")) 
      return <Database size={18} className="text-emerald-500" />;
    if (n.includes("deploy") || n.includes("cloud") || n.includes("devops")) 
      return <Cloud size={18} className="text-indigo-500" />;
    if (n.includes("auth") || n.includes("login") || n.includes("security")) 
      return <Terminal size={18} className="text-rose-500" />;
    return <Folder size={18} className="text-indigo-400 fill-indigo-50" />;
  };

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 size={14} className="text-emerald-500" />;
      case "in_progress":
        return <Clock size={14} className="text-amber-500" />;
      default:
        return <AlertCircle size={14} className="text-slate-300" />;
    }
  };

  return (
    <div className="w-full">
      <div
        className={`flex items-center gap-3 py-2 px-3 hover:bg-slate-50 rounded-xl cursor-pointer select-none transition-colors group
          ${isHeading ? "font-bold text-slate-900" : "text-slate-600 font-medium"}`}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
        onClick={() => isHeading && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 min-w-[24px]">
          {isHeading ? (
            <div className="flex items-center gap-1">
              {isOpen ? (
                <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
              ) : (
                <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
              )}
              {getHeadingIcon(item.name)}
            </div>
          ) : (
             <div className="w-4 h-4 flex items-center justify-center ml-4">
                <div className="w-1 h-1 bg-slate-300 rounded-full group-hover:scale-150 transition-transform" />
             </div>
          )}
        </div>
        
        <span className="text-sm flex-1 truncate">
          {isHeading ? item.name : item.title}
        </span>

        {!isHeading && (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 bg-white border border-slate-100 rounded-lg shadow-sm">
             {getTaskStatusIcon(item.status)}
             <span className="text-[10px] uppercase tracking-widest text-slate-400">{item.status || 'Pending'}</span>
          </div>
        )}
      </div>
      
      {isHeading && isOpen && (
        <div className="relative">
           {/* Visual line for tree */}
           <div 
             className="absolute left-[20px] top-0 bottom-0 w-px bg-slate-100" 
             style={{ left: `${depth * 24 + 20}px` }}
           />
           
           <div className="space-y-0.5">
            {item.subHeadings?.map((sub: any) => (
              <TreeItem key={`h-${sub.id}`} item={sub} depth={depth + 1} type="heading" />
            ))}
            {item.tasks?.map((task: any) => (
              <TreeItem key={`t-${task.id}`} item={task} depth={depth + 1} type="task" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FileExplorer: React.FC<{ project: Project }> = ({ project }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <Folder size={18} className="text-indigo-500" />
           <h3 className="font-bold text-slate-900">Project Structure</h3>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
           <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Done</span>
           <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> In Progress</span>
        </div>
      </div>
      <div className="p-4">
        {project.headings && project.headings.length > 0 ? (
          <div className="space-y-1">
            {project.headings.map((heading) => (
              <TreeItem key={`h-${heading.id}`} item={heading} type="heading" />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
             <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-slate-300" />
             </div>
             <p className="text-sm font-medium text-slate-500">No project structure defined yet.</p>
          </div>
        )}
      </div>
      <div className="px-6 py-3 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between">
         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
           {project.headings?.length || 0} Modules Found
         </p>
         <button className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest transition-colors">
           Manage Structure
         </button>
      </div>
    </div>
  );
};

export default FileExplorer;
