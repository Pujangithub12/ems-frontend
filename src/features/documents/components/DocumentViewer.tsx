import React, { useEffect, useMemo, useRef, useState } from "react";
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import "@cyntler/react-doc-viewer/dist/index.css";
import { X, Download, Loader2, AlertCircle, ZoomIn, ZoomOut } from "lucide-react";
import { ProjectFile } from "../../../types";
import api, { apiBaseUrl } from "../../../api/axios";
import {
  organizationDownloadUrl,
  isOfficeFileType,
  getFileViewToken,
} from "../api/organizationDocuments.api";
import { getErrorMessage } from "../../../lib/errors";

interface DocumentViewerProps {
  file: ProjectFile | null;
  canDownload: boolean;
  onClose: () => void;
}

/** Microsoft's Office Online viewer fetches the signed URL itself, over the
 * open internet — it can't reach a host that isn't publicly routable, so
 * that path is only attempted when the API isn't on localhost/a private IP. */
function isPubliclyReachable(base: string): boolean {
  try {
    const host = new URL(base).hostname;
    return host !== "localhost" && host !== "127.0.0.1" && host !== "::1" && host !== "0.0.0.0";
  } catch {
    return false;
  }
}

/**
 * Two rendering paths, depending on file type:
 *  - PDF/image/text/csv render fully client-side (pdf.js / native <img>), so
 *    the file is fetched as an authenticated blob through the shared axios
 *    instance (sends our httpOnly cookie) and handed to react-doc-viewer as
 *    a local blob: URL.
 *  - Word/Excel/PowerPoint only have one renderer in this package: an iframe
 *    embedding Microsoft's Office Online viewer, which fetches the document
 *    itself and has no way to send our auth cookie. For those, we request a
 *    short-lived, single-file signed URL (the read-access check happens
 *    server-side before that URL is issued) and hand that to react-doc-viewer
 *    directly instead of a blob.
 */
