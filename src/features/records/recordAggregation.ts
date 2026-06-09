import type {
  LocalDataSnapshot,
  MealRecord,
  Note,
  Task,
  WeightRecord,
  WorkoutRecord,
} from "../../types";
import { formatLocalDate, isWithinDateRange, parseDateInput } from "../fitness/fitnessDate";

export type LocalDateString = string;

export interface DateRange {
  startDate: LocalDateString;
  endDate: LocalDateString;
}

export interface CalendarMarkerSet {
  notes: boolean;
  tasks: boolean;
  workouts: boolean;
  meals: boolean;
  weights: boolean;
}

export type CalendarMarkers = Record<LocalDateString, CalendarMarkerSet>;

export interface DateRecords {
  notes: Note[];
  tasks: Task[];
  workoutRecords: WorkoutRecord[];
  mealRecords: MealRecord[];
  weightRecords: WeightRecord[];
}

export interface DashboardStats {
  productivityScore: number | null;
  completedTasks: number;
  totalTasks: number;
  averageCalories: number | null;
  averageProteinGrams: number | null;
  weightDeltaKg: number | null;
  latestWeightKg: number | null;
}

export interface ProductivityPoint {
  date: LocalDateString;
  completedTasks: number;
  totalTasks: number;
}

export interface NutritionPoint {
  date: LocalDateString;
  averageCalories: number | null;
  averageProteinGrams: number | null;
}

export interface WeightPoint {
  date: LocalDateString;
  weightKg: number;
}

function isVisibleEntity(entity: { deletedAt: string | null }): boolean {
  return entity.deletedAt === null;
}

function toLocalDateFromTimestamp(value: string): LocalDateString | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatLocalDate(date);
}

function getTaskActivityDate(task: Task): LocalDateString | null {
  return task.dueDate ?? toLocalDateFromTimestamp(task.updatedAt);
}

function isDateInRange(date: string | null, range: DateRange): boolean {
  return Boolean(date && isWithinDateRange(date, range.startDate, range.endDate));
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sortTasksBySchedule(first: Task, second: Task): number {
  const firstDate = getTaskActivityDate(first) ?? "9999-12-31";
  const secondDate = getTaskActivityDate(second) ?? "9999-12-31";

  if (firstDate !== secondDate) {
    return firstDate.localeCompare(secondDate);
  }

  const firstTime = first.dueTime ?? "99:99";
  const secondTime = second.dueTime ?? "99:99";

  if (firstTime !== secondTime) {
    return firstTime.localeCompare(secondTime);
  }

  return first.orderIndex - second.orderIndex;
}

function sortByDateThenUpdatedAt<T extends { date: string; updatedAt: string }>(
  records: T[],
): T[] {
  return [...records].sort((first, second) => {
    if (first.date !== second.date) {
      return first.date.localeCompare(second.date);
    }

    return first.updatedAt.localeCompare(second.updatedAt);
  });
}

function getDateRangeDays(range: DateRange): LocalDateString[] {
  const start = parseDateInput(range.startDate);
  const end = parseDateInput(range.endDate);

  if (start > end) {
    return [];
  }

  const days: LocalDateString[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function emptyMarkerSet(): CalendarMarkerSet {
  return {
    notes: false,
    tasks: false,
    workouts: false,
    meals: false,
    weights: false,
  };
}

function ensureMarker(
  markers: CalendarMarkers,
  date: LocalDateString,
): CalendarMarkerSet {
  const marker = markers[date] ?? emptyMarkerSet();
  markers[date] = marker;
  return marker;
}

export function getMonthRange(date: LocalDateString): DateRange {
  const parsedDate = parseDateInput(date);
  const start = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1);
  const end = new Date(parsedDate.getFullYear(), parsedDate.getMonth() + 1, 0);

  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
  };
}

export function getRecordsForDate(
  snapshot: LocalDataSnapshot,
  date: LocalDateString,
): DateRecords {
  return {
    notes: snapshot.notes
      .filter(isVisibleEntity)
      .filter((note) => toLocalDateFromTimestamp(note.updatedAt) === date)
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)),
    tasks: snapshot.tasks
      .filter(isVisibleEntity)
      .filter((task) => task.dueDate === date)
      .sort(sortTasksBySchedule),
    workoutRecords: sortByDateThenUpdatedAt(
      snapshot.workoutRecords
        .filter(isVisibleEntity)
        .filter((record) => record.date === date),
    ),
    mealRecords: sortByDateThenUpdatedAt(
      snapshot.mealRecords
        .filter(isVisibleEntity)
        .filter((record) => record.date === date),
    ),
    weightRecords: sortByDateThenUpdatedAt(
      snapshot.weightRecords
        .filter(isVisibleEntity)
        .filter((record) => record.date === date),
    ),
  };
}

