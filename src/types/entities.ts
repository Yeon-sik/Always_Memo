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

export type DevProjectStatus = "PLANNED" | "ACTIVE" | "COMPLETED";
export type DevMilestoneStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED";
export type DevActionType = "NEXT" | "LATER" | "BLOCKED";
export type DevActionStatus = "OPEN" | "DONE";
export type DevHistoryType =
  | "STATUS_CHANGE"
  | "MILESTONE"
  | "RELEASE"
  | "NOTE";

/** Project operating state owned by the Dev Control bounded context. */
export interface Project extends SyncableEntity {
  name: string;
  repository: string | null;
  branch: string | null;
  status: DevProjectStatus;
  currentSummary: string;
  targetSummary: string;
  lastVerifiedCommit: string | null;
  lastVerifiedAt: ISODateString | null;
}

export interface ProjectMilestone extends SyncableEntity {
  projectId: EntityId;
  title: string;
  status: DevMilestoneStatus;
}

export interface ProjectAction extends SyncableEntity {
  projectId: EntityId;
  title: string;
  type: DevActionType;
  status: DevActionStatus;
}

export interface ProjectIdea extends SyncableEntity {
  projectId: EntityId;
  title: string;
}

export interface ProjectHistory extends SyncableEntity {
  projectId: EntityId;
  type: DevHistoryType;
  summary: string;
  occurredAt: ISODateString;
  githubRef: string | null;
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
  projects: Project[];
  projectMilestones: ProjectMilestone[];
  projectActions: ProjectAction[];
  projectIdeas: ProjectIdea[];
  projectHistory: ProjectHistory[];
}
