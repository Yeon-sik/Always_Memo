import { fitnessNutritionSummaryFromRow } from "../../../features/fitness-summary/fitnessNutritionContract";
import type { Device, LocalDataSnapshot } from "../../../types";
import type { SyncContext } from "../syncTypes";
import {
  deviceFromRow,
  deviceToRow,
  fitnessSummaryProjectionV2FromRow,
  knowledgeDocumentFromRow,
  knowledgeDocumentToRow,
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
  workstreamActionDependencyFromRow,
  workstreamActionDependencyToRow,
  workstreamActionFromRow,
  workstreamActionProjectFromRow,
  workstreamActionProjectToRow,
  workstreamActionToRow,
  workstreamFromRow,
  workstreamMilestoneFromRow,
  workstreamMilestoneToRow,
  workstreamProjectFromRow,
  workstreamProjectToRow,
  workstreamToRow,
  taskFromRow,
  taskToRow,
  weightRecordFromRow,
} from "./mappers";
import type {
  DeviceRow,
  FitnessSummaryProjectionV2Row,
  KnowledgeDocumentRow,
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
  WorkstreamActionDependencyRow,
  WorkstreamActionProjectRow,
  WorkstreamActionRow,
  WorkstreamMilestoneRow,
  WorkstreamProjectRow,
  WorkstreamRow,
} from "./rows";
import {
  mergeAuthoritativeSnapshot,
  mergeSnapshot,
} from "./snapshotMerge";

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

export const SNAPSHOT_PAGE_SIZE = 1000;

