import { createClient } from "@supabase/supabase-js";
import type { Device, LocalDataSnapshot } from "../../types";
import { mergeDevices } from "./merge";
import {
  createSupabaseFinanceSummaryTransport,
  fetchFinanceDailySummaries,
  type FinanceSummaryTransport,
} from "./supabase/financeSummary";
import {
  ACTIVE_DEVICE_WINDOW_MS,
  createSupabasePresenceTransport,
  filterActiveDevices,
  loadActiveDevices,
  startDeviceHeartbeat,
  type PresenceTransport,
} from "./supabase/presence";
import {
  createSupabaseRealtimeTransport,
  getRealtimeDetail,
  subscribeSnapshotRealtime,
  type RealtimeTransport,
} from "./supabase/realtime";
import type { Database, SupabaseClient } from "./supabase/rows";
import {
  createSupabaseSnapshotTransport,
  pullSnapshot,
  pushSnapshot,
  type SnapshotTransport,
} from "./supabase/snapshotIo";
import type {
  AuthState,
  FinanceDailySummary,
  RealtimeOptions,
  RealtimeSubscription,
  SyncClient,
  SyncContext,
  SyncResult,
  SyncStatus,
} from "./syncTypes";

type SupabaseClientFactory = (
  supabaseUrl: string,
  supabaseAnonKey: string,
) => SupabaseClient;

export interface SupabaseSyncClientDependencies {
  createClient?: SupabaseClientFactory;
  getOnlineState?: () => boolean;
  now?: () => Date;
}

export interface SupabaseSyncClientOptions {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  dependencies?: SupabaseSyncClientDependencies;
}

function getBrowserOnlineState(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return navigator.onLine;
}

function createConfiguredStatus(
  mode: SyncStatus["mode"],
  detail: string,
  lastSyncedAt: string | null,
  isOnline: boolean,
): SyncStatus {
  const labels: Record<SyncStatus["mode"], string> = {
    offline: "offline",
    syncing: "syncing",
    synced: "synced",
    error: "error",
    "local-only": "local-only",
  };

  return {
    mode,
    label: labels[mode],
    detail,
    isOnline,
    lastSyncedAt,
    isConfigured: true,
  };
}

function createLocalOnlyStatus(isOnline: boolean): SyncStatus {
  return {
    mode: "local-only",
    label: "local-only",
    detail: "Supabase 환경 변수가 설정되지 않아 로컬 모드로 실행 중입니다.",
    isOnline,
    lastSyncedAt: null,
    isConfigured: false,
  };
}

function toErrorMessage(caughtError: unknown): string {
  if (caughtError instanceof Error) {
    return caughtError.message;
  }

  return "Supabase 동기화 중 오류가 발생했습니다.";
}

function createDefaultSupabaseClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
): SupabaseClient {
  return createClient<Database, "public">(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }) as SupabaseClient;
}

function noOpSubscription(): RealtimeSubscription {
  return { unsubscribe: () => undefined };
}

// Public facade: auth and sync status stay here; transport-specific work lives
// under ./supabase so it can be tested without a live project.
export class SupabaseSyncClient implements SyncClient {
  private readonly supabase: SupabaseClient | null;
  private readonly snapshotTransport: SnapshotTransport | null;
  private readonly realtimeTransport: RealtimeTransport | null;
  private readonly presenceTransport: PresenceTransport | null;
  private readonly financeTransport: FinanceSummaryTransport | null;
  private readonly getOnlineState: () => boolean;
  private readonly now: () => Date;
  private authenticatedUserId: string | null = null;
  private status: SyncStatus;

  constructor({
    supabaseUrl,
    supabaseAnonKey,
    dependencies = {},
  }: SupabaseSyncClientOptions = {}) {
    this.getOnlineState = dependencies.getOnlineState ?? getBrowserOnlineState;
    this.now = dependencies.now ?? (() => new Date());

    const normalizedSupabaseUrl = supabaseUrl?.trim() ?? "";
    const normalizedSupabaseAnonKey = supabaseAnonKey?.trim() ?? "";

    if (normalizedSupabaseUrl && normalizedSupabaseAnonKey) {
      const clientFactory =
        dependencies.createClient ?? createDefaultSupabaseClient;
      this.supabase = clientFactory(
        normalizedSupabaseUrl,
        normalizedSupabaseAnonKey,
      );
      this.supabase.auth.onAuthStateChange((_event, session) => {
        this.authenticatedUserId = session?.user.id ?? null;
      });
    } else {
      this.supabase = null;
    }

    this.snapshotTransport = this.supabase
      ? createSupabaseSnapshotTransport(this.supabase)
      : null;
    this.realtimeTransport = this.supabase
      ? createSupabaseRealtimeTransport(this.supabase)
      : null;
    this.presenceTransport = this.supabase
      ? createSupabasePresenceTransport(this.supabase)
      : null;
    this.financeTransport = this.supabase
      ? createSupabaseFinanceSummaryTransport(this.supabase)
      : null;
    this.status = this.supabase
      ? this.toConfiguredStatus("offline", "아직 동기화하지 않았습니다.", null)
      : this.toLocalOnlyStatus();
  }

