import { useMemo, useState } from "react";
import { Command } from "lucide-react";
import type { LocalDataSnapshot } from "../types";
import { HeaderBar, type HeaderView } from "../components/HeaderBar";
import { StatusBanner } from "../components/StatusBanner";
import { SettingsPanel } from "../components/SettingsPanel";
import { FitnessPanel } from "../features/fitness/FitnessPanel";
import { formatLocalDate } from "../features/fitness/fitnessDate";
import { MemoPanel } from "../features/notes/MemoPanel";
import { QuickCapturePanel } from "../features/quick-capture/QuickCapturePanel";
import { useQuickCapture } from "../features/quick-capture/useQuickCapture";
import { RecordsPanel } from "../features/records/RecordsPanel";
import { ChecklistPanel } from "../features/tasks/ChecklistPanel";
import { useLocalSyncMemo } from "./useLocalSyncMemo";
import { useThemeMode } from "./useThemeMode";

export function App() {
  const memo = useLocalSyncMemo();
  const { setThemeMode, themeMode } = useThemeMode();
  const [activeView, setActiveView] = useState<HeaderView>("records");
  const [selectedDate, setSelectedDate] = useState(formatLocalDate());
  const quickCapture = useQuickCapture({
    onAddMemo: memo.addNoteForDate,
    onAddTask: memo.addTask,
  });
  const snapshot: LocalDataSnapshot = useMemo(
    () => ({
      notes: memo.notes,
      tasks: memo.tasks,
      workoutRecords: memo.workoutRecords,
      mealRecords: memo.mealRecords,
      weightRecords: memo.weightRecords,
      devices: memo.activeDevices,
    }),
    [
      memo.activeDevices,
      memo.mealRecords,
      memo.notes,
      memo.tasks,
      memo.weightRecords,
      memo.workoutRecords,
    ],
  );

  return (
    <div className="app-shell flex w-full min-w-0 justify-center bg-slate-200 text-slate-900 dark:bg-black dark:text-neutral-100">
      <div className="flex h-full min-h-0 w-full max-w-[520px] min-w-0 flex-col border-x border-slate-300 bg-slate-100 shadow-panel dark:border-neutral-800 dark:bg-black dark:shadow-none">
        <HeaderBar
          activeView={activeView}
          device={memo.device}
          syncStatus={memo.syncStatus}
          saveState={memo.saveState}
          onChangeView={setActiveView}
        />

        {memo.error ? <StatusBanner message={memo.error} /> : null}

        <main className="min-h-0 flex-1 overflow-hidden p-3">
          {activeView === "settings" ? (
            <SettingsPanel
              activeDevices={memo.activeDevices}
              autostartEnabled={memo.autostartEnabled}
              autostartSupported={memo.autostartSupported}
              currentDeviceId={memo.device?.id ?? null}
              isManualSyncing={memo.isManualSyncing}
              isSupabaseConfigured={memo.isSupabaseConfigured}
              supabaseConfig={memo.supabaseConfig}
              syncStatus={memo.syncStatus}
              themeMode={themeMode}
              userId={memo.userId}
              onChangeThemeMode={setThemeMode}
              quickCaptureShortcutPreference={
                quickCapture.shortcutPreference
              }
              quickCaptureShortcutStatus={quickCapture.shortcutStatus}
              onManualSync={memo.manualSync}
              onRefreshQuickCaptureShortcutStatus={
                quickCapture.refreshShortcutStatus
              }
              onSaveSupabaseConfig={memo.saveSupabaseConfig}
              onSaveQuickCaptureShortcutPreference={
                quickCapture.setShortcutPreference
              }
              onToggleAutostart={memo.setAutostartEnabled}
            />
          ) : activeView === "records" ? (
            <RecordsPanel
              snapshot={snapshot}
              selectedDate={selectedDate}
              syncStatus={memo.syncStatus}
              onAddNoteForDate={memo.addNoteForDate}
              onAddTask={memo.addTask}
              onAddWeightRecord={memo.addWeightRecord}
              onAddWorkoutRecord={memo.addWorkoutRecord}
              onAddWorkoutRecords={memo.addWorkoutRecords}
              onAddMealRecord={memo.addMealRecord}
              onDeleteNote={memo.deleteNote}
              onDeleteTask={memo.deleteTask}
              onDeleteMealRecord={memo.deleteMealRecord}
              onDeleteWeightRecord={memo.deleteWeightRecord}
              onDeleteWorkoutRecord={memo.deleteWorkoutRecord}
              onRestoreMealRecord={memo.restoreMealRecord}
              onRestoreWeightRecord={memo.restoreWeightRecord}
              onRestoreWorkoutRecord={memo.restoreWorkoutRecord}
              onSelectDate={setSelectedDate}
              onToggleTask={memo.toggleTask}
            />
          ) : activeView === "fitness" ? (
            <FitnessPanel
              mealRecords={memo.mealRecords}
              selectedDate={selectedDate}
              weightRecords={memo.weightRecords}
              workoutRecords={memo.workoutRecords}
              onAddMealRecord={memo.addMealRecord}
              onAddWeightRecord={memo.addWeightRecord}
              onAddWorkoutRecord={memo.addWorkoutRecord}
              onAddWorkoutRecords={memo.addWorkoutRecords}
            />
          ) : (
            <div className="grid h-full min-h-0 grid-cols-2 gap-3">
              <MemoPanel
                notes={memo.notes}
                selectedNote={memo.selectedNote}
                selectedNoteId={memo.selectedNoteId}
                isLoading={!memo.isReady}
                onCreate={memo.addNote}
                onDelete={memo.deleteNote}
                onSelect={memo.selectNote}
                onChangeTitle={memo.updateSelectedNoteTitle}
                onChangeContent={memo.updateSelectedNoteContent}
              />

              <ChecklistPanel
                tasks={memo.tasks}
                onAdd={memo.addTask}
                onDelete={memo.deleteTask}
                onReorder={memo.reorderTasks}
                onToggle={memo.toggleTask}
                onUpdateSchedule={memo.updateTaskSchedule}
                onUpdateText={memo.updateTaskText}
              />
            </div>
          )}
        </main>

        <button
          type="button"
          onClick={quickCapture.open}
          className="fixed bottom-[calc(1rem+var(--app-safe-bottom))] right-[calc(1rem+var(--app-safe-right))] z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-950 text-white shadow-2xl shadow-black/30 transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          aria-label="Quick Capture 열기"
          title="Quick Capture"
        >
          <Command className="h-5 w-5" aria-hidden="true" />
        </button>

        <QuickCapturePanel
          isOpen={quickCapture.isOpen}
          mode={quickCapture.mode}
          shortcutStatus={quickCapture.shortcutStatus}
          onClose={quickCapture.close}
          onModeChange={quickCapture.setMode}
          onSave={quickCapture.saveDraft}
        />
      </div>
    </div>
  );
}
