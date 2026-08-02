import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders a wide scrollable element's *only* horizontal scrollbar as a bar
 * pinned to the bottom of the viewport (the target itself is expected to
 * have its native scrollbar hidden, e.g. via the "no-scrollbar" utility
 * class) — so a tall table/chart's scrollbar is always reachable at the
 * bottom of the screen instead of wherever the element's own bottom edge
 * happens to land on the page. Two-way synced: dragging either the floating
 * bar or the target itself (wheel/trackpad/keyboard) keeps the other in
 * sync. Visibility/position is recomputed continuously via rAF rather than
 * off specific resize/scroll events, since the target's *content* width
 * (e.g. the Gantt chart's zoom level) can change without the target's own
 * box size changing.
 */
export default function StickyHorizontalScrollbar({
  targetRef,
}: {
  targetRef: React.RefObject<HTMLElement>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ left: number; width: number } | null>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  // Guards against the target->track and track->target scroll listeners
  // triggering each other back and forth on every synced update.
  const syncingRef = useRef(false);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    let raf = 0;
    const tick = () => {
      const box = target.getBoundingClientRect();
      const scrollNeeded = target.scrollWidth > target.clientWidth + 1;
      const anyPartVisible = box.top < window.innerHeight && box.bottom > 0;

      if (scrollNeeded && anyPartVisible) {
        setRect((prev) =>
          prev && prev.left === box.left && prev.width === box.width
            ? prev
            : { left: box.left, width: box.width },
        );
        setScrollWidth((prev) => (prev === target.scrollWidth ? prev : target.scrollWidth));
      } else {
        setRect((prev) => (prev === null ? prev : null));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const handleTargetScroll = () => {
      if (syncingRef.current) {
        syncingRef.current = false;
        return;
      }
      if (trackRef.current) {
        syncingRef.current = true;
        trackRef.current.scrollLeft = target.scrollLeft;
      }
    };
    target.addEventListener("scroll", handleTargetScroll);

    return () => {
      cancelAnimationFrame(raf);
      target.removeEventListener("scroll", handleTargetScroll);
    };
  }, [targetRef]);

  const handleTrackScroll = () => {
    const target = targetRef.current;
    const track = trackRef.current;
    if (!target || !track) return;
    if (syncingRef.current) {
      syncingRef.current = false;
      return;
    }
    syncingRef.current = true;
    target.scrollLeft = track.scrollLeft;
  };

  if (!rect) return null;

  return createPortal(
    <div
      ref={trackRef}
      onScroll={handleTrackScroll}
      className="sticky-horizontal-scrollbar"
      style={{
        position: "fixed",
        left: rect.left,
        width: rect.width,
        bottom: 0,
        height: 14,
        overflowX: "auto",
        overflowY: "hidden",
        zIndex: 60,
      }}
    >
      <div style={{ width: scrollWidth, height: 1 }} />
    </div>,
    document.body,
  );
}
