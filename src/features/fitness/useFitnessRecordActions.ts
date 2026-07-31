import { useCallback } from "react";

import type { SnapshotUpdater } from "../../app/sync/useSnapshotStore";
import type {
  BackfillInput,
  Device,
  MealRecord,
  WeightRecord,
  WorkoutRecord,
  WorkoutType,
} from "../../types";
import {
  createMealRecord,
  createWeightRecord,
  createWorkoutRecord,
  restoreMealRecord,
  restoreWeightRecord,
  restoreWorkoutRecord,
  softDeleteMealRecord,
  softDeleteWeightRecord,
  softDeleteWorkoutRecord,
  updateMealRecord,
  updateWeightRecord,
  updateWorkoutRecord,
  type MealRecordPatch,
  type WeightRecordPatch,
  type WorkoutRecordMetricsInput,
  type WorkoutRecordPatch,
} from "./fitnessService";

interface UseFitnessRecordActionsOptions {
  commitSnapshot: (updater: SnapshotUpdater) => void;
  device: Device | null;
}

export interface FitnessRecordActions {
  addMealRecord: (
    date: string,
    menu: string,
    calories: number,
    proteinGrams: number,
    carbsGrams?: number | null,
    fatGrams?: number | null,
    backfillInput?: BackfillInput,
  ) => void;
  addWeightRecord: (
    date: string,
    weightKg: number,
    backfillInput?: BackfillInput,
  ) => void;
  addWorkoutRecord: (
    date: string,
    workoutType: WorkoutType,
    category: string,
    exerciseName: string,
    backfillInput?: BackfillInput,
    metrics?: WorkoutRecordMetricsInput,
  ) => void;
  addWorkoutRecords: (
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
  deleteMealRecord: (recordId: string) => void;
  deleteWeightRecord: (recordId: string) => void;
  deleteWorkoutRecord: (recordId: string) => void;
  restoreMealRecord: (record: MealRecord) => void;
  restoreWeightRecord: (record: WeightRecord) => void;
  restoreWorkoutRecord: (record: WorkoutRecord) => void;
  updateMealRecord: (recordId: string, patch: MealRecordPatch) => void;
  updateWeightRecord: (recordId: string, patch: WeightRecordPatch) => void;
  updateWorkoutRecord: (recordId: string, patch: WorkoutRecordPatch) => void;
}

export function useFitnessRecordActions({
  commitSnapshot,
  device,
}: UseFitnessRecordActionsOptions): FitnessRecordActions {
  const addWorkoutRecord = useCallback(
    (
      date: string,
      workoutType: WorkoutType,
      category: string,
      exerciseName: string,
      backfillInput?: BackfillInput,
      metrics?: WorkoutRecordMetricsInput,
    ) => {
      if (!device) {
        return;
      }

      const record = createWorkoutRecord(
        date,
        workoutType,
        category,
        exerciseName,
        device.id,
        backfillInput,
        metrics,
      );
      commitSnapshot((snapshot) => ({
        ...snapshot,
        workoutRecords: [...snapshot.workoutRecords, record],
      }));
    },
    [commitSnapshot, device],
  );

  const addWorkoutRecords = useCallback(
    (
      records: Array<{
        date: string;
        workoutType: WorkoutType;
        category: string;
        exerciseName: string;
        durationSeconds?: number | null;
        averageHeartRate?: number | null;
      }>,
      backfillInput?: BackfillInput,
    ) => {
      if (!device || records.length === 0) {
        return;
      }

      const nextRecords = records.map((record) =>
        createWorkoutRecord(
          record.date,
          record.workoutType,
          record.category,
          record.exerciseName,
          device.id,
          backfillInput,
          {
            durationSeconds: record.durationSeconds,
            averageHeartRate: record.averageHeartRate,
          },
        ),
      );

      commitSnapshot((snapshot) => ({
        ...snapshot,
        workoutRecords: [...snapshot.workoutRecords, ...nextRecords],
      }));
    },
    [commitSnapshot, device],
  );

  const addMealRecord = useCallback(
    (
      date: string,
      menu: string,
      calories: number,
      proteinGrams: number,
      carbsGrams: number | null = null,
      fatGrams: number | null = null,
      backfillInput?: BackfillInput,
    ) => {
      if (!device) {
        return;
      }

      const record = createMealRecord(
        date,
        menu,
        calories,
        proteinGrams,
        device.id,
        carbsGrams,
        fatGrams,
        backfillInput,
      );
      commitSnapshot((snapshot) => ({
        ...snapshot,
        mealRecords: [...snapshot.mealRecords, record],
      }));
    },
    [commitSnapshot, device],
  );

  const addWeightRecord = useCallback(
    (date: string, weightKg: number, backfillInput?: BackfillInput) => {
      if (!device) {
        return;
      }

      const record = createWeightRecord(date, weightKg, device.id, backfillInput);
      commitSnapshot((snapshot) => ({
        ...snapshot,
        weightRecords: [...snapshot.weightRecords, record],
      }));
    },
    [commitSnapshot, device],
  );

  const updateWorkoutRecordAction = useCallback(
    (recordId: string, patch: WorkoutRecordPatch) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        workoutRecords: snapshot.workoutRecords.map((record) =>
          record.id === recordId
            ? updateWorkoutRecord(record, patch, device.id)
            : record,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const updateMealRecordAction = useCallback(
    (recordId: string, patch: MealRecordPatch) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        mealRecords: snapshot.mealRecords.map((record) =>
          record.id === recordId
            ? updateMealRecord(record, patch, device.id)
            : record,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const updateWeightRecordAction = useCallback(
    (recordId: string, patch: WeightRecordPatch) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        weightRecords: snapshot.weightRecords.map((record) =>
          record.id === recordId
            ? updateWeightRecord(record, patch, device.id)
            : record,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const deleteWorkoutRecord = useCallback(
    (recordId: string) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        workoutRecords: snapshot.workoutRecords.map((record) =>
          record.id === recordId
            ? softDeleteWorkoutRecord(record, device.id)
            : record,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const deleteMealRecord = useCallback(
    (recordId: string) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        mealRecords: snapshot.mealRecords.map((record) =>
          record.id === recordId
            ? softDeleteMealRecord(record, device.id)
            : record,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const deleteWeightRecord = useCallback(
    (recordId: string) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        weightRecords: snapshot.weightRecords.map((record) =>
          record.id === recordId
            ? softDeleteWeightRecord(record, device.id)
            : record,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const restoreWorkoutRecordAction = useCallback(
    (record: WorkoutRecord) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        workoutRecords: snapshot.workoutRecords.map((currentRecord) =>
          currentRecord.id === record.id
            ? restoreWorkoutRecord(currentRecord, device.id)
            : currentRecord,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const restoreMealRecordAction = useCallback(
    (record: MealRecord) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        mealRecords: snapshot.mealRecords.map((currentRecord) =>
          currentRecord.id === record.id
            ? restoreMealRecord(currentRecord, device.id)
            : currentRecord,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  const restoreWeightRecordAction = useCallback(
    (record: WeightRecord) => {
      if (!device) {
        return;
      }

      commitSnapshot((snapshot) => ({
        ...snapshot,
        weightRecords: snapshot.weightRecords.map((currentRecord) =>
          currentRecord.id === record.id
            ? restoreWeightRecord(currentRecord, device.id)
            : currentRecord,
        ),
      }));
    },
    [commitSnapshot, device],
  );

  return {
    addMealRecord,
    addWeightRecord,
    addWorkoutRecord,
    addWorkoutRecords,
    deleteMealRecord,
    deleteWeightRecord,
    deleteWorkoutRecord,
    restoreMealRecord: restoreMealRecordAction,
    restoreWeightRecord: restoreWeightRecordAction,
    restoreWorkoutRecord: restoreWorkoutRecordAction,
    updateMealRecord: updateMealRecordAction,
    updateWeightRecord: updateWeightRecordAction,
    updateWorkoutRecord: updateWorkoutRecordAction,
  };
}
