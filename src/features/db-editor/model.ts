import type {
  DbEditorError,
  DbEditorColumn,
  DbEditorColumnChange,
  DbEditorJsonValue,
  DbEditorLoadStatus,
  DbEditorProject,
  DbEditorRow,
  DbEditorRowIdentity,
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
  | "rows"
  | "rowUpdate";

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

export interface DbEditorRowInspectorState {
  original: DbEditorRow;
  draft: DbEditorRow;
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
    rowUpdate: resourceState(),
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

export type DbEditorColumnValueKind =
  | "text"
  | "number"
  | "boolean"
  | "timestamp"
  | "date"
  | "uuid"
  | "json"
  | "unsupported";

export function getColumnValueKind(
  column: DbEditorColumn,
): DbEditorColumnValueKind {
  const dataType = column.dataType.trim().toLowerCase();
  const udtName = column.udtName.trim().toLowerCase();

  if (dataType === "json" || dataType === "jsonb" || udtName === "json" || udtName === "jsonb") {
    return "json";
  }
  if (dataType === "boolean" || udtName === "bool") {
    return "boolean";
  }
  if (dataType === "uuid" || udtName === "uuid") {
    return "uuid";
  }
  if (dataType === "date") {
    return "date";
  }
  if (dataType.startsWith("timestamp")) {
    return "timestamp";
  }
  if (
    [
      "smallint",
      "integer",
      "bigint",
      "real",
      "double precision",
      "numeric",
      "decimal",
    ].includes(dataType) || ["int2", "int4", "int8", "float4", "float8"].includes(udtName)
  ) {
    return "number";
  }
  if (
    ["text", "character varying", "character", "varchar", "char", "bpchar", "name"].includes(
      dataType,
    ) || udtName === "citext"
  ) {
    return "text";
  }

  return "unsupported";
}

export function isProtectedColumn(column: DbEditorColumn): boolean {
  return (
    column.isPrimaryKey ||
    column.isIdentity ||
    column.isGenerated ||
    column.defaultExpression !== null
  );
}

export function isEditableTable(metadata: DbEditorTableMetadata): boolean {
  return metadata.tableType.trim().toUpperCase() === "BASE TABLE" && metadata.primaryKey.length > 0;
}

export function isDbEditorJsonValue(value: unknown): value is DbEditorJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isDbEditorJsonValue);
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isDbEditorJsonValue);
  }
  return false;
}

export function cloneDbEditorValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneDbEditorValue(item)) as T;
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        cloneDbEditorValue(item),
      ]),
    ) as T;
  }
  return value;
}

export function areDbEditorValuesEqual(first: unknown, second: unknown): boolean {
  if (Object.is(first, second)) {
    return true;
  }
  if (Array.isArray(first) && Array.isArray(second)) {
    return first.length === second.length && first.every((value, index) => areDbEditorValuesEqual(value, second[index]));
  }
  if (
    typeof first === "object" &&
    first !== null &&
    typeof second === "object" &&
    second !== null &&
    !Array.isArray(first) &&
    !Array.isArray(second)
  ) {
    const firstRecord = first as Record<string, unknown>;
    const secondRecord = second as Record<string, unknown>;
    const firstKeys = Object.keys(firstRecord).sort();
    const secondKeys = Object.keys(secondRecord).sort();
    return (
      firstKeys.length === secondKeys.length &&
      firstKeys.every(
        (key, index) => key === secondKeys[index] && areDbEditorValuesEqual(firstRecord[key], secondRecord[key]),
      )
    );
  }
  return false;
}

export function getRowIdentity(
  metadata: DbEditorTableMetadata,
  row: DbEditorRow,
): DbEditorRowIdentity | null {
  if (metadata.primaryKey.length === 0) {
    return null;
  }

  const values: Array<[string, DbEditorJsonValue]> = [];
  for (const columnName of metadata.primaryKey) {
    const value = row[columnName];
    if (value === null || value === undefined || !isDbEditorJsonValue(value)) {
      return null;
    }
    values.push([columnName, cloneDbEditorValue(value)]);
  }
  return { values };
}

function isUuid(value: string): boolean {
  return /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/i.test(
    value,
  );
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const daysInMonth = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
  return daysInMonth !== undefined && day >= 1 && day <= daysInMonth;
}

function isTimestamp(value: string): boolean {
  return value.length > 10 && isIsoDate(value.slice(0, 10)) && /[T ]/.test(value.slice(10));
}

export function parseColumnDraftValue(
  column: DbEditorColumn,
  input: string,
): { value: DbEditorJsonValue | null; error: string | null } {
  const kind = getColumnValueKind(column);
  if (kind === "text") {
    return { value: input, error: null };
  }
  if (kind === "number") {
    if (!input.trim()) {
      return { value: null, error: "숫자를 입력하세요. 빈 문자열은 숫자가 아닙니다." };
    }
    const value = Number(input);
    const isInteger = ["smallint", "integer", "bigint"].includes(column.dataType.toLowerCase()) || ["int2", "int4", "int8"].includes(column.udtName.toLowerCase());
    if (!Number.isFinite(value) || (isInteger && !Number.isInteger(value))) {
      return { value: null, error: "유효한 숫자를 입력하세요." };
    }
    return { value, error: null };
  }
  if (kind === "boolean") {
    if (input === "true") {
      return { value: true, error: null };
    }
    if (input === "false") {
      return { value: false, error: null };
    }
    return { value: null, error: "boolean 값을 선택하세요." };
  }
  if (kind === "uuid") {
    return isUuid(input)
      ? { value: input, error: null }
      : { value: null, error: "유효한 UUID를 입력하세요." };
  }
  if (kind === "date") {
    return isIsoDate(input)
      ? { value: input, error: null }
      : { value: null, error: "YYYY-MM-DD 형식의 날짜를 입력하세요." };
  }
  if (kind === "timestamp") {
    return isTimestamp(input)
      ? { value: input, error: null }
      : { value: null, error: "유효한 timestamp 값을 입력하세요." };
  }
  if (kind === "json") {
    try {
      const value: unknown = JSON.parse(input);
      return isDbEditorJsonValue(value)
        ? { value, error: null }
        : { value: null, error: "JSON 값만 입력할 수 있습니다." };
    } catch {
      return { value: null, error: "JSON 형식이 올바르지 않습니다." };
    }
  }
  return { value: null, error: "이 컬럼 타입은 수정할 수 없습니다." };
}

export function serializeColumnDraftValue(
  column: DbEditorColumn,
  value: unknown,
): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (getColumnValueKind(column) === "json") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  }
  return String(value);
}

export function getRowChanges(
  metadata: DbEditorTableMetadata,
  original: DbEditorRow,
  draft: DbEditorRow,
): DbEditorColumnChange[] {
  return metadata.columns.flatMap((column) => {
    const value = draft[column.name];
    if (areDbEditorValuesEqual(original[column.name], value) || !isDbEditorJsonValue(value)) {
      return [];
    }
    return [{ name: column.name, value }];
  });
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
