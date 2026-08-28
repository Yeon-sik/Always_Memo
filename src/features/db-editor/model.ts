import type {
  DbEditorError,
  DbEditorLoadStatus,
  DbEditorProject,
  DbEditorRowsPage,
  DbEditorSchema,
  DbEditorTable,
  DbEditorTableMetadata,
} from "./types";

export type DbEditorResource =
  | "pat"
  | "projects"
  | "schemas"
  | "tables"
  | "metadata"
  | "rows";

export interface DbEditorRequestToken {
  resource: DbEditorResource;
  generation: number;
}

export interface DbEditorRequestGenerationGuard {
  begin(resource: DbEditorResource): DbEditorRequestToken;
  invalidate(resources: readonly DbEditorResource[]): void;
  isCurrent(token: DbEditorRequestToken): boolean;
}

export interface DbEditorNavigatorState {
  selectedProjectRef: string | null;
  selectedSchema: string | null;
  selectedTableName: string | null;
}

export interface DbEditorPaginationState {
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface DbEditorResourceState {
  status: DbEditorLoadStatus;
  error: DbEditorError | null;
}

export interface DbEditorModelState {
  patConfigured: boolean;
  patVerified: boolean;
  projects: DbEditorProject[];
  schemas: DbEditorSchema[];
  tables: DbEditorTable[];
  metadata: DbEditorTableMetadata | null;
  rows: DbEditorRowsPage | null;
  navigator: DbEditorNavigatorState;
  pagination: DbEditorPaginationState;
  resources: Record<DbEditorResource, DbEditorResourceState>;
}

export const DEFAULT_DB_EDITOR_PAGE_SIZE = 50;

function resourceState(): DbEditorResourceState {
  return { status: "idle", error: null };
}

export const initialDbEditorModel: DbEditorModelState = {
  patConfigured: false,
  patVerified: false,
  projects: [],
  schemas: [],
  tables: [],
  metadata: null,
  rows: null,
  navigator: {
    selectedProjectRef: null,
    selectedSchema: null,
    selectedTableName: null,
  },
  pagination: {
    page: 0,
    pageSize: DEFAULT_DB_EDITOR_PAGE_SIZE,
    hasNext: false,
  },
  resources: {
    pat: resourceState(),
    projects: resourceState(),
    schemas: resourceState(),
    tables: resourceState(),
    metadata: resourceState(),
    rows: resourceState(),
  },
};

export function createRequestGenerationGuard(): DbEditorRequestGenerationGuard {
  const generations = new Map<DbEditorResource, number>();

  const currentGeneration = (resource: DbEditorResource) =>
    generations.get(resource) ?? 0;

  return {
    begin(resource) {
      const generation = currentGeneration(resource) + 1;
      generations.set(resource, generation);
      return { resource, generation };
    },
    invalidate(resources) {
      for (const resource of resources) {
        generations.set(resource, currentGeneration(resource) + 1);
      }
    },
    isCurrent(token) {
      return currentGeneration(token.resource) === token.generation;
    },
  };
}

export function resetForPatChange(
  configured: boolean,
  error: DbEditorError | null = null,
): DbEditorModelState {
  return {
    ...initialDbEditorModel,
    patConfigured: configured,
    patVerified: false,
    resources: {
      ...initialDbEditorModel.resources,
      pat: { status: "ready", error },
    },
  };
}

export function selectProject(
  state: DbEditorModelState,
  projectRef: string | null,
): DbEditorModelState {
  return {
    ...state,
    navigator: {
      selectedProjectRef: projectRef,
      selectedSchema: null,
      selectedTableName: null,
    },
    schemas: [],
    tables: [],
    metadata: null,
    rows: null,
    pagination: { ...state.pagination, page: 0, hasNext: false },
  };
}

export function selectSchema(
  state: DbEditorModelState,
  schema: string | null,
): DbEditorModelState {
  return {
    ...state,
    navigator: {
      ...state.navigator,
      selectedSchema: schema,
      selectedTableName: null,
    },
    tables: [],
    metadata: null,
    rows: null,
    pagination: { ...state.pagination, page: 0, hasNext: false },
  };
}

export function selectTable(
  state: DbEditorModelState,
  tableName: string | null,
): DbEditorModelState {
  return {
    ...state,
    navigator: { ...state.navigator, selectedTableName: tableName },
    metadata: null,
    rows: null,
    pagination: { ...state.pagination, page: 0, hasNext: false },
  };
}

export function setResourceLoading(
  state: DbEditorModelState,
  resource: DbEditorResource,
): DbEditorModelState {
  return {
    ...state,
    resources: {
      ...state.resources,
      [resource]: { status: "loading", error: null },
    },
  };
}

export function setResourceReady(
  state: DbEditorModelState,
  resource: DbEditorResource,
): DbEditorModelState {
  return {
    ...state,
    resources: {
      ...state.resources,
      [resource]: { status: "ready", error: null },
    },
  };
}

export function setResourceError(
  state: DbEditorModelState,
  resource: DbEditorResource,
  error: DbEditorError,
): DbEditorModelState {
  return {
    ...state,
    resources: {
      ...state.resources,
      [resource]: { status: "error", error },
    },
  };
}

export function setRowsPage(
  state: DbEditorModelState,
  rows: DbEditorRowsPage,
): DbEditorModelState {
  return {
    ...setResourceReady(state, "rows"),
    rows,
    pagination: {
      page: rows.page,
      pageSize: rows.pageSize,
      hasNext: rows.hasNext,
    },
  };
}

export function paginationControls(
  pagination: DbEditorPaginationState,
): { canPrevious: boolean; canNext: boolean; label: string } {
  return {
    canPrevious: pagination.page > 0,
    canNext: pagination.hasNext,
    label: "페이지 " + (pagination.page + 1),
  };
}

export function nextPage(
  pagination: DbEditorPaginationState,
): DbEditorPaginationState {
  return pagination.hasNext
    ? { ...pagination, page: pagination.page + 1 }
    : pagination;
}

export function previousPage(
  pagination: DbEditorPaginationState,
): DbEditorPaginationState {
  return pagination.page > 0
    ? { ...pagination, page: pagination.page - 1, hasNext: true }
    : pagination;
}

export function normalizeDbEditorError(caughtError: unknown): DbEditorError {
  if (
    typeof caughtError === "object" &&
    caughtError !== null &&
    "message" in caughtError &&
    typeof caughtError.message === "string"
  ) {
    const candidate = caughtError as Partial<DbEditorError>;
    return {
      code: candidate.code ?? "unknown",
      message: candidate.message ?? "DB Editor 요청에 실패했습니다.",
      status: candidate.status ?? null,
      retryAfterSeconds: candidate.retryAfterSeconds ?? null,
    };
  }

  if (typeof caughtError === "string") {
    return {
      code: "unknown",
      message: caughtError,
      status: null,
      retryAfterSeconds: null,
    };
  }

  return {
    code: "unknown",
    message: "DB Editor 요청에 실패했습니다.",
    status: null,
    retryAfterSeconds: null,
  };
}
