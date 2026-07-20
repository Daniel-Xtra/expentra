/** Resolve calendar year/month for a date in the given IANA timezone. */
export function budgetPeriodFromDate(
  date: Date,
  timeZone: string,
): { year: number; month: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(date);

    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    if (Number.isFinite(year) && Number.isFinite(month)) {
      return { year, month };
    }
  } catch {
    // fall through
  }

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
}

/** UTC half-open interval [start, end) for a calendar month. */
export function budgetPeriodRange(
  year: number,
  month: number,
): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end =
    month === 12
      ? new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0))
      : new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start, end };
}

/** UTC half-open interval [start, end) for a calendar year. */
export function budgetYearRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0)),
  };
}

/** UTC half-open interval [start, end) for a calendar quarter (1–4). */
export function budgetQuarterRange(
  year: number,
  quarter: number,
): { start: Date; end: Date } {
  const startMonthIndex = (quarter - 1) * 3;
  return {
    start: new Date(Date.UTC(year, startMonthIndex, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, startMonthIndex + 3, 1, 0, 0, 0, 0)),
  };
}

/** Calendar year for a date in the given IANA timezone. */
export function resolveBudgetYear(date: Date, timeZone: string): number {
  return budgetPeriodFromDate(date, timeZone).year;
}

export function calendarDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date);

    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const day = Number(parts.find((p) => p.type === 'day')?.value);

    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day)
    ) {
      return { year, month, day };
    }
  } catch {
    // fall through
  }

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/** Negative if `left` is before `right` on the calendar in `timeZone`. */
export function compareCalendarDates(
  left: Date,
  right: Date,
  timeZone: string,
): number {
  const a = calendarDateParts(left, timeZone);
  const b = calendarDateParts(right, timeZone);

  if (a.year !== b.year) {
    return a.year - b.year;
  }
  if (a.month !== b.month) {
    return a.month - b.month;
  }
  return a.day - b.day;
}

/** UTC instant for local midnight on Y-M-D in the given IANA timezone. */
export function zonedMidnightToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  let ms = Date.UTC(year, month - 1, day, 12, 0, 0);

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    }).formatToParts(new Date(ms));

    const y = Number(parts.find((p) => p.type === 'year')?.value);
    const m = Number(parts.find((p) => p.type === 'month')?.value);
    const d = Number(parts.find((p) => p.type === 'day')?.value);
    const h = Number(parts.find((p) => p.type === 'hour')?.value);
    const min = Number(parts.find((p) => p.type === 'minute')?.value);
    const sec = Number(parts.find((p) => p.type === 'second')?.value);

    if (
      y === year &&
      m === month &&
      d === day &&
      h === 0 &&
      min === 0 &&
      sec === 0
    ) {
      return new Date(ms);
    }

    ms -= (h * 3_600 + min * 60 + sec) * 1_000 || 3_600_000;
  }

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/** Half-open interval [start, end) for a calendar year in the given IANA timezone. */
export function budgetYearRangeInTimeZone(
  year: number,
  timeZone: string,
): { start: Date; end: Date } {
  return {
    start: zonedMidnightToUtc(year, 1, 1, timeZone),
    end: zonedMidnightToUtc(year + 1, 1, 1, timeZone),
  };
}
