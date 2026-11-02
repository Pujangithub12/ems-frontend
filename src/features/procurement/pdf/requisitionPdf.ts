import PDFDocument from "pdfkit/js/pdfkit.standalone";
import type { PdfFonts } from "./pdfFonts";

/** The "Purchase Requisition Form" - a blank-style paper form (header block, numbered item grid,
 * reason box, procurement details, three-column approval block) filled in from the Requisition
 * page. A4 portrait, drawn in the browser like the other procurement PDFs. */

export interface RequisitionItem {
  description: string;
  unit: string;
  qty: string;
  comment: string;
}

export interface RequisitionApproval {
  name: string;
  /** Already formatted for display (e.g. "02/11/2026"); empty leaves the date line blank for hand-writing. */
  date: string;
}

export interface RequisitionPdfData {
  organizationName: string;
  /** Shown in a line right under the company name (from Settings > Organization). */
  organizationAddress?: string | null;
  organizationContact?: string | null;
  organizationEmail?: string | null;
  department: string;
  requisitionNo: string;
  date: string;
  requestedBy: string;
  projectLocation: string;
  priority: "normal" | "urgent" | "";
  items: RequisitionItem[];
  reason: string;
  preferredSupplier: string;
  suggestedBrand: string;
  deliveryLocation: string;
  specialInstructions: string;
  /** Prepared/Requested By, Procurement Officer, Final Approver - in that order. */
  approvals: [RequisitionApproval, RequisitionApproval, RequisitionApproval];
}

const NAVY = "#1F3A5F";
const NAVY_TEXT = "#1F3350";
const MUTED = "#6B7A90";
const LABEL_BG = "#E9EEF6";
const BORDER = "#A9B7C9";
const TEXT = "#111827";

const PAGE_MARGIN = 40;

const F_REG = "Body";
const F_BOLD = "Body-Bold";

