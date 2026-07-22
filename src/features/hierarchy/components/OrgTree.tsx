import React, { useEffect, useMemo, useState } from "react";
import { X, Lock } from "lucide-react";
import { HierarchyPerson } from "../../../types";

// Same role palette used elsewhere in the app (Users.tsx, SettingsShared.tsx)
// — duplicated locally rather than imported, matching that existing pattern.
const ROLE_COLORS: Record<string, string> = {
  super_admin: "#B91C1C",
  admin: "#6D28D9",
  finance: "#B45309",
  user: "#1E3A8A",
};
const roleColor = (role: string) => ROLE_COLORS[role] || "#475569";
const roleLabel = (role: string) => role.replace(/_/g, " ");

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const getPerson = (people: HierarchyPerson[], id: number | null) =>
  id === null ? undefined : people.find((p) => p.id === id);

const directReports = (people: HierarchyPerson[], mgrId: number) =>
  people.filter((p) => p.primaryManagerId === mgrId);

/** Walks the primary-manager chain from descendantId upward; true if ancestorId appears. */
const isAncestor = (
  people: HierarchyPerson[],
  ancestorId: number,
  descendantId: number,
) => {
  let cur = getPerson(people, descendantId);
  while (cur && cur.primaryManagerId !== null) {
    if (cur.primaryManagerId === ancestorId) return true;
    cur = getPerson(people, cur.primaryManagerId);
  }
  return false;
};

const NODE_W = 184;
const NODE_H = 64;
const H_GAP = 24;
const V_GAP = 64;

type Positions = Record<number, { x: number; y: number }>;

/** Auto-layout supporting a forest (multiple people with no primary manager yet). */
function computeLayout(people: HierarchyPerson[]) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const childrenOf = (id: number) =>
    people.filter((p) => p.primaryManagerId === id);
  // Super admin always sits at the root, and leads the row of roots so the
  // chart visually reads as "them, at the top" rather than an arbitrary spot.
  const roots = people
    .filter((p) => p.primaryManagerId === null || !byId.has(p.primaryManagerId))
    .sort((a, b) => (a.role === "super_admin" ? -1 : 0) - (b.role === "super_admin" ? -1 : 0));

  const widthCache = new Map<number, number>();
  const subtreeWidth = (id: number): number => {
    const cached = widthCache.get(id);
    if (cached !== undefined) return cached;
    const kids = childrenOf(id);
    if (kids.length === 0) {
      widthCache.set(id, NODE_W);
      return NODE_W;
    }
    const total =
      kids.reduce((s, k) => s + subtreeWidth(k.id), 0) +
      (kids.length - 1) * H_GAP;
    const w = Math.max(NODE_W, total);
    widthCache.set(id, w);
    return w;
  };

  const positions: Positions = {};
  const layout = (id: number, leftX: number, topY: number) => {
    const kids = childrenOf(id);
    const myW = subtreeWidth(id);
    positions[id] = { x: leftX + myW / 2 - NODE_W / 2, y: topY };
    let cx = leftX;
    for (const k of kids) {
      const kw = subtreeWidth(k.id);
      layout(k.id, cx, topY + NODE_H + V_GAP);
      cx += kw + H_GAP;
    }
  };

  let cursorX = 0;
  for (const root of roots) {
    layout(root.id, cursorX, 0);
    cursorX += subtreeWidth(root.id) + H_GAP * 2;
  }
  const width = Math.max(NODE_W, cursorX - H_GAP * 2);
  const height =
    Object.keys(positions).length > 0
      ? Math.max(...Object.values(positions).map((p) => p.y)) + NODE_H
      : 0;
  return { positions, width, height };
}

