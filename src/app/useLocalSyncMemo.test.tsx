import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StorageAdapter } from "../lib/storage/storageAdapter";
import { createEmptySnapshot } from "../lib/storage/storageAdapter";
import type {
  AuthState,
  FinanceDailySummary,
  RealtimeOptions,
  RealtimeSubscription,
  SyncClient,
  SyncContext,
  SyncResult,
  SyncStatus,
} from "../lib/sync/syncTypes";
import type { Device, LocalDataSnapshot, Note } from "../types";
import { getOrCreateDevice } from "../lib/device/device";
import { getAutostartEnabled } from "../lib/desktop/autostart";
import { useLocalSyncMemo } from "./useLocalSyncMemo";

vi.mock("../lib/device/device", async () => {
  const actual = await vi.importActual<typeof import("../lib/device/device")>(
    "../lib/device/device",
  );

  return {
    ...actual,
    getOrCreateDevice: vi.fn(),
  };
});

vi.mock("../lib/desktop/autostart", () => ({
  getAutostartEnabled: vi.fn(),
  setAutostartEnabled: vi.fn(async (enabled: boolean) => ({
    enabled,
    error: null,
    supported: true,
  })),
}));

const device: Device = {
  id: "device-a",
  name: "Test device",
  lastSeenAt: "2026-08-01T00:00:00.000Z",
  appVersion: "1.0.0",
};

const syncedStatus: SyncStatus = {
  mode: "synced",
  label: "synced",
  detail: "동기화됨",
  isOnline: true,
  lastSyncedAt: "2026-08-01T00:00:00.000Z",
  isConfigured: true,
};

function createNote(id: string, updatedAt: string): Note {
  return {
    id,
    title: id,
    content: "",
    createdAt: updatedAt,
    updatedAt,
    deletedAt: null,
    deviceId: device.id,
    isBackfilled: false,
    backfilledAt: null,
    backfillReason: null,
  };
}

class MemoryStorage implements StorageAdapter {
  readonly saved: LocalDataSnapshot[] = [];

  constructor(
    private readonly snapshot: LocalDataSnapshot,
    private readonly trace: string[] = [],
  ) {}

  async load(): Promise<LocalDataSnapshot> {
    this.trace.push("load");
    return structuredClone(this.snapshot);
  }

  async save(snapshot: LocalDataSnapshot): Promise<void> {
    this.trace.push("save");
    this.saved.push(structuredClone(snapshot));
  }
}

class FakeSyncClient implements SyncClient {
  readonly trace: string[];
  readonly pushSnapshots: LocalDataSnapshot[] = [];
  readonly activeDeviceCalls: SyncContext[] = [];
  authState: AuthState = { userId: null, email: null };
  pullSnapshot: LocalDataSnapshot | null = null;
  realtimeOptions: RealtimeOptions | null = null;
  realtimeUnsubscribeCount = 0;
  heartbeatUnsubscribeCount = 0;

  constructor(trace: string[] = []) {
    this.trace = trace;
  }

  getStatus(): SyncStatus {
    return syncedStatus;
  }

  isConfigured(): boolean {
    return true;
  }

  async getAuthState(): Promise<AuthState> {
    this.trace.push("auth");
    return this.authState;
  }

  async signIn(email: string): Promise<AuthState> {
    this.trace.push("signIn");
    this.authState = { userId: "user-a", email };
    return this.authState;
  }

  async signOut(): Promise<void> {
    this.trace.push("signOut");
    this.authState = { userId: null, email: null };
  }

  async getFinanceDailySummaries(
    _userId: string,
    _fromDate: string,
    _toDate: string,
  ): Promise<FinanceDailySummary[]> {
    return [];
  }

  async pull(
    localSnapshot: LocalDataSnapshot,
    _context: SyncContext,
  ): Promise<LocalDataSnapshot> {
    this.trace.push("pull");
    return structuredClone(this.pullSnapshot ?? localSnapshot);
  }

  async push(
    localSnapshot: LocalDataSnapshot,
    _context: SyncContext,
  ): Promise<SyncResult> {
    this.trace.push("push");
    this.pushSnapshots.push(structuredClone(localSnapshot));
    return { changedRows: 0, status: syncedStatus };
  }

