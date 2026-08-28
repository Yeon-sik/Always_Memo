import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  KeyRound,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  areDbEditorValuesEqual,
  getColumnValueKind,
  getRowChanges,
  isEditableTable,
  isProtectedColumn,
  paginationControls,
  parseColumnDraftValue,
  serializeColumnDraftValue,
  type DbEditorRowInspectorState,
} from "./model";
import { useDbEditor } from "./useDbEditor";
import type {
  DbEditorColumn,
  DbEditorError,
  DbEditorRow,
  DbEditorTableMetadata,
} from "./types";

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

function rowsHaveSameIdentity(
  first: DbEditorRow | null,
  second: DbEditorRow,
  primaryKey: string[],
): boolean {
  return (
    first !== null &&
    primaryKey.length > 0 &&
    primaryKey.every((columnName) =>
      areDbEditorValuesEqual(first[columnName], second[columnName]),
    )
  );
}

function rowKey(row: DbEditorRow, primaryKey: string[], index: number): string {
  if (primaryKey.length === 0) {
    return String(index);
  }
  return primaryKey.map((columnName) => formatCell(row[columnName])).join("|");
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
              : "PK 없음 · 페이지 순서 비결정적 · 읽기 전용"}
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
                  {primaryKey.includes(column.name) || column.isIdentity || column.isGenerated || column.defaultExpression
                    ? "보호됨"
                    : "PK-scoped UPDATE 가능"}
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
  primaryKey,
  rows,
  selectedRow,
  page,
  pageSize,
  hasNext,
  isLoading,
  onRefresh,
  onPrevious,
  onNext,
  onRowClick,
}: {
  columns: DbEditorColumn[];
  primaryKey: string[];
  rows: DbEditorRow[];
  selectedRow: DbEditorRow | null;
  page: number;
  pageSize: number;
  hasNext: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onRowClick: (row: DbEditorRow) => void;
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
                  key={rowKey(row, primaryKey, rowIndex)}
                  onClick={() => onRowClick(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-selected={rowsHaveSameIdentity(selectedRow, row, primaryKey)}
                  className={
                    rowsHaveSameIdentity(selectedRow, row, primaryKey)
                      ? "cursor-pointer border-b border-teal-200 bg-teal-50 align-top outline-none ring-inset hover:bg-teal-100 focus:ring-2 focus:ring-teal-500 dark:border-teal-900 dark:bg-teal-950/40 dark:hover:bg-teal-950/70"
                      : "cursor-pointer border-b border-slate-100 bg-white align-top outline-none hover:bg-slate-50 focus:ring-2 focus:ring-teal-500 dark:border-neutral-900 dark:bg-neutral-950 dark:hover:bg-neutral-900"
                  }
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

function draftInputValue(column: DbEditorColumn, value: unknown): string {
  const serialized = serializeColumnDraftValue(column, value);
  if (getColumnValueKind(column) === "timestamp" && serialized.length >= 16) {
    return serialized.slice(0, 16).replace(" ", "T");
  }
  return serialized;
}

function defaultDraftValue(column: DbEditorColumn): unknown {
  switch (getColumnValueKind(column)) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "json":
      return {};
    default:
      return "";
  }
}

function RowInspector({
  metadata,
  inspector,
  error,
  isUpdating,
  onDraftChange,
  onCancel,
  onApply,
}: {
  metadata: DbEditorTableMetadata;
  inspector: DbEditorRowInspectorState;
  error: DbEditorError | null;
  isUpdating: boolean;
  onDraftChange: (columnName: string, value: unknown) => void;
  onCancel: () => void;
  onApply: () => Promise<boolean>;
}) {
  const [inputTexts, setInputTexts] = useState<Record<string, string>>({});
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    setInputTexts(
      Object.fromEntries(
        metadata.columns.map((column) => [
          column.name,
          draftInputValue(column, inspector.draft[column.name]),
        ]),
      ),
    );
    setInputErrors({});
    setIsConfirming(false);
  }, [inspector.original, metadata]);

  const changes = useMemo(
    () => getRowChanges(metadata, inspector.original, inspector.draft),
    [inspector.draft, inspector.original, metadata],
  );
  const editableTable = isEditableTable(metadata);
  const hasInputErrors = Object.values(inputErrors).some(Boolean);
  const canApply = editableTable && changes.length > 0 && !hasInputErrors && !isUpdating;

  function clearInputError(columnName: string) {
    setInputErrors((current) => {
      if (!(columnName in current)) {
        return current;
      }
      const next = { ...current };
      delete next[columnName];
      return next;
    });
  }

  function updateInput(column: DbEditorColumn, rawValue: string) {
    setInputTexts((current) => ({ ...current, [column.name]: rawValue }));
    const parsed = parseColumnDraftValue(column, rawValue);
    if (parsed.error) {
      setInputErrors((current) => ({ ...current, [column.name]: parsed.error ?? "입력값이 올바르지 않습니다." }));
      return;
    }
    clearInputError(column.name);
    onDraftChange(column.name, parsed.value);
  }

  function updateNullMode(column: DbEditorColumn, mode: string) {
    if (mode === "null") {
      onDraftChange(column.name, null);
      setInputTexts((current) => ({ ...current, [column.name]: "" }));
      clearInputError(column.name);
      return;
    }

    const value =
      inspector.original[column.name] === null || inspector.original[column.name] === undefined
        ? defaultDraftValue(column)
        : inspector.original[column.name];
    onDraftChange(column.name, value);
    setInputTexts((current) => ({ ...current, [column.name]: draftInputValue(column, value) }));
    clearInputError(column.name);
  }

  function renderEditor(column: DbEditorColumn, value: unknown) {
    const kind = getColumnValueKind(column);
    const inputValue = inputTexts[column.name] ?? draftInputValue(column, value);
    const inputClass = "field-input min-w-0 flex-1 text-xs";

    if (kind === "boolean") {
      return (
        <select
          value={value === true ? "true" : "false"}
          onChange={(event) => updateInput(column, event.target.value)}
          className={inputClass}
          disabled={!editableTable || isUpdating}
          aria-label={`${column.name} 값`}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    if (kind === "json") {
      return (
        <textarea
          value={inputValue}
          onChange={(event) => updateInput(column, event.target.value)}
          className="field-input min-h-20 min-w-0 flex-1 resize-y font-mono text-xs"
          disabled={!editableTable || isUpdating}
          aria-label={`${column.name} JSON 값`}
          spellCheck={false}
        />
      );
    }

    return (
      <input
        type={
          kind === "number" ? "number" : kind === "date" ? "date" : kind === "timestamp" ? "datetime-local" : "text"
        }
        step={kind === "number" ? "any" : undefined}
        value={inputValue}
        onChange={(event) => updateInput(column, event.target.value)}
        className={inputClass}
        disabled={!editableTable || isUpdating}
        aria-label={`${column.name} 값`}
        spellCheck={kind === "text" ? true : false}
      />
    );
  }

  return (
    <section className="border-t border-slate-300 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-neutral-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-teal-700 dark:text-teal-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Row Inspector</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            {metadata.schema}.{metadata.name} · PK identity는 WHERE 조건으로만 사용됩니다.
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-neutral-400">
            {metadata.primaryKey.length > 0
              ? "PK: " + metadata.primaryKey.map((name) => `${name}=${formatCell(inspector.original[name])}`).join(", ")
              : "PK 없음 · 읽기 전용"}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={isUpdating}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-black dark:text-neutral-200"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          취소
        </button>
      </div>

      <ErrorMessage error={error} />

      {!editableTable ? (
        <p className="border-b border-slate-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-neutral-800 dark:bg-amber-950/30 dark:text-amber-100">
          VIEW 또는 PK 없는 테이블은 Row Inspector에서도 읽기 전용입니다.
        </p>
      ) : null}

      <div className="max-h-[420px] overflow-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-[11px] text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-semibold">컬럼</th>
              <th className="px-4 py-2 font-semibold">원본값</th>
              <th className="px-4 py-2 font-semibold">수정 draft</th>
              <th className="px-4 py-2 font-semibold">상태</th>
            </tr>
          </thead>
          <tbody>
            {metadata.columns.map((column) => {
              const originalValue = inspector.original[column.name];
              const draftValue = inspector.draft[column.name];
              const changed = !areDbEditorValuesEqual(originalValue, draftValue);
              const protectedColumn = isProtectedColumn(column) || metadata.primaryKey.includes(column.name);
              const unsupported = getColumnValueKind(column) === "unsupported";
              const editable = editableTable && !protectedColumn && !unsupported;
              const inputError = inputErrors[column.name];

              return (
                <tr key={column.name} className="border-t border-slate-100 align-top dark:border-neutral-900">
                  <td className="w-48 px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-neutral-100">{column.name}</div>
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-neutral-400">
                      {column.dataType} · {column.isNullable ? "nullable" : "required"}
                    </div>
                  </td>
                  <td className="max-w-64 whitespace-pre-wrap break-words px-4 py-3 text-slate-600 dark:text-neutral-300">
                    {formatCell(originalValue)}
                  </td>
                  <td className="px-4 py-3">
                    {editable ? (
                      <div className="flex min-w-72 flex-col gap-1.5">
                        <div className="flex items-start gap-1.5">
                          <select
                            value={draftValue === null ? "null" : "value"}
                            onChange={(event) => updateNullMode(column, event.target.value)}
                            disabled={!column.isNullable || isUpdating}
                            className="field-input w-20 shrink-0 text-xs"
                            aria-label={`${column.name} NULL 모드`}
                          >
                            <option value="value">값</option>
                            <option value="null">NULL</option>
                          </select>
                          {draftValue === null ? (
                            <span className="flex h-9 flex-1 items-center rounded-md border border-dashed border-slate-300 px-2 text-xs text-slate-500 dark:border-neutral-700 dark:text-neutral-400">
                              SQL NULL
                            </span>
                          ) : (
                            renderEditor(column, draftValue)
                          )}
                        </div>
                        {inputError ? <p className="text-[11px] text-red-700 dark:text-red-300">{inputError}</p> : null}
                      </div>
                    ) : (
                      <div>
                        <span className="whitespace-pre-wrap break-words text-slate-600 dark:text-neutral-300">
                          {formatCell(draftValue)}
                        </span>
                        <span className="ml-2 text-[11px] text-slate-500 dark:text-neutral-500">
                          {protectedColumn ? "보호됨" : unsupported ? "지원하지 않는 타입" : "읽기 전용"}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="w-28 px-4 py-3">
                    {changed ? (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                        변경
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">동일</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-neutral-800">
        <p className="text-xs text-slate-500 dark:text-neutral-400">
          {changes.length > 0 ? `${changes.length}개 컬럼 변경 예정` : "변경사항 없음"}
        </p>
        {isConfirming ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-950/30">
            <span className="text-xs font-semibold text-amber-900 dark:text-amber-100">이 한 행에 변경을 적용할까요?</span>
            <button
              type="button"
              onClick={() => void onApply()}
              disabled={!canApply}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-teal-700 px-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500 dark:text-black dark:hover:bg-teal-400"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              적용 확인
            </button>
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              disabled={isUpdating}
              className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-black dark:text-neutral-200"
            >
              돌아가기
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            disabled={!canApply}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500 dark:text-black dark:hover:bg-teal-400"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            변경 검토
          </button>
        )}
      </div>
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
    rowInspector,
    openRowInspector,
    updateRowDraft,
    cancelRowInspector,
    applyRowUpdate,
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
              Rust adapter 기반 metadata-allowlisted Phase 2 single-row UPDATE
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
                  Phase 2에서는 PK가 있는 한 행의 변경 컬럼만 UPDATE합니다. OAuth,
                  Raw SQL, INSERT/DELETE, bulk edit은 제공하지 않습니다.
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
                              SELECT + PK-scoped single-row UPDATE only
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
                              primaryKey={metadata.primaryKey}
                              rows={rows?.rows ?? []}
                              selectedRow={rowInspector?.original ?? null}
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
                              onRowClick={openRowInspector}
                            />
                            {rowInspector ? (
                              <RowInspector
                                metadata={metadata}
                                inspector={rowInspector}
                                error={resources.rowUpdate.error}
                                isUpdating={resources.rowUpdate.status === "loading"}
                                onDraftChange={updateRowDraft}
                                onCancel={cancelRowInspector}
                                onApply={applyRowUpdate}
                              />
                            ) : null}
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
