import { useMemo, useState } from "react";

/** Bulk-select state for a table of rows keyed by id — numeric by default, but
 * accepts any id type (e.g. string group keys for a grouped table). No prior
 * in-app convention. */
export function useRowSelection<T = number>(visibleIds: T[]) {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggle = (id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (visibleIds.every((id) => prev.has(id))) return new Set();
      return new Set(visibleIds);
    });
  };

  const clear = () => setSelected(new Set());

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return { selected, selectedIds, allSelected, someSelected, toggle, toggleAll, clear };
}