const DocumentViewer: React.FC<DocumentViewerProps> = ({ file, canDownload, onClose }) => {
  const [docUri, setDocUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreachableLocally, setUnreachableLocally] = useState(false);
  // react-doc-viewer's own zoom controls only work while page 1 is on screen —
  // they recompute the render size from a bounding-rect measurement that goes
  // stale once you scroll to a later page, so clicking them past that point
  // silently does nothing.
  //
  // A tempting fix is wrapping DocViewer in CSS `zoom`, but that's actively
  // worse: `zoom` (unlike `transform`) changes the element's real layout box,
  // which fires the ResizeObserver DocViewer uses internally to measure
  // itself — that reset wipes every rendered canvas out completely and they
  // never come back (confirmed empirically: canvas count drops to 0 and
  // stays there). `transform: scale()` only repaints, never touches layout,
  // so it never trips that observer — this is the safe way to rescale it.
  const [zoom, setZoom] = useState(100);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevZoomRef = useRef(100);

  // transform: scale() doesn't affect layout, so the scroll container's own
  // scrollHeight never changes with it — the *visual* position of whatever
  // you were reading still moves though (its painted position scales around
  // the transform-origin), so scrollTop needs the same ratio correction here
  // that a layout-affecting zoom would have needed for a different reason.
  const changeZoom = (next: number) => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollTop * (next / prevZoomRef.current);
    prevZoomRef.current = next;
    setZoom(next);
  };

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    setLoading(true);
    setError(null);
    setDocUri(null);
    setUnreachableLocally(false);
    setZoom(100);

    if (isOfficeFileType(file.type)) {
      if (!isPubliclyReachable(apiBaseUrl)) {
        setUnreachableLocally(true);
        setLoading(false);
        return;
      }
      getFileViewToken(file.id)
        .then((url) => {
          if (!cancelled) setDocUri(url);
        })
        .catch((err) => {
          if (!cancelled) setError(getErrorMessage(err, "Failed to load this document."));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      api
        .get(`/api/projects/files/${file.id}/view`, { responseType: "blob" })
        .then((res) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(res.data);
          setDocUri(objectUrl);
        })
        .catch((err) => {
          if (!cancelled) setError(getErrorMessage(err, "Failed to load this document."));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // react-doc-viewer treats a new `documents` array reference as a newly
  // loaded document (resetting its internal render state, wiping every
  // canvas it had drawn) — without memoizing this, *any* re-render of
  // DocumentViewer (e.g. the zoom state changing) recreated this array
  // inline and blanked the page you were looking at.
  const documents = useMemo(
    () => (docUri ? [{ uri: docUri, fileName: file?.name, fileType: file?.type ?? undefined }] : []),
    [docUri, file?.name, file?.type],
  );

  const downloadFileUrl = file ? organizationDownloadUrl(file.id) : "";

  // Same reference-identity concern as `documents` above — inline-creating
  // this on every render (e.g. every zoom-state change) would reset
  // react-doc-viewer's internal state on every keystroke of a zoom click.
  const viewerConfig = useMemo(
    () => ({
      header: { disableHeader: true, disableFileName: true },
      pdfVerticalScrollByDefault: true,
      loadingRenderer: {
        overrideComponent: () => (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="text-[12px] text-slate-400">Rendering document...</span>
          </div>
        ),
      },
      noRenderer: {
        overrideComponent: () => (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-4">
            <div className="w-16 h-16 rounded-lg bg-slate-700 flex items-center justify-center mb-1">
              <span className="text-[24px] text-slate-400">📄</span>
            </div>
            <p className="text-[14px] text-slate-300">Cannot preview this file type</p>
            <p className="text-[12px] text-slate-400 mb-2">
              {file?.type?.toUpperCase() || "This file"} isn't supported for in-browser preview.
            </p>
            {canDownload && (
              <a
                href={downloadFileUrl}
                className="px-4 py-2 bg-blue-900 text-white text-[12px] font-medium rounded hover:bg-blue-800 transition-colors"
              >
                Download to View
              </a>
            )}
          </div>
        ),
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [file?.type, canDownload, downloadFileUrl],
  );

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800 shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-[14px] font-semibold text-white truncate">{file.name}</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {file.type?.toUpperCase()} • {file.size ? `${(file.size / 1024).toFixed(0)} KB` : "--"}
          </p>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {docUri && !isOfficeFileType(file.type) && (
            <>
              <button
                onClick={() => changeZoom(Math.max(50, zoom - 10))}
                disabled={zoom <= 50}
                className="flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-40"
                title="Zoom out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-[11px] text-slate-400 w-9 text-center tabular-nums">{zoom}%</span>
              <button
                onClick={() => changeZoom(Math.min(200, zoom + 10))}
                disabled={zoom >= 200}
                className="flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-40"
                title="Zoom in"
              >
                <ZoomIn size={16} />
              </button>
              <div className="w-px h-5 bg-slate-700 mx-1" />
            </>
          )}
          {canDownload && (
            <a
              href={downloadFileUrl}
              className="flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Download"
            >
              <Download size={16} />
            </a>
          )}

          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="text-[12px] text-slate-400">Loading document...</span>
          </div>
        ) : unreachableLocally ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-4">
            <AlertCircle className="w-6 h-6 text-amber-400" />
            <p className="text-[13px] text-slate-300">Preview unavailable on this host</p>
            <p className="text-[12px] text-slate-400 max-w-sm">
              Office documents preview through Microsoft's online viewer, which needs a publicly
              reachable URL — this only works once the app is deployed, not on localhost.
            </p>
            {canDownload && (
              <a
                href={downloadFileUrl}
                className="mt-2 px-4 py-2 bg-blue-900 text-white text-[12px] font-medium rounded hover:bg-blue-800 transition-colors"
              >
                Download instead
              </a>
            )}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <p className="text-[13px] text-slate-300">{error}</p>
            {canDownload && (
              <a
                href={downloadFileUrl}
                className="mt-2 px-4 py-2 bg-blue-900 text-white text-[12px] font-medium rounded hover:bg-blue-800 transition-colors"
              >
                Download instead
              </a>
            )}
          </div>
        ) : docUri ? (
          <>
            {/* The library's own PDF zoom buttons (#pdf-zoom-in/#pdf-zoom-out)
               stop working once you've scrolled past the first page — replaced
               by the working zoom controls in our header above, so this
               now-redundant (and broken-when-scrolled) toolbar is hidden. */}
            <style>{`#pdf-controls { display: none !important; }`}</style>
            <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center", height: "100%" }}>
              <DocViewer
                documents={documents}
                pluginRenderers={DocViewerRenderers}
                config={viewerConfig}
                style={{ height: "100%", backgroundColor: "#0f172a" }}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default DocumentViewer;
