import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SaveState } from "../../components/HeaderBar";
import { getVisibleNotes } from "../../features/notes/noteService";
import {
  bindSupabaseUser,
  emptyRuntimeConfig,
  loadRuntimeConfig,
  saveSupabaseConfig as persistSupabaseConfig,
  type RuntimeConfig,
  type SupabaseConfigInput,
} from "../../lib/config/runtimeConfig";
import {
  getAutostartEnabled,
  setAutostartEnabled as setDesktopAutostartEnabled,
} from "../../lib/desktop/autostart";
import { getOrCreateDevice, upsertDevice } from "../../lib/device/device";
import { localStorageAdapter } from "../../lib/storage/localStorageAdapter";
import type { StorageAdapter } from "../../lib/storage/storageAdapter";
import { mergeSnapshot } from "../../lib/sync/supabase/snapshotMerge";
import {
  createAppSyncClient,
  getConfiguredUserId,
} from "../../lib/sync/syncClientFactory";
import type {
  FinanceDailySummary,
  SyncClient,
  SyncContext,
  SyncStatus,
} from "../../lib/sync/syncTypes";
import type { Device, LocalDataSnapshot } from "../../types";
import {
  useSnapshotStore,
  type SnapshotStore,
} from "./useSnapshotStore";

const initialSyncStatus: SyncStatus = {
  mode: "local-only",
  label: "local-only",
  detail: "동기화 상태를 확인하는 중입니다.",
  isOnline: false,
  lastSyncedAt: null,
  isConfigured: false,
};

export interface MemoSyncRuntime
  extends Pick<SnapshotStore, "commitSnapshot" | "snapshot"> {
  activeDevices: Device[];
  authEmail: string | null;
  autostartEnabled: boolean;
  autostartSupported: boolean;
  device: Device | null;
  error: string | null;
  isAuthenticated: boolean;
  isManualSyncing: boolean;
  isReady: boolean;
  isSupabaseConfigured: boolean;
  loadFinanceDailySummaries: (
    fromDate: string,
    toDate: string,
  ) => Promise<FinanceDailySummary[]>;
  manualSync: () => Promise<void>;
  saveState: SaveState;
  saveSupabaseConfig: (config: SupabaseConfigInput) => Promise<void>;
  selectedNoteId: string | null;
  setAutostartEnabled: (enabled: boolean) => Promise<void>;
  setSelectedNoteId: React.Dispatch<React.SetStateAction<string | null>>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  supabaseConfig: RuntimeConfig;
  syncStatus: SyncStatus;
  userId: string;
}

