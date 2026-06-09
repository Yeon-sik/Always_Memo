import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Device,
  LocalDataSnapshot,
  MealRecord,
  Note,
  Task,
  WeightRecord,
  WorkoutRecord,
  WorkoutType,
} from "../types";
import { getOrCreateDevice, upsertDevice } from "../lib/device/device";
import type { StorageAdapter } from "../lib/storage/storageAdapter";
import { localStorageAdapter } from "../lib/storage/localStorageAdapter";
import {
  createAppSyncClient,
  getConfiguredUserId,
} from "../lib/sync/syncClientFactory";
import type { SyncClient, SyncContext, SyncStatus } from "../lib/sync/syncTypes";
import {
  emptyRuntimeConfig,
  loadRuntimeConfig,
  saveSupabaseConfig as persistSupabaseConfig,
  type SupabaseConfigInput,
  type RuntimeConfig,
} from "../lib/config/runtimeConfig";
import type { SaveState } from "../components/HeaderBar";
import {
  getAutostartEnabled,
  setAutostartEnabled as setDesktopAutostartEnabled,
} from "../lib/desktop/autostart";
import {
  createNote as createNoteEntity,
  getVisibleNotes,
  softDeleteNote,
  updateNote,
} from "../features/notes/noteService";
import {
  createTask as createTaskEntity,
  getNextOrderIndex,
  getVisibleTasks,
  softDeleteTask,
  updateTask,
} from "../features/tasks/taskService";
import {
  createMealRecord,
  createWeightRecord,
  createWorkoutRecord,
  getVisibleMealRecords,
  getVisibleWeightRecords,
  getVisibleWorkoutRecords,
  restoreMealRecord as restoreMealRecordEntity,
  restoreWeightRecord as restoreWeightRecordEntity,
  restoreWorkoutRecord as restoreWorkoutRecordEntity,
  softDeleteMealRecord,
  softDeleteWeightRecord,
  softDeleteWorkoutRecord,
  updateMealRecord as updateMealRecordEntity,
  updateWeightRecord as updateWeightRecordEntity,
  updateWorkoutRecord as updateWorkoutRecordEntity,
} from "../features/fitness/fitnessService";
import type {
  MealRecordPatch,
  WeightRecordPatch,
  WorkoutRecordPatch,
} from "../features/fitness/fitnessService";

interface UseLocalSyncMemoState {
  activeDevices: Device[];
  autostartEnabled: boolean;
  autostartSupported: boolean;
  device: Device | null;
  error: string | null;
  isManualSyncing: boolean;
  isReady: boolean;
  isSupabaseConfigured: boolean;
  mealRecords: MealRecord[];
  notes: Note[];
  saveState: SaveState;
  selectedNote: Note | null;
  selectedNoteId: string | null;
  syncStatus: SyncStatus;
  supabaseConfig: RuntimeConfig;
  tasks: Task[];
  userId: string;
  weightRecords: WeightRecord[];
  workoutRecords: WorkoutRecord[];
}

interface UseLocalSyncMemoActions {
  addMealRecord: (
    date: string,
    menu: string,
    calories: number,
    proteinGrams: number,
    carbsGrams?: number | null,
    fatGrams?: number | null,
  ) => void;
  addNote: () => void;
  addNoteForDate: (date: string, title: string, content: string) => void;
  addTask: (
    text: string,
    dueDate?: string | null,
    dueTime?: string | null,
  ) => void;
  addWeightRecord: (date: string, weightKg: number) => void;
  addWorkoutRecord: (
    date: string,
    workoutType: WorkoutType,
    category: string,
    exerciseName: string,
  ) => void;
  addWorkoutRecords: (
    records: Array<{
      date: string;
      workoutType: WorkoutType;
      category: string;
      exerciseName: string;
    }>,
  ) => void;
  deleteMealRecord: (recordId: string) => void;
  deleteNote: (noteId: string) => void;
  deleteTask: (taskId: string) => void;
  deleteWeightRecord: (recordId: string) => void;
  deleteWorkoutRecord: (recordId: string) => void;
  manualSync: () => Promise<void>;
  reorderTasks: (
    draggedTaskId: string,
    targetTaskId: string,
    placement: "before" | "after",
  ) => void;
  selectNote: (noteId: string) => void;
  restoreMealRecord: (record: MealRecord) => void;
  restoreWeightRecord: (record: WeightRecord) => void;
  restoreWorkoutRecord: (record: WorkoutRecord) => void;
  saveSupabaseConfig: (config: SupabaseConfigInput) => Promise<void>;
  setAutostartEnabled: (enabled: boolean) => Promise<void>;
  toggleTask: (taskId: string) => void;
  updateSelectedNoteContent: (content: string) => void;
  updateSelectedNoteTitle: (title: string) => void;
  updateNoteForDate: (
    noteId: string,
    date: string,
    title: string,
    content: string,
  ) => void;
  updateMealRecord: (recordId: string, patch: MealRecordPatch) => void;
  updateWeightRecord: (recordId: string, patch: WeightRecordPatch) => void;
  updateWorkoutRecord: (recordId: string, patch: WorkoutRecordPatch) => void;
  updateTaskSchedule: (
    taskId: string,
    dueDate: string | null,
    dueTime: string | null,
  ) => void;
  updateTaskText: (taskId: string, text: string) => void;
}

