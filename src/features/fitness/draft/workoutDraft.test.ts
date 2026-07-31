import { describe, expect, it } from "vitest";
import {
  buildWorkoutDraftSubmission,
  clearSubmittedWorkoutDraft,
  createInitialWorkoutDraft,
} from "./workoutDraft";

describe("workoutDraft", () => {
  it("requires at least one strength part", () => {
    const result = buildWorkoutDraftSubmission(createInitialWorkoutDraft());

    expect(result).toEqual({
      ok: false,
      error: "근력 기록에는 부위를 하나 이상 선택해야 합니다.",
    });
  });

  it("creates strength records in selected-part order", () => {
    const result = buildWorkoutDraftSubmission({
      ...createInitialWorkoutDraft(),
      selectedStrengthParts: ["등", "가슴"],
    });

    expect(result).toEqual({
      ok: true,
      submission: {
        kind: "batch",
        records: [
          {
            workoutType: "strength",
            category: "등",
            exerciseName: "등",
          },
          {
            workoutType: "strength",
            category: "가슴",
            exerciseName: "가슴",
          },
        ],
      },
    });
  });

  it("validates and parses cardio metrics", () => {
    const invalid = buildWorkoutDraftSubmission({
      ...createInitialWorkoutDraft(),
      workoutType: "cardio",
      durationInput: "30:00",
      averageHeartRateInput: "0",
    });
    const valid = buildWorkoutDraftSubmission({
      ...createInitialWorkoutDraft(),
      workoutType: "cardio",
      cardioType: "실내 달리기",
      durationInput: "00:30:00",
      averageHeartRateInput: "140",
    });

    expect(invalid).toEqual({
      ok: false,
      error:
        "유산소는 운동한 시간을 00:00:00 형식으로 입력해야 하고, 평균 심박수는 입력 시 0보다 커야 합니다.",
    });
    expect(valid).toEqual({
      ok: true,
      submission: {
        kind: "single",
        record: {
          workoutType: "cardio",
          category: "실내 달리기",
          exerciseName: "실내 달리기",
          metrics: {
            durationSeconds: 1800,
            averageHeartRate: 140,
          },
        },
      },
    });
  });

  it("trims other workout names and clears only submitted fields", () => {
    const draft = {
      ...createInitialWorkoutDraft(),
      workoutType: "other" as const,
      selectedStrengthParts: ["등"],
      durationInput: "00:45:00",
      averageHeartRateInput: "130",
      exerciseName: "  스트레칭  ",
    };

    expect(buildWorkoutDraftSubmission(draft)).toEqual({
      ok: true,
      submission: {
        kind: "single",
        record: {
          workoutType: "other",
          category: "기타",
          exerciseName: "스트레칭",
        },
      },
    });
    expect(clearSubmittedWorkoutDraft(draft)).toEqual({
      ...draft,
      exerciseName: "",
    });
  });
});
