import { describe, expect, it } from "vitest";
import type {
  LocalDataSnapshot,
  MealRecord,
  WeightRecord,
  WorkoutRecord,
} from "../../types";
import { getFitnessSummary } from "./fitnessSummary";

const workout: WorkoutRecord = {
  id: "workout-1",
  createdAt: "2026-07-08T01:00:00.000Z",
  updatedAt: "2026-07-08T01:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
  date: "2026-07-08",
  workoutType: "strength",
  category: "가슴",
  exerciseName: "bench press",
  durationSeconds: null,
  averageHeartRate: null,
};

const previousWorkout: WorkoutRecord = {
  ...workout,
  id: "workout-2",
  date: "2026-07-05",
  category: "등",
  exerciseName: "squat",
};

const meal: MealRecord = {
  id: "meal-1",
  createdAt: "2026-07-08T02:00:00.000Z",
  updatedAt: "2026-07-08T02:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
  date: "2026-07-08",
  menu: "chicken salad",
  calories: 500,
  proteinGrams: 40,
  carbsGrams: null,
  fatGrams: null,
};

const latestWeight: WeightRecord = {
  id: "weight-1",
  createdAt: "2026-07-08T03:00:00.000Z",
  updatedAt: "2026-07-08T03:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
  date: "2026-07-08",
  weightKg: 72,
};

const previousWeight: WeightRecord = {
  ...latestWeight,
  id: "weight-2",
  date: "2026-07-01",
  weightKg: 73.5,
};

function snapshot(
  overrides: Partial<LocalDataSnapshot> = {},
): LocalDataSnapshot {
  return {
    notes: [],
    tasks: [],
    workoutRecords: [],
    mealRecords: [],
    weightRecords: [],
    devices: [],
    ...overrides,
  };
}

describe("getFitnessSummary", () => {
  it("summarizes read-only legacy fitness records", () => {
    const summary = getFitnessSummary(
      snapshot({
        workoutRecords: [previousWorkout, workout],
        mealRecords: [meal],
        weightRecords: [previousWeight, latestWeight],
      }),
      "2026-07-08",
    );

    expect(summary.todayHasWorkout).toBe(true);
    expect(summary.weeklyWorkoutCount).toBe(2);
    expect(summary.weeklyTopExercises).toEqual(["가슴운동", "등운동"]);
    expect(summary.latestWeightKg).toBe(72);
    expect(summary.weightDeltaKg).toBe(-1.5);
    expect(summary.todayHasMeal).toBe(true);
    expect(summary.latestMeal?.menu).toBe("chicken salad");
    expect(summary.connection.status).toBe("shared_workout_records");
    expect(summary.connection.linkedCount).toBe(2);
    expect(summary.connection.quickRecordOnlyCount).toBe(2);
    expect(summary.connection.possibleMismatchCount).toBe(0);
  });

  it("reports no link work when there are no fitness records", () => {
    const summary = getFitnessSummary(snapshot(), "2026-07-08");

    expect(summary.todayHasWorkout).toBe(false);
    expect(summary.connection.status).toBe("no_fitness_records");
    expect(summary.connection.possibleMismatchCount).toBe(0);
  });
});
