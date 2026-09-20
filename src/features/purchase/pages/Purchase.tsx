import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Loader2,
  Plus,
  X,
  Search,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  MoreVertical,
  Download,
  Upload,
  BarChart3,
  Check,
  Database,
  Clock,
  CheckCircle2,
  FileText,
  ArrowUp,
  ArrowDown,
  ShoppingCart,
} from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { useProjects } from "../../projects/hooks/useProjects";
import { useOrganizationVendorsQuery } from "../../inventory/hooks/useInventory";
import { getErrorMessage } from "../../../lib/errors";
import { formatCost } from "../../../lib/currency";
import { adDateForBsDay, bsMonthLabel, currentBsYearMonth, daysInBsMonth } from "../../../lib/bsDate";
import ErrorBanner from "../../../components/ErrorBanner";
import PurchaseChartsModal from "../components/PurchaseChartsModal";
import ConfirmationModal from "../../../components/ConfirmationModal";
import {
  usePurchaseBillsQuery,
  useCreatePurchaseBill,
  useUpdatePurchaseBill,
  useDeletePurchaseBill,
  useImportPurchaseBills,
} from "../hooks/usePurchases";
import type { PurchaseBill, PurchaseBillStatus, PurchasePaymentMode } from "../api/purchase.api";
import {
  adToBs,
  bsToAd,
  bsDateTime,
  addDaysIso,
  daysBetweenInclusive,
  computeAmounts,
  paymentStatusOf,
  money,
  parsePurchaseSheet,
  printBill,
  type SheetDateFormat,
} from "../lib/purchaseUtils";

const inputCls =
  "w-full px-3 py-2 text-[13px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-400 transition-colors";
const controlCls =
  "h-10 px-3 text-[12.5px] text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 transition-colors";

const STATUS_LABEL: Record<PurchaseBillStatus, string> = { paid: "Paid", partial: "Partial", pending: "Pending" };
const STATUS_PILL: Record<PurchaseBillStatus, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  partial: "bg-amber-100 text-amber-700",
  pending: "bg-red-100 text-red-600",
};

const StatusPill: React.FC<{ status: PurchaseBillStatus }> = ({ status }) => (
  <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${STATUS_PILL[status]}`}>{STATUS_LABEL[status]}</span>
);

const ModePill: React.FC<{ mode: PurchasePaymentMode }> = ({ mode }) => (
  <span
    className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${
      mode === "cash" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-600"
    }`}
  >
    {mode === "cash" ? "Cash" : "Credit"}
  </span>
);

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Bikram Sambat month calendar, rendered in a portal (so the table's
 * overflow clipping can't cut it off) and positioned under its input. */
const BsCalendarPopover: React.FC<{
  anchor: HTMLElement;
  valueAd: string;
  onPick: (ad: string) => void;
  onClose: () => void;
}> = ({ anchor, valueAd, onPick, onClose }) => {
  const initial = adToBs(valueAd) || adToBs(new Date().toLocaleDateString("en-CA"));
  const [view, setView] = useState({ year: Number(initial.slice(0, 4)), month: Number(initial.slice(5, 7)) - 1 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t) && !anchor.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose]);

  const shift = (delta: number) =>
    setView((v) => {
      const total = v.year * 12 + v.month + delta;
      return { year: Math.floor(total / 12), month: total % 12 };
    });

  let days = 30;
  let firstDow = 0;
  try {
    days = daysInBsMonth(view.year, view.month);
    firstDow = new Date(`${adDateForBsDay(view.year, view.month, 1)}T00:00:00`).getDay();
  } catch {
    /* out of the converter's supported range — show an empty month */
  }

  const selected = adToBs(valueAd);
  const today = adToBs(new Date().toLocaleDateString("en-CA"));
  const ymd = (day: number) => `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const rect = anchor.getBoundingClientRect();
  const height = 290;
  const top = rect.bottom + 4 + height > window.innerHeight ? Math.max(8, rect.top - height - 4) : rect.bottom + 4;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - 268));

  return createPortal(
    <div
      ref={ref}
      onMouseDown={(e) => e.preventDefault()}
      style={{ position: "fixed", top, left, width: 260 }}
      className="z-[90] p-3 bg-white border shadow-xl rounded-xl border-slate-200"
    >
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => shift(-1)} className="p-1 rounded text-slate-500 hover:bg-slate-100">
          <ChevronLeft size={15} />
        </button>
        <span className="text-[13px] font-semibold text-slate-800">
          {bsMonthLabel(view.year, view.month)} {view.year}
        </span>
        <button onClick={() => shift(1)} className="p-1 rounded text-slate-500 hover:bg-slate-100">
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-[10.5px] font-medium text-slate-400">
            {d}
          </div>
        ))}
        {Array.from({ length: firstDow }, (_, i) => (
          <div key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const label = ymd(day);
          return (
            <button
              key={day}
              onClick={() => {
                const ad = bsToAd(label);
                if (ad) onPick(ad);
              }}
              className={`h-8 text-[12px] rounded-md ${
                label === selected
                  ? "bg-blue-600 text-white font-semibold"
                  : label === today
                    ? "border border-blue-400 text-blue-700 hover:bg-blue-50"
                    : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => onPick(new Date().toLocaleDateString("en-CA"))}
        className="w-full mt-2 py-1.5 text-[12px] font-medium text-blue-700 rounded-md hover:bg-blue-50"
      >
        Today
      </button>
    </div>,
    document.body,
  );
};

/** A BS ("2082-02-15") date field — type a date, or click it to pick from a
 * BS calendar. Keeps its own draft while typing and only commits an AD ISO
 * date to the parent once it parses as a real date. */
