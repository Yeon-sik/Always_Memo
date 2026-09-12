import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import {
  type GitHubConnectionStatus,
  type GitHubIntegrationController,
  type GitHubIntegrationService,
} from "./githubTypes";
import { useGitHubIntegration } from "./useGitHubIntegration";

const connectedStatus: GitHubConnectionStatus = {
  configured: true,
  connected: true,
  accountLogin: "octo",
  accountName: null,
  managementUrl: null,
  error: null,
};

function createService(overrides: Partial<GitHubIntegrationService> = {}) {
  return {
    getStatus: vi.fn().mockResolvedValue(connectedStatus),
    startDeviceFlow: vi.fn(),
    pollDeviceFlow: vi.fn(),
    cancelDeviceFlow: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(connectedStatus),
    listRepositories: vi.fn().mockResolvedValue([]),
    listBranches: vi.fn().mockResolvedValue([]),
    readRepository: vi.fn(),
    ...overrides,
  } satisfies GitHubIntegrationService;
}

describe("useGitHubIntegration", () => {
  it("keeps a failed remote read in runtime state without mutating Project state", async () => {
    const service = createService({
      readRepository: vi.fn().mockRejectedValue(new Error("offline")),
    });
    let current: GitHubIntegrationController | undefined;
    function Harness() {
      current = useGitHubIntegration(service);
      return null;
    }

    create(<Harness />);
    await act(async () => undefined);
    await act(async () => {
      await current?.refreshProject({
        id: "project-1",
        githubOwner: "octo",
        githubRepo: "repo",
        branch: "main",
      });
    });

    expect(current?.readStates["project-1"]).toMatchObject({
      model: null,
      error: "offline",
      loading: false,
    });
    expect(current?.error).toBeNull();
  });
});
