export interface RuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  userId: string;
  loaded: boolean;
  sourcePath: string | null;
}

export const emptyRuntimeConfig: RuntimeConfig = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  userId: "",
  loaded: false,
  sourcePath: null,
};

function normalizeRuntimeConfig(value: Partial<RuntimeConfig> | null): RuntimeConfig {
  return {
    supabaseUrl: value?.supabaseUrl?.trim() ?? "",
    supabaseAnonKey: value?.supabaseAnonKey?.trim() ?? "",
    userId: value?.userId?.trim() ?? "",
    loaded: Boolean(value?.loaded),
    sourcePath: value?.sourcePath ?? null,
  };
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const config = await invoke<Partial<RuntimeConfig>>("load_runtime_config");

    return normalizeRuntimeConfig(config);
  } catch {
    return emptyRuntimeConfig;
  }
}
