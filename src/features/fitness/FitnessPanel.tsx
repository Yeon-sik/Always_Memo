import {
  type FormEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { BarChart3, Download, Dumbbell, Salad, Scale } from "lucide-react";
import type {
  BackfillInput,
  MealRecord,
  WeightRecord,
  WorkoutRecord,
  WorkoutType,
} from "../../types";
import {
  BACKFILL_LABEL,
  createBackfillInput,
  isFutureLocalDate,
  isPastLocalDate,
} from "../../lib/dataTrust/backfillMetadata";
import { formatLocalDate, getCurrentMonthRange } from "./fitnessDate";
import {
  createFitnessExportFileName,
  createFitnessMarkdownExport,
} from "./export/fitnessMarkdownExport";
import { downloadMarkdown } from "./export/downloadMarkdown";
import {
  FieldLabel,
  MetricPanel,
} from "./components/FitnessPanelPrimitives";
import { MealRecordForm } from "./components/MealRecordForm";
import { WeightRecordForm } from "./components/WeightRecordForm";
import { WorkoutRecordForm } from "./components/WorkoutRecordForm";
import { buildWorkoutDraftSubmission } from "./draft/workoutDraft";
import { type WorkoutRecordMetricsInput } from "./fitnessService";
import {
  parseOptionalNumber,
  parseRequiredNumber,
} from "./fitnessInputParsing";
import { useWorkoutDraft } from "./hooks/useWorkoutDraft";
import { calculateFitnessStats, formatMetric } from "./stats/fitnessStats";

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
    carbsGrams?: number | null,
    fatGrams?: number | null,
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
}

type ActionPanel = "stats" | "export" | null;

