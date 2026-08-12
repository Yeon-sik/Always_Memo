-- LocalSyncMemo development schema
-- user_id는 Supabase Auth의 auth.users.id를 text로 저장한다.
-- 이 파일의 마지막 RLS 정책이 익명 접근을 차단하고 소유자 행만 허용한다.

create table if not exists public.devices (
  id text not null,
  user_id text not null,
  name text not null,
  last_seen_at timestamptz not null,
  app_version text,
  primary key (user_id, id)
);

-- notes/tasks는 삭제 전파를 위해 hard delete 대신 deleted_at tombstone을 저장한다.
create table if not exists public.notes (
  id uuid primary key,
  user_id text not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint notes_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.tasks (
  id uuid primary key,
  user_id text not null,
  text text not null,
  is_done boolean not null default false,
  order_index integer not null default 0,
  due_date date,
  due_time time,
  planned_date date,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint tasks_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.workout_records (
  id uuid primary key,
  user_id text not null,
  date date not null,
  workout_type text not null
    check (workout_type in ('strength', 'cardio', 'other')),
  category text not null,
  exercise_name text not null,
  duration_seconds integer,
  total_volume_kg double precision not null default 0,
  average_heart_rate double precision,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  source_app text not null default 'os'
    check (source_app in ('os', 'fitness')),
  scope text not null default 'both'
    check (scope in ('os', 'fitness', 'both')),
  metadata jsonb not null default '{}'::jsonb,
  contract_version smallint not null default 1
    check (contract_version = 1),
  constraint workout_records_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.meal_records (
  id uuid primary key,
  user_id text not null,
  date date not null,
  menu text not null,
  calories integer not null,
  protein_grams double precision not null,
  carbs_grams double precision,
  fat_grams double precision,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  source_app text not null default 'os'
    check (source_app in ('os', 'fitness')),
  scope text not null default 'both'
    check (scope in ('os', 'fitness', 'both')),
  metadata jsonb not null default '{}'::jsonb,
  contract_version smallint not null default 1
    check (contract_version = 1),
  constraint meal_records_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.meal_record_items (
  id uuid primary key,
  user_id text not null,
  meal_record_id uuid not null,
  food_id text,
  food_name_snapshot text not null,
  food_kind_snapshot text,
  quantity double precision not null,
  unit text not null,
  basis_amount_snapshot double precision,
  basis_unit_snapshot text,
  prep_state_snapshot text,
  calories double precision not null default 0,
  protein_grams double precision not null default 0,
  carbs_grams double precision not null default 0,
  fat_grams double precision not null default 0,
  sodium_mg double precision,
  saturated_fat_grams double precision,
  sugars_grams double precision,
  fiber_grams double precision,
  added_sugars_grams double precision,
  trans_fat_grams double precision,
  cholesterol_mg double precision,
  source_type_snapshot text,
  source_reference_snapshot text,
  source_version_snapshot text,
  food_data_version_snapshot integer,
  order_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint meal_record_items_meal_fk
    foreign key (meal_record_id)
    references public.meal_records(id),
  constraint meal_record_items_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.meal_record_item_nutrients (
  id uuid primary key,
  user_id text not null,
  meal_record_id uuid not null,
  meal_record_item_id uuid not null,
  nutrient_code text not null,
  amount double precision not null,
  unit text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint meal_record_item_nutrients_item_code_key
    unique (meal_record_item_id, nutrient_code),
  constraint meal_record_item_nutrients_meal_fk
    foreign key (meal_record_id)
    references public.meal_records(id),
  constraint meal_record_item_nutrients_item_fk
    foreign key (meal_record_item_id)
    references public.meal_record_items(id),
  constraint meal_record_item_nutrients_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.weight_records (
  id uuid primary key,
  user_id text not null,
  date date not null,
  weight_kg double precision not null,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  source_app text not null default 'os'
    check (source_app in ('os', 'fitness')),
  scope text not null default 'both'
    check (scope in ('os', 'fitness', 'both')),
  metadata jsonb not null default '{}'::jsonb,
  contract_version smallint not null default 1
    check (contract_version = 1),
  constraint weight_records_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

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
  record_type text not null
    check (record_type in (
      'weight_reps',
      'reps_only',
      'time',
      'weight_time',
      'assisted_weight_reps',
      'bodyweight_added_weight_reps'
    )),
  contract_version smallint not null default 1
    check (contract_version = 1),
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
  volume_kg double precision,
  duration_seconds integer,
  distance_meters double precision,
  rest_seconds integer,
  assisted_weight_kg double precision,
  added_weight_kg double precision,
  is_completed boolean not null default false,
  rpe integer,
  memo text,
  device_id text not null,
  contract_version smallint not null default 1
    check (contract_version = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  constraint workout_sets_exercise_fk
    foreign key (workout_exercise_id)
    references public.workout_exercises(id),
  constraint workout_sets_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id),
  constraint workout_sets_values_v1 check (
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
  )
);

alter table public.tasks
  add column if not exists due_date date;

alter table public.tasks
  add column if not exists due_time time;

alter table public.tasks
  add column if not exists planned_date date;

alter table public.notes
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_backfilled boolean not null default false,
  add column if not exists backfilled_at timestamptz,
  add column if not exists backfill_reason text;

alter table public.tasks
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_backfilled boolean not null default false,
  add column if not exists backfilled_at timestamptz,
  add column if not exists backfill_reason text;

alter table public.workout_records
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_backfilled boolean not null default false,
  add column if not exists backfilled_at timestamptz,
  add column if not exists backfill_reason text,
  add column if not exists duration_seconds integer,
  add column if not exists total_volume_kg double precision not null default 0,
  add column if not exists average_heart_rate double precision,
  add column if not exists source_app text not null default 'os',
  add column if not exists scope text not null default 'both',
  add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.workout_records
  add column if not exists contract_version smallint not null default 1;

alter table public.meal_records
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_backfilled boolean not null default false,
  add column if not exists backfilled_at timestamptz,
  add column if not exists backfill_reason text,
  add column if not exists source_app text not null default 'os',
  add column if not exists scope text not null default 'both',
  add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.meal_records
  add column if not exists contract_version smallint not null default 1;

alter table public.weight_records
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_backfilled boolean not null default false,
  add column if not exists backfilled_at timestamptz,
  add column if not exists backfill_reason text,
  add column if not exists source_app text not null default 'os',
  add column if not exists scope text not null default 'both',
  add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.weight_records
  add column if not exists contract_version smallint not null default 1;

alter table public.workout_exercises
  add column if not exists contract_version smallint not null default 1;

alter table public.workout_sets
  add column if not exists contract_version smallint not null default 1;

-- pull sync와 활성 목록 조회가 자주 쓰는 user_id + 시간/순서 기준 인덱스다.
create index if not exists notes_user_updated_at_idx
  on public.notes(user_id, updated_at desc);

create index if not exists notes_user_deleted_at_idx
  on public.notes(user_id, deleted_at);

create index if not exists tasks_user_updated_at_idx
  on public.tasks(user_id, updated_at desc);

create index if not exists tasks_user_deleted_at_idx
  on public.tasks(user_id, deleted_at);

create index if not exists tasks_user_order_index_idx
  on public.tasks(user_id, order_index);

create index if not exists tasks_user_due_date_idx
  on public.tasks(user_id, due_date);

create index if not exists tasks_user_planned_date_idx
  on public.tasks(user_id, planned_date);

create index if not exists workout_records_user_updated_at_idx
  on public.workout_records(user_id, updated_at desc);

create index if not exists workout_records_user_deleted_at_idx
  on public.workout_records(user_id, deleted_at);

create index if not exists workout_records_user_date_idx
  on public.workout_records(user_id, date);

create index if not exists workout_records_user_type_category_idx
  on public.workout_records(user_id, workout_type, category);

create index if not exists workout_records_user_scope_date_idx
  on public.workout_records(user_id, scope, date desc);

create index if not exists workout_exercises_user_record_order_idx
  on public.workout_exercises(user_id, record_id, order_index);

create index if not exists workout_exercises_user_updated_at_idx
  on public.workout_exercises(user_id, updated_at desc);

create index if not exists workout_sets_user_exercise_set_idx
  on public.workout_sets(user_id, workout_exercise_id, set_index);

create index if not exists workout_sets_user_updated_at_idx
  on public.workout_sets(user_id, updated_at desc);

create index if not exists meal_records_user_updated_at_idx
  on public.meal_records(user_id, updated_at desc);

create index if not exists meal_records_user_deleted_at_idx
  on public.meal_records(user_id, deleted_at);

create index if not exists meal_records_user_date_idx
  on public.meal_records(user_id, date);

create index if not exists meal_record_items_user_meal_order_idx
  on public.meal_record_items(user_id, meal_record_id, order_index);

create index if not exists meal_record_item_nutrients_user_meal_idx
  on public.meal_record_item_nutrients(user_id, meal_record_id, nutrient_code);

create index if not exists weight_records_user_updated_at_idx
  on public.weight_records(user_id, updated_at desc);

create index if not exists weight_records_user_deleted_at_idx
  on public.weight_records(user_id, deleted_at);

create index if not exists weight_records_user_date_idx
  on public.weight_records(user_id, date);

create index if not exists devices_user_last_seen_at_idx
  on public.devices(user_id, last_seen_at desc);

-- Supabase Realtime이 세 테이블의 변경 이벤트를 클라이언트로 보내도록 등록한다.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table public.notes;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'devices'
  ) then
    alter publication supabase_realtime add table public.devices;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workout_records'
  ) then
    alter publication supabase_realtime add table public.workout_records;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workout_exercises'
  ) then
    alter publication supabase_realtime add table public.workout_exercises;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workout_sets'
  ) then
    alter publication supabase_realtime add table public.workout_sets;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'meal_records'
  ) then
    alter publication supabase_realtime add table public.meal_records;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'weight_records'
  ) then
    alter publication supabase_realtime add table public.weight_records;
  end if;
