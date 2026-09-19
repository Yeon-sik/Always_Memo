import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { DevControlPanel } from "./DevControlPanel";
import type { Project } from "../../types";

function project(): Project {
  return {
    id: "project-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    isBackfilled: false,
    backfilledAt: null,
    backfillReason: null,
    name: "Personal OS",
    repository: "https://github.com/octo/personal-os",
    branch: "main",
    githubRepositoryId: "42",
    githubOwner: "octo",
    githubRepo: "personal-os",
    status: "ACTIVE",
    currentSummary: "Workspace를 분리하는 중",
    targetSummary: "Command Center와 Workspace 분리",
    lastVerifiedCommit: "a".repeat(40),
    lastVerifiedAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    deletedAt: null,
    deviceId: "device-a",
  };
}

function renderPanel(): { renderer: ReactTestRenderer; open: ReturnType<typeof vi.fn>; createProject: ReturnType<typeof vi.fn> } {
  const open = vi.fn();
  const createProject = vi.fn();
  const renderer = create(
    <DevControlPanel
      projects={[project()]}
      projectMilestones={[]}
      projectActions={[]}
      projectIdeas={[]}
      projectHistory={[]}
      selectedProjectId={null}
      onOpenProjectWorkspace={open}
      onCreateProjectWorkspace={createProject}
    />,
  );
  return { renderer, open, createProject };
}

describe("DevControlPanel command center", () => {
  it("shows a compact project scan and opens the workspace on project click", () => {
    const { renderer, open } = renderPanel();

    expect(renderer.root.findAllByType("form")).toHaveLength(0);
    expect(renderer.root.findAllByType("span").some((node) => node.children.join("") === "Personal OS")).toBe(true);

    act(() => {
      renderer.root.findAllByType("button").find((button) =>
        button.findAllByType("span").some((span) => span.children.join("") === "Personal OS"),
      )?.props.onClick();
    });

    expect(open).toHaveBeenCalledWith("project-1");
  });

  it("opens create mode without rendering project editing controls", () => {
    const { renderer, createProject } = renderPanel();

    act(() => {
      renderer.root.findAllByType("button").find((button) => button.children.join("") === "새 프로젝트")?.props.onClick();
    });

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAllByType("form")).toHaveLength(0);
  });
});
