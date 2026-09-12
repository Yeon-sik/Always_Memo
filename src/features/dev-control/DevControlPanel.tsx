import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type {
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
import {
  DEFAULT_PROJECT_BRANCH,
  getProjectRepositoryMode,
  getOpenNextCount,
  getProjectChildren,
  getProjectLastUpdated,
  hasBlockedAction,
  normalizeProjectGitHubFields,
  normalizeProjectRepositoryFields,
} from "./devControlService";
import type { DevProjectRepositoryMode } from "./devControlService";
import type { DevControlActions } from "./useDevControlActions";
import { GitHubConnectionBar } from "./github/GitHubConnectionBar";
import { GitHubRepositoryPicker } from "./github/GitHubRepositoryPicker";
import { GitHubRepositoryObservation } from "./github/GitHubRepositoryObservation";
import {
  unavailableGitHubIntegration,
  type GitHubIntegrationController,
  type GitHubRepositoryOption,
} from "./github/githubTypes";

export interface DevControlPanelProps extends DevControlActions {
  projects: Project[];
  projectMilestones: ProjectMilestone[];
  projectActions: ProjectAction[];
  projectIdeas: ProjectIdea[];
  projectHistory: ProjectHistory[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  github?: GitHubIntegrationController;
}

const PROJECT_STATUSES: DevProjectStatus[] = ["ACTIVE", "PLANNED", "COMPLETED"];
const PROJECT_STATUS_LABELS: Record<DevProjectStatus, string> = {
  ACTIVE: "진행 중",
  PLANNED: "예정",
  COMPLETED: "완료",
};
const MILESTONE_STATUSES: DevMilestoneStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
];
const ACTION_TYPES: DevActionType[] = ["NEXT", "LATER", "BLOCKED"];
const ACTION_STATUSES: DevActionStatus[] = ["OPEN", "DONE"];
const HISTORY_TYPES: DevHistoryType[] = ["STATUS_CHANGE", "MILESTONE", "RELEASE", "NOTE"];

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const className = "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-teal-500 dark:border-neutral-700 dark:bg-neutral-950";
  return (
    <label className="grid gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300">
      <span>{label}</span>
      {multiline ? (
        <textarea className={`${className} min-h-16 resize-y`} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={className} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <h3 className="mb-2 text-xs font-bold tracking-wide text-slate-700 dark:text-neutral-200">{title}</h3>
      {children}
    </section>
  );
}

export function DevControlPanel({
  projects,
  projectMilestones,
  projectActions,
  projectIdeas,
  projectHistory,
  selectedProjectId,
  onSelectProject,
  addProject,
  updateProject,
  deleteProject,
  addProjectMilestone,
  updateProjectMilestone,
  deleteProjectMilestone,
  addProjectAction,
  updateProjectAction,
  deleteProjectAction,
  addProjectIdea,
  updateProjectIdea,
  deleteProjectIdea,
  addProjectHistory,
  updateProjectHistory,
  deleteProjectHistory,
  github = unavailableGitHubIntegration,
}: DevControlPanelProps) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const [isCreating, setIsCreating] = useState(false);
  const [repositoryMode, setRepositoryMode] = useState<DevProjectRepositoryMode>("github");
  const [projectFormError, setProjectFormError] = useState<string | null>(null);
  const [projectDraft, setProjectDraft] = useState(() => ({
    name: "",
    repository: "",
    branch: DEFAULT_PROJECT_BRANCH,
    githubRepositoryId: null as string | null,
    githubOwner: null as string | null,
    githubRepo: null as string | null,
    status: "PLANNED" as DevProjectStatus,
    currentSummary: "",
    targetSummary: "",
    lastVerifiedCommit: "",
    lastVerifiedAt: "",
  }));
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [actionTitle, setActionTitle] = useState("");
  const [actionType, setActionType] = useState<DevActionType>("NEXT");
  const [ideaTitle, setIdeaTitle] = useState("");
  const [historyDraft, setHistoryDraft] = useState({
    summary: "",
    type: "NOTE" as DevHistoryType,
    occurredAt: "",
    githubRef: "",
  });

  const selectedMilestones = useMemo(
    () => (selectedProject ? getProjectChildren(selectedProject.id, projects, projectMilestones) : []),
    [projectMilestones, projects, selectedProject],
  );
  const selectedActions = useMemo(
    () => (selectedProject ? getProjectChildren(selectedProject.id, projects, projectActions) : []),
    [projectActions, projects, selectedProject],
  );
  const selectedIdeas = useMemo(
    () => (selectedProject ? getProjectChildren(selectedProject.id, projects, projectIdeas) : []),
    [projectIdeas, projects, selectedProject],
  );
  const selectedHistory = useMemo(
    () =>
      selectedProject
        ? getProjectChildren(selectedProject.id, projects, projectHistory).sort(
            (first, second) => second.occurredAt.localeCompare(first.occurredAt),
          )
        : [],
    [projectHistory, projects, selectedProject],
  );

  const selectedGitHubReadState = selectedProject
    ? github.readStates[selectedProject.id]
    : undefined;

  useEffect(() => {
    if (
      !selectedProject ||
      !github.status.connected ||
      !selectedProject.githubOwner ||
      !selectedProject.githubRepo ||
      !selectedProject.branch
    ) {
      return;
    }
    void github.refreshProject(selectedProject);
  }, [github.refreshProject, github.status.connected, selectedProject]);

  function startCreate() {
    setProjectDraft({
      name: "",
      repository: "",
      branch: DEFAULT_PROJECT_BRANCH,
      githubRepositoryId: null,
      githubOwner: null,
      githubRepo: null,
      status: "PLANNED",
      currentSummary: "",
      targetSummary: "",
      lastVerifiedCommit: "",
      lastVerifiedAt: "",
    });
    setRepositoryMode("github");
    setProjectFormError(null);
    setIsCreating(true);
    onSelectProject(null);
  }

  function startEdit(project: Project) {
    const nextRepositoryMode = getProjectRepositoryMode(project);
    setProjectDraft({
      name: project.name,
      repository: project.repository ?? "",
      branch:
        project.branch ??
        (nextRepositoryMode === "github" ? DEFAULT_PROJECT_BRANCH : ""),
      githubRepositoryId: project.githubRepositoryId,
      githubOwner: project.githubOwner,
      githubRepo: project.githubRepo,
      status: project.status,
      currentSummary: project.currentSummary,
      targetSummary: project.targetSummary,
      lastVerifiedCommit: project.lastVerifiedCommit ?? "",
      lastVerifiedAt: toDateTimeLocal(project.lastVerifiedAt),
    });
    setRepositoryMode(nextRepositoryMode);
    setProjectFormError(null);
    setIsCreating(false);
  }

  function handleRepositoryModeChange(mode: DevProjectRepositoryMode) {
    setRepositoryMode(mode);
    setProjectFormError(null);
    if (mode === "github") {
      setProjectDraft((draft) => ({
        ...draft,
        branch: draft.branch.trim() || DEFAULT_PROJECT_BRANCH,
      }));
    } else {
      setProjectDraft((draft) => ({
        ...draft,
        githubRepositoryId: null,
        githubOwner: null,
        githubRepo: null,
      }));
    }
  }

  function handleRepositorySelection(option: GitHubRepositoryOption) {
    setProjectDraft((draft) => ({
      ...draft,
      repository: option.htmlUrl,
      branch: option.defaultBranch,
      githubRepositoryId: option.id,
      githubOwner: option.owner,
      githubRepo: option.name,
      // Repository name is a suggestion only; never overwrite a user's name.
      name: draft.name.trim() ? draft.name : option.name,
    }));
  }

  function submitProject(event: FormEvent) {
    event.preventDefault();
    if (!projectDraft.name.trim()) {
      setProjectFormError("프로젝트 이름을 입력하세요.");
      return;
    }
    const normalizedRepositoryFields = normalizeProjectRepositoryFields(
      repositoryMode,
      projectDraft.repository,
      projectDraft.branch,
      projectDraft.lastVerifiedCommit,
      toIsoOrNull(projectDraft.lastVerifiedAt),
      selectedGitHubReadState?.model
        ? [
            selectedGitHubReadState.model.remoteHead?.sha,
            ...selectedGitHubReadState.model.recentCommits.map(
              (commit) => commit.sha,
            ),
          ]
        : [],
    );
    if (normalizedRepositoryFields.error) {
      setProjectFormError(normalizedRepositoryFields.error);
      return;
    }
    const { error: _repositoryError, ...repositoryFields } =
      normalizedRepositoryFields;
    const normalizedGitHubFields = normalizeProjectGitHubFields(
      repositoryMode,
      projectDraft.githubRepositoryId,
      projectDraft.githubOwner,
      projectDraft.githubRepo,
    );
    setProjectFormError(null);
    const input = {
      name: projectDraft.name,
      ...repositoryFields,
      ...normalizedGitHubFields,
      status: projectDraft.status,
      currentSummary: projectDraft.currentSummary,
      targetSummary: projectDraft.targetSummary,
      backfillInput: undefined,
    };
    if (isCreating || !selectedProject) {
      addProject(input);
      setIsCreating(false);
      return;
    }
    updateProject(selectedProject.id, input);
  }

  function submitMilestone(event: FormEvent) {
    event.preventDefault();
    if (!selectedProject || !milestoneTitle.trim()) return;
    addProjectMilestone(selectedProject.id, milestoneTitle, "PLANNED");
    setMilestoneTitle("");
  }

  function submitAction(event: FormEvent) {
    event.preventDefault();
    if (!selectedProject || !actionTitle.trim()) return;
    addProjectAction(selectedProject.id, actionTitle, actionType, "OPEN");
    setActionTitle("");
  }

  function submitIdea(event: FormEvent) {
    event.preventDefault();
    if (!selectedProject || !ideaTitle.trim()) return;
    addProjectIdea(selectedProject.id, ideaTitle);
    setIdeaTitle("");
  }

  function submitHistory(event: FormEvent) {
    event.preventDefault();
    if (!selectedProject || !historyDraft.summary.trim()) return;
    addProjectHistory(
      selectedProject.id,
      historyDraft.summary,
      historyDraft.type,
      toIsoOrNull(historyDraft.occurredAt) ?? undefined,
      historyDraft.githubRef.trim() || null,
    );
    setHistoryDraft({ summary: "", type: "NOTE", occurredAt: "", githubRef: "" });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto pr-1">
      <GitHubConnectionBar integration={github} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-neutral-50">Dev Control</h2>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400">개발 프로젝트 운영 상태</p>
        </div>
        <button type="button" onClick={startCreate} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-black">새 프로젝트</button>
      </div>

      {PROJECT_STATUSES.map((status) => {
        const statusProjects = projects.filter((project) => project.status === status);
        return (
          <section key={status} className="grid gap-2">
            <h3 className="text-xs font-bold tracking-wide text-slate-500 dark:text-neutral-400">{PROJECT_STATUS_LABELS[status]}</h3>
            {statusProjects.length === 0 ? <p className="rounded border border-dashed border-slate-300 p-3 text-xs text-slate-400 dark:border-neutral-800">프로젝트 없음</p> : null}
            {statusProjects.map((project) => {
              const actions = getProjectChildren(project.id, projects, projectActions);
              const lastUpdated = getProjectLastUpdated(project, projectMilestones.filter((item) => item.projectId === project.id), actions, projectIdeas.filter((item) => item.projectId === project.id), projectHistory.filter((item) => item.projectId === project.id));
              return (
                <button key={project.id} type="button" onClick={() => { onSelectProject(project.id); startEdit(project); }} className={`grid gap-1 rounded-lg border p-3 text-left transition ${selectedProjectId === project.id ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30" : "border-slate-200 bg-white hover:border-slate-400 dark:border-neutral-800 dark:bg-neutral-950"}`}>
                  <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{project.name}</span><span className="text-[10px] text-slate-500">{PROJECT_STATUS_LABELS[project.status]}</span></div>
                  <p className="line-clamp-2 text-xs text-slate-600 dark:text-neutral-300">{project.currentSummary || "현재 상태를 기록하세요."}</p>
                  <p className="line-clamp-1 text-[11px] text-slate-500">목표: {project.targetSummary || "미정"}</p>
                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-500"><span>OPEN NEXT {getOpenNextCount(actions)}</span><span className={hasBlockedAction(actions) ? "font-semibold text-rose-600" : ""}>{hasBlockedAction(actions) ? "BLOCKED" : "차단 없음"}</span><span>변경 {formatTimestamp(lastUpdated)}</span></div>
                </button>
              );
            })}
          </section>
        );
      })}

      {(isCreating || selectedProject) ? (
        <>
          <Section title={isCreating ? "새 프로젝트" : "CURRENT / TARGET / GITHUB"}>
            <form className="grid gap-2" onSubmit={submitProject}>
              <Field label="이름" value={projectDraft.name} onChange={(value) => setProjectDraft((draft) => ({ ...draft, name: value }))} />
              <fieldset className="grid gap-2 rounded border border-slate-200 p-2 dark:border-neutral-800">
                <legend className="px-1 text-[11px] font-semibold text-slate-600 dark:text-neutral-300">프로젝트 연결 방식</legend>
                <div className="grid gap-1.5 text-xs text-slate-700 dark:text-neutral-200">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="dev-project-repository-mode"
                      value="github"
                      checked={repositoryMode === "github"}
                      onChange={() => handleRepositoryModeChange("github")}
                    />
                    GitHub Repository 연결
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="dev-project-repository-mode"
                      value="text"
                      checked={repositoryMode === "text"}
                      onChange={() => handleRepositoryModeChange("text")}
                    />
                    GitHub 미연결 프로젝트
                  </label>
                </div>
                <p className="text-[11px] leading-4 text-slate-500 dark:text-neutral-400">
                  {repositoryMode === "github"
                    ? "접근 가능한 Repository를 선택하고 이 Project에서 추적할 branch를 지정합니다."
                    : "GitHub 연결 없이 CURRENT / TARGET 상태를 직접 관리합니다."}
                </p>
              </fieldset>
              {repositoryMode === "github" ? (
                <GitHubRepositoryPicker
                  integration={github}
                  repository={projectDraft.repository}
                  branch={projectDraft.branch}
                  githubRepositoryId={projectDraft.githubRepositoryId}
                  githubOwner={projectDraft.githubOwner}
                  githubRepo={projectDraft.githubRepo}
                  onRepositoryChange={(value) =>
                    setProjectDraft((draft) => ({
                      ...draft,
                      repository: value,
                      githubRepositoryId: null,
                      githubOwner: null,
                      githubRepo: null,
                    }))
                  }
                  onBranchChange={(value) =>
                    setProjectDraft((draft) => ({ ...draft, branch: value }))
                  }
                  onIdentityChange={handleRepositorySelection}
                />
              ) : null}
              <label className="grid gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300"><span>상태</span><select className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950" value={projectDraft.status} onChange={(event) => setProjectDraft((draft) => ({ ...draft, status: event.target.value as DevProjectStatus }))}>{PROJECT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
              <Field label={repositoryMode === "text" ? "CURRENT (수동)" : "CURRENT"} value={projectDraft.currentSummary} onChange={(value) => setProjectDraft((draft) => ({ ...draft, currentSummary: value }))} multiline />
              <Field label={repositoryMode === "text" ? "TARGET (수동)" : "TARGET"} value={projectDraft.targetSummary} onChange={(value) => setProjectDraft((draft) => ({ ...draft, targetSummary: value }))} multiline />
              {repositoryMode === "github" ? <div className="grid grid-cols-2 gap-2"><Field label="Last verified commit" value={projectDraft.lastVerifiedCommit} onChange={(value) => setProjectDraft((draft) => ({ ...draft, lastVerifiedCommit: value }))} /><label className="grid gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300"><span>Last verified at</span><input type="datetime-local" className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950" value={projectDraft.lastVerifiedAt} onChange={(event) => setProjectDraft((draft) => ({ ...draft, lastVerifiedAt: event.target.value }))} /></label></div> : null}
              {projectFormError ? <p role="alert" className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{projectFormError}</p> : null}
              <div className="flex gap-2"><button type="submit" className="rounded bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white">저장</button>{!isCreating && selectedProject ? <button type="button" onClick={() => deleteProject(selectedProject.id)} className="rounded border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700">프로젝트 삭제</button> : null}</div>
            </form>
          </Section>

          {selectedProject ? (
            <>
              <GitHubRepositoryObservation
                project={selectedProject}
                readState={selectedGitHubReadState}
                onRefresh={() => void github.refreshProject(selectedProject)}
              />
              <Section title="MILESTONES"><form className="mb-2 flex gap-2" onSubmit={submitMilestone}><input className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950" placeholder="마일스톤 추가" value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} /><button type="submit" className="rounded bg-slate-800 px-2 text-xs text-white">추가</button></form><div className="grid gap-1">{selectedMilestones.map((item) => <div key={item.id} className="flex items-center gap-2 rounded border border-slate-200 p-2 text-xs dark:border-neutral-800"><input className="min-w-0 flex-1 bg-transparent" value={item.title} onChange={(event) => updateProjectMilestone(item.id, { title: event.target.value })} /><select className="rounded border border-slate-200 bg-transparent text-[10px] dark:border-neutral-700" value={item.status} onChange={(event) => updateProjectMilestone(item.id, { status: event.target.value as DevMilestoneStatus })}>{MILESTONE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select><button type="button" onClick={() => deleteProjectMilestone(item.id)} className="text-rose-600">삭제</button></div>)}</div></Section>
              <Section title="NEXT"><form className="mb-2 flex gap-2" onSubmit={submitAction}><input className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950" placeholder="다음 작업 추가" value={actionTitle} onChange={(event) => setActionTitle(event.target.value)} /><select className="rounded border border-slate-300 bg-transparent text-[10px] dark:border-neutral-700" value={actionType} onChange={(event) => setActionType(event.target.value as DevActionType)}>{ACTION_TYPES.map((type) => <option key={type}>{type}</option>)}</select><button type="submit" className="rounded bg-slate-800 px-2 text-xs text-white">추가</button></form><div className="grid gap-1">{selectedActions.map((item) => <div key={item.id} className="flex items-center gap-2 rounded border border-slate-200 p-2 text-xs dark:border-neutral-800"><input className="min-w-0 flex-1 bg-transparent" value={item.title} onChange={(event) => updateProjectAction(item.id, { title: event.target.value })} /><select className="rounded border border-slate-200 bg-transparent text-[10px] dark:border-neutral-700" value={item.type} onChange={(event) => updateProjectAction(item.id, { type: event.target.value as DevActionType })}>{ACTION_TYPES.map((type) => <option key={type}>{type}</option>)}</select><select className="rounded border border-slate-200 bg-transparent text-[10px] dark:border-neutral-700" value={item.status} onChange={(event) => updateProjectAction(item.id, { status: event.target.value as DevActionStatus })}>{ACTION_STATUSES.map((status) => <option key={status}>{status}</option>)}</select><button type="button" onClick={() => deleteProjectAction(item.id)} className="text-rose-600">삭제</button></div>)}</div></Section>
              <Section title="IDEAS"><form className="mb-2 flex gap-2" onSubmit={submitIdea}><input className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950" placeholder="아이디어 추가" value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} /><button type="submit" className="rounded bg-slate-800 px-2 text-xs text-white">추가</button></form><div className="grid gap-1">{selectedIdeas.map((item) => <div key={item.id} className="flex items-center gap-2 rounded border border-slate-200 p-2 text-xs dark:border-neutral-800"><input className="min-w-0 flex-1 bg-transparent" value={item.title} onChange={(event) => updateProjectIdea(item.id, { title: event.target.value })} /><button type="button" onClick={() => deleteProjectIdea(item.id)} className="text-rose-600">삭제</button></div>)}</div></Section>
              <Section title="HISTORY"><form className="grid gap-2" onSubmit={submitHistory}><Field label="요약" value={historyDraft.summary} onChange={(value) => setHistoryDraft((draft) => ({ ...draft, summary: value }))} /><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300"><span>유형</span><select className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950" value={historyDraft.type} onChange={(event) => setHistoryDraft((draft) => ({ ...draft, type: event.target.value as DevHistoryType }))}>{HISTORY_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><label className="grid gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300"><span>발생 시각</span><input type="datetime-local" className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950" value={historyDraft.occurredAt} onChange={(event) => setHistoryDraft((draft) => ({ ...draft, occurredAt: event.target.value }))} /></label></div><Field label="GitHub ref (선택)" value={historyDraft.githubRef} onChange={(value) => setHistoryDraft((draft) => ({ ...draft, githubRef: value }))} /><button type="submit" className="justify-self-start rounded bg-slate-800 px-3 py-1.5 text-xs text-white">이력 추가</button></form><div className="mt-3 grid gap-1">{selectedHistory.map((item) => <div key={item.id} className="grid gap-1 rounded border border-slate-200 p-2 text-xs dark:border-neutral-800"><div className="flex items-center justify-between gap-2"><select className="rounded border border-slate-200 bg-transparent text-[10px] dark:border-neutral-700" value={item.type} onChange={(event) => updateProjectHistory(item.id, { type: event.target.value as DevHistoryType })}>{HISTORY_TYPES.map((type) => <option key={type}>{type}</option>)}</select><span className="text-[10px] text-slate-500">{formatTimestamp(item.occurredAt)}</span><button type="button" onClick={() => deleteProjectHistory(item.id)} className="text-rose-600">삭제</button></div><input className="w-full bg-transparent" value={item.summary} onChange={(event) => updateProjectHistory(item.id, { summary: event.target.value })} />{item.githubRef ? <span className="text-[10px] text-slate-500">{item.githubRef}</span> : null}</div>)}</div></Section>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
