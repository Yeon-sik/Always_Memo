import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { DevControlPanel } from "./DevControlPanel";
import type { DevControlActions } from "./useDevControlActions";
import type {
  GitHubIntegrationController,
  GitHubRepositoryOption,
} from "./github/githubTypes";

function createActions(): DevControlActions {
  return {
    addProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    addProjectMilestone: vi.fn(),
    updateProjectMilestone: vi.fn(),
    deleteProjectMilestone: vi.fn(),
    addProjectAction: vi.fn(),
    updateProjectAction: vi.fn(),
    deleteProjectAction: vi.fn(),
    addProjectIdea: vi.fn(),
    updateProjectIdea: vi.fn(),
    deleteProjectIdea: vi.fn(),
    addProjectHistory: vi.fn(),
    updateProjectHistory: vi.fn(),
    deleteProjectHistory: vi.fn(),
  };
}

function renderPanel(
  actions: DevControlActions,
  github?: GitHubIntegrationController,
): ReactTestRenderer {
  return create(
    <DevControlPanel
      {...actions}
      projects={[]}
      projectMilestones={[]}
      projectActions={[]}
      projectIdeas={[]}
      projectHistory={[]}
      selectedProjectId={null}
      onSelectProject={vi.fn()}
      github={github}
    />,
  );
}

function hasText(renderer: ReactTestRenderer, text: string): boolean {
  return renderer.root
    .findAllByType("span")
    .some((node) => node.children.join("") === text);
}

describe("DevControlPanel project modes", () => {
  it("defaults to GitHub and clears connection verification fields in text mode", () => {
    const actions = createActions();
    const renderer = renderPanel(actions);

    act(() => {
      renderer.root
        .findAllByType("button")
        .find((button) => button.children.join("") === "새 프로젝트")
        ?.props.onClick();
    });

    expect(
      renderer.root
        .findAllByType("input")
        .find((input) => input.props.type === "radio" && input.props.value === "github")
        ?.props.checked,
    ).toBe(true);
    expect(hasText(renderer, "Last verified commit")).toBe(true);
    expect(hasText(renderer, "Last verified at")).toBe(true);

    act(() => {
      renderer.root
        .findAllByType("input")
        .find((input) => input.props.type === "radio" && input.props.value === "text")
        ?.props.onChange();
    });

    expect(hasText(renderer, "Last verified commit")).toBe(false);
    expect(hasText(renderer, "Last verified at")).toBe(false);

    const nameInput = renderer.root
      .findAllByType("input")
      .find((input) => input.props.type === undefined && input.props.value === "");
    act(() => {
      nameInput?.props.onChange({ target: { value: "텍스트 프로젝트" } });
    });

    const projectForm = renderer.root.findAllByType("form")[0];
    act(() => {
      projectForm.props.onSubmit({ preventDefault: vi.fn() });
    });

    expect(actions.addProject).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "텍스트 프로젝트",
        repository: null,
        branch: null,
        lastVerifiedCommit: null,
        lastVerifiedAt: null,
      }),
    );
  });

  it("selects an accessible repository, loads branches, and only suggests its name", async () => {
    const actions = createActions();
    const repository: GitHubRepositoryOption = {
      id: "42",
      owner: "octo",
      name: "repo",
      fullName: "octo/repo",
      htmlUrl: "https://github.com/octo/repo",
      defaultBranch: "trunk",
      private: true,
      description: null,
    };
    const github: GitHubIntegrationController = {
      status: {
        configured: true,
        connected: true,
        accountLogin: "octo",
        accountName: null,
        managementUrl: "https://github.com/apps/personal-os/installations/new",
        error: null,
      },
      deviceFlow: null,
      repositories: [repository],
      branches: [{ name: "trunk", protected: true }],
      readStates: {},
      error: null,
      busy: false,
      connect: vi.fn(),
      pollDeviceFlow: vi.fn(),
      cancelDeviceFlow: vi.fn(),
      disconnect: vi.fn(),
      loadRepositories: vi.fn().mockResolvedValue(undefined),
      loadBranches: vi.fn().mockResolvedValue(undefined),
      refreshProject: vi.fn().mockResolvedValue(undefined),
    };
    const renderer = renderPanel(actions, github);

    act(() => {
      renderer.root
        .findAllByType("button")
        .find((button) => button.children.join("") === "새 프로젝트")
        ?.props.onClick();
    });
    await act(async () => {
      renderer.root
        .findAllByType("button")
        .find((button) => button.children.join("") === "저장소 선택/권한 관리")
        ?.props.onClick();
    });
    act(() => {
      renderer.root
        .findAllByType("button")
        .find((button) => button.props["aria-label"] === "GitHub Repository octo/repo")
        ?.props.onClick();
    });

    const projectForm = renderer.root.findAllByType("form")[0];
    await act(async () => {
      projectForm.props.onSubmit({ preventDefault: vi.fn() });
    });

    expect(github.loadBranches).toHaveBeenCalledWith("octo", "repo");
    expect(actions.addProject).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "repo",
        repository: "https://github.com/octo/repo",
        branch: "trunk",
        githubRepositoryId: "42",
        githubOwner: "octo",
        githubRepo: "repo",
      }),
    );
  });
});
