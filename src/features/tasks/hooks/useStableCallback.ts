import { useCallback, useRef } from "react";

/**
 * Returns a function whose identity never changes but which always calls the latest `fn`.
 * Lets the big task pages (whose handlers close over lots of state and are re-created on every
 * render) pass handlers to memoised children without defeating the memoisation.
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}
