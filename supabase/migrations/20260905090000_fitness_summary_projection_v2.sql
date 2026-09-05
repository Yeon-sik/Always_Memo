-- Fitness Summary Projection v2.
--
-- FitnessApp owns the source workout/session and is the only application
-- allowed to write this projection. Personal OS receives a read-only copy of
-- the contract and never writes workout, meal, or weight owner rows.

create table if not exists public.fitness_summary_projections_v2 (
  id text not null,
  user_id text not null,
  source_fitness_session_id text not null,
  date date not null,
  completion_status text not null
    check (completion_status = 'completed'),
  chest_sets integer not null default 0 check (chest_sets >= 0),
  back_sets integer not null default 0 check (back_sets >= 0),
  legs_sets integer not null default 0 check (legs_sets >= 0),
  shoulders_sets integer not null default 0 check (shoulders_sets >= 0),
  abs_sets integer not null default 0 check (abs_sets >= 0),
  triceps_sets integer not null default 0 check (triceps_sets >= 0),
  biceps_sets integer not null default 0 check (biceps_sets >= 0),
  total_duration_seconds integer check (total_duration_seconds is null or total_duration_seconds >= 0),
  cardio_duration_seconds integer check (cardio_duration_seconds is null or cardio_duration_seconds >= 0),
  contract_version smallint not null default 2
    check (contract_version = 2),
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  primary key (user_id, id),
  constraint fitness_summary_projection_v2_source_key
    unique (user_id, source_fitness_session_id)
);

create index if not exists fitness_summary_projection_v2_user_date_idx
  on public.fitness_summary_projections_v2(user_id, date desc);

create index if not exists fitness_summary_projection_v2_user_updated_at_idx
  on public.fitness_summary_projections_v2(user_id, updated_at desc);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'fitness_summary_projections_v2'
     ) then
    alter publication supabase_realtime add table public.fitness_summary_projections_v2;
  end if;
end;
$$;

alter table public.fitness_summary_projections_v2 enable row level security;

revoke all on table public.fitness_summary_projections_v2 from anon;
revoke all on table public.fitness_summary_projections_v2 from authenticated;
grant select on table public.fitness_summary_projections_v2 to authenticated;

drop policy if exists fitness_summary_projection_v2_select_own
  on public.fitness_summary_projections_v2;
create policy fitness_summary_projection_v2_select_own
  on public.fitness_summary_projections_v2
  for select
  to authenticated
  using ((select auth.uid())::text = user_id);

create or replace function public.upsert_fitness_summary_projection_v2(
  p_projection jsonb
)
returns setof public.fitness_summary_projections_v2
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := (select auth.uid())::text;
  v_source_session_id text := nullif(trim(p_projection->>'source_fitness_session_id'), '');
  v_updated_at timestamptz;
begin
  if v_user_id is null or v_user_id = '' then
    raise exception 'authenticated user is required';
  end if;
  if jsonb_typeof(p_projection) <> 'object' then
    raise exception 'projection must be a JSON object';
  end if;
  if v_source_session_id is null then
    raise exception 'source_fitness_session_id is required';
  end if;
  if p_projection->>'completion_status' <> 'completed' then
    raise exception 'only completed projections may be shared';
  end if;
  if coalesce((p_projection->>'contract_version')::integer, 0) <> 2 then
    raise exception 'fitness summary projection v2 is required';
  end if;

  v_updated_at := coalesce(
    nullif(p_projection->>'updated_at', '')::timestamptz,
    now()
  );

  return query
  insert into public.fitness_summary_projections_v2 (
    id,
    user_id,
    source_fitness_session_id,
    date,
    completion_status,
    chest_sets,
    back_sets,
    legs_sets,
    shoulders_sets,
    abs_sets,
    triceps_sets,
    biceps_sets,
    total_duration_seconds,
    cardio_duration_seconds,
    contract_version,
    created_at,
    is_backfilled,
    backfilled_at,
    backfill_reason,
    updated_at,
    deleted_at,
    device_id
  ) values (
    v_source_session_id,
    v_user_id,
    v_source_session_id,
    (p_projection->>'date')::date,
    'completed',
    coalesce((p_projection->>'chest_sets')::integer, 0),
    coalesce((p_projection->>'back_sets')::integer, 0),
    coalesce((p_projection->>'legs_sets')::integer, 0),
    coalesce((p_projection->>'shoulders_sets')::integer, 0),
    coalesce((p_projection->>'abs_sets')::integer, 0),
    coalesce((p_projection->>'triceps_sets')::integer, 0),
    coalesce((p_projection->>'biceps_sets')::integer, 0),
    nullif(p_projection->>'total_duration_seconds', '')::integer,
    nullif(p_projection->>'cardio_duration_seconds', '')::integer,
    2,
    coalesce(nullif(p_projection->>'created_at', '')::timestamptz, v_updated_at),
    coalesce((p_projection->>'is_backfilled')::boolean, false),
    nullif(p_projection->>'backfilled_at', '')::timestamptz,
    nullif(p_projection->>'backfill_reason', ''),
    v_updated_at,
    nullif(p_projection->>'deleted_at', '')::timestamptz,
    coalesce(nullif(trim(p_projection->>'device_id'), ''), 'fitness-app')
  )
  on conflict (user_id, id) do update set
    date = excluded.date,
    completion_status = excluded.completion_status,
    chest_sets = excluded.chest_sets,
    back_sets = excluded.back_sets,
    legs_sets = excluded.legs_sets,
    shoulders_sets = excluded.shoulders_sets,
    abs_sets = excluded.abs_sets,
    triceps_sets = excluded.triceps_sets,
    biceps_sets = excluded.biceps_sets,
    total_duration_seconds = excluded.total_duration_seconds,
    cardio_duration_seconds = excluded.cardio_duration_seconds,
    is_backfilled = excluded.is_backfilled,
    backfilled_at = excluded.backfilled_at,
    backfill_reason = excluded.backfill_reason,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at,
    device_id = excluded.device_id
  where public.fitness_summary_projections_v2.updated_at <= excluded.updated_at
  returning *;
end;
$$;

revoke all on function public.upsert_fitness_summary_projection_v2(jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_fitness_summary_projection_v2(jsonb)
  to authenticated;

comment on table public.fitness_summary_projections_v2 is
  'FitnessApp-owned read model for Personal OS; no exercise or per-set detail.';
comment on function public.upsert_fitness_summary_projection_v2(jsonb) is
  'FitnessApp-owned write boundary for completed Summary Projection v2 rows.';
