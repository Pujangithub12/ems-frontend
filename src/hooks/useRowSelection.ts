import { useMemo, useState } from "react";

/** Bulk-select state for a table of rows keyed by numeric id. No prior in-app convention. */
export function useRowSelection(visibleIds: number[]) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggle = (id: number) => {
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
