import type { Device, LocalDataSnapshot } from "../../../types";
import type { SyncContext } from "../syncTypes";
import {
  deviceFromRow,
  deviceToRow,
  fitnessSummaryProjectionV2FromRow,
  mealRecordFromRow,
  noteFromRow,
  noteToRow,
  projectActionFromRow,
  projectActionToRow,
  projectFromRow,
  projectHistoryFromRow,
  projectHistoryToRow,
  projectIdeaFromRow,
  projectIdeaToRow,
  projectMilestoneFromRow,
  projectMilestoneToRow,
  projectToRow,
  taskFromRow,
  taskToRow,
  weightRecordFromRow,
  workoutRecordFromRow,
} from "./mappers";
import type {
  DeviceRow,
  FitnessSummaryProjectionV2Row,
  MealRecordRow,
  NoteRow,
  ProjectActionRow,
  ProjectHistoryRow,
  ProjectIdeaRow,
  ProjectMilestoneRow,
  ProjectRow,
  SnapshotTableName,
  SupabaseClient,
  TaskRow,
  WeightRecordRow,
  WorkoutRecordRow,
} from "./rows";
import { mergeSnapshot } from "./snapshotMerge";

export interface SnapshotQueryResult<Row> {
  data: Row[] | null;
  error: unknown | null;
}

export interface SnapshotWriteResult {
  error: unknown | null;
}

export interface SnapshotTransport {
  selectRows<Row>(
    tableName: SnapshotTableName,
    userId: string,
  ): Promise<SnapshotQueryResult<Row>>;
  upsertRows<Row>(
    tableName: SnapshotTableName,
    values: Row | Row[],
    onConflict: string,
  ): Promise<SnapshotWriteResult>;
}

interface SelectTable<Row> {
  select(columns: string): {
    eq(column: string, value: string): Promise<SnapshotQueryResult<Row>>;
  };
}

interface UpsertTable<Row> {
  upsert(
    values: Row | Row[],
    options: { onConflict: string },
  ): Promise<SnapshotWriteResult>;
}

export function createSupabaseSnapshotTransport(
  supabase: SupabaseClient,
): SnapshotTransport {
  return {
    selectRows<Row>(tableName: SnapshotTableName, userId: string) {
      const table = supabase.from(tableName) as unknown as SelectTable<Row>;
      return table.select("*").eq("user_id", userId);
    },
    upsertRows<Row>(
      tableName: SnapshotTableName,
      values: Row | Row[],
      onConflict: string,
    ) {
      const table = supabase.from(tableName) as unknown as UpsertTable<Row>;
      return table.upsert(values, { onConflict });
    },
  };
}

function throwQueryError(result: { error: unknown | null }): void {
  if (result.error) {
    throw result.error;
  }
}

export async function pullSnapshot(
  transport: SnapshotTransport,
  localSnapshot: LocalDataSnapshot,
  userId: string,
): Promise<LocalDataSnapshot> {
  const [
    notesResult,
    tasksResult,
    workoutRecordsResult,
    mealRecordsResult,
    weightRecordsResult,
    fitnessSummaryProjectionsResult,
    devicesResult,
    projectsResult,
    projectMilestonesResult,
    projectActionsResult,
    projectIdeasResult,
    projectHistoryResult,
  ] = await Promise.all([
    transport.selectRows<NoteRow>("notes", userId),
    transport.selectRows<TaskRow>("tasks", userId),
    transport.selectRows<WorkoutRecordRow>("workout_records", userId),
    transport.selectRows<MealRecordRow>("meal_records", userId),
    transport.selectRows<WeightRecordRow>("weight_records", userId),
    transport.selectRows<FitnessSummaryProjectionV2Row>(
      "fitness_summary_projections_v2",
      userId,
    ),
    transport.selectRows<DeviceRow>("devices", userId),
    transport.selectRows<ProjectRow>("projects", userId),
    transport.selectRows<ProjectMilestoneRow>("project_milestones", userId),
    transport.selectRows<ProjectActionRow>("project_actions", userId),
    transport.selectRows<ProjectIdeaRow>("project_ideas", userId),
    transport.selectRows<ProjectHistoryRow>("project_history", userId),
  ]);

  for (const result of [
    notesResult,
    tasksResult,
    workoutRecordsResult,
    mealRecordsResult,
    weightRecordsResult,
    fitnessSummaryProjectionsResult,
    devicesResult,
    projectsResult,
    projectMilestonesResult,
    projectActionsResult,
    projectIdeasResult,
    projectHistoryResult,
  ]) {
    throwQueryError(result);
  }

  const incomingSnapshot: LocalDataSnapshot = {
    notes: (notesResult.data ?? []).map(noteFromRow),
    tasks: (tasksResult.data ?? []).map(taskFromRow),
    workoutRecords: (workoutRecordsResult.data ?? []).map(
      workoutRecordFromRow,
    ),
    mealRecords: (mealRecordsResult.data ?? []).map(mealRecordFromRow),
    weightRecords: (weightRecordsResult.data ?? []).map(weightRecordFromRow),
    fitnessSummaryProjections: (fitnessSummaryProjectionsResult.data ?? []).map(
      fitnessSummaryProjectionV2FromRow,
    ),
    devices: (devicesResult.data ?? []).map(deviceFromRow),
    projects: (projectsResult.data ?? []).map(projectFromRow),
    projectMilestones: (projectMilestonesResult.data ?? []).map(
      projectMilestoneFromRow,
    ),
    projectActions: (projectActionsResult.data ?? []).map(projectActionFromRow),
    projectIdeas: (projectIdeasResult.data ?? []).map(projectIdeaFromRow),
    projectHistory: (projectHistoryResult.data ?? []).map(projectHistoryFromRow),
  };

  return mergeSnapshot(localSnapshot, incomingSnapshot);
}

