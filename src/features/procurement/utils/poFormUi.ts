import type React from "react";

export const inputCls = "w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500";
export const labelCls = "block mb-1 text-[11px] font-medium text-slate-900";
export const primaryBtnCls = "flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60 transition-colors";
export const sectionCardCls = "p-4 bg-white border rounded-xl shadow-md border-slate-200";

/** At the end of a field's text, ArrowRight moves focus to the next field in the same
 * [data-arrow-row] group (ArrowLeft does the same at the start, moving back) — mirrors the
 * same handler on the Site Activities and Proforma Invoices pages. Only wired onto plain text
 * inputs (no `type` attribute) since `.selectionStart`/`.setSelectionRange` throw on
 * `type="number"`/`"date"` inputs in Chrome. */
export const handleRowArrowNav = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const input = e.currentTarget;
  if (input.selectionStart !== input.selectionEnd) return; // a range is selected — let the browser collapse it first
  const atStart = input.selectionStart === 0;
  const atEnd = input.selectionStart === input.value.length;
  if (!((e.key === "ArrowLeft" && atStart) || (e.key === "ArrowRight" && atEnd))) return;

  const row = input.closest<HTMLElement>("[data-arrow-row]");
  if (!row) return;
  const fields = Array.from(row.querySelectorAll<HTMLInputElement>("input[type='text'], input:not([type])")).filter((el) => !el.disabled);
  const idx = fields.indexOf(input);
  if (idx === -1) return;
  const next = fields[e.key === "ArrowRight" ? idx + 1 : idx - 1];
  if (next) {
    e.preventDefault();
    next.focus();
    const pos = e.key === "ArrowRight" ? 0 : next.value.length;
    next.setSelectionRange(pos, pos);
  }
};

export const numOrUndef = (s: string): number | undefined => {
  if (s.trim() === "") return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
};
