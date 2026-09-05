import { describe, expect, it, vi } from "vitest";
import {
  SupabaseSyncClient,
  createSupabaseSyncClient,
} from "./supabaseSyncClient";
import type { SupabaseClient } from "./supabase/rows";
import { makeDevice, makeSnapshot } from "./supabase/testFixtures";

interface FakeClientOptions {
  userId?: string | null;
  sessionError?: Error | null;
  selectError?: Error | null;
}

function createFakeClient({
  userId = null,
  sessionError = null,
  selectError = null,
}: FakeClientOptions = {}) {
  const select = vi.fn(() => ({
    eq: vi.fn(async () => ({ data: [], error: selectError })),
  }));
  const table = {
    select,
    upsert: vi.fn(async () => ({ error: null })),
  };
  const session = userId
    ? { user: { id: userId, email: `${userId}@example.com` } }
    : null;
  const client = {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(async () => ({
        data: { session },
        error: sessionError,
      })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn(() => table),
  };

  return {
    client: client as unknown as SupabaseClient,
    select,
    auth: client.auth,
  };
}

function createConfiguredClient(
  fakeClient: SupabaseClient,
  getOnlineState: () => boolean,
): SupabaseSyncClient {
  return new SupabaseSyncClient({
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon-key",
    dependencies: {
      createClient: () => fakeClient,
      getOnlineState,
      now: () => new Date("2026-08-01T00:00:00.000Z"),
    },
  });
}

describe("SupabaseSyncClient facade", () => {
  it("preserves the public factory and local-only behavior", async () => {
    const client = createSupabaseSyncClient();
    const snapshot = makeSnapshot();

    expect(client).toBeInstanceOf(SupabaseSyncClient);
    expect(client.isConfigured()).toBe(false);
    await expect(client.getAuthState()).resolves.toEqual({
      userId: null,
      email: null,
    });
    await expect(client.signIn("user@example.com", "password")).rejects.toThrow(
      "Supabase 연결 설정을 먼저 저장하세요.",
    );
    await expect(
      client.pull(snapshot, { userId: "user-1", device: makeDevice() }),
    ).resolves.toBe(snapshot);
    expect(client.getStatus().mode).toBe("local-only");
  });

  it("does not query remote tables for an unauthenticated user", async () => {
    const fake = createFakeClient();
    const client = createConfiguredClient(fake.client, () => true);
    const snapshot = makeSnapshot();

    await expect(
      client.pull(snapshot, { userId: "user-1", device: makeDevice() }),
    ).resolves.toBe(snapshot);
    expect(fake.select).not.toHaveBeenCalled();
    expect(client.getStatus()).toMatchObject({
      mode: "offline",
      detail: "원격 동기화를 사용하려면 로그인하세요.",
    });
  });

  it("does not query remote tables while offline even with a session", async () => {
    const fake = createFakeClient({ userId: "user-1" });
    const client = createConfiguredClient(fake.client, () => false);
    const snapshot = makeSnapshot();

    await expect(
      client.push(snapshot, { userId: "user-1", device: makeDevice() }),
    ).resolves.toMatchObject({ changedRows: 0, status: { mode: "offline" } });
    expect(fake.select).not.toHaveBeenCalled();
  });

  it("keeps the local snapshot and exposes a query error status", async () => {
    const queryError = new Error("RLS denied");
    const fake = createFakeClient({
      userId: "user-1",
      selectError: queryError,
    });
    const client = createConfiguredClient(fake.client, () => true);
    const snapshot = makeSnapshot();

    await expect(
      client.pull(snapshot, { userId: "user-1", device: makeDevice() }),
    ).resolves.toBe(snapshot);
    expect(fake.select).toHaveBeenCalledTimes(7);
    expect(client.getStatus()).toMatchObject({
      mode: "error",
      detail: "RLS denied",
    });
  });

  it("propagates auth session errors before remote IO", async () => {
    const sessionError = new Error("session storage unavailable");
    const fake = createFakeClient({ sessionError });
    const client = createConfiguredClient(fake.client, () => true);

    await expect(
      client.pull(makeSnapshot(), {
        userId: "user-1",
        device: makeDevice(),
      }),
    ).rejects.toBe(sessionError);
    expect(fake.select).not.toHaveBeenCalled();
  });
});
