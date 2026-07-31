import type {
  LocalDataSnapshot,
  MealRecord,
  WeightRecord,
  WorkoutRecord,
} from "../../types";
import { formatLocalDate, isWithinDateRange, parseDateInput } from "../fitness/fitnessDate";
import { getWorkoutSubcategoryLabel } from "../fitness/fitnessService";

export interface FitnessSummary {
  todayHasWorkout: boolean;
  recentWorkouts: WorkoutRecord[];
  weeklyWorkoutCount: number;
  weeklyTopExercises: string[];
  latestWeightKg: number | null;
  previousWeightKg: number | null;
  weightDeltaKg: number | null;
  latestMeal: MealRecord | null;
  todayHasMeal: boolean;
  connection: FitnessConnectionSummary;
}

export type FitnessConnectionStatus =
  | "no_fitness_records"
  | "shared_workout_records";

export interface FitnessConnectionSummary {
  status: FitnessConnectionStatus;
  linkedCount: number;
  quickRecordOnlyCount: number;
  possibleMismatchCount: number;
  message: string;
}

function isVisible(entity: { deletedAt: string | null; scope?: string }): boolean {
  return entity.deletedAt === null && entity.scope !== "fitness";
}

function sortByDateDescThenUpdatedDesc<T extends { date: string; updatedAt: string }>(
  records: T[],
): T[] {
  return [...records].sort((first, second) => {
    if (first.date !== second.date) {
      return second.date.localeCompare(first.date);
    }

    return second.updatedAt.localeCompare(first.updatedAt);
  });
}

function getLastSevenDayRange(today: string): { startDate: string; endDate: string } {
  const end = parseDateInput(today);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  return {
    startDate: formatLocalDate(start),
    endDate: today,
  };
}

function getExerciseLabel(record: WorkoutRecord): string {
  return getWorkoutSubcategoryLabel(record);
}

function getTopExerciseLabels(records: WorkoutRecord[]): string[] {
  const counts = new Map<string, number>();

  for (const record of records) {
    const label = getExerciseLabel(record);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, 3)
    .map(([label, count]) => (count > 1 ? `${label} x${count}` : label));
}

function getConnectionSummary(snapshot: LocalDataSnapshot): FitnessConnectionSummary {
  const visibleWorkouts = snapshot.workoutRecords.filter(isVisible);
  const hiddenInProgressFitnessRecords = snapshot.workoutRecords.filter(
    (record) =>
      record.deletedAt === null &&
      record.sourceApp === "fitness" &&
      record.scope === "fitness",
  ).length;

  if (visibleWorkouts.length === 0) {
    return {
      status: "no_fitness_records",
      linkedCount: 0,
      quickRecordOnlyCount: 0,
      possibleMismatchCount: hiddenInProgressFitnessRecords,
      message: "Personal OS에 표시할 완료 운동 기록이 없습니다.",
    };
  }

  return {
    status: "shared_workout_records",
    linkedCount: visibleWorkouts.length,
    quickRecordOnlyCount: visibleWorkouts.filter(
      (record) => record.sourceApp !== "fitness",
    ).length,
    possibleMismatchCount: hiddenInProgressFitnessRecords,
    message:
      "양쪽 앱이 같은 workout_records ID를 사용합니다. FitnessApp 세트 상세는 Personal OS 요약에 노출하지 않습니다.",
  };
}

export function getFitnessSummary(
  snapshot: LocalDataSnapshot,
  today = formatLocalDate(),
): FitnessSummary {
  const visibleWorkouts = sortByDateDescThenUpdatedDesc(
    snapshot.workoutRecords.filter(isVisible),
  );
  const visibleWeights = sortByDateDescThenUpdatedDesc(
    snapshot.weightRecords.filter(isVisible),
  );
  const visibleMeals = sortByDateDescThenUpdatedDesc(
    snapshot.mealRecords.filter(isVisible),
  );
  const weekRange = getLastSevenDayRange(today);
  const weeklyWorkouts = visibleWorkouts.filter((record) =>
    isWithinDateRange(record.date, weekRange.startDate, weekRange.endDate),
  );
  const latestWeight = visibleWeights[0] ?? null;
  const previousWeight = visibleWeights[1] ?? null;

  return {
    todayHasWorkout: visibleWorkouts.some((record) => record.date === today),
    recentWorkouts: visibleWorkouts.slice(0, 3),
    weeklyWorkoutCount: weeklyWorkouts.length,
    weeklyTopExercises: getTopExerciseLabels(weeklyWorkouts),
    latestWeightKg: latestWeight?.weightKg ?? null,
    previousWeightKg: previousWeight?.weightKg ?? null,
    weightDeltaKg:
      latestWeight && previousWeight
        ? latestWeight.weightKg - previousWeight.weightKg
        : null,
    latestMeal: visibleMeals[0] ?? null,
    todayHasMeal: visibleMeals.some((record) => record.date === today),
    connection: getConnectionSummary(snapshot),
  };
}
