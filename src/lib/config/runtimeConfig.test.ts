import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bindSupabaseUser,
  resolveRuntimeConfig,
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

const managedConfig: RuntimeConfig = {
  supabaseUrl: "https://shared.supabase.co",
  supabaseAnonKey: "shared-anon-key",
  boundUserId: "",
  loaded: true,
  sourcePath: "build environment",
};

let browserStorage: BrowserStorage;

beforeEach(() => {
  browserStorage = new BrowserStorage();
  vi.stubGlobal("window", { localStorage: browserStorage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runtime Supabase config precedence", () => {
  it("keeps a saved account binding when the managed connection matches", () => {
    const savedConfig: RuntimeConfig = {
      ...managedConfig,
      boundUserId: "user-a",
      sourcePath: "local settings",
    };

    expect(resolveRuntimeConfig(managedConfig, savedConfig)).toEqual({
      ...managedConfig,
      boundUserId: "user-a",
    });
  });

  it("does not carry a binding from a different saved connection", () => {
    const savedConfig: RuntimeConfig = {
      supabaseUrl: "https://old.supabase.co",
      supabaseAnonKey: "old-anon-key",
      boundUserId: "old-user",
      loaded: true,
      sourcePath: "local settings",
    };

    expect(resolveRuntimeConfig(managedConfig, savedConfig)).toEqual(
      managedConfig,
    );
  });

  it("uses the saved manual config only when managed config is incomplete", () => {
    const incompleteManagedConfig: RuntimeConfig = {
      ...managedConfig,
      supabaseAnonKey: "",
    };
    const savedConfig: RuntimeConfig = {
      supabaseUrl: "https://fallback.supabase.co",
      supabaseAnonKey: "fallback-anon-key",
      boundUserId: "user-a",
      loaded: true,
      sourcePath: "local settings",
    };

    expect(resolveRuntimeConfig(incompleteManagedConfig, savedConfig)).toBe(
      savedConfig,
    );
  });

  it("binds the active managed connection instead of a stale saved config", () => {
    browserStorage.setItem(
      "localsyncmemo:supabase-config:v2",
      JSON.stringify({
        version: 2,
        config: {
          supabaseUrl: "https://old.supabase.co",
          supabaseAnonKey: "old-anon-key",
          boundUserId: "old-user",
        },
      }),
    );

    const boundConfig = bindSupabaseUser("shared-user", managedConfig);
    const persisted = JSON.parse(
      browserStorage.getItem("localsyncmemo:supabase-config:v2") ?? "{}",
    ) as {
      config?: {
        supabaseUrl?: string;
        supabaseAnonKey?: string;
        boundUserId?: string;
      };
    };

    expect(boundConfig).toEqual({
      ...managedConfig,
      boundUserId: "shared-user",
    });
    expect(persisted.config).toEqual({
      supabaseUrl: managedConfig.supabaseUrl,
      supabaseAnonKey: managedConfig.supabaseAnonKey,
      boundUserId: "shared-user",
    });
  });
});
