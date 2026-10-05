import React, { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { ShipmentTrackingRecord } from "../../../types";
import { useCreateShipmentTrackingRecordMutation, useUpdateShipmentTrackingRecordMutation } from "../hooks/useShipmentTracking";
import { getErrorMessage } from "../../../lib/errors";

type RecordForm = {
  blNumber: string;
  carrierName: string;
  dispatchDate: string;
  eta: string;
  pol: string;
  pod: string;
  containerType: string;
  containerCount: string;
  dispatchedFrom: string;
  documentStatus: string;
  remarks: string;
};

const emptyForm: RecordForm = {
  blNumber: "",
  carrierName: "",
  dispatchDate: "",
  eta: "",
  pol: "",
  pod: "",
  containerType: "",
  containerCount: "",
  dispatchedFrom: "",
  documentStatus: "",
  remarks: "",
};

const inputCls = "w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg outline-none focus:border-blue-400";
const labelCls = "block mb-1 text-[11px] font-medium text-slate-900";

interface ShipmentTrackingRecordModalProps {
  /** Pass an existing record to edit it in place; omit/null to create a new one. */
  editingRecord?: ShipmentTrackingRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Add/edit form for a Shipment Tracking record — the Finance page's second tab. */
const ShipmentTrackingRecordModal: React.FC<ShipmentTrackingRecordModalProps> = ({ editingRecord, onClose, onSaved }) => {
  const createMutation = useCreateShipmentTrackingRecordMutation();
  const updateMutation = useUpdateShipmentTrackingRecordMutation();

  const [form, setForm] = useState<RecordForm>(
    editingRecord
      ? {
          blNumber: editingRecord.blNumber || "",
          carrierName: editingRecord.carrierName || "",
          dispatchDate: editingRecord.dispatchDate ? editingRecord.dispatchDate.slice(0, 10) : "",
          eta: editingRecord.eta ? editingRecord.eta.slice(0, 10) : "",
          pol: editingRecord.pol || "",
          pod: editingRecord.pod || "",
          containerType: editingRecord.containerType || "",
          containerCount: editingRecord.containerCount != null ? String(editingRecord.containerCount) : "",
          dispatchedFrom: editingRecord.dispatchedFrom || "",
          documentStatus: editingRecord.documentStatus || "",
          remarks: editingRecord.remarks || "",
        }
      : emptyForm,
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = (field: keyof RecordForm, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const input = {
        blNumber: form.blNumber.trim() || null,
        carrierName: form.carrierName.trim() || null,
        dispatchDate: form.dispatchDate || null,
        eta: form.eta || null,
        pol: form.pol.trim() || null,
        pod: form.pod.trim() || null,
        containerType: form.containerType.trim() || null,
        containerCount: form.containerCount.trim() ? Number(form.containerCount) : null,
        dispatchedFrom: form.dispatchedFrom.trim() || null,
        documentStatus: form.documentStatus.trim() || null,
        remarks: form.remarks.trim() || null,
      };
      if (editingRecord) {
        await updateMutation.mutateAsync({ id: editingRecord.id, input });
      } else {
        await createMutation.mutateAsync(input);
      }
      onSaved();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save record."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-[14px] font-semibold text-slate-900">
            {editingRecord ? "Edit Shipment Tracking Record" : "Add Shipment Tracking Record"}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto">
          {formError && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">{formError}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>BL Number</label>
              <input autoFocus value={form.blNumber} onChange={(e) => set("blNumber", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Carrier Name</label>
              <input value={form.carrierName} onChange={(e) => set("carrierName", e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Dispatch Date</label>
              <input type="date" value={form.dispatchDate} onChange={(e) => set("dispatchDate", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>ETA</label>
              <input type="date" value={form.eta} onChange={(e) => set("eta", e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>POL (Port of Loading)</label>
              <input value={form.pol} onChange={(e) => set("pol", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>POD (Port of Discharge)</label>
              <input value={form.pod} onChange={(e) => set("pod", e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type of Container</label>
              <input value={form.containerType} onChange={(e) => set("containerType", e.target.value)} placeholder="e.g. 20ft / 40ft HC" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>No. of Container</label>
              <input type="number" min="0" step="1" value={form.containerCount} onChange={(e) => set("containerCount", e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Dispatched From</label>
              <input value={form.dispatchedFrom} onChange={(e) => set("dispatchedFrom", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Document Status</label>
              <input value={form.documentStatus} onChange={(e) => set("documentStatus", e.target.value)} placeholder="e.g. Submitted / Pending" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Remarks</label>
            <textarea value={form.remarks} onChange={(e) => set("remarks", e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60 transition-colors"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingRecord ? "Save Changes" : "Add Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShipmentTrackingRecordModal;
