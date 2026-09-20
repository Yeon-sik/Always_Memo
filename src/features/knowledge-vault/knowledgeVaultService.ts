import type {
  BackfillInput,
  KnowledgeDocument,
  KnowledgeDocumentType,
  Project,
  ProjectAction,
  ProjectHistory,
  ProjectMilestone,
  Workstream,
  WorkstreamAction,
  WorkstreamMilestone,
} from "../../types";
import { getPlatformCapabilities } from "../../lib/platform/capabilities";
import { createEntityAuditFields } from "../../lib/dataTrust/backfillMetadata";
import { createId } from "../../lib/storage/id";

export const KNOWLEDGE_DOCUMENT_TYPES: KnowledgeDocumentType[] = [
  "IDEA",
  "PLAN",
  "DESIGN",
  "RESEARCH",
  "NOTE",
];

export const KNOWLEDGE_TYPE_FOLDERS: Record<KnowledgeDocumentType, string> = {
  IDEA: "Ideas",
  PLAN: "Plans",
  DESIGN: "Designs",
  RESEARCH: "Research",
  NOTE: "Notes",
};

export interface KnowledgeVaultConfig {
  supported: boolean;
  vaultPath: string | null;
}

export interface KnowledgeVaultOperationResult {
  status: "created" | "updated" | "unchanged" | "missing" | "conflict";
  relativePath: string;
}

export interface KnowledgeDocumentFileInput {
  document: KnowledgeDocument;
  projectName?: string | null;
  workstreamName?: string | null;
}

export interface KnowledgeDocumentMetadataInput extends KnowledgeDocumentFileInput {
  currentRelativePath: string;
}

export interface KnowledgeDocumentChanges {
  title?: string;
  type?: KnowledgeDocumentType;
  projectId?: string | null;
  workstreamId?: string | null;
}

const unsupportedConfig: KnowledgeVaultConfig = {
  supported: false,
  vaultPath: null,
};

function trimPathSegment(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();
}

function isWindowsReservedName(value: string): boolean {
  const stem = value.split(".")[0]?.toUpperCase() ?? "";
  return (
    ["CON", "PRN", "AUX", "NUL"].includes(stem) ||
    /^(COM|LPT)[1-9]$/.test(stem)
  );
}

/** Keep user-facing Korean/space names while making every path segment safe. */
export function normalizeVaultSegment(value: string, fallback = "Untitled"): string {
  const normalized = trimPathSegment(value) || fallback;
  if (normalized === "." || normalized === "..") {
    return `_${normalized.replace(/\./g, "") || fallback}`;
  }
  return isWindowsReservedName(normalized) ? `_${normalized}` : normalized;
}

export function getKnowledgeTypeFolder(type: KnowledgeDocumentType): string {
  return KNOWLEDGE_TYPE_FOLDERS[type];
}

function nowIso(): string {
  return new Date().toISOString();
}

function validateKnowledgeDocumentOwner(
  projectId: string | null,
  workstreamId: string | null,
): void {
  if (projectId !== null && workstreamId !== null) {
    throw new Error("Knowledge Document는 Project와 Workstream을 동시에 소유할 수 없습니다.");
  }
}

export function createKnowledgeDocument(
  deviceId: string,
  input: {
    id?: string;
    title: string;
    type: KnowledgeDocumentType;
    projectId: string | null;
    workstreamId: string | null;
    relativePath: string;
  },
  backfillInput?: BackfillInput,
): KnowledgeDocument {
  const now = nowIso();
  validateKnowledgeDocumentOwner(input.projectId, input.workstreamId);
  return {
    ...createEntityAuditFields(backfillInput, now),
    id: input.id ?? createId(),
    title: input.title.trim(),
    type: input.type,
    projectId: input.projectId,
    workstreamId: input.workstreamId,
    relativePath: normalizeRelativePath(input.relativePath),
    updatedAt: now,
    deletedAt: null,
    deviceId,
  };
}

