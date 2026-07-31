import type { FinanceDailySummary } from "../../lib/sync/syncTypes";
import { formatLocalDate, parseDateInput } from "../fitness/fitnessDate";

export type FinanceSummaryByDate = Record<string, FinanceDailySummary>;

export function getFinanceMonthRange(visibleMonth: string): {
  fromDate: string;
  toDate: string;
} {
  const current = parseDateInput(visibleMonth);
  const year = current.getFullYear();
  const month = current.getMonth();

  return {
    fromDate: formatLocalDate(new Date(year, month, 1)),
    toDate: formatLocalDate(new Date(year, month + 1, 0)),
  };
}

export function indexFinanceSummaries(
  summaries: FinanceDailySummary[],
): FinanceSummaryByDate {
  return Object.fromEntries(summaries.map((summary) => [summary.date, summary]));
}

export function formatCompactKrw(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatKrw(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}
