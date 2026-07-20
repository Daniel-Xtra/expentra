import {
  budgetPeriodRange,
  budgetQuarterRange,
  budgetYearRange,
} from 'src/modules/budget/utils/budget-period.util';
import { ReportPeriodMode } from '../constants/report-period-mode.enum';
import type {
  AgingBucket,
  AgingBucketKey,
  SpendingReportQuery,
} from '../types/report.types';

export const AGING_BUCKET_DEFS: Array<{
  key: AgingBucketKey;
  label: string;
  minDaysInclusive: number;
  maxDaysExclusive: number | null;
}> = [
  { key: '0_7', label: '0–7 days', minDaysInclusive: 0, maxDaysExclusive: 8 },
  {
    key: '8_14',
    label: '8–14 days',
    minDaysInclusive: 8,
    maxDaysExclusive: 15,
  },
  {
    key: '15_30',
    label: '15–30 days',
    minDaysInclusive: 15,
    maxDaysExclusive: 31,
  },
  {
    key: '30_plus',
    label: '30+ days',
    minDaysInclusive: 31,
    maxDaysExclusive: null,
  },
];

export function emptyAgingBuckets(): AgingBucket[] {
  return AGING_BUCKET_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    count: 0,
    totalAmount: 0,
  }));
}

export function resolveReportPeriodMode(
  query: Pick<SpendingReportQuery, 'periodMode'>,
): ReportPeriodMode {
  return query.periodMode ?? ReportPeriodMode.MONTH;
}

export function resolveReportPeriodRange(
  query: Pick<SpendingReportQuery, 'year' | 'periodMode' | 'month' | 'quarter'>,
): { start: Date; end: Date } {
  const periodMode = resolveReportPeriodMode(query);

  if (periodMode === ReportPeriodMode.YEAR) {
    return budgetYearRange(query.year);
  }

  if (periodMode === ReportPeriodMode.QUARTER) {
    const quarter = query.quarter ?? 1;
    return budgetQuarterRange(query.year, quarter);
  }

  const month = query.month ?? 1;
  return budgetPeriodRange(query.year, month);
}

export function shiftReportPeriod(
  year: number,
  month: number,
  deltaMonths: number,
): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
}

export function shiftReportPeriodByMode(
  query: Pick<SpendingReportQuery, 'year' | 'periodMode' | 'month' | 'quarter'>,
  deltaPeriods: number,
): Pick<SpendingReportQuery, 'year' | 'periodMode' | 'month' | 'quarter'> {
  const periodMode = resolveReportPeriodMode(query);

  if (periodMode === ReportPeriodMode.YEAR) {
    return {
      year: query.year + deltaPeriods,
      periodMode,
      month: undefined,
      quarter: undefined,
    };
  }

  if (periodMode === ReportPeriodMode.QUARTER) {
    const absolute = query.year * 4 + (query.quarter ?? 1) - 1 + deltaPeriods;
    const year = Math.floor(absolute / 4);
    const quarter = (((absolute % 4) + 4) % 4) + 1;
    return {
      year,
      periodMode,
      quarter,
      month: undefined,
    };
  }

  const shifted = shiftReportPeriod(query.year, query.month ?? 1, deltaPeriods);
  return {
    year: shifted.year,
    periodMode,
    month: shifted.month,
    quarter: undefined,
  };
}

/** Prior comparable period (previous month / quarter / year). */
export function previousReportPeriod(
  query: Pick<SpendingReportQuery, 'year' | 'periodMode' | 'month' | 'quarter'>,
): Pick<SpendingReportQuery, 'year' | 'periodMode' | 'month' | 'quarter'> {
  return shiftReportPeriodByMode(query, -1);
}

/** Same period one year earlier. */
export function yearAgoReportPeriod(
  query: Pick<SpendingReportQuery, 'year' | 'periodMode' | 'month' | 'quarter'>,
): Pick<SpendingReportQuery, 'year' | 'periodMode' | 'month' | 'quarter'> {
  const periodMode = resolveReportPeriodMode(query);
  if (periodMode === ReportPeriodMode.MONTH) {
    return shiftReportPeriodByMode(query, -12);
  }
  if (periodMode === ReportPeriodMode.QUARTER) {
    return shiftReportPeriodByMode(query, -4);
  }
  return shiftReportPeriodByMode(query, -1);
}

export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function ageInDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export function bucketAgeDays(days: number): AgingBucketKey {
  if (days < 8) return '0_7';
  if (days < 15) return '8_14';
  if (days < 31) return '15_30';
  return '30_plus';
}
