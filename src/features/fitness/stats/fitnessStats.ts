import type { MealRecord, WeightRecord, WorkoutRecord } from "../../../types";
import { isWithinDateRange } from "../fitnessDate";
import { getWorkoutStatsLabel } from "../fitnessService";

export interface FitnessStats {
  workoutTotal: number;
  workoutBySubcategory: Array<{ label: string; count: number }>;
  mealCount: number;
  averageCalories: number | null;
  averageProteinGrams: number | null;
  weightCount: number;
  averageWeightKg: number | null;
  minWeightKg: number | null;
  maxWeightKg: number | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countBy<T>(
  records: T[],
  getKey: (record: T) => string,
): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();

  for (const record of records) {
    const key = getKey(record).trim() || "미분류";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((first, second) => {
      if (first.count !== second.count) {
        return second.count - first.count;
      }

      return first.key.localeCompare(second.key);
    });
}

function isVisibleRecord(record: { deletedAt?: string | null }): boolean {
  return record.deletedAt === undefined || record.deletedAt === null;
}

export function getRecordsInRange<T extends { date: string; deletedAt?: string | null }>(
  records: T[],
  startDate: string,
  endDate: string,
): T[] {
  return records
    .filter(isVisibleRecord)
    .filter((record) => isWithinDateRange(record.date, startDate, endDate));
}

export function calculateFitnessStats(
  workoutRecords: WorkoutRecord[],
  mealRecords: MealRecord[],
  weightRecords: WeightRecord[],
  startDate: string,
  endDate: string,
): FitnessStats {
  const rangedWorkouts = getRecordsInRange(workoutRecords, startDate, endDate);
  const rangedMeals = getRecordsInRange(mealRecords, startDate, endDate);
  const rangedWeights = getRecordsInRange(weightRecords, startDate, endDate);
  const weightValues = rangedWeights.map((record) => record.weightKg);
  const workoutBySubcategory = countBy(rangedWorkouts, getWorkoutStatsLabel);

  return {
    workoutTotal: rangedWorkouts.length,
    workoutBySubcategory: workoutBySubcategory.map(({ key, count }) => ({
      label: key,
      count,
    })),
    mealCount: rangedMeals.length,
    averageCalories: average(rangedMeals.map((record) => record.calories)),
    averageProteinGrams: average(
      rangedMeals.map((record) => record.proteinGrams),
    ),
    weightCount: rangedWeights.length,
    averageWeightKg: average(weightValues),
    minWeightKg: weightValues.length > 0 ? Math.min(...weightValues) : null,
    maxWeightKg: weightValues.length > 0 ? Math.max(...weightValues) : null,
  };
}

export function formatMetric(
  value: number | null,
  fractionDigits = 1,
): string {
  if (value === null) {
    return "-";
  }

  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });
}
