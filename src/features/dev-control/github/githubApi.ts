import type {
  GitHubBranchOption,
  GitHubConfigInput,
  GitHubConfigService,
  GitHubConfigStatus,
  GitHubConnectionStatus,
  GitHubDeviceFlowPollResult,
  GitHubDeviceFlowStart,
  GitHubRepositoryOption,
  GitHubRepositoryReadModel,
} from "./githubTypes";

type TauriInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

async function getInvoke(): Promise<TauriInvoke> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke as TauriInvoke;
}

export const githubApi = {
  async getConfigStatus(): Promise<GitHubConfigStatus> {
    return (await getInvoke())<GitHubConfigStatus>("github_config_status");
  },

  async saveConfig(input: GitHubConfigInput): Promise<GitHubConfigStatus> {
    return (await getInvoke())<GitHubConfigStatus>("github_save_config", {
      clientId: input.clientId,
      appSlug: input.appSlug,
    });
  },

  async deleteConfig(): Promise<GitHubConfigStatus> {
    return (await getInvoke())<GitHubConfigStatus>("github_delete_config");
  },

  async getStatus(): Promise<GitHubConnectionStatus> {
    return (await getInvoke())<GitHubConnectionStatus>("github_connection_status");
  },

  async startDeviceFlow(): Promise<GitHubDeviceFlowStart> {
    return (await getInvoke())<GitHubDeviceFlowStart>("github_device_flow_start");
  },

  async pollDeviceFlow(): Promise<GitHubDeviceFlowPollResult> {
    return (await getInvoke())<GitHubDeviceFlowPollResult>("github_device_flow_poll");
  },

  async cancelDeviceFlow(): Promise<void> {
    await (await getInvoke())<void>("github_device_flow_cancel");
  },

  async disconnect(): Promise<GitHubConnectionStatus> {
    return (await getInvoke())<GitHubConnectionStatus>("github_disconnect");
  },

  async listRepositories(search?: string): Promise<GitHubRepositoryOption[]> {
    return (await getInvoke())<GitHubRepositoryOption[]>("github_list_repositories", {
      search: search?.trim() || null,
    });
  },

  async listBranches(owner: string, repository: string): Promise<GitHubBranchOption[]> {
    return (await getInvoke())<GitHubBranchOption[]>("github_list_branches", {
      owner,
      repository,
    });
  },

  async readRepository(
    owner: string,
    repository: string,
    branch: string,
  ): Promise<GitHubRepositoryReadModel> {
    return (await getInvoke())<GitHubRepositoryReadModel>("github_read_repository", {
      owner,
      repository,
      branch,
    });
  },
};