// 운동 탭 컨테이너: 기록 추가 폼과 통계/내보내기 패널을 조립합니다.
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
  const today = formatLocalDate();
  const [actionPanel, setActionPanel] = useState<ActionPanel>(null);
  const [rangeStartDate, setRangeStartDate] = useState(
    currentMonthRange.startDate,
  );
  const [rangeEndDate, setRangeEndDate] = useState(currentMonthRange.endDate);
  const [workoutDate, setWorkoutDate] = useState(selectedDate);
  const workoutDraft = useWorkoutDraft();
  const [mealDate, setMealDate] = useState(selectedDate);
  const [mealMenu, setMealMenu] = useState("");
  const [mealCalories, setMealCalories] = useState("");
  const [mealProteinGrams, setMealProteinGrams] = useState("");
  const [mealCarbsGrams, setMealCarbsGrams] = useState("");
  const [mealFatGrams, setMealFatGrams] = useState("");
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
  const workoutIsBackfill = isPastLocalDate(workoutDate, today);
  const mealIsBackfill = isPastLocalDate(mealDate, today);
  const weightIsBackfill = isPastLocalDate(weightDate, today);

  function getBackfillInputForDate(date: string): BackfillInput | undefined {
    return isPastLocalDate(date, today)
      ? createBackfillInput("fitness-tab-past-date")
      : undefined;
  }

  function handleWorkoutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workoutDate) {
      setFormError("운동 기록에는 날짜가 필요합니다.");
      return;
    }

    if (isFutureLocalDate(workoutDate, today)) {
      setFormError("미래 날짜에는 실제 운동 기록을 추가할 수 없습니다.");
      return;
    }

    const result = buildWorkoutDraftSubmission(workoutDraft.draft);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    const backfillInput = getBackfillInputForDate(workoutDate);

    if (result.submission.kind === "batch") {
      onAddWorkoutRecords(
        result.submission.records.map((record) => ({
          date: workoutDate,
          workoutType: record.workoutType,
          category: record.category,
          exerciseName: record.exerciseName,
        })),
        backfillInput,
      );
    } else {
      const { record } = result.submission;
      onAddWorkoutRecord(
        workoutDate,
        record.workoutType,
        record.category,
        record.exerciseName,
        backfillInput,
        record.metrics,
      );
    }

    workoutDraft.clearSubmittedFields();
    setFormError(null);
  }

  function toggleStrengthPart(part: string) {
    workoutDraft.toggleStrengthPart(part);
    setFormError(null);
  }

  function handleWorkoutDurationWheel(event: WheelEvent<HTMLInputElement>) {
    event.preventDefault();

    const stepSeconds =
      event.ctrlKey || event.metaKey ? 3600 : event.shiftKey ? 60 : 1;
    const direction = event.deltaY < 0 ? 1 : -1;

    workoutDraft.stepDuration(direction, stepSeconds);
  }

  function handleMealSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const calories = parseRequiredNumber(mealCalories);
    const proteinGrams = parseRequiredNumber(mealProteinGrams);
    const carbsGrams = parseOptionalNumber(mealCarbsGrams);
    const fatGrams = parseOptionalNumber(mealFatGrams);

    if (
      !mealDate ||
      !mealMenu.trim() ||
      calories === null ||
      proteinGrams === null ||
      (mealCarbsGrams.trim() && carbsGrams === null) ||
      (mealFatGrams.trim() && fatGrams === null)
    ) {
      setFormError("식사 기록에는 날짜, 메뉴, 0 이상의 숫자가 필요합니다.");
      return;
    }

    if (isFutureLocalDate(mealDate, today)) {
      setFormError("미래 날짜에는 실제 식사 기록을 추가할 수 없습니다.");
      return;
    }

    onAddMealRecord(
      mealDate,
      mealMenu.trim(),
      calories,
      proteinGrams,
      carbsGrams,
      fatGrams,
      getBackfillInputForDate(mealDate),
    );
    setMealMenu("");
    setMealCalories("");
    setMealProteinGrams("");
    setMealCarbsGrams("");
    setMealFatGrams("");
    setFormError(null);
  }

  function handleWeightSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedWeightKg = Number(weightKg);

    if (!weightDate || !Number.isFinite(parsedWeightKg) || parsedWeightKg <= 0) {
      setFormError("체중 기록에는 날짜와 0보다 큰 kg 값이 필요합니다.");
      return;
    }

    if (isFutureLocalDate(weightDate, today)) {
      setFormError("미래 날짜에는 실제 체중 기록을 추가할 수 없습니다.");
      return;
    }

    onAddWeightRecord(
      weightDate,
      parsedWeightKg,
      getBackfillInputForDate(weightDate),
    );
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
            운동, 식사, 체중 기록
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
            <FieldLabel label="시작일">
              <input
                type="date"
                value={rangeStartDate}
                onChange={(event) => setRangeStartDate(event.target.value)}
                className="field-input"
              />
            </FieldLabel>
            <FieldLabel label="종료일">
              <input
                type="date"
                value={rangeEndDate}
                onChange={(event) => setRangeEndDate(event.target.value)}
                className="field-input"
              />
            </FieldLabel>
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
              <MetricPanel
                icon={<Dumbbell className="h-4 w-4 text-red-600" />}
                title="운동 총합"
                primary={`${stats.workoutTotal}개`}
              >
                {stats.workoutBySubcategory.length === 0 ? (
                  <p>기록 없음</p>
                ) : (
                  stats.workoutBySubcategory.map((item) => (
                    <p key={item.label}>
                      {item.label}: {item.count}개
                    </p>
                  ))
                )}
                {stats.backfilledWorkoutCount > 0 ? (
                  <p>
                    {BACKFILL_LABEL} {stats.backfilledWorkoutCount}건 포함
                  </p>
                ) : null}
              </MetricPanel>
              <MetricPanel
                icon={<Salad className="h-4 w-4 text-yellow-600" />}
                title="식사 평균"
                primary={`${stats.mealCount}개`}
              >
                <p>칼로리 {formatMetric(stats.averageCalories, 0)} kcal</p>
                <p>단백질 {formatMetric(stats.averageProteinGrams)} g</p>
                {stats.backfilledMealCount > 0 ? (
                  <p>
                    {BACKFILL_LABEL} {stats.backfilledMealCount}건 포함
                  </p>
                ) : null}
              </MetricPanel>
              <MetricPanel
                icon={<Scale className="h-4 w-4 text-emerald-600" />}
                title="체중 평균"
                primary={`${stats.weightCount}개`}
              >
                <p>평균 {formatMetric(stats.averageWeightKg)} kg</p>
                <p>
                  최저 {formatMetric(stats.minWeightKg)} kg / 최고{" "}
                  {formatMetric(stats.maxWeightKg)} kg
                </p>
                {stats.backfilledWeightCount > 0 ? (
                  <p>
                    {BACKFILL_LABEL} {stats.backfilledWeightCount}건 포함
                  </p>
                ) : null}
              </MetricPanel>
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
        <WorkoutRecordForm
          date={workoutDate}
          draft={workoutDraft.draft}
          isBackfill={workoutIsBackfill}
          onAverageHeartRateInputChange={
            workoutDraft.setAverageHeartRateInput
          }
          onCardioTypeChange={workoutDraft.setCardioType}
          onDateChange={setWorkoutDate}
          onDurationInputChange={workoutDraft.setDurationInput}
          onDurationWheel={handleWorkoutDurationWheel}
          onExerciseNameChange={workoutDraft.setExerciseName}
          onStrengthPartToggle={toggleStrengthPart}
          onSubmit={handleWorkoutSubmit}
          onWorkoutTypeChange={workoutDraft.setWorkoutType}
        />

        <MealRecordForm
          calories={mealCalories}
          carbsGrams={mealCarbsGrams}
          date={mealDate}
          fatGrams={mealFatGrams}
          isBackfill={mealIsBackfill}
          menu={mealMenu}
          proteinGrams={mealProteinGrams}
          onCaloriesChange={setMealCalories}
          onCarbsGramsChange={setMealCarbsGrams}
          onDateChange={setMealDate}
          onFatGramsChange={setMealFatGrams}
          onMenuChange={setMealMenu}
          onProteinGramsChange={setMealProteinGrams}
          onSubmit={handleMealSubmit}
        />

        <WeightRecordForm
          date={weightDate}
          isBackfill={weightIsBackfill}
          weightKg={weightKg}
          onDateChange={setWeightDate}
          onSubmit={handleWeightSubmit}
          onWeightKgChange={setWeightKg}
        />
      </div>
    </section>
  );
}
