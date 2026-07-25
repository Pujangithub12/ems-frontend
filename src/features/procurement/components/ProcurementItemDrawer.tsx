import React, { useState } from "react";
import { Loader2, Upload, FileText, Trash2, X, Package, Wallet, Truck, CalendarClock } from "lucide-react";
import Drawer, { DrawerSection, DrawerRow } from "../../../components/Drawer";
import {
  useProcurementItemDetailQuery,
  useUploadProcurementAttachmentMutation,
  useDeleteProcurementAttachmentMutation,
} from "../hooks/useProcurement";
import { formatCost, computeItemCostBreakdown } from "../api/procurement.api";
import { getErrorMessage } from "../../../lib/errors";
import { STATUS_STYLES, CATEGORY_STYLES } from "./statusStyles";
import { ProcurementItem } from "../../../types";

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "--";

const StatTile: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
    <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-md bg-white border border-slate-200 text-slate-500">
      <Icon size={14} />
    </div>
    <div className="min-w-0">
      <div className="text-[10px] font-medium tracking-wide text-slate-400 uppercase truncate">{label}</div>
      <div className="text-[13px] font-semibold text-slate-900 truncate">{value}</div>
    </div>
  </div>
);

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
  const breakdown = item
    ? computeItemCostBreakdown(item)
    : { unitCost: 0, subtotal: 0, discountPercent: 0, discountAmount: 0, taxPercent: 0, taxAmount: 0, transportCost: 0, customsCost: 0, total: 0 };
  const { unitCost, subtotal, discountPercent, discountAmount, taxPercent, taxAmount, transportCost, customsCost, total: totalCost } = breakdown;
  const hasExtraCosts =
    item?.taxPercent != null || item?.discountPercent != null || item?.transportCost != null || item?.customsCost != null;
  const s = item ? STATUS_STYLES[item.status] : null;
  const c = item ? CATEGORY_STYLES[item.category] : null;

  return (
    <Drawer
      open={!!itemId}
      onClose={onClose}
      title={item?.itemName || "Loading…"}
      subtitle={item?.poNumber || undefined}
      width={480}
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

          {/* Hero: status/category pills + stat strip */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-1.5 mb-3">
              {s && (
                <span
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] uppercase font-semibold"
                  style={{ background: s.bg, color: s.fg }}
                >
                  {s.label}
                </span>
              )}
              {c && (
                <span
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium"
                  style={{ background: c.bg, color: c.fg }}
                >
                  {c.label}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile icon={Package} label="Quantity" value={`${item.quantity}${item.unit ? ` ${item.unit}` : ""}`} />
              <StatTile icon={Wallet} label="Total Cost" value={formatCost(totalCost)} />
              <StatTile icon={Truck} label="Vendor" value={item.vendor?.name || item.vendorName || "--"} />
              <StatTile icon={CalendarClock} label="Needed By" value={formatDate(item.neededByDate)} />
            </div>
          </div>

          <DrawerSection title="General Information">
            <DrawerRow label="PO Number">{item.poNumber || "--"}</DrawerRow>
            <DrawerRow label="Requested by">{item.requestedBy?.fullName || "--"}</DrawerRow>
            {item.notes && <DrawerRow label="Notes">{item.notes}</DrawerRow>}
          </DrawerSection>

          <DrawerSection title="Cost Breakdown">
            <DrawerRow label="Unit cost">{formatCost(unitCost)}</DrawerRow>
            <DrawerRow label="Quantity">{item.quantity}{item.unit ? ` ${item.unit}` : ""}</DrawerRow>
            {hasExtraCosts && <DrawerRow label="Subtotal">{formatCost(subtotal)}</DrawerRow>}
            {item.discountPercent != null && (
              <DrawerRow label={`Discount (${discountPercent}%)`}>-{formatCost(discountAmount)}</DrawerRow>
            )}
            {item.taxPercent != null && (
              <DrawerRow label={`Tax (${taxPercent}%)`}>+{formatCost(taxAmount)}</DrawerRow>
            )}
            {item.transportCost != null && (
              <DrawerRow label="Transport">+{formatCost(transportCost)}</DrawerRow>
            )}
            {item.customsCost != null && (
              <DrawerRow label="Customs">+{formatCost(customsCost)}</DrawerRow>
            )}
            <DrawerRow label="Total cost">{formatCost(totalCost)}</DrawerRow>
          </DrawerSection>

          <DrawerSection title="Status Timeline">
            {detail.statusHistory.length === 0 ? (
              <p className="text-[12px] text-slate-400">No status changes recorded.</p>
            ) : (
              <div className="relative">
                {[...detail.statusHistory].reverse().map((h, i, arr) => {
                  const hs = STATUS_STYLES[h.toStatus as ProcurementItem["status"]];
                  const isLast = i === arr.length - 1;
                  return (
                    <div key={h.id} className="relative flex gap-3 pb-3 last:pb-0">
                      {!isLast && (
                        <span className="absolute left-[5px] top-3 bottom-0 w-px bg-slate-200" />
                      )}
                      <span
                        className="relative z-10 flex-shrink-0 w-[11px] h-[11px] rounded-full border-2 border-white mt-0.5"
                        style={{ background: hs?.fg || "#94A3B8", boxShadow: "0 0 0 1px #E2E8F0" }}
                      />
                      <div className="flex items-center justify-between flex-1 min-w-0 text-[12px]">
                        <span className="text-slate-700">
                          {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus}
                        </span>
                        <span className="flex-shrink-0 ml-2 text-slate-400">{formatDate(h.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
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
