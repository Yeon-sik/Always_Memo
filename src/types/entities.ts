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

export interface ScopedRecordFields {
  sourceApp?: SourceApp;
  scope?: RecordScope;
  metadata?: Record<string, unknown>;
  contractVersion?: FitnessRecordContractVersion;
}

export interface WorkoutRecord extends SyncableEntity, ScopedRecordFields {
  date: string;
  workoutType: WorkoutType;
  category: string;
  exerciseName: string;
  durationSeconds: number | null;
  averageHeartRate: number | null;
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
  workoutRecords: WorkoutRecord[];
  mealRecords: MealRecord[];
  weightRecords: WeightRecord[];
  devices: Device[];
}
