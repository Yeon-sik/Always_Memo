import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Table2,
  Trash2,
} from "lucide-react";
import { useEffect } from "react";
import { paginationControls } from "./model";
import { useDbEditor } from "./useDbEditor";
import type { DbEditorColumn, DbEditorError, DbEditorRow } from "./types";

function LoadingLabel({ label = "불러오는 중" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400">
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      {label}
    </span>
  );
}

function ErrorMessage({ error }: { error: DbEditorError | null }) {
  if (!error) {
    return null;
  }

  const retryAfter =
    error.retryAfterSeconds === null
      ? ""
      : " 잠시 후 다시 시도하세요 (" +
        error.retryAfterSeconds +
        "초).";

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        {error.message}
        {retryAfter}
      </span>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[표시할 수 없음]";
    }
  }

  return String(value);
}

function ColumnFlags({ column }: { column: DbEditorColumn }) {
  const flags = [
    column.isPrimaryKey ? "PK" : null,
    column.isIdentity ? "identity" : null,
    column.isGenerated ? "generated" : null,
  ].filter(Boolean);

  if (flags.length === 0) {
    return null;
  }

  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {flags.map((flag) => (
        <span
          key={flag}
          className="rounded border border-teal-200 bg-teal-50 px-1 py-0.5 text-[10px] font-semibold text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200"
        >
          {flag}
        </span>
      ))}
    </span>
  );
}

