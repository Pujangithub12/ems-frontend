import React from "react";
import { BellOff, Check } from "lucide-react";
import { useNotificationMute } from "../features/notifications/hooks/useNotificationMute";

const DURATION_OPTIONS: { label: string; minutes: number }[] = [
  { label: "For 30 minutes", minutes: 30 },
  { label: "For 1 hour", minutes: 60 },
  { label: "For 8 hours", minutes: 8 * 60 },
  { label: "For 24 hours", minutes: 24 * 60 },
];

/** Flyout panel opened from the user menu's "Notification Settings" item —
 * lets the caller mute/snooze notifications on this device for a chosen
 * duration (see useNotificationMute for what "mute" actually does). */
const NotificationSettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { isMuted, mutedUntil, mutedUntilLabel, muteForMinutes, muteForever, unmute } =
    useNotificationMute();

  return (
    <div className="w-72 bg-white rounded border border-slate-200 shadow-lg">
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="font-semibold text-[13px] text-slate-900">Notification Settings</div>
        <div className="text-[11.5px] text-slate-500 mt-0.5">
          Mute new notifications on this device
        </div>
      </div>

      {isMuted && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-[12px] text-amber-800">
          <span className="flex items-center gap-1.5">
            <BellOff className="w-3.5 h-3.5" />
            Muted {mutedUntilLabel}
          </span>
          <button onClick={unmute} className="font-medium hover:underline">
            Unmute
          </button>
        </div>
      )}

      <div className="py-1.5">
        {DURATION_OPTIONS.map((opt) => (
          <button
            key={opt.minutes}
            onClick={() => muteForMinutes(opt.minutes)}
            className="w-full flex items-center justify-between px-4 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
          >
            {opt.label}
            {isMuted && mutedUntil !== "forever" && (
              <Check
                className={`w-3.5 h-3.5 text-blue-900 ${
                  mutedUntil && Math.abs(mutedUntil - (Date.now() + opt.minutes * 60_000)) < 60_000
                    ? "opacity-100"
                    : "opacity-0"
                }`}
              />
            )}
          </button>
        ))}
        <button
          onClick={muteForever}
          className="w-full flex items-center justify-between px-4 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
        >
          Until I turn it back on
          <Check
            className={`w-3.5 h-3.5 text-blue-900 ${mutedUntil === "forever" ? "opacity-100" : "opacity-0"}`}
          />
        </button>
      </div>

      <div className="border-t border-slate-200 py-1.5">
        <button
          onClick={() => {
            unmute();
            onClose();
          }}
          disabled={!isMuted}
          className="w-full px-4 py-2 text-left text-[13px] text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Turn notifications back on
        </button>
      </div>
    </div>
  );
};

export default NotificationSettingsPanel;
