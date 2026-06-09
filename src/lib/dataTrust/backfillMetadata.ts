import type { BackfillInput, BackfillMetadata, ISODateString } from "../../types";

export interface EntityAuditFields extends BackfillMetadata {
  createdAt: ISODateString;
}

export const BACKFILL_LABEL = "누락 보강";

function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function createEntityAuditFields(
  input: BackfillInput = {},
  now: ISODateString = new Date().toISOString(),
): EntityAuditFields {
  const isBackfilled = input.isBackfilled === true;

  return {
    createdAt: now,
    isBackfilled,
    backfilledAt: isBackfilled ? input.backfilledAt ?? now : null,
    backfillReason: isBackfilled ? input.backfillReason ?? null : null,
  };
}

export function normalizeEntityAuditFields(
  source: Record<string, unknown>,
  fallbackTimestamp: ISODateString,
): EntityAuditFields {
  const isBackfilled = source.isBackfilled === true;
  const createdAt =
    typeof source.createdAt === "string" ? source.createdAt : fallbackTimestamp;

  return {
    createdAt,
    isBackfilled,
    backfilledAt: isBackfilled
      ? normalizeNullableString(source.backfilledAt) ?? createdAt
      : null,
    backfillReason: isBackfilled
      ? normalizeNullableString(source.backfillReason)
      : null,
  };
}

export function createBackfillInput(
  reason: string | null = "past-date-correction",
): BackfillInput {
  return {
    isBackfilled: true,
    backfilledAt: new Date().toISOString(),
    backfillReason: reason,
  };
}

export function hasBackfillMetadata(value: { isBackfilled?: boolean }): boolean {
  return value.isBackfilled === true;
}

export function countBackfilledRecords<T extends { isBackfilled?: boolean }>(
  records: T[],
): number {
  return records.filter(hasBackfillMetadata).length;
}

export function isPastLocalDate(date: string, today: string): boolean {
  return date < today;
}

export function isFutureLocalDate(date: string, today: string): boolean {
  return date > today;
}
