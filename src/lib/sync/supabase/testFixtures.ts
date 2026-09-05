import type {
  Device,
  FitnessSummaryProjectionV2,
  LegacyWorkoutRecordV1,
  LocalDataSnapshot,
  MealRecord,
  Note,
  Task,
  WeightRecord,
} from "../../../types";

export const TEST_TIME = "2026-08-01T00:00:00.000Z";

const auditFields = {
  createdAt: TEST_TIME,
  updatedAt: TEST_TIME,
  deletedAt: null,
  deviceId: "device-a",
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
} as const;

export function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    ...auditFields,
    id: "note-1",
    title: "Title",
    content: "Content",
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    ...auditFields,
    id: "task-1",
    text: "Task",
    isDone: false,
    orderIndex: 0,
    dueDate: null,
    dueTime: null,
    plannedDate: null,
    ...overrides,
  };
}

export function makeWorkoutRecord(
  overrides: Partial<LegacyWorkoutRecordV1> = {},
): LegacyWorkoutRecordV1 {
  return {
    ...auditFields,
    id: "workout-1",
    date: "2026-08-01",
    workoutType: "strength",
    category: "웨이트",
    exerciseName: "Squat",
    durationSeconds: 1800,
    averageHeartRate: 120,
    sourceApp: "os",
    scope: "both",
    metadata: { sets: 3 },
    contractVersion: 1,
    ...overrides,
  };
}

export function makeFitnessSummaryProjection(
  overrides: Partial<FitnessSummaryProjectionV2> = {},
): FitnessSummaryProjectionV2 {
  return {
    ...auditFields,
    id: "workout-1",
    sourceFitnessSessionId: "workout-1",
    date: "2026-08-01",
    completionStatus: "completed",
    chestSets: 14,
    backSets: 8,
    legsSets: 0,
    shouldersSets: 0,
    absSets: 0,
    tricepsSets: 0,
    bicepsSets: 0,
    totalDurationSeconds: 3600,
    cardioDurationSeconds: null,
    contractVersion: 2,
    ...overrides,
  };
}

export function makeMealRecord(
  overrides: Partial<MealRecord> = {},
): MealRecord {
  return {
    ...auditFields,
    id: "meal-1",
    date: "2026-08-01",
    menu: "Lunch",
    calories: 600,
    proteinGrams: 40,
    carbsGrams: 70,
    fatGrams: 20,
    sourceApp: "fitness",
    scope: "fitness",
    metadata: { source: "manual" },
    contractVersion: 1,
    ...overrides,
  };
}

export function makeWeightRecord(
  overrides: Partial<WeightRecord> = {},
): WeightRecord {
  return {
    ...auditFields,
    id: "weight-1",
    date: "2026-08-01",
    weightKg: 75.5,
    sourceApp: "os",
    scope: "both",
    metadata: {},
    contractVersion: 1,
    ...overrides,
  };
}

export function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: "device-a",
    name: "Desktop",
    lastSeenAt: TEST_TIME,
    appVersion: "1.0.0",
    ...overrides,
  };
}

export function makeSnapshot(
  overrides: Partial<LocalDataSnapshot> = {},
): LocalDataSnapshot {
  return {
    notes: [],
    tasks: [],
    workoutRecords: [],
    fitnessSummaryProjections: [],
    mealRecords: [],
    weightRecords: [],
    devices: [],
    ...overrides,
  };
}