export function buildRequisitionPdf(data: RequisitionPdfData, fonts: PdfFonts): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN } });
  doc.registerFont(F_REG, fonts.carlito400);
  doc.registerFont(F_BOLD, fonts.carlito700);

  const X = PAGE_MARGIN;
  const W = doc.page.width - PAGE_MARGIN * 2;
  const bottom = () => doc.page.height - PAGE_MARGIN;
  let y = PAGE_MARGIN;

  const ensureSpace = (h: number) => {
    if (y + h > bottom()) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  };

  const textH = (text: string, width: number, font: string, size: number) =>
    text ? doc.font(font).fontSize(size).heightOfString(text, { width }) : 0;

  /** One bordered cell; optional fill and text. */
  const cell = (
    x: number,
    cy: number,
    w: number,
    h: number,
    opts: { fill?: string; text?: string; font?: string; size?: number; color?: string; align?: "left" | "center" | "right"; pad?: number; vcenter?: boolean } = {},
  ) => {
    if (opts.fill) doc.rect(x, cy, w, h).fill(opts.fill);
    doc.rect(x, cy, w, h).lineWidth(0.6).strokeColor(BORDER).stroke();
    if (opts.text) {
      const size = opts.size ?? 8.5;
      const pad = opts.pad ?? 6;
      const font = opts.font ?? F_REG;
      const th = textH(opts.text, w - pad * 2, font, size);
      const ty = opts.vcenter === false ? cy + 6 : cy + Math.max(3, (h - th) / 2);
      doc.fillColor(opts.color ?? TEXT).font(font).fontSize(size).text(opts.text, x + pad, ty, { width: w - pad * 2, align: opts.align ?? "left" });
    }
  };

  // ---- Title block ----
  doc.fillColor(NAVY_TEXT).font(F_BOLD).fontSize(16).text(data.organizationName.toUpperCase(), X, y, { width: W, align: "center" });
  y = doc.y + 3;
  const contactLine = [data.organizationAddress, data.organizationContact, data.organizationEmail]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join("  |  ");
  if (contactLine) {
    doc.fillColor(TEXT).font(F_REG).fontSize(8.5).text(contactLine, X, y, { width: W, align: "center" });
    y = doc.y + 4;
  }
  doc.fillColor(MUTED).font(F_BOLD).fontSize(9.5).text(data.department.toUpperCase(), X, y, { width: W, align: "center" });
  y = doc.y + 3;
  doc.fillColor(NAVY_TEXT).font(F_BOLD).fontSize(11).text("PURCHASE REQUISITION FORM", X, y, { width: W, align: "center" });
  y = doc.y + 16;

  // ---- Header info table: Requisition No. / Date, Requested By / Project Location, Priority ----
  const c1 = 108;
  const c2 = 150;
  const c3 = 108;
  const c4 = W - c1 - c2 - c3;
  const rowH = 25;
  const infoRow = (l1: string, v1: string, l2: string, v2: string) => {
    const h = Math.max(rowH, textH(v1, c2 - 12, F_REG, 8.5) + 12, textH(v2, c4 - 12, F_REG, 8.5) + 12);
    cell(X, y, c1, h, { fill: LABEL_BG, text: l1, font: F_BOLD, size: 8, color: NAVY_TEXT });
    cell(X + c1, y, c2, h, { text: v1 });
    cell(X + c1 + c2, y, c3, h, { fill: LABEL_BG, text: l2, font: F_BOLD, size: 8, color: NAVY_TEXT });
    cell(X + c1 + c2 + c3, y, c4, h, { text: v2 });
    y += h;
  };
  infoRow("Requisition No.:", data.requisitionNo, "Date:", data.date);
  infoRow("Requested By:", data.requestedBy, "Project Location:", data.projectLocation);

  // Priority row: label, the two check boxes, and an empty merged cell (as on the paper form)
  cell(X, y, c1, rowH, { fill: LABEL_BG, text: "Priority:", font: F_BOLD, size: 8, color: NAVY_TEXT });
  cell(X + c1, y, c2, rowH);
  cell(X + c1 + c2, y, c3 + c4, rowH);
  const drawCheckbox = (bx: number, label: string, checked: boolean) => {
    const by = y + (rowH - 9) / 2;
    doc.rect(bx, by, 9, 9).lineWidth(0.8).strokeColor(TEXT).stroke();
    if (checked) {
      doc.moveTo(bx + 1.8, by + 4.8).lineTo(bx + 3.8, by + 7.2).lineTo(bx + 7.6, by + 1.6).lineWidth(1.3).strokeColor(TEXT).stroke();
    }
    doc.fillColor(TEXT).font(F_REG).fontSize(9).text(label, bx + 13, y + (rowH - 9) / 2 + 0.5, { lineBreak: false });
  };
  drawCheckbox(X + c1 + 10, "Normal", data.priority === "normal");
  drawCheckbox(X + c1 + 78, "Urgent", data.priority === "urgent");
  y += rowH + 14;

  // ---- 1. Item requisition details ----
  const heading = (label: string) => {
    ensureSpace(24);
    doc.fillColor(NAVY_TEXT).font(F_BOLD).fontSize(10).text(label, X, y, { lineBreak: false });
    y += 15;
  };
  heading("1. ITEM REQUISITION DETAILS");

  const colSN = W * 0.069;
  const colDesc = W * 0.444;
  const colUnit = W * 0.111;
  const colQty = W * 0.09;
  const colComment = W - colSN - colDesc - colUnit - colQty;
  const colX = [X, X + colSN, X + colSN + colDesc, X + colSN + colDesc + colUnit, X + colSN + colDesc + colUnit + colQty];
  const colWs = [colSN, colDesc, colUnit, colQty, colComment];
  const headerLabels = ["S.N.", "Item Description / Specifications", "Unit", "Qty.", "Comment"];
  const headerH = 17;

  const drawItemsHeader = () => {
    doc.rect(X, y, W, headerH).fill(NAVY);
    headerLabels.forEach((label, i) => {
      doc.fillColor("#ffffff").font(F_BOLD).fontSize(7.5).text(label, colX[i]!, y + 5, { width: colWs[i]!, align: "center", lineBreak: false });
    });
    y += headerH;
  };
  ensureSpace(headerH + 44);
  drawItemsHeader();

  const rows: RequisitionItem[] = [...data.items];
  // Only the rows that were filled in are printed; a completely empty list still gets one blank row.
  if (rows.length === 0) rows.push({ description: "", unit: "", qty: "", comment: "" });
  rows.forEach((item, idx) => {
    const h = Math.max(
      36,
      textH(item.description, colDesc - 12, F_REG, 8.5) + 14,
      textH(item.comment, colComment - 12, F_REG, 8.5) + 14,
    );
    if (y + h > bottom()) {
      doc.addPage();
      y = PAGE_MARGIN;
      drawItemsHeader();
    }
    cell(colX[0]!, y, colWs[0]!, h, { text: String(idx + 1), size: 7.5, align: "center", pad: 2 });
    cell(colX[1]!, y, colWs[1]!, h, { text: item.description });
    cell(colX[2]!, y, colWs[2]!, h, { text: item.unit, align: "center", pad: 3 });
    cell(colX[3]!, y, colWs[3]!, h, { text: item.qty, align: "center", pad: 3 });
    cell(colX[4]!, y, colWs[4]!, h, { text: item.comment });
    y += h;
  });
  y += 16;

  // ---- 2. Reason for requisition ----
  heading("2. REASON FOR REQUISITION");
  const reasonH = Math.max(66, textH(data.reason, W - 16, F_REG, 8.5) + 16);
  ensureSpace(reasonH + 14);
  cell(X, y, W, reasonH, { text: data.reason, vcenter: false, pad: 8 });
  y += reasonH + 16;

  // ---- 3. Procurement details ----
  heading("3. PROCUREMENT DETAILS");
  const labelW = 190;
  const detailRows: [string, string][] = [
    ["Preferred supplier (if any):", data.preferredSupplier],
    ["Suggested brand / specification:", data.suggestedBrand],
    ["Delivery location:", data.deliveryLocation],
    ["Special instructions:", data.specialInstructions],
  ];
  detailRows.forEach(([label, value]) => {
    const h = Math.max(25, textH(value, W - labelW - 12, F_REG, 8.5) + 12);
    ensureSpace(h);
    cell(X, y, labelW, h, { fill: LABEL_BG, text: label, font: F_BOLD, size: 8, color: NAVY_TEXT });
    cell(X + labelW, y, W - labelW, h, { text: value });
    y += h;
  });
  y += 16;

  // ---- 4. Approval & authorization ----
  heading("4. APPROVAL & AUTHORIZATION");
  const apprHeaderH = 17;
  const apprBodyH = 82;
  ensureSpace(apprHeaderH + apprBodyH);
  const colW3 = W / 3;
  const titles = ["PREPARED / REQUESTED BY", "PROCUREMENT OFFICER", "FINAL APPROVER"];
  doc.rect(X, y, W, apprHeaderH).fill(NAVY);
  titles.forEach((t, i) => {
    doc.fillColor("#ffffff").font(F_BOLD).fontSize(7.5).text(t, X + i * colW3, y + 5, { width: colW3, align: "center", lineBreak: false });
  });
  y += apprHeaderH;
  doc.rect(X, y, W, apprBodyH).lineWidth(0.6).strokeColor(BORDER).stroke();
  [1, 2].forEach((i) => doc.moveTo(X + i * colW3, y).lineTo(X + i * colW3, y + apprBodyH).lineWidth(0.6).strokeColor(BORDER).stroke());
  data.approvals.forEach((a, i) => {
    const bx = X + i * colW3 + 10;
    const lineEnd = X + (i + 1) * colW3 - 28;
    const fields: [string, string][] = [
      ["Name:", a.name],
      ["Signature:", ""],
      ["Date:", a.date],
    ];
    fields.forEach(([label, value], r) => {
      const fy = y + 16 + r * 24;
      doc.fillColor(TEXT).font(F_REG).fontSize(8).text(label, bx, fy, { lineBreak: false });
      const lx = bx + doc.font(F_REG).fontSize(8).widthOfString(label) + 4;
      doc.moveTo(lx, fy + 9).lineTo(lineEnd, fy + 9).lineWidth(0.7).strokeColor(TEXT).stroke();
      if (value) doc.fillColor(TEXT).font(F_REG).fontSize(8.5).text(value, lx + 2, fy - 1.5, { width: lineEnd - lx - 2, lineBreak: false, ellipsis: true });
    });
  });
  y += apprBodyH;

  return doc;
}
