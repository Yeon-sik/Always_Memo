import { describe, expect, it } from "vitest";
import type { MealRecord, WorkoutRecord } from "../../../types";
import { fitnessDeleteUndoReducer } from "./useFitnessDeleteUndo";

describe("fitnessDeleteUndoReducer", () => {
  it("stores the latest deleted fitness record", () => {
    const meal = { id: "meal-1" } as MealRecord;
    const workout = { id: "workout-1" } as WorkoutRecord;

    const mealPending = fitnessDeleteUndoReducer(null, {
      type: "schedule",
      pendingDelete: { type: "meal", record: meal },
    });
    const workoutPending = fitnessDeleteUndoReducer(mealPending, {
      type: "schedule",
      pendingDelete: { type: "workout", record: workout },
    });

    expect(workoutPending).toEqual({ type: "workout", record: workout });
  });

  it("clears the pending record after expiry or undo", () => {
    const meal = { id: "meal-1" } as MealRecord;
    const pending = fitnessDeleteUndoReducer(null, {
      type: "schedule",
      pendingDelete: { type: "meal", record: meal },
    });

    expect(fitnessDeleteUndoReducer(pending, { type: "clear" })).toBeNull();
  });
});
