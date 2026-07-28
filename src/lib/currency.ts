/** Coerces a numeric column that may come back as a string (Postgres "numeric") to a number, or 0. */
export function toNumber(value?: number | string | null): number {
  if (value === null || value === undefined || value === "") return 0;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(num) ? num : 0;
}

/** Human-readable Nepali Rupee amount, e.g. "Rs 1,250.00". Falls back to "--" when absent. */
export function formatCost(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") return "--";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "--";
  return `Rs ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
