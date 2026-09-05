import type {
  LegacyWorkoutRecordV1,
  MealRecord,
  WeightRecord,
  WorkoutType,
} from "../../types";
import { formatDurationInput } from "./fitnessInputParsing";
import {
  categoryLabelsFromCodes,
  normalizeCategoryCodes,
  workoutCategoryCodes,
} from "./fitnessRecordContract";

/**
 * Legacy v1 readers and display formatters only.
 *
 * Personal OS no longer creates, updates, deletes, or restores Fitness
 * records. Fitness-owned v1 rows remain readable here while new cross-app
 * workout reads use FitnessSummaryProjectionV2.
 */

function sortByDateThenUpdatedAt<T extends { date: string; updatedAt: string }>(
  records: T[],
): T[] {
  return [...records].sort((first, second) => {
    if (first.date !== second.date) {
      return first.date.localeCompare(second.date);
    }

    return first.updatedAt.localeCompare(second.updatedAt);
  });
}

function isVisibleInOs(record: { scope?: string }): boolean {
  return record.scope !== "fitness";
}

export function getVisibleWorkoutRecords(
  records: LegacyWorkoutRecordV1[],
): LegacyWorkoutRecordV1[] {
  return sortByDateThenUpdatedAt(
    records.filter(
      (record) => record.deletedAt === null && isVisibleInOs(record),
    ),
  );
}

export function getVisibleMealRecords(records: MealRecord[]): MealRecord[] {
  return sortByDateThenUpdatedAt(
    records.filter(
      (record) => record.deletedAt === null && isVisibleInOs(record),
    ),
  );
}

export function getVisibleWeightRecords(
  records: WeightRecord[],
): WeightRecord[] {
  return sortByDateThenUpdatedAt(
    records.filter(
      (record) => record.deletedAt === null && isVisibleInOs(record),
    ),
  );
}

export function formatDurationSeconds(durationSeconds: number): string {
  return formatDurationInput(durationSeconds);
}

const workoutTypeLabels: Record<WorkoutType, string> = {
  strength: "헬스",
  cardio: "유산소",
  other: "기타",
};

export function getWorkoutTypeLabel(record: LegacyWorkoutRecordV1): string {
  return workoutTypeLabels[record.workoutType];
}

export function getWorkoutCategoryLabels(
  record: LegacyWorkoutRecordV1,
): string[] {
  const codedLabels = categoryLabelsFromCodes(
    normalizeCategoryCodes(record.metadata?.category_codes),
  );
  if (codedLabels.length > 0) {
    return codedLabels;
  }

  const sharedCategories = record.metadata?.os_categories;
  if (Array.isArray(sharedCategories)) {
    const normalized = sharedCategories
      .filter((category): category is string => typeof category === "string")
      .map((category) => category.trim())
      .filter(Boolean);

    if (normalized.length > 0) {
      return [...new Set(normalized)];
    }
  }

  const legacyCodedLabels = categoryLabelsFromCodes(workoutCategoryCodes(record));
  if (legacyCodedLabels.length > 0) {
    return legacyCodedLabels;
  }

  const category = record.category.trim();
  return category ? [category] : [];
}

/** Legacy-only formatter. It must not be used by ordinary Personal OS UI. */
export function getWorkoutSubcategoryLabel(
  record: LegacyWorkoutRecordV1,
): string {
  if (record.workoutType === "strength") {
    const categories = getWorkoutCategoryLabels(record);
    if (categories.length === 0) {
      return "미분류";
    }
    return categories
      .map((category) => (category.endsWith("운동") ? category : `${category}운동`))
      .join(" · ");
  }

  if (record.workoutType === "cardio") {
    return record.category.trim() || "미분류";
  }

  return record.exerciseName.trim() || "미분류";
}

/** Legacy-only statistics label retained for v1 report compatibility. */
export function getWorkoutStatsLabel(record: LegacyWorkoutRecordV1): string {
  return `${getWorkoutTypeLabel(record)} - ${getWorkoutSubcategoryLabel(record)}`;
}

/** Legacy-only metric formatter retained for v1 read compatibility. */
export function getWorkoutMetricLabels(
  record: LegacyWorkoutRecordV1,
): string[] {
  if (record.workoutType !== "cardio") {
    return [];
  }

  const labels: string[] = [];
  if (record.durationSeconds !== null) {
    labels.push(formatDurationSeconds(record.durationSeconds));
  }
  if (record.averageHeartRate !== null) {
    labels.push(
      `평균 심박수 ${record.averageHeartRate.toLocaleString("ko-KR")} bpm`,
    );
  }
  return labels;
}