const PersonNode: React.FC<{
  person: HierarchyPerson;
  position: { x: number; y: number };
  isSelected: boolean;
  isDragging: boolean;
  isDragTarget: boolean;
  dragMode: "swap" | "secondary" | "primary" | null;
  onSelect: (id: number) => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onDragOver: (id: number) => void;
  onDragLeave: () => void;
  onDrop: (id: number) => void;
}> = ({
  person,
  position,
  isSelected,
  isDragging,
  isDragTarget,
  dragMode,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const color = roleColor(person.role);
  const isRoot = person.role === "super_admin";
  let targetStyle: React.CSSProperties = {};
  if (isDragTarget) {
    const c = dragMode === "primary" ? "#1E3A8A" : "#7C3AED";
    targetStyle = {
      outline: `2px dashed ${c}`,
      outlineOffset: 2,
      background: dragMode === "primary" ? "#DBEAFE" : "#EDE9FE",
    };
  }

  return (
    <div
      draggable={!isRoot}
      onDragStart={(e) => {
        if (isRoot) return;
        onDragStart(person.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(person.id);
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(person.id);
      }}
      onClick={() => onSelect(person.id)}
      title={isRoot ? "Super admin always stays at the root" : undefined}
      className={`absolute bg-white border rounded-md py-2.5 pl-3.5 pr-3 flex items-center gap-2.5 select-none transition-colors ${
        isSelected ? "border-blue-900 ring-2 ring-blue-900" : "border-slate-300"
      } ${isDragging ? "opacity-40" : ""}`}
      style={{
        left: position.x,
        top: position.y,
        width: NODE_W,
        height: NODE_H,
        cursor: isRoot ? "pointer" : "grab",
        boxShadow: isSelected ? undefined : "0 1px 0 rgba(0,0,0,0.02)",
        ...targetStyle,
      }}
    >
      <div
        className="absolute rounded-full"
        style={{ left: 0, top: 8, bottom: 8, width: 3, background: color }}
      />
      <div
        className="flex items-center justify-center flex-shrink-0 rounded-full text-white font-semibold"
        style={{ width: 28, height: 28, fontSize: 10, background: color }}
      >
        {initials(person.fullName)}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <div className="font-semibold truncate text-[12px] text-slate-900">
            {person.fullName}
          </div>
          {isRoot && <Lock className="w-2.5 h-2.5 flex-shrink-0 text-slate-400" />}
        </div>
        <div className="truncate text-[10px] text-slate-400">
          {person.jobPosition || roleLabel(person.role)}
        </div>
      </div>
    </div>
  );
};

const MoveConfirmModal: React.FC<{
  people: HierarchyPerson[];
  fromId: number;
  toId: number;
  isDirectParent: boolean;
  onCancel: () => void;
  onConfirm: (option: "swap" | "move" | "secondary") => void;
}> = ({ people, fromId, toId, isDirectParent, onCancel, onConfirm }) => {
  const from = getPerson(people, fromId)!;
  const to = getPerson(people, toId)!;
  const reports = directReports(people, fromId);
  const currentMgr = getPerson(people, from.primaryManagerId);
  const alreadySecondary = from.secondaryManagerIds.includes(toId);
  const [option, setOption] = useState<"swap" | "move" | "secondary">(
    isDirectParent ? "swap" : "move",
  );

  type Option = {
    id: "swap" | "move" | "secondary";
    title: string;
    desc: string;
    color: "primary" | "secondary";
    disabled?: boolean;
  };
  const options: Option[] = [];

  if (isDirectParent) {
    options.push({
      id: "swap",
      title: `Swap positions — ${from.fullName.split(" ")[0]} takes ${to.fullName.split(" ")[0]}'s place`,
      desc: `${from.fullName} will report to ${currentMgr ? currentMgr.fullName : "no one"}, and ${to.fullName} will report to ${from.fullName}.`,
      color: "secondary",
    });
  } else {
    options.push({
      id: "move",
      title: `Move ${from.fullName} (and ${reports.length} report${reports.length !== 1 ? "s" : ""}) under ${to.fullName}`,
      desc: `${from.fullName} will report to ${to.fullName}. ${
        reports.length > 0
          ? `Their ${reports.length === 1 ? "direct report" : "direct reports"} will move with them.`
          : "No subordinates affected."
      }`,
      color: "primary",
    });
    if (alreadySecondary) {
      options.push({
        id: "secondary",
        title: `${to.fullName} is already a secondary manager`,
        desc: `${from.fullName} already has a dotted-line relationship to ${to.fullName}. Choose "move" to change primary reporting instead, or cancel.`,
        color: "secondary",
        disabled: true,
      });
    } else {
      const existingNames = from.secondaryManagerIds
        .map((id) => getPerson(people, id)?.fullName)
        .filter(Boolean);
      options.push({
        id: "secondary",
        title: `Add ${to.fullName} as an additional secondary manager`,
        desc: `${from.fullName} will gain a dotted-line reporting relationship to ${to.fullName}, alongside ${
          existingNames.length > 0
            ? `their existing secondary manager(s) (${existingNames.join(", ")}) and `
            : ""
        }their primary manager.`,
        color: "secondary",
      });
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6 bg-slate-900/45"
      style={{ zIndex: 60 }}
    >
      <div
        className="w-full bg-white rounded-lg p-7"
        style={{ maxWidth: 520, boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
      >
        <div
          className="text-[10px] tracking-[0.1em] uppercase text-slate-400"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Reporting relationship
        </div>
        <h2 className="font-semibold text-[20px] mt-2 mb-2 text-slate-900">
          {isDirectParent ? "Swap" : "Move"}{" "}
          <span
            className="rounded"
            style={{
              padding: "2px 8px",
              background: option === "secondary" ? "#EDE9FE" : "#DBEAFE",
              color: option === "secondary" ? "#7C3AED" : "#1E3A8A",
            }}
          >
            {from.fullName}
          </span>
        </h2>
        <p className="text-slate-500 mb-5 text-[13px]">
          Choose how {from.fullName.split(" ")[0]} should relate to {to.fullName}:
        </p>
        {options.map((o) => {
          const active = option === o.id;
          const colorHex = o.color === "secondary" ? "#7C3AED" : "#1E3A8A";
          return (
            <label
              key={o.id}
              className={`flex gap-3 border rounded-md mb-2 p-3.5 ${
                o.disabled
                  ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
                  : active
                    ? "cursor-pointer"
                    : "border-slate-200 hover:bg-slate-50 cursor-pointer"
              }`}
              style={
                active && !o.disabled
                  ? {
                      borderColor: colorHex,
                      background: o.color === "secondary" ? "#EDE9FE" : "#DBEAFE",
                    }
                  : undefined
              }
            >
              <input
                type="radio"
                checked={active}
                disabled={o.disabled}
                onChange={() => !o.disabled && setOption(o.id)}
                className="mt-1"
              />
              <div>
                <div className="font-medium text-[13px] text-slate-900">{o.title}</div>
                <div className="mt-0.5 text-[12px] text-slate-400">{o.desc}</div>
              </div>
            </label>
          );
        })}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="border border-slate-300 rounded text-slate-600 hover:bg-slate-50 transition-colors"
            style={{ padding: "8px 16px", fontSize: 13, fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(option)}
            disabled={options.find((o) => o.id === option)?.disabled}
            className="rounded text-white transition-colors disabled:opacity-50"
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              background: option === "secondary" ? "#7C3AED" : "#1E3A8A",
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

const DrawerRow: React.FC<{ label: string; children: React.ReactNode; color?: string }> = ({
  label,
  children,
  color,
}) => (
  <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0 text-[13px]">
    <span style={{ color: color || "#94A3B8" }}>{label}</span>
    <span className="font-medium text-right ml-3 truncate text-slate-900">{children}</span>
  </div>
);

const PersonDrawer: React.FC<{
  person: HierarchyPerson;
  people: HierarchyPerson[];
  onClose: () => void;
  onRemoveSecondary: (personId: number, secId: number) => void;
}> = ({ person, people, onClose, onRemoveSecondary }) => {
  const color = roleColor(person.role);
  const primary = getPerson(people, person.primaryManagerId);
  const secondaries = person.secondaryManagerIds
    .map((id) => getPerson(people, id))
    .filter((p): p is HierarchyPerson => !!p);
  const reports = directReports(people, person.id);

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/45" style={{ zIndex: 39 }} onClick={onClose} />
      <div
        className="fixed inset-y-0 right-0 bg-white border-l border-slate-200 overflow-y-auto"
        style={{ width: 400, zIndex: 40, boxShadow: "-12px 0 40px rgba(0,0,0,0.08)" }}
      >
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-start gap-3">
            <div
              className="flex items-center justify-center flex-shrink-0 rounded-full text-white font-semibold"
              style={{ width: 56, height: 56, fontSize: 20, background: color }}
            >
              {initials(person.fullName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold leading-tight text-[18px] text-slate-900">
                {person.fullName}
              </div>
              <div className="text-slate-500 text-[13px]">
                {person.jobPosition || roleLabel(person.role)}
              </div>
              <div className="mt-0.5 text-slate-400 text-[12px]">{person.email}</div>
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span
              className="inline-flex items-center rounded-full font-medium uppercase tracking-[0.05em]"
              style={{
                fontSize: 10,
                padding: "2px 8px",
                color: "#fff",
                background: color,
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {roleLabel(person.role)}
            </span>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <div
              className="text-[10px] tracking-[0.1em] uppercase text-slate-400 mb-2"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Reporting
            </div>
            <DrawerRow label="Primary manager">
              {primary ? primary.fullName : "— top of org —"}
            </DrawerRow>
            {secondaries.length === 0 ? (
              <DrawerRow label="Secondary" color="#7C3AED">
                — none —
              </DrawerRow>
            ) : (
              secondaries.map((sec) => (
                <div
                  key={sec.id}
                  className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0 text-[13px]"
                >
                  <span style={{ color: "#7C3AED" }}>Secondary</span>
                  <span className="flex items-center gap-2 ml-3">
                    <span className="font-medium truncate" style={{ color: "#7C3AED" }}>
                      {sec.fullName}
                    </span>
                    <button
                      onClick={() => onRemoveSecondary(person.id, sec.id)}
                      title="Remove secondary manager"
                      className="p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-700 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              ))
            )}
            <DrawerRow label="Direct reports">
              {reports.length}
              {reports.length > 0
                ? ` (${reports
                    .slice(0, 2)
                    .map((r) => r.fullName.split(" ")[0])
                    .join(", ")}${reports.length > 2 ? "…" : ""})`
                : ""}
            </DrawerRow>
          </div>
          <div>
            <div
              className="text-[10px] tracking-[0.1em] uppercase text-slate-400 mb-2"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Assignment
            </div>
            <DrawerRow label="Job title">{person.jobPosition || "—"}</DrawerRow>
            <DrawerRow label="Joined">
              {new Date(person.joinDate).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </DrawerRow>
          </div>
        </div>
      </div>
    </>
  );
};

const OrgTree: React.FC<{
  people: HierarchyPerson[];
  onSave: (updated: HierarchyPerson[]) => void;
}> = ({ people, onSave }) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [movePending, setMovePending] = useState<{
    fromId: number;
    toId: number;
    isDirectParent: boolean;
  } | null>(null);

  const { positions, width, height } = useMemo(() => computeLayout(people), [people]);
  const selected = getPerson(people, selectedId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const getDragMode = (targetId: number): "swap" | "secondary" | "primary" | null => {
    if (draggingId === null || draggingId === targetId) return null;
    const dragging = getPerson(people, draggingId);
    if (dragging?.primaryManagerId === targetId) return "swap";
    if (shiftHeld) return "secondary";
    return "primary";
  };

  const handleDrop = (targetId: number) => {
    if (draggingId === null || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    if (isAncestor(people, draggingId, targetId)) {
      alert(
        "Can't move a manager under one of their own subordinates — that would create a cycle.",
      );
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const isDirectParent = getPerson(people, draggingId)?.primaryManagerId === targetId;
    // Swapping would give the target a manager (the dragged person) — not
    // allowed when the target is the super admin, who always stays at root.
    if (isDirectParent && getPerson(people, targetId)?.role === "super_admin") {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    setMovePending({ fromId: draggingId, toId: targetId, isDirectParent });
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleMoveConfirm = (option: "swap" | "move" | "secondary") => {
    if (!movePending) return;
    const { fromId, toId } = movePending;
    const from = getPerson(people, fromId)!;
    const to = getPerson(people, toId)!;

    let updated = people;
    if (option === "swap") {
      updated = people.map((p) => {
        if (p.id === fromId) return { ...p, primaryManagerId: to.primaryManagerId };
        if (p.id === toId) return { ...p, primaryManagerId: fromId };
        return p;
      });
    } else if (option === "move") {
      updated = people.map((p) => (p.id === fromId ? { ...p, primaryManagerId: toId } : p));
    } else if (option === "secondary") {
      updated = people.map((p) => {
        if (p.id !== fromId) return p;
        if (p.secondaryManagerIds.includes(toId) || p.primaryManagerId === toId) return p;
        return { ...p, secondaryManagerIds: [...p.secondaryManagerIds, toId] };
      });
    }
    onSave(updated);
    setMovePending(null);
  };

  const handleRemoveSecondary = (personId: number, secId: number) => {
    const updated = people.map((p) =>
      p.id === personId
        ? { ...p, secondaryManagerIds: p.secondaryManagerIds.filter((id) => id !== secId) }
        : p,
    );
    onSave(updated);
  };

  const primaryPaths: string[] = [];
  const secondaryPaths: string[] = [];
  for (const p of people) {
    const pos = positions[p.id];
    if (!pos) continue;
    if (p.primaryManagerId !== null) {
      const parentPos = positions[p.primaryManagerId];
      if (parentPos) {
        const x1 = parentPos.x + NODE_W / 2,
          y1 = parentPos.y + NODE_H;
        const x2 = pos.x + NODE_W / 2,
          y2 = pos.y,
          midY = y1 + V_GAP / 2;
        primaryPaths.push(`M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`);
      }
    }
    for (const secId of p.secondaryManagerIds) {
      const parentPos = positions[secId];
      if (parentPos) {
        const x1 = parentPos.x + NODE_W / 2,
          y1 = parentPos.y + NODE_H;
        const x2 = pos.x + NODE_W / 2,
          y2 = pos.y,
          cy = (y1 + y2) / 2;
        secondaryPaths.push(`M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`);
      }
    }
  }

  return (
    <div className="flex flex-col overflow-hidden bg-white border rounded-md border-slate-200">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-200 bg-slate-50/60">
        <div>
          <div
            className="text-[10px] tracking-[0.1em] uppercase text-slate-400"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Organization Hierarchy
          </div>
          <div className="font-semibold mt-0.5 text-[15px] text-slate-900">
            Drag a person onto another to reassign their manager
          </div>
        </div>
        <div className="flex items-center gap-4 ml-auto text-slate-500 text-[11px]">
          <div className="flex items-center gap-2">
            <div style={{ width: 24, height: 2, background: "#1E3A8A" }} />
            Primary
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 24, borderTop: "2px dashed #7C3AED" }} />
            Secondary (hold Shift, multiple allowed)
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-400" />
            Super admin (fixed at root)
          </div>
        </div>
      </div>

      <div
        className="flex-1 overflow-auto p-10"
        style={{
          minHeight: 500,
          backgroundImage: "radial-gradient(circle, #E2E8F0 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {people.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-[13px]">
            No workspace members yet.
          </div>
        ) : (
          <div className="relative" style={{ width, height, minWidth: "100%" }}>
            <svg
              className="absolute inset-0 pointer-events-none"
              width={width}
              height={height}
              style={{ overflow: "visible" }}
            >
              {primaryPaths.map((d, i) => (
                <path key={`p-${i}`} d={d} stroke="#1E3A8A" strokeWidth={1.8} fill="none" />
              ))}
              {secondaryPaths.map((d, i) => (
                <path
                  key={`s-${i}`}
                  d={d}
                  stroke="#7C3AED"
                  strokeWidth={1.6}
                  strokeDasharray="4 4"
                  fill="none"
                />
              ))}
            </svg>
            {people.map((p) => {
              const pos = positions[p.id];
              if (!pos) return null;
              return (
                <PersonNode
                  key={p.id}
                  person={p}
                  position={pos}
                  isSelected={selectedId === p.id}
                  isDragging={draggingId === p.id}
                  isDragTarget={dragOverId === p.id}
                  dragMode={getDragMode(p.id)}
                  onSelect={setSelectedId}
                  onDragStart={setDraggingId}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverId(null);
                  }}
                  onDragOver={(id) => id !== draggingId && setDragOverId(id)}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={handleDrop}
                />
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <PersonDrawer
          person={selected}
          people={people}
          onClose={() => setSelectedId(null)}
          onRemoveSecondary={handleRemoveSecondary}
        />
      )}

      {movePending && (
        <MoveConfirmModal
          people={people}
          fromId={movePending.fromId}
          toId={movePending.toId}
          isDirectParent={movePending.isDirectParent}
          onCancel={() => setMovePending(null)}
          onConfirm={handleMoveConfirm}
        />
      )}
    </div>
  );
};

export default OrgTree;