  private toConfiguredStatus(
    mode: SyncStatus["mode"],
    detail: string,
    lastSyncedAt: string | null,
  ): SyncStatus {
    return createConfiguredStatus(
      mode,
      detail,
      lastSyncedAt,
      this.getOnlineState(),
    );
  }

  private toLocalOnlyStatus(): SyncStatus {
    return createLocalOnlyStatus(this.getOnlineState());
  }

  private nowIso(): string {
    return this.now().toISOString();
  }

  getStatus(): SyncStatus {
    if (!this.supabase) {
      return this.toLocalOnlyStatus();
    }

    if (!this.getOnlineState() && this.status.mode !== "error") {
      return this.toConfiguredStatus(
        "offline",
        "네트워크가 없어 로컬 모드로 계속 작동 중입니다.",
        this.status.lastSyncedAt,
      );
    }

    return this.status;
  }

  isConfigured(): boolean {
    return Boolean(this.supabase);
  }

  async getAuthState(): Promise<AuthState> {
    if (!this.supabase) {
      return { userId: null, email: null };
    }

    const { data, error } = await this.supabase.auth.getSession();
    if (error) {
      throw error;
    }

    this.authenticatedUserId = data.session?.user.id ?? null;
    if (!this.authenticatedUserId) {
      this.status = this.toConfiguredStatus(
        "offline",
        "원격 동기화를 사용하려면 로그인하세요.",
        this.status.lastSyncedAt,
      );
    }

    return {
      userId: data.session?.user.id ?? null,
      email: data.session?.user.email ?? null,
    };
  }

  async signIn(email: string, password: string): Promise<AuthState> {
    if (!this.supabase) {
      throw new Error("Supabase 연결 설정을 먼저 저장하세요.");
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      throw new Error("이메일과 비밀번호를 입력하세요.");
    }

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) {
      throw error;
    }
    if (!data.user || !data.session) {
      throw new Error("인증 세션을 만들지 못했습니다.");
    }

