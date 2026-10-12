// pdfkit's browser bundle (fontkit + zlib + a Buffer polyfill all inlined) has no typings of its
// own; it exposes the same API as the Node build.
declare module "pdfkit/js/pdfkit.standalone" {
  import PDFDocument from "pdfkit";
  export default PDFDocument;
}