function MetadataPanel({
  columns,
  primaryKey,
}: {
  columns: DbEditorColumn[];
  primaryKey: string[];
}) {
  return (
    <section className="border-b border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-neutral-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
            컬럼 메타데이터
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            {columns.length}개 컬럼 ·{" "}
            {primaryKey.length > 0
              ? "PK: " + primaryKey.join(", ")
              : "PK 없음 · 페이지 순서 비결정적 · Phase 1 읽기 전용"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:border-neutral-700 dark:text-neutral-300">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          metadata allowlist
        </span>
      </div>
      <div className="max-h-48 overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-[11px] text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-semibold">컬럼</th>
              <th className="px-4 py-2 font-semibold">타입</th>
              <th className="px-4 py-2 font-semibold">NULL</th>
              <th className="px-4 py-2 font-semibold">기본값</th>
              <th className="px-4 py-2 font-semibold">수정 제한</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => (
              <tr
                key={column.name}
                className="border-t border-slate-100 dark:border-neutral-900"
              >
                <td className="px-4 py-2 font-medium text-slate-900 dark:text-neutral-100">
                  {column.name}
                  <ColumnFlags column={column} />
                </td>
                <td className="px-4 py-2 text-slate-600 dark:text-neutral-300">
                  {column.dataType}
                  {column.udtName !== column.dataType
                    ? " (" + column.udtName + ")"
                    : ""}
                </td>
                <td className="px-4 py-2 text-slate-600 dark:text-neutral-300">
                  {column.isNullable ? "YES" : "NO"}
                </td>
                <td className="max-w-[260px] truncate px-4 py-2 text-slate-600 dark:text-neutral-300">
                  {column.defaultExpression ?? "—"}
                </td>
                <td className="px-4 py-2 text-slate-500 dark:text-neutral-400">
                  Phase 1 읽기 전용
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RowsPanel({
  columns,
  rows,
  page,
  pageSize,
  hasNext,
  isLoading,
  onRefresh,
  onPrevious,
  onNext,
}: {
  columns: DbEditorColumn[];
  rows: DbEditorRow[];
  page: number;
  pageSize: number;
  hasNext: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const controls = paginationControls({ page, pageSize, hasNext });
  const columnNames = columns.map((column) => column.name);
  const visibleColumns =
    columnNames.length > 0
      ? columnNames
      : Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-slate-50 dark:bg-black">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
            행 데이터
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            {rows.length === 0
              ? "현재 페이지에 행이 없습니다."
              : "최대 " + pageSize + "행 표시 · 원격 데이터"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-teal-500 disabled:cursor-wait disabled:opacity-60 dark:border-neutral-700 dark:bg-black dark:text-neutral-200"
          >
            <RefreshCw
              className={isLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
              aria-hidden="true"
            />
            새로고침
          </button>
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={onPrevious}
              disabled={!controls.canPrevious || isLoading}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-black dark:text-neutral-200"
              aria-label="이전 페이지"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-16 text-center text-xs font-semibold text-slate-600 dark:text-neutral-300">
              {controls.label}
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={!controls.canNext || isLoading}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-black dark:text-neutral-200"
              aria-label="다음 페이지"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-32 items-center justify-center">
          <LoadingLabel label="행을 불러오는 중" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex min-h-32 items-center justify-center px-4 text-center text-xs text-slate-500 dark:text-neutral-400">
          현재 페이지에 표시할 행이 없습니다.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 text-[11px] text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                {visibleColumns.map((columnName) => (
                  <th
                    key={columnName}
                    className="whitespace-nowrap border-b border-slate-200 px-4 py-2 font-semibold dark:border-neutral-800"
                  >
                    {columnName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-slate-100 bg-white align-top dark:border-neutral-900 dark:bg-neutral-950"
                >
                  {visibleColumns.map((columnName) => (
                    <td
                      key={columnName}
                      className="max-w-[360px] whitespace-pre-wrap break-words px-4 py-2 text-slate-700 dark:text-neutral-200"
                    >
                      {formatCell(row[columnName])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function DbEditorApp() {
  const editor = useDbEditor();
  const {
    projects,
    schemas,
    tables,
    metadata,
    rows,
    navigator,
    resources,
    pagination,
    patInput,
    patConfigured,
    patVerified,
    isOnline,
  } = editor;

  const selectedProject = projects.find(
    (project) => project.projectRef === navigator.selectedProjectRef,
  );

  useEffect(() => {
    if (patVerified && resources.projects.status === "idle") {
      void editor.loadProjects();
    }
  }, [editor.loadProjects, patVerified, resources.projects.status]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-slate-100 text-slate-900 dark:bg-black dark:text-neutral-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white dark:bg-teal-500 dark:text-black">
            <Database className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">
              Personal OS · Supabase DB Editor
            </h1>
            <p className="truncate text-xs text-slate-500 dark:text-neutral-400">
              Rust adapter 기반 online-only read-only Phase 1
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={
              isOnline
                ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            }
          >
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
            {isOnline ? "온라인" : "오프라인 · 요청 불가"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 dark:border-neutral-700 dark:text-neutral-300">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            React에는 PAT 미보관
          </span>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-4">
        <div className="flex min-h-full w-full flex-col gap-4">
          <section className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <KeyRound
                  className="mt-0.5 h-4 w-4 text-teal-700 dark:text-teal-300"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="text-sm font-semibold">Supabase PAT</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                    PAT는 OS Credential Store에만 저장됩니다. 입력값은 저장 후
                    React 상태에서 제거됩니다.
                  </p>
                </div>
              </div>
              {patConfigured ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  저장됨{patVerified ? " · 검증됨" : ""}
                </span>
              ) : (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  PAT 필요
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="password"
                value={patInput}
                onChange={(event) => editor.setPatInput(event.target.value)}
                placeholder="Supabase PAT 입력"
                autoComplete="off"
                spellCheck={false}
                className="field-input max-w-xl"
                aria-label="Supabase PAT"
              />
              <button
                type="button"
                onClick={() => void editor.savePat()}
                disabled={!patInput.trim() || resources.pat.status === "loading"}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500 dark:text-black dark:hover:bg-teal-400"
              >
                {resources.pat.status === "loading" ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                저장
              </button>
              <button
                type="button"
                onClick={() => void editor.verifyPat()}
                disabled={
                  !patConfigured || resources.pat.status === "loading" || !isOnline
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-teal-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-black dark:text-neutral-200"
              >
                검증
              </button>
              <button
                type="button"
                onClick={() => void editor.deletePat()}
                disabled={!patConfigured || resources.pat.status === "loading"}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:bg-black dark:text-red-200"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                삭제
              </button>
              {resources.pat.status === "loading" ? (
                <LoadingLabel label="PAT 상태 확인 중" />
              ) : null}
            </div>
            <div className="mt-3">
              <ErrorMessage error={resources.pat.error} />
            </div>
          </section>

          {!patConfigured ? (
            <section className="flex min-h-64 flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-5 text-center dark:border-neutral-800 dark:bg-neutral-950">
              <div className="max-w-md">
                <Database
                  className="mx-auto h-8 w-8 text-slate-400"
                  aria-hidden="true"
                />
                <h2 className="mt-3 text-sm font-semibold">
                  PAT를 저장하면 DB 탐색을 시작할 수 있습니다.
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-neutral-400">
                  Phase 1에서는 OAuth, Raw SQL, INSERT/UPDATE/DELETE를 제공하지
                  않습니다.
                </p>
              </div>
            </section>
          ) : (
            <>
              <section className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-teal-700 dark:text-teal-300" aria-hidden="true" />
                    <h2 className="text-sm font-semibold">접근 가능한 프로젝트</h2>
                    {resources.projects.status === "loading" ? (
                      <LoadingLabel label="조회 중" />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void editor.loadProjects()}
                    disabled={resources.projects.status === "loading" || !isOnline}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-teal-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-black dark:text-neutral-200"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    프로젝트 새로고침
                  </button>
                </div>
                <div className="mt-3">
                  <ErrorMessage error={resources.projects.error} />
                </div>
                {resources.projects.status === "ready" && projects.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500 dark:text-neutral-400">
                    이 PAT로 접근 가능한 프로젝트가 없습니다.
                  </p>
                ) : (
                  <select
                    value={navigator.selectedProjectRef ?? ""}
                    onChange={(event) =>
                      void editor.selectProject(event.target.value || null)
                    }
                    disabled={projects.length === 0 || resources.projects.status === "loading"}
                    className="field-input mt-3 max-w-2xl"
                    aria-label="Supabase 프로젝트"
                  >
                    <option value="">프로젝트를 선택하세요</option>
                    {projects.map((project) => (
                      <option key={project.projectRef} value={project.projectRef}>
                        {project.name} · {project.projectRef}
                      </option>
                    ))}
                  </select>
                )}
              </section>

              {selectedProject ? (
                <section className="grid min-h-[560px] min-w-0 flex-1 grid-cols-[220px_260px_minmax(0,1fr)] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                  <aside className="min-h-0 overflow-y-auto border-r border-slate-200 dark:border-neutral-800">
                    <div className="sticky top-0 border-b border-slate-200 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                        Schemas
                      </h2>
                      <p className="mt-1 truncate text-xs font-medium text-slate-800 dark:text-neutral-200">
                        {selectedProject.name}
                      </p>
                    </div>
                    {resources.schemas.status === "loading" ? (
                      <div className="p-3"><LoadingLabel label="스키마 조회 중" /></div>
                    ) : null}
                    <ErrorMessage error={resources.schemas.error} />
                    {resources.schemas.status === "ready" && schemas.length === 0 ? (
                      <p className="p-3 text-xs leading-5 text-slate-500 dark:text-neutral-400">
                        편집 가능한 스키마가 없습니다. 시스템 스키마는 차단됩니다.
                      </p>
                    ) : (
                      <div className="space-y-1 p-2">
                        {schemas.map((schema) => (
                          <button
                            key={schema.name}
                            type="button"
                            onClick={() => void editor.selectSchema(schema.name)}
                            className={
                              navigator.selectedSchema === schema.name
                                ? "flex w-full items-center gap-2 rounded-md bg-teal-50 px-2.5 py-2 text-left text-xs font-semibold text-teal-900 dark:bg-teal-950/40 dark:text-teal-100"
                                : "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
                            }
                          >
                            <Database className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">{schema.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </aside>

                  <aside className="min-h-0 overflow-y-auto border-r border-slate-200 dark:border-neutral-800">
                    <div className="sticky top-0 border-b border-slate-200 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                          Tables
                        </h2>
                        {resources.tables.status === "loading" ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin text-slate-400" aria-label="테이블 조회 중" />
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-xs font-medium text-slate-800 dark:text-neutral-200">
                        {navigator.selectedSchema ?? "스키마를 선택하세요"}
                      </p>
                    </div>
                    <ErrorMessage error={resources.tables.error} />
                    {resources.tables.status === "ready" && tables.length === 0 ? (
                      <p className="p-3 text-xs leading-5 text-slate-500 dark:text-neutral-400">
                        선택한 스키마에 접근 가능한 테이블이 없습니다.
                      </p>
                    ) : (
                      <div className="space-y-1 p-2">
                        {tables.map((table) => (
                          <button
                            key={table.name}
                            type="button"
                            onClick={() => void editor.selectTable(table.name)}
                            className={
                              navigator.selectedTableName === table.name
                                ? "flex w-full items-center gap-2 rounded-md bg-teal-50 px-2.5 py-2 text-left text-xs font-semibold text-teal-900 dark:bg-teal-950/40 dark:text-teal-100"
                                : "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
                            }
                          >
                            <Table2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 truncate">{table.name}</span>
                            <span className="ml-auto text-[10px] text-slate-400">
                              {table.tableType === "VIEW" ? "view" : "table"}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </aside>

                  <section className="flex min-w-0 min-h-0 flex-col">
                    {!navigator.selectedTableName ? (
                      <div className="flex min-h-64 flex-1 items-center justify-center px-5 text-center text-xs text-slate-500 dark:text-neutral-400">
                        테이블을 선택하면 컬럼 메타데이터와 행을 조회합니다.
                      </div>
                    ) : resources.metadata.status === "loading" ? (
                      <div className="flex min-h-64 flex-1 items-center justify-center">
                        <LoadingLabel label="컬럼 메타데이터 조회 중" />
                      </div>
                    ) : (
                      <>
                        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-neutral-800">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {navigator.selectedSchema}.{navigator.selectedTableName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                              SELECT only · CRUD mutation commands are not registered
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:border-neutral-700 dark:text-neutral-300">
                            {metadata?.tableType ?? "table"}
                          </span>
                        </div>
                        <ErrorMessage error={resources.metadata.error} />
                        {metadata ? (
                          <>
                            <MetadataPanel
                              columns={metadata.columns}
                              primaryKey={metadata.primaryKey}
                            />
                            <ErrorMessage error={resources.rows.error} />
                            <RowsPanel
                              columns={metadata.columns}
                              rows={rows?.rows ?? []}
                              page={pagination.page}
                              pageSize={pagination.pageSize}
                              hasNext={pagination.hasNext}
                              isLoading={resources.rows.status === "loading"}
                              onRefresh={() => void editor.refreshRows()}
                              onPrevious={() =>
                                void editor.refreshRows(Math.max(0, pagination.page - 1))
                              }
                              onNext={() =>
                                void editor.refreshRows(pagination.page + 1)
                              }
                            />
                          </>
                        ) : null}
                      </>
                    )}
                  </section>
                </section>
              ) : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
