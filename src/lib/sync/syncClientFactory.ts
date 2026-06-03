import type { RuntimeConfig } from "../config/runtimeConfig";
import { localOnlySyncClient } from "./localOnlySyncClient";
import { createSupabaseSyncClient } from "./supabaseSyncClient";
import type { SyncClient } from "./syncTypes";

// 개발 초기 단일 사용자 모드에서 두 기기는 같은 USER_ID를 공유해야 한다.
export function getConfiguredUserId(config?: Pick<RuntimeConfig, "userId">): string {
  return config?.userId?.trim() || "local-user";
}

// Supabase 환경 변수가 없으면 앱은 자동으로 로컬 전용 동작으로 내려간다.
export function createAppSyncClient(
  config?: Pick<RuntimeConfig, "supabaseUrl" | "supabaseAnonKey">,
): SyncClient {
  const supabaseUrl = config?.supabaseUrl?.trim();
  const supabaseAnonKey = config?.supabaseAnonKey?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return localOnlySyncClient;
  }

  return createSupabaseSyncClient({ supabaseAnonKey, supabaseUrl });
}
