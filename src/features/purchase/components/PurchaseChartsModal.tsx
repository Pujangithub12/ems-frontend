import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { bsMonthLabel } from "../../../lib/bsDate";
import type { PurchaseBill } from "../api/purchase.api";
import { adToBs, addDaysIso, computeAmounts, daysBetweenInclusive, money } from "../lib/purchaseUtils";

const TOTAL_COLOR = "#2a78d6";
const PAID_COLOR = "#1baf7a";

type Granularity = "daily" | "monthly";
type ChartKind = "scurve" | "bar";

type Point = { key: string; label: string; total: number; paid: number; cumTotal: number; cumPaid: number };

const compact = (n: number): string => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Groups bills into daily or BS-monthly buckets (empty periods included, so the
 * S-curve is a true cumulative line rather than jumping between sparse dates). */
function buildSeries(bills: PurchaseBill[], granularity: Granularity): Point[] {
  if (bills.length === 0) return [];
  const sums = new Map<string, { total: number; paid: number }>();
  const keyOf = (adIso: string) => (granularity === "monthly" ? adToBs(adIso).slice(0, 7) : adIso);

  let minDate = bills[0].date;
  let maxDate = bills[0].date;
  for (const b of bills) {
    if (b.date < minDate) minDate = b.date;
    if (b.date > maxDate) maxDate = b.date;
    const { total } = computeAmounts(b);
    const key = keyOf(b.date);
    const bucket = sums.get(key) ?? { total: 0, paid: 0 };
    bucket.total += total;
    bucket.paid += Math.min(b.actualAmount, total);
    sums.set(key, bucket);
  }

  const keys: string[] = [];
  const span = daysBetweenInclusive(minDate, maxDate);
  for (let i = 0; i < span; i++) {
    const key = keyOf(addDaysIso(minDate, i));
    if (keys[keys.length - 1] !== key) keys.push(key);
  }

  let cumTotal = 0;
  let cumPaid = 0;
  return keys.map((key) => {
    const bucket = sums.get(key) ?? { total: 0, paid: 0 };
    cumTotal += bucket.total;
    cumPaid += bucket.paid;
    const label =
      granularity === "monthly"
        ? `${bsMonthLabel(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1)} ${key.slice(0, 4)}`
        : adToBs(key);
    return { key, label, total: bucket.total, paid: bucket.paid, cumTotal, cumPaid };
  });
}

const axisTick = { fontSize: 11, fill: "#898781" };
const tooltipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #e1e0d9" };

const PurchaseChartsModal: React.FC<{
  bills: PurchaseBill[];
  projectName: string;
  rangeLabel: string;
  spanDays: number;
  onClose: () => void;
}> = ({ bills, projectName, rangeLabel, spanDays, onClose }) => {
  const [granularity, setGranularity] = useState<Granularity>(spanDays > 62 ? "monthly" : "daily");
  const [chart, setChart] = useState<ChartKind>("scurve");
  const data = useMemo(() => buildSeries(bills, granularity), [bills, granularity]);
  const xTickFormatter = (label: string) => (granularity === "daily" ? label.slice(5) : label);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden bg-white border rounded-xl shadow-2xl border-slate-200/70 max-h-[94vh] flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-slate-200 bg-slate-50/60">
          <div>
            <div className="font-semibold text-[14px] text-slate-900">Purchase Charts</div>
            <div className="text-[12px] text-slate-500">
              {projectName} · {rangeLabel} · {bills.length} bill{bills.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-0.5 p-0.5 border rounded-lg border-slate-200 bg-slate-50">
              {([
                ["scurve", "S-Curve"],
                ["bar", "Bar Chart"],
              ] as [ChartKind, string][]).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setChart(k)}
                  className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors ${
                    chart === k ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 p-0.5 border rounded-lg border-slate-200 bg-slate-50">
              {(["daily", "monthly"] as Granularity[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium capitalize transition-colors ${
                    granularity === g ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-[13px] text-slate-400">No purchases in the selected range to chart.</div>
        ) : (
          <div className="p-5 overflow-y-auto">
            {chart === "scurve" && (
            <section className="p-4 border rounded-xl border-slate-200">
              <h3 className="mb-0.5 text-[13px] font-semibold text-slate-900">S-Curve</h3>
              <p className="mb-3 text-[11.5px] text-slate-500">Cumulative purchase amount over time</p>
              <div style={{ width: "100%", height: 380 }}>
                <ResponsiveContainer>
                  <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#e1e0d9" vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} tickFormatter={xTickFormatter} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} minTickGap={24} />
                    <YAxis tick={axisTick} tickFormatter={compact} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} width={48} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#52514e", fontWeight: 600 }}
                      formatter={(value, name) => [money(Number(value)), String(name)]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="cumTotal" name="Cumulative purchases" stroke={TOTAL_COLOR} strokeWidth={2} dot={data.length <= 31 ? { r: 3 } : false} />
                    <Line type="monotone" dataKey="cumPaid" name="Cumulative paid" stroke={PAID_COLOR} strokeWidth={2} dot={data.length <= 31 ? { r: 3 } : false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
            )}

            {chart === "bar" && (
            <section className="p-4 border rounded-xl border-slate-200">
              <h3 className="mb-0.5 text-[13px] font-semibold text-slate-900">Purchases per {granularity === "monthly" ? "month" : "day"}</h3>
              <p className="mb-3 text-[11.5px] text-slate-500">Total bill amount and amount paid in each period</p>
              <div style={{ width: "100%", height: 380 }}>
                <ResponsiveContainer>
                  <BarChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#e1e0d9" vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} tickFormatter={xTickFormatter} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} minTickGap={24} />
                    <YAxis tick={axisTick} tickFormatter={compact} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} width={48} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "#52514e", fontWeight: 600 }}
                      cursor={{ fill: "rgba(148,163,184,0.12)" }}
                      formatter={(value, name) => [money(Number(value)), String(name)]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="total" name="Total amount" fill={TOTAL_COLOR} radius={[3, 3, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="paid" name="Paid" fill={PAID_COLOR} radius={[3, 3, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseChartsModal;
