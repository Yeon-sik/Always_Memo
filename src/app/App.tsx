import { useState } from "react";
import { HeaderBar, type HeaderView } from "../components/HeaderBar";
import { StatusBanner } from "../components/StatusBanner";
import { SettingsPanel } from "../components/SettingsPanel";
import { FitnessPanel } from "../features/fitness/FitnessPanel";
import { MemoPanel } from "../features/notes/MemoPanel";
import { ChecklistPanel } from "../features/tasks/ChecklistPanel";
import { useLocalSyncMemo } from "./useLocalSyncMemo";
import { useThemeMode } from "./useThemeMode";

export function App() {
  const memo = useLocalSyncMemo();
  const { setThemeMode, themeMode } = useThemeMode();
  const [activeView, setActiveView] = useState<HeaderView>("memo");

  return (
    <div className="flex h-screen min-h-[640px] min-w-[420px] justify-center bg-slate-200 text-slate-900 dark:bg-black dark:text-neutral-100">
      <div className="flex h-full w-full max-w-[960px] flex-col border-x border-slate-300 bg-slate-100 shadow-panel dark:border-neutral-800 dark:bg-black dark:shadow-none">
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
              onManualSync={memo.manualSync}
              onSaveSupabaseConfig={memo.saveSupabaseConfig}
              onToggleAutostart={memo.setAutostartEnabled}
            />
          ) : activeView === "fitness" ? (
            <FitnessPanel
              mealRecords={memo.mealRecords}
              weightRecords={memo.weightRecords}
              workoutRecords={memo.workoutRecords}
              onAddMealRecord={memo.addMealRecord}
              onAddWeightRecord={memo.addWeightRecord}
              onAddWorkoutRecord={memo.addWorkoutRecord}
              onDeleteMealRecord={memo.deleteMealRecord}
              onDeleteWeightRecord={memo.deleteWeightRecord}
              onDeleteWorkoutRecord={memo.deleteWorkoutRecord}
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
      </div>
    </div>
  );
}
