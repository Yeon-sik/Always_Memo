# Fitness Tab Specification

## Purpose

This document defines the first practical version of the fitness tab for Yeonsik's Note.
The product direction is not a separate fitness app yet. The correct first step is a
separate top-level tab and a separate data domain inside the existing local-first memo app.

## Confirmed Current State

- The app is a Tauri v2, React, TypeScript, Vite, Tailwind desktop app.
- The current app has notes and tasks as separate entities.
- Tasks already support optional `dueDate` and `dueTime`.
- The current workspace layout is too narrow for adding a third live panel inside the existing memo workspace.
- The app already has local-first storage and optional Supabase sync patterns.

## Product Boundary

### Top-Level Views

The app should expose three top-level areas:

1. `Memo`
   - Contains memo and checklist side by side.
   - The visible tab label should be `메모`.
   - Internally this can keep the current memo and task panels.

2. `Fitness`
   - Contains workout, meal, and weight records.
   - The visible tab label should be `운동`.
   - This tab owns the calendar-centered workflow.

3. `Settings`
   - Contains device, sync, theme, runtime config, and future app-level settings.
   - The visible label should be `설정`.

### Explicit Non-Goals For V1

- No exercise set tracking.
- No reps, weight-per-set, rest time, or routine builder.
- No image upload.
- No food database.
- No calorie estimation AI.
- No wearable integration.
- No full health analytics dashboard.
- No separate fitness app packaging.

These are intentionally excluded because the app first needs a stable record and export loop.

## Fitness Data Model

All records should follow the existing syncable entity style:

- `id`
- `updatedAt`
- `deletedAt`
- `deviceId`

For Supabase-backed rows, keep:

- `id`
- `user_id`
- `updated_at`
- `deleted_at`
- `device_id`

### Workout Record

Purpose: record the workout type first, then the smallest useful subcategory.

Workout type options:

- `strength`: 헬스
- `cardio`: 유산소
- `other`: 기타

Cardio option list:

- 실내 달리기
- 실내 걷기
- 계단 오르기
- 실외 싸이클
- 실내 싸이클

TypeScript shape:

```ts
export interface WorkoutRecord extends SyncableEntity {
  date: string;
  workoutType: "strength" | "cardio" | "other";
  category: string;
  exerciseName: string;
}
```

Database table:

```sql
create table if not exists public.workout_records (
  id uuid primary key,
  user_id text not null,
  date date not null,
  workout_type text not null,
  category text not null,
  exercise_name text not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null
);
```

For `strength`, `category` means the user's "where" field, for example chest, back, legs,
shoulders, arms, or core, and `exerciseName` stores the actual exercise.
For `cardio`, `category` stores the fixed cardio option and `exerciseName` can mirror it.
For `other`, `category` can be `기타` and `exerciseName` stores the user's custom workout name.

### Meal Record

Purpose: record menu, calories, and protein only, while leaving a clean path for carbs and fat.

TypeScript shape:

```ts
export interface MealRecord extends SyncableEntity {
  date: string;
  menu: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number | null;
  fatGrams: number | null;
}
```

Database table:

```sql
create table if not exists public.meal_records (
  id uuid primary key,
  user_id text not null,
  date date not null,
  menu text not null,
  calories integer not null,
  protein_grams numeric(7, 2) not null,
  carbs_grams numeric(7, 2),
  fat_grams numeric(7, 2),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null
);
```

`carbsGrams` and `fatGrams` are stored as nullable values but hidden from the V1 UI.
This avoids a later schema migration when nutrition tracking expands.

### Weight Record

Purpose: record body weight in kilograms.

TypeScript shape:

```ts
export interface WeightRecord extends SyncableEntity {
  date: string;
  weightKg: number;
}
```

Database table:

```sql
create table if not exists public.weight_records (
  id uuid primary key,
  user_id text not null,
  date date not null,
  weight_kg numeric(6, 2) not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null
);
```

## Calendar Workflow

### Default State

- The fitness tab opens with today's local date selected.
- The selected date should be formatted from the user's local timezone, not UTC midnight.
- The center of the tab contains a large month calendar.
- The selected date's records appear below the calendar.

### Calendar Markers

Each date cell can display up to three small markers:

- Workout record exists: red dot.
- Meal record exists: yellow dot.
- Weight record exists: green dot.

If multiple record types exist on the same date, show multiple dots in a stable order:

1. workout
2. meal
3. weight

### Add Record Area

Below the calendar, provide three compact add flows:

1. Add workout record
   - date
   - workout type
   - strength: where and exercise name
   - cardio: fixed cardio option
   - other: exercise name

