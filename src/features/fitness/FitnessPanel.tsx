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
  FormTitle,
  MetricPanel,
  SubmitButton,
} from "./components/FitnessPanelPrimitives";
import {
  cardioWorkoutOptions,
  strengthWorkoutParts,
  type WorkoutRecordMetricsInput,
  workoutTypeLabels,
} from "./fitnessService";
import {
  DEFAULT_DURATION_INPUT,
  parseDurationSeconds,
  parseOptionalNumber,
  parseOptionalPositiveNumber,
  parseRequiredNumber,
  stepDurationInput,
} from "./fitnessInputParsing";
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
  const [workoutType, setWorkoutType] = useState<WorkoutType>("strength");
  const [selectedStrengthParts, setSelectedStrengthParts] = useState<string[]>(
    [],
  );
  const [workoutCardioType, setWorkoutCardioType] = useState<string>(
    cardioWorkoutOptions[0],
  );
  const [workoutDurationInput, setWorkoutDurationInput] = useState(
    DEFAULT_DURATION_INPUT,
  );
  const [workoutAverageHeartRate, setWorkoutAverageHeartRate] = useState("");
  const [workoutExerciseName, setWorkoutExerciseName] = useState("");
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

    if (workoutType === "strength") {
      if (selectedStrengthParts.length === 0) {
        setFormError("근력 기록에는 부위를 하나 이상 선택해야 합니다.");
        return;
      }

      onAddWorkoutRecords(
        selectedStrengthParts.map((part) => ({
          date: workoutDate,
            workoutType,
            category: part,
            exerciseName: part,
          })),
        getBackfillInputForDate(workoutDate),
      );
      setSelectedStrengthParts([]);
    } else if (workoutType === "cardio") {
      const durationSeconds = parseDurationSeconds(workoutDurationInput);
      const averageHeartRate = parseOptionalPositiveNumber(
        workoutAverageHeartRate,
      );

      if (!workoutCardioType) {
        setFormError("유산소 기록에는 종류가 필요합니다.");
        return;
      }

      if (
        durationSeconds === null ||
        (workoutAverageHeartRate.trim() && averageHeartRate === null)
      ) {
        setFormError("유산소는 운동한 시간을 00:00:00 형식으로 입력해야 하고, 평균 심박수는 입력 시 0보다 커야 합니다.");
        return;
      }

      onAddWorkoutRecord(
        workoutDate,
        workoutType,
        workoutCardioType,
        workoutCardioType,
        getBackfillInputForDate(workoutDate),
        {
          durationSeconds,
          averageHeartRate,
        },
      );
      setWorkoutDurationInput(DEFAULT_DURATION_INPUT);
      setWorkoutAverageHeartRate("");
    } else {
      const exerciseName = workoutExerciseName.trim();

      if (!exerciseName) {
        setFormError("기타 운동 이름이 필요합니다.");
        return;
      }

      onAddWorkoutRecord(
        workoutDate,
        workoutType,
        "기타",
        exerciseName,
        getBackfillInputForDate(workoutDate),
      );
      setWorkoutExerciseName("");
    }

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

  function handleWorkoutDurationWheel(event: WheelEvent<HTMLInputElement>) {
    event.preventDefault();

    const stepSeconds =
      event.ctrlKey || event.metaKey ? 3600 : event.shiftKey ? 60 : 1;
    const direction = event.deltaY < 0 ? 1 : -1;

    setWorkoutDurationInput((currentValue) =>
      stepDurationInput(currentValue, direction, stepSeconds),
    );
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
          {workoutIsBackfill ? (
            <p className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
              {BACKFILL_LABEL}으로 저장됩니다.
            </p>
          ) : null}
          <FieldLabel label="종류">
            <select
              value={workoutType}
              onChange={(event) => setWorkoutType(event.target.value as WorkoutType)}
              className="field-input"
            >
              {(Object.keys(workoutTypeLabels) as WorkoutType[]).map((type) => (
                <option key={type} value={type}>
                  {workoutTypeLabels[type]}
                </option>
              ))}
            </select>
          </FieldLabel>
          {workoutType === "strength" ? (
            <div className="mb-2">
              <div className="mb-1 text-xs font-semibold text-slate-600 dark:text-neutral-300">
                부위
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {strengthWorkoutParts.map((part) => {
                  const selected = selectedStrengthParts.includes(part);

                  return (
                    <button
                      key={part}
                      type="button"
                      onClick={() => toggleStrengthPart(part)}
                      className={
                        selected
                          ? "rounded-md border border-red-500 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-200"
                          : "rounded-md border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
                      }
                    >
                      {part}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {workoutType === "cardio" ? (
            <div className="space-y-2">
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
              <div className="grid grid-cols-2 gap-2">
                <FieldLabel label="운동한 시간">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="00:30:00"
                    value={workoutDurationInput}
                    onChange={(event) =>
                      setWorkoutDurationInput(event.target.value)
                    }
                    onWheel={handleWorkoutDurationWheel}
                    className="field-input"
                  />
                </FieldLabel>
                <FieldLabel label="평균 심박수">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={workoutAverageHeartRate}
                    onChange={(event) =>
                      setWorkoutAverageHeartRate(event.target.value)
                    }
                    className="field-input"
                    placeholder="140"
                  />
                </FieldLabel>
              </div>
            </div>
          ) : null}
          {workoutType === "other" ? (
            <FieldLabel label="운동명">
              <input
                value={workoutExerciseName}
                onChange={(event) => setWorkoutExerciseName(event.target.value)}
                className="field-input"
                placeholder="스트레칭"
              />
            </FieldLabel>
          ) : null}
          <SubmitButton
            label={workoutIsBackfill ? `${BACKFILL_LABEL} 저장` : "운동 추가"}
          />
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
          {mealIsBackfill ? (
            <p className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
              {BACKFILL_LABEL}으로 저장됩니다.
            </p>
          ) : null}
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
            <FieldLabel label="탄수 g">
              <input
                type="number"
                min="0"
                step="0.1"
                value={mealCarbsGrams}
                onChange={(event) => setMealCarbsGrams(event.target.value)}
                className="field-input"
                placeholder="선택"
              />
            </FieldLabel>
            <FieldLabel label="지방 g">
              <input
                type="number"
                min="0"
                step="0.1"
                value={mealFatGrams}
                onChange={(event) => setMealFatGrams(event.target.value)}
                className="field-input"
                placeholder="선택"
              />
            </FieldLabel>
          </div>
          <SubmitButton
            label={mealIsBackfill ? `${BACKFILL_LABEL} 저장` : "식사 추가"}
          />
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
          {weightIsBackfill ? (
            <p className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
              {BACKFILL_LABEL}으로 저장됩니다.
            </p>
          ) : null}
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
          <SubmitButton
            label={weightIsBackfill ? `${BACKFILL_LABEL} 저장` : "체중 추가"}
          />
        </form>
      </div>
    </section>
  );
}
