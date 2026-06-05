import { FormEvent, type ReactNode, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Dumbbell,
  Plus,
  Salad,
  Scale,
  Trash2,
} from "lucide-react";
import type {
  MealRecord,
  WeightRecord,
  WorkoutRecord,
  WorkoutType,
} from "../../types";
import {
  formatKoreanDate,
  formatLocalDate,
  getCurrentMonthRange,
  parseDateInput,
} from "./fitnessDate";
import {
  calculateFitnessStats,
  formatMetric,
} from "./stats/fitnessStats";
import {
  createFitnessExportFileName,
  createFitnessMarkdownExport,
} from "./export/fitnessMarkdownExport";
import {
  cardioWorkoutOptions,
  getWorkoutSubcategoryLabel,
  getWorkoutTypeLabel,
  strengthWorkoutParts,
  workoutTypeLabels,
} from "./fitnessService";

interface FitnessPanelProps {
  mealRecords: MealRecord[];
  weightRecords: WeightRecord[];
  workoutRecords: WorkoutRecord[];
  onAddMealRecord: (
    date: string,
    menu: string,
    calories: number,
    proteinGrams: number,
  ) => void;
  onAddWeightRecord: (date: string, weightKg: number) => void;
  onAddWorkoutRecord: (
    date: string,
    workoutType: WorkoutType,
    category: string,
    exerciseName: string,
  ) => void;
  onAddWorkoutRecords: (
    records: Array<{
      date: string;
      workoutType: WorkoutType;
      category: string;
      exerciseName: string;
    }>,
  ) => void;
  onDeleteMealRecord: (recordId: string) => void;
  onDeleteWeightRecord: (recordId: string) => void;
  onDeleteWorkoutRecord: (recordId: string) => void;
}

type ActionPanel = "stats" | "export" | null;

const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
const workoutTypeOptions: WorkoutType[] = ["strength", "cardio", "other"];

