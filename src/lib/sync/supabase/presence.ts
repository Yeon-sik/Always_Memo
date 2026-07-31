import type { Device } from "../../../types";
import type { RealtimeSubscription, SyncContext } from "../syncTypes";
import { deviceFromRow, deviceToRow } from "./mappers";
import type { DeviceRow, SupabaseClient } from "./rows";

export const ACTIVE_DEVICE_WINDOW_MS = 60_000;
export const HEARTBEAT_INTERVAL_MS = 20_000;

export interface PresenceQueryResult {
  data: DeviceRow[] | null;
  error: unknown | null;
}

export interface PresenceTransport {
  upsertDevice(row: DeviceRow): Promise<{ error: unknown | null }>;
  selectActiveDevices(
    userId: string,
    cutoff: string,
  ): Promise<PresenceQueryResult>;
}

interface DeviceTableLike {
  upsert(
    row: DeviceRow,
    options: { onConflict: string },
  ): Promise<{ error: unknown | null }>;
  select(columns: string): {
    eq(column: string, value: string): {
      gte(column: string, value: string): {
        order(
          column: string,
          options: { ascending: boolean },
        ): Promise<PresenceQueryResult>;
      };
    };
  };
}

export function createSupabasePresenceTransport(
  supabase: SupabaseClient,
): PresenceTransport {
  return {
    upsertDevice(row) {
      const devices = supabase.from("devices") as unknown as DeviceTableLike;
      return devices.upsert(row, { onConflict: "user_id,id" });
    },
    selectActiveDevices(userId, cutoff) {
      const devices = supabase.from("devices") as unknown as DeviceTableLike;
      return devices
        .select("*")
        .eq("user_id", userId)
        .gte("last_seen_at", cutoff)
        .order("last_seen_at", { ascending: false });
    },
  };
}

export function filterActiveDevices(
  devices: Device[],
  cutoff: string,
): Device[] {
  return devices
    .filter((device) => device.lastSeenAt >= cutoff)
    .sort((first, second) =>
      second.lastSeenAt.localeCompare(first.lastSeenAt),
    );
}

export interface TimerScheduler {
  setInterval(callback: () => void, delayMs: number): unknown;
  clearInterval(timerId: unknown): void;
}

function getWindowTimerScheduler(): TimerScheduler {
  return {
    setInterval: (callback, delayMs) => window.setInterval(callback, delayMs),
    clearInterval: (timerId) => window.clearInterval(timerId as number),
  };
}

export interface HeartbeatDependencies {
  isOnline: () => boolean;
  now: () => string;
  scheduler?: TimerScheduler;
}

export function startDeviceHeartbeat(
  transport: PresenceTransport,
  context: SyncContext,
  { isOnline, now, scheduler = getWindowTimerScheduler() }: HeartbeatDependencies,
): RealtimeSubscription {
  let isStopped = false;

  const beat = async () => {
    if (isStopped || !isOnline()) {
      return;
    }

    try {
      await transport.upsertDevice(
        deviceToRow(
          {
            ...context.device,
            lastSeenAt: now(),
          },
          context.userId,
        ),
      );
    } catch {
      // Presence is best-effort and must not interrupt local-first editing.
    }
  };

  void beat();
  const timerId = scheduler.setInterval(beat, HEARTBEAT_INTERVAL_MS);

  return {
    unsubscribe: () => {
      isStopped = true;
      scheduler.clearInterval(timerId);
    },
  };
}

export async function loadActiveDevices(
  transport: PresenceTransport,
  userId: string,
  fallbackDevices: Device[],
  cutoff: string,
): Promise<Device[]> {
  try {
    const result = await transport.selectActiveDevices(userId, cutoff);
    if (result.error) {
      throw result.error;
    }

    return (result.data ?? []).map(deviceFromRow);
  } catch {
    return filterActiveDevices(fallbackDevices, cutoff);
  }
}
