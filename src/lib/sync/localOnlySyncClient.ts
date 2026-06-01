import type { Device, LocalDataSnapshot } from "../../types";
import type {
  RealtimeOptions,
  RealtimeSubscription,
  SyncClient,
  SyncContext,
  SyncResult,
  SyncStatus,
} from "./syncTypes";

// 로컬 전용 상태에서도 온라인 여부는 UI 표시용으로만 확인한다.
function getOnlineState(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return navigator.onLine;
}

// Supabase 설정이 없을 때 사용하는 no-op 동기화 클라이언트다.
// 앱의 로컬 저장/편집 흐름은 그대로 유지된다.
export class LocalOnlySyncClient implements SyncClient {
  getStatus(): SyncStatus {
    const isOnline = getOnlineState();

    return {
      mode: "local-only",
      label: "로컬 전용",
      detail: isOnline
        ? "Supabase 동기화는 아직 연결되지 않았습니다."
        : "오프라인에서도 로컬 자동 저장은 계속됩니다.",
      isOnline,
      lastSyncedAt: null,
      isConfigured: false,
    };
  }

  isConfigured(): boolean {
    return false;
  }

  async pull(
    localSnapshot: LocalDataSnapshot,
    _context: SyncContext,
  ): Promise<LocalDataSnapshot> {
    return localSnapshot;
  }

  async push(
    _localSnapshot: LocalDataSnapshot,
    _context: SyncContext,
  ): Promise<SyncResult> {
    return {
      status: this.getStatus(),
      changedRows: 0,
    };
  }

  subscribeRealtime(_options: RealtimeOptions): RealtimeSubscription {
    return {
      unsubscribe: () => undefined,
    };
  }

  startHeartbeat(_context: SyncContext): RealtimeSubscription {
    return {
      unsubscribe: () => undefined,
    };
  }

  async getActiveDevices(
    _context: SyncContext,
    fallbackDevices: Device[],
  ): Promise<Device[]> {
    // 원격 heartbeat가 없으므로 로컬 스냅샷 안의 최근 기기만 활성으로 본다.
    const cutoff = Date.now() - 45_000;

    return fallbackDevices
      .filter((device) => Date.parse(device.lastSeenAt) >= cutoff)
      .sort((first, second) =>
        second.lastSeenAt.localeCompare(first.lastSeenAt),
      );
  }
}

export const localOnlySyncClient = new LocalOnlySyncClient();
