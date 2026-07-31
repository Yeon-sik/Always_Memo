-- Detailed Fitness extension without a separate workout_sessions parent.
--
-- Parent records stay in the existing OS tables:
-- - workout_records is the workout session/event parent.
-- - meal_records stays the meal parent.
-- - weight_records stays the body weight parent.
--
-- Fitness-specific visibility is controlled by source_app/scope/metadata.

begin;

alter table public.workout_records
  add column if not exists source_app text not null default 'os'
    check (source_app in ('os', 'fitness')),
  add column if not exists scope text not null default 'both'
    check (scope in ('os', 'fitness', 'both')),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.meal_records
  add column if not exists source_app text not null default 'os'
    check (source_app in ('os', 'fitness')),
  add column if not exists scope text not null default 'both'
    check (scope in ('os', 'fitness', 'both')),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.weight_records
  add column if not exists source_app text not null default 'os'
    check (source_app in ('os', 'fitness')),
  add column if not exists scope text not null default 'both'
    check (scope in ('os', 'fitness', 'both')),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.workout_exercises (
  id uuid primary key,
  user_id text not null,
  record_id uuid not null,
  order_index integer not null,
  exercise_id text not null,
  exercise_name_snapshot text not null,
  ui_part text not null,
  primary_sub_part_snapshot text,
  equipment_snapshot text,
  record_type text not null,
  memo text,
  device_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  constraint workout_exercises_record_fk
    foreign key (record_id)
    references public.workout_records(id),
  constraint workout_exercises_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.workout_sets (
  id uuid primary key,
  user_id text not null,
  workout_exercise_id uuid not null,
  set_index integer not null,
  target_reps integer,
  actual_reps integer,
  weight_kg double precision,
  duration_seconds integer,
  distance_meters double precision,
  rest_seconds integer,
  assisted_weight_kg double precision,
  added_weight_kg double precision,
  is_completed boolean not null default false,
  rpe integer,
  memo text,
  device_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  constraint workout_sets_exercise_fk
    foreign key (workout_exercise_id)
    references public.workout_exercises(id),
  constraint workout_sets_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create index if not exists workout_records_user_scope_date_idx
  on public.workout_records(user_id, scope, date desc);

create index if not exists meal_records_user_scope_date_idx
  on public.meal_records(user_id, scope, date desc);

create index if not exists weight_records_user_scope_date_idx
  on public.weight_records(user_id, scope, date desc);

create index if not exists workout_exercises_user_record_order_idx
  on public.workout_exercises(user_id, record_id, order_index);

create index if not exists workout_exercises_user_updated_at_idx
  on public.workout_exercises(user_id, updated_at desc);

create index if not exists workout_exercises_user_deleted_at_idx
  on public.workout_exercises(user_id, deleted_at);

create index if not exists workout_sets_user_exercise_set_idx
  on public.workout_sets(user_id, workout_exercise_id, set_index);

create index if not exists workout_sets_user_updated_at_idx
  on public.workout_sets(user_id, updated_at desc);

create index if not exists workout_sets_user_deleted_at_idx
  on public.workout_sets(user_id, deleted_at);

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workout_exercises'
  ) then
    alter publication supabase_realtime add table public.workout_exercises;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workout_sets'
  ) then
    alter publication supabase_realtime add table public.workout_sets;
  end if;
end
$$;

commit;
