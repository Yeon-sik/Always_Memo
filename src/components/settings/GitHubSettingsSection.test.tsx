import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { GitHubSettingsSection } from "./GitHubSettingsSection";
import type {
  GitHubConfigService,
  GitHubConfigStatus,
} from "../../features/dev-control/github/githubTypes";

const localConfig: GitHubConfigStatus = {
  clientId: "local-client-id",
  configured: true,
  appSlug: "local-app",
  source: "local-settings",
};

const fallbackConfig: GitHubConfigStatus = {
  clientId: "",
  configured: false,
  appSlug: null,
  source: "none",
};

function renderSection(
  service: GitHubConfigService,
  onRefreshGitHubStatus = vi.fn().mockResolvedValue(undefined),
): { renderer: ReactTestRenderer; onRefreshGitHubStatus: ReturnType<typeof vi.fn> } {
  return {
    renderer: create(
      <GitHubSettingsSection
        service={service}
        onRefreshGitHubStatus={onRefreshGitHubStatus}
      />,
    ),
    onRefreshGitHubStatus,
  };
}

describe("GitHubSettingsSection", () => {
  it("loads, saves, deletes local settings, and refreshes integration status", async () => {
    const service: GitHubConfigService = {
      getConfigStatus: vi.fn().mockResolvedValue(localConfig),
      saveConfig: vi.fn().mockResolvedValue(localConfig),
      deleteConfig: vi.fn().mockResolvedValue(fallbackConfig),
    };
    const { renderer, onRefreshGitHubStatus } = renderSection(service);

    await act(async () => undefined);

    const inputs = renderer.root.findAllByType("input");
    expect(inputs[0]?.props.value).toBe("local-client-id");
    expect(inputs[1]?.props.value).toBe("local-app");

    await act(async () => {
      renderer.root.findAllByType("form")[0]?.props.onSubmit({
        preventDefault: vi.fn(),
      });
    });

    expect(service.saveConfig).toHaveBeenCalledWith({
      clientId: "local-client-id",
      appSlug: "local-app",
    });
    expect(onRefreshGitHubStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      renderer.root
        .findAllByType("button")
        .find((button) => button.props.type === "button")
        ?.props.onClick();
    });

    expect(service.deleteConfig).toHaveBeenCalledTimes(1);
    expect(onRefreshGitHubStatus).toHaveBeenCalledTimes(2);
    expect(renderer.root.findAllByType("input")[0]?.props.value).toBe("");
  });
});
