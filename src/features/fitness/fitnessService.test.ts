import { describe, expect, it } from "vitest";
import type { MealRecord, WeightRecord, WorkoutRecord } from "../../types";
import {
  createMealRecord,
  restoreWeightRecord,
  softDeleteWeightRecord,
  updateMealRecord,
  updateWeightRecord,
  updateWorkoutRecord,
} from "./fitnessService";

const baseWorkout: WorkoutRecord = {
  id: "workout-1",
  createdAt: "2026-06-09T00:00:00.000Z",
  date: "2026-06-09",
  workoutType: "strength",
  category: "chest",
  exerciseName: "bench press",
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
  updatedAt: "2026-06-09T00:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
};

const baseMeal: MealRecord = {
  id: "meal-1",
  createdAt: "2026-06-09T00:00:00.000Z",
  date: "2026-06-09",
  menu: "salad",
  calories: 500,
  proteinGrams: 30,
  carbsGrams: null,
  fatGrams: null,
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
  updatedAt: "2026-06-09T00:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
};

const baseWeight: WeightRecord = {
  id: "weight-1",
  createdAt: "2026-06-09T00:00:00.000Z",
  date: "2026-06-09",
  weightKg: 72,
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
  updatedAt: "2026-06-09T00:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
};

describe("fitnessService", () => {
  it("updates workout records with timestamp and device id", () => {
    const updated = updateWorkoutRecord(
      baseWorkout,
      { category: "back", exerciseName: "row" },
      "device-b",
    );

    expect(updated.category).toBe("back");
    expect(updated.exerciseName).toBe("row");
    expect(updated.deviceId).toBe("device-b");
    expect(updated.updatedAt).not.toBe(baseWorkout.updatedAt);
    expect(updated.deletedAt).toBeNull();
  });

  it("creates and updates meal carbs and fat values", () => {
    const created = createMealRecord(
      "2026-06-09",
      "rice bowl",
      700,
      35,
      "device-b",
      80,
      20,
    );
    const updated = updateMealRecord(
      created,
      { carbsGrams: 90.5, fatGrams: null },
      "device-c",
    );

    expect(created.carbsGrams).toBe(80);
    expect(created.fatGrams).toBe(20);
    expect(created.createdAt).toBeTruthy();
    expect(created.isBackfilled).toBe(false);
    expect(updated.carbsGrams).toBe(90.5);
    expect(updated.fatGrams).toBeNull();
    expect(updated.deviceId).toBe("device-c");
  });

  it("creates backfilled records with stable audit metadata", () => {
    const created = createMealRecord(
      "2026-06-08",
      "late meal",
      650,
      42,
      "device-b",
      null,
      null,
      {
        isBackfilled: true,
        backfilledAt: "2026-06-09T01:00:00.000Z",
        backfillReason: "test",
      },
    );

    expect(created.isBackfilled).toBe(true);
    expect(created.backfilledAt).toBe("2026-06-09T01:00:00.000Z");
    expect(created.backfillReason).toBe("test");
    expect(created.createdAt).toBeTruthy();
  });

  it("soft deletes and restores weight records without hard delete", () => {
    const deleted = softDeleteWeightRecord(baseWeight, "device-b");
    const restored = restoreWeightRecord(deleted, "device-c");

    expect(deleted.id).toBe(baseWeight.id);
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.updatedAt).toBe(deleted.deletedAt);
    expect(deleted.deviceId).toBe("device-b");
    expect(restored.deletedAt).toBeNull();
    expect(restored.deviceId).toBe("device-c");
  });

  it("updates weight records through a patch object", () => {
    const updated = updateWeightRecord(
      baseWeight,
      { date: "2026-06-10", weightKg: 71.4 },
      "device-b",
    );

    expect(updated.date).toBe("2026-06-10");
    expect(updated.weightKg).toBe(71.4);
    expect(updated.deviceId).toBe("device-b");
  });

  it("trims meal menu on update", () => {
    const updated = updateMealRecord(baseMeal, { menu: "  soup  " }, "device-b");

    expect(updated.menu).toBe("soup");
  });
});
