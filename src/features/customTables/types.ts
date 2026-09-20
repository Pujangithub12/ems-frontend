/** Shared shapes for this app's "custom spreadsheet tab" pages (Plant Report,
 * Materials) — each has its own backend models/API/hooks (independent data
 * sets), but the column/row/cell shape and the TableSheet UI built around it
 * are identical, so that part is shared. Structurally identical to
 * PlantReportColumn/PlantReportRow etc. in plantReport.api.ts — TS's
 * structural typing means those pass into props typed with these directly,
 * no conversion needed. */

export type CustomTableColumnDataType = "text" | "number" | "date" | "boolean";
export type CustomTableCellValue = string | number | boolean | null;

export type CustomTableColumn = {
  id: number;
  name: string;
  dataType: CustomTableColumnDataType;
  sortOrder: number;
  /** Optional flat expected/target value — meaningful only for "number" columns. */
  target: number | null;
};

export type CustomTableRow = {
  id: number;
  sortOrder: number;
  values: Record<string, CustomTableCellValue>;
};

export type SaveCustomTableColumnPayload = { name: string; dataType: CustomTableColumnDataType; target?: number | null };
export type SaveCustomTableRowPayload = { values: Record<string, CustomTableCellValue> };
export type ImportCustomTableSheetPayload = { rows: Record<string, CustomTableCellValue>[] };
export type ImportCustomTableSheetResult = { rowsCreated: number };
