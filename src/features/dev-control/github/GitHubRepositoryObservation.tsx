import type { Project } from "../../../types";
import { getRemoteVerificationState, type GitHubProjectReadState } from "./githubTypes";

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

const verificationLabels = {
  "verified-latest": "검증 최신",
  "changed-since-verification": "검증 이후 변경 있음",
  "no-verification": "검증 정보 없음",
  "remote-error": "remote 조회 실패",
} as const;

export function GitHubRepositoryObservation({
  project,
  readState,
  onRefresh,
}: {
  project: Project;
  readState?: GitHubProjectReadState;
  onRefresh: () => void;
}) {
  if (!project.githubOwner || !project.githubRepo) return null;

  const model = readState?.model ?? null;
  const verificationState = getRemoteVerificationState(
    model?.remoteHead?.sha,
    project.lastVerifiedCommit,
    readState?.error,
  );

  return (
    <section className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold tracking-wide text-slate-700 dark:text-neutral-200">GITHUB OBSERVATION</h3>
        <button
          type="button"
          disabled={readState?.loading}
          onClick={onRefresh}
          className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold disabled:opacity-50 dark:border-neutral-700"
        >
          새로고침
        </button>
      </div>

      <div className="grid gap-1 text-[11px] text-slate-600 dark:text-neutral-300">
        <p>
          Repository: <strong>{project.githubOwner}/{project.githubRepo}</strong>
        </p>
        <p>tracked branch: <strong>{project.branch}</strong></p>
        <p>
          상태: <strong>{readState?.loading ? "조회 중" : verificationLabels[verificationState]}</strong>
        </p>
      </div>

      {readState?.error ? (
        <p role="alert" className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          {readState.error}
        </p>
      ) : null}

      {model ? (
        <>
          <div className="grid gap-1 rounded border border-slate-200 p-2 text-[11px] dark:border-neutral-800">
            <p className="font-semibold">Remote HEAD</p>
            {model.remoteHead ? (
              <>
                <a href={model.remoteHead.htmlUrl} target="_blank" rel="noreferrer" className="break-all font-mono text-teal-700 underline dark:text-teal-300">
                  {model.remoteHead.sha}
                </a>
                <p className="line-clamp-2">{model.remoteHead.message}</p>
                <p className="text-slate-500">{formatTimestamp(model.remoteHead.committedAt)}</p>
              </>
            ) : (
              <p className="text-slate-500">commit이 없는 branch입니다.</p>
            )}
          </div>

          <div className="grid gap-1">
            <p className="text-[11px] font-semibold text-slate-700 dark:text-neutral-200">최근 commits</p>
            {model.recentCommits.length === 0 ? (
              <p className="text-[11px] text-slate-500">최근 commit이 없습니다.</p>
            ) : (
              model.recentCommits.map((commit) => (
                <a key={commit.sha} href={commit.htmlUrl} target="_blank" rel="noreferrer" className="grid gap-0.5 rounded border border-slate-200 p-2 text-[11px] hover:border-teal-400 dark:border-neutral-800">
                  <span className="font-mono text-teal-700 dark:text-teal-300">{commit.sha.slice(0, 10)}</span>
                  <span className="line-clamp-1">{commit.message.split("\n")[0]}</span>
                  <span className="text-slate-500">{formatTimestamp(commit.committedAt)}{commit.author ? ` · ${commit.author}` : ""}</span>
                </a>
              ))
            )}
          </div>

          <div className="grid gap-1">
            <p className="text-[11px] font-semibold text-slate-700 dark:text-neutral-200">open PR 요약</p>
            {model.openPullRequests.length === 0 ? (
              <p className="text-[11px] text-slate-500">열린 PR이 없습니다.</p>
            ) : (
              model.openPullRequests.map((pullRequest) => (
                <a key={pullRequest.number} href={pullRequest.htmlUrl} target="_blank" rel="noreferrer" className="rounded border border-slate-200 p-2 text-[11px] hover:border-teal-400 dark:border-neutral-800">
                  <span className="font-semibold">#{pullRequest.number} {pullRequest.title}</span>
                  <span className="block text-slate-500">{pullRequest.headBranch ?? "?"} → {pullRequest.baseBranch ?? "?"}{pullRequest.draft ? " · draft" : ""}</span>
                </a>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
            <span>마지막 조회: {formatTimestamp(model.queriedAt)}</span>
            <a href={model.repository.htmlUrl} target="_blank" rel="noreferrer" className="font-semibold text-teal-700 underline dark:text-teal-300">GitHub에서 열기</a>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-slate-500">{readState?.loading ? "GitHub에서 읽는 중입니다." : "새로고침을 눌러 remote 상태를 조회하세요."}</p>
      )}
    </section>
  );
}
