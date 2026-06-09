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
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LocalDataSnapshot, Task } from "../../types";
import type { SyncStatus } from "../../lib/sync/syncTypes";
import { QuickActionOverlay } from "../command-center/quickActions/QuickActionOverlay";
import { useQuickActionState } from "../command-center/quickActions/useQuickActionState";
import { formatKoreanDate, formatLocalDate } from "../fitness/fitnessDate";
import {
  getWorkoutSubcategoryLabel,
  getWorkoutTypeLabel,
} from "../fitness/fitnessService";
import { formatMetric } from "../fitness/stats/fitnessStats";
import { RecordCalendar } from "./RecordCalendar";
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
  onAddNoteForDate: (date: string, title: string, content: string) => void;
  onAddTask: (text: string, dueDate: string | null, dueTime: string | null) => void;
  onAddWeightRecord: (date: string, weightKg: number) => void;
  onSelectDate: (date: string) => void;
  onToggleTask: (taskId: string) => void;
  onUpdateNoteForDate: (
    noteId: string,
    date: string,
    title: string,
    content: string,
  ) => void;
  onUpdateWeightRecord: (recordId: string, weightKg: number) => void;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTaskDueLabel(task: Task): string {
  if (!task.dueDate) {
    return "기한 없음";
  }

  return task.dueTime
    ? `${formatKoreanDate(task.dueDate)} ${task.dueTime} 마감`
    : `${formatKoreanDate(task.dueDate)} 마감`;
}

function formatNullableMetric(
  value: number | null,
  suffix: string,
  fractionDigits = 0,
): string {
  if (value === null) {
    return "—";
  }

  return `${formatMetric(value, fractionDigits)} ${suffix}`;
}

