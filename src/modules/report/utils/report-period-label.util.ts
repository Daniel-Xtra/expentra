import { ReportPeriodMode } from '../constants/report-period-mode.enum';
import type { SpendingReportQuery } from '../types/report.types';
import { resolveReportPeriodMode } from './report-insight.util';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function formatReportPeriodLabel(
  query: Pick<SpendingReportQuery, 'year' | 'periodMode' | 'month' | 'quarter'>,
): string {
  const periodMode = resolveReportPeriodMode(query);

  if (periodMode === ReportPeriodMode.YEAR) {
    return `Full year ${query.year}`;
  }

  if (periodMode === ReportPeriodMode.QUARTER) {
    return `Q${query.quarter ?? 1} ${query.year}`;
  }

  const monthName = MONTH_NAMES[(query.month ?? 1) - 1] ?? String(query.month);
  return `${monthName} ${query.year}`;
}
