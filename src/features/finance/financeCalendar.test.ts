import { describe, expect, it } from "vitest";

import {
  formatCompactKrw,
  getFinanceMonthRange,
  indexFinanceSummaries,
} from "./financeCalendar";

describe("financeCalendar", () => {
  it("creates the inclusive range for a visible month", () => {
    expect(getFinanceMonthRange("2026-02-14")).toEqual({
      fromDate: "2026-02-01",
      toDate: "2026-02-28",
    });
  });

  it("indexes summaries by local date", () => {
    const summary = {
      date: "2026-07-25",
      incomeKrw: 100_000,
      expenseKrw: 20_000,
      netKrw: 80_000,
      entryCount: 2,
    };

    expect(indexFinanceSummaries([summary])).toEqual({
      "2026-07-25": summary,
    });
  });

  it("formats calendar amounts compactly", () => {
    expect(formatCompactKrw(12_000)).toContain("1.2");
  });
});
