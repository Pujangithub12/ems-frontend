import { ProcurementItem } from "../../../types";

/** Shared between the Procurement table, the group rollup drawer, and the
 * single-request drawer, so a status always reads the same everywhere. */
export const STATUS_STYLES: Record<ProcurementItem["status"], { bg: string; fg: string; label: string }> = {
  pending: { bg: "#FEF3C7", fg: "#B45309", label: "Pending" },
  approved: { bg: "#EDE9FE", fg: "#6D28D9", label: "Approved" },
  ordered: { bg: "#DBEAFE", fg: "#1E3A8A", label: "Ordered" },
  delivered: { bg: "#DCFCE7", fg: "#15803D", label: "Delivered" },
};

export const CATEGORY_STYLES: Record<ProcurementItem["category"], { bg: string; fg: string; label: string }> = {
  hardware: { bg: "#E0E7FF", fg: "#3730A3", label: "Hardware" },
  software: { bg: "#F3E8FF", fg: "#7E22CE", label: "Software" },
  service: { bg: "#CCFBF1", fg: "#0F766E", label: "Service" },
};
