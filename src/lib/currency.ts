/** Coerces a numeric column that may come back as a string (Postgres "numeric") to a number, or 0. */
export function toNumber(value?: number | string | null): number {
  if (value === null || value === undefined || value === "") return 0;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(num) ? num : 0;
}

const CURRENCY_PREFIX: Record<string, string> = { NPR: "Rs", INR: "₹", USD: "$", RMB: "¥" };

/** Human-readable currency amount, e.g. "Rs 1,250.00" (NPR, the default) or "$ 1,250.00" (USD).
 * Falls back to "--" when the value is absent. */
export function formatCost(value?: number | string | null, currency?: string | null): string {
  if (value === null || value === undefined || value === "") return "--";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "--";
  const prefix = CURRENCY_PREFIX[currency || "NPR"] || currency || "Rs";
  return `${prefix} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
