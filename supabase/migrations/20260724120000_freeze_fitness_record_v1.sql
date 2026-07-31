-- Fitness record contract v1.
-- This migration is backwards-compatible with legacy text user_id values.

alter table if exists public.workout_records
  add column if not exists contract_version smallint not null default 1;
alter table if exists public.workout_exercises
  add column if not exists contract_version smallint not null default 1;
alter table if exists public.workout_sets
  add column if not exists contract_version smallint not null default 1;
alter table if exists public.meal_records
  add column if not exists contract_version smallint not null default 1;
alter table if exists public.weight_records
  add column if not exists contract_version smallint not null default 1;

update public.workout_exercises
set record_type = 'weight_reps'
where record_type = 'sets_reps_weight';

alter table if exists public.workout_records
  drop constraint if exists workout_records_contract_version_v1,
  add constraint workout_records_contract_version_v1
    check (contract_version = 1) not valid;
alter table if exists public.workout_exercises
  drop constraint if exists workout_exercises_contract_version_v1,
  add constraint workout_exercises_contract_version_v1
    check (contract_version = 1) not valid,
  drop constraint if exists workout_exercises_record_type_v1,
  add constraint workout_exercises_record_type_v1
    check (record_type in (
      'weight_reps',
      'reps_only',
      'time',
      'weight_time',
      'assisted_weight_reps',
      'bodyweight_added_weight_reps'
    )) not valid;
alter table if exists public.workout_sets
  drop constraint if exists workout_sets_values_v1,
  add constraint workout_sets_values_v1 check (
    set_index > 0
    and (target_reps is null or target_reps >= 0)
    and (actual_reps is null or actual_reps >= 0)
    and (weight_kg is null or weight_kg >= 0)
    and (volume_kg is null or volume_kg >= 0)
    and (duration_seconds is null or duration_seconds >= 0)
    and (distance_meters is null or distance_meters >= 0)
    and (rest_seconds is null or rest_seconds >= 0)
    and (assisted_weight_kg is null or assisted_weight_kg >= 0)
    and (added_weight_kg is null or added_weight_kg >= 0)
    and (rpe is null or rpe between 1 and 10)
  ) not valid,
  drop constraint if exists workout_sets_contract_version_v1,
  add constraint workout_sets_contract_version_v1
    check (contract_version = 1) not valid;
alter table if exists public.meal_records
  drop constraint if exists meal_records_contract_version_v1,
  add constraint meal_records_contract_version_v1
    check (contract_version = 1) not valid;
alter table if exists public.weight_records
  drop constraint if exists weight_records_contract_version_v1,
  add constraint weight_records_contract_version_v1
    check (contract_version = 1) not valid;

create index if not exists workout_records_user_contract_date_idx
  on public.workout_records(user_id, contract_version, date desc);