// 최초 렌더링에서 동기화 상태를 표시하기 위한 기본값이다.
const initialSyncStatus: SyncStatus = {
  mode: "local-only",
  label: "local-only",
  detail: "동기화 상태를 확인하는 중입니다.",
  isOnline: false,
  lastSyncedAt: null,
  isConfigured: false,
};

function toSnapshot(
  notes: Note[],
  tasks: Task[],
  workoutRecords: WorkoutRecord[],
  mealRecords: MealRecord[],
  weightRecords: WeightRecord[],
  devices: Device[],
): LocalDataSnapshot {
  return {
    notes,
    tasks,
    workoutRecords,
    mealRecords,
    weightRecords,
    devices,
  };
}

// 앱의 핵심 상태 훅: 로컬 우선 로딩, 자동 저장, Supabase 동기화,
// Realtime 구독, 활성 기기, 자동 실행 설정을 한곳에서 조율한다.
export function useLocalSyncMemo(
  storage: StorageAdapter = localStorageAdapter,
  injectedSyncClient?: SyncClient,
  injectedUserId?: string,
): UseLocalSyncMemoState & UseLocalSyncMemoActions {
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(
    null,
  );
  const [device, setDevice] = useState<Device | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeDevices, setActiveDevices] = useState<Device[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workoutRecords, setWorkoutRecords] = useState<WorkoutRecord[]>([]);
  const [mealRecords, setMealRecords] = useState<MealRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [syncStatus, setSyncStatus] =
    useState<SyncStatus>(initialSyncStatus);
  const [autostartEnabled, setAutostartState] = useState(false);
  const [autostartSupported, setAutostartSupported] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const snapshotRef = useRef<LocalDataSnapshot>(
    toSnapshot([], [], [], [], [], []),
  );
  const activeRuntimeConfig = runtimeConfig ?? emptyRuntimeConfig;
  const isRuntimeConfigReady =
    runtimeConfig !== null || Boolean(injectedSyncClient) || Boolean(injectedUserId);
  const syncClient = useMemo(
    () => injectedSyncClient ?? createAppSyncClient(activeRuntimeConfig),
    [activeRuntimeConfig, injectedSyncClient],
  );
  const userId = useMemo(
    () => injectedUserId ?? getConfiguredUserId(activeRuntimeConfig),
    [activeRuntimeConfig, injectedUserId],
  );

  const visibleNotes = useMemo(() => getVisibleNotes(notes), [notes]);
  const visibleTasks = useMemo(() => getVisibleTasks(tasks), [tasks]);
  const visibleWorkoutRecords = useMemo(
    () => getVisibleWorkoutRecords(workoutRecords),
    [workoutRecords],
  );
  const visibleMealRecords = useMemo(
    () => getVisibleMealRecords(mealRecords),
    [mealRecords],
  );
  const visibleWeightRecords = useMemo(
    () => getVisibleWeightRecords(weightRecords),
    [weightRecords],
  );
  const isSupabaseConfigured = syncClient.isConfigured();

  const selectedNote = useMemo(
    () => visibleNotes.find((note) => note.id === selectedNoteId) ?? null,
    [selectedNoteId, visibleNotes],
  );

  // Realtime 콜백은 오래 살아 있으므로 최신 스냅샷을 ref로 공유한다.
  useEffect(() => {
    snapshotRef.current = toSnapshot(
      notes,
      tasks,
      workoutRecords,
      mealRecords,
      weightRecords,
      devices,
    );
  }, [devices, mealRecords, notes, tasks, weightRecords, workoutRecords]);

  // 빌드 번들에 Supabase 값을 넣지 않기 위해 Tauri 실행 시점의 .env 파일을 먼저 읽는다.
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

  // 시작 시 로컬 데이터를 즉시 읽고, 가능하면 Supabase pull 결과와 병합한다.
  useEffect(() => {
    if (!isRuntimeConfigReady) {
      return;
    }

    let isMounted = true;

    async function hydrate() {
      const currentDevice = getOrCreateDevice();

      try {
        const context: SyncContext = { device: currentDevice, userId };
        const snapshot = await storage.load();
        const localSnapshot = {
          ...snapshot,
          devices: upsertDevice(snapshot.devices, currentDevice),
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

        snapshotRef.current = nextSnapshot;
        setDevice(currentDevice);
        setDevices(nextSnapshot.devices);
        setActiveDevices([currentDevice]);
        setNotes(nextSnapshot.notes);
        setTasks(nextSnapshot.tasks);
        setWorkoutRecords(nextSnapshot.workoutRecords);
        setMealRecords(nextSnapshot.mealRecords);
        setWeightRecords(nextSnapshot.weightRecords);
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
        setDevices([currentDevice]);
        setActiveDevices([currentDevice]);
        setIsReady(true);
        setSaveState("error");
      }
    }

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [isRuntimeConfigReady, storage, syncClient, userId]);

  // Tauri 데스크톱 런타임에서만 부팅 시 자동 실행 상태를 확인한다.
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

  // 온라인 상태에서는 다른 기기 변경사항을 구독하고 heartbeat를 시작한다.
  useEffect(() => {
    if (!isReady || !device) {
      return;
    }

    const context: SyncContext = { device, userId };
    const realtimeSubscription = syncClient.subscribeRealtime({
      context,
      getSnapshot: () => snapshotRef.current,
      onSnapshot: (snapshot, status) => {
        snapshotRef.current = snapshot;
        setNotes(snapshot.notes);
        setTasks(snapshot.tasks);
        setWorkoutRecords(snapshot.workoutRecords);
        setMealRecords(snapshot.mealRecords);
        setWeightRecords(snapshot.weightRecords);
        setDevices(snapshot.devices);
        setSyncStatus(status);
        setError(null);
        void storage.save(snapshot).catch((caughtError: unknown) => {
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
  }, [device, isReady, storage, syncClient, userId]);

  // 로컬 변경은 짧게 debounce한 뒤 localStorage에 저장하고 Supabase로 push한다.
  useEffect(() => {
    if (!isReady || !device) {
      return;
    }

    setSaveState("saving");

    const currentDevice = {
      ...device,
      lastSeenAt: new Date().toISOString(),
    };
    const snapshot: LocalDataSnapshot = {
      notes,
      tasks,
      workoutRecords,
      mealRecords,
      weightRecords,
      devices: upsertDevice(devices, currentDevice),
    };
    const context: SyncContext = { device: currentDevice, userId };

    const saveTimer = window.setTimeout(() => {
      storage
        .save(snapshot)
        .then(() => syncClient.push(snapshot, context))
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
  }, [
    device,
    devices,
    isReady,
    mealRecords,
    notes,
    storage,
    syncClient,
    tasks,
    userId,
    weightRecords,
    workoutRecords,
  ]);

  // 브라우저/웹뷰 네트워크 이벤트를 반영해 헤더의 동기화 상태를 갱신한다.
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

  // 활성 기기 목록은 heartbeat 기준 시간 안에 보인 기기만 주기적으로 갱신한다.
  useEffect(() => {
    if (!isReady || !device) {
      return;
    }

    let isMounted = true;
    const currentDevice = device;
    const context: SyncContext = { device: currentDevice, userId };

    async function refreshActiveDevices() {
      const fallbackDevices = upsertDevice(devices, {
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
  }, [device, devices, isReady, syncClient, userId]);

  // 선택한 메모가 삭제되거나 목록이 비었을 때 편집기 선택 상태를 보정한다.
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

  // 사용자가 누르는 수동 동기화: 원격 pull 후 다시 push해 양쪽을 맞춘다.
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

      snapshotRef.current = pulledSnapshot;
      setNotes(pulledSnapshot.notes);
      setTasks(pulledSnapshot.tasks);
      setWorkoutRecords(pulledSnapshot.workoutRecords);
      setMealRecords(pulledSnapshot.mealRecords);
      setWeightRecords(pulledSnapshot.weightRecords);
      setDevices(pulledSnapshot.devices);
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
  }, [device, storage, syncClient, userId]);

  // 저장된 Supabase 설정은 빌드/env fallback보다 우선 적용한다.
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

  // 설정 패널의 자동 실행 토글을 Tauri autostart 플러그인에 위임한다.
  const setAutostartEnabled = useCallback(async (enabled: boolean) => {
    const result = await setDesktopAutostartEnabled(enabled);
    setAutostartSupported(result.supported);
    setAutostartState(result.enabled);

    if (result.error) {
      setError(result.error);
    }
  }, []);

  // 새 메모를 만들면 바로 선택해서 사용자가 즉시 편집할 수 있게 한다.
  const addNote = useCallback(() => {
    if (!device) {
      return;
    }

    const note = createNoteEntity(device.id);
    setNotes((currentNotes) => [note, ...currentNotes]);
    setSelectedNoteId(note.id);
  }, [device]);

  const addNoteForDate = useCallback(
    (date: string, title: string, content: string) => {
      if (!device) {
        return;
      }

      const note = createNoteEntity(
        device.id,
        {
          content,
          title: title.trim() || "빠른 메모",
        },
        date,
      );

      setNotes((currentNotes) => [note, ...currentNotes]);
      setSelectedNoteId(note.id);
    },
    [device],
  );

  const selectNote = useCallback((noteId: string) => {
    setSelectedNoteId(noteId);
  }, []);

  // 삭제는 tombstone을 남기는 soft delete로 처리해 다음 동기화에서 전파한다.
  const deleteNote = useCallback(
    (noteId: string) => {
      if (!device) {
        return;
      }

      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.id === noteId ? softDeleteNote(note, device.id) : note,
        ),
      );

      if (selectedNoteId === noteId) {
        const nextNote = visibleNotes.find((note) => note.id !== noteId);
        setSelectedNoteId(nextNote?.id ?? null);
      }
    },
    [device, selectedNoteId, visibleNotes],
  );

  // 선택된 메모 제목 변경을 도메인 서비스에 맡겨 timestamp/deviceId를 일관되게 갱신한다.
  const updateSelectedNoteTitle = useCallback(
    (title: string) => {
      if (!device || !selectedNoteId) {
        return;
      }

      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.id === selectedNoteId
            ? updateNote(note, { title }, device.id)
            : note,
        ),
      );
    },
    [device, selectedNoteId],
  );

  // 본문 변경도 같은 updateNote 규칙을 타므로 자동 저장/동기화 대상이 된다.
  const updateSelectedNoteContent = useCallback(
    (content: string) => {
      if (!device || !selectedNoteId) {
        return;
      }

      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.id === selectedNoteId
            ? updateNote(note, { content }, device.id)
            : note,
        ),
      );
    },
    [device, selectedNoteId],
  );

  const updateNoteForDate = useCallback(
    (noteId: string, date: string, title: string, content: string) => {
      if (!device) {
        return;
      }

      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.id === noteId
            ? updateNote(note, { content, title }, device.id, date)
            : note,
        ),
      );
    },
    [device],
  );

  // 체크리스트 항목은 현재 보이는 항목의 가장 큰 orderIndex 뒤에 추가한다.
  const addTask = useCallback(
    (
      text: string,
      dueDate: string | null = null,
      dueTime: string | null = null,
    ) => {
      if (!device) {
        return;
      }

      const task = createTaskEntity(
        text,
        getNextOrderIndex(tasks),
        device.id,
        dueDate,
        dueTime,
      );

      setTasks((currentTasks) => [...currentTasks, task]);
    },
    [device, tasks],
  );

  // 완료 체크도 일반 수정처럼 updatedAt/deviceId를 갱신해 동기화 대상이 되게 한다.
  const toggleTask = useCallback(
    (taskId: string) => {
      if (!device) {
        return;
      }

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === taskId
            ? updateTask(task, { isDone: !task.isDone }, device.id)
            : task,
        ),
      );
    },
    [device],
  );

  // 체크리스트 텍스트 수정도 updatedAt을 바꿔 다른 기기에 최신 변경으로 전파한다.
  const updateTaskText = useCallback(
    (taskId: string, text: string) => {
      if (!device) {
        return;
      }

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === taskId ? updateTask(task, { text }, device.id) : task,
        ),
      );
    },
    [device],
  );

  // 날짜를 지우면 시간도 함께 비우는 UI 규칙을 그대로 저장한다.
  const updateTaskSchedule = useCallback(
    (taskId: string, dueDate: string | null, dueTime: string | null) => {
      if (!device) {
        return;
      }

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === taskId
            ? updateTask(task, { dueDate, dueTime }, device.id)
            : task,
        ),
      );
    },
    [device],
  );

  // 할 일 삭제 역시 soft delete로 남겨 오프라인 기기가 나중에 삭제 상태를 받을 수 있게 한다.
  const deleteTask = useCallback(
    (taskId: string) => {
      if (!device) {
        return;
      }

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === taskId ? softDeleteTask(task, device.id) : task,
        ),
      );
    },
    [device],
  );

  const addWorkoutRecord = useCallback(
    (
      date: string,
      workoutType: WorkoutType,
      category: string,
      exerciseName: string,
    ) => {
      if (!device) {
        return;
      }

      const record = createWorkoutRecord(
        date,
        workoutType,
        category,
        exerciseName,
        device.id,
      );
      setWorkoutRecords((currentRecords) => [...currentRecords, record]);
    },
    [device],
  );

  const addWorkoutRecords = useCallback(
    (
      records: Array<{
        date: string;
        workoutType: WorkoutType;
        category: string;
        exerciseName: string;
      }>,
    ) => {
      if (!device || records.length === 0) {
        return;
      }

      const nextRecords = records.map((record) =>
        createWorkoutRecord(
          record.date,
          record.workoutType,
          record.category,
          record.exerciseName,
          device.id,
        ),
      );

      setWorkoutRecords((currentRecords) => [
        ...currentRecords,
        ...nextRecords,
      ]);
    },
    [device],
  );

  const addMealRecord = useCallback(
    (
      date: string,
      menu: string,
      calories: number,
      proteinGrams: number,
      carbsGrams: number | null = null,
      fatGrams: number | null = null,
    ) => {
      if (!device) {
        return;
      }

      const record = createMealRecord(
        date,
        menu,
        calories,
        proteinGrams,
        device.id,
        carbsGrams,
        fatGrams,
      );
      setMealRecords((currentRecords) => [...currentRecords, record]);
    },
    [device],
  );

  const addWeightRecord = useCallback(
    (date: string, weightKg: number) => {
      if (!device) {
        return;
      }

      const record = createWeightRecord(date, weightKg, device.id);
      setWeightRecords((currentRecords) => [...currentRecords, record]);
    },
    [device],
  );

  const updateWorkoutRecord = useCallback(
    (recordId: string, patch: WorkoutRecordPatch) => {
      if (!device) {
        return;
      }

      setWorkoutRecords((currentRecords) =>
        currentRecords.map((record) =>
          record.id === recordId
            ? updateWorkoutRecordEntity(record, patch, device.id)
            : record,
        ),
      );
    },
    [device],
  );

  const updateMealRecord = useCallback(
    (recordId: string, patch: MealRecordPatch) => {
      if (!device) {
        return;
      }

      setMealRecords((currentRecords) =>
        currentRecords.map((record) =>
          record.id === recordId
            ? updateMealRecordEntity(record, patch, device.id)
            : record,
        ),
      );
    },
    [device],
  );

  const updateWeightRecord = useCallback(
    (recordId: string, patch: WeightRecordPatch) => {
      if (!device) {
        return;
      }

      setWeightRecords((currentRecords) =>
        currentRecords.map((record) =>
          record.id === recordId
            ? updateWeightRecordEntity(record, patch, device.id)
            : record,
        ),
      );
    },
    [device],
  );

  const deleteWorkoutRecord = useCallback(
    (recordId: string) => {
      if (!device) {
        return;
      }

      setWorkoutRecords((currentRecords) =>
        currentRecords.map((record) =>
          record.id === recordId
            ? softDeleteWorkoutRecord(record, device.id)
            : record,
        ),
      );
    },
    [device],
  );

  const deleteMealRecord = useCallback(
    (recordId: string) => {
      if (!device) {
        return;
      }

      setMealRecords((currentRecords) =>
        currentRecords.map((record) =>
          record.id === recordId
            ? softDeleteMealRecord(record, device.id)
            : record,
        ),
      );
    },
    [device],
  );

  const deleteWeightRecord = useCallback(
    (recordId: string) => {
      if (!device) {
        return;
      }

      setWeightRecords((currentRecords) =>
        currentRecords.map((record) =>
          record.id === recordId
            ? softDeleteWeightRecord(record, device.id)
            : record,
        ),
      );
    },
    [device],
  );

  const restoreWorkoutRecord = useCallback(
    (record: WorkoutRecord) => {
      if (!device) {
        return;
      }

      setWorkoutRecords((currentRecords) =>
        currentRecords.map((currentRecord) =>
          currentRecord.id === record.id
            ? restoreWorkoutRecordEntity(currentRecord, device.id)
            : currentRecord,
        ),
      );
    },
    [device],
  );

  const restoreMealRecord = useCallback(
    (record: MealRecord) => {
      if (!device) {
        return;
      }

      setMealRecords((currentRecords) =>
        currentRecords.map((currentRecord) =>
          currentRecord.id === record.id
            ? restoreMealRecordEntity(currentRecord, device.id)
            : currentRecord,
        ),
      );
    },
    [device],
  );

  const restoreWeightRecord = useCallback(
    (record: WeightRecord) => {
      if (!device) {
        return;
      }

      setWeightRecords((currentRecords) =>
        currentRecords.map((currentRecord) =>
          currentRecord.id === record.id
            ? restoreWeightRecordEntity(currentRecord, device.id)
            : currentRecord,
        ),
      );
    },
    [device],
  );

  const reorderTasks = useCallback(
    (
      draggedTaskId: string,
      targetTaskId: string,
      placement: "before" | "after",
    ) => {
      if (!device || draggedTaskId === targetTaskId) {
        return;
      }

      setTasks((currentTasks) => {
        const currentVisibleTasks = getVisibleTasks(currentTasks);
        const targetExists = currentVisibleTasks.some(
          (task) => task.id === targetTaskId,
        );
        const draggedTask = currentVisibleTasks.find(
          (task) => task.id === draggedTaskId,
        );

        if (!draggedTask || !targetExists) {
          return currentTasks;
        }

        const reorderedTasks = currentVisibleTasks.filter(
          (task) => task.id !== draggedTaskId,
        );
        const targetIndex = reorderedTasks.findIndex(
          (task) => task.id === targetTaskId,
        );

        if (targetIndex < 0) {
          return currentTasks;
        }

        reorderedTasks.splice(
          placement === "after" ? targetIndex + 1 : targetIndex,
          0,
          draggedTask,
        );

        const nextOrderById = new Map(
          reorderedTasks.map((task, index) => [task.id, index]),
        );

        return currentTasks.map((task) => {
          const nextOrderIndex = nextOrderById.get(task.id);

          if (
            nextOrderIndex === undefined ||
            task.orderIndex === nextOrderIndex
          ) {
            return task;
          }

          return updateTask(task, { orderIndex: nextOrderIndex }, device.id);
        });
      });
    },
    [device],
  );

  return {
    activeDevices,
    addMealRecord,
    addNote,
    addNoteForDate,
    addTask,
    addWeightRecord,
    addWorkoutRecord,
    addWorkoutRecords,
    autostartEnabled,
    autostartSupported,
    deleteMealRecord,
    deleteNote,
    deleteTask,
    deleteWeightRecord,
    deleteWorkoutRecord,
    device,
    error,
    isManualSyncing,
    isReady,
    isSupabaseConfigured,
    manualSync,
    mealRecords: visibleMealRecords,
    notes: visibleNotes,
    reorderTasks,
    restoreMealRecord,
    restoreWeightRecord,
    restoreWorkoutRecord,
    saveState,
    saveSupabaseConfig,
    selectNote,
    selectedNote,
    selectedNoteId,
    setAutostartEnabled,
    syncStatus,
    supabaseConfig: activeRuntimeConfig,
    tasks: visibleTasks,
    toggleTask,
    updateSelectedNoteContent,
    updateSelectedNoteTitle,
    updateMealRecord,
    updateNoteForDate,
    updateTaskSchedule,
    updateTaskText,
    updateWeightRecord,
    updateWorkoutRecord,
    userId,
    weightRecords: visibleWeightRecords,
    workoutRecords: visibleWorkoutRecords,
  };
}
