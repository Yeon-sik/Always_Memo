import {
  Activity,
  CalendarDays,
  CheckSquare,
  Dumbbell,
  Flame,
  Salad,
  Scale,
  StickyNote,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BackfillInput,
  LocalDataSnapshot,
  MealRecord,
  WeightRecord,
  WorkoutRecord,
  WorkoutType,
} from "../../types";
import {
  BACKFILL_LABEL,
  hasBackfillMetadata,
  isFutureLocalDate,
  isPastLocalDate,
} from "../../lib/dataTrust/backfillMetadata";
import type { SyncStatus } from "../../lib/sync/syncTypes";
import { QuickActionOverlay } from "../command-center/quickActions/QuickActionOverlay";
import { useQuickActionState } from "../command-center/quickActions/useQuickActionState";
import { formatKoreanDate, formatLocalDate } from "../fitness/fitnessDate";
import {
  getWorkoutMetricLabels,
  getWorkoutSubcategoryLabel,
  getWorkoutTypeLabel,
  type WorkoutRecordMetricsInput,
} from "../fitness/fitnessService";
import { formatMetric } from "../fitness/stats/fitnessStats";
import { RecordCalendar } from "./RecordCalendar";
import { DailyItem, DailySection, DeleteItemButton } from "./components/DailyRecordSection";
import { MarkerLegend } from "./components/RecordMarkerLegend";
import { getPlainTextFromNoteContent } from "../notes/noteService";
import {
  BarSeries,
  BriefMetric,
  ChartCard,
  KpiCard,
  WeightLine,
  type ChartInteractionHandlers,
} from "./components/InteractiveRecordsMetrics";
import {
  formatNullableMetric,
  formatRecordTime,
  formatTaskDueLabel,
  getWeightDeltaLabel,
} from "./recordDisplayFormatters";
import {
  getPendingFitnessDeleteMessage,
  type PendingFitnessDelete,
} from "./recordDeleteUndo";
import {
  getCalendarMarkers,
  getDashboardStats,
  getMonthRange,
  getNutritionSeries,
  getProductivitySeries,
  getRecordsForDate,
  getWeightSeries,
} from "./recordAggregation";

interface RecordsPanelProps {
  selectedDate: string;
  snapshot: LocalDataSnapshot;
  syncStatus: SyncStatus;
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

function BackfillBadge({ record }: { record: { isBackfilled?: boolean } }) {
  if (!hasBackfillMetadata(record)) {
    return null;
  }

/*
  const productivityChartDetail = activeProductivityPoint ? (
    <div className="space-y-1">
      <p className="font-semibold text-slate-700 dark:text-neutral-100">
        {formatKoreanDate(activeProductivityPoint.date)} · 완료{" "}
        {activeProductivityPoint.completedTasks}/{activeProductivityPoint.totalTasks}
      </p>
      <p>
        {summarizeItems(
          (productivityDetailRecords?.tasks ?? []).map((task) =>
            task.isDone ? `완료 ${task.text}` : `진행 ${task.text}`,
          ),
          "이 날 등록된 할 일이 없습니다.",
        )}
      </p>
    </div>
  ) : (
    <p>막대에 마우스를 올리거나 클릭하면 해당 날짜의 할 일 기록을 보여줍니다.</p>
  );

  const nutritionChartDetail = activeNutritionPoint ? (
    <div className="space-y-1">
      <p className="font-semibold text-slate-700 dark:text-neutral-100">
        {formatKoreanDate(activeNutritionPoint.date)} · 평균{" "}
        {activeNutritionPoint.averageCalories === null
          ? "-"
          : `${formatMetric(activeNutritionPoint.averageCalories, 0)} kcal`} / 단백질{" "}
        {activeNutritionPoint.averageProteinGrams === null
          ? "-"
          : `${formatMetric(activeNutritionPoint.averageProteinGrams)} g`}
      </p>
      <p>
        {summarizeItems(
          (nutritionDetailRecords?.mealRecords ?? []).map(
            (record) =>
              `${record.menu} ${record.calories.toLocaleString("ko-KR")} kcal / ${formatMetric(record.proteinGrams)} g`,
          ),
          "이 날 등록된 식사 기록이 없습니다.",
        )}
      </p>
    </div>
  ) : (
    <p>막대에 마우스를 올리거나 클릭하면 해당 날짜의 식사 기록을 보여줍니다.</p>
  );

  const weightChartDetail = activeWeightPoint ? (
    <div className="space-y-1">
      <p className="font-semibold text-slate-700 dark:text-neutral-100">
        {formatKoreanDate(activeWeightPoint.date)} · 체중{" "}
        {formatMetric(activeWeightPoint.weightKg)} kg
      </p>
      <p>
        {summarizeItems(
          (weightDetailRecords?.weightRecords ?? []).map(
            (record) => `${formatMetric(record.weightKg)} kg`,
          ),
          "이 날 등록된 체중 기록이 없습니다.",
        )}
      </p>
    </div>
  ) : (
    <p>선 위에 마우스를 올리거나 클릭한 뒤 좌우로 움직이면 날짜별 체중 기록을 계속 볼 수 있습니다.</p>
  );

*/
  return (
    <span className="mt-1 inline-flex w-fit rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      {BACKFILL_LABEL}
    </span>
  );
}

function WorkoutMetricDetail({ record }: { record: WorkoutRecord }) {
  const metricLabels = getWorkoutMetricLabels(record);

  if (metricLabels.length === 0) {
    return null;
  }

  return (
    <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
      {metricLabels.join(" / ")}
    </div>
  );
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return -1;
  }

