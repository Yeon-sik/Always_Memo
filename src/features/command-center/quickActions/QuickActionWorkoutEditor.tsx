import { type FormEvent, type WheelEvent, useState } from "react";
import { Dumbbell, Plus } from "lucide-react";
import type { BackfillInput, WorkoutType } from "../../../types";
import {
  cardioWorkoutOptions,
  strengthWorkoutParts,
  type WorkoutRecordMetricsInput,
  workoutTypeLabels,
} from "../../fitness/fitnessService";
import {
  DEFAULT_DURATION_INPUT,
  parseDurationSeconds,
  parseOptionalPositiveNumber,
  stepDurationInput,
} from "../../fitness/fitnessInputParsing";

interface QuickActionWorkoutEditorProps {
  backfillInput?: BackfillInput;
  disabled?: boolean;
  selectedDate: string;
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

const inputClassName =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-neutral-800 dark:bg-black dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:disabled:bg-neutral-950 dark:disabled:text-neutral-600";

export function QuickActionWorkoutEditor({
  backfillInput,
  disabled = false,
  selectedDate,
  onAddWorkoutRecord,
  onAddWorkoutRecords,
}: QuickActionWorkoutEditorProps) {
  const [workoutType, setWorkoutType] = useState<WorkoutType>("strength");
  const [selectedStrengthParts, setSelectedStrengthParts] = useState<string[]>([]);
  const [workoutCardioType, setWorkoutCardioType] = useState<string>(
    cardioWorkoutOptions[0] ?? "",
  );
  const [workoutDurationInput, setWorkoutDurationInput] = useState(
    DEFAULT_DURATION_INPUT,
  );
  const [workoutAverageHeartRate, setWorkoutAverageHeartRate] = useState("");
  const [workoutExerciseName, setWorkoutExerciseName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  function toggleStrengthPart(part: string) {
    if (disabled) {
      return;
    }

    setSelectedStrengthParts((currentParts) =>
      currentParts.includes(part)
        ? currentParts.filter((currentPart) => currentPart !== part)
        : [...currentParts, part],
    );
    setError(null);
    setSavedMessage(null);
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled) {
      setError("미래 날짜에는 실제 운동 기록을 추가할 수 없습니다.");
      return;
    }

    if (workoutType === "strength") {
      if (selectedStrengthParts.length === 0) {
        setError("근력 기록에는 부위를 하나 이상 선택해야 합니다.");
        return;
      }

      onAddWorkoutRecords(
        selectedStrengthParts.map((part) => ({
          date: selectedDate,
          workoutType,
          category: part,
          exerciseName: part,
        })),
        backfillInput,
      );
      setSelectedStrengthParts([]);
    } else if (workoutType === "cardio") {
      const durationSeconds = parseDurationSeconds(workoutDurationInput);
      const averageHeartRate = parseOptionalPositiveNumber(
        workoutAverageHeartRate,
      );

      if (!workoutCardioType) {
        setError("유산소 기록에는 종류가 필요합니다.");
        return;
      }

      if (
        durationSeconds === null ||
        (workoutAverageHeartRate.trim() && averageHeartRate === null)
      ) {
        setError("유산소 시간은 00:00:00 형식이어야 하고, 평균 심박수는 입력 시 0보다 커야 합니다.");
        return;
      }

      onAddWorkoutRecord(
        selectedDate,
        workoutType,
        workoutCardioType,
        workoutCardioType,
        backfillInput,
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
        setError("기타 운동 이름이 필요합니다.");
        return;
      }

      onAddWorkoutRecord(
        selectedDate,
        workoutType,
        "기타",
        exerciseName,
        backfillInput,
      );
      setWorkoutExerciseName("");
    }

    setError(null);
    setSavedMessage("운동 기록을 추가했습니다.");
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
        <Dumbbell className="h-4 w-4 text-red-600" aria-hidden="true" />
        <span>운동 추가</span>
      </div>

      {disabled ? (
        <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-neutral-400">
          미래 날짜에는 실제 수행 기록을 추가하지 않습니다.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-2">
        <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300">
          종류
          <select
            value={workoutType}
            onChange={(event) => {
              setWorkoutType(event.target.value as WorkoutType);
              setError(null);
              setSavedMessage(null);
            }}
            className={`${inputClassName} mt-1`}
            disabled={disabled}
          >
            {(Object.keys(workoutTypeLabels) as WorkoutType[]).map((type) => (
              <option key={type} value={type}>
                {workoutTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>

        {workoutType === "strength" ? (
          <div>
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
                    disabled={disabled}
                    className={
                      selected
                        ? "rounded-md border border-red-500 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700 disabled:cursor-not-allowed dark:bg-red-950/30 dark:text-red-200"
                        : "rounded-md border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:disabled:bg-neutral-950 dark:disabled:text-neutral-600"
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
          <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300">
            유산소 종류
            <select
              value={workoutCardioType}
              onChange={(event) => {
                setWorkoutCardioType(event.target.value);
                setError(null);
                setSavedMessage(null);
              }}
              className={`${inputClassName} mt-1`}
              disabled={disabled}
            >
              {cardioWorkoutOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300">
                운동 시간
                <input
                  type="time"
                  step="1"
                  value={workoutDurationInput}
                  onChange={(event) => {
                    setWorkoutDurationInput(event.target.value);
                    setError(null);
                    setSavedMessage(null);
                  }}
                  onWheel={handleWorkoutDurationWheel}
                  className={`${inputClassName} mt-1`}
                  disabled={disabled}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300">
                평균 심박수
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={workoutAverageHeartRate}
                  onChange={(event) => {
                    setWorkoutAverageHeartRate(event.target.value);
                    setError(null);
                    setSavedMessage(null);
                  }}
                  className={`${inputClassName} mt-1`}
                  placeholder="140"
                  disabled={disabled}
                />
              </label>
            </div>
          </div>
        ) : null}

        {workoutType === "other" ? (
          <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-300">
            운동명
            <input
              value={workoutExerciseName}
              onChange={(event) => {
                setWorkoutExerciseName(event.target.value);
                setError(null);
                setSavedMessage(null);
              }}
              className={`${inputClassName} mt-1`}
              placeholder="스트레칭"
              disabled={disabled}
            />
          </label>
        ) : null}

        {error ? (
          <div className="text-xs text-red-600 dark:text-red-300">{error}</div>
        ) : null}
        {savedMessage ? (
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {savedMessage}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-red-700 px-3 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {backfillInput ? "누락 보강 저장" : "운동 추가"}
        </button>
      </form>
    </section>
  );
}
