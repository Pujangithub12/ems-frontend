import React from "react";
import { ShieldAlert } from "lucide-react";

interface AccessForbiddenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AccessForbiddenModal: React.FC<AccessForbiddenModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/45">
      <div className="w-full max-w-md overflow-hidden bg-white border rounded-md shadow-lg border-slate-200">
        <div className="flex items-center gap-3 p-6 border-b border-slate-200">
          <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-red-600 bg-red-50 rounded-full">
            <ShieldAlert className="w-4.5 h-4.5" />
          </div>
          <h3 className="font-semibold text-[15px] text-slate-900">
            Access Forbidden
          </h3>
        </div>

        <div className="p-6">
          <p className="text-[13px] text-slate-600 leading-relaxed">
            Your account only has access to the workspace you were invited
            to. You can't switch to or create another workspace.
          </p>
        </div>

        <div className="flex justify-end p-6 pt-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-white transition-colors rounded bg-blue-900 hover:bg-blue-800"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessForbiddenModal;
