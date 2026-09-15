import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bindSupabaseUser,
  getSupabaseProjectIdentity,
  resolveRuntimeConfig,
  saveSupabaseConfig,
  selectManagedSupabaseConfig,
  type RuntimeConfig,
} from "./runtimeConfig";

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

function managedConfig(
  supabaseUrl: string,
  supabaseAnonKey: string,
  sourcePath = "build environment",
): RuntimeConfig {
  return {
    supabaseUrl,
    supabaseAnonKey,
    boundUserId: "",
    loaded: true,
    sourcePath,
  };
}

function savedConfig(
  supabaseUrl: string,
  supabaseAnonKey: string,
  boundUserId = "user-a",
): RuntimeConfig {
  return {
    supabaseUrl,
    supabaseAnonKey,
    boundUserId,
    loaded: true,
    sourcePath: "local settings",
  };
}

let browserStorage: BrowserStorage;

beforeEach(() => {
  browserStorage = new BrowserStorage();
  vi.stubGlobal("window", { localStorage: browserStorage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runtime Supabase config precedence", () => {
  it("prefers complete build-managed config over runtime and manual config", () => {
    const buildConfig = managedConfig(
      "https://build-project.supabase.co",
      "build-anon-key",
    );
    const runtimeConfig = managedConfig(
      "https://runtime-project.supabase.co",
      "runtime-anon-key",
      "C:\\runtime\\supabase.env",
    );
    const manualConfig = savedConfig(
      "https://manual-project.supabase.co",
      "manual-anon-key",
    );

    expect(selectManagedSupabaseConfig(buildConfig, runtimeConfig)).toEqual(
      buildConfig,
    );
    expect(resolveRuntimeConfig(buildConfig, runtimeConfig, manualConfig)).toEqual(
      buildConfig,
    );
  });

  it("falls back to a complete Tauri runtime config when build config is incomplete", () => {
    const buildConfig = managedConfig(
      "https://build-project.supabase.co",
      "",
    );
    const runtimeConfig = managedConfig(
      "https://runtime-project.supabase.co",
      "runtime-anon-key",
      "C:\\runtime\\supabase.env",
    );
    const manualConfig = savedConfig(
      "https://manual-project.supabase.co",
      "manual-anon-key",
    );

    expect(selectManagedSupabaseConfig(buildConfig, runtimeConfig)).toEqual(
      runtimeConfig,
    );
    expect(resolveRuntimeConfig(buildConfig, runtimeConfig, manualConfig)).toEqual(
      runtimeConfig,
    );
  });

  it("uses manual config when managed config is incomplete", () => {
    const incompleteManagedConfig = managedConfig(
      "https://managed-project.supabase.co",
      "",
    );
    const manualConfig = savedConfig(
      "https://manual-project.supabase.co",
      "manual-anon-key",
    );

    expect(resolveRuntimeConfig(incompleteManagedConfig, manualConfig)).toEqual(
      manualConfig,
    );
  });

  it("uses project identity instead of anon key for binding continuity", () => {
    const managed = managedConfig(
      "https://PROJECT-REF.supabase.co/",
      "rotated-anon-key",
    );
    const saved = savedConfig(
      "https://project-ref.supabase.co",
      "previous-anon-key",
      "user-a",
    );

    expect(getSupabaseProjectIdentity(managed.supabaseUrl)).toBe(
      getSupabaseProjectIdentity(saved.supabaseUrl),
    );
    expect(resolveRuntimeConfig(managed, saved)).toEqual({
      ...managed,
      boundUserId: "user-a",
    });
  });

  it("removes a binding when the managed project changes", () => {
    const managed = managedConfig(
      "https://new-project.supabase.co",
      "new-anon-key",
    );
    const saved = savedConfig(
      "https://old-project.supabase.co",
      "old-anon-key",
      "user-a",
    );

    expect(resolveRuntimeConfig(managed, saved)).toEqual(managed);
  });
});

describe("Supabase config persistence guards", () => {
  it("blocks local URL/key writes while managed config is active", () => {
    const storageKey = "localsyncmemo:supabase-config:v2";
    const existingValue = JSON.stringify({
      version: 2,
      config: {
        supabaseUrl: "https://old-project.supabase.co",
        supabaseAnonKey: "old-anon-key",
        boundUserId: "user-a",
      },
    });
    browserStorage.setItem(storageKey, existingValue);

    expect(() =>
      saveSupabaseConfig(
        {
          supabaseUrl: "https://manual-project.supabase.co",
          supabaseAnonKey: "manual-anon-key",
        },
        managedConfig("https://managed-project.supabase.co", "managed-key"),
      ),
    ).toThrow("앱에서 관리되는 Supabase 연결");
    expect(browserStorage.getItem(storageKey)).toBe(existingValue);
  });

  it("binds the active managed project even when saved config is stale", () => {
    browserStorage.setItem(
      "localsyncmemo:supabase-config:v2",
      JSON.stringify({
        version: 2,
        config: {
          supabaseUrl: "https://old-project.supabase.co",
          supabaseAnonKey: "old-anon-key",
          boundUserId: "old-user",
        },
      }),
    );
    const managed = managedConfig(
      "https://managed-project.supabase.co",
      "managed-key",
    );

    expect(bindSupabaseUser("new-user", managed)).toEqual({
      ...managed,
      boundUserId: "new-user",
    });
  });

  it("keeps a manual binding for a key rotation but drops it for another project", () => {
    browserStorage.setItem(
      "localsyncmemo:supabase-config:v2",
      JSON.stringify({
        version: 2,
        config: {
          supabaseUrl: "https://project-ref.supabase.co",
          supabaseAnonKey: "previous-anon-key",
          boundUserId: "user-a",
        },
      }),
    );

    expect(
      saveSupabaseConfig({
        supabaseUrl: "https://project-ref.supabase.co/",
        supabaseAnonKey: "rotated-anon-key",
      }).boundUserId,
    ).toBe("user-a");

    expect(
      saveSupabaseConfig({
        supabaseUrl: "https://another-project.supabase.co",
        supabaseAnonKey: "another-anon-key",
      }).boundUserId,
    ).toBe("");
  });
});
