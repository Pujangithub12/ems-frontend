import React, { useState, useEffect } from "react";
import { 
  Plus, 
  MoreVertical, 
  Clock, 
  CheckCircle2, 
  Circle, 
  AlertCircle,
  User as UserIcon,
  MessageSquare,
  Paperclip
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../api/axios";

type ProjectTask = {
  id: number;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
  dueDate: string;
  assignedUsers?: Array<{ id: number; fullName: string }>;
};

type Project = {
  id: number;
  headings: any[];
};

interface KanbanBoardProps {
  project: Project;
  onUpdate: () => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ project, onUpdate }) => {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);

  useEffect(() => {
    const allTasks: ProjectTask[] = [];
    const flattenTasks = (headings: any[]) => {
      headings.forEach(h => {
        if (h.tasks) allTasks.push(...h.tasks);
        if (h.subHeadings) flattenTasks(h.subHeadings);
      });
    };
    if (project.headings) flattenTasks(project.headings);
    setTasks(allTasks);
  }, [project]);

  const columns = {
    pending: { title: "TODO", icon: <Circle size={16} />, color: "border-slate-300" },
    in_progress: { title: "IN PROGRESS", icon: <Clock size={16} />, color: "border-amber-400" },
    completed: { title: "DONE", icon: <CheckCircle2 size={16} />, color: "border-emerald-500" },
  };

  const updateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      await api.put(`/api/tasks/${taskId}/status`, { status: newStatus });
      onUpdate();
    } catch (err) {
      alert("Failed to update task status");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full min-h-[500px]">
      {(Object.entries(columns) as [keyof typeof columns, any][]).map(([status, config]) => {
        const columnTasks = tasks.filter(t => t.status === status);
        
        return (
          <div key={status} className="flex flex-col gap-6">
            {/* Column Header */}
            <div className="flex items-center justify-between px-2">
               <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-white border shadow-sm ${config.color.replace('border-', 'text-')}`}>
                     {config.icon}
                  </div>
                  <h3 className="font-bold text-slate-900 tracking-tight">{config.title}</h3>
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full">
                    {columnTasks.length}
                  </span>
               </div>
               <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                  <Plus size={16} />
               </button>
            </div>

            {/* Column Body */}
            <div className="flex-1 bg-slate-50/50 rounded-[32px] p-4 border border-slate-100 space-y-4 min-h-[400px]">
               <AnimatePresence mode="popLayout">
                  {columnTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group cursor-grab active:cursor-grabbing"
                    >
                       <div className="flex items-start justify-between mb-3">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border
                            ${task.priority === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                              task.priority === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                              'bg-emerald-50 text-emerald-600 border-emerald-100'}`}
                          >
                             {task.priority}
                          </span>
                          <button className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-50 rounded-md transition-all text-slate-400">
                             <MoreVertical size={14} />
                          </button>
                       </div>

                       <h4 className="font-bold text-slate-900 mb-2 leading-snug group-hover:text-indigo-600 transition-colors">
                          {task.title}
                       </h4>
                       <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                          {task.description}
                       </p>

                       <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                          <div className="flex -space-x-2">
                             {task.assignedUsers?.slice(0, 3).map((u, i) => (
                               <div 
                                 key={u.id} 
                                 className="w-7 h-7 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-600 shadow-sm"
                                 title={u.fullName}
                               >
                                  {u.fullName.charAt(0)}
                               </div>
                             ))}
                             {task.assignedUsers && task.assignedUsers.length > 3 && (
                               <div className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-500">
                                  +{task.assignedUsers.length - 3}
                               </div>
                             )}
                             {(!task.assignedUsers || task.assignedUsers.length === 0) && (
                               <div className="w-7 h-7 rounded-full bg-slate-50 border-2 border-white flex items-center justify-center text-slate-300">
                                  <UserIcon size={12} />
                               </div>
                             )}
                          </div>
                          
                          <div className="flex items-center gap-3 text-slate-400">
                             <div className="flex items-center gap-1 text-[10px] font-bold">
                                <MessageSquare size={12} />
                                <span>2</span>
                             </div>
                             <div className="flex items-center gap-1 text-[10px] font-bold">
                                <Paperclip size={12} />
                                <span>1</span>
                             </div>
                          </div>
                       </div>
                    </motion.div>
                  ))}
               </AnimatePresence>
               
               {columnTasks.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                    <div className="w-10 h-10 border-2 border-dashed border-slate-300 rounded-xl mb-3" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Empty Column</p>
                 </div>
               )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;
