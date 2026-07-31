import { useEffect, useMemo, useState } from "react";
import type {
  BackfillInput,
  LocalDataSnapshot,
  MealRecord,
  WeightRecord,
  WorkoutRecord,
  WorkoutType,
} from "../../types";
import type {
  FinanceDailySummary,
  SyncStatus,
} from "../../lib/sync/syncTypes";
import { QuickActionOverlay } from "../command-center/quickActions/QuickActionOverlay";
import { useQuickActionState } from "../command-center/quickActions/useQuickActionState";
import { formatLocalDate } from "../fitness/fitnessDate";
import type { WorkoutRecordMetricsInput } from "../fitness/fitnessService";
import { useFinanceCalendar } from "../finance/useFinanceCalendar";
import { FinanceDailyCard } from "./components/FinanceDailyCard";
import { RecordsOverview } from "./components/RecordsOverview";
import { SelectedDateRecords } from "./components/SelectedDateRecords";
import { useFitnessDeleteUndo } from "./hooks/useFitnessDeleteUndo";
import { RecordCalendar } from "./RecordCalendar";
import { getPendingFitnessDeleteMessage } from "./recordDeleteUndo";
import { getCalendarMarkers, getRecordsForDate } from "./recordAggregation";

interface RecordsPanelProps {
  selectedDate: string;
  snapshot: LocalDataSnapshot;
  syncStatus: SyncStatus;
  financeEnabled: boolean;
  loadFinanceDailySummaries: (
    fromDate: string,
    toDate: string,
  ) => Promise<FinanceDailySummary[]>;
  onAddNoteForDate: (
    date: string,
    title: string,
    content: string,
    backfillInput?: BackfillInput,
  ) => void;
  onAddTask: (
    text: string,
    dueDate: string | null,
    dueTime: string | null,
    plannedDate?: string | null,
    backfillInput?: BackfillInput,
  ) => void;
  onAddWeightRecord: (
    date: string,
    weightKg: number,
    backfillInput?: BackfillInput,
  ) => void;
  onAddWorkoutRecord: (
    date: string,
    workoutType: WorkoutType,
    category: string,
    exerciseName: string,
    backfillInput?: BackfillInput,
    metrics?: WorkoutRecordMetricsInput,
  ) => void;
  onAddWorkoutRecords: (
    records: Array<{
      date: string;
      workoutType: WorkoutType;
      category: string;
      exerciseName: string;
      durationSeconds?: number | null;
      averageHeartRate?: number | null;
    }>,
    backfillInput?: BackfillInput,
  ) => void;
  onAddMealRecord: (
    date: string,
    menu: string,
    calories: number,
    proteinGrams: number,
    carbsGrams?: number | null,
    fatGrams?: number | null,
    backfillInput?: BackfillInput,
  ) => void;
  onDeleteNote: (noteId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onDeleteMealRecord: (recordId: string) => void;
  onDeleteWeightRecord: (recordId: string) => void;
  onDeleteWorkoutRecord: (recordId: string) => void;
  onRestoreMealRecord: (record: MealRecord) => void;
  onRestoreWeightRecord: (record: WeightRecord) => void;
  onRestoreWorkoutRecord: (record: WorkoutRecord) => void;
  onSelectDate: (date: string) => void;
  onToggleTask: (taskId: string) => void;
}

export function RecordsPanel({
  selectedDate,
  snapshot,
  syncStatus,
  financeEnabled,
  loadFinanceDailySummaries,
  onAddNoteForDate,
  onAddTask,
  onAddWeightRecord,
  onAddWorkoutRecord,
  onAddWorkoutRecords,
  onAddMealRecord,
  onDeleteNote,
  onDeleteTask,
  onDeleteMealRecord,
  onDeleteWeightRecord,
  onDeleteWorkoutRecord,
  onRestoreMealRecord,
  onRestoreWeightRecord,
  onRestoreWorkoutRecord,
  onSelectDate,
  onToggleTask,
}: RecordsPanelProps) {
  const today = formatLocalDate();
  const [visibleMonth, setVisibleMonth] = useState(selectedDate);
  const {
    error: financeError,
    financeByDate,
    isLoading: isFinanceLoading,
    refresh: refreshFinance,
  } = useFinanceCalendar({
    enabled: financeEnabled,
    visibleMonth,
    loadSummaries: loadFinanceDailySummaries,
  });
  const {
    closeQuickAction,
    isQuickActionOpen,
    openQuickAction,
    quickActionDate,
    quickActionMode,
  } = useQuickActionState();
  const selectedRecords = useMemo(
    () => getRecordsForDate(snapshot, selectedDate),
    [selectedDate, snapshot],
  );
  const markerByDate = useMemo(
    () => getCalendarMarkers(snapshot, visibleMonth),
    [snapshot, visibleMonth],
  );
  const selectedFinance = financeByDate[selectedDate];
  const {
    deleteMeal,
    deleteWeight,
    deleteWorkout,
    handleUndoFitnessDelete,
    pendingFitnessDelete,
  } = useFitnessDeleteUndo({
    onDeleteMealRecord,
    onDeleteWeightRecord,
    onDeleteWorkoutRecord,
    onRestoreMealRecord,
    onRestoreWeightRecord,
    onRestoreWorkoutRecord,
  });

  useEffect(() => {
    setVisibleMonth(selectedDate);
  }, [selectedDate]);

  function openBackfillAction(sourceElement: HTMLElement) {
    const shouldOpen = window.confirm(
      "지난 날짜에 기록을 추가합니다. 이 항목은 누락 보강으로 표시됩니다.",
    );

    if (shouldOpen) {
      openQuickAction(selectedDate, sourceElement, "backfill");
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <RecordsOverview
        selectedDate={selectedDate}
        snapshot={snapshot}
        syncStatus={syncStatus}
        today={today}
      />

      <RecordCalendar
        markerByDate={markerByDate}
        financeByDate={financeByDate}
        selectedDate={selectedDate}
        visibleMonth={visibleMonth}
        onSelectDate={onSelectDate}
        onVisibleMonthChange={setVisibleMonth}
      />

      <FinanceDailyCard
        financeEnabled={financeEnabled}
        financeError={financeError}
        isFinanceLoading={isFinanceLoading}
        onRefresh={refreshFinance}
        selectedDate={selectedDate}
        selectedFinance={selectedFinance}
      />

      <SelectedDateRecords
        onDeleteMeal={deleteMeal}
        onDeleteNote={onDeleteNote}
        onDeleteTask={onDeleteTask}
        onDeleteWeight={deleteWeight}
        onDeleteWorkout={deleteWorkout}
        onOpenBackfillAction={openBackfillAction}
        onOpenQuickAction={openQuickAction}
        onToggleTask={onToggleTask}
        records={selectedRecords}
        selectedDate={selectedDate}
        today={today}
      />

      {pendingFitnessDelete ? (
        <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-[480px] items-center justify-between gap-3 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white shadow-2xl">
          <span className="min-w-0 truncate">
            {getPendingFitnessDeleteMessage(pendingFitnessDelete)}
          </span>
          <button
            type="button"
            onClick={handleUndoFitnessDelete}
            className="inline-flex h-8 shrink-0 items-center rounded-md border border-white/20 px-2.5 text-xs font-semibold transition hover:bg-white/10"
          >
            되돌리기
          </button>
        </div>
      ) : null}

      {isQuickActionOpen && quickActionDate ? (
        <QuickActionOverlay
          isBackfill={quickActionMode === "backfill"}
          selectedDate={quickActionDate}
          onAddNote={onAddNoteForDate}
          onAddTask={onAddTask}
          onAddWeightRecord={onAddWeightRecord}
          onAddWorkoutRecord={onAddWorkoutRecord}
          onAddWorkoutRecords={onAddWorkoutRecords}
          onAddMealRecord={onAddMealRecord}
          onClose={closeQuickAction}
        />
      ) : null}
    </section>
  );
}
