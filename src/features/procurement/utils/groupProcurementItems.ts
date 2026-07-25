import { ProcurementItem } from "../../../types";
import { computeItemCostBreakdown } from "../api/procurement.api";

export type ProcurementGroup = {
  /** projectId + catalog item (or lowercased item name, for legacy rows with no catalog link). */
  key: string;
  itemName: string;
  category: ProcurementItem["category"];
  projectId?: number;
  projectName?: string;
  totalQuantity: number;
  /** A single unit label if every request in the group used the same one, "" if none/mixed. */
  unitLabel: string;
  totalCost: number;
  /** A single vendor name if every request in the group used the same one, "Multiple" if they differ, "--" if none. */
  vendorLabel: string;
  /** Soonest upcoming/most urgent neededByDate across the group's requests, if any have one. */
  earliestNeededBy: string | null;
  statusCounts: Partial<Record<ProcurementItem["status"], number>>;
  /** Most recent createdAt among the group's requests — used for "date" sorting. */
  latestCreatedAt: string;
  requests: ProcurementItem[];
};

/**
 * Folds every individual purchase request for the same item (within the
 * same project) into one summary row — mirrors the Inventory table's
 * one-row-per-item rule, but keeps each request intact (with its own PO
 * number/status/date) inside `requests` rather than merging them, since
 * unlike stock levels a purchase request's status/date genuinely differ
 * request to request (see ProcurementItemGroupDrawer for the drill-down).
 */
export function groupProcurementItems(items: ProcurementItem[]): ProcurementGroup[] {
  const map = new Map<string, ProcurementGroup>();
  const vendorSets = new Map<string, Set<string>>();
  const unitSets = new Map<string, Set<string>>();

  for (const it of items) {
    const key = `${it.projectId ?? "none"}:${it.item?.id ?? it.itemName.trim().toLowerCase()}`;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        itemName: it.itemName,
        category: it.category,
        projectId: it.projectId,
        projectName: it.projectName,
        totalQuantity: 0,
        unitLabel: "",
        totalCost: 0,
        vendorLabel: "--",
        earliestNeededBy: null,
        statusCounts: {},
        latestCreatedAt: it.createdAt,
        requests: [],
      };
      map.set(key, group);
      vendorSets.set(key, new Set());
      unitSets.set(key, new Set());
    }

    group.requests.push(it);
    group.totalQuantity += it.quantity;
    group.totalCost += computeItemCostBreakdown(it).total;
    group.statusCounts[it.status] = (group.statusCounts[it.status] ?? 0) + 1;
    if (it.createdAt > group.latestCreatedAt) group.latestCreatedAt = it.createdAt;
    if (it.neededByDate && (!group.earliestNeededBy || it.neededByDate < group.earliestNeededBy)) {
      group.earliestNeededBy = it.neededByDate;
    }

    const vendorName = it.vendor?.name || it.vendorName;
    if (vendorName) vendorSets.get(key)!.add(vendorName);
    if (it.unit) unitSets.get(key)!.add(it.unit);
  }

  for (const group of map.values()) {
    const vendors = vendorSets.get(group.key)!;
    group.vendorLabel = vendors.size === 0 ? "--" : vendors.size === 1 ? [...vendors][0] : "Multiple";
    const units = unitSets.get(group.key)!;
    group.unitLabel = units.size === 1 ? [...units][0] : "";
  }

  return Array.from(map.values());
}
