import { useCallback, useEffect, useMemo, useState } from "react";

import type { SaveState } from "../../components/HeaderBar";
import { getVisibleNotes } from "../../features/notes/noteService";
import {
  bindSupabaseUser,
  emptyRuntimeConfig,
  isManagedSupabaseConfig,
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

      try {
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
        const storedSnapshot = await storage.load();
        const localSnapshot = {
          ...storedSnapshot,
          devices: upsertDevice(storedSnapshot.devices, currentDevice),
        };
        const syncedSnapshot = await syncClient.pull(localSnapshot, context);
        const nextSnapshot = {
          ...syncedSnapshot,
          devices: upsertDevice(syncedSnapshot.devices, currentDevice),
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
        setSaveState("saved");

        if (syncClient.getStatus().mode === "error") {
          setError(syncClient.getStatus().detail);
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
        setDevice(currentDevice);
        commitSnapshot((current) => ({
          ...current,
          devices: upsertDevice(current.devices, currentDevice),
        }));
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
    if (!isReady || !device) {
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
    isReady,
    replaceSnapshot,
    snapshotRef,
    storage,
    syncClient,
    userId,
  ]);

  useEffect(() => {
    if (!isReady || !device) {
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
        .then(() => syncClient.push(snapshotToSave, context))
        .then((result) => {
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
  }, [device, isReady, snapshot, storage, syncClient, userId]);

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
    if (!isReady || !device) {
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
  }, [device, isReady, snapshot.devices, syncClient, userId]);

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
      const pushResult = await syncClient.push(pulledSnapshot, context);

      await storage.save(pulledSnapshot);

      replaceSnapshot(pulledSnapshot);
      setSyncStatus(pushResult.status);
      setError(
        pushResult.status.mode === "error" ? pushResult.status.detail : null,
      );
      setSaveState(pushResult.status.mode === "error" ? "error" : "saved");
    } catch (caughtError) {
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

  const saveSupabaseConfig = useCallback(
    async (config: SupabaseConfigInput) => {
      try {
        if (isManagedSupabaseConfig(activeRuntimeConfig)) {
          throw new Error(
            "공통 Supabase 연결은 앱 환경설정에서 관리됩니다.",
          );
        }
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
    [activeRuntimeConfig],
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
