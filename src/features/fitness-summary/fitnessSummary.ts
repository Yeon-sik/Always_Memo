import type {
  FitnessSummaryProjectionV2,
  LocalDataSnapshot,
  MealRecord,
  WeightRecord,
} from "../../types";
import { formatLocalDate, isWithinDateRange, parseDateInput } from "../fitness/fitnessDate";
import { formatDurationSeconds } from "../fitness/fitnessService";

export interface FitnessSummary {
  todayHasWorkout: boolean;
  recentWorkouts: FitnessSummaryProjectionV2[];
  weeklyWorkoutCount: number;
  weeklyStrengthSetSummaries: string[];
  latestWeightKg: number | null;
  previousWeightKg: number | null;
  weightDeltaKg: number | null;
  latestMeal: MealRecord | null;
  todayHasMeal: boolean;
  connection: FitnessConnectionSummary;
}

export type FitnessConnectionStatus =
  | "no_fitness_records"
  | "summary_projection_v2";

export interface FitnessConnectionSummary {
  status: FitnessConnectionStatus;
  linkedCount: number;
  quickRecordOnlyCount: number;
  possibleMismatchCount: number;
  message: string;
}

const STRENGTH_PARTS: Array<{
  key: keyof Pick<
    FitnessSummaryProjectionV2,
    | "chestSets"
    | "backSets"
    | "legsSets"
    | "shouldersSets"
    | "absSets"
    | "tricepsSets"
    | "bicepsSets"
  >;
  label: string;
}> = [
  { key: "chestSets", label: "가슴" },
  { key: "backSets", label: "등" },
  { key: "legsSets", label: "하체" },
  { key: "shouldersSets", label: "어깨" },
  { key: "absSets", label: "복부" },
  { key: "tricepsSets", label: "삼두" },
  { key: "bicepsSets", label: "이두" },
];

function isVisibleLegacyRecord(entity: {
  deletedAt: string | null;
  scope?: string;
}): boolean {
  return entity.deletedAt === null && entity.scope !== "fitness";
}

function isVisibleProjection(
  projection: FitnessSummaryProjectionV2,
): boolean {
  return (
    projection.deletedAt === null &&
    projection.completionStatus === "completed" &&
    projection.contractVersion === 2
  );
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

/**
 * Converts the v2 projection into the only workout labels Personal OS may
 * display. Exercise identity and per-set values never enter this formatter.
 */
export function formatFitnessProjectionLabels(
  projection: FitnessSummaryProjectionV2,
): string[] {
  const strengthLabels = STRENGTH_PARTS.filter(
    ({ key }) => projection[key] > 0,
  ).map(({ key, label }) => `${label} 운동 ${projection[key]}세트`);

  if (strengthLabels.length > 0) {
    return strengthLabels;
  }

  const cardioDuration =
    projection.cardioDurationSeconds ?? projection.totalDurationSeconds;
  if (cardioDuration !== null) {
    return [`유산소 ${formatDurationSeconds(cardioDuration)}`];
  }

  return ["완료 운동 요약"];
}

function getWeeklyStrengthSetSummaries(
  projections: FitnessSummaryProjectionV2[],
): string[] {
  const totals = new Map<(typeof STRENGTH_PARTS)[number]["key"], number>();

  for (const projection of projections) {
    for (const { key } of STRENGTH_PARTS) {
      const count = projection[key];
      if (count > 0) {
        totals.set(key, (totals.get(key) ?? 0) + count);
      }
    }
  }

  return [...totals.entries()]
    .sort((first, second) => {
      if (first[1] !== second[1]) {
        return second[1] - first[1];
      }
      return first[0].localeCompare(second[0]);
    })
    .slice(0, 3)
    .map(([key, count]) => {
      const label = STRENGTH_PARTS.find((part) => part.key === key)?.label ?? "기타";
      return `${label} 운동 ${count}세트`;
    });
}

function getConnectionSummary(
  snapshot: LocalDataSnapshot,
  visibleProjections: FitnessSummaryProjectionV2[],
): FitnessConnectionSummary {
  const hiddenInProgressFitnessRecords = snapshot.workoutRecords.filter(
    (record) =>
      record.deletedAt === null &&
      record.sourceApp === "fitness" &&
      record.scope === "fitness",
  ).length;

  if (visibleProjections.length === 0) {
    return {
      status: "no_fitness_records",
      linkedCount: 0,
      quickRecordOnlyCount: 0,
      possibleMismatchCount: hiddenInProgressFitnessRecords,
      message: "Personal OS에 표시할 Summary Projection v2가 없습니다.",
    };
  }

  return {
    status: "summary_projection_v2",
    linkedCount: visibleProjections.length,
    quickRecordOnlyCount: 0,
    possibleMismatchCount: hiddenInProgressFitnessRecords,
    message:
      "FitnessApp가 생성한 Summary Projection v2만 표시합니다. 원본 운동과 세트 상세는 FitnessApp에 남습니다.",
  };
}

export function getFitnessSummary(
  snapshot: LocalDataSnapshot,
  today = formatLocalDate(),
): FitnessSummary {
  const visibleProjections = sortByDateDescThenUpdatedDesc(
    snapshot.fitnessSummaryProjections.filter(isVisibleProjection),
  );
  const visibleWeights = sortByDateDescThenUpdatedDesc(
    snapshot.weightRecords.filter(isVisibleLegacyRecord),
  );
  const visibleMeals = sortByDateDescThenUpdatedDesc(
    snapshot.mealRecords.filter(isVisibleLegacyRecord),
  );
  const weekRange = getLastSevenDayRange(today);
  const weeklyWorkouts = visibleProjections.filter((record) =>
    isWithinDateRange(record.date, weekRange.startDate, weekRange.endDate),
  );
  const latestWeight = visibleWeights[0] ?? null;
  const previousWeight = visibleWeights[1] ?? null;

  return {
    todayHasWorkout: visibleProjections.some((record) => record.date === today),
    recentWorkouts: visibleProjections.slice(0, 3),
    weeklyWorkoutCount: weeklyWorkouts.length,
    weeklyStrengthSetSummaries: getWeeklyStrengthSetSummaries(weeklyWorkouts),
    latestWeightKg: latestWeight?.weightKg ?? null,
    previousWeightKg: previousWeight?.weightKg ?? null,
    weightDeltaKg:
      latestWeight && previousWeight
        ? latestWeight.weightKg - previousWeight.weightKg
        : null,
    latestMeal: visibleMeals[0] ?? null,
    todayHasMeal: visibleMeals.some((record) => record.date === today),
    connection: getConnectionSummary(snapshot, visibleProjections),
  };
}
