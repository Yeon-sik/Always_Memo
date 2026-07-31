import type {
  FormEventHandler,
  WheelEventHandler,
} from "react";
import { Dumbbell } from "lucide-react";
import type { WorkoutType } from "../../../types";
import { BACKFILL_LABEL } from "../../../lib/dataTrust/backfillMetadata";
import type { WorkoutDraft } from "../draft/workoutDraft";
import {
  cardioWorkoutOptions,
  strengthWorkoutParts,
  workoutTypeLabels,
} from "../fitnessService";
import {
  FieldLabel,
  FormTitle,
  SubmitButton,
} from "./FitnessPanelPrimitives";

interface WorkoutRecordFormProps {
  date: string;
  draft: WorkoutDraft;
  isBackfill: boolean;
  onAverageHeartRateInputChange: (value: string) => void;
  onCardioTypeChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onDurationInputChange: (value: string) => void;
  onDurationWheel: WheelEventHandler<HTMLInputElement>;
  onExerciseNameChange: (value: string) => void;
  onStrengthPartToggle: (part: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onWorkoutTypeChange: (value: WorkoutType) => void;
}

export function WorkoutRecordForm({
  date,
  draft,
  isBackfill,
  onAverageHeartRateInputChange,
  onCardioTypeChange,
  onDateChange,
  onDurationInputChange,
  onDurationWheel,
  onExerciseNameChange,
  onStrengthPartToggle,
  onSubmit,
  onWorkoutTypeChange,
}: WorkoutRecordFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-md border border-slate-300 bg-white p-3 dark:border-neutral-800 dark:bg-black"
    >
      <FormTitle
        icon={<Dumbbell className="h-4 w-4 text-red-600" aria-hidden="true" />}
        title="운동 기록 추가"
      />
      <FieldLabel label="날짜">
        <input
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          className="field-input"
        />
      </FieldLabel>
      {isBackfill ? (
        <p className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
          {BACKFILL_LABEL}으로 저장됩니다.
        </p>
      ) : null}
      <FieldLabel label="종류">
        <select
          value={draft.workoutType}
          onChange={(event) =>
            onWorkoutTypeChange(event.target.value as WorkoutType)
          }
          className="field-input"
        >
          {(Object.keys(workoutTypeLabels) as WorkoutType[]).map((type) => (
            <option key={type} value={type}>
              {workoutTypeLabels[type]}
            </option>
          ))}
        </select>
      </FieldLabel>
      {draft.workoutType === "strength" ? (
        <div className="mb-2">
          <div className="mb-1 text-xs font-semibold text-slate-600 dark:text-neutral-300">
            부위
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {strengthWorkoutParts.map((part) => {
              const selected = draft.selectedStrengthParts.includes(part);

              return (
                <button
                  key={part}
                  type="button"
                  onClick={() => onStrengthPartToggle(part)}
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
      {draft.workoutType === "cardio" ? (
        <div className="space-y-2">
          <FieldLabel label="유산소 종류">
            <select
              value={draft.cardioType}
              onChange={(event) => onCardioTypeChange(event.target.value)}
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
                value={draft.durationInput}
                onChange={(event) => onDurationInputChange(event.target.value)}
                onWheel={onDurationWheel}
                className="field-input"
              />
            </FieldLabel>
            <FieldLabel label="평균 심박수">
              <input
                type="number"
                min="1"
                step="1"
                value={draft.averageHeartRateInput}
                onChange={(event) =>
                  onAverageHeartRateInputChange(event.target.value)
                }
                className="field-input"
                placeholder="140"
              />
            </FieldLabel>
          </div>
        </div>
      ) : null}
      {draft.workoutType === "other" ? (
        <FieldLabel label="운동명">
          <input
            value={draft.exerciseName}
            onChange={(event) => onExerciseNameChange(event.target.value)}
            className="field-input"
            placeholder="스트레칭"
          />
        </FieldLabel>
      ) : null}
      <SubmitButton
        label={isBackfill ? `${BACKFILL_LABEL} 저장` : "운동 추가"}
      />
    </form>
  );
}
