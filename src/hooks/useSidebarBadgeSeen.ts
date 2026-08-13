import { useEffect, useState } from "react";

// Sidebar badge counts (e.g. Announcements/Approvals) reflect "pending/open
// items right now", not a true unread-since-last-visit tracker — but users
// still expect the red dot to clear once they've actually looked at the
// page. This tracks, per organization+user+section, the highest count seen
// so far (persisted in localStorage so it survives a refresh); the badge
// stays hidden until the live count exceeds that watermark again.
function storageKey(orgId: number | null, userId: number | null, section: string) {
  return `ems.badgeSeen.${orgId ?? "x"}.${userId ?? "x"}.${section}`;
}

export function useSidebarBadgeSeen(
  section: string,
  orgId: number | null,
  userId: number | null,
  isActive: boolean,
  liveCount: number,
): number {
  const [seenCount, setSeenCount] = useState(0);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey(orgId, userId, section));
    setSeenCount(raw ? Number(raw) || 0 : 0);
  }, [orgId, userId, section]);

  useEffect(() => {
    if (!isActive) return;
    localStorage.setItem(storageKey(orgId, userId, section), String(liveCount));
    setSeenCount(liveCount);
  }, [isActive, liveCount, orgId, userId, section]);

  return liveCount > seenCount ? liveCount : 0;
}
