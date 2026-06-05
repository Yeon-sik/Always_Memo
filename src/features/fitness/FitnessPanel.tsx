import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  Dumbbell,
  Plus,
  Salad,
  Scale,
} from "lucide-react";
import type {
  MealRecord,
  WeightRecord,
  WorkoutRecord,
  WorkoutType,
} from "../../types";
import { getCurrentMonthRange } from "./fitnessDate";
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
  strengthWorkoutParts,
  workoutTypeLabels,
} from "./fitnessService";

interface FitnessPanelProps {
  mealRecords: MealRecord[];
  selectedDate: string;
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
}

type ActionPanel = "stats" | "export" | null;

const workoutTypeOptions: WorkoutType[] = ["strength", "cardio", "other"];

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
  selectedDate,
  weightRecords,
  workoutRecords,
  onAddMealRecord,
  onAddWeightRecord,
  onAddWorkoutRecord,
  onAddWorkoutRecords,
}: FitnessPanelProps) {
  const currentMonthRange = getCurrentMonthRange();
  const [actionPanel, setActionPanel] = useState<ActionPanel>(null);
  const [rangeStartDate, setRangeStartDate] = useState(
    currentMonthRange.startDate,
  );
  const [rangeEndDate, setRangeEndDate] = useState(currentMonthRange.endDate);
  const [workoutDate, setWorkoutDate] = useState(selectedDate);
  const [workoutType, setWorkoutType] = useState<WorkoutType>("strength");
  const [selectedStrengthParts, setSelectedStrengthParts] = useState<string[]>(
    [],
  );
  const [workoutCardioType, setWorkoutCardioType] = useState<string>(
    cardioWorkoutOptions[0],
  );
  const [workoutExerciseName, setWorkoutExerciseName] = useState("");
  const [mealDate, setMealDate] = useState(selectedDate);
  const [mealMenu, setMealMenu] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [mealProteinGrams, setMealProteinGrams] = useState("");
  const [weightDate, setWeightDate] = useState(selectedDate);
  const [weightKg, setWeightKg] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setWorkoutDate(selectedDate);
    setMealDate(selectedDate);
    setWeightDate(selectedDate);
  }, [selectedDate]);
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
            날짜는 각 기록 추가 폼에서 선택합니다.
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
