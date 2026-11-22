import PDFDocument from "pdfkit/js/pdfkit.standalone";
import { loadPdfFonts } from "../../procurement/pdf/pdfFonts";
import type { AttendanceStatus, AttendanceSummaryRow } from "../api/attendance.api";

/** Monthly attendance register as a landscape A4 PDF, drawn in the browser like the procurement PDFs. Laid out
 * like a classic paper register: a plain ruled grid (white header, thin black lines), S.N. + employee name, one
 * column per day with P / A / L, the employee's totals on the right, and daily totals along the bottom. */

const LINE = "#000000";
const TEXT = "#111111";
const MUTED = "#555555";
const SAT_BG = "#F2F2F2";
const STATUS_ORDER: AttendanceStatus[] = ["present", "absent", "on_leave"];
const LETTER: Record<AttendanceStatus, string> = { present: "P", absent: "A", on_leave: "L" };
const LABEL: Record<AttendanceStatus, string> = { present: "PRESENT", absent: "ABSENT", on_leave: "ON LEAVE" };
const COLOR: Record<AttendanceStatus, string> = { present: "#0B6B3A", absent: "#B42318", on_leave: "#5B21B6" };

export type AttendancePdfInput = {
  organizationName: string;
  /** "YYYY-MM" */
  month: string;
  rows: AttendanceSummaryRow[];
};

export const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};

