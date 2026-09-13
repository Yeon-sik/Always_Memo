import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import {
  disconnectedGitHubStatus,
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
  it("keeps status lookup failures distinct from a successful not-configured status", async () => {
    let current: GitHubIntegrationController | undefined;
    const failingService = createService({
      getStatus: vi.fn().mockRejectedValue("Command github_connection_status not allowed by ACL"),
    });
    function FailingHarness() {
      current = useGitHubIntegration(failingService);
      return null;
    }

    create(<FailingHarness />);
    await act(async () => undefined);

    expect(current?.statusCheckError).toBe("Command github_connection_status not allowed by ACL");
    expect(current?.status.configured).toBe(false);

    const notConfiguredService = createService({
      getStatus: vi.fn().mockResolvedValue(disconnectedGitHubStatus),
    });
    let notConfiguredCurrent: GitHubIntegrationController | undefined;
    function NotConfiguredHarness() {
      notConfiguredCurrent = useGitHubIntegration(notConfiguredService);
      return null;
    }

    create(<NotConfiguredHarness />);
    await act(async () => undefined);

    expect(notConfiguredCurrent?.statusCheckError).toBeNull();
    expect(notConfiguredCurrent?.status.configured).toBe(false);
  });

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
