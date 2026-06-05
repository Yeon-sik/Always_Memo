import { CalendarDays, CheckSquare, Dumbbell, Salad, Scale, StickyNote } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import type {
  MealRecord,
  Note,
  Task,
  WeightRecord,
  WorkoutRecord,
} from "../../types";
import { formatKoreanDate, formatLocalDate } from "../fitness/fitnessDate";
import {
  getWorkoutSubcategoryLabel,
  getWorkoutTypeLabel,
} from "../fitness/fitnessService";
import { formatMetric } from "../fitness/stats/fitnessStats";
import { RecordCalendar, type RecordMarkerSet } from "./RecordCalendar";

interface RecordsPanelProps {
  mealRecords: MealRecord[];
  notes: Note[];
  selectedDate: string;
  tasks: Task[];
  weightRecords: WeightRecord[];
  workoutRecords: WorkoutRecord[];
  onSelectDate: (date: string) => void;
}

function localDateFromTimestamp(value: string): string | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatLocalDate(date);
}

function groupMarkersByDate({
  mealRecords,
  notes,
  tasks,
  weightRecords,
  workoutRecords,
}: Pick<
  RecordsPanelProps,
  "mealRecords" | "notes" | "tasks" | "weightRecords" | "workoutRecords"
>): Map<string, RecordMarkerSet> {
  const map = new Map<string, RecordMarkerSet>();

  function ensure(date: string) {
    const current = map.get(date) ?? {};
    map.set(date, current);
    return current;
  }

  for (const note of notes) {
    const date = localDateFromTimestamp(note.updatedAt);

    if (date) {
      ensure(date).note = true;
    }
  }

  for (const task of tasks) {
    if (!task.isDone && task.dueDate) {
      ensure(task.dueDate).task = true;
    }
  }

  for (const record of workoutRecords) {
    ensure(record.date).workout = true;
  }

  for (const record of mealRecords) {
    ensure(record.date).meal = true;
  }

  for (const record of weightRecords) {
    ensure(record.date).weight = true;
  }

  return map;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isPendingTaskForDate(task: Task, referenceDate: string): boolean {
  return !task.isDone && task.dueDate !== null && task.dueDate >= referenceDate;
}

function formatTaskDueLabel(task: Task): string {
  if (!task.dueDate) {
    return "기한 없음";
  }

  return task.dueTime
    ? `${formatKoreanDate(task.dueDate)} ${task.dueTime} 마감`
    : `${formatKoreanDate(task.dueDate)} 마감`;
}

export function RecordsPanel({
  mealRecords,
  notes,
  selectedDate,
  tasks,
  weightRecords,
  workoutRecords,
  onSelectDate,
}: RecordsPanelProps) {
  const today = formatLocalDate();
  const markerByDate = useMemo(
    () =>
      groupMarkersByDate({
        mealRecords,
        notes,
        tasks,
        weightRecords,
        workoutRecords,
      }),
    [mealRecords, notes, tasks, weightRecords, workoutRecords],
  );
  const selectedNotes = useMemo(
    () =>
      notes
        .filter((note) => localDateFromTimestamp(note.updatedAt) === selectedDate)
        .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)),
    [notes, selectedDate],
  );
  const selectedTasks = useMemo(
    () =>
      tasks
        .filter((task) => isPendingTaskForDate(task, selectedDate))
        .sort((first, second) => {
          const firstDate = first.dueDate ?? "";
          const secondDate = second.dueDate ?? "";

          if (firstDate !== secondDate) {
            return firstDate.localeCompare(secondDate);
          }

          const firstTime = first.dueTime ?? "99:99";
          const secondTime = second.dueTime ?? "99:99";

          if (firstTime !== secondTime) {
            return firstTime.localeCompare(secondTime);
          }

          return first.orderIndex - second.orderIndex;
        }),
    [selectedDate, tasks],
  );
  const selectedWorkoutRecords = useMemo(
    () => workoutRecords.filter((record) => record.date === selectedDate),
    [selectedDate, workoutRecords],
  );
  const selectedMealRecords = useMemo(
    () => mealRecords.filter((record) => record.date === selectedDate),
    [mealRecords, selectedDate],
  );
  const selectedWeightRecords = useMemo(
    () => weightRecords.filter((record) => record.date === selectedDate),
    [selectedDate, weightRecords],
  );
  const totalRecords =
    selectedNotes.length +
    selectedTasks.length +
    selectedWorkoutRecords.length +
    selectedMealRecords.length +
    selectedWeightRecords.length;

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-950 dark:text-neutral-50">
            기록
          </h2>
          <p className="truncate text-xs text-slate-500 dark:text-neutral-400">
            {selectedDate === today ? "오늘 일정" : "선택 날짜 일정"}:{" "}
            {formatKoreanDate(selectedDate)}
          </p>
        </div>
        <div className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 dark:border-neutral-800 dark:bg-black dark:text-neutral-200">
          <CalendarDays className="h-4 w-4 text-teal-700 dark:text-teal-300" />
          {totalRecords}개
        </div>
      </div>

      <RecordCalendar
        markerByDate={markerByDate}
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
      />

      <div className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-neutral-50">
              {selectedDate === today ? "오늘 일정" : formatKoreanDate(selectedDate)}
            </h3>
            <p className="truncate text-xs text-slate-500 dark:text-neutral-400">
              메모, 기한이 남은 할 일, 운동 기록을 모았습니다.
            </p>
          </div>
          <MarkerLegend />
        </div>

        <div className="space-y-3">
          <DailySection
            title="메모"
            count={selectedNotes.length}
            emptyText="이 날짜에 수정한 메모가 없습니다."
            icon={<StickyNote className="h-4 w-4 text-slate-500 dark:text-neutral-200" />}
          >
            {selectedNotes.map((note) => (
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
            count={selectedTasks.length}
            emptyText="기한이 남은 미해결 할 일이 없습니다."
            icon={<CheckSquare className="h-4 w-4 text-sky-500" />}
          >
            {selectedTasks.map((task) => (
              <DailyItem key={task.id} markerClassName="bg-sky-400">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  {task.text}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                  {formatTaskDueLabel(task)}
                </div>
              </DailyItem>
            ))}
          </DailySection>

          <DailySection
            title="운동"
            count={selectedWorkoutRecords.length}
            emptyText="운동 기록 없음"
            icon={<Dumbbell className="h-4 w-4 text-red-600" />}
          >
            {selectedWorkoutRecords.map((record) => (
              <DailyItem key={record.id} markerClassName="bg-red-500">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  {getWorkoutTypeLabel(record)} - {getWorkoutSubcategoryLabel(record)}
                </div>
              </DailyItem>
            ))}
          </DailySection>

          <DailySection
            title="식사"
            count={selectedMealRecords.length}
            emptyText="식사 기록 없음"
            icon={<Salad className="h-4 w-4 text-yellow-600" />}
          >
            {selectedMealRecords.map((record) => (
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
            count={selectedWeightRecords.length}
            emptyText="체중 기록 없음"
            icon={<Scale className="h-4 w-4 text-emerald-600" />}
          >
            {selectedWeightRecords.map((record) => (
              <DailyItem key={record.id} markerClassName="bg-emerald-500">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  {formatMetric(record.weightKg)} kg
                </div>
              </DailyItem>
            ))}
          </DailySection>
        </div>
      </div>
    </section>
  );
}

function MarkerLegend() {
  return (
    <div className="flex shrink-0 items-center gap-1.5" aria-label="달력 표시 범례">
      <span className="box-border h-2 w-2 rounded-full border border-slate-400 bg-white shadow-sm dark:border-neutral-200 dark:bg-neutral-100" />
      <span className="box-border h-2 w-2 rounded-full border border-transparent bg-sky-400 shadow-sm" />
      <span className="box-border h-2 w-2 rounded-full border border-transparent bg-red-500 shadow-sm" />
      <span className="box-border h-2 w-2 rounded-full border border-transparent bg-yellow-400 shadow-sm" />
      <span className="box-border h-2 w-2 rounded-full border border-transparent bg-emerald-500 shadow-sm" />
    </div>
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
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${markerClassName}`} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
