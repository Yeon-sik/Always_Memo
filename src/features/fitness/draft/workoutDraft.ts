import type { WorkoutType } from "../../../types";
import type { WorkoutRecordMetricsInput } from "../fitnessService";
import { cardioWorkoutOptions } from "../fitnessService";
import {
  DEFAULT_DURATION_INPUT,
  parseDurationSeconds,
  parseOptionalPositiveNumber,
} from "../fitnessInputParsing";

export interface WorkoutDraft {
  workoutType: WorkoutType;
  selectedStrengthParts: string[];
  cardioType: string;
  durationInput: string;
  averageHeartRateInput: string;
  exerciseName: string;
}

export interface WorkoutDraftRecordInput {
  workoutType: WorkoutType;
  category: string;
  exerciseName: string;
  metrics?: WorkoutRecordMetricsInput;
}

export type WorkoutDraftSubmission =
  | {
      kind: "batch";
      records: WorkoutDraftRecordInput[];
    }
  | {
      kind: "single";
      record: WorkoutDraftRecordInput;
    };

export type WorkoutDraftValidationResult =
  | { ok: true; submission: WorkoutDraftSubmission }
  | { ok: false; error: string };

export function createInitialWorkoutDraft(): WorkoutDraft {
  return {
    workoutType: "strength",
    selectedStrengthParts: [],
    cardioType: cardioWorkoutOptions[0] ?? "",
    durationInput: DEFAULT_DURATION_INPUT,
    averageHeartRateInput: "",
    exerciseName: "",
  };
}

export function buildWorkoutDraftSubmission(
  draft: WorkoutDraft,
): WorkoutDraftValidationResult {
  if (draft.workoutType === "strength") {
    if (draft.selectedStrengthParts.length === 0) {
      return {
        ok: false,
        error: "근력 기록에는 부위를 하나 이상 선택해야 합니다.",
      };
    }

    return {
      ok: true,
      submission: {
        kind: "batch",
        records: draft.selectedStrengthParts.map((part) => ({
          workoutType: draft.workoutType,
          category: part,
          exerciseName: part,
        })),
      },
    };
  }

  if (draft.workoutType === "cardio") {
    const durationSeconds = parseDurationSeconds(draft.durationInput);
    const averageHeartRate = parseOptionalPositiveNumber(
      draft.averageHeartRateInput,
    );

    if (!draft.cardioType) {
      return {
        ok: false,
        error: "유산소 기록에는 종류가 필요합니다.",
      };
    }

    if (
      durationSeconds === null ||
      (draft.averageHeartRateInput.trim() && averageHeartRate === null)
    ) {
      return {
        ok: false,
        error:
          "유산소는 운동한 시간을 00:00:00 형식으로 입력해야 하고, 평균 심박수는 입력 시 0보다 커야 합니다.",
      };
    }

    return {
      ok: true,
      submission: {
        kind: "single",
        record: {
          workoutType: draft.workoutType,
          category: draft.cardioType,
          exerciseName: draft.cardioType,
          metrics: {
            durationSeconds,
            averageHeartRate,
          },
        },
      },
    };
  }

  const exerciseName = draft.exerciseName.trim();

  if (!exerciseName) {
    return {
      ok: false,
      error: "기타 운동 이름이 필요합니다.",
    };
  }

  return {
    ok: true,
    submission: {
      kind: "single",
      record: {
        workoutType: draft.workoutType,
        category: "기타",
        exerciseName,
      },
    },
  };
}

export function clearSubmittedWorkoutDraft(draft: WorkoutDraft): WorkoutDraft {
  if (draft.workoutType === "strength") {
    return {
      ...draft,
      selectedStrengthParts: [],
    };
  }

  if (draft.workoutType === "cardio") {
    return {
      ...draft,
      durationInput: DEFAULT_DURATION_INPUT,
      averageHeartRateInput: "",
    };
  }

  return {
    ...draft,
    exerciseName: "",
  };
}
