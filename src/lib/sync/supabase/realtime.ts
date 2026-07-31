import type {
  LocalDataSnapshot,
  MealRecord,
  Note,
  Task,
  WeightRecord,
  WorkoutRecord,
} from "../../../types";
import type { RealtimeSubscription } from "../syncTypes";
import { mergeEntities } from "../merge";
import {
  mealRecordFromRow,
  noteFromRow,
  taskFromRow,
  weightRecordFromRow,
  workoutRecordFromRow,
} from "./mappers";
import type {
  MealRecordRow,
  NoteRow,
  PostgresChangePayload,
  RealtimeTableName,
  SupabaseClient,
  TaskRow,
  WeightRecordRow,
  WorkoutRecordRow,
} from "./rows";

const REALTIME_TABLES: RealtimeTableName[] = [
  "notes",
  "tasks",
  "workout_records",
  "meal_records",
  "weight_records",
];

const REALTIME_DETAILS: Record<RealtimeTableName, string> = {
  notes: "다른 기기의 메모 변경사항을 반영했습니다.",
  tasks: "다른 기기의 체크리스트 변경사항을 반영했습니다.",
  workout_records: "다른 기기의 운동 기록 변경을 반영했습니다.",
  meal_records: "다른 기기의 식사 기록 변경을 반영했습니다.",
  weight_records: "다른 기기의 체중 기록 변경을 반영했습니다.",
};

export function getRealtimeDetail(tableName: RealtimeTableName): string {
  return REALTIME_DETAILS[tableName];
}

export function applyRemoteNote(
  snapshot: LocalDataSnapshot,
  remoteNote: Note,
): LocalDataSnapshot {
  return {
    ...snapshot,
    notes: mergeEntities(snapshot.notes, [remoteNote]),
  };
}

export function applyRemoteTask(
  snapshot: LocalDataSnapshot,
  remoteTask: Task,
): LocalDataSnapshot {
  return {
    ...snapshot,
    tasks: mergeEntities(snapshot.tasks, [remoteTask]),
  };
}

export function applyRemoteWorkoutRecord(
  snapshot: LocalDataSnapshot,
  remoteRecord: WorkoutRecord,
): LocalDataSnapshot {
  return {
    ...snapshot,
    workoutRecords: mergeEntities(snapshot.workoutRecords, [remoteRecord]),
  };
}

export function applyRemoteMealRecord(
  snapshot: LocalDataSnapshot,
  remoteRecord: MealRecord,
): LocalDataSnapshot {
  return {
    ...snapshot,
    mealRecords: mergeEntities(snapshot.mealRecords, [remoteRecord]),
  };
}

export function applyRemoteWeightRecord(
  snapshot: LocalDataSnapshot,
  remoteRecord: WeightRecord,
): LocalDataSnapshot {
  return {
    ...snapshot,
    weightRecords: mergeEntities(snapshot.weightRecords, [remoteRecord]),
  };
}

export function applyRealtimePayload(
  snapshot: LocalDataSnapshot,
  tableName: RealtimeTableName,
  payload: PostgresChangePayload<unknown>,
  currentDeviceId: string,
): LocalDataSnapshot | null {
  const row = payload.new as { device_id?: string } | null | undefined;

  // Hard DELETE payloads have no `new` row. Soft deletes arrive as UPDATE
  // tombstones and continue through the canonical LWW merge.
  if (!row || row.device_id === currentDeviceId) {
    return null;
  }

  switch (tableName) {
    case "notes":
      return applyRemoteNote(snapshot, noteFromRow(row as NoteRow));
    case "tasks":
      return applyRemoteTask(snapshot, taskFromRow(row as TaskRow));
    case "workout_records":
      return applyRemoteWorkoutRecord(
        snapshot,
        workoutRecordFromRow(row as WorkoutRecordRow),
      );
    case "meal_records":
      return applyRemoteMealRecord(
        snapshot,
        mealRecordFromRow(row as MealRecordRow),
      );
    case "weight_records":
      return applyRemoteWeightRecord(
        snapshot,
        weightRecordFromRow(row as WeightRecordRow),
      );
  }
}

export interface RealtimeTransport {
  subscribe(
    userId: string,
    onChange: (
      tableName: RealtimeTableName,
      payload: PostgresChangePayload<unknown>,
    ) => void,
    onStatus: (status: string) => void,
  ): unknown;
  removeChannel(channel: unknown): Promise<void> | void;
}

interface RealtimeChannelLike {
  on(
    eventType: "postgres_changes",
    filter: {
      event: "*";
      schema: "public";
      table: RealtimeTableName;
      filter: string;
    },
    callback: (payload: PostgresChangePayload<unknown>) => void,
  ): RealtimeChannelLike;
  subscribe(callback: (status: string) => void): unknown;
}

interface RealtimeClientLike {
  channel(name: string): RealtimeChannelLike;
  removeChannel(channel: unknown): Promise<unknown>;
}

export function createSupabaseRealtimeTransport(
  supabase: SupabaseClient,
): RealtimeTransport {
  const client = supabase as unknown as RealtimeClientLike;

  return {
    subscribe(userId, onChange, onStatus) {
      let channel = client.channel(`localsyncmemo:${userId}`);

      for (const tableName of REALTIME_TABLES) {
        channel = channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: tableName,
            filter: `user_id=eq.${userId}`,
          },
          (payload) => onChange(tableName, payload),
        );
      }

      return channel.subscribe(onStatus);
    },
    async removeChannel(channel) {
      await client.removeChannel(channel);
    },
  };
}

export interface SubscribeSnapshotRealtimeOptions {
  transport: RealtimeTransport;
  userId: string;
  currentDeviceId: string;
  getSnapshot: () => LocalDataSnapshot;
  onSnapshot: (
    tableName: RealtimeTableName,
    snapshot: LocalDataSnapshot,
  ) => void;
  onError: () => void;
}

export function subscribeSnapshotRealtime({
  transport,
  userId,
  currentDeviceId,
  getSnapshot,
  onSnapshot,
  onError,
}: SubscribeSnapshotRealtimeOptions): RealtimeSubscription {
  const channel = transport.subscribe(
    userId,
    (tableName, payload) => {
      const nextSnapshot = applyRealtimePayload(
        getSnapshot(),
        tableName,
        payload,
        currentDeviceId,
      );

      if (nextSnapshot) {
        onSnapshot(tableName, nextSnapshot);
      }
    },
    (status) => {
      if (status === "CHANNEL_ERROR") {
        onError();
      }
    },
  );

  return {
    unsubscribe: async () => {
      await transport.removeChannel(channel);
    },
  };
}