2. Add meal record
   - date
   - menu
   - calories
   - protein grams

3. Add weight record
   - date
   - weight in kg

The form date defaults to the selected calendar date, but can be changed manually.
After saving a record, the calendar markers must update immediately.

## Header Actions

The fitness tab has two small action buttons above the calendar:

1. `통계`
2. `출력`

These actions should not be global app settings. They belong to the fitness tab.

## Statistics

### Date Range

The statistics modal or panel must let the user choose a start date and an end date.
Default range should be the current month.

### Workout Statistics

Workout statistics use totals, not averages.

Required output:

- Total workout records in the period.
- Total count per workout type and subcategory.

Example:

```txt
운동 기록: 18회
헬스 - 가슴운동: 5회
헬스 - 등운동: 4회
헬스 - 하체운동: 4회
유산소 - 계단 오르기: 3회
기타 - 클라이밍: 2회
```

### Meal Statistics

Meal statistics use averages.

Required output:

- Meal record count.
- Average calories.
- Average protein grams.

Recommended decision:

- Use average per record in V1.
- Add average per day later if the user starts recording every meal consistently.

### Weight Statistics

Weight statistics use averages.

Required output:

- Weight record count.
- Average body weight in kg.
- Lowest body weight in kg.
- Highest body weight in kg.

Average alone hides too much information, so min and max should be included from the first version.

## Export

### Export Format

Use Markdown as the first export format.

Reason:

- It is suitable for blog publishing.
- It is readable without the app.
- It does not require a document rendering pipeline.
- It can later be converted to HTML, PDF, or DOCX if needed.

### File Name

Recommended file name:

```txt
yeonsik-fitness-report-YYYYMMDD-YYYYMMDD.md
```

### Export Content

The exported file should include:

1. Title
2. Date range
3. Summary statistics
4. Workout records grouped by date
5. Meal records grouped by date
6. Weight records grouped by date

Example outline:

```md
# 운동 기록 리포트

기간: 2026-06-01 ~ 2026-06-30

## 요약

- 운동 기록: 18회
- 평균 칼로리: 720 kcal
- 평균 단백질: 42.5 g
- 평균 체중: 72.4 kg

## 운동

### 2026-06-05

- 가슴: 벤치프레스
- 유산소: 러닝

## 식사

### 2026-06-05

- 닭가슴살 샐러드, 520 kcal, 단백질 42 g

## 체중

### 2026-06-05

- 72.1 kg
```

## Implementation Phases

### Phase 1: App Shell Split

- Change the top-level view model from `workspace | settings` to `memo | fitness | settings`.
- Keep the existing memo/checklist layout inside the memo tab.
- Add an empty fitness tab route or panel.
- Do not change storage yet.

### Phase 2: Local Fitness Domain

- Add fitness entity types.
- Extend local snapshot shape.
- Add runtime validation for fitness records.
- Add create, update, soft-delete service functions.
- Keep all records local-first.

### Phase 3: Fitness UI MVP

- Add month calendar.
- Select today's date by default.
- Add red, yellow, and green markers.
- Add workout, meal, and weight forms below the calendar.
- Show selected date records.

### Phase 4: Statistics And Export

- Add date range state.
- Add statistics calculation functions.
- Add Markdown export generation.
- Use Tauri file save only after the plain Markdown string generation is stable.

### Phase 5: Supabase Sync

- Add Supabase tables and indexes.
- Add row mapping functions.
- Add pull, push, and realtime support for the three new record types.
- Keep Last Write Wins and soft-delete behavior consistent with notes and tasks.

## Risks

### Layout Risk

The existing app width is narrow. A large calendar will not fit cleanly inside the old two-column workspace.
This is why the fitness tab needs its own top-level view instead of becoming a third memo panel.

### Scope Risk

Exercise set tracking is the obvious temptation. It should not be added in V1.
The first measurable loop is:

1. select date
2. add workout, meal, or weight
3. see marker on calendar
4. view stats
5. export Markdown

### Sync Risk

Adding three new entity groups means local storage, Supabase schema, row mappers, realtime subscription,
and conflict behavior all need to move together. Implementing UI before the local entity contract is stable
will create rework.

## Definition Of Done

The fitness tab MVP is done when:

- The user can open `메모`, `운동`, and `설정` as separate top-level views.
- The memo tab still contains memo and checklist functionality.
- The fitness tab opens with today's date selected.
- Workout, meal, and weight records can be added for any selected date.
- Calendar markers update immediately after records are added.
- Statistics can be generated for a selected period.
- Markdown export can be generated for a selected period.
- No exercise set tracking exists in V1.
