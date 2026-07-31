import { describe, expect, it, vi } from "vitest";
import type { SyncContext } from "../syncTypes";
import { deviceToRow } from "./mappers";
import {
  HEARTBEAT_INTERVAL_MS,
  filterActiveDevices,
  loadActiveDevices,
  startDeviceHeartbeat,
  type PresenceTransport,
  type TimerScheduler,
} from "./presence";
import { makeDevice } from "./testFixtures";

function createTransport(): PresenceTransport {
  return {
    upsertDevice: vi.fn(async () => ({ error: null })),
    selectActiveDevices: vi.fn(async () => ({ data: [], error: null })),
  };
}

const context: SyncContext = {
  userId: "user-1",
  device: makeDevice({ id: "device-a" }),
};

describe("Supabase presence", () => {
  it("filters stale fallbacks and sorts the remaining devices", () => {
    const devices = [
      makeDevice({ id: "old", lastSeenAt: "2026-08-01T00:00:00.000Z" }),
      makeDevice({ id: "new", lastSeenAt: "2026-08-01T00:01:00.000Z" }),
      makeDevice({ id: "middle", lastSeenAt: "2026-08-01T00:00:30.000Z" }),
    ];

    expect(
      filterActiveDevices(devices, "2026-08-01T00:00:20.000Z").map(
        (device) => device.id,
      ),
    ).toEqual(["new", "middle"]);
  });

  it("beats immediately and every 20 seconds until unsubscribed", async () => {
    const transport = createTransport();
    let didSchedule = false;
    let scheduledBeat = () => {
      throw new Error("heartbeat was not scheduled");
    };
    const scheduler: TimerScheduler = {
      setInterval: vi.fn((callback, delayMs) => {
        expect(delayMs).toBe(HEARTBEAT_INTERVAL_MS);
        didSchedule = true;
        scheduledBeat = callback;
        return "timer-1";
      }),
      clearInterval: vi.fn(),
    };
    const subscription = startDeviceHeartbeat(transport, context, {
      isOnline: () => true,
      now: () => "2026-08-01T00:01:00.000Z",
      scheduler,
    });

    await Promise.resolve();
    expect(transport.upsertDevice).toHaveBeenCalledTimes(1);
    expect(transport.upsertDevice).toHaveBeenLastCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        id: "device-a",
        last_seen_at: "2026-08-01T00:01:00.000Z",
      }),
    );

    expect(didSchedule).toBe(true);
    scheduledBeat();
    await Promise.resolve();
    expect(transport.upsertDevice).toHaveBeenCalledTimes(2);

    subscription.unsubscribe();
    scheduledBeat();
    await Promise.resolve();
    expect(transport.upsertDevice).toHaveBeenCalledTimes(2);
    expect(scheduler.clearInterval).toHaveBeenCalledWith("timer-1");
  });

  it("uses remote active devices and falls back when the query fails", async () => {
    const remote = makeDevice({
      id: "remote",
      lastSeenAt: "2026-08-01T00:01:00.000Z",
    });
    const fallback = [
      makeDevice({ id: "fallback", lastSeenAt: "2026-08-01T00:00:30.000Z" }),
    ];
    const transport = createTransport();
    vi.mocked(transport.selectActiveDevices).mockResolvedValueOnce({
      data: [deviceToRow(remote, "user-1")],
      error: null,
    });

    await expect(
      loadActiveDevices(
        transport,
        "user-1",
        fallback,
        "2026-08-01T00:00:20.000Z",
      ),
    ).resolves.toEqual([remote]);

    vi.mocked(transport.selectActiveDevices).mockResolvedValueOnce({
      data: null,
      error: new Error("RLS denied"),
    });
    await expect(
      loadActiveDevices(
        transport,
        "user-1",
        fallback,
        "2026-08-01T00:00:20.000Z",
      ),
    ).resolves.toEqual(fallback);
  });
});
