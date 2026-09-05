import {
  Activity,
  Flame,
  Salad,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import type { LocalDataSnapshot } from "../../../types";
import type { SyncStatus } from "../../../lib/sync/syncTypes";
import {
  BACKFILL_LABEL,
  hasBackfillMetadata,
} from "../../../lib/dataTrust/backfillMetadata";
import {
  formatFitnessProjectionLabels,
  getFitnessSummary,
} from "../../fitness-summary/fitnessSummary";
import { formatKoreanDate } from "../../fitness/fitnessDate";
import { formatMetric } from "../../fitness/stats/fitnessStats";
import {
  getDashboardStats,
  getMonthRange,
  getNutritionSeries,
  getProductivitySeries,
  getRecordsForDate,
  getWeightSeries,
} from "../recordAggregation";
import {
  formatNullableMetric,
  getWeightDeltaLabel,
} from "../recordDisplayFormatters";
import { useChartInteraction } from "../hooks/useChartInteraction";
import {
  BarSeries,
  BriefMetric,
  ChartCard,
  KpiCard,
  WeightLine,
} from "./InteractiveRecordsMetrics";

interface RecordsOverviewProps {
  selectedDate: string;
  snapshot: LocalDataSnapshot;
  syncStatus: SyncStatus;
  today: string;
}

function formatOptionalKg(value: number | null): string {
  return value === null ? "-" : `${formatMetric(value)} kg`;
}

function formatSignedKg(value: number | null): string {
  if (value === null) {
    return "-";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${formatMetric(value)} kg`;
}

function summarizeItems(items: string[], emptyText: string): string {
  if (items.length === 0) {
    return emptyText;
  }

  if (items.length <= 2) {
    return items.join(" · ");
  }

  return `${items.slice(0, 2).join(" · ")} 외 ${items.length - 2}건`;
}

export function RecordsOverview({
  selectedDate,
  snapshot,
  syncStatus,
  today,
}: RecordsOverviewProps) {
  const selectedRange = useMemo(() => getMonthRange(selectedDate), [selectedDate]);
  const todayRecords = useMemo(
    () => getRecordsForDate(snapshot, today),
    [snapshot, today],
  );
  const dashboardStats = useMemo(
    () => getDashboardStats(snapshot, selectedRange),
    [selectedRange, snapshot],
  );
  const fitnessSummary = useMemo(
    () => getFitnessSummary(snapshot, today),
    [snapshot, today],
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
  const todayPlannedTasks = snapshot.tasks.filter(
    (task) => task.deletedAt === null && task.plannedDate === today,
  );
  const todayLeftTasks = todayPlannedTasks.filter((task) => !task.isDone).length;
  const todayDoneTasks = todayPlannedTasks.filter((task) => task.isDone).length;
  const hasTodayWorkout = todayRecords.workoutRecords.length > 0;
  const hasProductivityData = productivitySeries.some(
    (point) => point.totalTasks > 0,
  );
  const hasNutritionData = nutritionSeries.some(
    (point) => point.averageCalories !== null,
  );
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
  const productivityDetailTasks = activeProductivityPoint
    ? snapshot.tasks.filter(
        (task) =>
          task.deletedAt === null &&
          task.plannedDate === activeProductivityPoint.date &&
          !hasBackfillMetadata(task),
      )
    : [];
  const nutritionDetailRecords = activeNutritionPoint
    ? getRecordsForDate(snapshot, activeNutritionPoint.date)
    : null;
  const weightDetailRecords = activeWeightPoint
    ? getRecordsForDate(snapshot, activeWeightPoint.date)
    : null;

  const productivityChartDetail = activeProductivityPoint ? (
    <div className="space-y-1">
      <p className="font-semibold text-slate-700 dark:text-neutral-100">
        {formatKoreanDate(activeProductivityPoint.date)} · 완료{" "}
        {activeProductivityPoint.completedTasks}/{activeProductivityPoint.totalTasks}
      </p>
      <p>
        {summarizeItems(
          productivityDetailTasks.map((task) =>
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
    <>
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

      <div className="rounded-md border border-slate-300 bg-white p-3 text-slate-900 dark:border-neutral-800 dark:bg-black dark:text-neutral-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-normal text-red-600 dark:text-red-300">
              Fitness Summary
            </div>
            <h3 className="mt-1 truncate text-sm font-semibold">
              Read-only OS view
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              Detail edits stay in Fitness app. OS only shows summary and link state.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-neutral-700 dark:text-neutral-300">
            {fitnessSummary.todayHasWorkout ? "Workout today" : "No workout today"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <BriefMetric
            label="7d workouts"
            value={`${fitnessSummary.weeklyWorkoutCount}`}
          />
          <BriefMetric
            label="Latest weight"
            value={formatOptionalKg(fitnessSummary.latestWeightKg)}
          />
          <BriefMetric
            label="Weight delta"
            value={formatSignedKg(fitnessSummary.weightDeltaKg)}
          />
          <BriefMetric
            label="Meal status"
            value={fitnessSummary.todayHasMeal ? "Logged today" : "No meal today"}
          />
        </div>

        <div className="mt-3 space-y-2 text-xs text-slate-600 dark:text-neutral-300">
          <p>
            <span className="font-semibold text-slate-800 dark:text-neutral-100">
              Recent:
            </span>{" "}
            {summarizeItems(
              fitnessSummary.recentWorkouts.map(
                (record) =>
                  `${record.date} ${formatFitnessProjectionLabels(record).join(" · ")}`,
              ),
              "No recent workout sessions.",
            )}
          </p>
          <p>
            <span className="font-semibold text-slate-800 dark:text-neutral-100">
              Strength summary:
            </span>{" "}
            {summarizeItems(
              fitnessSummary.weeklyStrengthSetSummaries,
              "No weekly strength summary.",
            )}
          </p>
          <p>
            <span className="font-semibold text-slate-800 dark:text-neutral-100">
              Latest meal:
            </span>{" "}
            {fitnessSummary.latestMeal
              ? `${fitnessSummary.latestMeal.date} ${fitnessSummary.latestMeal.menu}`
              : "No meal record."}
          </p>
        </div>

        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
          <div className="font-semibold">공유 운동 기록 상태</div>
          <div className="mt-1">
            공유 {fitnessSummary.connection.linkedCount} / Personal OS 생성{" "}
            {fitnessSummary.connection.quickRecordOnlyCount} / 진행 중 비공개{" "}
            {fitnessSummary.connection.possibleMismatchCount}
          </div>
          <div className="mt-1">{fitnessSummary.connection.message}</div>
        </div>

        <button
          type="button"
          disabled
          className="mt-3 inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-400 dark:border-neutral-800 dark:text-neutral-500"
          title="Fitness app deep link is not wired in this phase."
        >
          Open Fitness app for detail edits
        </button>
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
    </>
  );
}
