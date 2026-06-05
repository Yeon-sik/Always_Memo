import type { MealRecord, WeightRecord, WorkoutRecord } from "../../../types";
import { formatKoreanDate, isWithinDateRange } from "../fitnessDate";
import { calculateFitnessStats, formatMetric } from "../stats/fitnessStats";

interface FitnessExportInput {
  workoutRecords: WorkoutRecord[];
  mealRecords: MealRecord[];
  weightRecords: WeightRecord[];
  startDate: string;
  endDate: string;
}

function groupByDate<T extends { date: string }>(records: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const record of records) {
    const current = grouped.get(record.date) ?? [];
    current.push(record);
    grouped.set(record.date, current);
  }

  return new Map(
    Array.from(grouped.entries()).sort(([firstDate], [secondDate]) =>
      firstDate.localeCompare(secondDate),
    ),
  );
}

function appendEmptyAwareSection<T extends { date: string }>(
  lines: string[],
  title: string,
  records: T[],
  renderRecord: (record: T) => string,
): void {
  lines.push(`## ${title}`, "");

  if (records.length === 0) {
    lines.push("- 기록 없음", "");
    return;
  }

  for (const [date, dateRecords] of groupByDate(records)) {
    lines.push(`### ${formatKoreanDate(date)}`, "");

    for (const record of dateRecords) {
      lines.push(renderRecord(record));
    }

    lines.push("");
  }
}

export function createFitnessExportFileName(
  startDate: string,
  endDate: string,
): string {
  return `yeonsik-fitness-report-${startDate.split("-").join("")}-${endDate
    .split("-")
    .join("")}.md`;
}

export function createFitnessMarkdownExport({
  workoutRecords,
  mealRecords,
  weightRecords,
  startDate,
  endDate,
}: FitnessExportInput): string {
  const rangedWorkouts = workoutRecords.filter((record) =>
    isWithinDateRange(record.date, startDate, endDate),
  );
  const rangedMeals = mealRecords.filter((record) =>
    isWithinDateRange(record.date, startDate, endDate),
  );
  const rangedWeights = weightRecords.filter((record) =>
    isWithinDateRange(record.date, startDate, endDate),
  );
  const stats = calculateFitnessStats(
    workoutRecords,
    mealRecords,
    weightRecords,
    startDate,
    endDate,
  );
  const lines: string[] = [
    "# 운동 기록 리포트",
    "",
    `기간: ${startDate} ~ ${endDate}`,
    "",
    "## 요약",
    "",
    `- 운동 기록: ${stats.workoutTotal}회`,
    `- 식사 기록: ${stats.mealCount}개`,
    `- 평균 칼로리: ${formatMetric(stats.averageCalories, 0)} kcal`,
    `- 평균 단백질: ${formatMetric(stats.averageProteinGrams)} g`,
    `- 체중 기록: ${stats.weightCount}개`,
    `- 평균 체중: ${formatMetric(stats.averageWeightKg)} kg`,
    `- 최저 체중: ${formatMetric(stats.minWeightKg)} kg`,
    `- 최고 체중: ${formatMetric(stats.maxWeightKg)} kg`,
    "",
  ];

  if (stats.workoutByCategory.length > 0) {
    lines.push("### 운동 카테고리별 총합", "");

    for (const item of stats.workoutByCategory) {
      lines.push(`- ${item.category}: ${item.count}회`);
    }

    lines.push("");
  }

  appendEmptyAwareSection(
    lines,
    "운동",
    rangedWorkouts,
    (record) => `- ${record.category}: ${record.exerciseName}`,
  );
  appendEmptyAwareSection(
    lines,
    "식사",
    rangedMeals,
    (record) =>
      `- ${record.menu}, ${record.calories.toLocaleString("ko-KR")} kcal, 단백질 ${formatMetric(
        record.proteinGrams,
      )} g`,
  );
  appendEmptyAwareSection(
    lines,
    "체중",
    rangedWeights,
    (record) => `- ${formatMetric(record.weightKg)} kg`,
  );

  return `${lines.join("\n").trim()}\n`;
}
