import { describe, expect, it } from "vitest";
import {
  deviceFromRow,
  deviceToRow,
  mealRecordFromRow,
  mealRecordToRow,
  noteFromRow,
  noteToRow,
  taskFromRow,
  taskToRow,
  weightRecordFromRow,
  weightRecordToRow,
  workoutRecordFromRow,
  workoutRecordToRow,
} from "./mappers";
import type { TaskRow, WorkoutRecordRow } from "./rows";
import {
  makeDevice,
  makeMealRecord,
  makeNote,
  makeTask,
  makeWeightRecord,
  makeWorkoutRecord,
} from "./testFixtures";

const USER_ID = "user-1";

describe("Supabase row mappers", () => {
  it("round-trips every sync entity and device", () => {
    const note = makeNote();
    const task = makeTask({ dueDate: "2026-08-02", dueTime: "09:30" });
    const workout = makeWorkoutRecord();
    const meal = makeMealRecord();
    const weight = makeWeightRecord();
    const device = makeDevice();

    expect(noteFromRow(noteToRow(note, USER_ID))).toEqual(note);
    expect(taskFromRow(taskToRow(task, USER_ID))).toEqual(task);
    expect(workoutRecordFromRow(workoutRecordToRow(workout, USER_ID))).toEqual(
      workout,
    );
    expect(mealRecordFromRow(mealRecordToRow(meal, USER_ID))).toEqual(meal);
    expect(weightRecordFromRow(weightRecordToRow(weight, USER_ID))).toEqual(
      weight,
    );
    expect(deviceFromRow(deviceToRow(device, USER_ID))).toEqual(device);
  });

  it("normalizes missing audit fields and database time precision", () => {
    const row: TaskRow = {
      ...taskToRow(makeTask(), USER_ID),
      created_at: null,
      is_backfilled: true,
      backfilled_at: null,
      backfill_reason: null,
      due_time: "09:30:00",
      planned_date: null,
    };

    expect(taskFromRow(row)).toMatchObject({
      createdAt: row.updated_at,
      isBackfilled: true,
      backfilledAt: row.updated_at,
      backfillReason: null,
      dueTime: "09:30",
      plannedDate: null,
    });
  });

  it("normalizes legacy workout contract values and nullable metrics", () => {
    const row: WorkoutRecordRow = {
      ...workoutRecordToRow(makeWorkoutRecord(), USER_ID),
      workout_type: "legacy-weight-training",
      duration_seconds: null,
      average_heart_rate: null,
      source_app: null,
      scope: null,
      metadata: null,
      contract_version: 99,
    };

    expect(workoutRecordFromRow(row)).toMatchObject({
      workoutType: "strength",
      durationSeconds: null,
      averageHeartRate: null,
      sourceApp: "os",
      scope: "both",
      metadata: {},
      contractVersion: 1,
    });
  });

  it("writes canonical defaults for optional fitness contract fields", () => {
    const meal = makeMealRecord({
      sourceApp: undefined,
      scope: undefined,
      metadata: undefined,
      contractVersion: undefined,
    });
    const weight = makeWeightRecord({
      sourceApp: undefined,
      scope: undefined,
      metadata: undefined,
      contractVersion: undefined,
    });

    expect(mealRecordToRow(meal, USER_ID)).toMatchObject({
      source_app: "os",
      scope: "both",
      metadata: {},
      contract_version: 1,
    });
    expect(weightRecordToRow(weight, USER_ID)).toMatchObject({
      source_app: "os",
      scope: "both",
      metadata: {},
      contract_version: 1,
    });
  });
});
