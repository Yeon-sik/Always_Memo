import type { LocalDataSnapshot } from "../../../types";
import { mergeDevices, mergeEntities } from "../merge";

export function mergeSnapshot(
  localSnapshot: LocalDataSnapshot,
  incomingSnapshot: LocalDataSnapshot,
): LocalDataSnapshot {
  return {
    notes: mergeEntities(localSnapshot.notes, incomingSnapshot.notes),
    tasks: mergeEntities(localSnapshot.tasks, incomingSnapshot.tasks),
    workoutRecords: mergeEntities(
      localSnapshot.workoutRecords,
      incomingSnapshot.workoutRecords,
    ),
    fitnessSummaryProjections: mergeEntities(
      localSnapshot.fitnessSummaryProjections,
      incomingSnapshot.fitnessSummaryProjections,
    ),
    mealRecords: mergeEntities(
      localSnapshot.mealRecords,
      incomingSnapshot.mealRecords,
    ),
    weightRecords: mergeEntities(
      localSnapshot.weightRecords,
      incomingSnapshot.weightRecords,
    ),
    devices: mergeDevices(localSnapshot.devices, incomingSnapshot.devices),
  };
}
