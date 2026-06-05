import type { MealRecord, WeightRecord, WorkoutRecord } from "../../types";
import { createId } from "../../lib/storage/id";

function createTimestamp(): string {
  return new Date().toISOString();
}

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

export function getVisibleWorkoutRecords(
  records: WorkoutRecord[],
): WorkoutRecord[] {
  return sortByDateThenUpdatedAt(
    records.filter((record) => record.deletedAt === null),
  );
}

export function getVisibleMealRecords(records: MealRecord[]): MealRecord[] {
  return sortByDateThenUpdatedAt(
    records.filter((record) => record.deletedAt === null),
  );
}

export function getVisibleWeightRecords(
  records: WeightRecord[],
): WeightRecord[] {
  return sortByDateThenUpdatedAt(
    records.filter((record) => record.deletedAt === null),
  );
}

export function createWorkoutRecord(
  date: string,
  category: string,
  exerciseName: string,
  deviceId: string,
): WorkoutRecord {
  const now = createTimestamp();

  return {
    id: createId(),
    date,
    category: category.trim(),
    exerciseName: exerciseName.trim(),
    updatedAt: now,
    deletedAt: null,
    deviceId,
  };
}

export function createMealRecord(
  date: string,
  menu: string,
  calories: number,
  proteinGrams: number,
  deviceId: string,
): MealRecord {
  const now = createTimestamp();

  return {
    id: createId(),
    date,
    menu: menu.trim(),
    calories,
    proteinGrams,
    carbsGrams: null,
    fatGrams: null,
    updatedAt: now,
    deletedAt: null,
    deviceId,
  };
}

export function createWeightRecord(
  date: string,
  weightKg: number,
  deviceId: string,
): WeightRecord {
  const now = createTimestamp();

  return {
    id: createId(),
    date,
    weightKg,
    updatedAt: now,
    deletedAt: null,
    deviceId,
  };
}

export function softDeleteWorkoutRecord(
  record: WorkoutRecord,
  deviceId: string,
): WorkoutRecord {
  const now = createTimestamp();

  return {
    ...record,
    updatedAt: now,
    deletedAt: now,
    deviceId,
  };
}

export function softDeleteMealRecord(
  record: MealRecord,
  deviceId: string,
): MealRecord {
  const now = createTimestamp();

  return {
    ...record,
    updatedAt: now,
    deletedAt: now,
    deviceId,
  };
}

export function softDeleteWeightRecord(
  record: WeightRecord,
  deviceId: string,
): WeightRecord {
  const now = createTimestamp();

  return {
    ...record,
    updatedAt: now,
    deletedAt: now,
    deviceId,
  };
}
