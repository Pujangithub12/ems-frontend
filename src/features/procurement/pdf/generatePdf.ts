import api from "../../../api/axios";
import { buildPurchaseOrderPdf, PurchaseOrderPdfData } from "./purchaseOrderPdf";
import { buildProformaInvoicePdf, ProformaInvoicePdfData } from "./proformaInvoicePdf";
import { buildQuotationPdf, QuotationPdfData } from "./quotationPdf";
import { loadPdfFonts } from "./pdfFonts";

/** Browser-side PDF generation for Purchase Orders and Proforma Invoices. The server only sends
 * the record's data (plus the letterhead images, base64) as JSON; the drawing happens here with
 * pdfkit's browser build, using the same layout code the backend used to run. */

type WireImages = { signatureImage: string | null; stampImage: string | null };

const base64ToArrayBuffer = (b64: string | null): ArrayBuffer | null => {
  if (!b64) return null;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
};

const toDate = (value: unknown): Date | null => (value ? new Date(value as string) : null);

/** Collects the finished pdfkit document into a Blob. */
function docToBlob(doc: PDFKit.PDFDocument): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk as BlobPart));
    doc.on("end", () => resolve(new Blob(chunks, { type: "application/pdf" })));
    doc.on("error", reject);
    doc.end();
  });
}

export async function generatePurchaseOrderPdf(id: number): Promise<Blob> {
  const [res, fonts] = await Promise.all([
    api.get<{ pdfData: Omit<PurchaseOrderPdfData, "createdAt" | "poDate" | "signatureImage" | "stampImage"> & { createdAt: string; poDate?: string | null } & WireImages }>(
      `/api/purchase-orders/${id}/pdf-data`,
    ),
    loadPdfFonts(),
  ]);
  const raw = res.data.pdfData;
  const data: PurchaseOrderPdfData = {
    ...raw,
    createdAt: toDate(raw.createdAt) ?? new Date(),
    poDate: toDate(raw.poDate),
    signatureImage: base64ToArrayBuffer(raw.signatureImage),
    stampImage: base64ToArrayBuffer(raw.stampImage),
  };
  return docToBlob(buildPurchaseOrderPdf(data, fonts));
}

export async function generateProformaInvoicePdf(id: number): Promise<Blob> {
  const [res, fonts] = await Promise.all([
    api.get<{ pdfData: Omit<ProformaInvoicePdfData, "piDate" | "signatureImage" | "stampImage"> & { piDate?: string | null } & WireImages }>(
      `/api/proforma-invoices/${id}/pdf-data`,
    ),
    loadPdfFonts(),
  ]);
  const raw = res.data.pdfData;
  const data: ProformaInvoicePdfData = {
    ...raw,
    piDate: toDate(raw.piDate),
    signatureImage: base64ToArrayBuffer(raw.signatureImage),
    stampImage: base64ToArrayBuffer(raw.stampImage),
  };
  return docToBlob(buildProformaInvoicePdf(data, fonts));
}

export async function generateQuotationPdf(id: number): Promise<Blob> {
  const [res, fonts] = await Promise.all([
    api.get<{ pdfData: Omit<QuotationPdfData, "quotationDate" | "signatureImage" | "stampImage" | "logoImage"> & { quotationDate?: string | null } & WireImages & { logoImage: string | null } }>(
      `/api/quotations/${id}/pdf-data`,
    ),
    loadPdfFonts(),
  ]);
  const raw = res.data.pdfData;
  const data: QuotationPdfData = {
    ...raw,
    quotationDate: toDate(raw.quotationDate),
    signatureImage: base64ToArrayBuffer(raw.signatureImage),
    stampImage: base64ToArrayBuffer(raw.stampImage),
    logoImage: base64ToArrayBuffer(raw.logoImage),
  };
  return docToBlob(buildQuotationPdf(data, fonts));
}