function getMonthCells(monthDate: Date): Array<string | null> {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const cells: Array<string | null> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push(formatLocalDate(new Date(year, month, day)));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function getMonthTitle(monthDate: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(monthDate);
}

function groupPresenceByDate(
  workoutRecords: WorkoutRecord[],
  mealRecords: MealRecord[],
  weightRecords: WeightRecord[],
): Map<string, { workout: boolean; meal: boolean; weight: boolean }> {
  const map = new Map<
    string,
    { workout: boolean; meal: boolean; weight: boolean }
  >();

  function ensure(date: string) {
    const current =
      map.get(date) ?? { workout: false, meal: false, weight: false };
    map.set(date, current);
    return current;
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

function downloadMarkdown(fileName: string, markdown: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function FitnessPanel({
  mealRecords,
  weightRecords,
  workoutRecords,
  onAddMealRecord,
  onAddWeightRecord,
  onAddWorkoutRecord,
  onAddWorkoutRecords,
  onDeleteMealRecord,
  onDeleteWeightRecord,
  onDeleteWorkoutRecord,
}: FitnessPanelProps) {
  const today = formatLocalDate();
  const currentMonthRange = getCurrentMonthRange();
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(parseDateInput(today));
  const [actionPanel, setActionPanel] = useState<ActionPanel>(null);
  const [rangeStartDate, setRangeStartDate] = useState(
    currentMonthRange.startDate,
  );
  const [rangeEndDate, setRangeEndDate] = useState(currentMonthRange.endDate);
  const [workoutDate, setWorkoutDate] = useState(today);
  const [workoutType, setWorkoutType] = useState<WorkoutType>("strength");
  const [selectedStrengthParts, setSelectedStrengthParts] = useState<string[]>(
    [],
  );
  const [workoutCardioType, setWorkoutCardioType] = useState<string>(
    cardioWorkoutOptions[0],
  );
  const [workoutExerciseName, setWorkoutExerciseName] = useState("");
  const [mealDate, setMealDate] = useState(today);
  const [mealMenu, setMealMenu] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [mealProteinGrams, setMealProteinGrams] = useState("");
  const [weightDate, setWeightDate] = useState(today);
  const [weightKg, setWeightKg] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const monthCells = useMemo(() => getMonthCells(visibleMonth), [visibleMonth]);
  const markerByDate = useMemo(
    () => groupPresenceByDate(workoutRecords, mealRecords, weightRecords),
    [mealRecords, weightRecords, workoutRecords],
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
  const stats = useMemo(
    () =>
      calculateFitnessStats(
        workoutRecords,
        mealRecords,
        weightRecords,
        rangeStartDate,
        rangeEndDate,
      ),
    [mealRecords, rangeEndDate, rangeStartDate, weightRecords, workoutRecords],
  );
  const exportMarkdown = useMemo(
    () =>
      createFitnessMarkdownExport({
        workoutRecords,
        mealRecords,
        weightRecords,
        startDate: rangeStartDate,
        endDate: rangeEndDate,
      }),
    [mealRecords, rangeEndDate, rangeStartDate, weightRecords, workoutRecords],
  );
  const exportFileName = createFitnessExportFileName(
    rangeStartDate,
    rangeEndDate,
  );

  function selectDate(date: string) {
    setSelectedDate(date);
    setWorkoutDate(date);
    setMealDate(date);
    setWeightDate(date);
  }

  function moveMonth(offset: number) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  function handleTodayClick() {
    const nextToday = formatLocalDate();
    selectDate(nextToday);
    setVisibleMonth(parseDateInput(nextToday));
  }

  function handleWorkoutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workoutDate) {
      setFormError("운동 기록은 날짜가 필요합니다.");
      return;
    }

    if (workoutType === "strength") {
      if (selectedStrengthParts.length === 0) {
        setFormError("헬스 기록은 부위를 하나 이상 선택해야 합니다.");
        return;
      }

      onAddWorkoutRecords(
        selectedStrengthParts.map((part) => ({
          date: workoutDate,
          workoutType,
          category: part,
          exerciseName: part,
        })),
      );
    } else if (workoutType === "cardio") {
      if (!workoutCardioType) {
        setFormError("유산소 기록은 종류 선택이 필요합니다.");
        return;
      }

      onAddWorkoutRecord(
        workoutDate,
        workoutType,
        workoutCardioType,
        workoutCardioType,
      );
    } else {
      if (!workoutExerciseName.trim()) {
        setFormError("기타 기록은 무슨 운동인지 필요합니다.");
        return;
      }

      onAddWorkoutRecord(
        workoutDate,
        workoutType,
        "기타",
        workoutExerciseName.trim(),
      );
    }

    setSelectedStrengthParts([]);
    setWorkoutExerciseName("");
    setFormError(null);
  }

  function toggleStrengthPart(part: string) {
    setSelectedStrengthParts((currentParts) =>
      currentParts.includes(part)
        ? currentParts.filter((currentPart) => currentPart !== part)
        : [...currentParts, part],
    );
    setFormError(null);
  }

  function handleMealSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const calories = Number(mealCalories);
    const proteinGrams = Number(mealProteinGrams);

    if (
      !mealDate ||
      !mealMenu.trim() ||
      !Number.isFinite(calories) ||
      calories < 0 ||
      !Number.isFinite(proteinGrams) ||
      proteinGrams < 0
    ) {
      setFormError("식사 기록은 날짜, 메뉴, 0 이상의 칼로리와 단백질이 필요합니다.");
      return;
    }

    onAddMealRecord(mealDate, mealMenu.trim(), calories, proteinGrams);
    setMealMenu("");
    setMealCalories("");
    setMealProteinGrams("");
    setFormError(null);
  }

  function handleWeightSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedWeightKg = Number(weightKg);

    if (!weightDate || !Number.isFinite(parsedWeightKg) || parsedWeightKg <= 0) {
      setFormError("체중 기록은 날짜와 0보다 큰 kg 값이 필요합니다.");
      return;
    }

    onAddWeightRecord(weightDate, parsedWeightKg);
    setWeightKg("");
    setFormError(null);
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-950 dark:text-neutral-50">
            운동
          </h2>
          <p className="truncate text-xs text-slate-500 dark:text-neutral-400">
            오늘 날짜: {formatKoreanDate(selectedDate)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setActionPanel((current) =>
                current === "stats" ? null : "stats",
              )
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-neutral-800 dark:bg-black dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            통계
          </button>
          <button
            type="button"
            onClick={() =>
              setActionPanel((current) =>
                current === "export" ? null : "export",
              )
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-neutral-800 dark:bg-black dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            출력
          </button>
        </div>
      </div>

      {actionPanel ? (
        <div className="shrink-0 rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <label className="min-w-0 text-xs font-semibold text-slate-600 dark:text-neutral-300">
              시작일
              <input
                type="date"
                value={rangeStartDate}
                onChange={(event) => setRangeStartDate(event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 dark:border-neutral-800 dark:bg-black dark:text-neutral-100"
              />
            </label>
            <label className="min-w-0 text-xs font-semibold text-slate-600 dark:text-neutral-300">
              종료일
              <input
                type="date"
                value={rangeEndDate}
                onChange={(event) => setRangeEndDate(event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 dark:border-neutral-800 dark:bg-black dark:text-neutral-100"
              />
            </label>
            {actionPanel === "export" ? (
              <button
                type="button"
                onClick={() => downloadMarkdown(exportFileName, exportMarkdown)}
                className="mt-5 inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                파일 저장
              </button>
            ) : null}
          </div>

          {actionPanel === "stats" ? (
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <div className="rounded-md border border-slate-200 p-3 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  <Dumbbell className="h-4 w-4 text-red-600" aria-hidden="true" />
                  운동 총합
                </div>
                <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-neutral-50">
                  {stats.workoutTotal}회
                </p>
                <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-neutral-400">
                  {stats.workoutBySubcategory.length === 0 ? (
                    <p>기록 없음</p>
                  ) : (
                    stats.workoutBySubcategory.map((item) => (
                      <p key={item.label}>
                        {item.label}: {item.count}회
                      </p>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 p-3 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  <Salad className="h-4 w-4 text-yellow-600" aria-hidden="true" />
                  식사 평균
                </div>
                <p className="mt-2 text-sm text-slate-500 dark:text-neutral-400">
                  기록 {stats.mealCount}개
                </p>
                <p className="mt-2 text-sm text-slate-800 dark:text-neutral-100">
                  칼로리 {formatMetric(stats.averageCalories, 0)} kcal
                </p>
                <p className="text-sm text-slate-800 dark:text-neutral-100">
                  단백질 {formatMetric(stats.averageProteinGrams)} g
                </p>
              </div>
              <div className="rounded-md border border-slate-200 p-3 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  <Scale className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  체중 평균
                </div>
                <p className="mt-2 text-sm text-slate-500 dark:text-neutral-400">
                  기록 {stats.weightCount}개
                </p>
                <p className="mt-2 text-sm text-slate-800 dark:text-neutral-100">
                  평균 {formatMetric(stats.averageWeightKg)} kg
                </p>
                <p className="text-sm text-slate-800 dark:text-neutral-100">
                  최저 {formatMetric(stats.minWeightKg)} kg / 최고{" "}
                  {formatMetric(stats.maxWeightKg)} kg
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <div className="mb-2 truncate text-xs text-slate-500 dark:text-neutral-400">
                파일명: {exportFileName}
              </div>
              <textarea
                readOnly
                value={exportMarkdown}
                className="h-48 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
              />
            </div>
          )}
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
              aria-label="이전 달"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="min-w-0 text-center">
              <div className="truncate text-sm font-semibold text-slate-950 dark:text-neutral-50">
                {getMonthTitle(visibleMonth)}
              </div>
              <button
                type="button"
                onClick={handleTodayClick}
                className="mt-1 text-xs font-semibold text-teal-700 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-200"
              >
                오늘로 이동
              </button>
            </div>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-slate-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
              aria-label="다음 달"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500 dark:text-neutral-400">
            {weekDays.map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthCells.map((date, index) => {
              const markers = date ? markerByDate.get(date) : null;
              const isSelected = date === selectedDate;
              const isToday = date === today;

              return date ? (
                <button
                  key={date}
                  type="button"
                  onClick={() => selectDate(date)}
                  className={
                    isSelected
                      ? "flex aspect-square min-h-16 flex-col items-center justify-between rounded-md border border-teal-600 bg-teal-50 p-1 text-sm font-semibold text-teal-950 dark:border-teal-400 dark:bg-teal-950/50 dark:text-teal-100"
                      : "flex aspect-square min-h-16 flex-col items-center justify-between rounded-md border border-slate-200 bg-white p-1 text-sm text-slate-800 transition hover:border-teal-300 hover:bg-teal-50 dark:border-neutral-800 dark:bg-black dark:text-neutral-200 dark:hover:border-teal-800 dark:hover:bg-teal-950/30"
                  }
                >
                  <span
                    className={
                      isToday
                        ? "inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-black"
                        : "inline-flex h-6 min-w-6 items-center justify-center px-1.5 text-xs font-semibold"
                    }
                  >
                    {Number(date.slice(-2))}
                  </span>
                  <span className="flex h-3 items-center justify-center gap-1">
                    {markers?.workout ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    ) : null}
                    {markers?.meal ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    ) : null}
                    {markers?.weight ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    ) : null}
                  </span>
                </button>
              ) : (
                <div
                  key={`blank-${index}`}
                  className="aspect-square min-h-16 rounded-md border border-transparent"
                />
              );
            })}
          </div>
        </div>

        <div className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black">
          <div className="mb-3 flex min-w-0 items-center gap-2">
            <CalendarDays
              className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300"
              aria-hidden="true"
            />
            <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-neutral-50">
              {formatKoreanDate(selectedDate)}
            </h3>
          </div>

          <div className="space-y-3">
            <RecordList
              title="운동"
              icon={<Dumbbell className="h-4 w-4 text-red-600" aria-hidden="true" />}
              emptyText="운동 기록 없음"
              records={selectedWorkoutRecords}
              renderRecord={(record) => (
                <>
                  <span className="font-semibold">
                    {getWorkoutTypeLabel(record)} -{" "}
                    {getWorkoutSubcategoryLabel(record)}
                  </span>
                </>
              )}
              onDelete={onDeleteWorkoutRecord}
            />
            <RecordList
              title="식사"
              icon={<Salad className="h-4 w-4 text-yellow-600" aria-hidden="true" />}
              emptyText="식사 기록 없음"
              records={selectedMealRecords}
              renderRecord={(record) => (
                <>
                  <span className="font-semibold">{record.menu}</span>
                  <span className="text-slate-500 dark:text-neutral-400">
                    {record.calories.toLocaleString("ko-KR")} kcal / 단백질{" "}
                    {formatMetric(record.proteinGrams)} g
                  </span>
                </>
              )}
              onDelete={onDeleteMealRecord}
            />
            <RecordList
              title="체중"
              icon={<Scale className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
              emptyText="체중 기록 없음"
              records={selectedWeightRecords}
              renderRecord={(record) => (
                <span className="font-semibold">
                  {formatMetric(record.weightKg)} kg
                </span>
              )}
              onDelete={onDeleteWeightRecord}
            />
          </div>
        </div>
      </div>

      {formError ? (
        <div className="shrink-0 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {formError}
        </div>
      ) : null}

      <div className="grid shrink-0 gap-3 lg:grid-cols-3">
        <form
          onSubmit={handleWorkoutSubmit}
          className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black"
        >
          <FormTitle
            icon={<Dumbbell className="h-4 w-4 text-red-600" aria-hidden="true" />}
            title="운동 기록 추가"
          />
          <FieldLabel label="날짜">
            <input
              type="date"
              value={workoutDate}
              onChange={(event) => setWorkoutDate(event.target.value)}
              className="field-input"
            />
          </FieldLabel>
          <FieldLabel label="대분류">
            <select
              value={workoutType}
              onChange={(event) => {
                setWorkoutType(event.target.value as WorkoutType);
                setFormError(null);
              }}
              className="field-input"
            >
              {workoutTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {workoutTypeLabels[type]}
                </option>
              ))}
            </select>
          </FieldLabel>
          {workoutType === "strength" ? (
            <div className="mb-2">
              <div className="mb-1 text-xs font-semibold text-slate-600 dark:text-neutral-300">
                어디
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {strengthWorkoutParts.map((part) => {
                  const isSelected = selectedStrengthParts.includes(part);

                  return (
                    <button
                      type="button"
                      key={part}
                      aria-pressed={isSelected}
                      title={part}
                      onClick={() => toggleStrengthPart(part)}
                      className={
                        isSelected
                          ? "inline-flex h-8 min-w-0 items-center justify-center rounded-md border border-teal-500 bg-teal-50 px-1 text-xs font-semibold text-teal-900 dark:border-teal-500 dark:bg-teal-950/40 dark:text-teal-100"
                          : "inline-flex h-8 min-w-0 items-center justify-center rounded-md border border-slate-300 bg-white px-1 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 dark:border-neutral-800 dark:bg-black dark:text-neutral-200 dark:hover:border-teal-800 dark:hover:bg-teal-950/30"
                      }
                    >
                      <span className="whitespace-nowrap leading-none">{part}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {workoutType === "cardio" ? (
            <FieldLabel label="유산소 종류">
              <select
                value={workoutCardioType}
                onChange={(event) => setWorkoutCardioType(event.target.value)}
                className="field-input"
              >
                {cardioWorkoutOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FieldLabel>
          ) : null}
          {workoutType === "other" ? (
            <FieldLabel label="무슨 운동">
              <input
                value={workoutExerciseName}
                onChange={(event) => setWorkoutExerciseName(event.target.value)}
                className="field-input"
                placeholder="클라이밍, 스트레칭"
              />
            </FieldLabel>
          ) : null}
          <SubmitButton label="운동 추가" />
        </form>

        <form
          onSubmit={handleMealSubmit}
          className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black"
        >
          <FormTitle
            icon={<Salad className="h-4 w-4 text-yellow-600" aria-hidden="true" />}
            title="식사 기록 추가"
          />
          <FieldLabel label="날짜">
            <input
              type="date"
              value={mealDate}
              onChange={(event) => setMealDate(event.target.value)}
              className="field-input"
            />
          </FieldLabel>
          <FieldLabel label="메뉴">
            <input
              value={mealMenu}
              onChange={(event) => setMealMenu(event.target.value)}
              className="field-input"
              placeholder="닭가슴살 샐러드"
            />
          </FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            <FieldLabel label="칼로리">
              <input
                type="number"
                min="0"
                value={mealCalories}
                onChange={(event) => setMealCalories(event.target.value)}
                className="field-input"
                placeholder="520"
              />
            </FieldLabel>
            <FieldLabel label="단백질 g">
              <input
                type="number"
                min="0"
                step="0.1"
                value={mealProteinGrams}
                onChange={(event) => setMealProteinGrams(event.target.value)}
                className="field-input"
                placeholder="42"
              />
            </FieldLabel>
          </div>
          <SubmitButton label="식사 추가" />
        </form>

        <form
          onSubmit={handleWeightSubmit}
          className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black"
        >
          <FormTitle
            icon={<Scale className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
            title="체중 기록 추가"
          />
          <FieldLabel label="날짜">
            <input
              type="date"
              value={weightDate}
              onChange={(event) => setWeightDate(event.target.value)}
              className="field-input"
            />
          </FieldLabel>
          <FieldLabel label="체중 kg">
            <input
              type="number"
              min="0"
              step="0.1"
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
              className="field-input"
              placeholder="72.1"
            />
          </FieldLabel>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            체중 단위는 V1에서 kg만 지원합니다.
          </div>
          <SubmitButton label="체중 추가" />
        </form>
      </div>
    </section>
  );
}

function FormTitle({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-neutral-50">
      {icon}
      <span>{title}</span>
    </div>
  );
}

function FieldLabel({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-neutral-300">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white transition hover:bg-teal-800"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function RecordList<T extends { id: string }>({
  emptyText,
  icon,
  onDelete,
  records,
  renderRecord,
  title,
}: {
  emptyText: string;
  icon: ReactNode;
  onDelete: (recordId: string) => void;
  records: T[];
  renderRecord: (record: T) => ReactNode;
  title: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-neutral-300">
        {icon}
        <span>{title}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
          {records.length}
        </span>
      </div>
      {records.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-1.5">
          {records.map((record) => (
            <div
              key={record.id}
              className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-800 dark:border-neutral-800 dark:text-neutral-100"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-col gap-0.5">
                  {renderRecord(record)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(record.id)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-700 dark:text-neutral-500 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                aria-label={`${title} 기록 삭제`}
                title={`${title} 기록 삭제`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
