import React, { useState } from "react";
import { Loader2, Upload, FileText, Trash2, X } from "lucide-react";
import Drawer, { DrawerSection, DrawerRow } from "../../../components/Drawer";
import {
  useProcurementItemDetailQuery,
  useUploadProcurementAttachmentMutation,
  useDeleteProcurementAttachmentMutation,
} from "../hooks/useProcurement";
import { formatCost, toNumber } from "../api/procurement.api";
import { getErrorMessage } from "../../../lib/errors";

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "--";

const ProcurementItemDrawer: React.FC<{
  itemId: number | null;
  onClose: () => void;
  isAdmin: boolean;
}> = ({ itemId, onClose, isAdmin }) => {
  const detailQuery = useProcurementItemDetailQuery(itemId);
  const detail = detailQuery.data;
  const uploadAttachmentMutation = useUploadProcurementAttachmentMutation();
  const deleteAttachmentMutation = useDeleteProcurementAttachmentMutation();
  const [error, setError] = useState<string | null>(null);

  if (!itemId) return null;
  const item = detail?.item;
  const unitCost = item ? toNumber(item.unitCost ?? item.estimatedCost) : 0;
  const totalCost = item ? unitCost * item.quantity : 0;

  return (
    <Drawer
      open={!!itemId}
      onClose={onClose}
      title={item?.itemName || "Loading…"}
      subtitle={item?.poNumber || undefined}
      width={460}
    >
      {detailQuery.isLoading || !detail || !item ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        </div>
      ) : (
        <>
          {error && (
            <div className="flex items-center justify-between px-5 py-2 text-[12px] text-red-700 bg-red-50 border-b border-red-200">
              <span>{error}</span>
              <button onClick={() => setError(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          <DrawerSection title="General Information">
            <DrawerRow label="PO Number">{item.poNumber || "--"}</DrawerRow>
            <DrawerRow label="Category">{item.category}</DrawerRow>
            <DrawerRow label="Quantity">{item.quantity}</DrawerRow>
            <DrawerRow label="Needed by">{formatDate(item.neededByDate)}</DrawerRow>
            <DrawerRow label="Requested by">{item.requestedBy?.fullName || "--"}</DrawerRow>
            {item.notes && <DrawerRow label="Notes">{item.notes}</DrawerRow>}
          </DrawerSection>

          <DrawerSection title="Cost Breakdown">
            <DrawerRow label="Unit cost">{formatCost(unitCost)}</DrawerRow>
            <DrawerRow label="Quantity">{item.quantity}</DrawerRow>
            <DrawerRow label="Total cost">{formatCost(totalCost)}</DrawerRow>
          </DrawerSection>

          <DrawerSection title="Vendor Information">
            <DrawerRow label="Vendor">{item.vendor?.name || item.vendorName || "--"}</DrawerRow>
          </DrawerSection>

          <DrawerSection title="Status Timeline">
            {detail.statusHistory.length === 0 ? (
              <p className="text-[12px] text-slate-400">No status changes recorded.</p>
            ) : (
              detail.statusHistory.map((h) => (
                <div key={h.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-[12px]">
                  <span className="text-slate-700">
                    {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus}
                  </span>
                  <span className="text-slate-400">{formatDate(h.createdAt)}</span>
                </div>
              ))
            )}
          </DrawerSection>

          <DrawerSection title="Project Allocation">
            {detail.projectAllocation.length === 0 ? (
              <p className="text-[12px] text-slate-400">Not requested in any other project.</p>
            ) : (
              detail.projectAllocation.map((row) => (
                <DrawerRow key={row.id} label={row.projectName || `Project #${row.projectId}`}>
                  {row.quantity}
                </DrawerRow>
              ))
            )}
          </DrawerSection>

          <DrawerSection
            title="Documents"
            action={
              isAdmin && (
                <label className="flex items-center gap-1 text-[11px] font-medium text-blue-900 hover:underline cursor-pointer">
                  <Upload size={12} /> Upload
                  <input
                    type="file"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setError(null);
                      try {
                        await uploadAttachmentMutation.mutateAsync({ itemId: item.id, file });
                        await detailQuery.refetch();
                      } catch (err) {
                        setError(getErrorMessage(err, "Failed to upload file."));
                      } finally {
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              )
            }
          >
            {detail.attachments.length === 0 ? (
              <p className="text-[12px] text-slate-400">No documents attached.</p>
            ) : (
              detail.attachments.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-[12px]">
                  <a
                    href={`${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/uploads/${a.filePath}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-blue-900 hover:underline truncate"
                  >
                    <FileText size={12} /> {a.fileName}
                  </a>
                  {isAdmin && (
                    <button
                      onClick={async () => {
                        await deleteAttachmentMutation.mutateAsync({ itemId: item.id, attachmentId: a.id });
                        await detailQuery.refetch();
                      }}
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))
            )}
          </DrawerSection>
        </>
      )}
    </Drawer>
  );
};

export default ProcurementItemDrawer;
