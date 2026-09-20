import { useCallback, useEffect, useRef, useState } from "react";

import type { LocalDataSnapshot } from "../../types";
import type { SnapshotUpdater } from "../../app/sync/useSnapshotStore";
import {
  loadKnowledgeVaultConfig,
  pickKnowledgeVaultPath,
  saveKnowledgeVaultPath,
  type KnowledgeVaultConfig,
} from "./knowledgeVaultService";
import {
  reconcileKnowledgeVaultProjection,
  type KnowledgeVaultProjectionStatus,
} from "./knowledgeVaultProjector";

const unsupportedConfig: KnowledgeVaultConfig = {
  supported: false,
  vaultPath: null,
};

export interface KnowledgeVaultRuntime {
  config: KnowledgeVaultConfig;
  isLoading: boolean;
  isReconciling: boolean;
  missingDocumentIds: string[];
  error: string | null;
  savePath: (path: string) => Promise<void>;
  choosePath: () => Promise<void>;
  reconcile: () => Promise<void>;
}

function errorMessage(caughtError: unknown, fallback: string): string {
  return caughtError instanceof Error ? caughtError.message : fallback;
}

export function useKnowledgeVaultRuntime({
  snapshot,
  isReady,
  commitSnapshot,
}: {
  snapshot: LocalDataSnapshot;
  isReady: boolean;
  commitSnapshot: (updater: SnapshotUpdater) => void;
}): KnowledgeVaultRuntime {
  const [config, setConfig] = useState<KnowledgeVaultConfig>(unsupportedConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isReconciling, setIsReconciling] = useState(false);
  const [missingDocumentIds, setMissingDocumentIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const previousSnapshotRef = useRef<LocalDataSnapshot | null>(null);
  const latestSnapshotRef = useRef(snapshot);
  const reconcileQueueRef = useRef(Promise.resolve());
  const manualReconcileVersionRef = useRef(0);

  latestSnapshotRef.current = snapshot;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void loadKnowledgeVaultConfig()
      .then((nextConfig) => {
        if (!cancelled) {
          setConfig(nextConfig);
          setError(null);
        }
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setConfig({ supported: true, vaultPath: null });
          setError(errorMessage(caughtError, "Knowledge Vault 설정을 읽지 못했습니다."));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const runReconcile = useCallback(
    (requestedSnapshot: LocalDataSnapshot, requestedVersion: number) => {
      reconcileQueueRef.current = reconcileQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (!isReady || !config.supported || !config.vaultPath) return;
          setIsReconciling(true);
          const previousSnapshot = previousSnapshotRef.current;
          previousSnapshotRef.current = requestedSnapshot;
          try {
            const status: KnowledgeVaultProjectionStatus =
              await reconcileKnowledgeVaultProjection({
                snapshot: requestedSnapshot,
                previousSnapshot,
                config,
                onDocumentPathChange: (previous, next) => {
                  commitSnapshot((current) => ({
                    ...current,
                    knowledgeDocuments: current.knowledgeDocuments.map((document) =>
                      document.id === previous.id &&
                      document.relativePath === previous.relativePath
                        ? next
                        : document,
                    ),
                  }));
                },
              });
            if (requestedVersion === manualReconcileVersionRef.current) {
              setMissingDocumentIds(status.missingDocumentIds);
              setError(status.error);
            }
          } catch (caughtError: unknown) {
            if (requestedVersion === manualReconcileVersionRef.current) {
              setError(
                errorMessage(caughtError, "Knowledge Vault projection을 갱신하지 못했습니다."),
              );
            }
          } finally {
            setIsReconciling(false);
          }
        });
      return reconcileQueueRef.current;
    },
    [commitSnapshot, config, isReady],
  );

  useEffect(() => {
    if (isLoading) return;
    manualReconcileVersionRef.current += 1;
    void runReconcile(snapshot, manualReconcileVersionRef.current);
  }, [isLoading, runReconcile, snapshot]);

  const reconcile = useCallback(async () => {
    manualReconcileVersionRef.current += 1;
    await runReconcile(latestSnapshotRef.current, manualReconcileVersionRef.current);
  }, [runReconcile]);

  const savePath = useCallback(
    async (path: string) => {
      const nextConfig = await saveKnowledgeVaultPath(path);
      setConfig(nextConfig);
      setError(null);
      previousSnapshotRef.current = null;
      manualReconcileVersionRef.current += 1;
    },
    [runReconcile],
  );

  const choosePath = useCallback(async () => {
    const path = await pickKnowledgeVaultPath();
    if (path) await savePath(path);
  }, [savePath]);

  return {
    config,
    isLoading,
    isReconciling,
    missingDocumentIds,
    error,
    savePath,
    choosePath,
    reconcile,
  };
}
