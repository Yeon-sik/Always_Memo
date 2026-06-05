import {
  createClient,
  type SupabaseClient as SupabaseClientBase,
} from "@supabase/supabase-js";
import type { Device, LocalDataSnapshot, Note, Task } from "../../types";
import type {
  RealtimeOptions,
  RealtimeSubscription,
  SyncClient,
  SyncContext,
  SyncResult,
  SyncStatus,
} from "./syncTypes";

const ACTIVE_DEVICE_WINDOW_MS = 60_000;
const HEARTBEAT_INTERVAL_MS = 20_000;

interface NoteRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

interface TaskRow {
  id: string;
  user_id: string;
  text: string;
  is_done: boolean;
  order_index: number;
  due_date: string | null;
  due_time: string | null;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
}

interface DeviceRow {
  id: string;
  user_id: string;
  name: string;
  last_seen_at: string;
  app_version: string | null;
}

interface PostgresChangePayload<Row> {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Row;
  old: Partial<Row>;
}

interface UpsertTable<Row> {
  upsert(
    values: Row | Row[],
    options?: { onConflict?: string },
  ): Promise<{ error: Error | null }>;
}

interface Database {
  public: {
    Tables: {
      notes: {
        Row: NoteRow;
        Insert: NoteRow;
        Update: Partial<NoteRow>;
        Relationships: [];
      };
      tasks: {
        Row: TaskRow;
        Insert: TaskRow;
        Update: Partial<TaskRow>;
        Relationships: [];
      };
      devices: {
        Row: DeviceRow;
        Insert: DeviceRow;
        Update: Partial<DeviceRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

type SupabaseClient = SupabaseClientBase<Database, "public">;

interface SupabaseSyncClientOptions {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

// 브라우저/웹뷰의 네트워크 상태를 동기화 가능 여부의 1차 신호로 쓴다.
function getOnlineState(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return navigator.onLine;
}

// Supabase 설정이 있는 상태의 공통 SyncStatus 생성기다.
function toConfiguredStatus(
  mode: SyncStatus["mode"],
  detail: string,
  lastSyncedAt: string | null,
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
    isOnline: getOnlineState(),
    lastSyncedAt,
    isConfigured: true,
  };
}

// 환경 변수가 비어 있을 때는 Supabase 클라이언트를 만들지 않고 로컬 모드로 둔다.
function toLocalOnlyStatus(): SyncStatus {
  return {
    mode: "local-only",
    label: "local-only",
    detail: "Supabase 환경 변수가 설정되지 않아 로컬 모드로 실행 중입니다.",
    isOnline: getOnlineState(),
    lastSyncedAt: null,
    isConfigured: false,
  };
}

// DB row와 앱 엔티티는 snake_case/camelCase가 달라 변환 함수를 명시한다.
function noteFromRow(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

function taskFromRow(row: TaskRow): Task {
  return {
    id: row.id,
    text: row.text,
    isDone: row.is_done,
    orderIndex: row.order_index,
    dueDate: row.due_date,
    dueTime: row.due_time ? row.due_time.slice(0, 5) : null,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

function deviceFromRow(row: DeviceRow): Device {
  return {
    id: row.id,
    name: row.name,
    lastSeenAt: row.last_seen_at,
    appVersion: row.app_version,
  };
}

function noteToRow(note: Note, userId: string): NoteRow {
  return {
    id: note.id,
    user_id: userId,
    title: note.title,
    content: note.content,
    updated_at: note.updatedAt,
    deleted_at: note.deletedAt,
    device_id: note.deviceId,
  };
}

function taskToRow(task: Task, userId: string): TaskRow {
  return {
    id: task.id,
    user_id: userId,
    text: task.text,
    is_done: task.isDone,
    order_index: task.orderIndex,
    due_date: task.dueDate,
    due_time: task.dueTime,
    updated_at: task.updatedAt,
    deleted_at: task.deletedAt,
    device_id: task.deviceId,
  };
}

function deviceToRow(device: Device, userId: string): DeviceRow {
  return {
    id: device.id,
    user_id: userId,
    name: device.name,
    last_seen_at: device.lastSeenAt,
    app_version: device.appVersion ?? null,
  };
}

// Last Write Wins 병합 규칙: updatedAt이 최신인 row를 선택한다.
function shouldUseIncoming<T extends { updatedAt: string; deletedAt: string | null }>(
  current: T | undefined,
  incoming: T,
): boolean {
  if (!current) {
    return true;
  }

  const currentUpdatedAt = Date.parse(current.updatedAt);
  const incomingUpdatedAt = Date.parse(incoming.updatedAt);

  if (incomingUpdatedAt > currentUpdatedAt) {
    return true;
  }

  if (incomingUpdatedAt < currentUpdatedAt) {
    return false;
  }

  // MVP conflict policy: Last Write Wins by updatedAt.
  // Future sync can replace this with a CRDT or append-only change log.
  // If timestamps are equal, keep tombstones so a soft-deleted row is not revived.
  return Boolean(incoming.deletedAt && !current.deletedAt);
}

// 같은 id의 로컬 row와 원격 row를 LWW 규칙으로 합친다.
function mergeEntities<T extends { id: string; updatedAt: string; deletedAt: string | null }>(
  localEntities: T[],
  incomingEntities: T[],
): T[] {
  const byId = new Map(localEntities.map((entity) => [entity.id, entity]));

  for (const incomingEntity of incomingEntities) {
    const currentEntity = byId.get(incomingEntity.id);

    if (shouldUseIncoming(currentEntity, incomingEntity)) {
      byId.set(incomingEntity.id, incomingEntity);
    }
  }

  return Array.from(byId.values());
}

// 기기는 삭제 개념이 없으므로 lastSeenAt이 더 최신인 값을 유지한다.
function mergeDevices(localDevices: Device[], incomingDevices: Device[]): Device[] {
  const byId = new Map(localDevices.map((device) => [device.id, device]));

  for (const incomingDevice of incomingDevices) {
    const currentDevice = byId.get(incomingDevice.id);

    if (
      !currentDevice ||
      Date.parse(incomingDevice.lastSeenAt) >= Date.parse(currentDevice.lastSeenAt)
    ) {
      byId.set(incomingDevice.id, incomingDevice);
    }
  }

  return Array.from(byId.values()).sort((first, second) =>
    second.lastSeenAt.localeCompare(first.lastSeenAt),
  );
}

// pull sync 결과를 로컬 스냅샷과 합쳐 앱 상태로 되돌린다.
function mergeSnapshot(
  localSnapshot: LocalDataSnapshot,
  incomingSnapshot: LocalDataSnapshot,
): LocalDataSnapshot {
  return {
    notes: mergeEntities(localSnapshot.notes, incomingSnapshot.notes),
    tasks: mergeEntities(localSnapshot.tasks, incomingSnapshot.tasks),
    workoutRecords: mergeEntities(
      localSnapshot.workoutRecords,
      incomingSnapshot.workoutRecords,
    ),
    mealRecords: mergeEntities(
      localSnapshot.mealRecords,
      incomingSnapshot.mealRecords,
    ),
    weightRecords: mergeEntities(
      localSnapshot.weightRecords,
      incomingSnapshot.weightRecords,
    ),
    devices: mergeDevices(localSnapshot.devices, incomingSnapshot.devices),
  };
}

// Realtime으로 받은 단일 메모 row만 현재 스냅샷에 반영한다.
function applyRemoteNote(
  snapshot: LocalDataSnapshot,
  remoteNote: Note,
): LocalDataSnapshot {
  return {
    ...snapshot,
    notes: mergeEntities(snapshot.notes, [remoteNote]),
  };
}

// Realtime으로 받은 단일 체크리스트 row만 현재 스냅샷에 반영한다.
function applyRemoteTask(
  snapshot: LocalDataSnapshot,
  remoteTask: Task,
): LocalDataSnapshot {
  return {
    ...snapshot,
    tasks: mergeEntities(snapshot.tasks, [remoteTask]),
  };
}

// Supabase 에러와 unknown 예외를 UI에 표시 가능한 문자열로 통일한다.
function toErrorMessage(caughtError: unknown): string {
  if (caughtError instanceof Error) {
    return caughtError.message;
  }

  return "Supabase 동기화 중 오류가 발생했습니다.";
}

// supabase-js의 from().upsert 타입을 테이블별 row 타입으로 좁혀 사용한다.
function upsertTable<Row>(
  supabase: SupabaseClient,
  tableName: "notes" | "tasks" | "devices",
): UpsertTable<Row> {
  return supabase.from(tableName) as unknown as UpsertTable<Row>;
}

// Supabase Postgres, Realtime, heartbeat를 담당하는 실제 원격 동기화 클라이언트다.
export class SupabaseSyncClient implements SyncClient {
  private readonly supabase: SupabaseClient | null;
  private status: SyncStatus;

  constructor({ supabaseUrl, supabaseAnonKey }: SupabaseSyncClientOptions = {}) {
    const normalizedSupabaseUrl = supabaseUrl?.trim() ?? "";
    const normalizedSupabaseAnonKey = supabaseAnonKey?.trim() ?? "";

    if (normalizedSupabaseUrl && normalizedSupabaseAnonKey) {
      this.supabase = createClient<Database, "public">(
        normalizedSupabaseUrl,
        normalizedSupabaseAnonKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      ) as SupabaseClient;
    } else {
      this.supabase = null;
    }

    this.status = this.supabase
      ? toConfiguredStatus("offline", "아직 동기화하지 않았습니다.", null)
      : toLocalOnlyStatus();
  }

  getStatus(): SyncStatus {
    if (!this.supabase) {
      return toLocalOnlyStatus();
    }

    if (!getOnlineState() && this.status.mode !== "error") {
      return toConfiguredStatus(
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
    // pull은 원격 전체 row를 가져와 로컬 스냅샷과 병합한다.
    if (!this.supabase) {
      this.status = toLocalOnlyStatus();
      return localSnapshot;
    }

    if (!getOnlineState()) {
      this.status = toConfiguredStatus(
        "offline",
        "오프라인 상태라 원격 데이터를 가져오지 않았습니다.",
        this.status.lastSyncedAt,
      );
      return localSnapshot;
    }

    this.status = toConfiguredStatus("syncing", "Supabase에서 변경사항을 가져오는 중입니다.", this.status.lastSyncedAt);

    try {
      const [notesResult, tasksResult, devicesResult] = await Promise.all([
        this.supabase
          .from("notes")
          .select("*")
          .eq("user_id", context.userId),
        this.supabase
          .from("tasks")
          .select("*")
          .eq("user_id", context.userId),
        this.supabase
          .from("devices")
          .select("*")
          .eq("user_id", context.userId),
      ]);

      if (notesResult.error) {
        throw notesResult.error;
      }

      if (tasksResult.error) {
        throw tasksResult.error;
      }

      if (devicesResult.error) {
        throw devicesResult.error;
      }

      const incomingSnapshot: LocalDataSnapshot = {
        notes: (notesResult.data ?? []).map(noteFromRow),
        tasks: (tasksResult.data ?? []).map(taskFromRow),
        workoutRecords: [],
        mealRecords: [],
        weightRecords: [],
        devices: (devicesResult.data ?? []).map(deviceFromRow),
      };
      const mergedSnapshot = mergeSnapshot(localSnapshot, incomingSnapshot);
      const now = new Date().toISOString();

      this.status = toConfiguredStatus(
        "synced",
        "Supabase에서 최신 데이터를 가져왔습니다.",
        now,
      );

      return mergedSnapshot;
    } catch (caughtError) {
      this.status = toConfiguredStatus("error", toErrorMessage(caughtError), this.status.lastSyncedAt);
      return localSnapshot;
    }
  }

  async syncPush(
    localSnapshot: LocalDataSnapshot,
    context: SyncContext,
  ): Promise<SyncResult> {
    // push는 이 기기에서 수정한 row와 현재 device heartbeat만 업서트한다.
    if (!this.supabase) {
      this.status = toLocalOnlyStatus();
      return { status: this.status, changedRows: 0 };
    }

    if (!getOnlineState()) {
      this.status = toConfiguredStatus(
        "offline",
        "오프라인 상태라 로컬 변경사항을 Supabase에 보내지 않았습니다.",
        this.status.lastSyncedAt,
      );
      return { status: this.status, changedRows: 0 };
    }

    this.status = toConfiguredStatus("syncing", "로컬 변경사항을 Supabase에 저장하는 중입니다.", this.status.lastSyncedAt);

    try {
      const currentDevice = {
        ...context.device,
        lastSeenAt: new Date().toISOString(),
      };
      const ownNotes = localSnapshot.notes
        .filter((note) => note.deviceId === context.device.id)
        .map((note) => noteToRow(note, context.userId));
      const ownTasks = localSnapshot.tasks
        .filter((task) => task.deviceId === context.device.id)
        .map((task) => taskToRow(task, context.userId));
      let changedRows = 0;

      const deviceResult = await upsertTable<DeviceRow>(
        this.supabase,
        "devices",
      ).upsert(deviceToRow(currentDevice, context.userId), {
          onConflict: "user_id,id",
        });

      if (deviceResult.error) {
        throw deviceResult.error;
      }

      changedRows += 1;

      if (ownNotes.length > 0) {
        const notesResult = await upsertTable<NoteRow>(
          this.supabase,
          "notes",
        ).upsert(ownNotes, { onConflict: "id" });

        if (notesResult.error) {
          throw notesResult.error;
        }

        changedRows += ownNotes.length;
      }

      if (ownTasks.length > 0) {
        const tasksResult = await upsertTable<TaskRow>(
          this.supabase,
          "tasks",
        ).upsert(ownTasks, { onConflict: "id" });

        if (tasksResult.error) {
          throw tasksResult.error;
        }

        changedRows += ownTasks.length;
      }

      const now = new Date().toISOString();
      this.status = toConfiguredStatus(
        "synced",
        "Supabase에 로컬 변경사항을 저장했습니다.",
        now,
      );

      return {
        status: this.status,
        changedRows,
        snapshot: {
          ...localSnapshot,
          devices: mergeDevices(localSnapshot.devices, [currentDevice]),
        },
      };
    } catch (caughtError) {
      this.status = toConfiguredStatus("error", toErrorMessage(caughtError), this.status.lastSyncedAt);
      return { status: this.status, changedRows: 0 };
    }
  }

  subscribeRealtime(options: RealtimeOptions): RealtimeSubscription {
    if (!this.supabase) {
      return { unsubscribe: () => undefined };
    }

    const { context, getSnapshot, onSnapshot, onError } = options;
    // 자기 기기에서 발생한 이벤트는 이미 로컬 상태에 있으므로 무시한다.
    const channel = this.supabase
      .channel(`localsyncmemo:${context.userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notes",
          filter: `user_id=eq.${context.userId}`,
        },
        (payload) => {
          const typedPayload =
            payload as unknown as PostgresChangePayload<NoteRow>;
          const row = typedPayload.new;

          if (!row || row.device_id === context.device.id) {
            return;
          }

          const nextSnapshot = applyRemoteNote(getSnapshot(), noteFromRow(row));
          this.status = toConfiguredStatus(
            "synced",
            "다른 기기의 메모 변경사항을 반영했습니다.",
            new Date().toISOString(),
          );
          onSnapshot(nextSnapshot, this.status);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${context.userId}`,
        },
        (payload) => {
          const typedPayload =
            payload as unknown as PostgresChangePayload<TaskRow>;
          const row = typedPayload.new;

          if (!row || row.device_id === context.device.id) {
            return;
          }

          const nextSnapshot = applyRemoteTask(getSnapshot(), taskFromRow(row));
          this.status = toConfiguredStatus(
            "synced",
            "다른 기기의 체크리스트 변경사항을 반영했습니다.",
            new Date().toISOString(),
          );
          onSnapshot(nextSnapshot, this.status);
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          this.status = toConfiguredStatus(
            "error",
            "Supabase Realtime 구독에 실패했습니다.",
            this.status.lastSyncedAt,
          );
          onError(this.status.detail);
        }
      });

    return {
      unsubscribe: async () => {
        await this.supabase?.removeChannel(channel);
      },
    };
  }

  startHeartbeat(context: SyncContext): RealtimeSubscription {
    if (!this.supabase) {
      return { unsubscribe: () => undefined };
    }

    let isStopped = false;

    // heartbeat는 활성 기기 표시용이므로 실패해도 편집/저장을 막지 않는다.
    const beat = async () => {
      if (isStopped || !this.supabase || !getOnlineState()) {
        return;
      }

      try {
        await upsertTable<DeviceRow>(this.supabase, "devices").upsert(
          deviceToRow(
            {
              ...context.device,
              lastSeenAt: new Date().toISOString(),
            },
            context.userId,
          ),
          { onConflict: "user_id,id" },
        );
      } catch {
        // Heartbeat failure should never interrupt local-first editing.
      }
    };

    void beat();
    const timerId = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);

    return {
      unsubscribe: () => {
        isStopped = true;
        window.clearInterval(timerId);
      },
    };
  }

  async getActiveDevices(
    context: SyncContext,
    fallbackDevices: Device[],
  ): Promise<Device[]> {
    // 최근 heartbeat가 있는 기기만 활성으로 간주한다.
    const cutoff = new Date(Date.now() - ACTIVE_DEVICE_WINDOW_MS).toISOString();

    if (!this.supabase || !getOnlineState()) {
      return fallbackDevices
        .filter((device) => device.lastSeenAt >= cutoff)
        .sort((first, second) =>
          second.lastSeenAt.localeCompare(first.lastSeenAt),
        );
    }

    try {
      const { data, error } = await this.supabase
        .from("devices")
        .select("*")
        .eq("user_id", context.userId)
        .gte("last_seen_at", cutoff)
        .order("last_seen_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map(deviceFromRow);
    } catch {
      return fallbackDevices
        .filter((device) => device.lastSeenAt >= cutoff)
        .sort((first, second) =>
          second.lastSeenAt.localeCompare(first.lastSeenAt),
        );
    }
  }
}

export function createSupabaseSyncClient(
  options: SupabaseSyncClientOptions = {},
): SupabaseSyncClient {
  return new SupabaseSyncClient(options);
}
