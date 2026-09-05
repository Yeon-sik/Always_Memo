import { describe, expect, it } from "vitest";
import type { LegacyWorkoutRecordV1, MealRecord, WeightRecord } from "../../types";
import {
  formatDurationSeconds,
  getVisibleMealRecords,
  getVisibleWeightRecords,
  getVisibleWorkoutRecords,
  getWorkoutCategoryLabels,
  getWorkoutMetricLabels,
  getWorkoutSubcategoryLabel,
} from "./fitnessService";

const auditFields = {
  createdAt: "2026-06-09T00:00:00.000Z",
  updatedAt: "2026-06-09T00:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
} as const;

const legacyWorkout: LegacyWorkoutRecordV1 = {
  ...auditFields,
  id: "workout-1",
  date: "2026-06-09",
  workoutType: "strength",
  category: "chest",
  exerciseName: "bench press",
  durationSeconds: null,
  averageHeartRate: null,
  sourceApp: "fitness",
  scope: "both",
  metadata: {
    category_codes: ["chest", "back"],
    os_categories: ["가슴", "등"],
  },
  contractVersion: 1,
};

const legacyMeal: MealRecord = {
  ...auditFields,
  id: "meal-1",
  date: "2026-06-09",
  menu: "salad",
  calories: 500,
  proteinGrams: 30,
  carbsGrams: null,
  fatGrams: null,
  sourceApp: "fitness",
  scope: "both",
  metadata: {},
  contractVersion: 1,
};

const legacyWeight: WeightRecord = {
  ...auditFields,
  id: "weight-1",
  date: "2026-06-09",
  weightKg: 72,
  sourceApp: "fitness",
  scope: "both",
  metadata: {},
  contractVersion: 1,
};

describe("fitnessService legacy compatibility readers", () => {
  it("keeps v1 Fitness rows readable without exposing a write API", () => {
    expect(getVisibleWorkoutRecords([legacyWorkout])).toEqual([legacyWorkout]);
    expect(
      getVisibleWorkoutRecords([
        legacyWorkout,
        { ...legacyWorkout, id: "hidden", scope: "fitness" },
        { ...legacyWorkout, id: "deleted", deletedAt: auditFields.updatedAt },
      ]).map((record) => record.id),
    ).toEqual(["workout-1"]);
  });

  it("retains v1 category and metric formatting for compatibility readers", () => {
    expect(getWorkoutCategoryLabels(legacyWorkout)).toEqual(["가슴", "등"]);
    expect(getWorkoutSubcategoryLabel(legacyWorkout)).toBe("가슴운동 · 등운동");

    const cardio: LegacyWorkoutRecordV1 = {
      ...legacyWorkout,
      id: "cardio-1",
      workoutType: "cardio",
      category: "달리기",
      exerciseName: "running",
      durationSeconds: 1_800,
      averageHeartRate: 140,
    };
    expect(getWorkoutMetricLabels(cardio)).toEqual([
      "00:30:00",
      "평균 심박수 140 bpm",
    ]);
    expect(formatDurationSeconds(90)).toBe("00:01:30");
  });

  it("keeps meal and weight rows read-compatible while filtering Fitness-only rows", () => {
    expect(getVisibleMealRecords([legacyMeal])).toEqual([legacyMeal]);
    expect(getVisibleWeightRecords([legacyWeight])).toEqual([legacyWeight]);
    expect(
      getVisibleMealRecords([{ ...legacyMeal, scope: "fitness" }]),
    ).toEqual([]);
    expect(
      getVisibleWeightRecords([{ ...legacyWeight, scope: "fitness" }]),
    ).toEqual([]);
  });
});
