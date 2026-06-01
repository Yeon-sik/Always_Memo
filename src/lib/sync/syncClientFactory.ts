import { localOnlySyncClient } from "./localOnlySyncClient";
import { createSupabaseSyncClient } from "./supabaseSyncClient";
import type { SyncClient } from "./syncTypes";

// 개발 초기 단일 사용자 모드에서 두 기기는 같은 VITE_USER_ID를 공유해야 한다.
export function getConfiguredUserId(): string {
  return import.meta.env.VITE_USER_ID?.trim() || "local-user";
}

// Supabase 환경 변수가 없으면 앱은 자동으로 로컬 전용 동작으로 내려간다.
export function createAppSyncClient(): SyncClient {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return localOnlySyncClient;
  }

  return createSupabaseSyncClient();
}
