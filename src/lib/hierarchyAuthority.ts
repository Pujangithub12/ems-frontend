import type { HierarchyPerson } from "../types";

/**
 * Client-side mirror of backend/src/utils/hierarchyAuthority.ts — used only
 * to decide what to show in the UI (hide/show Approve/Reject, filter
 * assignee pickers). The backend re-checks everything on the actual
 * request/task-assignment endpoints, so this never needs to be airtight,
 * just consistent with what the server will actually allow.
 */

const byNodeId = (people: HierarchyPerson[]) => new Map(people.map((p) => [p.id, p]));

/** Ordered ancestor chain (nearest manager first) above the given user, walking primaryManagerId only. */
export function getAncestorChain(people: HierarchyPerson[], userId: number): HierarchyPerson[] {
  const nodeById = byNodeId(people);
  const self = people.find((p) => p.userId === userId);

  const chain: HierarchyPerson[] = [];
  let current = self;
  const seen = new Set<number>();
  while (current?.primaryManagerId != null && !seen.has(current.primaryManagerId)) {
    seen.add(current.primaryManagerId);
    const parent = nodeById.get(current.primaryManagerId);
    if (!parent) break;
    chain.push(parent);
    current = parent;
  }
  return chain;
}

/** Self always counts as its own descendant, so self-assignment is always allowed. */
export function isDescendant(
  people: HierarchyPerson[],
  ancestorUserId: number,
  descendantUserId: number,
): boolean {
  if (ancestorUserId === descendantUserId) return true;
  return getAncestorChain(people, descendantUserId).some((p) => p.userId === ancestorUserId);
}

/** Every user id below `ancestorUserId` in the tree, at any depth. */
export function getDescendantUserIds(people: HierarchyPerson[], ancestorUserId: number): number[] {
  const childrenByParentNodeId = new Map<number, HierarchyPerson[]>();
  people.forEach((p) => {
    if (p.primaryManagerId == null) return;
    const list = childrenByParentNodeId.get(p.primaryManagerId) || [];
    list.push(p);
    childrenByParentNodeId.set(p.primaryManagerId, list);
  });

  const ancestorNode = people.find((p) => p.userId === ancestorUserId);
  if (!ancestorNode) return [];

  const result: number[] = [];
  const queue = [...(childrenByParentNodeId.get(ancestorNode.id) || [])];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node.userId);
    queue.push(...(childrenByParentNodeId.get(node.id) || []));
  }
  return result;
}

/** The nearest ancestor who holds admin/super_admin role — "the admin of that user". */
export function getApproverUserId(people: HierarchyPerson[], requesterUserId: number): number | null {
  const approver = getAncestorChain(people, requesterUserId).find(
    (p) => p.role === "admin" || p.role === "super_admin",
  );
  return approver ? approver.userId : null;
}

/** Whether `actorUserId` (with `actorRole`) may approve/reject a request from `requesterUserId`. */
export function canApprove(
  people: HierarchyPerson[],
  actorUserId: number,
  actorRole: string,
  requesterUserId: number,
): boolean {
  if (actorRole === "super_admin") return true;
  return getApproverUserId(people, requesterUserId) === actorUserId;
}
