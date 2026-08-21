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

/** Single AD month/year label for a BS month, e.g. "Aug 2026" — picked from
 * the Gregorian month covering the BS month's midpoint, so it reads as one
 * whole month (like the BS label) instead of a straddling "Apr/May" range.
 * Used only where the underlying data stays BS-grouped (financial fields —
 * see bsDate.ts usage in ProjectPerformanceTab) and just needs an AD label. */
export const bsMonthAdLabel = (year: number, month: number): string => {
  const { year: ay, month: am } = bsMonthPrimaryAdYearMonth(year, month);
  return adMonthLabel(ay, am);
};

/** True Gregorian-calendar counterparts to the BS helpers above (`month` is
 * zero-based, 0 = January, matching JS `Date`'s own convention) — used when
 * the daily entry grid is actually regrouped by real AD months (not just
 * relabeled), so e.g. Shrawan 31 and Bhadra 1 land in the same "Aug" bucket
 * if that's what the real calendar says. */
export const daysInAdMonth = (year: number, month: number): number => new Date(year, month + 1, 0).getDate();

export const adMonthRangeIso = (year: number, month: number): { startDate: string; endDate: string } => ({
  startDate: isoOfAd(new Date(year, month, 1)),
  endDate: isoOfAd(new Date(year, month + 1, 1)),
});

export const adDateForAdDay = (year: number, month: number, day: number): string =>
  isoOfAd(new Date(year, month, day));

export const currentAdYearMonth = (): { year: number; month: number } => {
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() };
};

/** Full month name, e.g. "August 2026" — matches bsMonthLabel's full-name style. */
export const adMonthLabelFull = (year: number, month: number): string =>
  new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

/** Short AD month/year label, e.g. "Aug 2026" — for a true (not BS-approximated) AD month. */
export const adMonthLabel = (year: number, month: number): string =>
  new Date(year, month, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });

/** The exact (AD year, AD month) that bsMonthAdLabel picks for a BS month —
 * the Gregorian month covering that BS month's midpoint. Used to find which
 * single BS month, if any, "primarily" belongs to a given true AD month row
 * (see ProjectPerformanceTab's monthly table in AD mode): a financial figure
 * entered for a BS month is only shown against the one AD month it's
 * genuinely associated with, not duplicated or split across a straddle. */
export const bsMonthPrimaryAdYearMonth = (year: number, month: number): { year: number; month: number } => {
  const midDay = Math.ceil(daysInBsMonth(year, month) / 2);
  const mid = new Date(`${adDateForBsDay(year, month, midDay)}T00:00:00`);
  return { year: mid.getFullYear(), month: mid.getMonth() };
};