end $$;

-- Fresh production installs are private by default. Existing installs use the
-- guarded 20260724121000 migration after assigning legacy rows to auth.users.
revoke all on table
  public.devices, public.notes, public.tasks, public.workout_records,
  public.workout_exercises, public.workout_sets, public.meal_records,
  public.meal_record_items, public.meal_record_item_nutrients,
  public.weight_records
from anon;

grant select, insert, update, delete on table
  public.devices, public.notes, public.tasks, public.workout_records,
  public.workout_exercises, public.workout_sets, public.meal_records,
  public.meal_record_items, public.meal_record_item_nutrients,
  public.weight_records
to authenticated;

alter table public.devices enable row level security;
alter table public.notes enable row level security;
alter table public.tasks enable row level security;
alter table public.workout_records enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.meal_records enable row level security;
alter table public.meal_record_items enable row level security;
alter table public.meal_record_item_nutrients enable row level security;
alter table public.weight_records enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'devices', 'notes', 'tasks', 'workout_records', 'workout_exercises',
    'workout_sets', 'meal_records', 'meal_record_items',
    'meal_record_item_nutrients', 'weight_records'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated
       using ((select auth.uid())::text = user_id)',
      table_name || '_select_own', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated
       with check ((select auth.uid())::text = user_id)',
      table_name || '_insert_own', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
       using ((select auth.uid())::text = user_id)
       with check ((select auth.uid())::text = user_id)',
      table_name || '_update_own', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated
       using ((select auth.uid())::text = user_id)',
      table_name || '_delete_own', table_name
    );
  end loop;
