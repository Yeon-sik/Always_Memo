# Fitness Feature Directory Contract

This directory owns the `운동` top-level tab.

The tab includes three record domains:

- workout records
- meal records
- weight records

The feature must stay local-first and follow the existing note/task soft-delete and sync patterns.

## Current Structure

```txt
src/features/fitness/
  README.md
  FitnessPanel.tsx
  fitnessDate.ts
  fitnessService.ts
  calendar/
    .gitkeep
  workouts/
    .gitkeep
  meals/
    .gitkeep
  weight/
    .gitkeep
  stats/
    fitnessStats.ts
  export/
    fitnessMarkdownExport.ts
```

The MVP keeps the UI in `FitnessPanel.tsx` and extracts pure date, service,
statistics, and Markdown export logic. Split the UI into the lower directories
only when the panel becomes difficult to scan or test.

## Directory Responsibilities

### `calendar`

- Month grid rendering.
- Selected date state handoff.
- Record type marker calculation.
- Marker color order: workout red, meal yellow, weight green.

### `workouts`

- Workout record creation and display.
- Fields: date, workout type, subcategory, exercise name.
- Workout type options: strength, cardio, other.
- Strength records use `where` as the subcategory and do not ask for the exact exercise name in V1.
- Cardio records use the fixed cardio option as the subcategory.
- Other records use the entered exercise name as the subcategory.
- No sets, reps, exercise load, or routine logic in V1.

### `meals`

- Meal record creation and display.
- Fields: date, menu, calories, protein grams.
- Keep carbs and fat available in the data model as nullable future fields, but hide them in V1 UI.

### `weight`

- Weight record creation and display.
- Field: weight in kg.
- Do not support lb in V1.

### `stats`

- Date range selection contract.
- Workout totals by `type - subcategory`.
- Meal averages for calories and protein.
- Weight average, min, and max.

### `export`

- Blog-ready Markdown export.
- File naming contract: `yeonsik-fitness-report-YYYYMMDD-YYYYMMDD.md`.
- Export content order: summary, workouts, meals, weight.

## Implementation Rule

Do not put fitness logic into the existing task model.
Workout records are historical logs, not checklist tasks.

The first implementation should keep the surface small:

1. app shell tab split
2. local entity types
3. calendar with markers
4. add forms
5. statistics
6. Markdown export
7. Supabase sync
