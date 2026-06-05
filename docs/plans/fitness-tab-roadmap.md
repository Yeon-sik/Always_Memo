# Fitness Tab Roadmap

## Goal

Build the `운동` tab as a focused health record surface inside the existing memo app.
The target is not a complete fitness platform. The target is a repeatable personal record loop:

1. choose a date
2. add workout, meal, or weight
3. see calendar markers
4. review period statistics
5. export a blog-ready Markdown report

## Feature Slices

### Slice 1: Top-Level Navigation

Deliverable:

- `메모`
- `운동`
- `설정`

Rules:

- The `메모` tab keeps the existing memo and checklist panels.
- The `운동` tab gets its own full-width layout.
- `설정` stays separate from content tabs.

Files likely touched:

- `src/components/HeaderBar.tsx`
- `src/app/App.tsx`
- new `src/features/fitness/FitnessPanel.tsx`

Validation:

- App builds.
- Existing memo and checklist functions still render.
- Switching tabs does not reset current memo state unexpectedly.

### Slice 2: Fitness Local Data Contract

Deliverable:

- `WorkoutRecord`
- `MealRecord`
- `WeightRecord`
- local create/update/soft-delete services
- local snapshot extension

Rules:

- Use `date` as `YYYY-MM-DD`.
- Use kilograms only for weight.
- Meal stores nullable carbs/fat for future expansion, but the V1 UI hides them.
- Workout does not store sets.

Files likely touched:

- `src/types/entities.ts`
- `src/lib/storage/localStorageAdapter.ts`
- `src/lib/storage/storageAdapter.ts`
- `src/app/useLocalSyncMemo.ts`
- `src/features/fitness/**`

Validation:

- Old local snapshots without fitness arrays still load.
- New snapshots include empty fitness arrays by default.
- Deleted records use tombstones, not hard delete.

### Slice 3: Calendar MVP

Deliverable:

- Large month calendar in the center of the fitness tab.
- Today's date selected by default.
- Date selection changes the lower record area.
- Dots show record presence.

Marker contract:

- workout: red
- meal: yellow
- weight: green

Validation:

- Adding a record changes the marker on the matching date immediately.
- Multiple markers can appear on the same date.
- The selected date is visually distinct from today.

### Slice 4: Add And List Records

Deliverable:

- Workout form and list.
- Meal form and list.
- Weight form and list.

Rules:

- Forms default to selected date.
- Each form can override the date.
- Numeric inputs reject negative values.
- Empty required text is rejected.

Validation:

- Records survive reload through local storage.
- Editing or deleting records updates markers.
- Existing memo/checklist data is unaffected.

### Slice 5: Statistics

Deliverable:

- Small `통계` button above the calendar.
- Period selector.
- Statistics view.

Statistics contract:

- Workout: total count and total count by `type - subcategory`.
- Meal: average calories and average protein.
- Weight: average, min, max.

Validation:

- Empty period shows an empty state, not zero values that look like real data.
- Date range is inclusive.
- Results ignore soft-deleted records.

### Slice 6: Markdown Export

Deliverable:

- Small `출력` button above the calendar.
- Period selector.
- Blog-ready Markdown generation.

Rules:

- Export format is Markdown.
- Default file name: `yeonsik-fitness-report-YYYYMMDD-YYYYMMDD.md`.
- Group records by date.
- Include summary before detailed records.

Validation:

- Export output is deterministic for the same input.
- Empty sections are either omitted or explicitly marked as no records.
- Markdown can be pasted into a blog editor without app-specific syntax.

### Slice 7: Supabase Sync

Deliverable:

- `workout_records`
- `meal_records`
- `weight_records`
- pull/push/realtime support

Rules:

- Follow the existing notes/tasks sync style.
- Keep Last Write Wins for V1.
- Add `user_id`, `device_id`, `updated_at`, and `deleted_at` indexes.

Validation:

- Local-only mode still works without Supabase config.
- Configured mode syncs records across devices.
- Realtime updates do not duplicate records.

## Recommended Branch Flow

The current planning branch:

```txt
feat/workout-records-planning
```

Recommended implementation branches:

```txt
feat/fitness-tabs-shell
feat/fitness-local-records
feat/fitness-calendar-mvp
feat/fitness-stats-export
feat/fitness-supabase-sync
```

Keep each branch small enough to build and review independently.

## Cut Line

If time is tight, stop after Slice 4.

Reason:

- A tab that records data reliably is useful.
- Statistics and export are valuable, but they depend on trusted records.
- Sync can wait until the local record loop is stable.

## Technical Decisions

### Use `fitness`, not `workout`, for the directory name

The visible tab is `운동`, but the domain includes workout, meals, and weight.
`fitness` is a better module name than `workout` because it does not force meal and weight logic into an exercise-only namespace.

### Do not merge workouts into tasks

Tasks answer: "what should be done?"
Workout records answer: "what happened on this date?"

Merging these creates wrong statistics, awkward export rules, and confusing UI.

### Export Markdown first

Markdown is the lowest-cost format for blog publishing.
PDF, DOCX, and HTML export can be added later if there is real demand.

## Open Questions

These should be decided during implementation, not before:

- Should strength subcategory use presets, free text, or both?
- Should meal averages be per record or per day after the user records consistently?
- Should a day allow multiple weight records or only the latest one?
- Should exported Markdown include Korean labels only, or bilingual labels?

Default V1 answers:

- strength subcategory: free text
- meal average: per record
- weight records: allow multiple, statistics use all visible records
- export labels: Korean
