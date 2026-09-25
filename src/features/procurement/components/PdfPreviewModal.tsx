import React, { useEffect, useState } from "react";
import { AlertCircle, Download, Loader2, X } from "lucide-react";
import { getErrorMessage } from "../../../lib/errors";

/**
 * Fetches a PDF as an authenticated blob (credentials: "include" so the
 * httpOnly auth cookie goes along, same as the `<a href>` download links
 * elsewhere in this file) and shows it full-screen in a native <iframe> —
 * browsers render PDFs inline on their own, no viewer library needed. The
 * "Download" button inside just re-uses the same blob: URL with a `download`
 * attribute rather than re-fetching.
 */
const PdfPreviewModal: React.FC<{ url: string; fileName: string; onClose: () => void }> = ({
  url,
  fileName,
  onClose,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setBlobUrl(null);
    setError(null);

    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load PDF (${res.status})`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, "Failed to load PDF preview."));
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800 shrink-0">
        <h2 className="text-[14px] font-semibold text-white truncate">{fileName}</h2>
        <div className="flex items-center gap-2 ml-4">
          {blobUrl && (
            <a
              href={blobUrl}
              download={fileName}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors"
            >
              <Download size={14} /> Download
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
      <div className="flex-1 min-h-0">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <p className="text-[13px] text-slate-300">{error}</p>
          </div>
        ) : blobUrl ? (
          <iframe src={blobUrl} title={fileName} className="w-full h-full border-0 bg-white" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="text-[12px] text-slate-400">Loading preview...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfPreviewModal;
