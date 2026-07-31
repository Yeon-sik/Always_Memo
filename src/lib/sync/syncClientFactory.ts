import type { RuntimeConfig } from "../config/runtimeConfig";
import { localOnlySyncClient } from "./localOnlySyncClient";
import { createSupabaseSyncClient } from "./supabaseSyncClient";
import type { SyncClient } from "./syncTypes";

// 인증 세션이 없을 때 로컬 저장소에서만 사용하는 비원격 식별자다.
export function getConfiguredUserId(): string {
  return "local-user";
}

// Supabase 환경 변수가 없으면 앱은 자동으로 로컬 전용 동작으로 내려간다.
export function createAppSyncClient(
  config?: Pick<RuntimeConfig, "supabaseUrl" | "supabaseAnonKey">,
): SyncClient {
  const supabaseUrl = config?.supabaseUrl?.trim();
  const supabaseAnonKey = config?.supabaseAnonKey?.trim();

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !supabaseUrl.toLowerCase().startsWith("https://")
  ) {
    return localOnlySyncClient;
  }

  return createSupabaseSyncClient({ supabaseAnonKey, supabaseUrl });
}