export function useMemoSyncRuntime(
  storage: StorageAdapter = localStorageAdapter,
  injectedSyncClient?: SyncClient,
  injectedUserId?: string,
): MemoSyncRuntime {
  const {
    commitSnapshot,
    replaceSnapshot,
    snapshot,
    snapshotRef,
  } = useSnapshotStore();
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(
    null,
  );
  const [device, setDevice] = useState<Device | null>(null);
  const [activeDevices, setActiveDevices] = useState<Device[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [localLoadFailed, setLocalLoadFailed] = useState(false);
  const remoteSyncBlockedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [syncStatus, setSyncStatus] =
    useState<SyncStatus>(initialSyncStatus);
  const [autostartEnabled, setAutostartState] = useState(false);
  const [autostartSupported, setAutostartSupported] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const activeRuntimeConfig = runtimeConfig ?? emptyRuntimeConfig;
  const isRuntimeConfigReady =
    runtimeConfig !== null || Boolean(injectedSyncClient) || Boolean(injectedUserId);
  const syncClient = useMemo(
    () => injectedSyncClient ?? createAppSyncClient(activeRuntimeConfig),
    [activeRuntimeConfig, injectedSyncClient],
  );
  const userId = useMemo(
    () => injectedUserId ?? authenticatedUserId ?? getConfiguredUserId(),
    [authenticatedUserId, injectedUserId],
  );
  const visibleNotes = useMemo(
    () => getVisibleNotes(snapshot.notes),
    [snapshot.notes],
  );

  useEffect(() => {
    if (injectedSyncClient || injectedUserId) {
      return;
    }

    let isMounted = true;

    async function hydrateRuntimeConfig() {
      const config = await loadRuntimeConfig();

      if (isMounted) {
        setRuntimeConfig(config);
      }
    }

    void hydrateRuntimeConfig();

    return () => {
      isMounted = false;
    };
  }, [injectedSyncClient, injectedUserId]);

  useEffect(() => {
    if (!isRuntimeConfigReady) {
      return;
    }

    let isMounted = true;

    async function hydrate() {
      const currentDevice = await getOrCreateDevice();
      setIsHydrating(true);

      try {
        // Restore the last local snapshot before auth or network work. This
        // keeps the app useful offline and prevents a failed remote request
        // from deciding whether local data is shown.
        let storedSnapshot: LocalDataSnapshot;
        try {
          storedSnapshot = await storage.load();
        } catch (caughtError) {
          if (isMounted) {
            const message =
              caughtError instanceof Error
                ? caughtError.message
                : "저장된 로컬 데이터를 읽지 못했습니다.";
            setLocalLoadFailed(true);
            setIsHydrating(false);
            setDevice(currentDevice);
            setError(message);
            setSaveState("error");
          }
          return;
        }

        const localSnapshot: LocalDataSnapshot = {
          ...storedSnapshot,
          devices: upsertDevice(storedSnapshot.devices, currentDevice),
        };
        if (!isMounted) {
          return;
        }
        setLocalLoadFailed(false);
        replaceSnapshot(localSnapshot);
        setDevice(currentDevice);
        setActiveDevices([currentDevice]);
        setSelectedNoteId(getVisibleNotes(localSnapshot.notes)[0]?.id ?? null);
        setIsReady(true);
        setSaveState("saved");

        const authState = await syncClient.getAuthState();
        if (
          authState.userId &&
          activeRuntimeConfig.boundUserId &&
          authState.userId !== activeRuntimeConfig.boundUserId
        ) {
          await syncClient.signOut();
          throw new Error(
            "이 로컬 데이터는 다른 계정에 연결되어 있습니다. 계정 전환에는 별도 데이터 이전이 필요합니다.",
          );
        }
        if (authState.userId && !activeRuntimeConfig.boundUserId) {
          setRuntimeConfig(
            bindSupabaseUser(authState.userId, activeRuntimeConfig),
          );
        }
        const resolvedUserId =
          injectedUserId ?? authState.userId ?? getConfiguredUserId();
        setAuthenticatedUserId(authState.userId);
        setAuthEmail(authState.email);
        const context: SyncContext = {
          device: currentDevice,
          userId: resolvedUserId,
        };
        const syncedSnapshot = await syncClient.pull(snapshotRef.current, context);
        const pullStatus = syncClient.getStatus();
        const mergedSnapshot = mergeSnapshot(snapshotRef.current, syncedSnapshot);
        const nextSnapshot: LocalDataSnapshot = {
          ...mergedSnapshot,
          devices: upsertDevice(mergedSnapshot.devices, currentDevice),
        };
        const nextVisibleNotes = getVisibleNotes(nextSnapshot.notes);

        await storage.save(nextSnapshot);

        if (!isMounted) {
          return;
        }

        replaceSnapshot(nextSnapshot);
        setDevice(currentDevice);
        setActiveDevices([currentDevice]);
        setSelectedNoteId(nextVisibleNotes[0]?.id ?? null);
        setSyncStatus(syncClient.getStatus());
        setIsReady(true);
        setIsHydrating(false);
        setSaveState("saved");

        if (pullStatus.mode === "error") {
          remoteSyncBlockedRef.current = true;
          setError(pullStatus.detail);
        }
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "앱 데이터를 불러오지 못했습니다.";

        setError(message);
        remoteSyncBlockedRef.current = true;
        setSyncStatus({
          ...syncClient.getStatus(),
          mode: "error",
          label: "error",
          detail: message,
        });
        setDevice(currentDevice);
        setIsHydrating(false);
        setActiveDevices([currentDevice]);
        setIsReady(true);
        setSaveState("error");
      }
    }

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [
    activeRuntimeConfig,
    commitSnapshot,
    injectedUserId,
    isRuntimeConfigReady,
    replaceSnapshot,
    storage,
    syncClient,
    userId,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function hydrateAutostart() {
      const result = await getAutostartEnabled();

      if (!isMounted) {
        return;
      }

      setAutostartSupported(result.supported);
      setAutostartState(result.enabled);
    }

    void hydrateAutostart();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      !isReady ||
      isHydrating ||
      localLoadFailed ||
      remoteSyncBlockedRef.current ||
      !device
    ) {
      return;
    }

    const context: SyncContext = { device, userId };
    const realtimeSubscription = syncClient.subscribeRealtime({
      context,
      getSnapshot: () => snapshotRef.current,
      onSnapshot: (nextSnapshot, status) => {
        replaceSnapshot(nextSnapshot);
        setSyncStatus(status);
        setError(null);
        void storage.save(nextSnapshot).catch((caughtError: unknown) => {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "원격 변경사항을 로컬 저장소에 저장하지 못했습니다.";

          setError(message);
        });
      },
      onError: (message) => setError(message),
    });
    const heartbeatSubscription = syncClient.startHeartbeat(context);

    return () => {
      void realtimeSubscription.unsubscribe();
      void heartbeatSubscription.unsubscribe();
    };
  }, [
    device,
    isHydrating,
    isReady,
    localLoadFailed,
    replaceSnapshot,
    snapshotRef,
    storage,
    syncClient,
    userId,
  ]);

  useEffect(() => {
    if (!isReady || localLoadFailed || !device) {
      return;
    }

    setSaveState("saving");

    const currentDevice = {
      ...device,
      lastSeenAt: new Date().toISOString(),
    };
    const snapshotToSave: LocalDataSnapshot = {
      ...snapshot,
      devices: upsertDevice(snapshot.devices, currentDevice),
    };
    const context: SyncContext = { device: currentDevice, userId };

    const saveTimer = window.setTimeout(() => {
      storage
        .save(snapshotToSave)
        .then(() => {
          if (isHydrating) {
            // Persist edits made while the remote hydration request is still
            // running, but defer the remote write until pull/merge finishes.
            setSaveState("saved");
            return null;
          }
          // A failed pull must not be hidden by a follow-up push. Keep the
          // local snapshot durable and wait for manual/online retry instead.
          if (
            remoteSyncBlockedRef.current ||
            syncClient.getStatus().mode === "error"
          ) {
            setSaveState("saved");
            return null;
          }
          return syncClient.push(snapshotToSave, context);
        })
        .then((result) => {
          if (!result) {
            return;
          }
          if (result.status.mode === "error") {
            remoteSyncBlockedRef.current = true;
          } else {
            remoteSyncBlockedRef.current = false;
          }
          setSaveState(result.status.mode === "error" ? "error" : "saved");
          setSyncStatus(result.status);

          if (result.status.mode === "error") {
            setError(result.status.detail);
          } else {
            setError(null);
          }
        })
        .catch((caughtError: unknown) => {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "변경사항을 저장하지 못했습니다.";

          setError(message);
          setSaveState("error");
        });
    }, 400);

    return () => window.clearTimeout(saveTimer);
  }, [
    device,
    isHydrating,
    isReady,
    localLoadFailed,
    snapshot,
    storage,
    syncClient,
    userId,
  ]);

  useEffect(() => {
    function refreshSyncStatus() {
      setSyncStatus(syncClient.getStatus());
    }

    window.addEventListener("online", refreshSyncStatus);
    window.addEventListener("offline", refreshSyncStatus);

    return () => {
      window.removeEventListener("online", refreshSyncStatus);
      window.removeEventListener("offline", refreshSyncStatus);
    };
  }, [syncClient]);

  useEffect(() => {
    if (
      !isReady ||
      isHydrating ||
      localLoadFailed ||
      remoteSyncBlockedRef.current ||
      !device
    ) {
      return;
    }

    let isMounted = true;
    const currentDevice = device;
    const context: SyncContext = { device: currentDevice, userId };

    async function refreshActiveDevices() {
      const fallbackDevices = upsertDevice(snapshot.devices, {
        ...currentDevice,
        lastSeenAt: new Date().toISOString(),
      });
      const nextDevices = await syncClient.getActiveDevices(
        context,
        fallbackDevices,
      );

      if (isMounted) {
        setActiveDevices(nextDevices);
      }
    }

    void refreshActiveDevices();
    const timerId = window.setInterval(refreshActiveDevices, 15_000);

    return () => {
      isMounted = false;
      window.clearInterval(timerId);
    };
  }, [
    device,
    isHydrating,
    isReady,
    localLoadFailed,
    snapshot.devices,
    syncClient,
    userId,
  ]);

  useEffect(() => {
    if (visibleNotes.length === 0) {
      setSelectedNoteId(null);
      return;
    }

    if (
      !selectedNoteId ||
      !visibleNotes.some((note) => note.id === selectedNoteId)
    ) {
      setSelectedNoteId(visibleNotes[0].id);
    }
  }, [selectedNoteId, visibleNotes]);

  const manualSync = useCallback(async () => {
    if (!device) {
      return;
    }

    setIsManualSyncing(true);
    setSyncStatus({
      ...syncClient.getStatus(),
      mode: "syncing",
      label: "syncing",
      detail: "수동 동기화를 실행하는 중입니다.",
    });

    const context: SyncContext = { device, userId };

    try {
      const pulledSnapshot = await syncClient.pull(snapshotRef.current, context);
      const pullStatus = syncClient.getStatus();
      if (pullStatus.mode === "error") {
        remoteSyncBlockedRef.current = true;
        setSyncStatus(pullStatus);
        setError(pullStatus.detail);
        setSaveState("error");
        return;
      }
      const rebasedSnapshot = mergeSnapshot(snapshotRef.current, pulledSnapshot);
      const pushResult = await syncClient.push(rebasedSnapshot, context);
      const latestLocalSnapshot = mergeSnapshot(
        snapshotRef.current,
        rebasedSnapshot,
      );

      if (pushResult.status.mode === "error") {
        remoteSyncBlockedRef.current = true;
        // Keep the merged pull and any edits made while the request was in
        // flight durable, while reporting the failed remote write explicitly.
        await storage.save(latestLocalSnapshot);
        replaceSnapshot(latestLocalSnapshot);
        setSyncStatus(pushResult.status);
        setError(pushResult.status.detail);
        setSaveState("error");
        return;
      }

      // A user can edit while pull or push is in flight. Rebase the result on
      // the latest ref before replacing React state so that edit is retained.
      const committedSnapshot = mergeSnapshot(
        snapshotRef.current,
        pushResult.snapshot ?? rebasedSnapshot,
      );
      await storage.save(committedSnapshot);

      replaceSnapshot(committedSnapshot);
      remoteSyncBlockedRef.current = false;
      setSyncStatus(pushResult.status);
      setError(null);
      setSaveState("saved");
    } catch (caughtError) {
      remoteSyncBlockedRef.current = true;
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "수동 동기화에 실패했습니다.";

      setError(message);
      setSyncStatus({
        ...syncClient.getStatus(),
        mode: "error",
        label: "error",
        detail: message,
      });
    } finally {
      setIsManualSyncing(false);
    }
  }, [device, replaceSnapshot, snapshotRef, storage, syncClient, userId]);

  useEffect(() => {
    if (!isReady || isHydrating || localLoadFailed || !device) {
      return;
    }

    const handleOnline = () => {
      void manualSync();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [device, isHydrating, isReady, localLoadFailed, manualSync]);

  const saveSupabaseConfig = useCallback(
    async (config: SupabaseConfigInput) => {
      try {
        const nextRuntimeConfig = persistSupabaseConfig(config);
        const nextSyncClient = createAppSyncClient(nextRuntimeConfig);

        setRuntimeConfig(nextRuntimeConfig);
        setSyncStatus(nextSyncClient.getStatus());
        setIsReady(false);
        setSaveState("saving");
        setError(null);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Supabase 설정을 저장하지 못했습니다.";

        setError(message);
        throw caughtError;
      }
    },
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const authState = await syncClient.signIn(email, password);
      if (!authState.userId) {
        throw new Error("인증된 사용자 ID를 확인하지 못했습니다.");
      }
      if (
        activeRuntimeConfig.boundUserId &&
        activeRuntimeConfig.boundUserId !== authState.userId
      ) {
        await syncClient.signOut();
        throw new Error(
          "이 로컬 데이터는 다른 계정에 연결되어 있습니다. 계정 전환에는 별도 데이터 이전이 필요합니다.",
        );
      }
      const nextRuntimeConfig = bindSupabaseUser(
        authState.userId,
        activeRuntimeConfig,
      );
      setRuntimeConfig(nextRuntimeConfig);
      setAuthenticatedUserId(authState.userId);
      setAuthEmail(authState.email);
      setIsReady(false);
      setSaveState("saving");
      setError(null);
    },
    [activeRuntimeConfig, syncClient],
  );

  const signOut = useCallback(async () => {
    await syncClient.signOut();
    setAuthenticatedUserId(null);
    setAuthEmail(null);
    setIsReady(false);
    setSyncStatus(syncClient.getStatus());
  }, [syncClient]);

  const loadFinanceDailySummaries = useCallback(
    (fromDate: string, toDate: string) =>
      syncClient.getFinanceDailySummaries(userId, fromDate, toDate),
    [syncClient, userId],
  );

  const setAutostartEnabled = useCallback(async (enabled: boolean) => {
    const result = await setDesktopAutostartEnabled(enabled);
    setAutostartSupported(result.supported);
    setAutostartState(result.enabled);

    if (result.error) {
      setError(result.error);
    }
  }, []);

  return {
    activeDevices,
    authEmail,
    autostartEnabled,
    autostartSupported,
    commitSnapshot,
    device,
    error,
    isAuthenticated: Boolean(authenticatedUserId),
    isManualSyncing,
    isReady,
    isSupabaseConfigured: syncClient.isConfigured(),
    loadFinanceDailySummaries,
    manualSync,
    saveState,
    saveSupabaseConfig,
    selectedNoteId,
    setAutostartEnabled,
    setSelectedNoteId,
    signIn,
    signOut,
    snapshot,
    supabaseConfig: activeRuntimeConfig,
    syncStatus,
    userId,
  };
}
