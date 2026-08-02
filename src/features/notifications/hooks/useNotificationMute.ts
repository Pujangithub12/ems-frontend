import { useEffect, useState } from "react";

// Client-side/device-local "mute" — deliberately not synced to the backend:
// muting is a "don't disturb me on this device right now" preference, not a
// data-visibility rule, so notifications keep arriving/persisting normally
// (see notificationService.ts) and are still there once unmuted. Persisted
// in localStorage so it survives a page refresh but not a different device.
const STORAGE_KEY = "ems.notifications.mutedUntil";

export type MuteUntil = number | "forever" | null;

const readStoredMute = (): MuteUntil => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  if (raw === "forever") return "forever";
  const ts = Number(raw);
  if (!Number.isFinite(ts) || ts <= Date.now()) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  return ts;
};

export function useNotificationMute() {
  const [mutedUntil, setMutedUntilState] = useState<MuteUntil>(readStoredMute);

  // Auto-unmutes itself once a timed mute expires, without needing a reload.
  useEffect(() => {
    if (mutedUntil === null || mutedUntil === "forever") return;
    const ms = mutedUntil - Date.now();
    if (ms <= 0) {
      setMutedUntilState(null);
      return;
    }
    const timer = setTimeout(() => setMutedUntilState(null), ms);
    return () => clearTimeout(timer);
  }, [mutedUntil]);

  const muteForMinutes = (minutes: number) => {
    const until = Date.now() + minutes * 60_000;
    localStorage.setItem(STORAGE_KEY, String(until));
    setMutedUntilState(until);
  };

  const muteForever = () => {
    localStorage.setItem(STORAGE_KEY, "forever");
    setMutedUntilState("forever");
  };

  const unmute = () => {
    localStorage.removeItem(STORAGE_KEY);
    setMutedUntilState(null);
  };

  const mutedUntilLabel =
    mutedUntil === null
      ? null
      : mutedUntil === "forever"
        ? "until turned back on"
        : `until ${new Date(mutedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

  return {
    isMuted: mutedUntil !== null,
    mutedUntil,
    mutedUntilLabel,
    muteForMinutes,
    muteForever,
    unmute,
  };
}
