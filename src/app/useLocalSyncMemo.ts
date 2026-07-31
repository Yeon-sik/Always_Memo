import { useMemo } from "react";

import { useFitnessRecordActions } from "../features/fitness/useFitnessRecordActions";
import { getVisibleMealRecords, getVisibleWeightRecords, getVisibleWorkoutRecords } from "../features/fitness/fitnessService";
import { getVisibleNotes } from "../features/notes/noteService";
import { useNoteActions } from "../features/notes/useNoteActions";
import { getVisibleTasks } from "../features/tasks/taskService";
import { useTaskActions } from "../features/tasks/useTaskActions";
import { localStorageAdapter } from "../lib/storage/localStorageAdapter";
import type { StorageAdapter } from "../lib/storage/storageAdapter";
import type { SyncClient } from "../lib/sync/syncTypes";
import { useMemoSyncRuntime } from "./sync/useMemoSyncRuntime";

// Public facade used by App. Runtime orchestration and domain mutations live in
// focused hooks, while this function keeps the existing return contract intact.
export function useLocalSyncMemo(
  storage: StorageAdapter = localStorageAdapter,
  injectedSyncClient?: SyncClient,
  injectedUserId?: string,
) {
  const runtime = useMemoSyncRuntime(
    storage,
    injectedSyncClient,
    injectedUserId,
  );
  const visibleNotes = useMemo(
    () => getVisibleNotes(runtime.snapshot.notes),
    [runtime.snapshot.notes],
  );
  const visibleTasks = useMemo(
    () => getVisibleTasks(runtime.snapshot.tasks),
    [runtime.snapshot.tasks],
  );
  const visibleWorkoutRecords = useMemo(
    () => getVisibleWorkoutRecords(runtime.snapshot.workoutRecords),
    [runtime.snapshot.workoutRecords],
  );
  const visibleMealRecords = useMemo(
    () => getVisibleMealRecords(runtime.snapshot.mealRecords),
    [runtime.snapshot.mealRecords],
  );
  const visibleWeightRecords = useMemo(
    () => getVisibleWeightRecords(runtime.snapshot.weightRecords),
    [runtime.snapshot.weightRecords],
  );
  const selectedNote = useMemo(
    () =>
      visibleNotes.find((note) => note.id === runtime.selectedNoteId) ?? null,
    [runtime.selectedNoteId, visibleNotes],
  );
  const noteActions = useNoteActions({
    commitSnapshot: runtime.commitSnapshot,
    device: runtime.device,
    selectedNoteId: runtime.selectedNoteId,
    setSelectedNoteId: runtime.setSelectedNoteId,
    visibleNotes,
  });
  const taskActions = useTaskActions({
    commitSnapshot: runtime.commitSnapshot,
    device: runtime.device,
  });
  const fitnessActions = useFitnessRecordActions({
    commitSnapshot: runtime.commitSnapshot,
    device: runtime.device,
  });

  return {
    activeDevices: runtime.activeDevices,
    authEmail: runtime.authEmail,
    ...fitnessActions,
    ...noteActions,
    ...taskActions,
    autostartEnabled: runtime.autostartEnabled,
    autostartSupported: runtime.autostartSupported,
    device: runtime.device,
    error: runtime.error,
    isAuthenticated: runtime.isAuthenticated,
    isManualSyncing: runtime.isManualSyncing,
    isReady: runtime.isReady,
    isSupabaseConfigured: runtime.isSupabaseConfigured,
    loadFinanceDailySummaries: runtime.loadFinanceDailySummaries,
    manualSync: runtime.manualSync,
    mealRecords: visibleMealRecords,
    notes: visibleNotes,
    saveState: runtime.saveState,
    saveSupabaseConfig: runtime.saveSupabaseConfig,
    selectedNote,
    selectedNoteId: runtime.selectedNoteId,
    setAutostartEnabled: runtime.setAutostartEnabled,
    signIn: runtime.signIn,
    signOut: runtime.signOut,
    supabaseConfig: runtime.supabaseConfig,
    syncStatus: runtime.syncStatus,
    tasks: visibleTasks,
    userId: runtime.userId,
    weightRecords: visibleWeightRecords,
    workoutRecords: visibleWorkoutRecords,
  };
}
