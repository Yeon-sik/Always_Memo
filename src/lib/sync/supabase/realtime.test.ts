import { describe, expect, it, vi } from "vitest";
import { noteToRow } from "./mappers";
import {
  applyRealtimePayload,
  subscribeSnapshotRealtime,
  type RealtimeTransport,
} from "./realtime";
import type {
  PostgresChangePayload,
  RealtimeTableName,
} from "./rows";
import { makeNote, makeSnapshot } from "./testFixtures";

class FakeRealtimeTransport implements RealtimeTransport {
  readonly channel = { id: "channel-1" };
  readonly removeChannel = vi.fn(async () => undefined);
  private onChange:
    | ((
        tableName: RealtimeTableName,
        payload: PostgresChangePayload<unknown>,
      ) => void)
    | null = null;
  private onStatus: ((status: string) => void) | null = null;

  subscribe(
    _userId: string,
    onChange: (
      tableName: RealtimeTableName,
      payload: PostgresChangePayload<unknown>,
    ) => void,
    onStatus: (status: string) => void,
  ): unknown {
    this.onChange = onChange;
    this.onStatus = onStatus;
    return this.channel;
  }

  emit(
    tableName: RealtimeTableName,
    payload: PostgresChangePayload<unknown>,
  ): void {
    this.onChange?.(tableName, payload);
  }

  emitStatus(status: string): void {
    this.onStatus?.(status);
  }
}

describe("Supabase realtime", () => {
  it("maps and applies a remote row through canonical LWW", () => {
    const local = makeSnapshot({
      notes: [
        makeNote({
          content: "local",
          updatedAt: "2026-08-01T00:00:01.000Z",
        }),
      ],
    });
    const remoteRow = noteToRow(
      makeNote({
        content: "remote",
        deviceId: "device-b",
        updatedAt: "2026-08-01T00:00:02.000Z",
      }),
      "user-1",
    );

    const result = applyRealtimePayload(
      local,
      "notes",
      { eventType: "UPDATE", new: remoteRow },
      "device-a",
    );

    expect(result?.notes[0].content).toBe("remote");
  });

  it("applies equal-timestamp soft-delete tombstones", () => {
    const updatedAt = "2026-08-01T00:00:02.000Z";
    const local = makeSnapshot({
      notes: [makeNote({ updatedAt, deletedAt: null })],
    });
    const tombstone = noteToRow(
      makeNote({
        updatedAt,
        deletedAt: updatedAt,
        deviceId: "device-b",
      }),
      "user-1",
    );

    expect(
      applyRealtimePayload(
        local,
        "notes",
        { eventType: "UPDATE", new: tombstone },
        "device-a",
      )?.notes[0].deletedAt,
    ).toBe(updatedAt);
  });

  it("ignores self-device rows and hard-delete payloads without new rows", () => {
    const snapshot = makeSnapshot();
    const selfRow = noteToRow(makeNote({ deviceId: "device-a" }), "user-1");

    expect(
      applyRealtimePayload(
        snapshot,
        "notes",
        { eventType: "UPDATE", new: selfRow },
        "device-a",
      ),
    ).toBeNull();
    expect(
      applyRealtimePayload(
        snapshot,
        "notes",
        { eventType: "DELETE", old: { id: "note-1" } },
        "device-a",
      ),
    ).toBeNull();
  });

  it("delivers applied snapshots, reports channel errors, and removes the channel", async () => {
    const transport = new FakeRealtimeTransport();
    const onSnapshot = vi.fn();
    const onError = vi.fn();
    const subscription = subscribeSnapshotRealtime({
      transport,
      userId: "user-1",
      currentDeviceId: "device-a",
      getSnapshot: makeSnapshot,
      onSnapshot,
      onError,
    });
    const remoteRow = noteToRow(
      makeNote({ deviceId: "device-b" }),
      "user-1",
    );

    transport.emit("notes", { eventType: "INSERT", new: remoteRow });
    transport.emitStatus("CHANNEL_ERROR");
    await subscription.unsubscribe();

    expect(onSnapshot).toHaveBeenCalledWith(
      "notes",
      expect.objectContaining({ notes: [expect.objectContaining({ id: "note-1" })] }),
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(transport.removeChannel).toHaveBeenCalledWith(transport.channel);
  });
});
