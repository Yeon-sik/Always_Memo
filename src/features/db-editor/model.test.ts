import { describe, expect, it } from "vitest";
import {
  createRequestGenerationGuard,
  getRowChanges,
  getColumnValueKind,
  initialDbEditorModel,
  isEditableTable,
  isProtectedColumn,
  nextPage,
  normalizeDbEditorError,
  parseColumnDraftValue,
  paginationControls,
  previousPage,
  resetForPatChange,
  selectProject,
  selectSchema,
  selectTable,
  setResourceError,
  setResourceLoading,
  setRowsPage,
  type DbEditorModelState,
} from "./model";
import type { DbEditorColumn, DbEditorTableMetadata } from "./types";

describe("db editor navigator", () => {
  it("resets dependent selection when project, schema, or table changes", () => {
    const projectSelected = selectProject(initialDbEditorModel, "project-a");
    const schemaSelected = selectSchema(projectSelected, "public");
    const tableSelected = selectTable(schemaSelected, "records");

    expect(tableSelected.navigator).toEqual({
      selectedProjectRef: "project-a",
      selectedSchema: "public",
      selectedTableName: "records",
    });
    expect(selectProject(tableSelected, "project-b").navigator).toEqual({
      selectedProjectRef: "project-b",
      selectedSchema: null,
      selectedTableName: null,
    });
    expect(selectSchema(tableSelected, "private").navigator).toEqual({
      selectedProjectRef: "project-a",
      selectedSchema: "private",
      selectedTableName: null,
    });
  });
});

describe("db editor pagination", () => {
  it("moves only within available pages", () => {
    const firstPage = { page: 0, pageSize: 50, hasNext: true };
    const secondPage = nextPage(firstPage);

    expect(secondPage.page).toBe(1);
    expect(paginationControls(secondPage)).toEqual({
      canPrevious: true,
      canNext: true,
      label: "페이지 2",
    });
    expect(previousPage(secondPage).page).toBe(0);
    expect(nextPage({ ...secondPage, hasNext: false })).toEqual({
      ...secondPage,
      hasNext: false,
    });
  });

  it("uses server page data as the source of truth", () => {
    const state = setRowsPage(initialDbEditorModel, {
      page: 3,
      pageSize: 25,
      hasNext: false,
      rows: [{ id: 1 }],
    });

    expect(state.pagination).toEqual({
      page: 3,
      pageSize: 25,
      hasNext: false,
    });
    expect(state.rows?.rows).toEqual([{ id: 1 }]);
  });
});

describe("db editor request state", () => {
  it("transitions a resource through loading and error without losing selection", () => {
    const selected = selectTable(
      selectSchema(selectProject(initialDbEditorModel, "project-a"), "public"),
      "records",
    );
    const loading = setResourceLoading(selected, "rows");
    const failed = setResourceError(loading, "rows", {
      code: "timeout",
      message: "요청 시간이 초과되었습니다.",
      status: null,
      retryAfterSeconds: null,
    });

    expect(loading.resources.rows.status).toBe("loading");
    expect(failed.resources.rows).toEqual({
      status: "error",
      error: {
        code: "timeout",
        message: "요청 시간이 초과되었습니다.",
        status: null,
        retryAfterSeconds: null,
      },
    });
    expect(failed.navigator.selectedTableName).toBe("records");
  });

  it("normalizes structured and unknown errors", () => {
    expect(
      normalizeDbEditorError({
        code: "permissionDenied",
        message: "권한 없음",
      }),
    ).toEqual({
      code: "permissionDenied",
      message: "권한 없음",
      status: null,
      retryAfterSeconds: null,
    });
    expect(normalizeDbEditorError(null).code).toBe("unknown");
  });
});

