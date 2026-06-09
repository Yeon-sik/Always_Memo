import type {
  Device,
  LocalDataSnapshot,
  MealRecord,
  Note,
  Task,
  WeightRecord,
  WorkoutRecord,
  WorkoutType,
} from "../../types";
import { normalizeEntityAuditFields } from "../dataTrust/backfillMetadata";
import { createEmptySnapshot, type StorageAdapter } from "./storageAdapter";

const STORAGE_KEY = "localsyncmemo:snapshot:v1";

interface StoredEnvelope {
  version: 1;
  snapshot: LocalDataSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isSyncableEntity(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === "string" &&
    typeof value.updatedAt === "string" &&
    isNullableString(value.deletedAt) &&
    typeof value.deviceId === "string"
  );
}

function getNormalizedSyncFields(value: Record<string, unknown>) {
  const updatedAt = value.updatedAt as string;

  return {
    ...normalizeEntityAuditFields(value, updatedAt),
    updatedAt,
    deletedAt: value.deletedAt as string | null,
    deviceId: value.deviceId as string,
  };
}

function normalizeNote(value: unknown): Note | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.title !== "string" ||
    typeof value.content !== "string"
  ) {
    return null;
  }

  return {
    id: value.id as string,
    title: value.title,
    content: value.content,
    ...getNormalizedSyncFields(value),
  };
}

function normalizeTask(value: unknown): Task | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.text !== "string" ||
    typeof value.isDone !== "boolean" ||
    typeof value.orderIndex !== "number"
  ) {
    return null;
  }

  const dueDate = isNullableString(value.dueDate) ? value.dueDate : null;
  const dueTime = isNullableString(value.dueTime) ? value.dueTime : null;
  return {
    id: value.id as string,
    text: value.text,
    isDone: value.isDone,
    orderIndex: value.orderIndex,
    dueDate,
    dueTime,
    ...getNormalizedSyncFields(value),
  };
}

function normalizeWorkoutRecord(value: unknown): WorkoutRecord | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.date !== "string" ||
    typeof value.category !== "string" ||
    typeof value.exerciseName !== "string"
  ) {
    return null;
  }

  const workoutType: WorkoutType =
    value.workoutType === "cardio" || value.workoutType === "other"
      ? value.workoutType
      : "strength";

  return {
    id: value.id as string,
    date: value.date,
    workoutType,
    category: value.category,
    exerciseName: value.exerciseName,
    ...getNormalizedSyncFields(value),
  };
}

function normalizeMealRecord(value: unknown): MealRecord | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.date !== "string" ||
    typeof value.menu !== "string" ||
    typeof value.calories !== "number" ||
    typeof value.proteinGrams !== "number"
  ) {
    return null;
  }

  return {
    id: value.id as string,
    date: value.date,
    menu: value.menu,
    calories: value.calories,
    proteinGrams: value.proteinGrams,
    carbsGrams: typeof value.carbsGrams === "number" ? value.carbsGrams : null,
    fatGrams: typeof value.fatGrams === "number" ? value.fatGrams : null,
    ...getNormalizedSyncFields(value),
  };
}

function normalizeWeightRecord(value: unknown): WeightRecord | null {
  if (
    !isRecord(value) ||
    !isSyncableEntity(value) ||
    typeof value.date !== "string" ||
    typeof value.weightKg !== "number"
  ) {
    return null;
  }

  return {
    id: value.id as string,
    date: value.date,
    weightKg: value.weightKg,
    ...getNormalizedSyncFields(value),
  };
}

function isDevice(value: unknown): value is Device {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.lastSeenAt === "string" &&
    (typeof value.appVersion === "string" ||
      value.appVersion === null ||
      value.appVersion === undefined)
  );
}

function normalizeArray<T>(
  value: unknown,
  normalize: (item: unknown) => T | null,
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const normalized = normalize(item);
    return normalized ? [normalized] : [];
  });
}

function normalizeSnapshot(value: unknown): LocalDataSnapshot {
  if (!isRecord(value)) {
    return createEmptySnapshot();
  }

  const notes = normalizeArray(value.notes, normalizeNote);
  const tasks = normalizeArray(value.tasks, normalizeTask);
  const workoutRecords = normalizeArray(
    value.workoutRecords,
    normalizeWorkoutRecord,
  );
  const mealRecords = normalizeArray(value.mealRecords, normalizeMealRecord);
  const weightRecords = normalizeArray(
    value.weightRecords,
    normalizeWeightRecord,
  );
  const devices = Array.isArray(value.devices)
    ? value.devices.filter(isDevice)
    : [];

  return {
    notes,
    tasks,
    workoutRecords,
    mealRecords,
    weightRecords,
    devices,
  };
}

function parseStoredValue(rawValue: string): LocalDataSnapshot {
  const parsed = JSON.parse(rawValue) as unknown;

  if (isRecord(parsed) && parsed.version === 1 && "snapshot" in parsed) {
    return normalizeSnapshot(parsed.snapshot);
  }

  return normalizeSnapshot(parsed);
}

export class LocalStorageAdapter implements StorageAdapter {
  async load(): Promise<LocalDataSnapshot> {
    if (typeof window === "undefined") {
      return createEmptySnapshot();
    }

    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return createEmptySnapshot();
    }

    try {
      return parseStoredValue(rawValue);
    } catch {
      throw new Error("저장된 로컬 데이터를 읽을 수 없습니다.");
    }
  }

  async save(snapshot: LocalDataSnapshot): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const envelope: StoredEnvelope = {
        version: 1,
        snapshot,
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      throw new Error("로컬 저장소에 변경사항을 저장하지 못했습니다.");
    }
  }
}

export const localStorageAdapter = new LocalStorageAdapter();
