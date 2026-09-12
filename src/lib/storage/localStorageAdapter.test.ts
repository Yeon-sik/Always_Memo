import { beforeEach, describe, expect, it } from "vitest";

import type { LocalDataSnapshot } from "../../types";
import { LocalStorageAdapter } from "./localStorageAdapter";
import { createEmptySnapshot } from "./storageAdapter";

const STORAGE_KEY = "localsyncmemo:snapshot:v1";

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

let browserStorage: BrowserStorage;

beforeEach(() => {
  browserStorage = new BrowserStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: browserStorage },
  });
});

describe("LocalStorageAdapter", () => {
  it("normalizes legacy snapshots without losing sync audit fields", async () => {
    const updatedAt = "2026-07-31T10:00:00.000Z";
    browserStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        notes: [
          {
            id: "note-1",
            title: "legacy",
            content: "content",
            updatedAt,
            deletedAt: null,
            deviceId: "device-a",
          },
        ],
        tasks: [
          {
            id: "task-1",
            text: "legacy task",
            isDone: false,
            orderIndex: 0,
            updatedAt,
            deletedAt: null,
            deviceId: "device-a",
          },
        ],
        workoutRecords: [
          {
            id: "workout-1",
            date: "2026-07-31",
            workoutType: "cardio",
            category: "run",
            exerciseName: "running",
            durationMinutes: 30,
            updatedAt,
            deletedAt: null,
            deviceId: "device-a",
          },
        ],
        mealRecords: [],
        weightRecords: [],
        devices: [],
      }),
    );

    const snapshot = await new LocalStorageAdapter().load();

    expect(snapshot.notes[0]).toMatchObject({
      createdAt: updatedAt,
      isBackfilled: false,
      backfilledAt: null,
      backfillReason: null,
    });
    expect(snapshot.tasks[0]).toMatchObject({
      dueDate: null,
      dueTime: null,
      plannedDate: null,
    });
    expect(snapshot.workoutRecords[0]).toMatchObject({
      durationSeconds: 1_800,
      averageHeartRate: null,
      sourceApp: "os",
      scope: "both",
      metadata: {},
    });
  });

  it("keeps URL-only Project rows readable and adds nullable GitHub identity fields", async () => {
    const updatedAt = "2026-07-31T10:00:00.000Z";
    browserStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projects: [
          {
            id: "project-legacy",
            name: "Legacy project",
            repository: "https://github.com/octo/repo",
            branch: "develop",
            status: "PLANNED",
            currentSummary: "current",
            targetSummary: "target",
            lastVerifiedCommit: "old-sha",
            lastVerifiedAt: "2026-07-30T00:00:00.000Z",
            updatedAt,
            deletedAt: null,
            deviceId: "device-a",
          },
        ],
      }),
    );

    const snapshot = await new LocalStorageAdapter().load();

    expect(snapshot.projects[0]).toMatchObject({
      repository: "https://github.com/octo/repo",
      branch: "develop",
      githubRepositoryId: null,
      githubOwner: null,
      githubRepo: null,
      lastVerifiedCommit: "old-sha",
    });
  });

  it("drops partial GitHub identity values while loading a snapshot", async () => {
    const updatedAt = "2026-07-31T10:00:00.000Z";
    browserStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projects: [
          {
            id: "project-partial",
            name: "Partial project",
            repository: null,
            branch: null,
            githubRepositoryId: "42",
            githubOwner: "octo",
            githubRepo: null,
            status: "PLANNED",
            currentSummary: "current",
            targetSummary: "target",
            lastVerifiedCommit: null,
            lastVerifiedAt: null,
            updatedAt,
            deletedAt: null,
            deviceId: "device-a",
          },
        ],
      }),
    );

    const snapshot = await new LocalStorageAdapter().load();

    expect(snapshot.projects[0]).toMatchObject({
      githubRepositoryId: null,
      githubOwner: null,
      githubRepo: null,
    });
  });

  it("writes the versioned envelope and restores it", async () => {
    const adapter = new LocalStorageAdapter();
    const snapshot: LocalDataSnapshot = {
      ...createEmptySnapshot(),
      devices: [
        {
          id: "device-a",
          name: "Desktop",
          lastSeenAt: "2026-08-01T00:00:00.000Z",
          appVersion: null,
        },
      ],
    };

    await adapter.save(snapshot);

    const stored = JSON.parse(browserStorage.getItem(STORAGE_KEY) ?? "{}") as {
      version?: number;
      snapshot?: LocalDataSnapshot;
    };
    expect(stored.version).toBe(1);
    expect(stored.snapshot).toEqual(snapshot);
    expect(await adapter.load()).toEqual(snapshot);
  });

  it("reports corrupt JSON instead of silently replacing user data", async () => {
    browserStorage.setItem(STORAGE_KEY, "{not-json");

    await expect(new LocalStorageAdapter().load()).rejects.toThrow(
      "저장된 로컬 데이터를 읽을 수 없습니다.",
    );
  });
});
