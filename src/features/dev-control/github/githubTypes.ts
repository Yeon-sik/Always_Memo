import type { Project } from "../../../types";
import { isGitHubCommitSha } from "../../../lib/dataTrust/projectGitHubIdentity";

export interface GitHubConnectionStatus {
  configured: boolean;
  connected: boolean;
  accountLogin: string | null;
  accountName: string | null;
  managementUrl: string | null;
  error: string | null;
}

export interface GitHubDeviceFlowStart {
  userCode: string;
  verificationUri: string;
  expiresInSeconds: number;
  intervalSeconds: number;
}

export type GitHubDeviceFlowStatus = "pending" | "authorized" | "denied" | "expired";

export interface GitHubDeviceFlowPollResult {
  status: GitHubDeviceFlowStatus;
  retryAfterSeconds: number | null;
  connection: GitHubConnectionStatus | null;
}

export interface GitHubRepositoryOption {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  private: boolean;
  description: string | null;
}

export interface GitHubBranchOption {
  name: string;
  protected: boolean;
}

export interface GitHubRemoteCommit {
  sha: string;
  message: string;
  committedAt: string | null;
  htmlUrl: string;
  author: string | null;
}

export interface GitHubRemotePullRequest {
  number: number;
  title: string;
  htmlUrl: string;
  state: string;
  updatedAt: string | null;
  draft: boolean;
  headBranch: string | null;
  baseBranch: string | null;
}

export interface GitHubRepositoryReadModel {
  repository: GitHubRepositoryOption;
  trackedBranch: string;
  remoteHead: GitHubRemoteCommit | null;
  recentCommits: GitHubRemoteCommit[];
  openPullRequests: GitHubRemotePullRequest[];
  queriedAt: string;
}

export type GitHubRemoteVerificationState =
  | "verified-latest"
  | "changed-since-verification"
  | "no-verification"
  | "remote-error";

export interface GitHubProjectReadState {
  model: GitHubRepositoryReadModel | null;
  error: string | null;
  loading: boolean;
}

export interface GitHubIntegrationService {
  getStatus(): Promise<GitHubConnectionStatus>;
  startDeviceFlow(): Promise<GitHubDeviceFlowStart>;
  pollDeviceFlow(): Promise<GitHubDeviceFlowPollResult>;
  cancelDeviceFlow(): Promise<void>;
  disconnect(): Promise<GitHubConnectionStatus>;
  listRepositories(search?: string): Promise<GitHubRepositoryOption[]>;
  listBranches(owner: string, repository: string): Promise<GitHubBranchOption[]>;
  readRepository(
    owner: string,
    repository: string,
    branch: string,
  ): Promise<GitHubRepositoryReadModel>;
}

export interface GitHubIntegrationController {
  status: GitHubConnectionStatus;
  deviceFlow: GitHubDeviceFlowStart | null;
  repositories: GitHubRepositoryOption[];
  branches: GitHubBranchOption[];
  readStates: Readonly<Record<string, GitHubProjectReadState>>;
  error: string | null;
  busy: boolean;
  connect: () => Promise<void>;
  pollDeviceFlow: () => Promise<void>;
  cancelDeviceFlow: () => Promise<void>;
  disconnect: () => Promise<void>;
  loadRepositories: (search?: string) => Promise<void>;
  loadBranches: (owner: string, repository: string) => Promise<void>;
  refreshProject: (project: Pick<Project, "id" | "githubOwner" | "githubRepo" | "branch">) => Promise<void>;
}

export const disconnectedGitHubStatus: GitHubConnectionStatus = {
  configured: false,
  connected: false,
  accountLogin: null,
  accountName: null,
  managementUrl: null,
  error: null,
};

export const unavailableGitHubIntegration: GitHubIntegrationController = {
  status: disconnectedGitHubStatus,
  deviceFlow: null,
  repositories: [],
  branches: [],
  readStates: {},
  error: null,
  busy: false,
  connect: async () => undefined,
  pollDeviceFlow: async () => undefined,
  cancelDeviceFlow: async () => undefined,
  disconnect: async () => undefined,
  loadRepositories: async () => undefined,
  loadBranches: async () => undefined,
  refreshProject: async () => undefined,
};

export function getRemoteVerificationState(
  remoteHeadSha: string | null | undefined,
  lastVerifiedCommit: string | null | undefined,
  remoteError?: string | null,
): GitHubRemoteVerificationState {
  if (remoteError) return "remote-error";
  const verified = lastVerifiedCommit?.trim().toLowerCase() ?? "";
  if (!verified || !isGitHubCommitSha(verified)) return "no-verification";
  const remoteHead = remoteHeadSha?.trim().toLowerCase() ?? "";
  if (!remoteHead || !isGitHubCommitSha(remoteHead)) return "remote-error";
  return remoteHead === verified || remoteHead.startsWith(verified)
    ? "verified-latest"
    : "changed-since-verification";
}

export function getGitHubReadStateKey(projectId: string): string {
  return projectId;
}