export function updateKnowledgeDocument(
  document: KnowledgeDocument,
  changes: KnowledgeDocumentChanges,
  deviceId: string,
): KnowledgeDocument {
  const nextProjectId = changes.projectId === undefined ? document.projectId : changes.projectId;
  const nextWorkstreamId = changes.workstreamId === undefined ? document.workstreamId : changes.workstreamId;
  validateKnowledgeDocumentOwner(nextProjectId, nextWorkstreamId);
  return {
    ...document,
    ...(changes.title === undefined ? {} : { title: changes.title.trim() }),
    ...(changes.type === undefined ? {} : { type: changes.type }),
    ...(changes.projectId === undefined ? {} : { projectId: changes.projectId }),
    ...(changes.workstreamId === undefined ? {} : { workstreamId: changes.workstreamId }),
    updatedAt: nowIso(),
    deviceId,
  };
}

export function softDeleteKnowledgeDocument(
  document: KnowledgeDocument,
  deviceId: string,
): KnowledgeDocument {
  const now = nowIso();
  return { ...document, updatedAt: now, deletedAt: now, deviceId };
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export function buildProjectHomeRelativePath(projectName: string): string {
  const segment = normalizeVaultSegment(projectName);
  return `Projects/${segment}/${segment}.md`;
}

export function buildWorkstreamHomeRelativePath(workstreamName: string): string {
  const segment = normalizeVaultSegment(workstreamName);
  return `Workstreams/${segment}/${segment}.md`;
}

export function buildKnowledgeDocumentRelativePath({
  title,
  type,
  projectName,
  workstreamName,
  projectId,
  workstreamId,
}: {
  title: string;
  type: KnowledgeDocumentType;
  projectName?: string | null;
  workstreamName?: string | null;
  projectId?: string | null;
  workstreamId?: string | null;
}): string {
  const typeFolder = getKnowledgeTypeFolder(type);
  const titleSegment = normalizeVaultSegment(title);
  if (projectId) {
    const projectSegment = normalizeVaultSegment(projectName ?? projectId);
    return `Projects/${projectSegment}/${typeFolder}/${titleSegment}.md`;
  }
  if (workstreamId) {
    const workstreamSegment = normalizeVaultSegment(workstreamName ?? workstreamId);
    return `Workstreams/${workstreamSegment}/${typeFolder}/${titleSegment}.md`;
  }
  return `General/${typeFolder}/${titleSegment}.md`;
}

function pathKey(value: string): string {
  return normalizeRelativePath(value).toLocaleLowerCase();
}

/** Resolve filename collisions without making a title or id the source of truth. */
export function resolveKnowledgeDocumentRelativePath(
  input: Parameters<typeof buildKnowledgeDocumentRelativePath>[0] & {
    id: string;
  },
  existingPaths: readonly string[],
): string {
  const candidate = buildKnowledgeDocumentRelativePath(input);
  const occupied = new Set(existingPaths.map(pathKey));
  if (!occupied.has(pathKey(candidate))) {
    return candidate;
  }

  const suffix = input.id.slice(0, 8);
  const withShortId = candidate.replace(/\.md$/i, ` (${suffix}).md`);
  if (!occupied.has(pathKey(withShortId))) {
    return withShortId;
  }
  return candidate.replace(/\.md$/i, ` (${input.id}).md`);
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function yamlNullableString(value: string | null): string {
  return value === null ? "null" : yamlString(value);
}

export function buildManagedFrontmatter(document: KnowledgeDocument): string {
  return [
    "---",
    `id: ${yamlString(document.id)}`,
    `type: ${document.type.toLowerCase()}`,
    "managed_by: personal-os",
    "schema_version: 1",
    `title: ${yamlString(document.title)}`,
    `project_id: ${yamlNullableString(document.projectId)}`,
    `workstream_id: ${yamlNullableString(document.workstreamId)}`,
    `created_at: ${yamlString(document.createdAt)}`,
    "---",
  ].join("\n");
}

export function buildKnowledgeDocumentMarkdown(document: KnowledgeDocument): string {
  const sections: Record<KnowledgeDocumentType, string> = {
    IDEA: "## Idea\n\n## Why\n",
    PLAN: "## Goal\n\n## Scope\n\n## Steps\n\n## Validation\n",
    DESIGN: "## Problem\n\n## Design\n\n## Trade-offs\n",
    RESEARCH: "## Question\n\n## Findings\n\n## Sources\n",
    NOTE: "",
  };
  return `${buildManagedFrontmatter(document)}\n\n# ${document.title}\n\n${sections[document.type]}`;
}

export function toKnowledgeWikiLink(relativePath: string, title: string): string {
  const withoutExtension = normalizeRelativePath(relativePath).replace(/\.md$/i, "");
  return `[[${withoutExtension}|${title}]]`;
}

function statusLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function renderDocumentLinks(documents: KnowledgeDocument[]): string {
  if (documents.length === 0) return "- None";
  return documents
    .filter((document) => document.deletedAt === null)
    .sort((first, second) => first.title.localeCompare(second.title))
    .map((document) => `- ${toKnowledgeWikiLink(document.relativePath, document.title)}`)
    .join("\n") || "- None";
}

function renderProjectLinks(workstreams: Workstream[], projectIds: Set<string>): string {
  const links = workstreams
    .filter((workstream) => workstream.deletedAt === null && projectIds.has(workstream.id))
    .sort((first, second) => first.name.localeCompare(second.name))
    .map(
      (workstream) =>
        `- ${toKnowledgeWikiLink(
          buildWorkstreamHomeRelativePath(workstream.name),
          workstream.name,
        )}`,
    );
  return links.join("\n") || "- None";
}

export function buildProjectHomeMarkdown({
  project,
  milestones,
  actions,
  history,
  workstreams,
  workstreamProjects,
  knowledgeDocuments,
}: {
  project: Project;
  milestones: ProjectMilestone[];
  actions: ProjectAction[];
  history: ProjectHistory[];
  workstreams: Workstream[];
  workstreamProjects: { workstreamId: string; projectId: string; deletedAt: string | null }[];
  knowledgeDocuments: KnowledgeDocument[];
}): string {
  const projectWorkstreamIds = new Set(
    workstreamProjects
      .filter((link) => link.projectId === project.id && link.deletedAt === null)
      .map((link) => link.workstreamId),
  );
  const directDocuments = knowledgeDocuments.filter(
    (document) => document.deletedAt === null && document.projectId === project.id,
  );
  const workstreamDocuments = knowledgeDocuments.filter(
    (document) =>
      document.deletedAt === null &&
      document.workstreamId !== null &&
      projectWorkstreamIds.has(document.workstreamId),
  );
  const visibleMilestones = milestones.filter((item) => item.deletedAt === null);
  const visibleActions = actions.filter((item) => item.deletedAt === null);
  const visibleHistory = history
    .filter((item) => item.deletedAt === null)
    .sort((first, second) => second.occurredAt.localeCompare(first.occurredAt));
  const repository = project.repository ?? "-";

  return [
    "---",
    `id: ${yamlString(project.id)}`,
    "type: project-home",
    "managed_by: personal-os",
    "schema_version: 1",
    "---",
    "",
    `# ${project.name}`,
    "",
    "> Generated projection. Source of Truth: Personal OS DB.",
    "",
    "## Overview",
    project.description || "-",
    "",
    "## Status",
    statusLabel(project.status),
    "",
    "## CURRENT",
    project.currentSummary || "-",
    "",
    "## TARGET",
    project.targetSummary || "-",
    "",
    "## Repository",
    `- URL: ${repository}`,
    `- Branch: ${project.branch ?? "-"}`,
    `- Last verified commit: ${project.lastVerifiedCommit ?? "-"}`,
    `- Last verified at: ${project.lastVerifiedAt ?? "-"}`,
    "",
    "## Milestones",
    visibleMilestones.length
      ? visibleMilestones.map((item) => `- [${statusLabel(item.status)}] ${item.title}`).join("\n")
      : "- None",
    "",
    "## NEXT",
    visibleActions.filter((item) => item.type === "NEXT").map((item) => `- [${item.status}] ${item.title}`).join("\n") || "- None",
    "",
    "## LATER",
    visibleActions.filter((item) => item.type === "LATER").map((item) => `- [${item.status}] ${item.title}`).join("\n") || "- None",
    "",
    "## BLOCKED",
    visibleActions.filter((item) => item.type === "BLOCKED").map((item) => `- [${item.status}] ${item.title}`).join("\n") || "- None",
    "",
    "## History",
    visibleHistory.length
      ? visibleHistory.map((item) => `- [${item.type}] ${item.occurredAt}: ${item.summary}`).join("\n")
      : "- None",
    "",
    "## Participating Workstreams",
    renderProjectLinks(workstreams, projectWorkstreamIds),
    "",
    "## Related Documents",
    renderDocumentLinks([...directDocuments, ...workstreamDocuments]),
    "",
  ].join("\n");
}

export function buildWorkstreamHomeMarkdown({
  workstream,
  projects,
  workstreamProjects,
  milestones,
  actions,
  knowledgeDocuments,
}: {
  workstream: Workstream;
  projects: Project[];
  workstreamProjects: { workstreamId: string; projectId: string; deletedAt: string | null }[];
  milestones: WorkstreamMilestone[];
  actions: WorkstreamAction[];
  knowledgeDocuments: KnowledgeDocument[];
}): string {
  const projectIds = new Set(
    workstreamProjects
      .filter((link) => link.workstreamId === workstream.id && link.deletedAt === null)
      .map((link) => link.projectId),
  );
  const relatedProjects = projects.filter(
    (project) => project.deletedAt === null && projectIds.has(project.id),
  );
  const visibleMilestones = milestones.filter((item) => item.deletedAt === null);
  const visibleActions = actions.filter((item) => item.deletedAt === null);
  const documents = knowledgeDocuments.filter(
    (document) => document.deletedAt === null && document.workstreamId === workstream.id,
  );

  return [
    "---",
    `id: ${yamlString(workstream.id)}`,
    "type: workstream-home",
    "managed_by: personal-os",
    "schema_version: 1",
    "---",
    "",
    `# ${workstream.name}`,
    "",
    "> Generated projection. Source of Truth: Personal OS DB.",
    "",
    "## Status",
    statusLabel(workstream.status),
    "",
    "## Participating Projects",
    relatedProjects
      .sort((first, second) => first.name.localeCompare(second.name))
      .map((project) => `- ${toKnowledgeWikiLink(buildProjectHomeRelativePath(project.name), project.name)}`)
      .join("\n") || "- None",
    "",
    "## Milestones",
    visibleMilestones.map((item) => `- [${statusLabel(item.status)}] ${item.title}`).join("\n") || "- None",
    "",
    "## NEXT",
    visibleActions.filter((item) => item.type === "NEXT").map((item) => `- [${item.status}] ${item.title}`).join("\n") || "- None",
    "",
    "## LATER",
    visibleActions.filter((item) => item.type === "LATER").map((item) => `- [${item.status}] ${item.title}`).join("\n") || "- None",
    "",
    "## BLOCKED",
    visibleActions.filter((item) => item.type === "BLOCKED").map((item) => `- [${item.status}] ${item.title}`).join("\n") || "- None",
    "",
    "## Knowledge Documents",
    renderDocumentLinks(documents),
    "",
  ].join("\n");
}

async function invokeNative<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export async function loadKnowledgeVaultConfig(): Promise<KnowledgeVaultConfig> {
  if (!getPlatformCapabilities().isTauriDesktop) return unsupportedConfig;
  const result = await invokeNative<{ vaultPath: string | null }>(
    "knowledge_vault_get_config",
  );
  return { supported: true, vaultPath: result.vaultPath };
}

export async function saveKnowledgeVaultPath(path: string): Promise<KnowledgeVaultConfig> {
  if (!getPlatformCapabilities().isTauriDesktop) {
    throw new Error("Knowledge Vault는 데스크톱 Tauri 앱에서만 사용할 수 있습니다.");
  }
  const result = await invokeNative<{ vaultPath: string }>(
    "knowledge_vault_set_path",
    { path },
  );
  return { supported: true, vaultPath: result.vaultPath };
}

export async function pickKnowledgeVaultPath(): Promise<string | null> {
  if (!getPlatformCapabilities().isTauriDesktop) {
    throw new Error("Knowledge Vault 폴더 선택은 데스크톱 Tauri 앱에서만 지원됩니다.");
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    directory: true,
    multiple: false,
    title: "Knowledge Vault 폴더 선택",
  });
  return typeof result === "string" ? result : null;
}

export async function createKnowledgeDocumentFile(
  input: KnowledgeDocumentFileInput,
): Promise<KnowledgeVaultOperationResult> {
  if (!getPlatformCapabilities().isTauriDesktop) {
    throw new Error("Knowledge Vault 파일 생성은 데스크톱 Tauri 앱에서만 지원됩니다.");
  }
  return invokeNative<KnowledgeVaultOperationResult>(
    "knowledge_vault_create_document",
    {
      relativePath: input.document.relativePath,
      contents: buildKnowledgeDocumentMarkdown(input.document),
    },
  );
}

export async function updateKnowledgeDocumentFile(
  input: KnowledgeDocumentMetadataInput,
): Promise<KnowledgeVaultOperationResult> {
  if (!getPlatformCapabilities().isTauriDesktop) {
    throw new Error("Knowledge Vault 파일 갱신은 데스크톱 Tauri 앱에서만 지원됩니다.");
  }
  return invokeNative<KnowledgeVaultOperationResult>(
    "knowledge_vault_update_document",
    {
      currentRelativePath: input.currentRelativePath,
      nextRelativePath: input.document.relativePath,
      id: input.document.id,
      title: input.document.title,
      type: input.document.type,
      projectId: input.document.projectId,
      workstreamId: input.document.workstreamId,
      createdAt: input.document.createdAt,
    },
  );
}

export async function writeGeneratedKnowledgeFile(
  relativePath: string,
  contents: string,
): Promise<KnowledgeVaultOperationResult> {
  if (!getPlatformCapabilities().isTauriDesktop) {
    throw new Error("Knowledge Vault projection은 데스크톱 Tauri 앱에서만 지원됩니다.");
  }
  return invokeNative<KnowledgeVaultOperationResult>(
    "knowledge_vault_write_generated_file",
    { relativePath, contents },
  );
}

export async function moveKnowledgeVaultFile(
  currentRelativePath: string,
  nextRelativePath: string,
): Promise<KnowledgeVaultOperationResult> {
  if (!getPlatformCapabilities().isTauriDesktop) {
    throw new Error("Knowledge Vault 파일 이동은 데스크톱 Tauri 앱에서만 지원됩니다.");
  }
  return invokeNative<KnowledgeVaultOperationResult>(
    "knowledge_vault_move_file",
    { currentRelativePath, nextRelativePath },
  );
}

export async function openKnowledgeDocumentFile(
  relativePath: string,
): Promise<void> {
  if (!getPlatformCapabilities().isTauriDesktop) {
    throw new Error("Knowledge Vault 파일 열기는 데스크톱 Tauri 앱에서만 지원됩니다.");
  }
  await invokeNative("knowledge_vault_open_file", { relativePath });
}
