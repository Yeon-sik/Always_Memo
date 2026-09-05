import { describe, expect, it } from "vitest";
import type {
  FitnessSummaryProjectionV2,
  LocalDataSnapshot,
  MealRecord,
  WeightRecord,
} from "../../types";
import { getFitnessSummary } from "./fitnessSummary";

const auditFields = {
  createdAt: "2026-07-08T01:00:00.000Z",
  updatedAt: "2026-07-08T01:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
} as const;

const projection: FitnessSummaryProjectionV2 = {
  ...auditFields,
  id: "workout-1",
  sourceFitnessSessionId: "workout-1",
  date: "2026-07-08",
  completionStatus: "completed",
  chestSets: 14,
  backSets: 0,
  legsSets: 0,
  shouldersSets: 0,
  absSets: 0,
  tricepsSets: 0,
  bicepsSets: 0,
  totalDurationSeconds: 3_600,
  cardioDurationSeconds: null,
  contractVersion: 2,
};

const previousProjection: FitnessSummaryProjectionV2 = {
  ...projection,
  id: "workout-2",
  sourceFitnessSessionId: "workout-2",
  date: "2026-07-05",
  chestSets: 0,
  backSets: 8,
};

const meal: MealRecord = {
  ...auditFields,
  id: "meal-1",
  date: "2026-07-08",
  menu: "chicken salad",
  calories: 500,
  proteinGrams: 40,
  carbsGrams: null,
  fatGrams: null,
};

const latestWeight: WeightRecord = {
  ...auditFields,
  id: "weight-1",
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
    fitnessSummaryProjections: [],
    mealRecords: [],
    weightRecords: [],
    devices: [],
    ...overrides,
  };
}

describe("getFitnessSummary", () => {
  it("summarizes only the Fitness-owned Summary Projection v2", () => {
    const summary = getFitnessSummary(
      snapshot({
        fitnessSummaryProjections: [previousProjection, projection],
        mealRecords: [meal],
        weightRecords: [previousWeight, latestWeight],
      }),
      "2026-07-08",
    );

    expect(summary.todayHasWorkout).toBe(true);
    expect(summary.weeklyWorkoutCount).toBe(2);
    expect(summary.weeklyStrengthSetSummaries).toEqual([
      "가슴 운동 14세트",
      "등 운동 8세트",
    ]);
    expect(summary.recentWorkouts).toEqual([projection, previousProjection]);
    expect(summary.latestWeightKg).toBe(72);
    expect(summary.weightDeltaKg).toBe(-1.5);
    expect(summary.todayHasMeal).toBe(true);
    expect(summary.latestMeal?.menu).toBe("chicken salad");
    expect(summary.connection.status).toBe("summary_projection_v2");
    expect(summary.connection.linkedCount).toBe(2);
    expect(summary.connection.quickRecordOnlyCount).toBe(0);
    expect(summary.connection.possibleMismatchCount).toBe(0);
  });

  it("reports no projection when the v2 read model is empty", () => {
    const summary = getFitnessSummary(snapshot(), "2026-07-08");

    expect(summary.todayHasWorkout).toBe(false);
    expect(summary.connection.status).toBe("no_fitness_records");
    expect(summary.connection.possibleMismatchCount).toBe(0);
  });
});
