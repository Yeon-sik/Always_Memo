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
}

export type WorkoutType = "strength" | "cardio" | "other";

export interface WorkoutRecord extends SyncableEntity {
  date: string;
  workoutType: WorkoutType;
  category: string;
  exerciseName: string;
}

export interface MealRecord extends SyncableEntity {
  date: string;
  menu: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number | null;
  fatGrams: number | null;
}

export interface WeightRecord extends SyncableEntity {
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