const BsDateInput: React.FC<{
  valueAd: string;
  onCommit: (ad: string) => void;
  className?: string;
  placeholder?: string;
  picker?: boolean;
}> = ({ valueAd, onCommit, className, placeholder = "YYYY-MM-DD", picker = false }) => {
  const [draft, setDraft] = useState(adToBs(valueAd));
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(adToBs(valueAd)), [valueAd]);

  const commit = () => {
    const ad = bsToAd(draft);
    if (ad) onCommit(ad);
    else setDraft(adToBs(valueAd));
  };

  return (
    <>
      <input
        ref={inputRef}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => picker && setOpen(true)}
        onClick={() => picker && setOpen(true)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            setOpen(false);
          }
        }}
        className={className}
      />
      {picker && open && inputRef.current && (
        <BsCalendarPopover
          anchor={inputRef.current}
          valueAd={valueAd}
          onPick={(ad) => {
            onCommit(ad);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

const DateRangeField: React.FC<{ from: string; to: string; onChange: (from: string, to: string) => void }> = ({ from, to, onChange }) => (
  <div className={`${controlCls} flex items-center gap-2 px-3`}>
    <Calendar size={14} className="flex-shrink-0 text-slate-400" />
    <BsDateInput picker valueAd={from} onCommit={(ad) => onChange(ad, ad > to ? ad : to)} className="w-[82px] bg-transparent outline-none" />
    <span className="text-slate-400">–</span>
    <BsDateInput picker valueAd={to} onCommit={(ad) => onChange(ad < from ? ad : from, ad)} className="w-[82px] bg-transparent outline-none" />
    <ChevronDown size={14} className="flex-shrink-0 text-slate-400" />
  </div>
);

const SelectField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  width?: number;
}> = ({ value, onChange, options, width }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={controlCls} style={width ? { width } : undefined}>
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

const Trend: React.FC<{ pct: number | null; goodWhenUp: boolean; badColor: string }> = ({ pct, goodWhenUp, badColor }) => {
  if (pct == null) return null;
  const up = pct >= 0;
  const good = up === goodWhenUp;
  return (
    <span className={`flex items-center gap-0.5 text-[12px] font-semibold ${good ? "text-emerald-600" : badColor}`}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {Math.abs(Math.round(pct))}%
    </span>
  );
};

const SummaryCard: React.FC<{
  label: string;
  value: number;
  count: number;
  icon: React.ReactNode;
  iconBg: string;
  trend: React.ReactNode;
}> = ({ label, value, count, icon, iconBg, trend }) => (
  <div className="flex items-center gap-3 px-4 py-2.5 bg-white border shadow-sm rounded-xl border-slate-200">
    <div className={`flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-full ${iconBg}`}>{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="text-[12px] font-medium text-slate-600">{label}</div>
      <div className="text-[18px] font-bold leading-tight text-slate-900 truncate">{formatCost(value)}</div>
      <div className="flex items-center justify-between text-[11.5px] text-slate-500">
        <span>
          {count} bill{count === 1 ? "" : "s"}
        </span>
        {trend}
      </div>
    </div>
  </div>
);

// ---- Add / Edit modal ----

type FormState = {
  projectId: number | "";
  date: string;
  site: string;
  billNo: string;
  challanNo: string;
  vendorName: string;
  material: string;
  unit: string;
  quantity: string;
  rate: string;
  vatRate: string;
  actualAmount: string;
  vehicleNo: string;
  paymentMode: PurchasePaymentMode;
  paidBy: string;
  billStatus: PurchaseBillStatus;
  remarks: string;
};

const BillFormModal: React.FC<{
  bill: PurchaseBill | null;
  projects: { id: number; name: string }[];
  defaultProjectId: number | "";
  vendorNames: string[];
  siteNames: string[];
  onSave: (id: number | null, form: FormState) => Promise<void>;
  onClose: () => void;
}> = ({ bill, projects, defaultProjectId, vendorNames, siteNames, onSave, onClose }) => {
  const [form, setForm] = useState<FormState>(() => ({
    projectId: bill?.projectId ?? defaultProjectId ?? projects[0]?.id ?? "",
    date: bill?.date ?? new Date().toLocaleDateString("en-CA"),
    site: bill?.site ?? "",
    billNo: bill?.billNo ?? "",
    challanNo: bill?.challanNo ?? "",
    vendorName: bill?.vendorName ?? "",
    material: bill?.material ?? "",
    unit: bill?.unit ?? "",
    quantity: bill ? String(bill.quantity) : "",
    rate: bill ? String(bill.rate) : "",
    vatRate: bill ? String(bill.vatRate) : "13",
    actualAmount: bill ? String(bill.actualAmount) : "",
    vehicleNo: bill?.vehicleNo ?? "",
    paymentMode: bill?.paymentMode ?? "credit",
    paidBy: bill?.paidBy ?? "",
    billStatus: bill?.billStatus ?? "pending",
    remarks: bill?.remarks ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const preview = computeAmounts({
    quantity: Number(form.quantity) || 0,
    rate: Number(form.rate) || 0,
    vatRate: Number(form.vatRate) || 0,
    actualAmount: Number(form.actualAmount) || 0,
  });

  const handleSave = async () => {
    if (!form.projectId) return setError("Select a project.");
    if (!form.vendorName.trim()) return setError("Vendor name is required.");
    if (!form.material.trim()) return setError("Material / particulars is required.");
    if (form.quantity === "" || Number(form.quantity) < 0) return setError("Enter a valid quantity.");
    if (form.rate === "" || Number(form.rate) < 0) return setError("Enter a valid rate.");
    setSaving(true);
    setError(null);
    try {
      await onSave(bill?.id ?? null, form);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save purchase."));
    } finally {
      setSaving(false);
    }
  };

  const label = (text: string) => <label className="block mb-1 text-[11px] font-medium text-slate-500">{text}</label>;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden bg-white border rounded-xl shadow-2xl border-slate-200/70 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/60">
          <div className="font-semibold text-[14px] text-slate-900">{bill ? "Edit Purchase" : "Add Purchase"}</div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 overflow-y-auto sm:grid-cols-3">
          <div>
            {label("Date (BS)")}
            <BsDateInput picker valueAd={form.date} onCommit={(ad) => set("date", ad)} className={inputCls} />
          </div>
          <div>
            {label("Project")}
            <select className={inputCls} value={form.projectId} onChange={(e) => set("projectId", Number(e.target.value))}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            {label("Site")}
            <input className={inputCls} list="purchase-sites" value={form.site} onChange={(e) => set("site", e.target.value)} />
            <datalist id="purchase-sites">
              {siteNames.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            {label("Bill No.")}
            <input className={inputCls} value={form.billNo} onChange={(e) => set("billNo", e.target.value)} />
          </div>
          <div>
            {label("Challan No.")}
            <input className={inputCls} value={form.challanNo} onChange={(e) => set("challanNo", e.target.value)} />
          </div>
          <div>
            {label("Vendor Name")}
            <input className={inputCls} list="purchase-vendors" value={form.vendorName} onChange={(e) => set("vendorName", e.target.value)} />
            <datalist id="purchase-vendors">
              {vendorNames.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
          <div className="col-span-2">
            {label("Material / Particulars")}
            <input className={inputCls} value={form.material} onChange={(e) => set("material", e.target.value)} />
          </div>
          <div>
            {label("Unit")}
            <input className={inputCls} value={form.unit} onChange={(e) => set("unit", e.target.value)} />
          </div>
          <div>
            {label("Qty")}
            <input className={inputCls} type="number" min="0" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
          </div>
          <div>
            {label("Rate")}
            <input className={inputCls} type="number" min="0" value={form.rate} onChange={(e) => set("rate", e.target.value)} />
          </div>
          <div>
            {label("VAT %")}
            <input className={inputCls} type="number" min="0" max="100" value={form.vatRate} onChange={(e) => set("vatRate", e.target.value)} />
          </div>
          <div>
            {label("Actual Amount (paid)")}
            <input className={inputCls} type="number" min="0" value={form.actualAmount} onChange={(e) => set("actualAmount", e.target.value)} />
          </div>
          <div>
            {label("Vehicle No.")}
            <input className={inputCls} value={form.vehicleNo} onChange={(e) => set("vehicleNo", e.target.value)} />
          </div>
          <div>
            {label("Cash / Credit")}
            <select className={inputCls} value={form.paymentMode} onChange={(e) => set("paymentMode", e.target.value as PurchasePaymentMode)}>
              <option value="credit">Credit</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div>
            {label("Paid By")}
            <input className={inputCls} value={form.paidBy} onChange={(e) => set("paidBy", e.target.value)} />
          </div>
          <div>
            {label("Bill Status")}
            <select className={inputCls} value={form.billStatus} onChange={(e) => set("billStatus", e.target.value as PurchaseBillStatus)}>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="col-span-2 sm:col-span-3">
            {label("Remarks")}
            <input className={inputCls} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 col-span-2 gap-2 px-3 py-2.5 border rounded-lg sm:col-span-3 bg-slate-50 border-slate-200 text-[12.5px]">
            <span className="text-slate-500">
              Amount <b className="ml-1 text-black">{money(preview.amount)}</b>
            </span>
            <span className="text-slate-500">
              VAT <b className="ml-1 text-black">{money(preview.vat)}</b>
            </span>
            <span className="text-slate-500">
              Total <b className="ml-1 text-black">{money(preview.total)}</b>
            </span>
          </div>
          {error && <p className="col-span-2 text-[11.5px] text-red-600 sm:col-span-3">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {bill ? "Save Changes" : "Add Purchase"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---- Inline "new purchase" row, shown at the bottom of the table ----

const draftInput =
  "w-full min-w-[64px] px-1.5 py-1 text-[12px] bg-white border border-slate-300 rounded outline-none focus:border-blue-500";

const DraftRow: React.FC<{
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  vendorNames: string[];
  error: string | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  rowRef: React.RefObject<HTMLTableRowElement>;
}> = ({ form, onChange, vendorNames, error, saving, onSave, onCancel, rowRef }) => {
  const a = computeAmounts({
    quantity: Number(form.quantity) || 0,
    rate: Number(form.rate) || 0,
    vatRate: Number(form.vatRate) || 0,
    actualAmount: Number(form.actualAmount) || 0,
  });
  const cell = "px-1.5 py-2 border border-slate-200 align-middle";
  const num = "text-right text-[12px] text-slate-500";
  const onEnter = (e: React.KeyboardEvent) => e.key === "Enter" && !e.ctrlKey && !e.metaKey && onSave();
  return (
    <>
      <tr ref={rowRef} className="bg-blue-50/60" onKeyDown={onEnter}>
        <td className={`${cell} text-center text-[11px] font-semibold text-blue-600`}>New</td>
        <td className={`${cell} min-w-[100px]`}>
          <BsDateInput picker valueAd={form.date} onCommit={(ad) => onChange({ date: ad })} className={draftInput} />
        </td>
        <td className={cell}>
          <input className={draftInput} autoFocus value={form.billNo} onChange={(e) => onChange({ billNo: e.target.value })} />
        </td>
        <td className={cell}>
          <input className={draftInput} value={form.challanNo} onChange={(e) => onChange({ challanNo: e.target.value })} />
        </td>
        <td className={`${cell} min-w-[130px]`}>
          <input className={draftInput} list="draft-vendors" value={form.vendorName} onChange={(e) => onChange({ vendorName: e.target.value })} />
          <datalist id="draft-vendors">
            {vendorNames.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </td>
        <td className={`${cell} min-w-[130px]`}>
          <input className={draftInput} value={form.material} onChange={(e) => onChange({ material: e.target.value })} />
        </td>
        <td className={cell}>
          <input className={`${draftInput} min-w-[50px]`} value={form.unit} onChange={(e) => onChange({ unit: e.target.value })} />
        </td>
        <td className={cell}>
          <input className={`${draftInput} text-right`} type="number" min="0" value={form.quantity} onChange={(e) => onChange({ quantity: e.target.value })} />
        </td>
        <td className={cell}>
          <input className={`${draftInput} text-right`} type="number" min="0" value={form.rate} onChange={(e) => onChange({ rate: e.target.value })} />
        </td>
        <td className={`${cell} ${num}`}>{money(a.amount)}</td>
        <td className={`${cell} ${num}`}>
          {money(a.vat)}
          <div className="flex items-center justify-end gap-0.5 mt-1">
            <input
              className="w-11 px-1 py-0.5 text-[11px] text-right bg-white border border-slate-300 rounded outline-none focus:border-blue-500"
              type="number"
              min="0"
              max="100"
              value={form.vatRate}
              onChange={(e) => onChange({ vatRate: e.target.value })}
            />
            %
          </div>
        </td>
        <td className={`${cell} ${num}`}>{money(a.total)}</td>
        <td className={cell}>
          <input className={`${draftInput} text-right`} type="number" min="0" value={form.actualAmount} onChange={(e) => onChange({ actualAmount: e.target.value })} />
        </td>
        <td className={cell}>
          <input className={draftInput} value={form.vehicleNo} onChange={(e) => onChange({ vehicleNo: e.target.value })} />
        </td>
        <td className={cell}>
          <select className={draftInput} value={form.paymentMode} onChange={(e) => onChange({ paymentMode: e.target.value as PurchasePaymentMode })}>
            <option value="credit">Credit</option>
            <option value="cash">Cash</option>
          </select>
        </td>
        <td className={cell}>
          <input className={draftInput} value={form.paidBy} onChange={(e) => onChange({ paidBy: e.target.value })} />
        </td>
        <td className={cell}>
          <select className={draftInput} value={form.billStatus} onChange={(e) => onChange({ billStatus: e.target.value as PurchaseBillStatus })}>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </td>
        <td className={`${cell} min-w-[110px]`}>
          <input className={draftInput} value={form.remarks} onChange={(e) => onChange({ remarks: e.target.value })} />
        </td>
        <td className={`${cell} text-center whitespace-nowrap`}>
          <button
            onClick={onSave}
            disabled={saving}
            title="Save purchase"
            className="p-1.5 mr-1 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          </button>
          <button onClick={onCancel} title="Cancel" className="p-1.5 border rounded text-slate-500 border-slate-300 hover:bg-white">
            <X size={13} />
          </button>
        </td>
      </tr>
      {error && (
        <tr className="bg-blue-50/60">
          <td colSpan={COLUMNS.length} className="px-3 py-2 text-[12px] font-medium text-red-600 border border-slate-200">
            {error}
          </td>
        </tr>
      )}
    </>
  );
};

// ---- Upload Sheet — format guide shown before the file picker opens ----

const SAMPLE_HEADERS = [
  "Date",
  "Bill No",
  "Challan No",
  "Vendor Name",
  "Material / Particulars",
  "Unit",
  "Qty",
  "Rate",
  "VAT",
  "Actual Amount",
  "Vehicle No",
  "Cash/Credit",
  "Paid By",
  "Bill Status",
  "Site",
  "Remarks",
];
const SAMPLE_ROWS = [
  ["2082-02-15", "BILL-001", "CH-001", "Sarbottam Cement", "PPC Cement", "Bag", "200", "411.50", "10,699.00", "92,999.00", "Ba 3 Kha 7281", "Credit", "ABC Construction", "Paid", "Site A", "-"],
  ["2082-02-12", "BILL-004", "CH-004", "Shree Enterprises", "Electrical Wire", "Roll", "10", "8,500.00", "11,050.00", "80,000.00", "Ba 4 Kha 2210", "Credit", "ABC Construction", "Partial", "Site A", "Balance 16,050"],
];
const REQUIRED_HEADERS = new Set(["Date", "Vendor Name", "Material / Particulars"]);

const UploadSheetModal: React.FC<{ projectName: string | null; onChoose: (format: SheetDateFormat) => void; onClose: () => void }> = ({
  projectName,
  onChoose,
  onClose,
}) => {
  const [dateFormat, setDateFormat] = useState<SheetDateFormat>("BS");
  return (
  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
    <div className="w-full max-w-3xl overflow-hidden bg-white border rounded-xl shadow-2xl border-slate-200/70 max-h-[92vh] flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/60">
        <div className="font-semibold text-[14px] text-slate-900">Upload Sheet</div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 space-y-3 overflow-y-auto">
        <p className="text-[12.5px] text-slate-600">
          Upload an Excel (.xlsx, .xls) or CSV file. The first row must be the column headers, and each following row is one purchase. Your
          sheet should look like this:
        </p>
        <div className="overflow-x-auto border rounded-lg border-slate-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f3f6fb]">
                {SAMPLE_HEADERS.map((h) => (
                  <th key={h} className="px-3 py-2 text-[11px] font-semibold text-blue-900 border border-slate-200 whitespace-nowrap">
                    {h}
                    {REQUIRED_HEADERS.has(h) && <span className="ml-0.5 text-red-500">*</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[11px] text-black">
              {SAMPLE_ROWS.map((row, i) => (
                <tr key={i} className="bg-white">
                  {row.map((v, j) => (
                    <td key={j} className="px-3 py-2 border border-slate-200 whitespace-nowrap">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="pl-4 space-y-1 text-[12px] list-disc text-slate-600">
          <li>
            <span className="text-red-500">*</span> Date, Vendor Name and Material / Particulars are required. Every other column is optional.
          </li>
          <li>
            Dates can be typed as 2083/05/22 or 22-05-2083, or be real Excel dates. Choose below whether the dates in your sheet are
            Bikram Sambat (BS) or AD.
          </li>
          <li>
            Amount and Total are calculated for you from Qty and Rate. VAT is the VAT amount — the VAT % is worked out from it (13% if left
            blank).
          </li>
          <li>
            Actual Amount is what has been paid so far. Cash/Credit: Cash or Credit. Bill Status: Paid, Partial or Pending (worked out from
            Actual Amount if left blank).
          </li>
          <li>
            If Vendor Name is left empty but the material reads "Vendor - Item" (e.g. Sarbottam Cement - PPC), the vendor is taken from it.
          </li>
          <li>Column order doesn't matter — columns are matched by header name. Rows that can't be read are skipped and reported.</li>
        </ul>
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] font-medium text-slate-700">Dates in this sheet are in</span>
          <div className="flex overflow-hidden border rounded-lg border-slate-200">
            {(["BS", "AD"] as SheetDateFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => setDateFormat(f)}
                className={`px-4 py-1.5 text-[12.5px] font-medium ${
                  dateFormat === f ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f === "BS" ? "BS (Bikram Sambat)" : "AD (English)"}
              </button>
            ))}
          </div>
        </div>
        {projectName ? (
          <p className="text-[12px] text-slate-500">
            Purchases will be added to the project <b className="text-slate-800">{projectName}</b>.
          </p>
        ) : (
          <p className="text-[12px] text-amber-600">Select a project in the "All Projects" filter first — uploaded purchases are added to one project.</p>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
        <button onClick={onClose} className="px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
          Cancel
        </button>
        <button
          onClick={() => onChoose(dateFormat)}
          disabled={!projectName}
          className="flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload size={14} /> Choose File
        </button>
      </div>
    </div>
  </div>
  );
};

// ---- Detail panel ----

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start gap-3 py-1 text-[12px]">
    <span className="w-[112px] flex-shrink-0 text-slate-500">{label}</span>
    <span className="flex-1 min-w-0 text-slate-800 break-words">{children}</span>
  </div>
);

const DetailPanel: React.FC<{ bill: PurchaseBill; onClose: () => void }> = ({ bill, onClose }) => {
  const { amount, vat, total } = computeAmounts(bill);
  const payment = paymentStatusOf(bill);
  const heading = (t: string) => <div className="mt-5 mb-1.5 text-[13px] font-semibold text-slate-900">{t}</div>;
  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex flex-col w-full max-w-[400px] bg-white border-l shadow-2xl border-slate-200 xl:static xl:z-auto xl:w-[380px] xl:max-w-none xl:shadow-none xl:flex-shrink-0">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div className="text-[15px] font-semibold text-slate-900">Purchase Details</div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 px-5 py-4 overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[17px] font-semibold text-slate-900">{bill.vendorName}</div>
          <StatusPill status={bill.billStatus} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-[11px] text-slate-500">
          <div>
            Bill No.
            <div className="mt-0.5 text-[12.5px] font-semibold text-slate-900">{bill.billNo || "—"}</div>
          </div>
          <div>
            Date
            <div className="mt-0.5 text-[12.5px] text-slate-900">{adToBs(bill.date)}</div>
          </div>
          <div>
            Challan No.
            <div className="mt-0.5 text-[12.5px] text-slate-900">{bill.challanNo || "—"}</div>
          </div>
        </div>

        {heading("Vendor Information")}
        <DetailRow label="Vendor Name">{bill.vendorName}</DetailRow>
        <DetailRow label="Contact Person">{bill.vendor?.contactPerson || "—"}</DetailRow>
        <DetailRow label="Phone">{bill.vendor?.phone || "—"}</DetailRow>
        <DetailRow label="Address">{bill.vendor?.address || "—"}</DetailRow>

        {heading("Items")}
        <div className="overflow-hidden border rounded-lg border-slate-200">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-2 py-1.5 text-left font-semibold">Particulars</th>
                <th className="px-2 py-1.5 text-left font-semibold">Unit</th>
                <th className="px-2 py-1.5 text-right font-semibold">Qty</th>
                <th className="px-2 py-1.5 text-right font-semibold">Rate</th>
                <th className="px-2 py-1.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-200">
                <td className="px-2 py-2 font-medium">{bill.material}</td>
                <td className="px-2 py-2">{bill.unit || "—"}</td>
                <td className="px-2 py-2 text-right">{bill.quantity.toLocaleString()}</td>
                <td className="px-2 py-2 text-right">{money(bill.rate)}</td>
                <td className="px-2 py-2 text-right">{money(amount)}</td>
              </tr>
            </tbody>
          </table>
          <div className="text-[12px] border-t border-slate-200">
            <div className="flex justify-between px-3 py-1.5 font-semibold">
              <span>Sub Total</span>
              <span>{money(amount)}</span>
            </div>
            <div className="flex justify-between px-3 py-1.5">
              <span>VAT ({bill.vatRate}%)</span>
              <span>{money(vat)}</span>
            </div>
            <div className="flex justify-between px-3 py-1.5 font-bold border-t border-slate-200">
              <span>Total Amount</span>
              <span>{money(total)}</span>
            </div>
            <div className="flex justify-between px-3 py-1.5 font-bold bg-blue-50">
              <span>Actual Amount</span>
              <span>{money(bill.actualAmount)}</span>
            </div>
          </div>
        </div>

        {heading("Payment & Logistics")}
        <DetailRow label="Cash/Credit">
          <ModePill mode={bill.paymentMode} />
        </DetailRow>
        <DetailRow label="Paid By">{bill.paidBy || "—"}</DetailRow>
        <DetailRow label="Vehicle No.">{bill.vehicleNo || "—"}</DetailRow>
        <DetailRow label="Payment Status">
          <StatusPill status={payment} />
        </DetailRow>
        <DetailRow label="Bill Status">
          <StatusPill status={bill.billStatus} />
        </DetailRow>
        <DetailRow label="Remarks">{bill.remarks || "—"}</DetailRow>

        {heading("Additional Information")}
        <DetailRow label="Project">{bill.projectName}</DetailRow>
        <DetailRow label="Site">{bill.site || "—"}</DetailRow>
        <DetailRow label="Created By">{bill.createdByName || "—"}</DetailRow>
        <DetailRow label="Created At">{bsDateTime(bill.createdAt)}</DetailRow>
        <DetailRow label="Last Updated">{bsDateTime(bill.updatedAt)}</DetailRow>
      </div>
      <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-200">
        <button
          onClick={() => printBill(bill)}
          className="flex items-center justify-center flex-1 gap-1.5 px-3 py-2 text-[12.5px] font-medium text-blue-700 border border-blue-200 rounded-lg bg-blue-50/40 hover:bg-blue-50"
        >
          <Download size={14} /> Download Bill (PDF)
        </button>
        <button onClick={onClose} className="px-6 py-2 text-[12.5px] font-medium border rounded-lg text-slate-700 border-slate-200 hover:bg-slate-50">
          Close
        </button>
      </div>
    </aside>
  );
};

// ---- Page ----

type SortKey =
  | "date"
  | "billNo"
  | "challanNo"
  | "vendorName"
  | "material"
  | "unit"
  | "quantity"
  | "rate"
  | "amount"
  | "vat"
  | "total"
  | "actualAmount"
  | "paymentMode"
  | "billStatus";

const COLUMNS: { key: SortKey | "sno" | "vehicleNo" | "paidBy" | "remarks" | "actions"; label: string; sortable?: boolean; align?: "right" | "center" }[] = [
  { key: "sno", label: "S.No" },
  { key: "date", label: "Date" },
  { key: "billNo", label: "Bill No.", sortable: true },
  { key: "challanNo", label: "Challan No.", sortable: true },
  { key: "vendorName", label: "Vendor Name", sortable: true },
  { key: "material", label: "Material / Particulars", sortable: true },
  { key: "unit", label: "Unit", sortable: true },
  { key: "quantity", label: "Qty", sortable: true, align: "right" },
  { key: "rate", label: "Rate", sortable: true, align: "right" },
  { key: "amount", label: "Amount", sortable: true, align: "right" },
  { key: "vat", label: "VAT", sortable: true, align: "right" },
  { key: "total", label: "Total Amount", sortable: true, align: "right" },
  { key: "actualAmount", label: "Actual Amount", sortable: true, align: "right" },
  { key: "vehicleNo", label: "Vehicle No" },
  { key: "paymentMode", label: "Cash/Credit", sortable: true },
  { key: "paidBy", label: "Paid By" },
  { key: "billStatus", label: "Bill Status", sortable: true },
  { key: "remarks", label: "Remarks" },
  { key: "actions", label: "Actions", align: "center" },
];

function sortValue(b: PurchaseBill, key: SortKey): string | number {
  const a = computeAmounts(b);
  switch (key) {
    case "amount":
      return a.amount;
    case "vat":
      return a.vat;
    case "total":
      return a.total;
    case "billStatus":
      return b.billStatus;
    default:
      return (b[key] ?? "") as string | number;
  }
}

const Purchase: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const { data: projects = [] } = useProjects();
  const billsQuery = usePurchaseBillsQuery();
  const vendorsQuery = useOrganizationVendorsQuery();
  const bills = useMemo(() => billsQuery.data ?? [], [billsQuery.data]);

  const createMutation = useCreatePurchaseBill();
  const updateMutation = useUpdatePurchaseBill();
  const deleteMutation = useDeletePurchaseBill();
  const importMutation = useImportPurchaseBills();

  // Until the user picks a range, show everything that's been recorded (so saved
  // or uploaded bills never seem to vanish after a refresh); with no bills yet,
  // fall back to the current Bikram Sambat month.
  const [userRange, setUserRange] = useState<{ from: string; to: string } | null>(null);
  const range = useMemo(() => {
    if (userRange) return userRange;
    if (bills.length > 0) {
      const dates = bills.map((b) => b.date);
      return { from: dates.reduce((a, b) => (b < a ? b : a)), to: dates.reduce((a, b) => (b > a ? b : a)) };
    }
    const { year, month } = currentBsYearMonth();
    return { from: adDateForBsDay(year, month, 1), to: adDateForBsDay(year, month, daysInBsMonth(year, month)) };
  }, [userRange, bills]);
  const setRange = (next: { from: string; to: string } | ((r: { from: string; to: string }) => { from: string; to: string })) =>
    setUserRange(typeof next === "function" ? next(range) : next);
  const [projectFilter, setProjectFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [billFilter, setBillFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [uploadInfoOpen, setUploadInfoOpen] = useState(false);
  const [chartsOpen, setChartsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseBill | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PurchaseBill | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<FormState | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const draftRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (menuId == null) return;
    const close = () => setMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuId]);

  const siteNames = useMemo(() => [...new Set(bills.map((b) => b.site).filter((s): s is string => !!s))].sort(), [bills]);
  const vendorNames = useMemo(() => {
    const names = new Set<string>(bills.map((b) => b.vendorName));
    names.delete("-");
    (vendorsQuery.data ?? []).forEach((v) => names.add(v.name));
    return [...names].sort();
  }, [bills, vendorsQuery.data]);

  /** Every filter except the date range, so the same rows can be windowed to
   * the selected period and to the previous period for the cards' trend. */
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bills.filter((b) => {
      if (projectFilter && String(b.projectId) !== projectFilter) return false;
      if (vendorFilter && b.vendorName !== vendorFilter) return false;
      if (paymentFilter && paymentStatusOf(b) !== paymentFilter) return false;
      if (billFilter && b.billStatus !== billFilter) return false;
      if (q && !`${b.billNo ?? ""} ${b.challanNo ?? ""} ${b.vendorName} ${b.material}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [bills, projectFilter, vendorFilter, paymentFilter, billFilter, search]);

  const inRange = (b: PurchaseBill, from: string, to: string) => b.date >= from && b.date <= to;
  const filtered = useMemo(() => scoped.filter((b) => inRange(b, range.from, range.to)), [scoped, range]);

  const summarize = (list: PurchaseBill[]) => {
    let total = 0;
    let pendingPayment = 0;
    let pendingPaymentCount = 0;
    let paid = 0;
    let paidCount = 0;
    let pendingBills = 0;
    let pendingBillsCount = 0;
    for (const b of list) {
      const a = computeAmounts(b);
      total += a.total;
      if (a.balance > 0.005) {
        pendingPayment += a.balance;
        pendingPaymentCount++;
      }
      paid += Math.min(b.actualAmount, a.total);
      if (paymentStatusOf(b) === "paid") paidCount++;
      if (b.billStatus === "pending") {
        pendingBills += a.total;
        pendingBillsCount++;
      }
    }
    return { total, count: list.length, pendingPayment, pendingPaymentCount, paid, paidCount, pendingBills, pendingBillsCount };
  };

  const stats = useMemo(() => summarize(filtered), [filtered]);
  const prevStats = useMemo(() => {
    const len = daysBetweenInclusive(range.from, range.to);
    const prevTo = addDaysIso(range.from, -1);
    const prevFrom = addDaysIso(prevTo, -(len - 1));
    return summarize(scoped.filter((b) => inRange(b, prevFrom, prevTo)));
  }, [scoped, range]);
  const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return cmp !== 0 ? cmp * dir : b.id - a.id;
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => setPage(1), [range, projectFilter, vendorFilter, paymentFilter, billFilter, search, pageSize]);

  const selected = bills.find((b) => b.id === selectedId) ?? null;
  const defaultProjectId: number | "" = projectFilter ? Number(projectFilter) : projects[0]?.id ?? "";

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const handleSave = async (id: number | null, f: FormState) => {
    const payload = {
      projectId: Number(f.projectId),
      date: f.date,
      billNo: f.billNo.trim() || null,
      challanNo: f.challanNo.trim() || null,
      vendorName: f.vendorName.trim(),
      material: f.material.trim(),
      unit: f.unit.trim() || null,
      quantity: Number(f.quantity),
      rate: Number(f.rate),
      vatRate: f.vatRate.trim() ? Number(f.vatRate) : null,
      actualAmount: f.actualAmount.trim() ? Number(f.actualAmount) : null,
      vehicleNo: f.vehicleNo.trim() || null,
      paymentMode: f.paymentMode,
      paidBy: f.paidBy.trim() || null,
      billStatus: f.billStatus,
      site: f.site.trim() || null,
      remarks: f.remarks.trim() || null,
    };
    if (id != null) await updateMutation.mutateAsync({ id, payload });
    else await createMutation.mutateAsync(payload);
  };

  const importProjectId = projectFilter ? Number(projectFilter) : projects.length === 1 ? projects[0].id : null;
  const importProjectName = projects.find((p) => p.id === importProjectId)?.name ?? null;

  const startDraft = () => {
    setDraftError(null);
    setDraft({
      projectId: defaultProjectId,
      date: new Date().toLocaleDateString("en-CA"),
      site: "",
      billNo: "",
      challanNo: "",
      vendorName: "",
      material: "",
      unit: "",
      quantity: "",
      rate: "",
      vatRate: "13",
      actualAmount: "",
      vehicleNo: "",
      paymentMode: "credit",
      paidBy: "",
      billStatus: "pending",
      remarks: "",
    });
    setSelectedId(null);
    // Jump to the last page so the new row sits directly below the existing rows.
    setPage(Math.max(1, Math.ceil(sorted.length / pageSize)));
    setTimeout(() => draftRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const saveDraft = async (addAnother = false) => {
    if (!draft || draftSaving) return;
    if (!draft.projectId) return setDraftError("Select a project.");
    if (!draft.vendorName.trim()) return setDraftError("Vendor name is required.");
    if (!draft.material.trim()) return setDraftError("Material / particulars is required.");
    if (draft.quantity === "" || Number(draft.quantity) < 0) return setDraftError("Enter a valid quantity.");
    if (draft.rate === "" || Number(draft.rate) < 0) return setDraftError("Enter a valid rate.");
    setDraftSaving(true);
    setDraftError(null);
    try {
      await handleSave(null, draft);
      // Widen the date filter so the row that was just added is visible.
      setRange((r) => ({ from: draft.date < r.from ? draft.date : r.from, to: draft.date > r.to ? draft.date : r.to }));
      setDraft(null);
      if (addAnother) startDraft();
    } catch (err) {
      setDraftError(getErrorMessage(err, "Failed to save purchase."));
    } finally {
      setDraftSaving(false);
    }
  };

  // Ctrl+Enter: open a new row; while a row is open, save it and open the next one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
      if (formOpen || uploadInfoOpen || confirmDelete) return;
      e.preventDefault();
      if (draft) void saveDraft(true);
      else startDraft();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const uploadFormatRef = useRef<SheetDateFormat>("BS");

  const handleImport = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    const projectId = importProjectId;
    if (!projectId) return setNotice({ kind: "error", text: "Select a project in the filter above before importing." });
    try {
      const parsed = await parsePurchaseSheet(file, uploadFormatRef.current);
      if (parsed.rows.length === 0) {
        const why = parsed.errors[0] ? ` (row ${parsed.errors[0].row}: ${parsed.errors[0].message})` : "";
        return setNotice({ kind: "error", text: `No importable rows found${why}.` });
      }
      const result = await importMutation.mutateAsync({ projectId, rows: parsed.rows });
      // Widen the date filter so the just-imported bills are actually visible.
      const dates = parsed.rows.map((r) => r.date).sort();
      setRange((r) => ({ from: dates[0] < r.from ? dates[0] : r.from, to: dates[dates.length - 1] > r.to ? dates[dates.length - 1] : r.to }));
      const skipped = result.skipped + parsed.errors.length;
      const firstError = parsed.errors[0] ?? result.errors[0];
      setNotice({
        kind: "success",
        text: `Imported ${result.created} purchase${result.created === 1 ? "" : "s"}${
          skipped ? `, skipped ${skipped}${firstError ? ` (row ${firstError.row}: ${firstError.message})` : ""}` : ""
        }.`,
      });
    } catch (err) {
      setNotice({ kind: "error", text: getErrorMessage(err, "Failed to import sheet.") });
    }
  };

  const projectOptions = [{ value: "", label: "All Projects" }, ...projects.map((p) => ({ value: String(p.id), label: p.name }))];

  const pageButtons = useMemo(() => {
    const start = Math.max(1, Math.min(safePage - 1, pageCount - 2));
    return Array.from({ length: Math.min(3, pageCount) }, (_, i) => start + i);
  }, [safePage, pageCount]);

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
          <ShoppingCart className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-[13px] text-slate-400">No projects yet — create a project to start tracking purchases.</p>
      </div>
    );
  }

  return (
    <div className="flex w-full min-h-full bg-[#f6f9fd]">
      <div className="flex-1 min-w-0 px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
          <div>
            <div className="text-[11.5px] font-medium tracking-wide uppercase text-slate-400">Project</div>
            <div className="text-[22px] font-bold leading-tight text-slate-900">
              {projects.find((p) => String(p.id) === projectFilter)?.name ?? "All Projects"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SelectField value={projectFilter} onChange={setProjectFilter} options={projectOptions} width={170} />
            <button
              onClick={() => setChartsOpen(true)}
              className="flex items-center h-10 gap-1.5 px-4 text-[12.5px] font-medium text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50"
            >
              <BarChart3 size={15} /> Show Charts
            </button>
          </div>
        </div>

        {notice &&
          (notice.kind === "error" ? (
            <ErrorBanner message={notice.text} onDismiss={() => setNotice(null)} className="mb-4" />
          ) : (
            <div className="flex items-center justify-between px-4 py-2.5 mb-4 text-[12.5px] border rounded-lg bg-emerald-50 border-emerald-200 text-emerald-800">
              {notice.text}
              <button onClick={() => setNotice(null)} className="p-0.5 rounded hover:bg-emerald-100">
                <X size={13} />
              </button>
            </div>
          ))}

        <div className="grid grid-cols-1 gap-3 mb-2.5 sm:grid-cols-2 2xl:grid-cols-4">
          <SummaryCard
            label="Total Purchases"
            value={stats.total}
            count={stats.count}
            icon={<Database size={17} className="text-blue-600" />}
            iconBg="bg-blue-100"
            trend={<Trend pct={pct(stats.total, prevStats.total)} goodWhenUp badColor="text-red-500" />}
          />
          <SummaryCard
            label="Pending Payment"
            value={stats.pendingPayment}
            count={stats.pendingPaymentCount}
            icon={<Clock size={17} className="text-orange-500" />}
            iconBg="bg-orange-100"
            trend={<Trend pct={pct(stats.pendingPayment, prevStats.pendingPayment)} goodWhenUp={false} badColor="text-orange-500" />}
          />
          <SummaryCard
            label="Paid"
            value={stats.paid}
            count={stats.paidCount}
            icon={<CheckCircle2 size={17} className="text-emerald-600" />}
            iconBg="bg-emerald-100"
            trend={<Trend pct={pct(stats.paid, prevStats.paid)} goodWhenUp badColor="text-red-500" />}
          />
          <SummaryCard
            label="Pending Bills"
            value={stats.pendingBills}
            count={stats.pendingBillsCount}
            icon={<FileText size={17} className="text-red-500" />}
            iconBg="bg-red-100"
            trend={<Trend pct={pct(stats.pendingBills, prevStats.pendingBills)} goodWhenUp={false} badColor="text-red-500" />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-2.5">
          <div className={`${controlCls} flex items-center flex-1 gap-2 min-w-[220px]`}>
            <Search size={14} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Bill/Vendor/Material..."
              className="flex-1 min-w-0 bg-transparent outline-none"
            />
          </div>
          <DateRangeField from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
          <SelectField
            value={vendorFilter}
            onChange={setVendorFilter}
            options={[{ value: "", label: "All Vendors" }, ...vendorNames.map((v) => ({ value: v, label: v }))]}
            width={150}
          />
          <SelectField
            value={paymentFilter}
            onChange={setPaymentFilter}
            options={[
              { value: "", label: "Payment Status" },
              { value: "paid", label: "Paid" },
              { value: "partial", label: "Partial" },
              { value: "pending", label: "Pending" },
            ]}
            width={140}
          />
          <SelectField
            value={billFilter}
            onChange={setBillFilter}
            options={[
              { value: "", label: "Bill Status" },
              { value: "paid", label: "Paid" },
              { value: "partial", label: "Partial" },
              { value: "pending", label: "Pending" },
            ]}
            width={130}
          />
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleImport(e.target.files?.[0])} />
          <button
            onClick={() => setUploadInfoOpen(true)}
            disabled={importMutation.isPending}
            className="flex items-center h-10 gap-1.5 px-4 text-[12.5px] font-medium text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-60"
          >
            {importMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload Sheet
          </button>
          <button
            onClick={startDraft}
            title="Add a new row (Ctrl + Enter)"
            className="flex items-center h-10 gap-1.5 px-4 text-[12.5px] font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700"
          >
            <Plus size={14} /> Add Purchase
          </button>
        </div>

        <div className="overflow-hidden bg-white border shadow-sm rounded-xl border-slate-200">
          {billsQuery.isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1500px]">
                <thead>
                  <tr className="bg-[#f3f6fb]">
                    {COLUMNS.map((c) => {
                      const active = c.sortable && sort.key === c.key;
                      return (
                        <th
                          key={c.key}
                          onClick={c.sortable ? () => toggleSort(c.key as SortKey) : undefined}
                          className={`px-2.5 py-3 text-[11.5px] font-semibold text-slate-700 border border-slate-200 whitespace-nowrap ${
                            c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""
                          } ${c.sortable ? "cursor-pointer select-none" : ""}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {c.label}
                            {c.sortable &&
                              (active ? (
                                sort.dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                              ) : (
                                <ChevronsUpDown size={11} className="text-slate-400" />
                              ))}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 && !draft ? (
                    <tr>
                      <td colSpan={COLUMNS.length} className="py-14 text-[13px] text-center text-slate-400">
                        {bills.length === 0 ? "No purchases yet — click Add Purchase or Upload Sheet." : "No purchases match the current filters."}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((b, i) => {
                      const a = computeAmounts(b);
                      const cell = "px-2.5 py-3 text-[12px] text-slate-800 border border-slate-200";
                      return (
                        <tr
                          key={b.id}
                          onClick={() => setSelectedId(b.id)}
                          className={`cursor-pointer hover:bg-blue-50/60 ${selectedId === b.id ? "bg-blue-50" : "bg-white"}`}
                        >
                          <td className={`${cell} font-semibold`}>{(safePage - 1) * pageSize + i + 1}</td>
                          <td className={`${cell} whitespace-nowrap`}>{adToBs(b.date)}</td>
                          <td className={`${cell} font-semibold`}>{b.billNo || "-"}</td>
                          <td className={cell}>{b.challanNo || "-"}</td>
                          <td className={`${cell} font-medium min-w-[120px]`}>{b.vendorName}</td>
                          <td className={`${cell} min-w-[110px]`}>{b.material}</td>
                          <td className={cell}>{b.unit || "-"}</td>
                          <td className={`${cell} text-right`}>{b.quantity.toLocaleString()}</td>
                          <td className={`${cell} text-right`}>{money(b.rate)}</td>
                          <td className={`${cell} text-right`}>{money(a.amount)}</td>
                          <td className={`${cell} text-right`}>{money(a.vat)}</td>
                          <td className={`${cell} text-right`}>{money(a.total)}</td>
                          <td className={`${cell} text-right`}>{money(b.actualAmount)}</td>
                          <td className={`${cell} min-w-[80px]`}>{b.vehicleNo || "-"}</td>
                          <td className={cell}>
                            <ModePill mode={b.paymentMode} />
                          </td>
                          <td className={`${cell} min-w-[90px]`}>{b.paidBy || "-"}</td>
                          <td className={cell}>
                            <StatusPill status={b.billStatus} />
                          </td>
                          <td className={`${cell} min-w-[90px]`}>{b.remarks || "-"}</td>
                          <td className={`${cell} relative text-center`} onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setMenuId(menuId === b.id ? null : b.id)}
                              className="p-1 rounded text-slate-500 hover:bg-slate-100"
                            >
                              <MoreVertical size={15} />
                            </button>
                            {menuId === b.id && (
                              <div className="absolute right-3 z-20 w-32 py-1 mt-1 text-left bg-white border rounded-lg shadow-lg border-slate-200">
                                <button
                                  onClick={() => {
                                    setSelectedId(b.id);
                                    setMenuId(null);
                                  }}
                                  className="block w-full px-3 py-1.5 text-[12px] text-left hover:bg-slate-50"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => {
                                    setEditing(b);
                                    setFormOpen(true);
                                    setMenuId(null);
                                  }}
                                  className="block w-full px-3 py-1.5 text-[12px] text-left hover:bg-slate-50"
                                >
                                  Edit
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => {
                                      setConfirmDelete(b);
                                      setMenuId(null);
                                    }}
                                    className="block w-full px-3 py-1.5 text-[12px] text-left text-red-600 hover:bg-red-50"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {draft && (
                    <DraftRow
                      form={draft}
                      onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
                      vendorNames={vendorNames}
                      error={draftError}
                      saving={draftSaving}
                      onSave={() => saveDraft()}
                      onCancel={() => setDraft(null)}
                      rowRef={draftRowRef}
                    />
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <span className="text-[12.5px] text-slate-500">
            {sorted.length === 0
              ? "Showing 0 purchases"
              : `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)} of ${sorted.length} purchases`}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              className="flex items-center justify-center w-8 h-8 bg-white border rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            {pageButtons.map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`w-8 h-8 text-[12.5px] font-medium rounded-lg border ${
                  n === safePage ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage(Math.min(pageCount, safePage + 1))}
              disabled={safePage === pageCount}
              className="flex items-center justify-center w-8 h-8 bg-white border rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-8 px-2 ml-1.5 text-[12.5px] bg-white border rounded-lg border-slate-200 text-slate-700 outline-none"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {chartsOpen && (
        <PurchaseChartsModal
          bills={filtered}
          projectName={projects.find((p) => String(p.id) === projectFilter)?.name ?? "All Projects"}
          rangeLabel={`${adToBs(range.from)} – ${adToBs(range.to)}`}
          spanDays={daysBetweenInclusive(range.from, range.to)}
          onClose={() => setChartsOpen(false)}
        />
      )}

      {uploadInfoOpen && (
        <UploadSheetModal
          projectName={importProjectName}
          onChoose={(format) => {
            uploadFormatRef.current = format;
            setUploadInfoOpen(false);
            fileRef.current?.click();
          }}
          onClose={() => setUploadInfoOpen(false)}
        />
      )}

      {selected && <DetailPanel bill={selected} onClose={() => setSelectedId(null)} />}

      {formOpen && (
        <BillFormModal
          bill={editing}
          projects={projects}
          defaultProjectId={defaultProjectId}
          vendorNames={vendorNames}
          siteNames={siteNames}
          onSave={handleSave}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmationModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await deleteMutation.mutateAsync(confirmDelete.id);
            if (selectedId === confirmDelete.id) setSelectedId(null);
          } catch (err) {
            setNotice({ kind: "error", text: getErrorMessage(err, "Failed to delete purchase.") });
          }
          setConfirmDelete(null);
        }}
        title="Delete Purchase"
        message={`Delete bill ${confirmDelete?.billNo || `#${confirmDelete?.id}`} from ${confirmDelete?.vendorName}? This can't be undone.`}
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default Purchase;
