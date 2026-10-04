/** Triggers a browser download for an in-memory Blob — used by PDF export buttons that fetch
 * the file as a blob (see fetchCostBreakdownPdf/fetchShipmentTrackingPdf) rather than linking
 * straight to the API (those routes need the auth cookie + X-Workspace-Id header, which a plain
 * `<a href>` wouldn't send), mirroring PdfPreviewModal's blob-URL download pattern. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
