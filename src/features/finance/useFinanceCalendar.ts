import { useCallback, useEffect, useMemo, useState } from "react";

import type { FinanceDailySummary } from "../../lib/sync/syncTypes";
import {
  getFinanceMonthRange,
  indexFinanceSummaries,
  type FinanceSummaryByDate,
} from "./financeCalendar";

interface UseFinanceCalendarOptions {
  enabled: boolean;
  visibleMonth: string;
  loadSummaries: (
    fromDate: string,
    toDate: string,
  ) => Promise<FinanceDailySummary[]>;
}

export function useFinanceCalendar({
  enabled,
  visibleMonth,
  loadSummaries,
}: UseFinanceCalendarOptions): {
  error: string | null;
  financeByDate: FinanceSummaryByDate;
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const [financeByDate, setFinanceByDate] = useState<FinanceSummaryByDate>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const range = useMemo(
    () => getFinanceMonthRange(visibleMonth),
    [visibleMonth],
  );

  const refresh = useCallback(async () => {
    if (!enabled) {
      setFinanceByDate({});
      setError(null);
      return;
    }

    setIsLoading(true);
    try {
      const summaries = await loadSummaries(range.fromDate, range.toDate);
      setFinanceByDate(indexFinanceSummaries(summaries));
      setError(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "금융 기록을 불러오지 못했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, loadSummaries, range.fromDate, range.toDate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleFocus = () => void refresh();
    window.addEventListener("focus", handleFocus);
    const intervalId = window.setInterval(handleFocus, 30_000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(intervalId);
    };
  }, [enabled, refresh]);

  return { error, financeByDate, isLoading, refresh };
}