    this.authenticatedUserId = data.user.id;
    return {
      userId: data.user.id,
      email: data.user.email ?? normalizedEmail,
    };
  }

  async signOut(): Promise<void> {
    if (!this.supabase) {
      return;
    }

    const { error } = await this.supabase.auth.signOut({ scope: "local" });
    if (error) {
      throw error;
    }

    this.authenticatedUserId = null;
    this.status = this.toConfiguredStatus(
      "offline",
      "원격 동기화를 사용하려면 로그인하세요.",
      this.status.lastSyncedAt,
    );
  }

  async getFinanceDailySummaries(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<FinanceDailySummary[]> {
    if (!this.financeTransport) {
      return [];
    }
    if (!(await this.isAuthenticatedFor(userId))) {
      throw new Error("금융 기록을 보려면 같은 Supabase 계정으로 로그인해야 합니다.");
    }

    return fetchFinanceDailySummaries(
      this.financeTransport,
      userId,
      fromDate,
      toDate,
    );
  }

  private async isAuthenticatedFor(userId: string): Promise<boolean> {
    if (!this.supabase) {
      return false;
    }
    if (this.authenticatedUserId === userId) {
      return true;
    }

    const authState = await this.getAuthState();
    return authState.userId === userId;
  }

  async pull(
    localSnapshot: LocalDataSnapshot,
    context: SyncContext,
  ): Promise<LocalDataSnapshot> {
    return this.syncPull(localSnapshot, context);
  }

  async push(
    localSnapshot: LocalDataSnapshot,
    context: SyncContext,
  ): Promise<SyncResult> {
    return this.syncPush(localSnapshot, context);
  }

  async syncPull(
    localSnapshot: LocalDataSnapshot,
    context: SyncContext,
  ): Promise<LocalDataSnapshot> {
    const transport = this.snapshotTransport;
    if (!transport) {
      this.status = this.toLocalOnlyStatus();
      return localSnapshot;
    }

    if (!(await this.isAuthenticatedFor(context.userId))) {
      this.status = this.toConfiguredStatus(
        "offline",
        "원격 동기화를 사용하려면 로그인하세요.",
        this.status.lastSyncedAt,
      );
      return localSnapshot;
    }

    if (!this.getOnlineState()) {
      this.status = this.toConfiguredStatus(
        "offline",
        "오프라인 상태라 원격 데이터를 가져오지 않았습니다.",
        this.status.lastSyncedAt,
      );
      return localSnapshot;
    }

    this.status = this.toConfiguredStatus(
      "syncing",
      "Supabase에서 변경사항을 가져오는 중입니다.",
      this.status.lastSyncedAt,
    );

    try {
      const mergedSnapshot = await pullSnapshot(
        transport,
        localSnapshot,
        context.userId,
      );
      this.status = this.toConfiguredStatus(
        "synced",
        "Supabase에서 최신 데이터를 가져왔습니다.",
        this.nowIso(),
      );
      return mergedSnapshot;
    } catch (caughtError) {
      this.status = this.toConfiguredStatus(
        "error",
        toErrorMessage(caughtError),
        this.status.lastSyncedAt,
      );
      return localSnapshot;
    }
  }

  async syncPush(
    localSnapshot: LocalDataSnapshot,
    context: SyncContext,
  ): Promise<SyncResult> {
    const transport = this.snapshotTransport;
    if (!transport) {
      this.status = this.toLocalOnlyStatus();
      return { status: this.status, changedRows: 0 };
    }

    if (!(await this.isAuthenticatedFor(context.userId))) {
      this.status = this.toConfiguredStatus(
        "offline",
        "원격 동기화를 사용하려면 로그인하세요.",
        this.status.lastSyncedAt,
      );
      return { status: this.status, changedRows: 0 };
    }

    if (!this.getOnlineState()) {
      this.status = this.toConfiguredStatus(
        "offline",
        "오프라인 상태라 로컬 변경사항을 Supabase에 보내지 않았습니다.",
        this.status.lastSyncedAt,
      );
      return { status: this.status, changedRows: 0 };
    }

    this.status = this.toConfiguredStatus(
      "syncing",
      "로컬 변경사항을 Supabase에 저장하는 중입니다.",
      this.status.lastSyncedAt,
    );

    try {
      const result = await pushSnapshot(
        transport,
        localSnapshot,
        context,
        this.nowIso(),
      );
      this.status = this.toConfiguredStatus(
        "synced",
        "Supabase에 로컬 변경사항을 저장했습니다.",
        this.nowIso(),
      );

      return {
        status: this.status,
        changedRows: result.changedRows,
        snapshot: {
          ...localSnapshot,
          devices: mergeDevices(localSnapshot.devices, [result.currentDevice]),
        },
      };
    } catch (caughtError) {
      this.status = this.toConfiguredStatus(
        "error",
        toErrorMessage(caughtError),
        this.status.lastSyncedAt,
      );
      return { status: this.status, changedRows: 0 };
    }
  }

  subscribeRealtime(options: RealtimeOptions): RealtimeSubscription {
    const transport = this.realtimeTransport;
    if (!transport || this.authenticatedUserId !== options.context.userId) {
      return noOpSubscription();
    }

    const { context, getSnapshot, onSnapshot, onError } = options;
    return subscribeSnapshotRealtime({
      transport,
      userId: context.userId,
      currentDeviceId: context.device.id,
      getSnapshot,
      onSnapshot: (tableName, nextSnapshot) => {
        this.status = this.toConfiguredStatus(
          "synced",
          getRealtimeDetail(tableName),
          this.nowIso(),
        );
        onSnapshot(nextSnapshot, this.status);
      },
      onError: () => {
        this.status = this.toConfiguredStatus(
          "error",
          "Supabase Realtime 구독에 실패했습니다.",
          this.status.lastSyncedAt,
        );
        onError(this.status.detail);
      },
    });
  }

  startHeartbeat(context: SyncContext): RealtimeSubscription {
    const transport = this.presenceTransport;
    if (!transport || this.authenticatedUserId !== context.userId) {
      return noOpSubscription();
    }

    return startDeviceHeartbeat(transport, context, {
      isOnline: this.getOnlineState,
      now: () => this.nowIso(),
    });
  }

  async getActiveDevices(
    context: SyncContext,
    fallbackDevices: Device[],
  ): Promise<Device[]> {
    const cutoff = new Date(
      this.now().getTime() - ACTIVE_DEVICE_WINDOW_MS,
    ).toISOString();
    const transport = this.presenceTransport;

    if (
      !transport ||
      !this.getOnlineState() ||
      !(await this.isAuthenticatedFor(context.userId))
    ) {
      return filterActiveDevices(fallbackDevices, cutoff);
    }

    return loadActiveDevices(
      transport,
      context.userId,
      fallbackDevices,
      cutoff,
    );
  }
}

export function createSupabaseSyncClient(
  options: SupabaseSyncClientOptions = {},
): SupabaseSyncClient {
  return new SupabaseSyncClient(options);
}