end $$;

drop policy if exists workout_exercises_insert_own on public.workout_exercises;
create policy workout_exercises_insert_own
  on public.workout_exercises for insert to authenticated
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.workout_records parent
      where parent.id = record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists workout_exercises_update_own on public.workout_exercises;
create policy workout_exercises_update_own
  on public.workout_exercises for update to authenticated
  using ((select auth.uid())::text = user_id)
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.workout_records parent
      where parent.id = record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists workout_sets_insert_own on public.workout_sets;
create policy workout_sets_insert_own
  on public.workout_sets for insert to authenticated
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.workout_exercises parent
      where parent.id = workout_exercise_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists workout_sets_update_own on public.workout_sets;
create policy workout_sets_update_own
  on public.workout_sets for update to authenticated
  using ((select auth.uid())::text = user_id)
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.workout_exercises parent
      where parent.id = workout_exercise_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists meal_record_items_insert_own on public.meal_record_items;
create policy meal_record_items_insert_own
  on public.meal_record_items for insert to authenticated
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.meal_records parent
      where parent.id = meal_record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists meal_record_items_update_own on public.meal_record_items;
create policy meal_record_items_update_own
  on public.meal_record_items for update to authenticated
  using ((select auth.uid())::text = user_id)
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.meal_records parent
      where parent.id = meal_record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists meal_record_item_nutrients_insert_own
  on public.meal_record_item_nutrients;
create policy meal_record_item_nutrients_insert_own
  on public.meal_record_item_nutrients for insert to authenticated
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.meal_record_items parent
      where parent.id = meal_record_item_id
        and parent.meal_record_id = meal_record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists meal_record_item_nutrients_update_own
  on public.meal_record_item_nutrients;
create policy meal_record_item_nutrients_update_own
  on public.meal_record_item_nutrients for update to authenticated
  using ((select auth.uid())::text = user_id)
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1 from public.meal_record_items parent
      where parent.id = meal_record_item_id
        and parent.meal_record_id = meal_record_id
        and parent.user_id = (select auth.uid())::text
    )
  );
