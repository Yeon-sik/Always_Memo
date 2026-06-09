import type {
  MealRecord,
  WeightRecord,
  WorkoutRecord,
  WorkoutType,
} from "../../types";
import { createId } from "../../lib/storage/id";

export const cardioWorkoutOptions = [
  "실내 달리기",
  "실내 걷기",
  "계단 오르기",
  "실외 싸이클",
  "실내 싸이클",
] as const;

export const strengthWorkoutParts = [
  "가슴",
  "등",
  "하체",
  "어깨",
  "복부",
  "삼두",
  "이두",
] as const;

export const workoutTypeLabels: Record<WorkoutType, string> = {
  strength: "헬스",
  cardio: "유산소",
  other: "기타",
};

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
  workoutType: WorkoutType,
  category: string,
  exerciseName: string,
  deviceId: string,
): WorkoutRecord {
  const now = createTimestamp();

  return {
    id: createId(),
    date,
    workoutType,
    category: category.trim(),
    exerciseName: exerciseName.trim(),
    updatedAt: now,
    deletedAt: null,
    deviceId,
  };
}

export function getWorkoutTypeLabel(record: WorkoutRecord): string {
  return workoutTypeLabels[record.workoutType];
}

export function getWorkoutSubcategoryLabel(record: WorkoutRecord): string {
  if (record.workoutType === "strength") {
    const category = record.category.trim() || "미분류";
    return category.endsWith("운동") ? category : `${category}운동`;
  }

  if (record.workoutType === "cardio") {
    return record.category.trim() || "미분류";
  }

  return record.exerciseName.trim() || "미분류";
}

export function getWorkoutStatsLabel(record: WorkoutRecord): string {
  return `${getWorkoutTypeLabel(record)} - ${getWorkoutSubcategoryLabel(
    record,
  )}`;
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

export function updateWeightRecord(
  record: WeightRecord,
  weightKg: number,
  deviceId: string,
): WeightRecord {
  return {
    ...record,
    weightKg,
    updatedAt: createTimestamp(),
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
