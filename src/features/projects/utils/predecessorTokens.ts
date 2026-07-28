import { GanttLink } from "../schema/schedule.types";

/** MS-Project-style dependency relationship — matches the backend's ScheduleLinkType 1:1. */
export type ScheduleLinkType = "FS" | "SS" | "FF" | "SF";

export interface PredecessorToken {
  /** Predecessor's task id. */
  id: string;
  type: ScheduleLinkType;
  /** Days of delay after the predecessor's reference point; negative = lead/overlap. */
  lag: number;
}

export const LINK_TYPE_LABELS: Record<ScheduleLinkType, string> = {
  FS: "Finish → Start (FS)",
  SS: "Start → Start (SS)",
  FF: "Finish → Finish (FF)",
  SF: "Start → Finish (SF)",
};

/** Our FS/SS/FF/SF vocabulary <-> GanttLink's dhtmlx-flavored e2s/s2s/e2e/s2e vocabulary. */
export const LINK_TYPE_TO_GANTT: Record<ScheduleLinkType, GanttLink["type"]> = {
  FS: "e2s",
  SS: "s2s",
  FF: "e2e",
  SF: "s2e",
};
export const GANTT_TYPE_TO_LINK_TYPE: Record<GanttLink["type"], ScheduleLinkType> = {
  e2s: "FS",
  s2s: "SS",
  e2e: "FF",
  s2e: "SF",
};

const LAG_SUFFIX_RE = /([+-]\d+(?:\.\d+)?)\s*$/;
const TYPE_SUFFIX_RE = /(FS|SS|FF|SF)\s*$/i;

/**
 * Parses one MS-Project-style predecessor token — e.g. "3" (bare id, implies
 * FS/lag 0), "5FS+2" (Finish-to-Start, 2 days lag), "7SS-1" (Start-to-Start,
 * 1 day lead). Peels the optional lag suffix, then the optional type suffix,
 * from the right — deterministic, and doesn't need to assume anything about
 * what an id can look like. Returns null for a blank token.
 */
export function parsePredecessorToken(raw: string): PredecessorToken | null {
  let rest = raw.trim();
  if (!rest) return null;

  let lag = 0;
  const lagMatch = rest.match(LAG_SUFFIX_RE);
  if (lagMatch) {
    lag = Number(lagMatch[1]);
    rest = rest.slice(0, rest.length - lagMatch[1].length).trim();
  }

  let type: ScheduleLinkType = "FS";
  const typeMatch = rest.match(TYPE_SUFFIX_RE);
  if (typeMatch) {
    type = typeMatch[1].toUpperCase() as ScheduleLinkType;
    rest = rest.slice(0, rest.length - typeMatch[1].length).trim();
  }

  const id = rest.trim();
  if (!id) return null;

  return { id, type, lag: Number.isFinite(lag) ? lag : 0 };
}

/** Parses a comma-separated predecessor string ("3,5FS+2,7SS-1") into tokens, skipping blanks. */
export function parsePredecessorList(raw: string | null | undefined): PredecessorToken[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => parsePredecessorToken(part))
    .filter((t): t is PredecessorToken => t !== null);
}

/** Formats one token back to its string form — omits the type/lag suffix entirely for the default FS/0 case, so unchanged bare-id predecessors round-trip unchanged ("3" stays "3", not "3FS+0"). */
export function formatPredecessorToken(token: PredecessorToken): string {
  const lagSuffix = token.lag === 0 ? "" : token.lag > 0 ? `+${token.lag}` : `${token.lag}`;
  if (token.type === "FS") {
    return lagSuffix ? `${token.id}${lagSuffix}` : token.id;
  }
  return `${token.id}${token.type}${lagSuffix}`;
}

/** Formats a list of tokens back into the comma-separated predecessor string. */
export function formatPredecessorList(tokens: PredecessorToken[]): string {
  return tokens.map(formatPredecessorToken).join(",");
}
