import React, { useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  FileText,
  ArrowRightLeft,
  PackagePlus,
  Check,
  X,
} from "lucide-react";
import Drawer, { DrawerSection, DrawerRow } from "../../../components/Drawer";
import { Warehouse } from "../../../types";
import {
  useInventoryItemDetailQuery,
  useAdjustInventoryStockMutation,
  useCreateStockTransferMutation,
  useUpdateStockTransferStatusMutation,
  useAddInventoryBatchMutation,
  useDeleteInventoryBatchMutation,
  useAddInventorySerialMutation,
  useDeleteInventorySerialMutation,
  useUploadInventoryAttachmentMutation,
  useDeleteInventoryAttachmentMutation,
} from "../hooks/useInventory";
import { formatCost, toNumber } from "../../procurement/api/procurement.api";
import { getErrorMessage } from "../../../lib/errors";

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "--";

const TX_LABELS: Record<string, string> = {
  receipt: "Receipt",
  issue: "Issue",
  adjustment: "Adjustment",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
};

const InventoryItemDrawer: React.FC<{
  itemId: number | null;
  onClose: () => void;
  isAdmin: boolean;
  warehouses: Warehouse[];
  onChanged: () => void;
}> = ({ itemId, onClose, isAdmin, warehouses, onChanged }) => {
  const detailQuery = useInventoryItemDetailQuery(itemId);
  const detail = detailQuery.data;

  const adjustMutation = useAdjustInventoryStockMutation();
  const transferMutation = useCreateStockTransferMutation();
  const transferStatusMutation = useUpdateStockTransferStatusMutation();
  const addBatchMutation = useAddInventoryBatchMutation();
  const deleteBatchMutation = useDeleteInventoryBatchMutation();
  const addSerialMutation = useAddInventorySerialMutation();
  const deleteSerialMutation = useDeleteInventorySerialMutation();
  const uploadAttachmentMutation = useUploadInventoryAttachmentMutation();
  const deleteAttachmentMutation = useDeleteInventoryAttachmentMutation();

  const [error, setError] = useState<string | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferToId, setTransferToId] = useState<number | "">("");
  const [transferQty, setTransferQty] = useState("");
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchNumber, setBatchNumber] = useState("");
  const [batchQty, setBatchQty] = useState("");
  const [showSerialForm, setShowSerialForm] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");
  const [busy, setBusy] = useState(false);

  const refetchAll = async () => {
    await detailQuery.refetch();
    onChanged();
  };

  if (!itemId) return null;
  const item = detail?.item;

  return (
    <Drawer
      open={!!itemId}
      onClose={onClose}
      title={item?.itemName || "Loading…"}
      subtitle={item?.sku ? `SKU ${item.sku}` : undefined}
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

          <DrawerSection title="General Information">
            <DrawerRow label="Category">{item.category}</DrawerRow>
            <DrawerRow label="Unit">{item.unit || "--"}</DrawerRow>
            <DrawerRow label="Vendor">{item.vendor?.name || item.supplier || "--"}</DrawerRow>
            <DrawerRow label="Date">{formatDate(item.lastRestockedDate)}</DrawerRow>
            {item.notes && <DrawerRow label="Notes">{item.notes}</DrawerRow>}
          </DrawerSection>

          <DrawerSection
            title="Current Stock"
            action={
              isAdmin && (
                <button
                  onClick={() => setShowAdjust((s) => !s)}
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-900 hover:underline"
                >
                  <PackagePlus size={12} /> Adjust
                </button>
              )
            }
          >
            <DrawerRow label="On hand">{item.quantity}</DrawerRow>
            <DrawerRow label="Reserved">{item.reservedQuantity}</DrawerRow>
            <DrawerRow label="Available">{Math.max(0, item.quantity - item.reservedQuantity)}</DrawerRow>
            <DrawerRow label="Incoming">{item.incomingQuantity}</DrawerRow>
            {showAdjust && (
              <div className="flex items-end gap-2 mt-3 p-3 rounded bg-slate-50">
                <div className="flex-1">
                  <label className="block mb-1 text-[10px] font-medium text-slate-500">Delta (+/-)</label>
                  <input
                    type="number"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(e.target.value)}
                    className="w-full px-2 py-1.5 text-[12px] border border-slate-200 rounded outline-none focus:border-blue-400"
                    placeholder="-5 or 10"
                  />
                </div>
                <div className="flex-1">
                  <label className="block mb-1 text-[10px] font-medium text-slate-500">Reason</label>
                  <input
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full px-2 py-1.5 text-[12px] border border-slate-200 rounded outline-none focus:border-blue-400"
                    placeholder="Optional"
                  />
                </div>
                <button
                  disabled={busy || !adjustDelta}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await adjustMutation.mutateAsync({
                        itemId: item.id,
                        delta: Number(adjustDelta),
                        reason: adjustReason || undefined,
                      });
                      setAdjustDelta("");
                      setAdjustReason("");
                      setShowAdjust(false);
                      await refetchAll();
                    } catch (err) {
                      setError(getErrorMessage(err, "Failed to adjust stock."));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
                >
                  Apply
                </button>
              </div>
            )}
          </DrawerSection>

          <DrawerSection
            title="Warehouse Locations"
            action={
              isAdmin && (
                <button
                  onClick={() => setShowTransfer((s) => !s)}
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-900 hover:underline"
                >
                  <ArrowRightLeft size={12} /> Transfer
                </button>
              )
            }
          >
            <DrawerRow label="Current warehouse">{item.warehouse?.name || "Unassigned"}</DrawerRow>
            {showTransfer && (
              <div className="mt-3 p-3 rounded bg-slate-50 space-y-2">
                <div>
                  <label className="block mb-1 text-[10px] font-medium text-slate-500">To warehouse</label>
                  <select
                    value={transferToId}
                    onChange={(e) => setTransferToId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full px-2 py-1.5 text-[12px] bg-white border border-slate-200 rounded outline-none focus:border-blue-400"
                  >
                    <option value="">Choose a warehouse</option>
                    {warehouses
                      .filter((w) => w.id !== item.warehouse?.id)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block mb-1 text-[10px] font-medium text-slate-500">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={transferQty}
                      onChange={(e) => setTransferQty(e.target.value)}
                      className="w-full px-2 py-1.5 text-[12px] border border-slate-200 rounded outline-none focus:border-blue-400"
                    />
                  </div>
                  <button
                    disabled={busy || !transferToId || !transferQty}
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        await transferMutation.mutateAsync({
                          itemId: item.id,
                          input: {
                            toWarehouseId: Number(transferToId),
                            quantity: Number(transferQty),
                            ...(item.warehouse ? { fromWarehouseId: item.warehouse.id } : {}),
                          },
                        });
                        setTransferQty("");
                        setTransferToId("");
                        setShowTransfer(false);
                        await refetchAll();
                      } catch (err) {
                        setError(getErrorMessage(err, "Failed to create transfer."));
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
                  >
                    Request
                  </button>
                </div>
              </div>
            )}
            {detail.transfers.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {detail.transfers.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-[12px] py-1">
                    <span className="text-slate-600">
                      {t.fromWarehouse?.name || "—"} → {t.toWarehouse.name} · {t.quantity} units
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] uppercase font-medium px-1.5 py-0.5 rounded ${
                          t.status === "completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : t.status === "cancelled"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {t.status.replace("_", " ")}
                      </span>
                      {isAdmin && (t.status === "pending" || t.status === "in_transit") && (
                        <button
                          title="Mark completed"
                          onClick={async () => {
                            setError(null);
                            try {
                              await transferStatusMutation.mutateAsync({
                                itemId: item.id,
                                transferId: t.id,
                                status: "completed",
                              });
                              await refetchAll();
                            } catch (err) {
                              setError(getErrorMessage(err, "Failed to update transfer."));
                            }
                          }}
                          className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <Check size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DrawerSection>

          <DrawerSection
            title="Batch Numbers"
            action={
              isAdmin && (
                <button
                  onClick={() => setShowBatchForm((s) => !s)}
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-900 hover:underline"
                >
                  <Plus size={12} /> Add
                </button>
              )
            }
          >
            {showBatchForm && (
              <div className="flex items-end gap-2 mb-3 p-3 rounded bg-slate-50">
                <div className="flex-1">
                  <label className="block mb-1 text-[10px] font-medium text-slate-500">Batch #</label>
                  <input
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="w-full px-2 py-1.5 text-[12px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <div className="w-20">
                  <label className="block mb-1 text-[10px] font-medium text-slate-500">Qty</label>
                  <input
                    type="number"
                    value={batchQty}
                    onChange={(e) => setBatchQty(e.target.value)}
                    className="w-full px-2 py-1.5 text-[12px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <button
                  disabled={busy || !batchNumber.trim()}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await addBatchMutation.mutateAsync({
                        itemId: item.id,
                        input: { batchNumber: batchNumber.trim(), quantity: Number(batchQty) || 0 },
                      });
                      setBatchNumber("");
                      setBatchQty("");
                      setShowBatchForm(false);
                      await detailQuery.refetch();
                    } catch (err) {
                      setError(getErrorMessage(err, "Failed to add batch."));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
                >
                  Add
                </button>
              </div>
            )}
            {detail.batches.length === 0 ? (
              <p className="text-[12px] text-slate-400">No batches recorded.</p>
            ) : (
              detail.batches.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-[12px]">
                  <span className="text-slate-700">{b.batchNumber} · {b.quantity} units</span>
                  {isAdmin && (
                    <button
                      onClick={async () => {
                        await deleteBatchMutation.mutateAsync({ itemId: item.id, batchId: b.id });
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

          <DrawerSection
            title="Serial Numbers"
            action={
              isAdmin && (
                <button
                  onClick={() => setShowSerialForm((s) => !s)}
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-900 hover:underline"
                >
                  <Plus size={12} /> Add
                </button>
              )
            }
          >
            {showSerialForm && (
              <div className="flex items-end gap-2 mb-3 p-3 rounded bg-slate-50">
                <div className="flex-1">
                  <label className="block mb-1 text-[10px] font-medium text-slate-500">Serial #</label>
                  <input
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full px-2 py-1.5 text-[12px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <button
                  disabled={busy || !serialNumber.trim()}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await addSerialMutation.mutateAsync({
                        itemId: item.id,
                        input: { serialNumber: serialNumber.trim() },
                      });
                      setSerialNumber("");
                      setShowSerialForm(false);
                      await detailQuery.refetch();
                    } catch (err) {
                      setError(getErrorMessage(err, "Failed to add serial."));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
                >
                  Add
                </button>
              </div>
            )}
            {detail.serials.length === 0 ? (
              <p className="text-[12px] text-slate-400">No serial numbers recorded.</p>
            ) : (
              detail.serials.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-[12px]">
                  <span className="text-slate-700">{s.serialNumber} · {s.status}</span>
                  {isAdmin && (
                    <button
                      onClick={async () => {
                        await deleteSerialMutation.mutateAsync({ itemId: item.id, serialId: s.id });
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

          <DrawerSection title="Purchase History">
            {detail.purchaseHistory.length === 0 ? (
              <p className="text-[12px] text-slate-400">No related purchase requests.</p>
            ) : (
              detail.purchaseHistory.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-[12px]">
                  <span className="text-slate-700">
                    {p.poNumber || `#${p.id}`} · {p.quantity} units
                  </span>
                  <span className="text-slate-500">{formatCost(toNumber(p.estimatedCost))}</span>
                </div>
              ))
            )}
          </DrawerSection>

          <DrawerSection title="Project Allocation">
            {detail.projectAllocation.length === 0 ? (
              <p className="text-[12px] text-slate-400">Not tracked in any other project.</p>
            ) : (
              detail.projectAllocation.map((row) => (
                <DrawerRow key={row.id} label={row.projectName || `Project #${row.projectId}`}>
                  {row.quantity}
                </DrawerRow>
              ))
            )}
          </DrawerSection>

          <DrawerSection title="Inventory Transactions">
            {detail.transactions.length === 0 ? (
              <p className="text-[12px] text-slate-400">No transactions yet.</p>
            ) : (
              detail.transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-[12px]">
                  <span className="text-slate-700">
                    {TX_LABELS[t.type] || t.type} · {t.quantityChange > 0 ? "+" : ""}
                    {t.quantityChange}
                  </span>
                  <span className="text-slate-400">{formatDate(t.createdAt)}</span>
                </div>
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

          <DrawerSection title="Supplier Information">
            <DrawerRow label="Vendor">{item.vendor?.name || item.supplier || "--"}</DrawerRow>
            {item.vendor?.code && <DrawerRow label="Vendor code">{item.vendor.code}</DrawerRow>}
            {item.vendor?.location && <DrawerRow label="Location">{item.vendor.location}</DrawerRow>}
          </DrawerSection>

          <DrawerSection title="Warranty Information">
            <DrawerRow label="Item warranty until">{formatDate(item.warrantyExpiryDate)}</DrawerRow>
            {detail.serials.filter((s) => s.warrantyExpiryDate).length > 0 && (
              <div className="mt-2 space-y-1">
                {detail.serials
                  .filter((s) => s.warrantyExpiryDate)
                  .map((s) => (
                    <DrawerRow key={s.id} label={s.serialNumber}>
                      {formatDate(s.warrantyExpiryDate)}
                    </DrawerRow>
                  ))}
              </div>
            )}
          </DrawerSection>
        </>
      )}
    </Drawer>
  );
};

export default InventoryItemDrawer;