  subscribeRealtime(options: RealtimeOptions): RealtimeSubscription {
    this.trace.push("realtime");
    this.realtimeOptions = options;

    return {
      unsubscribe: () => {
        this.realtimeUnsubscribeCount += 1;
      },
    };
  }

  startHeartbeat(_context: SyncContext): RealtimeSubscription {
    this.trace.push("heartbeat");

    return {
      unsubscribe: () => {
        this.heartbeatUnsubscribeCount += 1;
      },
    };
  }

  async getActiveDevices(
    context: SyncContext,
    fallbackDevices: Device[],
  ): Promise<Device[]> {
    this.trace.push("activeDevices");
    this.activeDeviceCalls.push(context);
    return fallbackDevices;
  }
}

class BrowserStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

type HookValue = ReturnType<typeof useLocalSyncMemo>;

let currentHook: HookValue;
let renderer: ReactTestRenderer | null = null;
let browserStorage: BrowserStorage;

function Harness({
  storage,
  syncClient,
  userId = "user-a",
}: {
  storage: StorageAdapter;
  syncClient: SyncClient;
  userId?: string | null;
}) {
  currentHook = useLocalSyncMemo(storage, syncClient, userId ?? undefined);
  return null;
}

async function flushEffects(iterations = 8): Promise<void> {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
}

async function renderHook(
  storage: StorageAdapter,
  syncClient: SyncClient,
  userId: string | null = "user-a",
): Promise<HookValue> {
  await act(async () => {
    renderer = create(
      <Harness storage={storage} syncClient={syncClient} userId={userId} />,
    );
    await flushEffects();
  });

  return currentHook;
}

async function settleInitialSave(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
    await flushEffects();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
  browserStorage = new BrowserStorage();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: vi.fn(),
      clearInterval: (id: number) => globalThis.clearInterval(id),
      clearTimeout: (id: number) => globalThis.clearTimeout(id),
      localStorage: browserStorage,
      removeEventListener: vi.fn(),
      setInterval: (handler: TimerHandler, timeout?: number) =>
        globalThis.setInterval(handler, timeout) as unknown as number,
      setTimeout: (handler: TimerHandler, timeout?: number) =>
        globalThis.setTimeout(handler, timeout) as unknown as number,
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true, platform: "Win32" },
  });

  vi.mocked(getOrCreateDevice).mockResolvedValue(device);
  vi.mocked(getAutostartEnabled).mockResolvedValue({
    enabled: false,
    error: null,
    supported: true,
  });
});

