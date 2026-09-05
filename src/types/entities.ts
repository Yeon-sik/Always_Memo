export type EntityId = string;
export type ISODateString = string;

export interface BackfillMetadata {
  isBackfilled: boolean;
  backfilledAt: ISODateString | null;
  backfillReason: string | null;
}

export type BackfillInput = Partial<BackfillMetadata>;

export interface SyncableEntity extends BackfillMetadata {
  id: EntityId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  deletedAt: ISODateString | null;
  deviceId: EntityId;
}

export interface Note extends SyncableEntity {
  title: string;
  content: string;
}

export interface Task extends SyncableEntity {
  text: string;
  isDone: boolean;
  orderIndex: number;
  dueDate: string | null;
  dueTime: string | null;
  plannedDate: string | null;
}

export type WorkoutType = "strength" | "cardio" | "other";
export type SourceApp = "os" | "fitness";
export type RecordScope = "os" | "fitness" | "both";
export type FitnessRecordContractVersion = 1;
export type FitnessSummaryProjectionContractVersion = 2;
export type FitnessSummaryCompletionStatus = "completed";

export interface ScopedRecordFields {
  sourceApp?: SourceApp;
  scope?: RecordScope;
  metadata?: Record<string, unknown>;
  contractVersion?: FitnessRecordContractVersion;
}

/**
 * Safe workout shape for Personal OS features. It intentionally contains no
 * exercise identity or per-set values.
 */
export interface WorkoutRecord extends SyncableEntity, ScopedRecordFields {
  date: string;
  workoutType: WorkoutType;
  category: string;
  durationSeconds: number | null;
  averageHeartRate: number | null;
}

/**
 * Frozen Fitness Record Contract v1 reader shape. This remains available only
 * for legacy storage/sync compatibility; normal Personal OS features must use
 * FitnessSummaryProjectionV2 instead.
 */
export interface LegacyWorkoutRecordV1 extends WorkoutRecord {
  exerciseName: string;
}

/**
 * Cross-app read model owned and produced by FitnessApp. Do not add exercise,
 * set, load, repetition, RPE/RIR, or other detailed Fitness fields here.
 */
export interface FitnessSummaryProjectionV2 extends SyncableEntity {
  sourceFitnessSessionId: EntityId;
  date: string;
  completionStatus: FitnessSummaryCompletionStatus;
  chestSets: number;
  backSets: number;
  legsSets: number;
  shouldersSets: number;
  absSets: number;
  tricepsSets: number;
  bicepsSets: number;
  totalDurationSeconds: number | null;
  cardioDurationSeconds: number | null;
  contractVersion: FitnessSummaryProjectionContractVersion;
}

export interface MealRecord extends SyncableEntity, ScopedRecordFields {
  date: string;
  menu: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number | null;
  fatGrams: number | null;
}

export interface WeightRecord extends SyncableEntity, ScopedRecordFields {
  date: string;
  weightKg: number;
}

export interface Device {
  id: EntityId;
  name: string;
  lastSeenAt: ISODateString;
  appVersion?: string | null;
}

export interface LocalDataSnapshot {
  notes: Note[];
  tasks: Task[];
  /** Frozen v1 rows retained for legacy reads and migration compatibility. */
  workoutRecords: LegacyWorkoutRecordV1[];
  fitnessSummaryProjections: FitnessSummaryProjectionV2[];
  mealRecords: MealRecord[];
  weightRecords: WeightRecord[];
  devices: Device[];
}
