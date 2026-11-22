import { useCallback, useRef, useState } from "react";
import type React from "react";

const STORAGE_KEY = "po-line-item-col-widths";
export const MIN_COL_WIDTH = 48;

/** Default pixel width per column id for the PO line-item table. The "item" column has none: it soaks up
 * the leftover table width until the user drags it. Custom columns fall back to {@link DEFAULT_CUSTOM_WIDTH}. */
export const DEFAULT_COL_WIDTHS: Record<string, number> = {
  sn: 64,
  hsn: 128,
  qty: 112,
  unit: 112,
  unitPrice: 144,
  vat: 72,
  total: 144,
  actions: 64,
};
export const DEFAULT_CUSTOM_WIDTH = 160;
const FLEXIBLE_MIN_DEFAULT = 220;

type Options = {
  /** localStorage key the dragged widths are remembered under (one per table). */
  storageKey?: string;
  /** Default widths for this table's column ids. */
  defaults?: Record<string, number>;
  /** Columns with no fixed default width: they share whatever width is left until dragged. */
  flexibleIds?: string[];
  /** Width of any id that is neither in `defaults` nor flexible (e.g. user-added columns). */
  fallbackWidth?: number;
};

function loadWidths(storageKey: string): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) if (typeof v === "number" && v >= MIN_COL_WIDTH) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/**
 * Drag-to-resize column widths for a spreadsheet-style table. During a drag the <col> element and the table's
 * min-width are written straight to the DOM (no React re-render per mouse move); the new width is committed
 * to state — and remembered in localStorage — once on release. Defaults to the PO line-item table's setup.
 */
export function useColumnWidths(columnIds: string[], options: Options = {}) {
  const { storageKey = STORAGE_KEY, defaults = DEFAULT_COL_WIDTHS, flexibleIds = ["item"], fallbackWidth = DEFAULT_CUSTOM_WIDTH } = options;
  const [widths, setWidths] = useState<Record<string, number>>(() => loadWidths(storageKey));
  const tableRef = useRef<HTMLTableElement>(null);

  const widthOf = useCallback(
    (id: string) => widths[id] ?? defaults[id] ?? (flexibleIds.includes(id) ? undefined : fallbackWidth),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaults / flexibleIds are per-table constants
    [widths],
  );

  const tableMinWidth = columnIds.reduce((sum, id) => sum + (widthOf(id) ?? FLEXIBLE_MIN_DEFAULT), 0);

  const persist = (next: Record<string, number>) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* storage unavailable — widths just won't be remembered */
    }
  };

  const resetWidth = useCallback((id: string) => {
    setWidths((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      persist(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist only closes over the constant storageKey
  }, []);

  const startResize = useCallback(
    (id: string, e: React.PointerEvent<HTMLElement>) => {
      const table = tableRef.current;
      const col = table?.querySelector<HTMLElement>(`col[data-col="${id}"]`);
      const th = e.currentTarget.parentElement;
      if (!table || !col || !th) return;
      e.preventDefault();
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startWidth = th.getBoundingClientRect().width;
      const startTableMin = parseFloat(table.style.minWidth) || tableMinWidth;
      const startColWidth = parseFloat(col.style.width) || startWidth;
      let latest = startWidth;
      const prevCursor = document.body.style.cursor;
      const prevSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        latest = Math.max(MIN_COL_WIDTH, Math.round(startWidth + ev.clientX - startX));
        col.style.width = `${latest}px`;
        table.style.minWidth = `${Math.max(0, startTableMin + latest - startColWidth)}px`;
      };
      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevSelect;
        setWidths((prev) => {
          const next = { ...prev, [id]: latest };
          persist(next);
          return next;
        });
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist only closes over the constant storageKey
    [tableMinWidth],
  );

  return { tableRef, widthOf, tableMinWidth, startResize, resetWidth };
}
