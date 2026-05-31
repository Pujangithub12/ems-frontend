import React, { useState } from "react";
// Use client-side converter for faster conversions without backend round-trip
import converterPkg from "nepali-date-converter";
import { 
  RefreshCw, 
  ArrowRightLeft, 
  Calendar, 
  Info, 
  AlertCircle, 
  CheckCircle2,
  ChevronRight,
  History
} from "lucide-react";

const DateConverter: React.FC = () => {
  const [engDate, setEngDate] = useState("");
  const [nepResult, setNepResult] = useState<string | null>(null);
  const [nepYear, setNepYear] = useState("");
  const [nepMonth, setNepMonth] = useState("");
  const [nepDay, setNepDay] = useState("");
  const [engResult, setEngResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getConverter = () => {
    const exported: any = (converterPkg as any).default || converterPkg;
    return exported;
  };

  const formatDate = (year: number, month: number, day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const isPositiveInteger = (value: string) => {
    return /^[1-9][0-9]*$/.test(value);
  };

  const validateNepaliFields = () => {
    if (!nepYear || !nepMonth || !nepDay) {
      return "Fill year, month, and day fields";
    }
    if (
      !isPositiveInteger(nepYear) ||
      !isPositiveInteger(nepMonth) ||
      !isPositiveInteger(nepDay)
    ) {
      return "Year, month, and day must be positive integers";
    }
    const year = Number(nepYear);
    const month = Number(nepMonth);
    const day = Number(nepDay);
    if (month < 1 || month > 12) {
      return "Month must be between 1 and 12";
    }
    if (day < 1 || day > 32) {
      return "Day must be between 1 and 32";
    }
    if (year < 2000 || year > 2140) {
      return "Year should be a valid BS year between 2000 and 2140";
    }
    return null;
  };

  const convertEnglishToNepali = async () => {
    setError(null);
    setNepResult(null);
    if (!engDate) return setError("Select an English date first");

    const dt = new Date(`${engDate}T00:00:00`);
    if (Number.isNaN(dt.getTime())) {
      return setError("Selected English date is invalid");
    }

    setLoading(true);
    try {
      const NepaliDate: any = getConverter();
      if (typeof NepaliDate.fromAD !== "function") {
        throw new Error(
          "Installed converter does not support fromAD conversion",
        );
      }
      const bsDate = NepaliDate.fromAD(dt).getBS();
      setNepResult(formatDate(bsDate.year, bsDate.month, bsDate.date));
    } catch (err: any) {
      setError(
        err?.message ||
          "Conversion failed. Make sure the selected date is supported.",
      );
    } finally {
      setLoading(false);
    }
  };

  const convertNepaliToEnglish = async () => {
    setError(null);
    setEngResult(null);
    const validationError = validateNepaliFields();
    if (validationError) return setError(validationError);

    setLoading(true);
    try {
      const NepaliDate: any = getConverter();
      const year = Number(nepYear);
      const month = Number(nepMonth);
      const day = Number(nepDay);

      if (typeof NepaliDate === "function") {
        const nep = new NepaliDate(year, month - 1, day);
        const ad = nep.getAD();
        setEngResult(formatDate(ad.year, ad.month, ad.date));
      } else if (typeof NepaliDate.toAD === "function") {
        const ad = NepaliDate.toAD(year, month, day);
        setEngResult(formatDate(ad.year, ad.month, ad.date));
      } else {
        throw new Error("Installed converter does not support toAD conversion");
      }
    } catch (err: any) {
      setError(
        err?.message || "Conversion failed. Check the Nepali date values.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm text-indigo-600">
          <RefreshCw className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Date Converter</h2>
          <p className="text-sm text-slate-500 font-medium">Seamlessly switch between English (AD) and Nepali (BS) calendars.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* AD to BS Card */}
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">English (AD) to BS</h3>
            </div>
            <ArrowRightLeft className="w-4 h-4 text-slate-300" />
          </div>

          <div className="p-8 flex-1 flex flex-col justify-between space-y-8">
            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700 ml-1">Select English Date</label>
              <input
                type="date"
                value={engDate}
                onChange={(e) => setEngDate(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              />
            </div>

            <div className="pt-4 space-y-4">
              <button
                onClick={convertEnglishToNepali}
                disabled={loading}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 group disabled:opacity-70"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : null}
                Convert to Nepali
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              {nepResult && (
                <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-[24px] animate-in fade-in slide-in-from-top-2">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Bikram Sambat Result</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-bold text-indigo-900">{nepResult}</p>
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BS to AD Card */}
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <History className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">Nepali (BS) to AD</h3>
            </div>
            <ArrowRightLeft className="w-4 h-4 text-slate-300" />
          </div>

          <div className="p-8 flex-1 flex flex-col justify-between space-y-8">
            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700 ml-1">Enter Nepali Date</label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <input
                    placeholder="YYYY"
                    value={nepYear}
                    onChange={(e) => setNepYear(e.target.value)}
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  />
                  <p className="text-[9px] text-center text-slate-400 font-bold uppercase">Year</p>
                </div>
                <div className="space-y-1">
                  <input
                    placeholder="MM"
                    value={nepMonth}
                    onChange={(e) => setNepMonth(e.target.value)}
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  />
                  <p className="text-[9px] text-center text-slate-400 font-bold uppercase">Month</p>
                </div>
                <div className="space-y-1">
                  <input
                    placeholder="DD"
                    value={nepDay}
                    onChange={(e) => setNepDay(e.target.value)}
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  />
                  <p className="text-[9px] text-center text-slate-400 font-bold uppercase">Day</p>
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-4">
              <button
                onClick={convertNepaliToEnglish}
                disabled={loading}
                className="w-full py-4 bg-amber-600 text-white rounded-2xl text-sm font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 flex items-center justify-center gap-2 group disabled:opacity-70"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : null}
                Convert to English
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              {engResult && (
                <div className="p-6 bg-amber-50 border border-amber-100 rounded-[24px] animate-in fade-in slide-in-from-top-2">
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Anno Domini Result</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-bold text-amber-900">{engResult}</p>
                    <CheckCircle2 className="w-5 h-5 text-amber-500" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="lg:col-span-2 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DateConverter;
