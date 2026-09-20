import NepaliDate from "nepali-date-converter";
import * as XLSX from "xlsx";
import { adDateForBsDay } from "../../../lib/bsDate";
import type { PurchaseBill, PurchaseBillStatus, SavePurchaseBillPayload } from "../api/purchase.api";

const pad = (n: number) => String(n).padStart(2, "0");

/** AD ISO date -> Bikram Sambat "YYYY-MM-DD" (the calendar this page shows). */
export function adToBs(adIso: string): string {
  const d = new Date(`${adIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  try {
    const bs = NepaliDate.fromAD(d);
    return `${bs.getYear()}-${pad(bs.getMonth() + 1)}-${pad(bs.getDate())}`;
  } catch {
    return "";
  }
}

/** Bikram Sambat "YYYY-MM-DD" -> AD ISO date, or null when it isn't a real BS date. */
export function bsToAd(bs: string): string | null {
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(bs.trim());
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  try {
    const ad = adDateForBsDay(year, month - 1, day);
    return adToBs(ad) === `${year}-${pad(month)}-${pad(day)}` ? ad : null;
  } catch {
    return null;
  }
}

/** Timestamp -> "2082-02-15 10:24 AM" (BS date, local time). */
export function bsDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const adLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return `${adToBs(adLocal)} ${time}`;
}

export const addDaysIso = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysBetweenInclusive = (fromIso: string, toIso: string): number =>
  Math.round((new Date(`${toIso}T00:00:00Z`).getTime() - new Date(`${fromIso}T00:00:00Z`).getTime()) / 86400000) + 1;

/** Nothing here is stored — amount, VAT, total and balance are always derived. */
export function computeAmounts(b: Pick<PurchaseBill, "quantity" | "rate" | "vatRate" | "actualAmount">) {
  const amount = b.quantity * b.rate;
  const vat = (amount * b.vatRate) / 100;
  const total = amount + vat;
  return { amount, vat, total, balance: Math.max(total - b.actualAmount, 0) };
}

export function paymentStatusOf(b: Pick<PurchaseBill, "quantity" | "rate" | "vatRate" | "actualAmount">): PurchaseBillStatus {
  const { total } = computeAmounts(b);
  if (b.actualAmount <= 0) return "pending";
  return b.actualAmount >= total - 0.005 ? "paid" : "partial";
}

export const money = (n: number): string => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---- Excel import ----

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "miti"],
  billNo: ["bill no", "bill number", "billno", "invoice no", "invoice number"],
  challanNo: ["challan no", "challan number", "challan", "challanno"],
  vendorName: ["vendor name", "vendor", "supplier", "supplier name"],
  material: [
    "material / particulars",
    "material/particulars",
    "name of materials/particulars",
    "name of materials / particulars",
    "name of material",
    "name of materials",
    "material",
    "materials",
    "particulars",
    "item",
    "description",
  ],
  unit: ["unit"],
  quantity: ["qty", "quantity"],
  rate: ["rate", "unit price"],
  vat: ["vat", "vat amount"],
  vatRate: ["vat %", "vat rate", "vat (%)"],
  actualAmount: ["actual amount", "paid amount", "amount paid", "actual"],
  vehicleNo: ["vehicle no", "vehicle number", "vehicle"],
  paymentMode: ["cash/credit", "cash / credit", "payment mode", "mode"],
  paidBy: ["paid by"],
  billStatus: ["bill status", "status"],
  site: ["site"],
  remarks: ["remarks", "remark", "note", "notes"],
};

const normHeader = (h: unknown): string =>
  String(h ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();

const toNum = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(n) ? n : null;
};

const toStr = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
};

export type SheetDateFormat = "BS" | "AD";

/** A date cell — an Excel date (its y/m/d are read as-is) or text such as
 * 2083/05/22 or 22-05-2083. `format` says which calendar those numbers are in:
 * BS dates are converted to AD for storage, AD dates are validated as-is. */
function parseSheetDate(v: unknown, format: SheetDateFormat): string | null {
  let y: number;
  let m: number;
  let d: number;
  if (typeof v === "number" && v > 1000) {
    const parts = XLSX.SSF.parse_date_code(v);
    if (!parts) return null;
    [y, m, d] = [parts.y, parts.m, parts.d];
  } else {
    const s = toStr(v);
    if (!s) return null;
    const nums = s.split(/[-/.\s]+/).map(Number);
    if (nums.length !== 3 || nums.some((n) => !Number.isFinite(n))) return null;
    const [a, b, c] = nums;
    [y, m, d] = a > 31 ? [a, b, c] : [c, b, a];
  }
  if (format === "BS") return bsToAd(`${y}-${m}-${d}`);
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  const check = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(check.getTime()) && check.getUTCMonth() + 1 === m && check.getUTCDate() === d ? iso : null;
}

export type ParsedPurchaseSheet = {
  rows: Omit<SavePurchaseBillPayload, "projectId">[];
  errors: { row: number; message: string }[];
};

/** Reads the first sheet of an .xlsx/.csv, matching columns to bill fields by
 * header name. Rows missing a date/vendor/material are reported, not sent. */
export async function parsePurchaseSheet(file: File, dateFormat: SheetDateFormat = "BS"): Promise<ParsedPurchaseSheet> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  if (grid.length === 0) return { rows: [], errors: [] };

  const columnOf: Record<string, number> = {};
  (grid[0] as unknown[]).forEach((h, idx) => {
    const name = normHeader(h);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(name) && columnOf[field] === undefined) columnOf[field] = idx;
    }
  });

  const cell = (row: unknown[], field: string): unknown => (columnOf[field] === undefined ? null : row[columnOf[field]]);
  const rows: ParsedPurchaseSheet["rows"] = [];
  const errors: ParsedPurchaseSheet["errors"] = [];

  grid.slice(1).forEach((row, i) => {
    const rowNumber = i + 2;
    if (!row || row.every((c) => c == null || String(c).trim() === "")) return;

    // Sheets often carry pre-filled formula rows (all zeros) below the data — not real entries.
    const hasEntry = ["date", "billNo", "challanNo", "vendorName", "material", "quantity", "rate"].some((f) => {
      const v = cell(row, f);
      return v != null && String(v).trim() !== "" && Number(v) !== 0;
    });
    if (!hasEntry) return;

    const date = parseSheetDate(cell(row, "date"), dateFormat);
    let vendorName = toStr(cell(row, "vendorName"));
    let material = toStr(cell(row, "material"));
    if (!date) return void errors.push({ row: rowNumber, message: "missing or invalid date" });
    if (!material) return void errors.push({ row: rowNumber, message: "missing material" });
    // Vendor column left empty but the material reads "Vendor - Item" (e.g. "Sarbottam Cement - PPC").
    if (!vendorName && material.includes(" - ")) {
      const at = material.indexOf(" - ");
      vendorName = material.slice(0, at).trim() || null;
      material = material.slice(at + 3).trim() || material;
    }
    vendorName = vendorName ?? "-";

    const quantity = toNum(cell(row, "quantity")) ?? 0;
    const rate = toNum(cell(row, "rate")) ?? 0;
    const vatAmount = toNum(cell(row, "vat"));
    const explicitVatRate = toNum(cell(row, "vatRate"));
    const amount = quantity * rate;
    const vatRate =
      explicitVatRate ?? (vatAmount != null && amount > 0 ? Math.round((vatAmount / amount) * 10000) / 100 : null);

    const mode = toStr(cell(row, "paymentMode"))?.toLowerCase();
    const status = toStr(cell(row, "billStatus"))?.toLowerCase();

    rows.push({
      date,
      billNo: toStr(cell(row, "billNo")),
      challanNo: toStr(cell(row, "challanNo")),
      vendorName,
      material,
      unit: toStr(cell(row, "unit")),
      quantity,
      rate,
      vatRate,
      actualAmount: toNum(cell(row, "actualAmount")),
      vehicleNo: toStr(cell(row, "vehicleNo")) === "-" ? null : toStr(cell(row, "vehicleNo")),
      paymentMode: mode ? (mode.includes("cash") ? "cash" : "credit") : null,
      paidBy: toStr(cell(row, "paidBy")) === "-" ? null : toStr(cell(row, "paidBy")),
      billStatus: status ? (status.startsWith("paid") ? "paid" : status.startsWith("part") ? "partial" : status.startsWith("pend") ? "pending" : null) : null,
      site: toStr(cell(row, "site")),
      remarks: toStr(cell(row, "remarks")) === "-" ? null : toStr(cell(row, "remarks")),
    });
  });

  return { rows, errors };
}

// ---- "Download Bill (PDF)" — opens a print view; the browser's Save as PDF does the rest ----

const esc = (v: unknown): string =>
  String(v ?? "—").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export function printBill(bill: PurchaseBill): void {
  const { amount, vat, total } = computeAmounts(bill);
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return;
  const row = (label: string, value: unknown) =>
    `<tr><td class="l">${esc(label)}</td><td>${esc(value)}</td></tr>`;
  w.document.write(`<!doctype html><html><head><title>Bill ${esc(bill.billNo ?? bill.id)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;font-size:13px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:13px;margin:22px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
table{border-collapse:collapse;width:100%}td,th{padding:6px 8px;text-align:left;vertical-align:top}
.l{color:#666;width:34%}.items th{background:#f1f5f9;border:1px solid #ddd}.items td{border:1px solid #ddd}
.r{text-align:right}.tot td{font-weight:700}
</style></head><body>
<h1>${esc(bill.vendorName)}</h1>
<div>Bill No: <b>${esc(bill.billNo)}</b> &nbsp; Date: <b>${esc(adToBs(bill.date))}</b> &nbsp; Challan No: <b>${esc(bill.challanNo)}</b></div>
<h2>Vendor Information</h2>
<table>${row("Vendor Name", bill.vendorName)}${row("Contact Person", bill.vendor?.contactPerson)}${row("Phone", bill.vendor?.phone)}${row("Address", bill.vendor?.address)}</table>
<h2>Items</h2>
<table class="items"><tr><th>Particulars</th><th>Unit</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr>
<tr><td>${esc(bill.material)}</td><td>${esc(bill.unit)}</td><td class="r">${bill.quantity.toLocaleString()}</td><td class="r">${money(bill.rate)}</td><td class="r">${money(amount)}</td></tr></table>
<table style="margin-top:8px;width:50%;margin-left:50%">
<tr><td>Sub Total</td><td class="r">${money(amount)}</td></tr>
<tr><td>VAT (${bill.vatRate}%)</td><td class="r">${money(vat)}</td></tr>
<tr class="tot"><td>Total Amount</td><td class="r">${money(total)}</td></tr>
<tr class="tot"><td>Actual Amount</td><td class="r">${money(bill.actualAmount)}</td></tr></table>
<h2>Payment &amp; Logistics</h2>
<table>${row("Cash/Credit", bill.paymentMode === "cash" ? "Cash" : "Credit")}${row("Paid By", bill.paidBy)}${row("Vehicle No.", bill.vehicleNo)}${row("Bill Status", bill.billStatus)}${row("Remarks", bill.remarks)}</table>
<h2>Additional Information</h2>
<table>${row("Project", bill.projectName)}${row("Site", bill.site)}${row("Created By", bill.createdByName)}</table>
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}
