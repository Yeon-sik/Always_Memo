-- Backfill metadata for data-trust aware records.
-- Existing rows default to direct records so local-first history stays intact.

alter table if exists public.notes
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_backfilled boolean not null default false,
  add column if not exists backfilled_at timestamptz,
  add column if not exists backfill_reason text;

alter table if exists public.tasks
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_backfilled boolean not null default false,
  add column if not exists backfilled_at timestamptz,
  add column if not exists backfill_reason text;

alter table if exists public.workout_records
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_backfilled boolean not null default false,
  add column if not exists backfilled_at timestamptz,
  add column if not exists backfill_reason text;

alter table if exists public.meal_records
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_backfilled boolean not null default false,
  add column if not exists backfilled_at timestamptz,
  add column if not exists backfill_reason text;

alter table if exists public.weight_records
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_backfilled boolean not null default false,
  add column if not exists backfilled_at timestamptz,
  add column if not exists backfill_reason text;

create index if not exists notes_user_backfilled_idx
  on public.notes(user_id, is_backfilled);

create index if not exists tasks_user_backfilled_idx
  on public.tasks(user_id, is_backfilled);

create index if not exists workout_records_user_backfilled_idx
  on public.workout_records(user_id, is_backfilled);

create index if not exists meal_records_user_backfilled_idx
  on public.meal_records(user_id, is_backfilled);

create index if not exists weight_records_user_backfilled_idx
  on public.weight_records(user_id, is_backfilled);
