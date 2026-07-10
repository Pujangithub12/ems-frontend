import React from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

type ErrorBannerProps = {
  message: string;
  onDismiss?: () => void;
  variant?: "error" | "success";
  className?: string;
};

const VARIANT_STYLES = {
  error: {
    wrapper: "bg-red-50 border-red-100 text-red-700",
    icon: AlertCircle,
    dismiss: "text-red-700 hover:text-red-900",
  },
  success: {
    wrapper: "bg-green-50 border-green-100 text-green-700",
    icon: CheckCircle2,
    dismiss: "text-green-700 hover:text-green-900",
  },
};

const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onDismiss,
  variant = "error",
  className = "",
}) => {
  const styles = VARIANT_STYLES[variant];
  const Icon = styles.icon;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 border rounded-md text-[13px] ${styles.wrapper} ${className}`}
    >
      <span className="flex items-center gap-3">
        <Icon className="flex-shrink-0 w-4 h-4" />
        <span>{message}</span>
      </span>
      {onDismiss && (
        <button onClick={onDismiss} className={styles.dismiss}>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default ErrorBanner;
