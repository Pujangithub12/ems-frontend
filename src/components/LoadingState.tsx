import React from "react";
import { Loader2 } from "lucide-react";

type LoadingStateProps = {
  label?: string;
  className?: string;
  /** "sm" drops the tall py-16 padding, for use inside tighter containers (table cells, tab bodies). */
  size?: "sm" | "md";
};

const LoadingState: React.FC<LoadingStateProps> = ({
  label = "Loading",
  className = "",
  size = "md",
}) => (
  <div
    className={`flex flex-col items-center justify-center gap-3 ${size === "md" ? "py-16" : "py-6"} ${className}`}
  >
    <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
    <div
      className="text-[11px] text-slate-400 tracking-[0.1em] uppercase"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {label}
    </div>
  </div>
);

export default LoadingState;
