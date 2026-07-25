import React from "react";
import {
  Eye,
  Pencil,
  Trash2,
  Package,
  Wallet,
  Truck,
  FileStack,
  Calendar,
  Hash,
  Percent,
  Loader2,
  Landmark,
} from "lucide-react";
import Drawer from "../../../components/Drawer";
import { ProcurementItem } from "../../../types";
import { formatCost, toNumber } from "../api/procurement.api";
import { STATUS_STYLES } from "./statusStyles";
import type { ProcurementGroup } from "../utils/groupProcurementItems";

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

const Chip: React.FC<{ icon: React.ElementType; children: React.ReactNode }> = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
    <Icon size={10} className="text-slate-400" />
    {children}
  </span>
);

/**
 * Shows every individual purchase request folded into one Procurement table
 * row (see groupProcurementItems) — the item-level rollup only ever shows a
 * total quantity + status breakdown, so this is where the per-request detail
 * (date, quantity, status, PO#) lives. Clicking a request opens the existing
 * single-PO ProcurementItemDrawer for full detail/attachments/status history.
 */
const ProcurementItemGroupDrawer: React.FC<{
  group: ProcurementGroup | null;
  onClose: () => void;
  isAdmin: boolean;
  onViewRequest: (id: number) => void;
  onEditRequest: (item: ProcurementItem) => void;
  onDeleteRequest: (item: ProcurementItem) => void;
  onStatusChange: (item: ProcurementItem, status: ProcurementItem["status"]) => void;
  statusUpdatingId: number | null;
}> = ({ group, onClose, isAdmin, onViewRequest, onEditRequest, onDeleteRequest, onStatusChange, statusUpdatingId }) => {
  const requests = [...(group?.requests ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <Drawer
      open={!!group}
      onClose={onClose}
      title={group?.itemName || ""}
      subtitle={group?.projectName || undefined}
      width={500}
    >
      {group && (
        <>
          {/* Hero stat strip */}
          <div className="p-5 border-b border-slate-100">
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile
                icon={Package}
                label="Total Quantity"
                value={group.unitLabel ? `${group.totalQuantity} ${group.unitLabel}` : String(group.totalQuantity)}
              />
              <StatTile icon={Wallet} label="Total Cost" value={formatCost(group.totalCost)} />
              <StatTile icon={Truck} label="Vendor" value={group.vendorLabel} />
              <StatTile
                icon={FileStack}
                label="Requests"
                value={`${group.requests.length} request${group.requests.length === 1 ? "" : "s"}`}
              />
            </div>
          </div>

          {/* Purchase requests */}
          <div className="p-5">
            <div className="flex items-center gap-1.5 mb-3">
              <FileStack size={13} className="text-slate-400" />
              <span
                className="text-[10px] tracking-[0.1em] uppercase text-slate-900 font-semibold"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Purchase Requests
              </span>
            </div>
            <div className="space-y-2.5">
              {requests.map((r) => {
                const s = STATUS_STYLES[r.status];
                const unitCost = toNumber(r.unitCost ?? r.estimatedCost);
                return (
                  <div
                    key={r.id}
                    className="relative overflow-hidden bg-white border border-slate-200 rounded-lg pl-3.5 pr-3 py-2.5 transition-shadow hover:shadow-sm"
                  >
                    <span
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ background: s.fg }}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-800">
                          <Calendar size={12} className="text-slate-400" />
                          {formatDate(r.createdAt)}
                          <span className="font-normal text-slate-300">·</span>
                          <span className="inline-flex items-center gap-1 font-normal text-slate-500">
                            <Hash size={11} className="text-slate-400" />
                            {r.poNumber || r.id}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          <Chip icon={Package}>
                            Qty {r.quantity}
                            {r.unit ? ` ${r.unit}` : ""}
                          </Chip>
                          <Chip icon={Wallet}>{formatCost(unitCost)}/unit</Chip>
                          {r.taxPercent != null && (
                            <Chip icon={Percent}>Tax {toNumber(r.taxPercent)}%</Chip>
                          )}
                          {r.discountPercent != null && (
                            <Chip icon={Percent}>Discount {toNumber(r.discountPercent)}%</Chip>
                          )}
                          {r.transportCost != null && (
                            <Chip icon={Truck}>Transport {formatCost(toNumber(r.transportCost))}</Chip>
                          )}
                          {r.customsCost != null && (
                            <Chip icon={Landmark}>Customs {formatCost(toNumber(r.customsCost))}</Chip>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0 gap-1.5">
                        {isAdmin ? (
                          <div className="flex items-center gap-1">
                            <select
                              value={r.status}
                              disabled={statusUpdatingId === r.id}
                              onChange={(e) => onStatusChange(r, e.target.value as ProcurementItem["status"])}
                              className="pr-5 py-0.5 pl-1.5 text-[10px] font-medium rounded appearance-none cursor-pointer outline-none disabled:opacity-60"
                              style={{ background: s.bg, color: s.fg }}
                            >
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="ordered">Ordered</option>
                              <option value="delivered">Delivered</option>
                            </select>
                            {statusUpdatingId === r.id && <Loader2 size={11} className="animate-spin text-slate-400" />}
                          </div>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase font-medium"
                            style={{ background: s.bg, color: s.fg }}
                          >
                            {s.label}
                          </span>
                        )}
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => onViewRequest(r.id)}
                            title="View details"
                            className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Eye size={12} />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => onEditRequest(r)}
                                title="Edit"
                                className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => onDeleteRequest(r)}
                                title="Delete"
                                className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
};

export default ProcurementItemGroupDrawer;
