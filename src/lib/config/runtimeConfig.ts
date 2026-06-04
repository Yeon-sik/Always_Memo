export interface RuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  userId: string;
  loaded: boolean;
  sourcePath: string | null;
}

export type SupabaseConfigInput = Pick<
  RuntimeConfig,
  "supabaseUrl" | "supabaseAnonKey" | "userId"
>;

const SUPABASE_CONFIG_STORAGE_KEY = "localsyncmemo:supabase-config:v1";
const LOCAL_SETTINGS_SOURCE = "local settings";

interface StoredSupabaseConfigEnvelope {
  version: 1;
  config: SupabaseConfigInput;
}

export const emptyRuntimeConfig: RuntimeConfig = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  userId: "",
  loaded: false,
  sourcePath: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeSupabaseConfigInput(
  value: Partial<SupabaseConfigInput> | null,
): SupabaseConfigInput {
  return {
    supabaseUrl: value?.supabaseUrl?.trim() ?? "",
    supabaseAnonKey: value?.supabaseAnonKey?.trim() ?? "",
    userId: value?.userId?.trim() ?? "",
  };
}

function normalizeRuntimeConfig(value: Partial<RuntimeConfig> | null): RuntimeConfig {
  const config = normalizeSupabaseConfigInput(value);

  return {
    ...config,
    loaded: Boolean(value?.loaded),
    sourcePath: value?.sourcePath ?? null,
  };
}

function toLocalSettingsRuntimeConfig(
  value: Partial<SupabaseConfigInput> | null,
): RuntimeConfig {
  return {
    ...normalizeSupabaseConfigInput(value),
    loaded: true,
    sourcePath: LOCAL_SETTINGS_SOURCE,
  };
}

function getBrowserLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function loadSavedSupabaseConfig(): RuntimeConfig | null {
  const storage = getBrowserLocalStorage();

  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(SUPABASE_CONFIG_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (isRecord(parsed) && parsed.version === 1 && isRecord(parsed.config)) {
      return toLocalSettingsRuntimeConfig(parsed.config);
    }

    if (isRecord(parsed)) {
      return toLocalSettingsRuntimeConfig(parsed);
    }
  } catch {
    return null;
  }

  return null;
}

export function saveSupabaseConfig(
  config: SupabaseConfigInput,
): RuntimeConfig {
  const storage = getBrowserLocalStorage();
  const savedConfig = toLocalSettingsRuntimeConfig(config);

  if (!storage) {
    return savedConfig;
  }

  const envelope: StoredSupabaseConfigEnvelope = {
    version: 1,
    config: normalizeSupabaseConfigInput(config),
  };

  storage.setItem(SUPABASE_CONFIG_STORAGE_KEY, JSON.stringify(envelope));

  return savedConfig;
}

async function loadRuntimeEnvConfig(): Promise<RuntimeConfig> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const config = await invoke<Partial<RuntimeConfig>>("load_runtime_config");

    return normalizeRuntimeConfig(config);
  } catch {
    return emptyRuntimeConfig;
  }
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const savedConfig = loadSavedSupabaseConfig();

  if (savedConfig) {
    return savedConfig;
  }

  return loadRuntimeEnvConfig();
}
