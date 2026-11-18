import { toNumber } from "../../../lib/currency";
import type { PurchaseOrder } from "../../../types";

/** One editable row of the Line Items table. Numbers are kept as the text the user typed; `id` is
 * null for a row that hasn't been saved yet. Nothing is sent to the server until Save Changes. */
export type ItemRow = {
  key: string;
  id: number | null;
  itemName: string;
  hsnCode: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  /** Whether VAT applies to this line. */
  taxable: boolean;
  custom: Record<string, string>;
};

/** A user-defined column: `key` is stable (values are stored under it), `label` is the heading the user typed. */
export type CustomCol = { key: string; label: string };

export const newColKey = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const rowFromItem = (item: PurchaseOrder["items"][number]): ItemRow => ({
  key: `i${item.id}`,
  id: item.id,
  itemName: item.itemName,
  hsnCode: item.hsnCode || "",
  quantity: String(item.quantity),
  unit: item.unit || "",
  unitPrice: item.unitPrice != null ? String(toNumber(item.unitPrice)) : "",
  taxable: item.taxable !== false,
  custom: { ...(item.customValues ?? {}) },
});

let newRowSeq = 0;
export const blankRow = (): ItemRow => ({ key: `n${++newRowSeq}`, id: null, itemName: "", hsnCode: "", quantity: "", unit: "", unitPrice: "", taxable: true, custom: {} });

export const rowIsBlank = (r: ItemRow) =>
  !r.itemName.trim() && !r.hsnCode.trim() && !r.quantity.trim() && !r.unit.trim() && !r.unitPrice.trim() && Object.values(r.custom).every((v) => !v.trim());

/** Comparable snapshot of a row (ignores the React key), so "has anything changed?" is a string compare. */
export const rowSig = (r: ItemRow) =>
  JSON.stringify([
    r.id,
    r.itemName.trim(),
    r.hsnCode.trim(),
    r.quantity.trim(),
    r.unit.trim(),
    r.unitPrice.trim(),
    r.taxable,
    Object.entries(r.custom)
      .map(([k, v]) => [k, v.trim()] as const)
      .filter(([, v]) => v)
      .sort(([a], [b]) => a.localeCompare(b)),
  ]);

export const colsSig = (cols: CustomCol[]) => JSON.stringify(cols.filter((c) => c.label.trim()).map((c) => [c.key, c.label.trim()]));

/** Keeps only digits and a single decimal point, so number cells can stay plain left-aligned text inputs. */
export const cleanNumberText = (s: string) => {
  const t = s.replace(/[^0-9.]/g, "");
  const dot = t.indexOf(".");
  return dot === -1 ? t : t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, "");
};

/** Sub total / VAT / grand total of a saved PO, the same way the form and the PDF work them out:
 * VAT is the PO's Tax % charged only on lines marked taxable. */
export const purchaseOrderTotals = (po: Pick<PurchaseOrder, "items" | "taxPercent">) => {
  let subTotal = 0;
  let taxableTotal = 0;
  for (const item of po.items) {
    const amount = (Number(item.quantity) || 0) * (item.unitPrice != null ? toNumber(item.unitPrice) : 0);
    subTotal += amount;
    if (item.taxable !== false) taxableTotal += amount;
  }
  const pct = po.taxPercent != null ? toNumber(po.taxPercent) : 0;
  const vat = pct > 0 ? taxableTotal * (pct / 100) : 0;
  return { subTotal, vat, grandTotal: subTotal + vat };
};

export const rowTotal = (r: ItemRow) => {
  const q = parseFloat(r.quantity);
  const p = parseFloat(r.unitPrice);
  return (Number.isFinite(q) ? q : 0) * (Number.isFinite(p) ? p : 0);
};

// ---- Bulk import (.xlsx/.xls/.csv) — parsed entirely client-side ----

export type ImportedItem = {
  itemName: string;
  quantity: number;
  unit: string | undefined;
  unitPrice: number | null;
  description: string | null;
};

export type SheetParseResult = { ok: true; items: ImportedItem[]; skipped: number } | { ok: false; message: string };

const findColumn = (header: string[], needle: string, exclude: number[] = []) =>
  header.findIndex((h, i) => !exclude.includes(i) && (h || "").toString().toLowerCase().includes(needle));

/** Reads the first sheet of a spreadsheet file into importable line items. The (large) xlsx library is
 * only loaded here, when someone actually uploads a sheet, instead of with the page. */
export async function parseLineItemsSheet(file: File): Promise<SheetParseResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows2d: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  const headerRowIdx = rows2d.findIndex((r) => {
    const cells = r.map((c) => String(c).trim().toLowerCase());
    return cells.some((c) => c.includes("item")) && cells.some((c) => c.includes("qty") || c.includes("quantity"));
  });
  if (headerRowIdx === -1) {
    return { ok: false, message: "Couldn't find a header row with \"Item\" and \"Quantity\" columns." };
  }
  const header = rows2d[headerRowIdx].map((c) => String(c));
  const itemNameCol = findColumn(header, "item");
  const qtyCol = findColumn(header, "qty");
  const quantityCol = qtyCol >= 0 ? qtyCol : findColumn(header, "quantity");
  const unitPriceCol = findColumn(header, "price");
  const unitCol = findColumn(header, "unit", [unitPriceCol]);
  const descriptionCol = findColumn(header, "desc");

  const items: ImportedItem[] = [];
  let skipped = 0;
  for (let i = headerRowIdx + 1; i < rows2d.length; i++) {
    const r = rows2d[i];
    const itemName = itemNameCol >= 0 ? String(r[itemNameCol] ?? "").trim() : "";
    if (!itemName || itemName.toLowerCase() === "total") {
      skipped += 1;
      continue;
    }

    const quantityRaw = quantityCol >= 0 ? r[quantityCol] : "";
    const quantity = typeof quantityRaw === "number" ? quantityRaw : parseFloat(String(quantityRaw));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      skipped += 1;
      continue;
    }

    const unit = unitCol >= 0 ? String(r[unitCol] ?? "").trim() || undefined : undefined;
    const unitPriceRaw = unitPriceCol >= 0 ? r[unitPriceCol] : "";
    const unitPrice =
      unitPriceRaw !== "" && unitPriceRaw != null && Number.isFinite(Number(unitPriceRaw)) ? Number(unitPriceRaw) : null;
    const description = descriptionCol >= 0 ? String(r[descriptionCol] ?? "").trim() || null : null;

    items.push({ itemName, quantity, unit, unitPrice, description });
  }
  return { ok: true, items, skipped };
}