  return Math.min(Math.max(index, 0), length - 1);
}

function useChartInteraction(length: number): ChartInteractionHandlers {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (length === 0) {
      setActiveIndex(null);
      setIsLocked(false);
      setIsDragging(false);
      return;
    }

    setActiveIndex((current) => {
      if (current === null) {
        return current;
      }

      return clampIndex(current, length);
    });
  }, [length]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    function stopDragging() {
      setIsDragging(false);
    }

    window.addEventListener("pointerup", stopDragging);
    return () => window.removeEventListener("pointerup", stopDragging);
  }, [isDragging]);

  function showIndex(index: number) {
    if (length === 0) {
      return;
    }

    setActiveIndex(clampIndex(index, length));
  }

  return {
    activeIndex,
    onBlur: () => {
      if (!isLocked && !isDragging) {
        setActiveIndex(null);
      }
    },
    onHover: (index) => {
      showIndex(index);
    },
    onLeave: () => {
      if (!isLocked && !isDragging) {
        setActiveIndex(null);
      }
    },
    onPointerDown: (index) => {
      showIndex(index);
      setIsLocked(true);
      setIsDragging(true);
    },
    onPointerMove: (index) => {
      if (isLocked || isDragging) {
        showIndex(index);
      }
    },
    onToggleLock: (index) => {
      if (isLocked && activeIndex === index) {
        setActiveIndex(null);
        setIsLocked(false);
        setIsDragging(false);
        return;
      }

      showIndex(index);
      setIsLocked(true);
      setIsDragging(false);
    },
  };
}

/* function summarizeItems(items: string[], emptyText: string): string {
  if (items.length === 0) {
    return emptyText;
  }

  if (items.length <= 2) {
    return items.join(" · ");
  }

  return `${items.slice(0, 2).join(" · ")} 외 ${items.length - 2}건`;
}

// 기록 탭 컨테이너: 집계 데이터, 달력, 일별 목록, 빠른 추가 Overlay를 연결합니다.
*/
function summarizeItems(items: string[], emptyText: string): string {
  if (items.length === 0) {
    return emptyText;
  }

  if (items.length <= 2) {
    return items.join(" · ");
  }

  return `${items.slice(0, 2).join(" · ")} 외 ${items.length - 2}건`;
}

