import { describe, expect, it } from "vitest";
import type { SyncContext } from "../syncTypes";
import { noteToRow } from "./mappers";
import type { SnapshotTableName } from "./rows";
import {
  createPushPayload,
  pullSnapshot,
  pushSnapshot,
  type SnapshotQueryResult,
  type SnapshotTransport,
  type SnapshotWriteResult,
} from "./snapshotIo";
import {
  makeDevice,
  makeMealRecord,
  makeNote,
  makeSnapshot,
  makeTask,
  makeWeightRecord,
  makeWorkoutRecord,
} from "./testFixtures";

class FakeSnapshotTransport implements SnapshotTransport {
  readonly selectCalls: Array<{ tableName: SnapshotTableName; userId: string }> = [];
  readonly upsertCalls: Array<{
    tableName: SnapshotTableName;
    values: unknown;
    onConflict: string;
  }> = [];
  readonly selectedRows = new Map<SnapshotTableName, SnapshotQueryResult<unknown>>();
  readonly writeErrors = new Map<SnapshotTableName, unknown>();

  async selectRows<Row>(
    tableName: SnapshotTableName,
    userId: string,
  ): Promise<SnapshotQueryResult<Row>> {
    this.selectCalls.push({ tableName, userId });
    const result = this.selectedRows.get(tableName) ?? { data: [], error: null };
    return result as SnapshotQueryResult<Row>;
  }

  async upsertRows<Row>(
    tableName: SnapshotTableName,
    values: Row | Row[],
    onConflict: string,
  ): Promise<SnapshotWriteResult> {
    this.upsertCalls.push({ tableName, values, onConflict });
    return { error: this.writeErrors.get(tableName) ?? null };
  }
}

const context: SyncContext = {
  userId: "user-1",
  device: makeDevice({ id: "device-a" }),
};

describe("Supabase snapshot IO", () => {
  it("pulls all seven tables and merges mapped rows into the local snapshot", async () => {
    const transport = new FakeSnapshotTransport();
    transport.selectedRows.set("notes", {
      data: [
        noteToRow(
          makeNote({
            content: "remote",
            updatedAt: "2026-08-01T00:00:02.000Z",
          }),
          context.userId,
        ),
      ],
      error: null,
    });
    const local = makeSnapshot({
      notes: [
        makeNote({
          content: "local",
          updatedAt: "2026-08-01T00:00:01.000Z",
        }),
      ],
    });

    const result = await pullSnapshot(transport, local, context.userId);

    expect(transport.selectCalls.map((call) => call.tableName)).toEqual([
      "notes",
      "tasks",
      "workout_records",
      "meal_records",
      "weight_records",
      "fitness_summary_projections_v2",
      "devices",
    ]);
    expect(result.notes[0].content).toBe("remote");
  });

  it("fails the pull when any table query fails", async () => {
    const transport = new FakeSnapshotTransport();
    const queryError = new Error("RLS denied tasks");
    transport.selectedRows.set("tasks", { data: null, error: queryError });

    await expect(
      pullSnapshot(transport, makeSnapshot(), context.userId),
    ).rejects.toBe(queryError);
  });

  it("builds a current-device-only payload while retaining tombstones", () => {
    const deletedAt = "2026-08-01T00:00:03.000Z";
    const snapshot = makeSnapshot({
      notes: [
        makeNote({ deletedAt, updatedAt: deletedAt, deviceId: "device-a" }),
        makeNote({ id: "note-b", deviceId: "device-b" }),
      ],
    });

    const payload = createPushPayload(
      snapshot,
      context,
      "2026-08-01T00:00:04.000Z",
    );

    expect(payload.notes).toHaveLength(1);
    expect(payload.notes[0]).toMatchObject({
      user_id: context.userId,
      device_id: "device-a",
      deleted_at: deletedAt,
    });
    expect(payload.device).toMatchObject({
      user_id: context.userId,
      id: "device-a",
      last_seen_at: "2026-08-01T00:00:04.000Z",
    });
  });

  it("pushes device then entity batches with the canonical conflicts", async () => {
    const transport = new FakeSnapshotTransport();
    const snapshot = makeSnapshot({
      notes: [makeNote()],
      tasks: [makeTask()],
      workoutRecords: [makeWorkoutRecord()],
      mealRecords: [makeMealRecord()],
      weightRecords: [makeWeightRecord()],
    });

    const result = await pushSnapshot(
      transport,
      snapshot,
      context,
      "2026-08-01T00:00:05.000Z",
    );

    expect(transport.upsertCalls.map((call) => call.tableName)).toEqual([
      "devices",
      "notes",
      "tasks",
    ]);
    expect(transport.upsertCalls.map((call) => call.onConflict)).toEqual([
      "user_id,id",
      "id",
      "id",
    ]);
    expect(result.changedRows).toBe(3);
    expect(result.currentDevice.lastSeenAt).toBe("2026-08-01T00:00:05.000Z");
  });

  it("stops and reports the write error instead of claiming later batches", async () => {
    const transport = new FakeSnapshotTransport();
    const writeError = new Error("tasks upsert failed");
    transport.writeErrors.set("tasks", writeError);
    const snapshot = makeSnapshot({
      notes: [makeNote()],
      tasks: [makeTask()],
      workoutRecords: [makeWorkoutRecord()],
    });

    await expect(
      pushSnapshot(
        transport,
        snapshot,
        context,
        "2026-08-01T00:00:05.000Z",
      ),
    ).rejects.toBe(writeError);
    expect(transport.upsertCalls.map((call) => call.tableName)).toEqual([
      "devices",
      "notes",
      "tasks",
    ]);
  });
});