export async function generateAttendanceSummaryPdf({ organizationName, month, rows }: AttendancePdfInput): Promise<Blob> {
  const fonts = await loadPdfFonts();
  const M = 28;
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margins: { top: M, bottom: M, left: M, right: M } });
  doc.registerFont("Body", fonts.carlito400);
  doc.registerFont("Bold", fonts.carlito700);

  const W = doc.page.width - M * 2;
  const bottom = doc.page.height - M;
  const [y0, m0] = month.split("-").map(Number);
  const daysInMonth = new Date(y0!, m0!, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const wd = new Date(y0!, m0! - 1, i + 1).getDay();
    return { day: i + 1, date: `${month}-${String(i + 1).padStart(2, "0")}`, letter: "SMTWTFS"[wd]!, isSat: wd === 6 };
  });

  // ---- column geometry ----
  const snW = 22;
  const nameW = 130;
  const totW = 24;
  const totalsW = totW * STATUS_ORDER.length;
  const dayW = (W - snW - nameW - totalsW) / daysInMonth;
  const xName = M + snW;
  const xDays = xName + nameW;
  const xTotals = xDays + dayW * daysInMonth;
  const dayX = (i: number) => xDays + i * dayW;
  const totX = (i: number) => xTotals + i * totW;

  const headTopH = 13;
  const headBotH = 13;
  const headH = headTopH + headBotH;
  const rowH = 19;
  const dailyRowH = 14;

  const fit = (text: string, width: number, font: string, size: number) => {
    doc.font(font).fontSize(size);
    if (doc.widthOfString(text) <= width) return text;
    let t = text;
    while (t.length > 1 && doc.widthOfString(`${t}…`) > width) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  };
  const centerText = (text: string, x: number, w: number, top: number, h: number, font: string, size: number, color = TEXT) => {
    doc.fillColor(color).font(font).fontSize(size).text(text, x, top + h / 2 - size * 0.45, { width: w, align: "center", lineBreak: false });
  };
  const line = (x1: number, y1: number, x2: number, y2: number, width = 0.5) => {
    doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(width).strokeColor(LINE).stroke();
  };
  /** Shades the Saturday columns over [top, top + h). */
  const shadeSaturdays = (top: number, h: number) => {
    days.forEach((d, i) => {
      if (d.isSat) doc.rect(dayX(i), top, dayW, h).fill(SAT_BG);
    });
  };
  /** Vertical rules of the grid over [top, top + h). */
  const verticals = (top: number, h: number) => {
    line(xName, top, xName, top + h);
    days.forEach((_, i) => line(dayX(i), top, dayX(i), top + h));
    line(xTotals, top, xTotals, top + h, 1);
    STATUS_ORDER.forEach((_, i) => i > 0 && line(totX(i), top, totX(i), top + h));
  };

  let y = M;
  let tableTop = y;

  // ---- title ----
  doc.fillColor(TEXT).font("Bold").fontSize(14).text(organizationName.toUpperCase(), M, y, { width: W, align: "center" });
  y = doc.y + 1;
  doc.fillColor(TEXT).font("Bold").fontSize(11).text(`ATTENDANCE REGISTER — ${monthLabel(month).toUpperCase()}`, M, y, { width: W, align: "center" });
  y = doc.y + 3;
  doc.fillColor(MUTED).font("Body").fontSize(8).text("P = Present     A = Absent     L = On Leave     (blank = not marked)", M, y, { width: W, align: "center" });
  y = doc.y + 8;

  const drawHeader = () => {
    tableTop = y;
    shadeSaturdays(y, headH);
    // Employee name block spans both header rows; S.N. too.
    doc.fillColor(TEXT).font("Bold").fontSize(7.5).text("S.N.", M, y + headH / 2 - 3.4, { width: snW, align: "center", lineBreak: false });
    doc.fillColor(TEXT).font("Bold").fontSize(8.5).text("EMPLOYEE NAME", xName + 5, y + headH / 2 - 3.8, { width: nameW - 10, lineBreak: false });
    days.forEach((d, i) => {
      centerText(d.letter, dayX(i), dayW, y, headTopH, "Body", 6.5, MUTED);
      centerText(String(d.day), dayX(i), dayW, y + headTopH, headBotH, "Bold", 7.5);
    });
    centerText("TOTALS", xTotals, totalsW, y, headTopH, "Bold", 7);
    STATUS_ORDER.forEach((st, i) => centerText(LETTER[st], totX(i), totW, y + headTopH, headBotH, "Bold", 8, COLOR[st]));
    // rules
    line(M, y + headH, M + W, y + headH, 1);
    line(xDays, y + headTopH, xDays + dayW * daysInMonth, y + headTopH, 0.3);
    line(xTotals, y + headTopH, M + W, y + headTopH);
    line(M + snW, y, M + snW, y + headH);
    line(xName, y, xName, y + headH);
    days.forEach((_, i) => line(dayX(i), y, dayX(i), y + headH));
    line(xTotals, y, xTotals, y + headH, 1);
    STATUS_ORDER.forEach((_, i) => i > 0 && line(totX(i), y + headTopH, totX(i), y + headH));
    y += headH;
  };

  /** Closes the table on the current page: outer frame from tableTop to y. */
  const closeFrame = () => {
    doc.rect(M, tableTop, W, y - tableTop).lineWidth(1).strokeColor(LINE).stroke();
  };

  const newPage = () => {
    closeFrame();
    doc.addPage();
    y = M;
    drawHeader();
  };

  drawHeader();

  // ---- one row per employee ----
  const daily: Record<AttendanceStatus, number[]> = { present: days.map(() => 0), absent: days.map(() => 0), on_leave: days.map(() => 0) };
  rows.forEach((r, idx) => {
    if (y + rowH > bottom) newPage();
    shadeSaturdays(y, rowH);
    const byDate = new Map(r.days.map((d) => [d.date, d.status] as const));

    centerText(String(idx + 1), M, snW, y, rowH, "Body", 7.5, MUTED);
    const sub = r.jobPosition || r.role.replace("_", " ");
    const name = fit(r.fullName, nameW - 10, "Bold", 7.8);
    doc.fillColor(TEXT).font("Bold").fontSize(7.8).text(name, xName + 5, y + 2.8, { lineBreak: false });
    doc.fillColor(MUTED).font("Body").fontSize(6).text(fit(sub, nameW - 10, "Body", 6), xName + 5, y + 11, { lineBreak: false });

    days.forEach((d, i) => {
      const st = byDate.get(d.date);
      if (!st) return;
      daily[st][i]! += 1;
      centerText(LETTER[st], dayX(i), dayW, y, rowH, "Bold", 8, COLOR[st]);
    });
    STATUS_ORDER.forEach((st, i) => centerText(String(r[st]), totX(i), totW, y, rowH, "Bold", 8, r[st] ? COLOR[st] : "#9CA3AF"));

    line(M + snW, y, M + snW, y + rowH);
    verticals(y, rowH);
    line(M, y + rowH, M + W, y + rowH);
    y += rowH;
  });

  // ---- daily totals: how many employees were P / A / L on each day ----
  const dailyH = dailyRowH * STATUS_ORDER.length;
  if (y + dailyH > bottom) newPage();
  line(M, y, M + W, y, 1.4);
  const blockTop = y;
  const labelW = 62;
  shadeSaturdays(y, dailyH);
  doc.fillColor(TEXT).font("Bold").fontSize(8).text("DAILY", M, blockTop + dailyH / 2 - 9, { width: snW + labelW, align: "center", lineBreak: false });
  doc.fillColor(TEXT).font("Bold").fontSize(8).text("TOTALS", M, blockTop + dailyH / 2 + 1, { width: snW + labelW, align: "center", lineBreak: false });
  STATUS_ORDER.forEach((st, r) => {
    const top = blockTop + r * dailyRowH;
    doc.fillColor(TEXT).font("Bold").fontSize(7).text(LABEL[st], M + snW + labelW + 5, top + dailyRowH / 2 - 3.2, { width: nameW - labelW - 26, lineBreak: false });
    centerText(LETTER[st], xName + nameW - 16, 16, top, dailyRowH, "Bold", 7.5, COLOR[st]);
    days.forEach((_, i) => {
      const n = daily[st][i]!;
      if (n) centerText(String(n), dayX(i), dayW, top, dailyRowH, "Body", 7.5, COLOR[st]);
    });
    const total = daily[st].reduce((a, b) => a + b, 0);
    centerText(String(total), totX(STATUS_ORDER.indexOf(st)), totW, top, dailyRowH, "Bold", 8, total ? COLOR[st] : "#9CA3AF");
    if (r > 0) line(M + snW + labelW, top, M + W, top);
  });
  line(M + snW + labelW, blockTop, M + snW + labelW, blockTop + dailyH);
  line(xName + nameW - 16, blockTop, xName + nameW - 16, blockTop + dailyH);
  verticals(blockTop, dailyH);
  y = blockTop + dailyH;
  closeFrame();

  doc.fillColor(MUTED).font("Body").fontSize(7).text(
    `Generated ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
    M,
    Math.min(y + 6, bottom - 9),
    { width: W, align: "right", lineBreak: false },
  );

  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk as BlobPart));
    doc.on("end", () => resolve(new Blob(chunks, { type: "application/pdf" })));
    doc.on("error", reject);
    doc.end();
  });
}
