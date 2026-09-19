import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { DevControlPanel } from "./DevControlPanel";
import type { DevControlActions } from "./useDevControlActions";
import type {
  GitHubIntegrationController,
  GitHubRepositoryOption,
} from "./github/githubTypes";
import { getProjectRepositoryMode, updateProject } from "./devControlService";
import type { Project } from "../../types";

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
  projects: Project[] = [],
  selectedProjectId: string | null = null,
): ReactTestRenderer {
  return create(
    <DevControlPanel
      {...actions}
      projects={projects}
      projectMilestones={[]}
      projectActions={[]}
      projectIdeas={[]}
      projectHistory={[]}
      selectedProjectId={selectedProjectId}
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
      repositoryLoadState: { loading: false, diagnostic: null, error: null },
      branches: [{ name: "trunk", protected: true }],
      readStates: {},
      statusCheckError: null,
      error: null,
      busy: false,
      refreshStatus: vi.fn(),
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

  it("searches repositories without submitting the new project form", async () => {
    const actions = createActions();
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
      repositories: [],
      repositoryLoadState: { loading: false, diagnostic: null, error: null },
      branches: [],
      readStates: {},
      statusCheckError: null,
      error: null,
      busy: false,
      refreshStatus: vi.fn(),
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

    expect(renderer.root.findAllByType("form")).toHaveLength(1);
    vi.mocked(github.loadRepositories).mockClear();

    const searchInput = renderer.root
      .findAllByType("input")
      .find((input) => input.props.placeholder === "owner/repository 검색");
    act(() => {
      searchInput?.props.onChange({ target: { value: "octo/query" } });
    });

    const searchButton = renderer.root
      .findAllByType("button")
      .find((button) => button.children.join("") === "검색");
    expect(searchButton?.props.type).toBe("button");
    act(() => {
      searchButton?.props.onClick();
    });
    expect(github.loadRepositories).toHaveBeenCalledTimes(1);
    expect(github.loadRepositories).toHaveBeenCalledWith("octo/query");
    expect(actions.addProject).not.toHaveBeenCalled();
    expect(actions.updateProject).not.toHaveBeenCalled();

    vi.mocked(github.loadRepositories).mockClear();
    const preventDefault = vi.fn();
    act(() => {
      searchInput?.props.onKeyDown({ key: "Enter", preventDefault });
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(github.loadRepositories).toHaveBeenCalledWith("octo/query");
    expect(actions.addProject).not.toHaveBeenCalled();
    expect(actions.updateProject).not.toHaveBeenCalled();
  });

  it("saves an explicit GitHub to text-mode transition as a durable disconnect", () => {
    const actions = createActions();
    const project: Project = {
      id: "project-1",
      createdAt: "2026-08-01T00:00:00.000Z",
      isBackfilled: false,
      backfilledAt: null,
      backfillReason: null,
      name: "Linked project",
      repository: "https://github.com/octo/repo",
      branch: "main",
      githubRepositoryId: "42",
      githubOwner: "octo",
      githubRepo: "repo",
      status: "ACTIVE",
      currentSummary: "Current",
      targetSummary: "Target",
      lastVerifiedCommit: "a".repeat(40),
      lastVerifiedAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      deletedAt: null,
      deviceId: "device-a",
    };
    const renderer = renderPanel(actions, undefined, [project], project.id);

    act(() => {
      renderer.root
        .findAllByType("button")
        .find((button) =>
          button
            .findAllByType("span")
            .some((span) => span.children.join("") === "Linked project"),
        )
        ?.props.onClick();
    });
    act(() => {
      renderer.root
        .findAllByType("input")
        .find((input) => input.props.type === "radio" && input.props.value === "text")
        ?.props.onChange();
    });

    const projectForm = renderer.root.findAllByType("form")[0];
    act(() => {
      projectForm.props.onSubmit({ preventDefault: vi.fn() });
    });

    const changes = vi.mocked(actions.updateProject).mock.calls[0]?.[1];
    expect(changes).toMatchObject({
      repository: null,
      branch: null,
      githubRepositoryId: null,
      githubOwner: null,
      githubRepo: null,
      lastVerifiedCommit: null,
      lastVerifiedAt: null,
    });

    const savedProject = updateProject(project, changes ?? {}, "device-a");
    expect(getProjectRepositoryMode(savedProject)).toBe("text");
    expect(savedProject).toMatchObject({
      repository: null,
      branch: null,
      githubRepositoryId: null,
      githubOwner: null,
      githubRepo: null,
      lastVerifiedCommit: null,
      lastVerifiedAt: null,
    });

    const reopenedRenderer = renderPanel(
      actions,
      undefined,
      [savedProject],
      savedProject.id,
    );
    act(() => {
      reopenedRenderer.root
        .findAllByType("button")
        .find((button) =>
          button
            .findAllByType("span")
            .some((span) => span.children.join("") === "Linked project"),
        )
        ?.props.onClick();
    });
    expect(
      reopenedRenderer.root
        .findAllByType("input")
        .find((input) => input.props.type === "radio" && input.props.value === "text")
        ?.props.checked,
    ).toBe(true);
  });
});
