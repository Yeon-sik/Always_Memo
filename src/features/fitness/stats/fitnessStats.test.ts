import { describe, expect, it } from "vitest";
import type { MealRecord } from "../../../types";
import { calculateFitnessStats } from "./fitnessStats";

const baseMeal: MealRecord = {
  id: "meal-1",
  createdAt: "2026-06-09T00:00:00.000Z",
  date: "2026-06-09",
  menu: "salad",
  calories: 600,
  proteinGrams: 40,
  carbsGrams: null,
  fatGrams: null,
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
  updatedAt: "2026-06-09T00:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
};

describe("calculateFitnessStats", () => {
  it("excludes zero calories and protein values from meal averages", () => {
    const stats = calculateFitnessStats(
      [],
      [
        baseMeal,
        {
          ...baseMeal,
          id: "meal-zero",
          calories: 0,
          proteinGrams: 0,
        },
      ],
      [],
      "2026-06-01",
      "2026-06-30",
    );

    expect(stats.mealCount).toBe(2);
    expect(stats.averageCalories).toBe(600);
    expect(stats.averageProteinGrams).toBe(40);
  });

  it("returns null meal averages when all nutrition values are zero", () => {
    const stats = calculateFitnessStats(
      [],
      [
        {
          ...baseMeal,
          calories: 0,
          proteinGrams: 0,
        },
      ],
      [],
      "2026-06-01",
      "2026-06-30",
    );

    expect(stats.averageCalories).toBeNull();
    expect(stats.averageProteinGrams).toBeNull();
  });
});
