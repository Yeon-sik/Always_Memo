import type {
  Device,
  FitnessSummaryProjectionV2,
  LegacyWorkoutRecordV1,
  MealRecord,
  Note,
  Task,
  WeightRecord,
  WorkoutType,
} from "../../../types";
import type {
  DeviceRow,
  EntityAuditRow,
  MealRecordRow,
  NoteRow,
  TaskRow,
  WeightRecordRow,
  WorkoutRecordRow,
  FitnessSummaryProjectionV2Row,
} from "./rows";

export function auditFieldsFromRow(
  row: EntityAuditRow,
  fallbackUpdatedAt: string,
) {
  const isBackfilled = row.is_backfilled === true;
  const createdAt = row.created_at ?? fallbackUpdatedAt;

  return {
    createdAt,
    isBackfilled,
    backfilledAt: isBackfilled ? row.backfilled_at ?? createdAt : null,
    backfillReason: isBackfilled ? row.backfill_reason ?? null : null,
  };
}

export function auditFieldsToRow(entity: {
  createdAt: string;
  isBackfilled: boolean;
  backfilledAt: string | null;
  backfillReason: string | null;
}): Required<EntityAuditRow> {
  return {
    created_at: entity.createdAt,
    is_backfilled: entity.isBackfilled,
    backfilled_at: entity.backfilledAt,
    backfill_reason: entity.backfillReason,
  };
}

