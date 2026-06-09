import { describe, expect, it } from "vitest";
import type { LocalDataSnapshot, MealRecord, WeightRecord, WorkoutRecord } from "../../types";
import {
  getCalendarMarkers,
  getDashboardStats,
  getRecordsForDate,
} from "./recordAggregation";

const liveWorkout: WorkoutRecord = {
  id: "workout-live",
  date: "2026-06-09",
  workoutType: "strength",
  category: "chest",
  exerciseName: "bench press",
  updatedAt: "2026-06-09T00:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
};

const deletedWorkout: WorkoutRecord = {
  ...liveWorkout,
  id: "workout-deleted",
  deletedAt: "2026-06-09T00:00:01.000Z",
};

const liveMeal: MealRecord = {
  id: "meal-live",
  date: "2026-06-09",
  menu: "salad",
  calories: 600,
  proteinGrams: 40,
  carbsGrams: 50,
  fatGrams: 20,
  updatedAt: "2026-06-09T00:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
};

const deletedMeal: MealRecord = {
  ...liveMeal,
  id: "meal-deleted",
  calories: 1000,
  proteinGrams: 100,
  deletedAt: "2026-06-09T00:00:01.000Z",
};

const liveWeight: WeightRecord = {
  id: "weight-live",
  date: "2026-06-09",
  weightKg: 72,
  updatedAt: "2026-06-09T00:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
};

const deletedWeight: WeightRecord = {
  ...liveWeight,
  id: "weight-deleted",
  weightKg: 80,
  deletedAt: "2026-06-09T00:00:01.000Z",
};

const snapshot: LocalDataSnapshot = {
  notes: [],
  tasks: [],
  workoutRecords: [liveWorkout, deletedWorkout],
  mealRecords: [liveMeal, deletedMeal],
  weightRecords: [liveWeight, deletedWeight],
  devices: [],
};

describe("recordAggregation", () => {
  it("excludes tombstones from selected date records", () => {
    const records = getRecordsForDate(snapshot, "2026-06-09");

    expect(records.workoutRecords).toHaveLength(1);
    expect(records.mealRecords).toHaveLength(1);
    expect(records.weightRecords).toHaveLength(1);
    expect(records.workoutRecords[0].id).toBe("workout-live");
  });

  it("excludes tombstones from dashboard stats", () => {
    const stats = getDashboardStats(snapshot, {
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(stats.averageCalories).toBe(600);
    expect(stats.averageProteinGrams).toBe(40);
    expect(stats.latestWeightKg).toBe(72);
  });

  it("does not create markers for tombstone-only dates", () => {
    const markers = getCalendarMarkers(
      {
        ...snapshot,
        workoutRecords: [deletedWorkout],
        mealRecords: [deletedMeal],
        weightRecords: [deletedWeight],
      },
      "2026-06-09",
    );

    expect(markers["2026-06-09"]).toBeUndefined();
  });
});
