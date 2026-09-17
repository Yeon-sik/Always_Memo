export interface RuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  boundUserId: string;
  loaded: boolean;
  sourcePath: string | null;
}

export type SupabaseConfigInput = Pick<
  RuntimeConfig,
  "supabaseUrl" | "supabaseAnonKey"
>;

const SUPABASE_CONFIG_STORAGE_KEY = "localsyncmemo:supabase-config:v2";
const LEGACY_SUPABASE_CONFIG_STORAGE_KEY = "localsyncmemo:supabase-config:v1";
const LOCAL_SETTINGS_SOURCE = "local settings";
const BUILD_ENV_SOURCE = "build environment";

interface StoredSupabaseConfigEnvelope {
  version: 2;
  config: SupabaseConfigInput & { boundUserId: string };
}

export const emptyRuntimeConfig: RuntimeConfig = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  boundUserId: "",
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
  };
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeRuntimeConfig(value: Partial<RuntimeConfig> | null): RuntimeConfig {
  const config = normalizeSupabaseConfigInput(value);

  return {
    ...config,
    boundUserId: value?.boundUserId?.trim() ?? "",
    loaded: Boolean(value?.loaded),
    sourcePath: value?.sourcePath ?? null,
  };
}

function toLocalSettingsRuntimeConfig(
  value: (Partial<SupabaseConfigInput> & { boundUserId?: string }) | null,
): RuntimeConfig {
  return {
    ...normalizeSupabaseConfigInput(value),
    boundUserId: value?.boundUserId?.trim() ?? "",
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

  const rawValue =
    storage.getItem(SUPABASE_CONFIG_STORAGE_KEY) ??
    storage.getItem(LEGACY_SUPABASE_CONFIG_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (
      isRecord(parsed) &&
      (parsed.version === 1 || parsed.version === 2) &&
      isRecord(parsed.config)
    ) {
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
  activeRuntimeConfig?: RuntimeConfig | null,
): RuntimeConfig {
  if (activeRuntimeConfig && isManagedSupabaseConfig(activeRuntimeConfig)) {
    throw new Error("앱에서 관리되는 Supabase 연결은 설정 화면에서 변경할 수 없습니다.");
  }

  const normalizedConfig = normalizeSupabaseConfigInput(config);
  if (normalizedConfig.supabaseUrl) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalizedConfig.supabaseUrl);
    } catch {
      throw new Error("올바른 Supabase URL을 입력하세요.");
    }
    if (parsedUrl.protocol !== "https:") {
      throw new Error("Supabase URL은 HTTPS여야 합니다.");
    }
  }
  const storage = getBrowserLocalStorage();
  const current = loadSavedSupabaseConfig();
  const boundUserId =
    current && isSameSupabaseBackend(current, normalizedConfig)
      ? current.boundUserId
      : "";
  const savedConfig = toLocalSettingsRuntimeConfig({
    ...normalizedConfig,
    boundUserId,
  });

  if (!storage) {
    return savedConfig;
  }

  const envelope: StoredSupabaseConfigEnvelope = {
    version: 2,
    config: {
      ...normalizedConfig,
      boundUserId: savedConfig.boundUserId,
    },
  };

  storage.setItem(SUPABASE_CONFIG_STORAGE_KEY, JSON.stringify(envelope));
  storage.removeItem(LEGACY_SUPABASE_CONFIG_STORAGE_KEY);

  return savedConfig;
}

export function isCompleteSupabaseConfig(
  config: Pick<RuntimeConfig, "supabaseUrl" | "supabaseAnonKey">,
): boolean {
  const normalizedConfig = normalizeSupabaseConfigInput(config);
  return Boolean(
    normalizedConfig.supabaseUrl &&
      normalizedConfig.supabaseAnonKey &&
      isHttpsUrl(normalizedConfig.supabaseUrl),
  );
}

export function isManagedSupabaseConfig(
  config: Pick<RuntimeConfig, "supabaseUrl" | "supabaseAnonKey"> &
  Partial<Pick<RuntimeConfig, "loaded" | "sourcePath">>,
): boolean {
  return (
    config.loaded === true &&
    config.sourcePath !== LOCAL_SETTINGS_SOURCE &&
    isCompleteSupabaseConfig(config)
  );
}

export function getSupabaseProjectIdentity(
  supabaseUrl: string,
): string | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(supabaseUrl.trim());
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "https:") {
    return null;
  }

  const hostname = parsedUrl.hostname.toLowerCase().replace(/\.$/, "");
  const supabaseHostSuffix = ".supabase.co";
  const projectRef = hostname.endsWith(supabaseHostSuffix)
    ? hostname.slice(0, -supabaseHostSuffix.length)
    : "";

  if (/^[a-z0-9][a-z0-9-]*$/.test(projectRef)) {
    return `ref:${projectRef}`;
  }

  return `url:${parsedUrl.origin.toLowerCase()}`;
}

