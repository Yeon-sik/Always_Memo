# Phase 4 Fitness Summary Blockers

## Confirmed Current State

The Personal OS currently syncs and stores legacy fitness summary rows:

- `workout_records`
- `meal_records`
- `weight_records`

The OS local snapshot does not yet include:

- `quick_records`
- `workout_sessions`
- `workout_exercises`
- `workout_sets`
- `body_metrics`
- `meals`

The Android Fitness MVP includes local SQLite tables for the detailed Fitness domain and includes nullable `created_from_quick_record_id` on the relevant domain rows, but those rows are not synced into the Personal OS snapshot yet.

## Missing Fields / Tables

Missing from Personal OS schema and sync:

- `quick_records.linked_entity_type`
- `quick_records.linked_entity_id`
- `workout_sessions.created_from_quick_record_id`
- `body_metrics.created_from_quick_record_id`
- `meals.created_from_quick_record_id`

Missing read models:

- `fitness_summary_view`
- `daily_fitness_view`
- `weekly_fitness_review_view`
- `activity_timeline_view` entries for `workout_session`, `body_metric`, and `meal`

## Impact

The OS can show a read-only summary from legacy fitness rows, but it cannot prove that a fast workout record and a detailed FitnessApp workout session are one connected set.

Current connection state is therefore:

- linked detailed records: `0`
- quick-record-only rows: not knowable yet
- mismatch risk: all visible legacy fitness records

## Required Migration Order

1. Add `quick_records` as a core table.
2. Add `quickRecords` to `LocalDataSnapshot`, localStorage normalization, Supabase pull/push, and realtime sync.
3. Add detailed Fitness tables to Supabase:
   - `workout_sessions`
   - `workout_exercises`
   - `workout_sets`
   - `body_metrics`
   - `meals`
4. Add detailed Fitness rows to the OS read model only, not OS edit actions.
5. Add indexes:
   - `workout_sessions(user_id, date desc)`
   - `workout_sessions(user_id, updated_at desc)`
   - `workout_exercises(user_id, session_id, order_index)`
   - `workout_sets(user_id, exercise_id, set_index)`
   - `body_metrics(user_id, date desc)`
   - `meals(user_id, date desc)`
   - `*_created_from_quick_record_id_idx`
6. Backfill only if there is a reliable source mapping:
   - Create quick_records from known fast-capture raw text when available.
   - Link `quick_records.linked_entity_type` and `linked_entity_id`.
   - Fill domain `created_from_quick_record_id`.
7. Build timeline/summary queries after link integrity can be checked.

## Backfill Risk

Existing `workout_records`, `meal_records`, and `weight_records` do not preserve raw quick-capture text or link ids. Blindly converting them into `quick_records` would create fake provenance. Backfill should be limited to rows with a verified source trail.