export function getDashboardStats(
  snapshot: LocalDataSnapshot,
  range: DateRange,
): DashboardStats {
  const rangedTasks = snapshot.tasks
    .filter(isVisibleEntity)
    .filter((task) => isDateInRange(getTaskActivityDate(task), range));
  const rangedMeals = snapshot.mealRecords
    .filter(isVisibleEntity)
    .filter((record) => isWithinDateRange(record.date, range.startDate, range.endDate));
  const rangedWeights = sortByDateThenUpdatedAt(
    snapshot.weightRecords
      .filter(isVisibleEntity)
      .filter((record) => isWithinDateRange(record.date, range.startDate, range.endDate)),
  );
  const completedTasks = rangedTasks.filter((task) => task.isDone).length;
  const totalTasks = rangedTasks.length;
  const firstWeight = rangedWeights[0];
  const latestWeight = rangedWeights[rangedWeights.length - 1];

  return {
    productivityScore:
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : null,
    completedTasks,
    totalTasks,
    averageCalories: average(rangedMeals.map((record) => record.calories)),
    averageProteinGrams: average(rangedMeals.map((record) => record.proteinGrams)),
    weightDeltaKg:
      firstWeight && latestWeight
        ? latestWeight.weightKg - firstWeight.weightKg
        : null,
    latestWeightKg: latestWeight?.weightKg ?? null,
  };
}

export function getCalendarMarkers(
  snapshot: LocalDataSnapshot,
  month: LocalDateString,
): CalendarMarkers {
  const range = getMonthRange(month);
  const markers: CalendarMarkers = {};

  for (const note of snapshot.notes.filter(isVisibleEntity)) {
    const date = toLocalDateFromTimestamp(note.updatedAt);

    if (isDateInRange(date, range)) {
      ensureMarker(markers, date as LocalDateString).notes = true;
    }
  }

  for (const task of snapshot.tasks.filter(isVisibleEntity)) {
    if (isDateInRange(task.dueDate, range)) {
      ensureMarker(markers, task.dueDate as LocalDateString).tasks = true;
    }
  }

  for (const record of snapshot.workoutRecords.filter(isVisibleEntity)) {
    if (isWithinDateRange(record.date, range.startDate, range.endDate)) {
      ensureMarker(markers, record.date).workouts = true;
    }
  }

  for (const record of snapshot.mealRecords.filter(isVisibleEntity)) {
    if (isWithinDateRange(record.date, range.startDate, range.endDate)) {
      ensureMarker(markers, record.date).meals = true;
    }
  }

  for (const record of snapshot.weightRecords.filter(isVisibleEntity)) {
    if (isWithinDateRange(record.date, range.startDate, range.endDate)) {
      ensureMarker(markers, record.date).weights = true;
    }
  }

  return markers;
}

export function getProductivitySeries(
  tasks: Task[],
  range: DateRange,
): ProductivityPoint[] {
  const visibleTasks = tasks.filter(isVisibleEntity);

  return getDateRangeDays(range).map((date) => {
    const dateTasks = visibleTasks.filter((task) => getTaskActivityDate(task) === date);

    return {
      date,
      completedTasks: dateTasks.filter((task) => task.isDone).length,
      totalTasks: dateTasks.length,
    };
  });
}

export function getNutritionSeries(
  meals: MealRecord[],
  range: DateRange,
): NutritionPoint[] {
  const visibleMeals = meals.filter(isVisibleEntity);

  return getDateRangeDays(range).map((date) => {
    const dateMeals = visibleMeals.filter((meal) => meal.date === date);

    return {
      date,
      averageCalories: average(dateMeals.map((meal) => meal.calories)),
      averageProteinGrams: average(dateMeals.map((meal) => meal.proteinGrams)),
    };
  });
}

export function getWeightSeries(
  weights: WeightRecord[],
  range: DateRange,
): WeightPoint[] {
  return sortByDateThenUpdatedAt(
    weights
      .filter(isVisibleEntity)
      .filter((record) => isWithinDateRange(record.date, range.startDate, range.endDate)),
  ).map((record) => ({
    date: record.date,
    weightKg: record.weightKg,
  }));
}
