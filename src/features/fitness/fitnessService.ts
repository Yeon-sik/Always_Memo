import type {
  BackfillInput,
  MealRecord,
  WeightRecord,
  WorkoutRecord,
  WorkoutType,
} from "../../types";
import { createEntityAuditFields } from "../../lib/dataTrust/backfillMetadata";
import { createId } from "../../lib/storage/id";
import { formatDurationInput } from "./fitnessInputParsing";

export type WorkoutRecordPatch = Partial<
  Pick<
    WorkoutRecord,
    | "date"
    | "workoutType"
    | "category"
    | "exerciseName"
    | "durationSeconds"
    | "averageHeartRate"
  >
>;

export type WorkoutRecordMetricsInput = Partial<
  Pick<WorkoutRecord, "durationSeconds" | "averageHeartRate">
>;

export type MealRecordPatch = Partial<
  Pick<
    MealRecord,
    "date" | "menu" | "calories" | "proteinGrams" | "carbsGrams" | "fatGrams"
  >
>;

export type WeightRecordPatch = Partial<Pick<WeightRecord, "date" | "weightKg">>;

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

function normalizeWorkoutMetrics(
  workoutType: WorkoutType,
  metrics: WorkoutRecordMetricsInput = {},
): Pick<WorkoutRecord, "durationSeconds" | "averageHeartRate"> {
  if (workoutType !== "cardio") {
    return {
      durationSeconds: null,
      averageHeartRate: null,
    };
  }

  return {
    durationSeconds: metrics.durationSeconds ?? null,
    averageHeartRate: metrics.averageHeartRate ?? null,
  };
}

export function formatDurationSeconds(durationSeconds: number): string {
  return formatDurationInput(durationSeconds);
}

export function createWorkoutRecord(
  date: string,
  workoutType: WorkoutType,
  category: string,
  exerciseName: string,
  deviceId: string,
  backfillInput?: BackfillInput,
  metrics?: WorkoutRecordMetricsInput,
): WorkoutRecord {
  const now = createTimestamp();
  const auditFields = createEntityAuditFields(backfillInput, now);

  return {
    ...auditFields,
    id: createId(),
    date,
    workoutType,
    category: category.trim(),
    exerciseName: exerciseName.trim(),
    ...normalizeWorkoutMetrics(workoutType, metrics),
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

export function getWorkoutMetricLabels(record: WorkoutRecord): string[] {
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

export function createMealRecord(
  date: string,
  menu: string,
  calories: number,
  proteinGrams: number,
  deviceId: string,
  carbsGrams: number | null = null,
  fatGrams: number | null = null,
  backfillInput?: BackfillInput,
): MealRecord {
  const now = createTimestamp();
  const auditFields = createEntityAuditFields(backfillInput, now);

  return {
    ...auditFields,
    id: createId(),
    date,
    menu: menu.trim(),
    calories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    updatedAt: now,
    deletedAt: null,
    deviceId,
  };
}

export function createWeightRecord(
  date: string,
  weightKg: number,
  deviceId: string,
  backfillInput?: BackfillInput,
): WeightRecord {
  const now = createTimestamp();
  const auditFields = createEntityAuditFields(backfillInput, now);

  return {
    ...auditFields,
    id: createId(),
    date,
    weightKg,
    updatedAt: now,
    deletedAt: null,
    deviceId,
  };
}

export function updateWorkoutRecord(
  record: WorkoutRecord,
  patch: WorkoutRecordPatch,
  deviceId: string,
): WorkoutRecord {
  const workoutType = patch.workoutType ?? record.workoutType;
  const metrics = normalizeWorkoutMetrics(workoutType, {
    durationSeconds:
      patch.durationSeconds !== undefined
        ? patch.durationSeconds
        : record.durationSeconds,
    averageHeartRate:
      patch.averageHeartRate !== undefined
        ? patch.averageHeartRate
        : record.averageHeartRate,
  });

  return {
    ...record,
    ...patch,
    workoutType,
    category: patch.category?.trim() ?? record.category,
    exerciseName: patch.exerciseName?.trim() ?? record.exerciseName,
    ...metrics,
    updatedAt: createTimestamp(),
    deviceId,
  };
}

export function updateMealRecord(
  record: MealRecord,
  patch: MealRecordPatch,
  deviceId: string,
): MealRecord {
  return {
    ...record,
    ...patch,
    menu: patch.menu?.trim() ?? record.menu,
    updatedAt: createTimestamp(),
    deviceId,
  };
}

export function updateWeightRecord(
  record: WeightRecord,
  patch: WeightRecordPatch,
  deviceId: string,
): WeightRecord {
  return {
    ...record,
    ...patch,
    updatedAt: createTimestamp(),
    deviceId,
  };
}

export function restoreWorkoutRecord(
  record: WorkoutRecord,
  deviceId: string,
): WorkoutRecord {
  return {
    ...record,
    updatedAt: createTimestamp(),
    deletedAt: null,
    deviceId,
  };
}

export function restoreMealRecord(
  record: MealRecord,
  deviceId: string,
): MealRecord {
  return {
    ...record,
    updatedAt: createTimestamp(),
    deletedAt: null,
    deviceId,
  };
}

export function restoreWeightRecord(
  record: WeightRecord,
  deviceId: string,
): WeightRecord {
  return {
    ...record,
    updatedAt: createTimestamp(),
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