function getWeightDeltaLabel(value: number | null): string {
  if (value === null) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${formatMetric(value)} kg`;
}

export function RecordsPanel({
  selectedDate,
  snapshot,
  syncStatus,
  onAddNoteForDate,
  onAddTask,
  onAddWeightRecord,
  onSelectDate,
  onToggleTask,
  onUpdateNoteForDate,
  onUpdateWeightRecord,
}: RecordsPanelProps) {
  const today = formatLocalDate();
  const [visibleMonth, setVisibleMonth] = useState(selectedDate);
  const {
    closeQuickAction,
    isQuickActionOpen,
    openQuickAction,
    quickActionDate,
  } = useQuickActionState();
  const selectedRange = useMemo(() => getMonthRange(selectedDate), [selectedDate]);
  const selectedRecords = useMemo(
    () => getRecordsForDate(snapshot, selectedDate),
    [selectedDate, snapshot],
  );
  const quickActionRecords = useMemo(
    () => getRecordsForDate(snapshot, quickActionDate ?? selectedDate),
    [quickActionDate, selectedDate, snapshot],
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

  useEffect(() => {
    setVisibleMonth(selectedDate);
  }, [selectedDate]);

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
          detail={`${dashboardStats.completedTasks}/${dashboardStats.totalTasks} 완료`}
          tone="blue"
        />
        <KpiCard
          icon={Flame}
          label="평균 칼로리"
          value={formatNullableMetric(dashboardStats.averageCalories, "kcal")}
          detail="선택 월 식사 기준"
          tone="amber"
        />
        <KpiCard
          icon={Salad}
          label="평균 단백질"
          value={formatNullableMetric(dashboardStats.averageProteinGrams, "g", 1)}
          detail="선택 월 식사 기준"
          tone="emerald"
        />
        <KpiCard
          icon={Scale}
          label="체중 변화"
          value={getWeightDeltaLabel(dashboardStats.weightDeltaKg)}
          detail={
            dashboardStats.latestWeightKg === null
              ? "체중 기록 없음"
              : `최근 ${formatMetric(dashboardStats.latestWeightKg)} kg`
          }
          tone="violet"
        />
      </div>

      <div className="grid shrink-0 gap-2">
        <ChartCard
          title="생산성 흐름"
          icon={Activity}
          caption={hasProductivityData ? "선택 월 완료율" : "선택 월에 할 일이 없습니다."}
        >
          <BarSeries
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
            values={nutritionSeries.map((point) => point.averageCalories ?? 0)}
            toneClassName="bg-amber-500"
          />
        </ChartCard>
        <ChartCard
          title="체중 추세"
          icon={dashboardStats.weightDeltaKg && dashboardStats.weightDeltaKg < 0 ? TrendingDown : TrendingUp}
          caption={weightSeries.length > 1 ? "월간 체중 변화" : "선택 월에 체중 기록이 부족합니다."}
        >
          <WeightLine values={weightSeries.map((point) => point.weightKg)} />
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
              메모, 할 일, 운동/식사/체중 기록을 모았습니다.
            </p>
          </div>
          <div className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 dark:border-neutral-800 dark:bg-black dark:text-neutral-200">
            <CalendarDays className="h-4 w-4 text-teal-700 dark:text-teal-300" />
            {totalSelectedRecords}개
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <MarkerLegend />
          <button
            type="button"
            onClick={(event) => openQuickAction(selectedDate, event.currentTarget)}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-neutral-100 dark:text-black dark:hover:bg-white"
          >
            빠른 작업
          </button>
        </div>

        <div className="mt-3 space-y-3">
          <DailySection
            title="메모"
            count={selectedRecords.notes.length}
            emptyText="이 날짜에 수정한 메모가 없습니다."
            icon={<StickyNote className="h-4 w-4 text-slate-500 dark:text-neutral-200" />}
          >
            {selectedRecords.notes.map((note) => (
              <DailyItem key={note.id} markerClassName="border border-slate-400 bg-white dark:border-neutral-200 dark:bg-neutral-100">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  {note.title.trim() || "제목 없음"}
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-neutral-400">
                  {note.content.trim() || "내용 없음"}
                </div>
                <div className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">
                  {formatTime(note.updatedAt)}
                </div>
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
              <DailyItem key={task.id} markerClassName="bg-sky-400">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  {task.text}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                  {task.isDone ? "완료" : formatTaskDueLabel(task)}
                </div>
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
              <DailyItem key={record.id} markerClassName="bg-red-500">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  {getWorkoutTypeLabel(record)} - {getWorkoutSubcategoryLabel(record)}
                </div>
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
              <DailyItem key={record.id} markerClassName="bg-yellow-400">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  {record.menu}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                  {record.calories.toLocaleString("ko-KR")} kcal / 단백질{" "}
                  {formatMetric(record.proteinGrams)} g
                </div>
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
              <DailyItem key={record.id} markerClassName="bg-emerald-500">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  {formatMetric(record.weightKg)} kg
                </div>
              </DailyItem>
            ))}
          </DailySection>
        </div>
      </div>

      {isQuickActionOpen && quickActionDate ? (
        <QuickActionOverlay
          records={quickActionRecords}
          selectedDate={quickActionDate}
          onAddNote={onAddNoteForDate}
          onAddTask={onAddTask}
          onAddWeightRecord={onAddWeightRecord}
          onClose={closeQuickAction}
          onToggleTask={onToggleTask}
          onUpdateNote={onUpdateNoteForDate}
          onUpdateWeightRecord={onUpdateWeightRecord}
        />
      ) : null}
    </section>
  );
}

function BriefMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/5 px-2 py-2">
      <div className="truncate text-[10px] font-medium text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums text-white">
        {value}
      </div>
    </div>
  );
}

function KpiCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: "amber" | "blue" | "emerald" | "violet";
  value: string;
}) {
  const toneClasses = {
    amber: "text-amber-700 dark:text-amber-300",
    blue: "text-sky-700 dark:text-sky-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    violet: "text-violet-700 dark:text-violet-300",
  };

  return (
    <div className="min-w-0 rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-neutral-400">
        <Icon className={`h-4 w-4 shrink-0 ${toneClasses[tone]}`} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 truncate text-xl font-semibold tabular-nums text-slate-950 dark:text-neutral-50">
        {value}
      </div>
      <div className="mt-1 truncate text-[11px] text-slate-500 dark:text-neutral-400">
        {detail}
      </div>
    </div>
  );
}

function ChartCard({
  caption,
  children,
  icon: Icon,
  title,
}: {
  caption: string;
  children: ReactNode;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-700 dark:text-neutral-200">
          <Icon className="h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </div>
        <span className="truncate text-[11px] text-slate-400 dark:text-neutral-500">
          {caption}
        </span>
      </div>
      {children}
    </div>
  );
}

function BarSeries({
  toneClassName,
  values,
}: {
  toneClassName: string;
  values: number[];
}) {
  const maxValue = Math.max(...values, 1);

  return (
    <div className="flex h-16 items-end gap-1 overflow-hidden">
      {values.map((value, index) => (
        <span
          key={`${index}-${value}`}
          className={`min-w-1 flex-1 rounded-t-sm ${value > 0 ? toneClassName : "bg-slate-200 dark:bg-neutral-800"}`}
          style={{ height: `${Math.max(8, (value / maxValue) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function WeightLine({ values }: { values: number[] }) {
  if (values.length < 2) {
    return (
      <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
        체중 추세 데이터 부족
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = 56 - ((value - min) / range) * 48;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className="h-16 w-full overflow-visible"
      viewBox="0 0 100 64"
      preserveAspectRatio="none"
      role="img"
      aria-label="체중 변화 추세"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-violet-600 dark:text-violet-300"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function MarkerLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400" aria-label="달력 표시 범례">
      <MarkerLegendItem label="메모" className="border border-slate-400 bg-white dark:border-neutral-200 dark:bg-neutral-100" />
      <MarkerLegendItem label="할 일" className="bg-sky-400" />
      <MarkerLegendItem label="운동" className="bg-red-500" />
      <MarkerLegendItem label="식사" className="bg-yellow-400" />
      <MarkerLegendItem label="체중" className="bg-emerald-500" />
    </div>
  );
}

function MarkerLegendItem({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="inline-flex h-2 w-2 shrink-0 items-center justify-center">
        <span className={`block h-1.5 w-1.5 rounded-full ${className}`} />
      </span>
      <span>{label}</span>
    </span>
  );
}

function DailySection({
  children,
  count,
  emptyText,
  icon,
  title,
}: {
  children: ReactNode;
  count: number;
  emptyText: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-neutral-300">
        {icon}
        <span>{title}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </section>
  );
}

function DailyItem({
  children,
  markerClassName,
}: {
  children: ReactNode;
  markerClassName: string;
}) {
  return (
    <div className="flex min-h-10 items-start gap-2 rounded-md border border-slate-200 px-2 py-2 dark:border-neutral-800">
      <span className="mt-1.5 inline-flex h-2 w-2 shrink-0 items-center justify-center">
        <span className={`block h-1.5 w-1.5 rounded-full ${markerClassName}`} />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
