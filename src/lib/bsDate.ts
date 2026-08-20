import NepaliDate from "nepali-date-converter";

/** Bikram Sambat (BS) calendar helpers, shared by the Calendar page and the
 * Energy Performance tab. `month` is zero-based (0 = Baishakh ... 11 = Chaitra),
 * matching `nepali-date-converter`'s own constructor convention. */

const isoOfAd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Computed via the library's own conversion rather than a hardcoded table,
 * so it stays correct regardless of which years that table would cover. */
export const daysInBsMonth = (year: number, month: number): number => {
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  const firstOfThis = new NepaliDate(year, month, 1).toJsDate();
  const firstOfNext = new NepaliDate(nextYear, nextMonth, 1).toJsDate();
  return Math.round((firstOfNext.getTime() - firstOfThis.getTime()) / 86400000);
};

/** Romanized month name, e.g. "Shrawan" (no hardcoded month-name array). */
export const bsMonthLabel = (year: number, month: number): string =>
  new NepaliDate(year, month, 1).format("MMMM");

/** [start, end) AD ISO-date range spanning one full BS month, for date-range queries. */
export const bsMonthRangeAd = (year: number, month: number): { startDate: string; endDate: string } => {
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  return {
    startDate: isoOfAd(new NepaliDate(year, month, 1).toJsDate()),
    endDate: isoOfAd(new NepaliDate(nextYear, nextMonth, 1).toJsDate()),
  };
};

/** The AD ISO date for a specific day within a BS month. */
export const adDateForBsDay = (year: number, month: number, day: number): string =>
  isoOfAd(new NepaliDate(year, month, day).toJsDate());

/** Today's BS year/month (zero-based month), for defaulting pickers. */
export const currentBsYearMonth = (): { year: number; month: number } => {
  const bs = NepaliDate.fromAD(new Date());
  return { year: bs.getYear(), month: bs.getMonth() };
};

/** Human-readable BS date for an AD ISO date, e.g. "Tue, Shrawan 5" — for
 * displaying rows entered against a BS day picker (see Add Entry) so the
 * calendar shown never flips back to Gregorian after saving. */
export const bsDateLabel = (adDateIso: string, includeWeekday = true): string => {
  const ad = new Date(`${adDateIso}T00:00:00`);
  const bs = NepaliDate.fromAD(ad);
  const monthDay = `${bsMonthLabel(bs.getYear(), bs.getMonth())} ${bs.getDate()}`;
  if (!includeWeekday) return monthDay;
  const weekday = ad.toLocaleDateString(undefined, { weekday: "short" });
  return `${weekday}, ${monthDay}`;
};

/** English/Gregorian counterpart to bsDateLabel, e.g. "Tue, Aug 5" — for
 * display only, when the user prefers AD over BS labels. */
export const adDateLabel = (adDateIso: string, includeWeekday = true): string => {
  const ad = new Date(`${adDateIso}T00:00:00`);
  return ad.toLocaleDateString(undefined, {
    weekday: includeWeekday ? "short" : undefined,
    month: "short",
    day: "numeric",
  });
};

/** AD month/year span for a BS month, e.g. "Aug 2026" or "Aug/Sep 2026" when
 * the BS month straddles two Gregorian months — mirrors Calendar.tsx's adSpan. */
export const bsMonthAdSpanLabel = (year: number, month: number): string => {
  const { startDate, endDate } = bsMonthRangeAd(year, month);
  const firstAd = new Date(`${startDate}T00:00:00`);
  const lastAd = new Date(new Date(`${endDate}T00:00:00`).getTime() - 86400000);
  if (firstAd.getMonth() === lastAd.getMonth() && firstAd.getFullYear() === lastAd.getFullYear()) {
    return firstAd.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return `${firstAd.toLocaleDateString("en-US", { month: "short" })}/${lastAd.toLocaleDateString("en-US", {
    month: "short",
  })} ${lastAd.getFullYear()}`;
};
