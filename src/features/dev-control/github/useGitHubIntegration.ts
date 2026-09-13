import { useCallback, useEffect, useState } from "react";

import { githubApi } from "./githubApi";
import {
  disconnectedGitHubStatus,
  getGitHubReadStateKey,
  type GitHubIntegrationController,
  type GitHubIntegrationService,
  type GitHubProjectReadState,
} from "./githubTypes";

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function useGitHubIntegration(
  service: GitHubIntegrationService = githubApi,
): GitHubIntegrationController {
  const [status, setStatus] = useState(disconnectedGitHubStatus);
  const [deviceFlow, setDeviceFlow] = useState<GitHubIntegrationController["deviceFlow"]>(null);
  const [repositories, setRepositories] = useState<GitHubIntegrationController["repositories"]>([]);
  const [branches, setBranches] = useState<GitHubIntegrationController["branches"]>([]);
  const [readStates, setReadStates] = useState<Record<string, GitHubProjectReadState>>({});
  const [statusCheckError, setStatusCheckError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const nextStatus = await service.getStatus();
      setStatus(nextStatus);
      const nextStatusError = nextStatus.configured ? nextStatus.error : null;
      setStatusCheckError(nextStatusError);
      setError(nextStatusError);
    } catch (statusError) {
      const message = errorMessage(statusError, "GitHub 연결 상태를 확인하지 못했습니다.");
      setStatus(disconnectedGitHubStatus);
      setStatusCheckError(message);
      setError(message);
    }
  }, [service]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setDeviceFlow(await service.startDeviceFlow());
    } catch (connectError) {
      setError(errorMessage(connectError, "GitHub Device Flow를 시작하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }, [service]);

  const pollDeviceFlow = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await service.pollDeviceFlow();
      if (result.connection) setStatus(result.connection);
      if (result.status === "authorized") {
        setDeviceFlow(null);
        if (!result.connection) await refreshStatus();
      } else if (result.status === "denied") {
        setDeviceFlow(null);
        setError("GitHub 인증이 거부되었습니다.");
      } else if (result.status === "expired") {
        setDeviceFlow(null);
        setError("GitHub Device Flow가 만료되었습니다. 다시 연결하세요.");
      }
    } catch (pollError) {
      setError(errorMessage(pollError, "GitHub 인증 상태를 확인하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }, [refreshStatus, service]);

  const cancelDeviceFlow = useCallback(async () => {
    setBusy(true);
    try {
      await service.cancelDeviceFlow();
      setDeviceFlow(null);
    } catch (cancelError) {
      setError(errorMessage(cancelError, "GitHub 인증을 취소하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }, [service]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await service.disconnect());
      setDeviceFlow(null);
      setRepositories([]);
      setBranches([]);
      setReadStates({});
    } catch (disconnectError) {
      setError(errorMessage(disconnectError, "GitHub 연결을 해제하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }, [service]);

  const loadRepositories = useCallback(async (search?: string) => {
    setBusy(true);
    setError(null);
    try {
      setRepositories(await service.listRepositories(search));
    } catch (repositoryError) {
      setError(errorMessage(repositoryError, "접근 가능한 GitHub Repository를 불러오지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }, [service]);

  const loadBranches = useCallback(async (owner: string, repository: string) => {
    setBusy(true);
    setError(null);
    setBranches([]);
    try {
      setBranches(await service.listBranches(owner, repository));
    } catch (branchError) {
      setBranches([]);
      setError(errorMessage(branchError, "GitHub branch 목록을 불러오지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }, [service]);

  const refreshProject = useCallback(async (
    project: Parameters<GitHubIntegrationController["refreshProject"]>[0],
  ) => {
    const key = getGitHubReadStateKey(project.id);
    if (!project.githubOwner || !project.githubRepo || !project.branch) return;
    setReadStates((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { model: null, error: null }), loading: true },
    }));
    try {
      const model = await service.readRepository(
        project.githubOwner,
        project.githubRepo,
        project.branch,
      );
      setReadStates((current) => ({
        ...current,
        [key]: { model, error: null, loading: false },
      }));
    } catch (readError) {
      setReadStates((current) => ({
        ...current,
        [key]: {
          model: current[key]?.model ?? null,
          error: errorMessage(readError, "GitHub Repository를 조회하지 못했습니다."),
          loading: false,
        },
      }));
    }
  }, [service]);

  return {
    status,
    deviceFlow,
    repositories,
    branches,
    readStates,
    statusCheckError,
    error,
    busy,
    refreshStatus,
    connect,
    pollDeviceFlow,
    cancelDeviceFlow,
    disconnect,
    loadRepositories,
    loadBranches,
    refreshProject,
  };
}