export function isSameSupabaseBackend(
  left: Pick<RuntimeConfig, "supabaseUrl" | "supabaseAnonKey">,
  right: Pick<RuntimeConfig, "supabaseUrl" | "supabaseAnonKey">,
): boolean {
  const leftIdentity = getSupabaseProjectIdentity(left.supabaseUrl);
  const rightIdentity = getSupabaseProjectIdentity(right.supabaseUrl);

  return leftIdentity !== null && leftIdentity === rightIdentity;
}

export function bindSupabaseUser(
  userId: string,
  activeConfig?: RuntimeConfig | SupabaseConfigInput,
): RuntimeConfig {
  const savedConfig = loadSavedSupabaseConfig();
  const current =
    activeConfig && isCompleteSupabaseConfig(activeConfig)
      ? activeConfig
      : savedConfig;
  if (!current || !isCompleteSupabaseConfig(current)) {
    throw new Error("Supabase 연결 설정을 먼저 저장하세요.");
  }
  const nextConfig = isManagedSupabaseConfig(current)
    ? normalizeRuntimeConfig({ ...current, boundUserId: userId })
    : toLocalSettingsRuntimeConfig({
        supabaseUrl: current.supabaseUrl,
        supabaseAnonKey: current.supabaseAnonKey,
        boundUserId: userId,
      });
  const storage = getBrowserLocalStorage();
  if (storage) {
    const envelope = {
      version: 2 as const,
      config: {
        supabaseUrl: nextConfig.supabaseUrl,
        supabaseAnonKey: nextConfig.supabaseAnonKey,
        boundUserId: nextConfig.boundUserId,
      },
    };
    storage.setItem(SUPABASE_CONFIG_STORAGE_KEY, JSON.stringify(envelope));
  }
  return nextConfig;
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

function loadBuildEnvConfig(): RuntimeConfig {
  const config = normalizeRuntimeConfig({
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    loaded: true,
    sourcePath: BUILD_ENV_SOURCE,
  });

  return isCompleteSupabaseConfig(config) ? config : emptyRuntimeConfig;
}

export function selectManagedSupabaseConfig(
  buildConfig: RuntimeConfig,
  runtimeConfig: RuntimeConfig,
): RuntimeConfig {
  if (isCompleteSupabaseConfig(buildConfig)) {
    return buildConfig;
  }

  if (isCompleteSupabaseConfig(runtimeConfig)) {
    return runtimeConfig;
  }

  return emptyRuntimeConfig;
}

function resolveSelectedRuntimeConfig(
  managedConfig: RuntimeConfig,
  savedConfig: RuntimeConfig | null,
): RuntimeConfig {
  if (!isCompleteSupabaseConfig(managedConfig)) {
    return savedConfig ?? managedConfig;
  }

  return {
    ...managedConfig,
    boundUserId:
      savedConfig && isSameSupabaseBackend(managedConfig, savedConfig)
        ? savedConfig.boundUserId
        : "",
  };
}

export function resolveRuntimeConfig(
  managedConfig: RuntimeConfig,
  savedConfig: RuntimeConfig | null,
): RuntimeConfig;
export function resolveRuntimeConfig(
  buildConfig: RuntimeConfig,
  runtimeConfig: RuntimeConfig,
  savedConfig: RuntimeConfig | null,
): RuntimeConfig;
export function resolveRuntimeConfig(
  buildOrManagedConfig: RuntimeConfig,
  runtimeOrSavedConfig: RuntimeConfig | null,
  savedConfig?: RuntimeConfig | null,
): RuntimeConfig {
  if (savedConfig !== undefined) {
    return resolveSelectedRuntimeConfig(
      selectManagedSupabaseConfig(
        buildOrManagedConfig,
        runtimeOrSavedConfig ?? emptyRuntimeConfig,
      ),
      savedConfig,
    );
  }

  return resolveSelectedRuntimeConfig(
    buildOrManagedConfig,
    runtimeOrSavedConfig,
  );
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const buildConfig = loadBuildEnvConfig();
  const savedConfig = loadSavedSupabaseConfig();

  if (isCompleteSupabaseConfig(buildConfig)) {
    return resolveRuntimeConfig(buildConfig, savedConfig);
  }

  const runtimeConfig = await loadRuntimeEnvConfig();

  return resolveRuntimeConfig(buildConfig, runtimeConfig, savedConfig);
}
