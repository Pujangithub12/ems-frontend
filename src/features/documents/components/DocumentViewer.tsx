import React, { useEffect, useState } from "react";
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import "@cyntler/react-doc-viewer/dist/index.css";
import { X, Download, Loader2, AlertCircle } from "lucide-react";
import { ProjectFile } from "../../../types";
import api from "../../../api/axios";
import { organizationDownloadUrl } from "../api/organizationDocuments.api";
import { getErrorMessage } from "../../../lib/errors";

interface DocumentViewerProps {
  file: ProjectFile | null;
  onClose: () => void;
}

/** Fetches the file through the shared axios instance (so the httpOnly auth
 * cookie is sent) and hands react-doc-viewer a local blob: URL instead of
 * the raw API URL, since the viewer's own fetch has no knowledge of our
 * cookie-based auth. */
const DocumentViewer: React.FC<DocumentViewerProps> = ({ file, onClose }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    setLoading(true);
    setError(null);
    setBlobUrl(null);

    api
      .get(`/api/projects/files/${file.id}/view`, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setBlobUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, "Failed to load this document."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!file) return null;

  const downloadFileUrl = organizationDownloadUrl(file.id);

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
          <a
            href={downloadFileUrl}
            className="flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Download"
          >
            <Download size={16} />
          </a>

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
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="text-[12px] text-slate-400">Loading document...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <p className="text-[13px] text-slate-300">{error}</p>
            <a
              href={downloadFileUrl}
              className="mt-2 px-4 py-2 bg-blue-900 text-white text-[12px] font-medium rounded hover:bg-blue-800 transition-colors"
            >
              Download instead
            </a>
          </div>
        ) : blobUrl ? (
          <DocViewer
            documents={[{ uri: blobUrl, fileName: file.name, fileType: file.type ?? undefined }]}
            pluginRenderers={DocViewerRenderers}
            config={{
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
                      {file.type?.toUpperCase() || "This file"} isn't supported for in-browser preview.
                    </p>
                    <a
                      href={downloadFileUrl}
                      className="px-4 py-2 bg-blue-900 text-white text-[12px] font-medium rounded hover:bg-blue-800 transition-colors"
                    >
                      Download to View
                    </a>
                  </div>
                ),
              },
            }}
            style={{ height: "100%" }}
          />
        ) : null}
      </div>
    </div>
  );
};

export default DocumentViewer;
