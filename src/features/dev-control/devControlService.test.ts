import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PROJECT_BRANCH,
  createProject,
  createProjectAction,
  createProjectHistory,
  createProjectIdea,
  createProjectMilestone,
  getOpenNextCount,
  getProjectRepositoryMode,
  getProjectChildren,
  getProjectLastUpdated,
  getVisibleProjects,
  hasBlockedAction,
  normalizeProjectRepositoryFields,
  normalizeProjectGitHubFields,
  parseGitHubRepositoryUrl,
  softDeleteProject,
  softDeleteProjectAction,
  softDeleteProjectHistory,
  softDeleteProjectIdea,
  softDeleteProjectMilestone,
  updateProject,
  updateProjectAction,
  updateProjectHistory,
  updateProjectIdea,
  updateProjectMilestone,
} from "./devControlService";

const DEVICE_ID = "device-a";

function projectInput() {
  return {
    name: "Always Memo",
    repository: "https://github.com/example/always-memo",
    branch: "main",
    status: "ACTIVE" as const,
    currentSummary: "Dev Control 설계 완료",
    targetSummary: "동기화 가능한 개발 관제탑",
    lastVerifiedCommit: "abc123",
    lastVerifiedAt: "2026-08-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Dev Control service", () => {
  it("keeps repository mode out of the persisted project contract", () => {
    expect(
      normalizeProjectRepositoryFields(
        "github",
        "  https://github.com/example/app  ",
        "",
        "abc123",
        "2026-08-01T00:00:00.000Z",
      ),
    ).toEqual({
      repository: "https://github.com/example/app",
      branch: DEFAULT_PROJECT_BRANCH,
      lastVerifiedCommit: "abc123",
      lastVerifiedAt: "2026-08-01T00:00:00.000Z",
      error: null,
    });
    expect(normalizeProjectRepositoryFields("github", "", "develop").error).toBe(
      "GitHub Repository 연결 모드에서는 Repository URL이 필요합니다.",
    );
    expect(
      normalizeProjectRepositoryFields(
        "text",
        "ignored",
        "ignored",
        "stale-commit",
        "2026-08-01T00:00:00.000Z",
      ),
    ).toEqual({
      repository: null,
      branch: null,
      lastVerifiedCommit: null,
      lastVerifiedAt: null,
      error: null,
    });
    expect(
      normalizeProjectRepositoryFields("github", "https://github.com/example", "main").error,
    ).toContain("https://github.com/owner/repository");
    expect(
      normalizeProjectRepositoryFields(
        "github",
        "https://github.com/example/app/issues",
        "main",
      ).error,
    ).toContain("https://github.com/owner/repository");
    expect(
      normalizeProjectRepositoryFields("github", "https://gitlab.com/example/app", "main").error,
    ).toContain("https://github.com/owner/repository");
    expect(getProjectRepositoryMode({ repository: null, branch: null })).toBe("text");
    expect(getProjectRepositoryMode({ repository: null, branch: "legacy" })).toBe("github");
    expect(
      getProjectRepositoryMode({
        repository: null,
        branch: null,
        githubRepositoryId: "42",
        githubOwner: "octo",
        githubRepo: "repo",
      }),
    ).toBe("github");
  });

  it("supports project and child CRUD while preserving sync metadata", () => {
    const project = createProject(DEVICE_ID, projectInput());
    const milestone = createProjectMilestone(project.id, "v1", DEVICE_ID);
    const action = createProjectAction(project.id, "검증", DEVICE_ID);
    const idea = createProjectIdea(project.id, "모바일 projection", DEVICE_ID);
    const history = createProjectHistory(
      project.id,
      "Stage 완료",
      DEVICE_ID,
      "MILESTONE",
      "2026-08-01T00:00:00.000Z",
      "4c258830",
    );

    expect(project.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(project.createdAt).toBe(project.updatedAt);
    expect(project.deletedAt).toBeNull();
    expect(history.githubRef).toBe("4c258830");

    vi.setSystemTime(new Date("2026-08-01T00:01:00.000Z"));
    const updatedProject = updateProject(
      project,
      { currentSummary: "v1 구현 진행", status: "COMPLETED" },
      DEVICE_ID,
    );
    const updatedMilestone = updateProjectMilestone(
      milestone,
      { status: "COMPLETED" },
      DEVICE_ID,
    );
    const updatedAction = updateProjectAction(
      action,
      { status: "DONE", type: "NEXT" },
      DEVICE_ID,
    );
    const updatedIdea = updateProjectIdea(idea, { title: "모바일 projection 후보" }, DEVICE_ID);
    const updatedHistory = updateProjectHistory(
      history,
      { summary: "Stage 완료 및 검증" },
      DEVICE_ID,
    );

    expect(updatedProject.status).toBe("COMPLETED");
    expect(updatedProject.updatedAt).toBe("2026-08-01T00:01:00.000Z");
    expect(updatedMilestone.status).toBe("COMPLETED");
    expect(updatedAction.status).toBe("DONE");
    expect(updatedIdea.title).toContain("후보");
    expect(updatedHistory.summary).toContain("검증");
  });

  it("normalizes explicit GitHub identity without making it the project name", () => {
    expect(
      normalizeProjectGitHubFields("github", "  123  ", " octo ", " repo "),
    ).toEqual({
      githubRepositoryId: "123",
      githubOwner: "octo",
      githubRepo: "repo",
    });
    expect(normalizeProjectGitHubFields("github", "123", "octo", null)).toEqual({
      githubRepositoryId: null,
      githubOwner: null,
      githubRepo: null,
    });
    expect(normalizeProjectGitHubFields("text", "123", "octo", "repo")).toEqual({
      githubRepositoryId: null,
      githubOwner: null,
      githubRepo: null,
    });

    const project = createProject(DEVICE_ID, {
      ...projectInput(),
      name: "내 운영 프로젝트",
      githubRepositoryId: "123",
      githubOwner: "octo",
      githubRepo: "repo",
    });
    expect(project.name).toBe("내 운영 프로젝트");
    expect(project.githubRepositoryId).toBe("123");
    expect(
      createProject(DEVICE_ID, {
        ...projectInput(),
        githubRepositoryId: "123",
        githubOwner: "octo",
      }),
    ).toMatchObject({
      githubRepositoryId: null,
      githubOwner: null,
      githubRepo: null,
    });
    expect(
      updateProject(project, { currentSummary: "remote 조회 완료" }, DEVICE_ID),
    ).toMatchObject({
      name: "내 운영 프로젝트",
      githubRepositoryId: "123",
      githubOwner: "octo",
      githubRepo: "repo",
    });
    expect(updateProject(project, { githubRepo: null }, DEVICE_ID)).toMatchObject({
      githubRepositoryId: null,
      githubOwner: null,
      githubRepo: null,
    });
  });

  it("parses URL-only projects for an explicit identity upgrade", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/octo/repo")).toEqual({
      owner: "octo",
      repo: "repo",
    });
    expect(parseGitHubRepositoryUrl("https://github.com/octo/repo.git")).toEqual({
      owner: "octo",
      repo: "repo",
    });
    expect(parseGitHubRepositoryUrl("https://github.com/octo/repo/issues")).toBeNull();
  });

  it("derives card state and hides children after a parent tombstone", () => {
    const project = createProject(DEVICE_ID, projectInput());
    const laterAction = createProjectAction(project.id, "나중에", DEVICE_ID, "LATER");
    const blockedAction = createProjectAction(project.id, "막힘", DEVICE_ID, "BLOCKED");
    const nextAction = createProjectAction(project.id, "다음", DEVICE_ID, "NEXT");
    const milestone = createProjectMilestone(project.id, "Stage 1", DEVICE_ID);
    const idea = createProjectIdea(project.id, "후보", DEVICE_ID);
    const history = createProjectHistory(project.id, "메모", DEVICE_ID);

    expect(getVisibleProjects([project])).toEqual([project]);
    expect(getOpenNextCount([laterAction, blockedAction, nextAction])).toBe(1);
    expect(hasBlockedAction([laterAction, blockedAction, nextAction])).toBe(true);
    expect(
      getProjectChildren(project.id, [project], [milestone]),
    ).toEqual([milestone]);
    expect(
      getProjectLastUpdated(project, [milestone], [nextAction], [idea], [history]),
    ).toBe(project.updatedAt);

    const deletedProject = softDeleteProject(project, DEVICE_ID);
    expect(getVisibleProjects([deletedProject])).toEqual([]);
    expect(getProjectChildren(project.id, [deletedProject], [milestone])).toEqual([]);
  });

  it("soft-deletes every entity without removing its tombstone", () => {
    const project = createProject(DEVICE_ID, projectInput());
    const milestone = createProjectMilestone(project.id, "v1", DEVICE_ID);
    const action = createProjectAction(project.id, "검증", DEVICE_ID);
    const idea = createProjectIdea(project.id, "후보", DEVICE_ID);
    const history = createProjectHistory(project.id, "메모", DEVICE_ID);

    const deleted = [
      softDeleteProject(project, DEVICE_ID),
      softDeleteProjectMilestone(milestone, DEVICE_ID),
      softDeleteProjectAction(action, DEVICE_ID),
      softDeleteProjectIdea(idea, DEVICE_ID),
      softDeleteProjectHistory(history, DEVICE_ID),
    ];

    for (const entity of deleted) {
      expect(entity.deletedAt).toBe(entity.updatedAt);
      expect(entity.deviceId).toBe(DEVICE_ID);
    }
  });
});
