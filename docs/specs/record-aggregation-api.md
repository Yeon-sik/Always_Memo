# Spec — recordAggregation API Contract

## 1. 위치

```text
src/features/records/recordAggregation.ts
```

## 2. 타입 초안

```ts
import type { LocalDataSnapshot, MealRecord, Task, WeightRecord } from '../../types/entities';

export type LocalDateString = string; // YYYY-MM-DD

export type DateRange = {
  startDate: LocalDateString;
  endDate: LocalDateString;
};

export type CalendarMarkers = Record<LocalDateString, {
  notes: boolean;
  tasks: boolean;
  workouts: boolean;
  meals: boolean;
  weights: boolean;
}>;

export type DashboardStats = {
  productivityScore: number | null;
  completedTasks: number;
  totalTasks: number;
  averageCalories: number | null;
  averageProteinGrams: number | null;
  weightDeltaKg: number | null;
  latestWeightKg: number | null;
};
```

## 3. 함수 계약

```ts
export function getRecordsForDate(snapshot: LocalDataSnapshot, date: LocalDateString) { }
export function getDashboardStats(snapshot: LocalDataSnapshot, range: DateRange): DashboardStats { }
export function getCalendarMarkers(snapshot: LocalDataSnapshot, month: LocalDateString): CalendarMarkers { }
export function getProductivitySeries(tasks: Task[], range: DateRange) { }
export function getNutritionSeries(meals: MealRecord[], range: DateRange) { }
export function getWeightSeries(weights: WeightRecord[], range: DateRange) { }
```

## 4. 규칙

- `deletedAt !== null`인 row는 모든 결과에서 제외한다.
- 날짜 비교는 `YYYY-MM-DD` local date string을 기준으로 한다.
- `updatedAt` 기준 날짜와 사용자가 지정한 기록 날짜를 혼동하지 않는다. 기존 구현의 의미를 먼저 확인하고 필요한 경우 helper 이름을 명확히 한다.
- 데이터가 없을 때는 `0`과 `null`을 구분한다. 평균/변화량은 `null`, count는 `0`이 적절하다.
- rounding은 UI에서 처리하고 selector는 원시 숫자를 반환한다.

## 5. 테스트 우선순위

```text
recordAggregation.test.ts
- tombstone 제외
- 선택 날짜 records 계산
- 생산성 스코어 계산
- meal 평균 계산
- weight delta 계산
- month marker 계산
```