describe("db editor stale request guard", () => {
  it("ignores a stale metadata response after a newer table request", () => {
    const guard = createRequestGenerationGuard();
    const tableA = guard.begin("metadata");
    const tableB = guard.begin("metadata");

    expect(guard.isCurrent(tableA)).toBe(false);
    expect(guard.isCurrent(tableB)).toBe(true);
  });

  it("ignores a rows response after the selected table is invalidated", () => {
    const guard = createRequestGenerationGuard();
    const tableARows = guard.begin("rows");

    guard.invalidate(["rows"]);

    expect(guard.isCurrent(tableARows)).toBe(false);
  });

  it("ignores an in-flight row update after the selected row changes", () => {
    const guard = createRequestGenerationGuard();
    const firstUpdate = guard.begin("rowUpdate");

    guard.invalidate(["rowUpdate"]);

    expect(guard.isCurrent(firstUpdate)).toBe(false);
  });
});

describe("db editor row update values", () => {
  const column = (
    name: string,
    dataType: string,
    overrides: Partial<DbEditorColumn> = {},
  ): DbEditorColumn => ({
    name,
    ordinalPosition: 1,
    dataType,
    udtName: dataType,
    isNullable: false,
    defaultExpression: null,
    isIdentity: false,
    isGenerated: false,
    isPrimaryKey: false,
    primaryKeyPosition: null,
    ...overrides,
  });

  it("parses JSON only when the draft is valid JSON", () => {
    const payload = column("payload", "jsonb", { isNullable: true });

    expect(getColumnValueKind(payload)).toBe("json");
    expect(parseColumnDraftValue(payload, '{"ok":true}')).toEqual({
      value: { ok: true },
      error: null,
    });
    expect(parseColumnDraftValue(payload, '{"ok":')).toEqual({
      value: null,
      error: "JSON 형식이 올바르지 않습니다.",
    });
  });

  it("keeps SQL NULL distinct from an empty string and returns only changed columns", () => {
    const metadata: DbEditorTableMetadata = {
      schema: "public",
      name: "records",
      tableType: "BASE TABLE",
      columns: [
        column("id", "uuid", { isPrimaryKey: true, primaryKeyPosition: 1 }),
        column("label", "text", { isNullable: true }),
      ],
      primaryKey: ["id"],
    };
    const original = { id: "11111111-1111-1111-1111-111111111111", label: "" };
    const draft = { ...original, label: null };

    expect(getRowChanges(metadata, original, draft)).toEqual([
      { name: "label", value: null },
    ]);
    expect(isEditableTable(metadata)).toBe(true);
    expect(isProtectedColumn(metadata.columns[0])).toBe(true);
    expect(isProtectedColumn(metadata.columns[1])).toBe(false);
  });
});

describe("db editor PAT reset", () => {
  it("discards the complete explorer state when the PAT changes", () => {
    const populated: DbEditorModelState = {
      ...initialDbEditorModel,
      patConfigured: true,
      patVerified: true,
      projects: [
        {
          id: null,
          projectRef: "project-a",
          name: "Project A",
          organizationId: null,
          organizationSlug: null,
          region: null,
          status: null,
        },
      ],
      schemas: [{ name: "public" }],
      tables: [{ schema: "public", name: "records", tableType: "BASE TABLE" }],
      metadata: {
        schema: "public",
        name: "records",
        tableType: "BASE TABLE",
        columns: [],
        primaryKey: [],
      },
      rows: { page: 2, pageSize: 25, hasNext: true, rows: [{ id: 1 }] },
      navigator: {
        selectedProjectRef: "project-a",
        selectedSchema: "public",
        selectedTableName: "records",
      },
      pagination: { page: 2, pageSize: 25, hasNext: true },
    };

    const reset = resetForPatChange(true);

    expect(reset.projects).toEqual([]);
    expect(reset.schemas).toEqual([]);
    expect(reset.tables).toEqual([]);
    expect(reset.metadata).toBeNull();
    expect(reset.rows).toBeNull();
    expect(reset.navigator).toEqual(initialDbEditorModel.navigator);
    expect(reset.pagination).toEqual(initialDbEditorModel.pagination);
    expect(reset.patVerified).toBe(false);
    expect(reset.resources).toEqual({
      ...initialDbEditorModel.resources,
      pat: { status: "ready", error: null },
    });
  });
});
