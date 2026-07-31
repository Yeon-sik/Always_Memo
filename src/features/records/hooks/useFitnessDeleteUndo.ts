import { useEffect, useReducer, useRef } from "react";
import type { MealRecord, WeightRecord, WorkoutRecord } from "../../../types";
import type { PendingFitnessDelete } from "../recordDeleteUndo";

export type FitnessDeleteUndoAction =
  | {
      type: "schedule";
      pendingDelete: NonNullable<PendingFitnessDelete>;
    }
  | { type: "clear" };

export function fitnessDeleteUndoReducer(
  _state: PendingFitnessDelete,
  action: FitnessDeleteUndoAction,
): PendingFitnessDelete {
  return action.type === "schedule" ? action.pendingDelete : null;
}

interface UseFitnessDeleteUndoOptions {
  onDeleteMealRecord: (recordId: string) => void;
  onDeleteWeightRecord: (recordId: string) => void;
  onDeleteWorkoutRecord: (recordId: string) => void;
  onRestoreMealRecord: (record: MealRecord) => void;
  onRestoreWeightRecord: (record: WeightRecord) => void;
  onRestoreWorkoutRecord: (record: WorkoutRecord) => void;
}

export function useFitnessDeleteUndo({
  onDeleteMealRecord,
  onDeleteWeightRecord,
  onDeleteWorkoutRecord,
  onRestoreMealRecord,
  onRestoreWeightRecord,
  onRestoreWorkoutRecord,
}: UseFitnessDeleteUndoOptions) {
  const undoTimerRef = useRef<number | null>(null);
  const [pendingFitnessDelete, dispatch] = useReducer(
    fitnessDeleteUndoReducer,
    null,
  );

  useEffect(
    () => () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    },
    [],
  );

  function scheduleFitnessDeleteUndo(
    nextDelete: NonNullable<PendingFitnessDelete>,
  ) {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
    }

    dispatch({ type: "schedule", pendingDelete: nextDelete });
    undoTimerRef.current = window.setTimeout(() => {
      dispatch({ type: "clear" });
      undoTimerRef.current = null;
    }, 5_000);
  }

  function handleUndoFitnessDelete() {
    if (!pendingFitnessDelete) {
      return;
    }

    if (pendingFitnessDelete.type === "workout") {
      onRestoreWorkoutRecord(pendingFitnessDelete.record);
    } else if (pendingFitnessDelete.type === "meal") {
      onRestoreMealRecord(pendingFitnessDelete.record);
    } else {
      onRestoreWeightRecord(pendingFitnessDelete.record);
    }

    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    dispatch({ type: "clear" });
  }

  function deleteWorkout(record: WorkoutRecord) {
    onDeleteWorkoutRecord(record.id);
    scheduleFitnessDeleteUndo({ type: "workout", record });
  }

  function deleteMeal(record: MealRecord) {
    onDeleteMealRecord(record.id);
    scheduleFitnessDeleteUndo({ type: "meal", record });
  }

  function deleteWeight(record: WeightRecord) {
    onDeleteWeightRecord(record.id);
    scheduleFitnessDeleteUndo({ type: "weight", record });
  }

  return {
    deleteMeal,
    deleteWeight,
    deleteWorkout,
    handleUndoFitnessDelete,
    pendingFitnessDelete,
  };
}
