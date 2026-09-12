import type {
  BackfillInput,
  DevActionStatus,
  DevActionType,
  DevHistoryType,
  DevMilestoneStatus,
  DevProjectStatus,
  Project,
  ProjectAction,
  ProjectHistory,
  ProjectIdea,
  ProjectMilestone,
} from "../../types";
import { createEntityAuditFields } from "../../lib/dataTrust/backfillMetadata";
import { normalizeProjectGitHubIdentity } from "../../lib/dataTrust/projectGitHubIdentity";
import { createId } from "../../lib/storage/id";

export type DevProjectRepositoryMode = "github" | "text";

export const DEFAULT_PROJECT_BRANCH = "main";

export interface ProjectRepositoryFields {
  repository: string | null;
  branch: string | null;
  lastVerifiedCommit: string | null;
  lastVerifiedAt: string | null;
  error: string | null;
}

export interface ProjectGitHubFields {
  githubRepositoryId: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
}

export interface ProjectChanges {
  name?: string;
  repository?: string | null;
  branch?: string | null;
  githubRepositoryId?: string | null;
  githubOwner?: string | null;
  githubRepo?: string | null;
  status?: DevProjectStatus;
  currentSummary?: string;
  targetSummary?: string;
  lastVerifiedCommit?: string | null;
  lastVerifiedAt?: string | null;
}

export interface ProjectMilestoneChanges {
  title?: string;
  status?: DevMilestoneStatus;
}

export interface ProjectActionChanges {
  title?: string;
  type?: DevActionType;
  status?: DevActionStatus;
}

export interface ProjectIdeaChanges {
  title?: string;
}

