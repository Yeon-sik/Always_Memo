import { describe, expect, it } from "vitest";
import type {
  LocalDataSnapshot,
  MealRecord,
  Task,
  WeightRecord,
  WorkoutRecord,
} from "../../types";
import {
  getCalendarMarkers,
  getDashboardStats,
  getNutritionSeries,
  getRecordsForDate,
} from "./recordAggregation";

const liveWorkout: WorkoutRecord = {
  id: "workout-live",
  createdAt: "2026-06-09T00:00:00.000Z",
  date: "2026-06-09",
  workoutType: "strength",
  category: "chest",
  exerciseName: "bench press",
  durationSeconds: null,
  averageHeartRate: null,
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
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
  createdAt: "2026-06-09T00:00:00.000Z",
  date: "2026-06-09",
  menu: "salad",
  calories: 600,
  proteinGrams: 40,
  carbsGrams: 50,
  fatGrams: 20,
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
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

const deletedWeight: WeightRecord = {
  ...liveWeight,
  id: "weight-deleted",
  weightKg: 80,
  deletedAt: "2026-06-09T00:00:01.000Z",
};

const directTask: Task = {
  id: "task-direct",
  createdAt: "2026-06-09T00:00:00.000Z",
  text: "direct",
  isDone: true,
  orderIndex: 0,
  dueDate: "2026-06-09",
  dueTime: null,
  isBackfilled: false,
  backfilledAt: null,
  backfillReason: null,
  updatedAt: "2026-06-09T00:00:00.000Z",
  deletedAt: null,
  deviceId: "device-a",
};

const backfilledTask: Task = {
  ...directTask,
  id: "task-backfilled",
  text: "backfilled",
  isBackfilled: true,
  backfilledAt: "2026-06-10T00:00:00.000Z",
  backfillReason: "test",
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

  it("includes backfilled behavior records but excludes backfilled tasks from productivity", () => {
    const stats = getDashboardStats(
      {
        ...snapshot,
        tasks: [directTask, backfilledTask],
        mealRecords: [
          liveMeal,
          {
            ...liveMeal,
            id: "meal-backfilled",
            calories: 800,
            proteinGrams: 60,
            isBackfilled: true,
            backfilledAt: "2026-06-10T00:00:00.000Z",
            backfillReason: "test",
          },
        ],
      },
      {
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
    );

    expect(stats.completedTasks).toBe(1);
    expect(stats.totalTasks).toBe(1);
    expect(stats.backfilledTaskCount).toBe(1);
    expect(stats.averageCalories).toBe(700);
    expect(stats.backfilledMealCount).toBe(1);
    expect(stats.totalBackfilledCount).toBe(2);
  });

  it("excludes zero meal nutrition values from averages", () => {
    const zeroMeal: MealRecord = {
      ...liveMeal,
      id: "meal-zero",
      calories: 0,
      proteinGrams: 0,
    };
    const stats = getDashboardStats(
      {
        ...snapshot,
        mealRecords: [liveMeal, zeroMeal],
      },
      {
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
    );
    const series = getNutritionSeries([liveMeal, zeroMeal], {
      startDate: "2026-06-09",
      endDate: "2026-06-09",
    });

    expect(stats.averageCalories).toBe(600);
    expect(stats.averageProteinGrams).toBe(40);
    expect(series[0].averageCalories).toBe(600);
    expect(series[0].averageProteinGrams).toBe(40);
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

  it("shows scheduled tasks across dates before the due date", () => {
    const scheduledTask: Task = {
      ...directTask,
      id: "task-scheduled",
      text: "scheduled",
      isDone: false,
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
      dueDate: "2026-06-09",
    };
    const markers = getCalendarMarkers(
      {
        ...snapshot,
        tasks: [scheduledTask],
      },
      "2026-06-09",
    );

    expect(markers["2026-06-07"]?.tasks.activeCount).toBe(1);
    expect(markers["2026-06-07"]?.tasks.dueCount).toBe(0);
    expect(markers["2026-06-08"]?.tasks.activeCount).toBe(1);
    expect(markers["2026-06-08"]?.tasks.dueCount).toBe(0);
    expect(markers["2026-06-09"]?.tasks.activeCount).toBe(1);
    expect(markers["2026-06-09"]?.tasks.dueCount).toBe(1);
  });

  it("includes still-active scheduled tasks in earlier date records", () => {
    const scheduledTask: Task = {
      ...directTask,
      id: "task-scheduled",
      text: "scheduled",
      isDone: false,
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
      dueDate: "2026-06-09",
    };
    const records = getRecordsForDate(
      {
        ...snapshot,
        tasks: [scheduledTask],
      },
      "2026-06-08",
    );

    expect(records.tasks).toHaveLength(1);
    expect(records.tasks[0].id).toBe("task-scheduled");
  });

  it("counts multiple active tasks as multiple calendar dots before the due date", () => {
    const firstTask: Task = {
      ...directTask,
      id: "task-scheduled-1",
      isDone: false,
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
      dueDate: "2026-06-09",
    };
    const secondTask: Task = {
      ...directTask,
      id: "task-scheduled-2",
      isDone: false,
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z",
      dueDate: "2026-06-10",
    };
    const markers = getCalendarMarkers(
      {
        ...snapshot,
        tasks: [firstTask, secondTask],
      },
      "2026-06-09",
    );

    expect(markers["2026-06-08"]?.tasks.activeCount).toBe(2);
    expect(markers["2026-06-08"]?.tasks.dueCount).toBe(0);
    expect(markers["2026-06-09"]?.tasks.activeCount).toBe(2);
    expect(markers["2026-06-09"]?.tasks.dueCount).toBe(1);
  });
});
