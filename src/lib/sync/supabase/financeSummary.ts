import type { FinanceDailySummary } from "../syncTypes";
import type {
  FinanceDailySummarySelectedRow,
  SupabaseClient,
} from "./rows";

export interface FinanceSummaryQueryResult {
  data: FinanceDailySummarySelectedRow[] | null;
  error: unknown | null;
}

export interface FinanceSummaryTransport {
  selectDailySummaries(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<FinanceSummaryQueryResult>;
}

interface FinanceSummaryTableLike {
  select(columns: string): {
    eq(column: string, value: string): {
      gte(column: string, value: string): {
        lte(column: string, value: string): {
          order(
            column: string,
            options: { ascending: boolean },
          ): Promise<FinanceSummaryQueryResult>;
        };
      };
    };
  };
}

export function createSupabaseFinanceSummaryTransport(
  supabase: SupabaseClient,
): FinanceSummaryTransport {
  return {
    selectDailySummaries(userId, fromDate, toDate) {
      const table = supabase.from(
        "finance_summary_daily",
      ) as unknown as FinanceSummaryTableLike;
      return table
        .select("date,income_krw,expense_krw,net_krw,entry_count")
        .eq("user_id", userId)
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date", { ascending: true });
    },
  };
}

export function financeDailySummaryFromRow(
  row: FinanceDailySummarySelectedRow,
): FinanceDailySummary {
  return {
    date: row.date,
    incomeKrw: Number(row.income_krw),
    expenseKrw: Number(row.expense_krw),
    netKrw: Number(row.net_krw),
    entryCount: Number(row.entry_count),
  };
}

export async function fetchFinanceDailySummaries(
  transport: FinanceSummaryTransport,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<FinanceDailySummary[]> {
  const result = await transport.selectDailySummaries(
    userId,
    fromDate,
    toDate,
  );
  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).map(financeDailySummaryFromRow);
}
