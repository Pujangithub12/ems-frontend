/** The embedded fonts the Purchase Order / Proforma Invoice PDFs use — served as static files
 * from /public/fonts, fetched once per page load and kept in memory so every later PDF reuses them
 * (pdfkit's browser build takes them as ArrayBuffers). Call preloadPdfFonts() early (e.g. when a
 * page that can preview a PDF mounts) so the first preview doesn't wait on them. */
export interface PdfFonts {
  caladea700: ArrayBuffer;
  carlito400: ArrayBuffer;
  carlito700: ArrayBuffer;
  carlito400Italic: ArrayBuffer;
  carlito700Italic: ArrayBuffer;
}

const FONT_URLS: Record<keyof PdfFonts, string> = {
  caladea700: "/fonts/caladea-latin-700-normal.woff",
  carlito400: "/fonts/carlito-latin-400-normal.woff",
  carlito700: "/fonts/carlito-latin-700-normal.woff",
  carlito400Italic: "/fonts/carlito-latin-400-italic.woff",
  carlito700Italic: "/fonts/carlito-latin-700-italic.woff",
};

let fontsPromise: Promise<PdfFonts> | null = null;

const fetchFont = async (url: string): Promise<ArrayBuffer> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load PDF font (${res.status})`);
  return res.arrayBuffer();
};

export function loadPdfFonts(): Promise<PdfFonts> {
  if (!fontsPromise) {
    fontsPromise = Promise.all(Object.values(FONT_URLS).map(fetchFont))
      .then(([caladea700, carlito400, carlito700, carlito400Italic, carlito700Italic]) => ({
        caladea700: caladea700!,
        carlito400: carlito400!,
        carlito700: carlito700!,
        carlito400Italic: carlito400Italic!,
        carlito700Italic: carlito700Italic!,
      }))
      .catch((err) => {
        fontsPromise = null; // let the next attempt retry instead of caching the failure
        throw err;
      });
  }
  return fontsPromise;
}

/** Fire-and-forget warm-up; errors surface later, when a PDF is actually generated. */
export function preloadPdfFonts() {
  loadPdfFonts().catch(() => undefined);
}