interface SelectTable<Row> {
  select(columns: string): {
    eq(column: string, value: string): {
      order(
        column: string,
        options: { ascending: boolean },
      ): {
        range(from: number, to: number): Promise<SnapshotQueryResult<Row>>;
      };
    };
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
    async selectRows<Row>(tableName: SnapshotTableName, userId: string) {
      const table = supabase.from(tableName) as unknown as SelectTable<Row>;
      const rows: Row[] = [];

      for (let pageIndex = 0; ; pageIndex += 1) {
        const pageStart = pageIndex * SNAPSHOT_PAGE_SIZE;
        const pageResult = await table
          .select("*")
          .eq("user_id", userId)
          .order("id", { ascending: true })
          .range(pageStart, pageStart + SNAPSHOT_PAGE_SIZE - 1);

        if (pageResult.error) {
          return { data: null, error: pageResult.error };
        }

        const pageRows = pageResult.data ?? [];
        rows.push(...pageRows);

        if (pageRows.length < SNAPSHOT_PAGE_SIZE) {
          return { data: rows, error: null };
        }
      }
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

async function fetchIncomingSnapshot(
  transport: SnapshotTransport,
  userId: string,
): Promise<LocalDataSnapshot> {
  const [
    notesResult,
    tasksResult,
    fitnessNutritionSummariesResult,
    fitnessSummaryProjectionsResult,
    weightRecordsResult,
    devicesResult,
    projectsResult,
    projectMilestonesResult,
    projectActionsResult,
    projectIdeasResult,
    projectHistoryResult,
    workstreamsResult,
    workstreamProjectsResult,
    workstreamMilestonesResult,
    workstreamActionsResult,
    workstreamActionProjectsResult,
    workstreamActionDependenciesResult,
    knowledgeDocumentsResult,
  ] = await Promise.all([
    transport.selectRows<NoteRow>("notes", userId),
    transport.selectRows<TaskRow>("tasks", userId),
    transport.selectRows<unknown>("fitness_nutrition_summary_v1", userId),
    transport.selectRows<FitnessSummaryProjectionV2Row>(
      "fitness_summary_projections_v2",
      userId,
    ),
    // Compatibility read path only; weight_records never enter a push payload.
    transport.selectRows<WeightRecordRow>("weight_records", userId),
    transport.selectRows<DeviceRow>("devices", userId),
    transport.selectRows<ProjectRow>("projects", userId),
    transport.selectRows<ProjectMilestoneRow>("project_milestones", userId),
    transport.selectRows<ProjectActionRow>("project_actions", userId),
    transport.selectRows<ProjectIdeaRow>("project_ideas", userId),
    transport.selectRows<ProjectHistoryRow>("project_history", userId),
    transport.selectRows<WorkstreamRow>("workstreams", userId),
    transport.selectRows<WorkstreamProjectRow>(
      "workstream_projects",
      userId,
    ),
    transport.selectRows<WorkstreamMilestoneRow>(
      "workstream_milestones",
      userId,
    ),
    transport.selectRows<WorkstreamActionRow>("workstream_actions", userId),
    transport.selectRows<WorkstreamActionProjectRow>(
      "workstream_action_projects",
      userId,
    ),
    transport.selectRows<WorkstreamActionDependencyRow>(
      "workstream_action_dependencies",
      userId,
    ),
    transport.selectRows<KnowledgeDocumentRow>("knowledge_documents", userId),
  ]);

  for (const result of [
    notesResult,
    tasksResult,
    fitnessNutritionSummariesResult,
    fitnessSummaryProjectionsResult,
    weightRecordsResult,
    devicesResult,
    projectsResult,
    projectMilestonesResult,
    projectActionsResult,
    projectIdeasResult,
    projectHistoryResult,
    workstreamsResult,
    workstreamProjectsResult,
    workstreamMilestonesResult,
    workstreamActionsResult,
    workstreamActionProjectsResult,
    workstreamActionDependenciesResult,
    knowledgeDocumentsResult,
  ]) {
    throwQueryError(result);
  }

  const incomingSnapshot: LocalDataSnapshot = {
    notes: (notesResult.data ?? []).map(noteFromRow),
    tasks: (tasksResult.data ?? []).map(taskFromRow),
    // Legacy workout and meal records stay local; Fitness screens use the versioned read models.
    workoutRecords: [],
    mealRecords: [],
    weightRecords: [],
    fitnessWeightRecords: (weightRecordsResult.data ?? [])
      .map(weightRecordFromRow)
      .filter((record) => record.sourceApp === "fitness" && (record.scope === "fitness" || record.scope === "both")),
    fitnessNutritionSummaries: (fitnessNutritionSummariesResult.data ?? []).map(fitnessNutritionSummaryFromRow),
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
    workstreams: (workstreamsResult.data ?? []).map(workstreamFromRow),
    workstreamProjects: (workstreamProjectsResult.data ?? []).map(
      workstreamProjectFromRow,
    ),
    workstreamMilestones: (workstreamMilestonesResult.data ?? []).map(
      workstreamMilestoneFromRow,
    ),
    workstreamActions: (workstreamActionsResult.data ?? []).map(
      workstreamActionFromRow,
    ),
    workstreamActionProjects: (workstreamActionProjectsResult.data ?? []).map(
      workstreamActionProjectFromRow,
    ),
    workstreamActionDependencies: (
      workstreamActionDependenciesResult.data ?? []
    ).map(workstreamActionDependencyFromRow),
    knowledgeDocuments: (knowledgeDocumentsResult.data ?? []).map(
      knowledgeDocumentFromRow,
    ),
  };

  return incomingSnapshot;
}

export async function pullSnapshot(
  transport: SnapshotTransport,
  localSnapshot: LocalDataSnapshot,
  userId: string,
): Promise<LocalDataSnapshot> {
  const incomingSnapshot = await fetchIncomingSnapshot(transport, userId);
  return mergeSnapshot(localSnapshot, incomingSnapshot);
}

export async function pullSnapshotAuthoritative(
  transport: SnapshotTransport,
  localSnapshot: LocalDataSnapshot,
  userId: string,
): Promise<LocalDataSnapshot> {
  const incomingSnapshot = await fetchIncomingSnapshot(transport, userId);
  return mergeAuthoritativeSnapshot(localSnapshot, incomingSnapshot);
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
  workstreams: WorkstreamRow[];
  workstreamProjects: WorkstreamProjectRow[];
  workstreamMilestones: WorkstreamMilestoneRow[];
  workstreamActions: WorkstreamActionRow[];
  workstreamActionProjects: WorkstreamActionProjectRow[];
  workstreamActionDependencies: WorkstreamActionDependencyRow[];
  knowledgeDocuments: KnowledgeDocumentRow[];
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
    workstreams: localSnapshot.workstreams
      .filter(isOwnedByCurrentDevice)
      .map((workstream) => workstreamToRow(workstream, context.userId)),
    workstreamProjects: localSnapshot.workstreamProjects
      .filter(isOwnedByCurrentDevice)
      .map((link) => workstreamProjectToRow(link, context.userId)),
    workstreamMilestones: localSnapshot.workstreamMilestones
      .filter(isOwnedByCurrentDevice)
      .map((milestone) =>
        workstreamMilestoneToRow(milestone, context.userId),
      ),
    workstreamActions: localSnapshot.workstreamActions
      .filter(isOwnedByCurrentDevice)
      .map((action) => workstreamActionToRow(action, context.userId)),
    workstreamActionProjects: localSnapshot.workstreamActionProjects
      .filter(isOwnedByCurrentDevice)
      .map((link) =>
        workstreamActionProjectToRow(link, context.userId),
      ),
    workstreamActionDependencies: localSnapshot.workstreamActionDependencies
      .filter(isOwnedByCurrentDevice)
      .map((dependency) =>
        workstreamActionDependencyToRow(dependency, context.userId),
      ),
    knowledgeDocuments: localSnapshot.knowledgeDocuments
      .filter(isOwnedByCurrentDevice)
      .map((document) => knowledgeDocumentToRow(document, context.userId)),
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
    { tableName: "workstreams", rows: payload.workstreams },
    { tableName: "notes", rows: payload.notes },
    { tableName: "tasks", rows: payload.tasks },
    // Parents must arrive before children so the composite ownership FK is
    // satisfied on every device, including a first sync of a new project.
    { tableName: "project_milestones", rows: payload.projectMilestones },
    { tableName: "project_actions", rows: payload.projectActions },
    { tableName: "project_ideas", rows: payload.projectIdeas },
    { tableName: "project_history", rows: payload.projectHistory },
    { tableName: "workstream_projects", rows: payload.workstreamProjects },
    { tableName: "workstream_milestones", rows: payload.workstreamMilestones },
    { tableName: "workstream_actions", rows: payload.workstreamActions },
    {
      tableName: "workstream_action_projects",
      rows: payload.workstreamActionProjects,
    },
    {
      tableName: "workstream_action_dependencies",
      rows: payload.workstreamActionDependencies,
    },
    { tableName: "knowledge_documents", rows: payload.knowledgeDocuments },
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