afterEach(async () => {
  if (renderer) {
    await act(async () => {
      renderer?.unmount();
      await flushEffects();
    });
  }
  renderer = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useLocalSyncMemo", () => {
  it("hydrates local data before saving and selects the newest visible note", async () => {
    const trace: string[] = [];
    vi.mocked(getOrCreateDevice).mockImplementation(async () => {
      trace.push("device");
      return device;
    });
    const olderNote = createNote("older", "2026-07-31T00:00:00.000Z");
    const newerNote = createNote("newer", "2026-08-01T00:00:00.000Z");
    const storage = new MemoryStorage(
      { ...createEmptySnapshot(), notes: [olderNote, newerNote] },
      trace,
    );
    const syncClient = new FakeSyncClient(trace);

    const result = await renderHook(storage, syncClient);

    expect(trace.slice(0, 5)).toEqual(["device", "auth", "load", "pull", "save"]);
    expect(result.isReady).toBe(true);
    expect(result.notes.map((note) => note.id)).toEqual(["newer", "older"]);
    expect(result.selectedNoteId).toBe("newer");
    expect(storage.saved[0].devices).toContainEqual(device);
  });

  it("debounces rapid changes and pushes only the latest snapshot", async () => {
    const storage = new MemoryStorage(createEmptySnapshot());
    const syncClient = new FakeSyncClient();
    await renderHook(storage, syncClient);
    await settleInitialSave();
    storage.saved.length = 0;
    syncClient.pushSnapshots.length = 0;

    await act(async () => {
      currentHook.addNote();
    });
    await act(async () => {
      currentHook.addNote();
      await vi.advanceTimersByTimeAsync(399);
    });

    expect(storage.saved).toHaveLength(0);
    expect(syncClient.pushSnapshots).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
      await flushEffects();
    });

    expect(storage.saved).toHaveLength(1);
    expect(syncClient.pushSnapshots).toHaveLength(1);
    expect(syncClient.pushSnapshots[0].notes).toHaveLength(2);
  });

  it("applies realtime snapshots, saves them, and cleans up subscriptions", async () => {
    const storage = new MemoryStorage(createEmptySnapshot());
    const syncClient = new FakeSyncClient();
    await renderHook(storage, syncClient);
    await settleInitialSave();
    storage.saved.length = 0;
    const realtimeSnapshot = {
      ...createEmptySnapshot(),
      notes: [createNote("remote", "2026-08-01T01:00:00.000Z")],
    };

    await act(async () => {
      syncClient.realtimeOptions?.onSnapshot(realtimeSnapshot, syncedStatus);
      await flushEffects();
    });

    expect(currentHook.notes.map((note) => note.id)).toEqual(["remote"]);
    expect(syncClient.realtimeOptions?.getSnapshot().notes[0].id).toBe("remote");
    expect(storage.saved[0].notes[0].id).toBe("remote");

    await act(async () => {
      renderer?.unmount();
      renderer = null;
      await flushEffects();
    });

    expect(syncClient.realtimeUnsubscribeCount).toBe(1);
    expect(syncClient.heartbeatUnsubscribeCount).toBe(1);
  });

  it("runs manual sync in pull, push, save order and applies the pulled snapshot", async () => {
    const trace: string[] = [];
    const storage = new MemoryStorage(createEmptySnapshot(), trace);
    const syncClient = new FakeSyncClient(trace);
    await renderHook(storage, syncClient);
    await settleInitialSave();
    trace.length = 0;
    syncClient.pullSnapshot = {
      ...createEmptySnapshot(),
      notes: [createNote("pulled", "2026-08-01T02:00:00.000Z")],
    };

    await act(async () => {
      await currentHook.manualSync();
      await flushEffects();
    });

    expect(trace.slice(0, 3)).toEqual(["pull", "push", "save"]);
    expect(currentHook.notes[0].id).toBe("pulled");
  });

  it("refreshes active devices immediately and every fifteen seconds", async () => {
    const storage = new MemoryStorage(createEmptySnapshot());
    const syncClient = new FakeSyncClient();
    await renderHook(storage, syncClient);
    const initialCalls = syncClient.activeDeviceCalls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
      await flushEffects();
    });

    expect(initialCalls).toBeGreaterThanOrEqual(1);
    expect(syncClient.activeDeviceCalls.length).toBeGreaterThan(initialCalls);
  });

  it("keeps soft-delete tombstones in the persisted snapshot", async () => {
    const storage = new MemoryStorage(createEmptySnapshot());
    const syncClient = new FakeSyncClient();
    await renderHook(storage, syncClient);
    await settleInitialSave();
    storage.saved.length = 0;

    await act(async () => {
      currentHook.addNote();
      currentHook.addTask("삭제될 작업");
      currentHook.addWorkoutRecord("2026-08-01", "strength", "chest", "press");
      currentHook.addMealRecord("2026-08-01", "meal", 500, 30);
      currentHook.addWeightRecord("2026-08-01", 70);
      await flushEffects();
    });
    const noteId = currentHook.notes[0].id;
    const taskId = currentHook.tasks[0].id;
    const workoutId = currentHook.workoutRecords[0].id;
    const mealId = currentHook.mealRecords[0].id;
    const weightId = currentHook.weightRecords[0].id;

    await act(async () => {
      currentHook.deleteNote(noteId);
      currentHook.deleteTask(taskId);
      currentHook.deleteWorkoutRecord(workoutId);
      currentHook.deleteMealRecord(mealId);
      currentHook.deleteWeightRecord(weightId);
      await vi.advanceTimersByTimeAsync(400);
      await flushEffects();
    });

    expect(currentHook.notes).toHaveLength(0);
    expect(currentHook.tasks).toHaveLength(0);
    expect(currentHook.workoutRecords).toHaveLength(0);
    expect(currentHook.mealRecords).toHaveLength(0);
    expect(currentHook.weightRecords).toHaveLength(0);
    const saved = storage.saved.at(-1);
    expect(saved?.notes[0].deletedAt).not.toBeNull();
    expect(saved?.tasks[0].deletedAt).not.toBeNull();
    expect(saved?.workoutRecords[0].deletedAt).not.toBeNull();
    expect(saved?.mealRecords[0].deletedAt).not.toBeNull();
    expect(saved?.weightRecords[0].deletedAt).not.toBeNull();
  });

  it("binds the signed-in user and keeps that binding after sign-out", async () => {
    browserStorage.setItem(
      "localsyncmemo:supabase-config:v2",
      JSON.stringify({
        version: 2,
        config: {
          supabaseUrl: "https://example.supabase.co",
          supabaseAnonKey: "anon-key",
          boundUserId: "",
        },
      }),
    );
    const storage = new MemoryStorage(createEmptySnapshot());
    const syncClient = new FakeSyncClient();
    await renderHook(storage, syncClient);

    await act(async () => {
      await currentHook.saveSupabaseConfig({
        supabaseUrl: "https://example.supabase.co",
        supabaseAnonKey: "anon-key",
      });
      await currentHook.signIn("user@example.com", "password");
      await flushEffects();
    });

    expect(currentHook.isAuthenticated).toBe(true);
    const boundConfig = JSON.parse(
      browserStorage.getItem("localsyncmemo:supabase-config:v2") ?? "{}",
    ) as { config?: { boundUserId?: string } };
    expect(boundConfig.config?.boundUserId).toBe("user-a");

    await act(async () => {
      await currentHook.signOut();
      await flushEffects();
    });

    expect(currentHook.isAuthenticated).toBe(false);
    const retainedConfig = JSON.parse(
      browserStorage.getItem("localsyncmemo:supabase-config:v2") ?? "{}",
    ) as { config?: { boundUserId?: string } };
    expect(retainedConfig.config?.boundUserId).toBe("user-a");
  });

  it("rehydrates local mode and resumes saving after sign-out", async () => {
    const storage = new MemoryStorage(createEmptySnapshot());
    const syncClient = new FakeSyncClient();
    await renderHook(storage, syncClient, null);
    await settleInitialSave();

    await act(async () => {
      await currentHook.saveSupabaseConfig({
        supabaseUrl: "https://example.supabase.co",
        supabaseAnonKey: "anon-key",
      });
      await flushEffects();
    });
    await act(async () => {
      await currentHook.signIn("user@example.com", "password");
      await flushEffects(16);
    });

    expect(currentHook.isAuthenticated).toBe(true);
    expect(currentHook.isReady).toBe(true);
    storage.saved.length = 0;

    await act(async () => {
      await currentHook.signOut();
      await flushEffects(16);
    });

    expect(currentHook.isAuthenticated).toBe(false);
    expect(currentHook.isReady).toBe(true);

    await act(async () => {
      currentHook.addNote();
      await vi.advanceTimersByTimeAsync(400);
      await flushEffects();
    });

    expect(storage.saved.at(-1)?.notes).toHaveLength(1);
  });

  it("rejects a sign-in that conflicts with the persisted user binding", async () => {
    browserStorage.setItem(
      "localsyncmemo:supabase-config:v2",
      JSON.stringify({
        version: 2,
        config: {
          supabaseUrl: "https://example.supabase.co",
          supabaseAnonKey: "anon-key",
          boundUserId: "user-b",
        },
      }),
    );
    const storage = new MemoryStorage(createEmptySnapshot());
    const syncClient = new FakeSyncClient();
    await renderHook(storage, syncClient);

    await act(async () => {
      await currentHook.saveSupabaseConfig({
        supabaseUrl: "https://example.supabase.co",
        supabaseAnonKey: "anon-key",
      });
      await flushEffects();
    });

    await expect(
      act(async () => {
        await currentHook.signIn("other@example.com", "password");
      }),
    ).rejects.toThrow("다른 계정에 연결되어 있습니다");
    expect(syncClient.trace).toContain("signOut");
    expect(currentHook.isAuthenticated).toBe(false);
  });
});
