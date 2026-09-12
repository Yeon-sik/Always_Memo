import { useState, type FormEvent } from "react";

import { parseGitHubRepositoryUrl } from "../devControlService";
import type {
  GitHubIntegrationController,
  GitHubRepositoryOption,
} from "./githubTypes";

interface GitHubRepositoryPickerProps {
  integration: GitHubIntegrationController;
  repository: string;
  branch: string;
  githubRepositoryId: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
  onRepositoryChange: (value: string) => void;
  onBranchChange: (value: string) => void;
  onIdentityChange: (repository: GitHubRepositoryOption) => void;
}

export function GitHubRepositoryPicker({
  integration,
  repository,
  branch,
  githubRepositoryId,
  githubOwner,
  githubRepo,
  onRepositoryChange,
  onBranchChange,
  onIdentityChange,
}: GitHubRepositoryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const legacyRepository = !githubRepositoryId
    ? parseGitHubRepositoryUrl(repository)
    : null;

  function openPicker(nextSearch = "") {
    setSearch(nextSearch);
    setIsOpen(true);
    void integration.loadRepositories(nextSearch);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    void integration.loadRepositories(search);
  }

  function selectRepository(option: GitHubRepositoryOption) {
    onIdentityChange(option);
    setIsOpen(false);
    void integration.loadBranches(option.owner, option.name);
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-600 dark:text-neutral-300">
          {githubOwner && githubRepo
            ? `선택된 Repository: ${githubOwner}/${githubRepo}`
            : legacyRepository
              ? `URL-only Repository: ${legacyRepository.owner}/${legacyRepository.repo}`
              : "Repository를 선택하세요."}
        </span>
        {integration.status.connected ? (
          <button
            type="button"
            onClick={() =>
              openPicker(
                legacyRepository
                  ? `${legacyRepository.owner}/${legacyRepository.repo}`
                  : "",
              )
            }
            className="rounded border border-teal-300 px-2 py-1 text-[11px] font-semibold text-teal-800 dark:border-teal-800 dark:text-teal-200"
          >
            {legacyRepository ? "GitHub 연결 업그레이드" : "저장소 선택/권한 관리"}
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300">
          <span>Repository URL (호환)</span>
          <input
            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
            value={repository}
            placeholder="https://github.com/owner/repository"
            onChange={(event) => onRepositoryChange(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300">
          <span>Tracked branch</span>
          {githubOwner && githubRepo && integration.branches.length > 0 ? (
            <select
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
              value={branch}
              onChange={(event) => onBranchChange(event.target.value)}
            >
              {!integration.branches.some((option) => option.name === branch) ? (
                <option value={branch}>{branch}</option>
              ) : null}
              {integration.branches.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.name}{option.protected ? " · protected" : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-950"
              value={branch}
              placeholder="main"
              onChange={(event) => onBranchChange(event.target.value)}
            />
          )}
        </label>
      </div>

      {isOpen ? (
        <div className="grid gap-2 rounded border border-slate-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-950">
          <form className="flex gap-2" onSubmit={submitSearch}>
            <input
              autoFocus
              className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              value={search}
              placeholder="owner/repository 검색"
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit" className="rounded bg-slate-800 px-2 py-1 text-[11px] text-white">
              검색
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded border border-slate-300 px-2 py-1 text-[11px] dark:border-neutral-700"
            >
              닫기
            </button>
          </form>
          <div className="grid max-h-48 gap-1 overflow-auto">
            {integration.repositories.length === 0 ? (
              <p className="p-2 text-[11px] text-slate-500">접근 가능한 Repository가 없습니다.</p>
            ) : (
              integration.repositories.map((option) => (
                <button
                  key={option.id}
                  aria-label={`GitHub Repository ${option.fullName}`}
                  type="button"
                  onClick={() => selectRepository(option)}
                  className={`grid gap-0.5 rounded border p-2 text-left text-[11px] hover:border-teal-500 ${githubRepositoryId === option.id ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30" : "border-slate-200 dark:border-neutral-800"}`}
                >
                  <span className="font-semibold">{option.fullName}</span>
                  <span className="text-slate-500">
                    기본 branch: {option.defaultBranch}{option.private ? " · private" : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
