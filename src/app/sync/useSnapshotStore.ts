import { useCallback, useRef, useState, type MutableRefObject } from "react";

import { createEmptySnapshot } from "../../lib/storage/storageAdapter";
import type { LocalDataSnapshot } from "../../types";

export type SnapshotUpdater = (
  current: LocalDataSnapshot,
) => LocalDataSnapshot;

export interface SnapshotStore {
  commitSnapshot: (updater: SnapshotUpdater) => void;
  replaceSnapshot: (snapshot: LocalDataSnapshot) => void;
  snapshot: LocalDataSnapshot;
  snapshotRef: MutableRefObject<LocalDataSnapshot>;
}

export function useSnapshotStore(): SnapshotStore {
  const [snapshot, setSnapshot] = useState<LocalDataSnapshot>(() =>
    createEmptySnapshot(),
  );
  const snapshotRef = useRef(snapshot);

  const replaceSnapshot = useCallback((nextSnapshot: LocalDataSnapshot) => {
    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
  }, []);

  const commitSnapshot = useCallback((updater: SnapshotUpdater) => {
    const currentSnapshot = snapshotRef.current;
    const nextSnapshot = updater(currentSnapshot);

    if (nextSnapshot === currentSnapshot) {
      return;
    }

    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
  }, []);

  return {
    commitSnapshot,
    replaceSnapshot,
    snapshot,
    snapshotRef,
  };
}
