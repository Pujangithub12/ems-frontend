import api from "../../../api/axios";
import { buildPurchaseOrderPdf, PurchaseOrderPdfData } from "./purchaseOrderPdf";
import { buildProformaInvoicePdf, ProformaInvoicePdfData } from "./proformaInvoicePdf";
import { buildQuotationPdf, QuotationPdfData } from "./quotationPdf";
import { buildRequisitionPdf } from "./requisitionPdf";
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

/** What the Requisition page's form holds (dates as YYYY-MM-DD strings straight from the date inputs). */
export interface RequisitionFormData {
  requisitionNo: string;
  date: string;
  requestedBy: string;
  projectLocation: string;
  priority: "normal" | "urgent" | "";
  items: { description: string; unit: string; qty: string; comment: string }[];
  reason: string;
  preferredSupplier: string;
  suggestedBrand: string;
  deliveryLocation: string;
  specialInstructions: string;
  approvals: [{ name: string; date: string }, { name: string; date: string }, { name: string; date: string }];
}

/** YYYY-MM-DD -> DD/MM/YYYY, parsed by hand so the time zone can't shift the day. */
const fmtFormDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

/** No server round trip at all - the form data is already in the browser. */
export interface RequisitionOrganization {
  name: string;
  address?: string | null;
  contact?: string | null;
  email?: string | null;
}

export async function generateRequisitionPdf(form: RequisitionFormData, organization: RequisitionOrganization): Promise<Blob> {
  const fonts = await loadPdfFonts();
  const doc = buildRequisitionPdf(
    {
      organizationName: organization.name,
      organizationAddress: organization.address,
      organizationContact: organization.contact,
      organizationEmail: organization.email,
      department: "Procurement Department",
      requisitionNo: form.requisitionNo,
      date: fmtFormDate(form.date),
      requestedBy: form.requestedBy,
      projectLocation: form.projectLocation,
      priority: form.priority,
      // Rows left completely empty are dropped; only filled rows are printed.
      items: form.items.filter((i) => [i.description, i.unit, i.qty, i.comment].some((v) => v.trim() !== "")),
      reason: form.reason,
      preferredSupplier: form.preferredSupplier,
      suggestedBrand: form.suggestedBrand,
      deliveryLocation: form.deliveryLocation,
      specialInstructions: form.specialInstructions,
      approvals: form.approvals.map((a) => ({ name: a.name, date: fmtFormDate(a.date) })) as [
        { name: string; date: string },
        { name: string; date: string },
        { name: string; date: string },
      ],
    },
    fonts,
  );
  return docToBlob(doc);
}