export interface PushPayload {
  currentDevice: Device;
  device: DeviceRow;
  notes: NoteRow[];
  tasks: TaskRow[];
  projects: ProjectRow[];
  projectMilestones: ProjectMilestoneRow[];
  projectActions: ProjectActionRow[];
  projectIdeas: ProjectIdeaRow[];
  projectHistory: ProjectHistoryRow[];
}

export function createPushPayload(
  localSnapshot: LocalDataSnapshot,
  context: SyncContext,
  lastSeenAt: string,
): PushPayload {
  const currentDevice: Device = {
    ...context.device,
    lastSeenAt,
  };
  const isOwnedByCurrentDevice = (entity: { deviceId: string }) =>
    entity.deviceId === context.device.id;

  return {
    currentDevice,
    device: deviceToRow(currentDevice, context.userId),
    notes: localSnapshot.notes
      .filter(isOwnedByCurrentDevice)
      .map((note) => noteToRow(note, context.userId)),
    tasks: localSnapshot.tasks
      .filter(isOwnedByCurrentDevice)
      .map((task) => taskToRow(task, context.userId)),
    projects: localSnapshot.projects
      .filter(isOwnedByCurrentDevice)
      .map((project) => projectToRow(project, context.userId)),
    projectMilestones: localSnapshot.projectMilestones
      .filter(isOwnedByCurrentDevice)
      .map((milestone) => projectMilestoneToRow(milestone, context.userId)),
    projectActions: localSnapshot.projectActions
      .filter(isOwnedByCurrentDevice)
      .map((action) => projectActionToRow(action, context.userId)),
    projectIdeas: localSnapshot.projectIdeas
      .filter(isOwnedByCurrentDevice)
      .map((idea) => projectIdeaToRow(idea, context.userId)),
    projectHistory: localSnapshot.projectHistory
      .filter(isOwnedByCurrentDevice)
      .map((history) => projectHistoryToRow(history, context.userId)),
  };
}

export interface PushSnapshotResult {
  changedRows: number;
  currentDevice: Device;
}

export async function pushSnapshot(
  transport: SnapshotTransport,
  localSnapshot: LocalDataSnapshot,
  context: SyncContext,
  lastSeenAt: string,
): Promise<PushSnapshotResult> {
  const payload = createPushPayload(localSnapshot, context, lastSeenAt);
  let changedRows = 0;

  const deviceResult = await transport.upsertRows(
    "devices",
    payload.device,
    "user_id,id",
  );
  throwQueryError(deviceResult);
  changedRows += 1;

  const batches: Array<{
    tableName: SnapshotTableName;
    rows: unknown[];
  }> = [
    { tableName: "projects", rows: payload.projects },
    { tableName: "notes", rows: payload.notes },
    { tableName: "tasks", rows: payload.tasks },
    // Parents must arrive before children so the composite ownership FK is
    // satisfied on every device, including a first sync of a new project.
    { tableName: "project_milestones", rows: payload.projectMilestones },
    { tableName: "project_actions", rows: payload.projectActions },
    { tableName: "project_ideas", rows: payload.projectIdeas },
    { tableName: "project_history", rows: payload.projectHistory },
  ];

  for (const batch of batches) {
    if (batch.rows.length === 0) {
      continue;
    }

    const result = await transport.upsertRows(
      batch.tableName,
      batch.rows,
      "id",
    );
    throwQueryError(result);
    changedRows += batch.rows.length;
  }

  return { changedRows, currentDevice: payload.currentDevice };
}