export function RecordsPanel({
  selectedDate,
  snapshot,
  syncStatus,
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
  const undoTimerRef = useRef<number | null>(null);
  const [pendingFitnessDelete, setPendingFitnessDelete] =
    useState<PendingFitnessDelete>(null);
  const {
    closeQuickAction,
    isQuickActionOpen,
    openQuickAction,
    quickActionDate,
    quickActionMode,
  } = useQuickActionState();
  const selectedRange = useMemo(() => getMonthRange(selectedDate), [selectedDate]);
  const selectedRecords = useMemo(
    () => getRecordsForDate(snapshot, selectedDate),
    [selectedDate, snapshot],
  );
  const todayRecords = useMemo(
    () => getRecordsForDate(snapshot, today),
    [snapshot, today],
  );
  const dashboardStats = useMemo(
    () => getDashboardStats(snapshot, selectedRange),
    [selectedRange, snapshot],
  );
  const markerByDate = useMemo(
    () => getCalendarMarkers(snapshot, visibleMonth),
    [snapshot, visibleMonth],
  );
  const productivitySeries = useMemo(
    () => getProductivitySeries(snapshot.tasks, selectedRange),
    [selectedRange, snapshot.tasks],
  );
  const nutritionSeries = useMemo(
    () => getNutritionSeries(snapshot.mealRecords, selectedRange),
    [selectedRange, snapshot.mealRecords],
  );
  const weightSeries = useMemo(
    () => getWeightSeries(snapshot.weightRecords, selectedRange),
    [selectedRange, snapshot.weightRecords],
  );
  const productivityInteraction = useChartInteraction(productivitySeries.length);
  const nutritionInteraction = useChartInteraction(nutritionSeries.length);
  const weightInteraction = useChartInteraction(weightSeries.length);
  const todayLeftTasks = todayRecords.tasks.filter((task) => !task.isDone).length;
  const todayDoneTasks = todayRecords.tasks.filter((task) => task.isDone).length;
  const hasTodayWorkout = todayRecords.workoutRecords.length > 0;
  const totalSelectedRecords =
    selectedRecords.notes.length +
    selectedRecords.tasks.length +
    selectedRecords.workoutRecords.length +
    selectedRecords.mealRecords.length +
    selectedRecords.weightRecords.length;
  const hasProductivityData = productivitySeries.some(
    (point) => point.totalTasks > 0,
  );
  const hasNutritionData = nutritionSeries.some(
    (point) => point.averageCalories !== null,
  );
  const selectedDateIsPast = isPastLocalDate(selectedDate, today);
  const selectedDateIsFuture = isFutureLocalDate(selectedDate, today);
  const productivityDetail =
    dashboardStats.backfilledTaskCount > 0
      ? `${dashboardStats.completedTasks}/${dashboardStats.totalTasks} 완료 · ${BACKFILL_LABEL} ${dashboardStats.backfilledTaskCount}건 제외`
      : `${dashboardStats.completedTasks}/${dashboardStats.totalTasks} 완료`;
  const mealStatsDetail =
    dashboardStats.backfilledMealCount > 0
      ? `선택 월 식사 기준 · ${BACKFILL_LABEL} ${dashboardStats.backfilledMealCount}건 포함`
      : "선택 월 식사 기준";
  const weightStatsDetail =
    dashboardStats.backfilledWeightCount > 0
      ? `${BACKFILL_LABEL} ${dashboardStats.backfilledWeightCount}건 포함`
      : null;
  const activeProductivityPoint =
    productivityInteraction.activeIndex === null
      ? null
      : productivitySeries[productivityInteraction.activeIndex] ?? null;
  const activeNutritionPoint =
    nutritionInteraction.activeIndex === null
      ? null
      : nutritionSeries[nutritionInteraction.activeIndex] ?? null;
  const activeWeightPoint =
    weightInteraction.activeIndex === null
      ? null
      : weightSeries[weightInteraction.activeIndex] ?? null;
  const productivityDetailRecords = activeProductivityPoint
    ? getRecordsForDate(snapshot, activeProductivityPoint.date)
    : null;
  const nutritionDetailRecords = activeNutritionPoint
    ? getRecordsForDate(snapshot, activeNutritionPoint.date)
    : null;
  const weightDetailRecords = activeWeightPoint
    ? getRecordsForDate(snapshot, activeWeightPoint.date)
    : null;

  useEffect(() => {
    setVisibleMonth(selectedDate);
  }, [selectedDate]);

  useEffect(
    () => () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    },
    [],
  );

  function scheduleFitnessDeleteUndo(nextDelete: PendingFitnessDelete) {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
    }

    setPendingFitnessDelete(nextDelete);
    undoTimerRef.current = window.setTimeout(() => {
      setPendingFitnessDelete(null);
      undoTimerRef.current = null;
    }, 5_000);
  }

  function handleUndoFitnessDelete() {
    if (!pendingFitnessDelete) {
      return;
    }

    if (pendingFitnessDelete.type === "workout") {
      onRestoreWorkoutRecord(pendingFitnessDelete.record);
    } else if (pendingFitnessDelete.type === "meal") {
      onRestoreMealRecord(pendingFitnessDelete.record);
    } else {
      onRestoreWeightRecord(pendingFitnessDelete.record);
    }

    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    setPendingFitnessDelete(null);
  }

  function deleteWorkout(record: WorkoutRecord) {
    onDeleteWorkoutRecord(record.id);
    scheduleFitnessDeleteUndo({ type: "workout", record });
  }

  function deleteMeal(record: MealRecord) {
    onDeleteMealRecord(record.id);
    scheduleFitnessDeleteUndo({ type: "meal", record });
  }

  function deleteWeight(record: WeightRecord) {
    onDeleteWeightRecord(record.id);
    scheduleFitnessDeleteUndo({ type: "weight", record });
  }

  function openBackfillAction(sourceElement: HTMLElement) {
    const shouldOpen = window.confirm(
      "지난 날짜에 기록을 추가합니다. 이 항목은 누락 보강으로 표시됩니다.",
    );

    if (shouldOpen) {
      openQuickAction(selectedDate, sourceElement, "backfill");
    }
  }

  const productivityChartDetail = activeProductivityPoint ? (
    <div className="space-y-1">
      <p className="font-semibold text-slate-700 dark:text-neutral-100">
        {formatKoreanDate(activeProductivityPoint.date)} · 완료{" "}
        {activeProductivityPoint.completedTasks}/{activeProductivityPoint.totalTasks}
      </p>
      <p>
        {summarizeItems(
          (productivityDetailRecords?.tasks ?? []).map((task) =>
            task.isDone ? `완료 ${task.text}` : `진행 ${task.text}`,
          ),
          "이 날 등록된 할 일이 없습니다.",
        )}
      </p>
    </div>
  ) : (
    <p>막대에 마우스를 올리거나 클릭하면 해당 날짜의 할 일 기록을 보여줍니다.</p>
  );

  const nutritionChartDetail = activeNutritionPoint ? (
    <div className="space-y-1">
      <p className="font-semibold text-slate-700 dark:text-neutral-100">
        {formatKoreanDate(activeNutritionPoint.date)} · 평균{" "}
        {activeNutritionPoint.averageCalories === null
          ? "-"
          : `${formatMetric(activeNutritionPoint.averageCalories, 0)} kcal`} / 단백질{" "}
        {activeNutritionPoint.averageProteinGrams === null
          ? "-"
          : `${formatMetric(activeNutritionPoint.averageProteinGrams)} g`}
      </p>
      <p>
        {summarizeItems(
          (nutritionDetailRecords?.mealRecords ?? []).map(
            (record) =>
              `${record.menu} ${record.calories.toLocaleString("ko-KR")} kcal / ${formatMetric(record.proteinGrams)} g`,
          ),
          "이 날 등록된 식사 기록이 없습니다.",
        )}
      </p>
    </div>
  ) : (
    <p>막대에 마우스를 올리거나 클릭하면 해당 날짜의 식사 기록을 보여줍니다.</p>
  );

  const weightChartDetail = activeWeightPoint ? (
    <div className="space-y-1">
      <p className="font-semibold text-slate-700 dark:text-neutral-100">
        {formatKoreanDate(activeWeightPoint.date)} · 체중{" "}
        {formatMetric(activeWeightPoint.weightKg)} kg
      </p>
      <p>
        {summarizeItems(
          (weightDetailRecords?.weightRecords ?? []).map(
            (record) => `${formatMetric(record.weightKg)} kg`,
          ),
          "이 날 등록된 체중 기록이 없습니다.",
        )}
      </p>
    </div>
  ) : (
    <p>선 위에 마우스를 올리거나 클릭한 뒤 좌우로 움직이면 날짜별 체중 기록을 계속 볼 수 있습니다.</p>
  );

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <div className="rounded-md border border-slate-300 bg-slate-950 p-3 text-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-normal text-cyan-300">
              Life Command Center
            </div>
            <h2 className="mt-1 truncate text-lg font-semibold tracking-normal">
              오늘의 지휘판
            </h2>
            <p className="mt-1 truncate text-xs text-slate-300">
              {formatKoreanDate(today)}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
              {syncStatus.label}
            </span>
            <span className="text-[11px] text-slate-400">
              {syncStatus.isOnline ? "online" : "offline"}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <BriefMetric label="남은 일" value={`${todayLeftTasks}개`} />
          <BriefMetric label="완료" value={`${todayDoneTasks}개`} />
          <BriefMetric label="운동" value={hasTodayWorkout ? "기록 있음" : "없음"} />
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2">
        <KpiCard
          icon={Target}
          label="생산성"
          value={
            dashboardStats.productivityScore === null
              ? "—"
              : `${dashboardStats.productivityScore}%`
          }
          detail={productivityDetail}
          tone="blue"
        />
        <KpiCard
          icon={Flame}
          label="평균 칼로리"
          value={formatNullableMetric(dashboardStats.averageCalories, "kcal")}
          detail={mealStatsDetail}
          tone="amber"
        />
        <KpiCard
          icon={Salad}
          label="평균 단백질"
          value={formatNullableMetric(dashboardStats.averageProteinGrams, "g", 1)}
          detail={mealStatsDetail}
          tone="emerald"
        />
        <KpiCard
          icon={Scale}
          label="체중 변화"
          value={getWeightDeltaLabel(dashboardStats.weightDeltaKg)}
          detail={
            dashboardStats.latestWeightKg === null
              ? "체중 기록 없음"
              : weightStatsDetail
                ? `최근 ${formatMetric(dashboardStats.latestWeightKg)} kg · ${weightStatsDetail}`
                : `최근 ${formatMetric(dashboardStats.latestWeightKg)} kg`
          }
          tone="violet"
        />
      </div>

      <div className="grid shrink-0 gap-2">
        <ChartCard
          title="생산성 흐름"
          icon={Activity}
          detail={productivityChartDetail}
          caption={hasProductivityData ? "선택 월 완료율" : "선택 월에 할 일이 없습니다."}
        >
          <BarSeries
            interaction={productivityInteraction}
            pointLabels={productivitySeries.map(
              (point) =>
                `${formatKoreanDate(point.date)} 완료 ${point.completedTasks}/${point.totalTasks}`,
            )}
            values={productivitySeries.map((point) =>
              point.totalTasks === 0
                ? 0
                : (point.completedTasks / point.totalTasks) * 100,
            )}
            toneClassName="bg-sky-500"
          />
        </ChartCard>
        <ChartCard
          title="칼로리 / 단백질"
          icon={Salad}
          caption={hasNutritionData ? "일별 평균 칼로리" : "선택 월에 식사 기록이 없습니다."}
        >
          <BarSeries
            interaction={nutritionInteraction}
            pointLabels={nutritionSeries.map(
              (point) =>
                `${formatKoreanDate(point.date)} 평균 ${point.averageCalories === null ? 0 : Math.round(point.averageCalories)} kcal`,
            )}
            values={nutritionSeries.map((point) => point.averageCalories ?? 0)}
            toneClassName="bg-amber-500"
          />
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            {nutritionChartDetail}
          </div>
        </ChartCard>
        <ChartCard
          title="체중 추세"
          icon={dashboardStats.weightDeltaKg && dashboardStats.weightDeltaKg < 0 ? TrendingDown : TrendingUp}
          detail={weightChartDetail}
          caption={weightSeries.length > 1 ? "월간 체중 변화" : "선택 월에 체중 기록이 부족합니다."}
        >
          <WeightLine
            interaction={weightInteraction}
            pointLabels={weightSeries.map(
              (point) => `${formatKoreanDate(point.date)} 체중 ${formatMetric(point.weightKg)} kg`,
            )}
            values={weightSeries.map((point) => point.weightKg)}
          />
        </ChartCard>
      </div>

      <RecordCalendar
        markerByDate={markerByDate}
        selectedDate={selectedDate}
        visibleMonth={visibleMonth}
        onSelectDate={onSelectDate}
        onVisibleMonthChange={setVisibleMonth}
      />

      <div className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-neutral-50">
              {selectedDate === today ? "오늘 일정" : formatKoreanDate(selectedDate)}
            </h3>
            <p className="truncate text-xs text-slate-500 dark:text-neutral-400">
              {selectedDateIsPast
                ? "지난 날짜의 새 기록은 누락 보강으로만 추가합니다."
                : selectedDateIsFuture
                  ? "미래 날짜에는 실제 수행 기록을 추가하지 않습니다."
                  : "메모, 할 일, 운동/식사/체중 기록을 모았습니다."}
            </p>
          </div>
          <div className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 dark:border-neutral-800 dark:bg-black dark:text-neutral-200">
            <CalendarDays className="h-4 w-4 text-teal-700 dark:text-teal-300" />
            {totalSelectedRecords}개
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <MarkerLegend />
          {selectedDate === today ? (
            <button
              type="button"
              onClick={(event) => openQuickAction(selectedDate, event.currentTarget)}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-neutral-100 dark:text-black dark:hover:bg-white"
            >
              빠른 작업
            </button>
          ) : selectedDateIsPast ? (
            <button
              type="button"
              onClick={(event) => openBackfillAction(event.currentTarget)}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50"
            >
              {BACKFILL_LABEL}
            </button>
          ) : selectedDateIsFuture ? (
            <span className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-400 dark:border-neutral-800 dark:text-neutral-500">
              미래 날짜
            </span>
          ) : null}
        </div>

        <div className="mt-3 space-y-3">
          <DailySection
            title="메모"
            count={selectedRecords.notes.length}
            emptyText="이 날짜에 수정한 메모가 없습니다."
            icon={<StickyNote className="h-4 w-4 text-slate-500 dark:text-neutral-200" />}
          >
            {selectedRecords.notes.map((note) => (
              <DailyItem
                key={note.id}
                markerClassName="border border-slate-400 bg-white dark:border-neutral-200 dark:bg-neutral-100"
                actions={
                  <DeleteItemButton
                    label="메모 삭제"
                    onDelete={() => onDeleteNote(note.id)}
                  />
                }
              >
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  {note.title.trim() || "제목 없음"}
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-neutral-400">
                  {getPlainTextFromNoteContent(note.content) || "내용 없음"}
                </div>
                <div className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">
                  {formatRecordTime(note.updatedAt)}
                </div>
                <BackfillBadge record={note} />
              </DailyItem>
            ))}
          </DailySection>

          <DailySection
            title="할 일"
            count={selectedRecords.tasks.length}
            emptyText="이 날짜에 잡힌 할 일이 없습니다."
            icon={<CheckSquare className="h-4 w-4 text-sky-500" />}
          >
            {selectedRecords.tasks.map((task) => (
              <DailyItem
                key={task.id}
                markerClassName="bg-sky-400"
                actions={
                  <DeleteItemButton
                    label="할 일 삭제"
                    onDelete={() => onDeleteTask(task.id)}
                  />
                }
              >
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={task.isDone}
                    onChange={() => onToggleTask(task.id)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-teal-700"
                    aria-label="할 일 완료 전환"
                  />
                  <div
                    className={
                      task.isDone
                        ? "min-w-0 flex-1 truncate text-sm font-semibold text-slate-400 line-through dark:text-neutral-500"
                        : "min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-neutral-100"
                    }
                  >
                    {task.text}
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                  {task.isDone ? "완료" : formatTaskDueLabel(task)}
                </div>
                <BackfillBadge record={task} />
              </DailyItem>
            ))}
          </DailySection>

          <DailySection
            title="운동"
            count={selectedRecords.workoutRecords.length}
            emptyText="운동 기록 없음"
            icon={<Dumbbell className="h-4 w-4 text-red-600" />}
          >
            {selectedRecords.workoutRecords.map((record) => (
              <DailyItem
                key={record.id}
                markerClassName="bg-red-500"
                actions={
                  <DeleteItemButton
                    label="운동 기록 삭제"
                    onDelete={() => deleteWorkout(record)}
                  />
                }
              >
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  {getWorkoutTypeLabel(record)} - {getWorkoutSubcategoryLabel(record)}
                </div>
                <WorkoutMetricDetail record={record} />
                <BackfillBadge record={record} />
              </DailyItem>
            ))}
          </DailySection>

          <DailySection
            title="식사"
            count={selectedRecords.mealRecords.length}
            emptyText="식사 기록 없음"
            icon={<Salad className="h-4 w-4 text-yellow-600" />}
          >
            {selectedRecords.mealRecords.map((record) => (
              <DailyItem
                key={record.id}
                markerClassName="bg-yellow-400"
                actions={
                  <DeleteItemButton
                    label="식사 기록 삭제"
                    onDelete={() => deleteMeal(record)}
                  />
                }
              >
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  {record.menu}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                  {record.calories.toLocaleString("ko-KR")} kcal / 단백질{" "}
                  {formatMetric(record.proteinGrams)} g
                </div>
                <BackfillBadge record={record} />
              </DailyItem>
            ))}
          </DailySection>

          <DailySection
            title="체중"
            count={selectedRecords.weightRecords.length}
            emptyText="체중 기록 없음"
            icon={<Scale className="h-4 w-4 text-emerald-600" />}
          >
            {selectedRecords.weightRecords.map((record) => (
              <DailyItem
                key={record.id}
                markerClassName="bg-emerald-500"
                actions={
                  <DeleteItemButton
                    label="체중 기록 삭제"
                    onDelete={() => deleteWeight(record)}
                  />
                }
              >
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  {formatMetric(record.weightKg)} kg
                </div>
                <BackfillBadge record={record} />
              </DailyItem>
            ))}
          </DailySection>
        </div>
      </div>

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
