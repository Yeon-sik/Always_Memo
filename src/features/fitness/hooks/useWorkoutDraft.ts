import { useCallback, useState } from "react";
import type { WorkoutType } from "../../../types";
import { stepDurationInput } from "../fitnessInputParsing";
import {
  clearSubmittedWorkoutDraft,
  createInitialWorkoutDraft,
  type WorkoutDraft,
} from "../draft/workoutDraft";

export interface WorkoutDraftController {
  draft: WorkoutDraft;
  clearSubmittedFields: () => void;
  setAverageHeartRateInput: (value: string) => void;
  setCardioType: (value: string) => void;
  setDurationInput: (value: string) => void;
  setExerciseName: (value: string) => void;
  setWorkoutType: (value: WorkoutType) => void;
  stepDuration: (direction: 1 | -1, stepSeconds: number) => void;
  toggleStrengthPart: (part: string) => void;
}

export function useWorkoutDraft(): WorkoutDraftController {
  const [draft, setDraft] = useState<WorkoutDraft>(createInitialWorkoutDraft);

  const setWorkoutType = useCallback((workoutType: WorkoutType) => {
    setDraft((current) => ({ ...current, workoutType }));
  }, []);

  const toggleStrengthPart = useCallback((part: string) => {
    setDraft((current) => ({
      ...current,
      selectedStrengthParts: current.selectedStrengthParts.includes(part)
        ? current.selectedStrengthParts.filter(
            (currentPart) => currentPart !== part,
          )
        : [...current.selectedStrengthParts, part],
    }));
  }, []);

  const setCardioType = useCallback((cardioType: string) => {
    setDraft((current) => ({ ...current, cardioType }));
  }, []);

  const setDurationInput = useCallback((durationInput: string) => {
    setDraft((current) => ({ ...current, durationInput }));
  }, []);

  const stepDuration = useCallback(
    (direction: 1 | -1, stepSeconds: number) => {
      setDraft((current) => ({
        ...current,
        durationInput: stepDurationInput(
          current.durationInput,
          direction,
          stepSeconds,
        ),
      }));
    },
    [],
  );

  const setAverageHeartRateInput = useCallback(
    (averageHeartRateInput: string) => {
      setDraft((current) => ({ ...current, averageHeartRateInput }));
    },
    [],
  );

  const setExerciseName = useCallback((exerciseName: string) => {
    setDraft((current) => ({ ...current, exerciseName }));
  }, []);

  const clearSubmittedFields = useCallback(() => {
    setDraft(clearSubmittedWorkoutDraft);
  }, []);

  return {
    draft,
    clearSubmittedFields,
    setAverageHeartRateInput,
    setCardioType,
    setDurationInput,
    setExerciseName,
    setWorkoutType,
    stepDuration,
    toggleStrengthPart,
  };
}
