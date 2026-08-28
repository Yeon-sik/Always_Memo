export type DbEditorLoadStatus = "idle" | "loading" | "ready" | "error";

export type DbEditorErrorCode =
  | "patMissing"
  | "invalidPat"
  | "permissionDenied"
  | "rateLimited"
  | "timeout"
  | "network"
  | "credentialStore"
  | "invalidIdentifier"
  | "blockedSchema"
  | "tableNotFound"
  | "invalidPage"
  | "invalidResponse"
  | "queryFailed"
  | "nativeWindow"
  | "unsupported"
  | "unknown";

export interface DbEditorError {
  code: DbEditorErrorCode;
  message: string;
  status: number | null;
  retryAfterSeconds: number | null;
}

export interface DbEditorPatStatus {
  configured: boolean;
}

export interface DbEditorPatVerification {
  valid: boolean;
  projectCount: number;
}

export interface DbEditorProject {
  id: string | null;
  projectRef: string;
  name: string;
  organizationId: string | null;
  organizationSlug: string | null;
  region: string | null;
  status: string | null;
}

export interface DbEditorSchema {
  name: string;
}

export interface DbEditorTable {
  schema: string;
  name: string;
  tableType: string;
}

export interface DbEditorColumn {
  name: string;
  ordinalPosition: number;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  defaultExpression: string | null;
  isIdentity: boolean;
  isGenerated: boolean;
  isPrimaryKey: boolean;
  primaryKeyPosition: number | null;
}

export interface DbEditorTableMetadata {
  schema: string;
  name: string;
  tableType: string;
  columns: DbEditorColumn[];
  primaryKey: string[];
}

export type DbEditorRow = Record<string, unknown>;

export interface DbEditorRowsPage {
  rows: DbEditorRow[];
  page: number;
  pageSize: number;
  hasNext: boolean;
}