export interface ProjectHistoryChanges {
  type?: DevHistoryType;
  summary?: string;
  occurredAt?: string;
  githubRef?: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cleanOptional(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

/**
 * Repository mode is a UI concern, so existing rows derive it from the fields
 * already in the sync contract. A populated legacy branch keeps the row in
 * GitHub mode instead of silently discarding it during an edit.
 */
export function getProjectRepositoryMode(
  project: Pick<Project, "repository" | "branch"> &
    Partial<Pick<Project, "githubRepositoryId" | "githubOwner" | "githubRepo">>,
): DevProjectRepositoryMode {
  const hasCanonicalIdentity =
    project.githubRepositoryId?.trim() &&
    project.githubOwner?.trim() &&
    project.githubRepo?.trim();
  return hasCanonicalIdentity || project.repository?.trim() || project.branch?.trim()
    ? "github"
    : "text";
}

export function normalizeProjectRepositoryFields(
  mode: DevProjectRepositoryMode,
  repository: string,
  branch: string,
  lastVerifiedCommit: string | null | undefined = null,
  lastVerifiedAt: string | null | undefined = null,
  preserveLegacyFields = false,
): ProjectRepositoryFields {
  if (mode === "text") {
    if (preserveLegacyFields) {
      return {
        repository: repository.trim() || null,
        branch: branch.trim() || null,
        lastVerifiedCommit: cleanOptional(lastVerifiedCommit),
        lastVerifiedAt: cleanOptional(lastVerifiedAt),
        error: null,
      };
    }

    return {
      repository: null,
      branch: null,
      lastVerifiedCommit: null,
      lastVerifiedAt: null,
      error: null,
    };
  }

  const normalizedRepository = repository.trim();
  if (!normalizedRepository) {
    return {
      repository: null,
      branch: branch.trim() || DEFAULT_PROJECT_BRANCH,
      lastVerifiedCommit: cleanOptional(lastVerifiedCommit),
      lastVerifiedAt: cleanOptional(lastVerifiedAt),
      error: "GitHub Repository 연결 모드에서는 Repository URL이 필요합니다.",
    };
  }

  let parsedRepository: URL;
  try {
    parsedRepository = new URL(normalizedRepository);
  } catch {
    return {
      repository: normalizedRepository,
      branch: branch.trim() || DEFAULT_PROJECT_BRANCH,
      lastVerifiedCommit: cleanOptional(lastVerifiedCommit),
      lastVerifiedAt: cleanOptional(lastVerifiedAt),
      error: "GitHub Repository URL을 https://github.com/owner/repository 형식으로 입력하세요.",
    };
  }

  const pathSegments = parsedRepository.pathname.split("/").filter(Boolean);
  const isGitHubRepositoryUrl =
    parsedRepository.protocol === "https:" &&
    ["github.com", "www.github.com"].includes(parsedRepository.hostname.toLowerCase()) &&
    !parsedRepository.username &&
    !parsedRepository.password &&
    !parsedRepository.search &&
    !parsedRepository.hash &&
    pathSegments.length === 2 &&
    pathSegments[0].length > 0 &&
    pathSegments[1].replace(/\.git$/i, "").length > 0;

  if (!isGitHubRepositoryUrl) {
    return {
      repository: normalizedRepository,
      branch: branch.trim() || DEFAULT_PROJECT_BRANCH,
      lastVerifiedCommit: cleanOptional(lastVerifiedCommit),
      lastVerifiedAt: cleanOptional(lastVerifiedAt),
      error: "GitHub Repository URL을 https://github.com/owner/repository 형식으로 입력하세요.",
    };
  }

  return {
    repository: normalizedRepository,
    branch: branch.trim() || DEFAULT_PROJECT_BRANCH,
    lastVerifiedCommit: cleanOptional(lastVerifiedCommit),
    lastVerifiedAt: cleanOptional(lastVerifiedAt),
    error: null,
  };
}

/**
 * Normalize the nullable GitHub identity without making Project dependent on
 * a remote observation. Legacy URL-only rows intentionally remain identity
 * null until the user explicitly upgrades them from the repository picker.
 */
export function normalizeProjectGitHubFields(
  mode: DevProjectRepositoryMode,
  githubRepositoryId: string | null | undefined,
  githubOwner: string | null | undefined,
  githubRepo: string | null | undefined,
): ProjectGitHubFields {
  if (mode === "text") {
    return {
      githubRepositoryId: null,
      githubOwner: null,
      githubRepo: null,
    };
  }

  return normalizeProjectGitHubIdentity(
    githubRepositoryId,
    githubOwner,
    githubRepo,
  );
}

function getNormalizedProjectGitHubFields(
  project: Pick<Project, "githubRepositoryId" | "githubOwner" | "githubRepo">,
  changes: ProjectChanges,
): ProjectGitHubFields {
  return normalizeProjectGitHubFields(
    "github",
    changes.githubRepositoryId === undefined
      ? project.githubRepositoryId
      : changes.githubRepositoryId,
    changes.githubOwner === undefined ? project.githubOwner : changes.githubOwner,
    changes.githubRepo === undefined ? project.githubRepo : changes.githubRepo,
  );
}

export function parseGitHubRepositoryUrl(
  repository: string | null | undefined,
): { owner: string; repo: string } | null {
  if (!repository?.trim()) return null;

  try {
    const parsed = new URL(repository.trim());
    const segments = parsed.pathname.split("/").filter(Boolean);
    const repo = segments[1]?.replace(/\.git$/i, "");
    if (
      parsed.protocol !== "https:" ||
      !["github.com", "www.github.com"].includes(parsed.hostname.toLowerCase()) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      segments.length !== 2 ||
      !segments[0] ||
      !repo
    ) {
      return null;
    }
    return { owner: segments[0], repo };
  } catch {
    return null;
  }
}

export function createProject(
  deviceId: string,
  changes: Pick<
    Project,
    | "name"
    | "repository"
    | "branch"
    | "status"
    | "currentSummary"
    | "targetSummary"
    | "lastVerifiedCommit"
    | "lastVerifiedAt"
  > &
    Partial<Pick<Project, "githubRepositoryId" | "githubOwner" | "githubRepo">>,
  backfillInput?: BackfillInput,
): Project {
  const now = nowIso();
  const githubFields = normalizeProjectGitHubFields(
    "github",
    changes.githubRepositoryId,
    changes.githubOwner,
    changes.githubRepo,
  );
  return {
    ...createEntityAuditFields(backfillInput, now),
    id: createId(),
    name: changes.name.trim(),
    repository: cleanOptional(changes.repository),
    branch: cleanOptional(changes.branch),
    ...githubFields,
    status: changes.status,
    currentSummary: changes.currentSummary.trim(),
    targetSummary: changes.targetSummary.trim(),
    lastVerifiedCommit: cleanOptional(changes.lastVerifiedCommit),
    lastVerifiedAt: cleanOptional(changes.lastVerifiedAt),
    updatedAt: now,
    deletedAt: null,
    deviceId,
  };
}

export function updateProject(
  project: Project,
  changes: ProjectChanges,
  deviceId: string,
): Project {
  const githubFields = getNormalizedProjectGitHubFields(project, changes);

  return {
    ...project,
    ...(changes.name === undefined ? {} : { name: changes.name.trim() }),
    ...(changes.repository === undefined
      ? {}
      : { repository: cleanOptional(changes.repository) }),
    ...(changes.branch === undefined ? {} : { branch: cleanOptional(changes.branch) }),
    ...githubFields,
    ...(changes.status === undefined ? {} : { status: changes.status }),
    ...(changes.currentSummary === undefined
      ? {}
      : { currentSummary: changes.currentSummary.trim() }),
    ...(changes.targetSummary === undefined
      ? {}
      : { targetSummary: changes.targetSummary.trim() }),
    ...(changes.lastVerifiedCommit === undefined
      ? {}
      : { lastVerifiedCommit: cleanOptional(changes.lastVerifiedCommit) }),
    ...(changes.lastVerifiedAt === undefined
      ? {}
      : { lastVerifiedAt: cleanOptional(changes.lastVerifiedAt) }),
    updatedAt: nowIso(),
    deviceId,
  };
}

export function softDeleteProject(project: Project, deviceId: string): Project {
  const now = nowIso();
  return { ...project, updatedAt: now, deletedAt: now, deviceId };
}

export function createProjectMilestone(
  projectId: string,
  title: string,
  deviceId: string,
  status: DevMilestoneStatus = "PLANNED",
  backfillInput?: BackfillInput,
): ProjectMilestone {
  const now = nowIso();
  return {
    ...createEntityAuditFields(backfillInput, now),
    id: createId(),
    projectId,
    title: title.trim(),
    status,
    updatedAt: now,
    deletedAt: null,
    deviceId,
  };
}

export function updateProjectMilestone(
  milestone: ProjectMilestone,
  changes: ProjectMilestoneChanges,
  deviceId: string,
): ProjectMilestone {
  return {
    ...milestone,
    ...(changes.title === undefined ? {} : { title: changes.title.trim() }),
    ...(changes.status === undefined ? {} : { status: changes.status }),
    updatedAt: nowIso(),
    deviceId,
  };
}

export function softDeleteProjectMilestone(
  milestone: ProjectMilestone,
  deviceId: string,
): ProjectMilestone {
  const now = nowIso();
  return { ...milestone, updatedAt: now, deletedAt: now, deviceId };
}

export function createProjectAction(
  projectId: string,
  title: string,
  deviceId: string,
  type: DevActionType = "NEXT",
  status: DevActionStatus = "OPEN",
  backfillInput?: BackfillInput,
): ProjectAction {
  const now = nowIso();
  return {
    ...createEntityAuditFields(backfillInput, now),
    id: createId(),
    projectId,
    title: title.trim(),
    type,
    status,
    updatedAt: now,
    deletedAt: null,
    deviceId,
  };
}

export function updateProjectAction(
  action: ProjectAction,
  changes: ProjectActionChanges,
  deviceId: string,
): ProjectAction {
  return {
    ...action,
    ...(changes.title === undefined ? {} : { title: changes.title.trim() }),
    ...(changes.type === undefined ? {} : { type: changes.type }),
    ...(changes.status === undefined ? {} : { status: changes.status }),
    updatedAt: nowIso(),
    deviceId,
  };
}

export function softDeleteProjectAction(
  action: ProjectAction,
  deviceId: string,
): ProjectAction {
  const now = nowIso();
  return { ...action, updatedAt: now, deletedAt: now, deviceId };
}

export function createProjectIdea(
  projectId: string,
  title: string,
  deviceId: string,
  backfillInput?: BackfillInput,
): ProjectIdea {
  const now = nowIso();
  return {
    ...createEntityAuditFields(backfillInput, now),
    id: createId(),
    projectId,
    title: title.trim(),
    updatedAt: now,
    deletedAt: null,
    deviceId,
  };
}

export function updateProjectIdea(
  idea: ProjectIdea,
  changes: ProjectIdeaChanges,
  deviceId: string,
): ProjectIdea {
  return {
    ...idea,
    ...(changes.title === undefined ? {} : { title: changes.title.trim() }),
    updatedAt: nowIso(),
    deviceId,
  };
}

export function softDeleteProjectIdea(
  idea: ProjectIdea,
  deviceId: string,
): ProjectIdea {
  const now = nowIso();
  return { ...idea, updatedAt: now, deletedAt: now, deviceId };
}

export function createProjectHistory(
  projectId: string,
  summary: string,
  deviceId: string,
  type: DevHistoryType = "NOTE",
  occurredAt: string = nowIso(),
  githubRef: string | null = null,
  backfillInput?: BackfillInput,
): ProjectHistory {
  const now = nowIso();
  return {
    ...createEntityAuditFields(backfillInput, now),
    id: createId(),
    projectId,
    type,
    summary: summary.trim(),
    occurredAt,
    githubRef: cleanOptional(githubRef),
    updatedAt: now,
    deletedAt: null,
    deviceId,
  };
}

export function updateProjectHistory(
  history: ProjectHistory,
  changes: ProjectHistoryChanges,
  deviceId: string,
): ProjectHistory {
  return {
    ...history,
    ...(changes.type === undefined ? {} : { type: changes.type }),
    ...(changes.summary === undefined ? {} : { summary: changes.summary.trim() }),
    ...(changes.occurredAt === undefined ? {} : { occurredAt: changes.occurredAt }),
    ...(changes.githubRef === undefined
      ? {}
      : { githubRef: cleanOptional(changes.githubRef) }),
    updatedAt: nowIso(),
    deviceId,
  };
}

export function softDeleteProjectHistory(
  history: ProjectHistory,
  deviceId: string,
): ProjectHistory {
  const now = nowIso();
  return { ...history, updatedAt: now, deletedAt: now, deviceId };
}

export function getVisibleProjects(projects: Project[]): Project[] {
  return projects
    .filter((project) => project.deletedAt === null)
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

export function getProjectChildren<T extends { projectId: string; deletedAt: string | null }>(
  projectId: string,
  projects: Project[],
  children: T[],
): T[] {
  if (!projects.some((project) => project.id === projectId && project.deletedAt === null)) {
    return [];
  }
  return children.filter(
    (child) => child.projectId === projectId && child.deletedAt === null,
  );
}

export function getProjectLastUpdated(
  project: Project,
  milestones: ProjectMilestone[],
  actions: ProjectAction[],
  ideas: ProjectIdea[],
  history: ProjectHistory[],
): string {
  const timestamps = [
    project.updatedAt,
    ...milestones
      .filter((entity) => entity.projectId === project.id)
      .map((entity) => entity.updatedAt),
    ...actions
      .filter((entity) => entity.projectId === project.id)
      .map((entity) => entity.updatedAt),
    ...ideas
      .filter((entity) => entity.projectId === project.id)
      .map((entity) => entity.updatedAt),
    ...history
      .filter((entity) => entity.projectId === project.id)
      .map((entity) => entity.updatedAt),
  ].sort((first, second) => second.localeCompare(first));
  return timestamps[0] ?? project.updatedAt;
}

export function getOpenNextCount(actions: ProjectAction[]): number {
  return actions.filter(
    (action) => action.deletedAt === null && action.type === "NEXT" && action.status === "OPEN",
  ).length;
}

export function hasBlockedAction(actions: ProjectAction[]): boolean {
  return actions.some(
    (action) =>
      action.deletedAt === null && action.type === "BLOCKED" && action.status === "OPEN",
  );
}