export function noteFromRow(row: NoteRow): Note {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    title: row.title,
    content: row.content,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function taskFromRow(row: TaskRow): Task {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    text: row.text,
    isDone: row.is_done,
    orderIndex: row.order_index,
    dueDate: row.due_date,
    dueTime: row.due_time ? row.due_time.slice(0, 5) : null,
    plannedDate: row.planned_date ?? null,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function normalizeWorkoutType(value: string): WorkoutType {
  return value === "cardio" || value === "other" ? value : "strength";
}

export function normalizeSourceApp(value?: string | null): "os" | "fitness" {
  return value === "fitness" ? "fitness" : "os";
}

export function normalizeScope(
  value?: string | null,
): "os" | "fitness" | "both" {
  if (value === "os" || value === "fitness" || value === "both") {
    return value;
  }
  return "both";
}

export function normalizeMetadata(
  value?: Record<string, unknown> | null,
): Record<string, unknown> {
  return value ?? {};
}

export function normalizeContractVersion(value?: number | null): 1 {
  return value === 1 ? value : 1;
}

export function workoutRecordFromRow(row: WorkoutRecordRow): LegacyWorkoutRecordV1 {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    date: row.date,
    workoutType: normalizeWorkoutType(row.workout_type),
    category: row.category,
    exerciseName: row.exercise_name,
    durationSeconds: row.duration_seconds ?? null,
    averageHeartRate: row.average_heart_rate ?? null,
    sourceApp: normalizeSourceApp(row.source_app),
    scope: normalizeScope(row.scope),
    metadata: normalizeMetadata(row.metadata),
    contractVersion: normalizeContractVersion(row.contract_version),
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function fitnessSummaryProjectionV2FromRow(
  row: FitnessSummaryProjectionV2Row,
): FitnessSummaryProjectionV2 {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    sourceFitnessSessionId: row.source_fitness_session_id,
    date: row.date,
    completionStatus: "completed",
    chestSets: row.chest_sets,
    backSets: row.back_sets,
    legsSets: row.legs_sets,
    shouldersSets: row.shoulders_sets,
    absSets: row.abs_sets,
    tricepsSets: row.triceps_sets,
    bicepsSets: row.biceps_sets,
    totalDurationSeconds: row.total_duration_seconds ?? null,
    cardioDurationSeconds: row.cardio_duration_seconds ?? null,
    contractVersion: 2,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function mealRecordFromRow(row: MealRecordRow): MealRecord {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    date: row.date,
    menu: row.menu,
    calories: row.calories,
    proteinGrams: row.protein_grams,
    carbsGrams: row.carbs_grams,
    fatGrams: row.fat_grams,
    sourceApp: normalizeSourceApp(row.source_app),
    scope: normalizeScope(row.scope),
    metadata: normalizeMetadata(row.metadata),
    contractVersion: normalizeContractVersion(row.contract_version),
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function weightRecordFromRow(row: WeightRecordRow): WeightRecord {
  return {
    ...auditFieldsFromRow(row, row.updated_at),
    id: row.id,
    date: row.date,
    weightKg: row.weight_kg,
    sourceApp: normalizeSourceApp(row.source_app),
    scope: normalizeScope(row.scope),
    metadata: normalizeMetadata(row.metadata),
    contractVersion: normalizeContractVersion(row.contract_version),
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    deviceId: row.device_id,
  };
}

export function deviceFromRow(row: DeviceRow): Device {
  return {
    id: row.id,
    name: row.name,
    lastSeenAt: row.last_seen_at,
    appVersion: row.app_version,
  };
}

export function noteToRow(note: Note, userId: string): NoteRow {
  return {
    ...auditFieldsToRow(note),
    id: note.id,
    user_id: userId,
    title: note.title,
    content: note.content,
    updated_at: note.updatedAt,
    deleted_at: note.deletedAt,
    device_id: note.deviceId,
  };
}

export function taskToRow(task: Task, userId: string): TaskRow {
  return {
    ...auditFieldsToRow(task),
    id: task.id,
    user_id: userId,
    text: task.text,
    is_done: task.isDone,
    order_index: task.orderIndex,
    due_date: task.dueDate,
    due_time: task.dueTime,
    planned_date: task.plannedDate,
    updated_at: task.updatedAt,
    deleted_at: task.deletedAt,
    device_id: task.deviceId,
  };
}

export function workoutRecordToRow(
  record: LegacyWorkoutRecordV1,
  userId: string,
): WorkoutRecordRow {
  return {
    ...auditFieldsToRow(record),
    id: record.id,
    user_id: userId,
    date: record.date,
    workout_type: record.workoutType,
    category: record.category,
    exercise_name: record.exerciseName,
    duration_seconds: record.durationSeconds,
    average_heart_rate: record.averageHeartRate,
    source_app: record.sourceApp ?? "os",
    scope: record.scope ?? "both",
    metadata: record.metadata ?? {},
    contract_version: record.contractVersion ?? 1,
    updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
    device_id: record.deviceId,
  };
}

export function mealRecordToRow(
  record: MealRecord,
  userId: string,
): MealRecordRow {
  return {
    ...auditFieldsToRow(record),
    id: record.id,
    user_id: userId,
    date: record.date,
    menu: record.menu,
    calories: record.calories,
    protein_grams: record.proteinGrams,
    carbs_grams: record.carbsGrams,
    fat_grams: record.fatGrams,
    source_app: record.sourceApp ?? "os",
    scope: record.scope ?? "both",
    metadata: record.metadata ?? {},
    contract_version: record.contractVersion ?? 1,
    updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
    device_id: record.deviceId,
  };
}

export function weightRecordToRow(
  record: WeightRecord,
  userId: string,
): WeightRecordRow {
  return {
    ...auditFieldsToRow(record),
    id: record.id,
    user_id: userId,
    date: record.date,
    weight_kg: record.weightKg,
    source_app: record.sourceApp ?? "os",
    scope: record.scope ?? "both",
    metadata: record.metadata ?? {},
    contract_version: record.contractVersion ?? 1,
    updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
    device_id: record.deviceId,
  };
}

export function deviceToRow(device: Device, userId: string): DeviceRow {
  return {
    id: device.id,
    user_id: userId,
    name: device.name,
    last_seen_at: device.lastSeenAt,
    app_version: device.appVersion ?? null,
  };
}
