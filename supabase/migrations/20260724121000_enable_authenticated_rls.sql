-- Production security gate.
-- Existing installations must back up and replace legacy user_id values with
-- a real auth.users.id before this migration can succeed.

do $$
declare
  table_name text;
  invalid_count bigint;
begin
  foreach table_name in array array[
    'devices',
    'notes',
    'tasks',
    'workout_records',
    'workout_exercises',
    'workout_sets',
    'meal_records',
    'weight_records'
  ]
  loop
    execute format(
      'select count(*) from public.%I where user_id !~* %L',
      table_name,
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) into invalid_count;

    if invalid_count > 0 then
      raise exception
        'RLS activation blocked: public.% has % legacy user_id value(s). Backfill to auth.users.id first.',
        table_name,
        invalid_count;
    end if;

    execute format(
      'select count(*) from public.%I candidate where not exists (
         select 1 from auth.users account where account.id::text = candidate.user_id
       )',
      table_name
    ) into invalid_count;

    if invalid_count > 0 then
      raise exception
        'RLS activation blocked: public.% has % user_id value(s) without auth.users ownership.',
        table_name,
        invalid_count;
    end if;
  end loop;
end $$;

revoke all on table
  public.devices,
  public.notes,
  public.tasks,
  public.workout_records,
  public.workout_exercises,
  public.workout_sets,
  public.meal_records,
  public.weight_records
from anon;

grant select, insert, update, delete on table
  public.devices,
  public.notes,
  public.tasks,
  public.workout_records,
  public.workout_exercises,
  public.workout_sets,
  public.meal_records,
  public.weight_records
to authenticated;

alter table public.devices enable row level security;
alter table public.notes enable row level security;
alter table public.tasks enable row level security;
alter table public.workout_records enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.meal_records enable row level security;
alter table public.weight_records enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'devices',
    'notes',
    'tasks',
    'workout_records',
    'workout_exercises',
    'workout_sets',
    'meal_records',
    'weight_records'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated
       using ((select auth.uid())::text = user_id)',
      table_name || '_select_own',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated
       with check ((select auth.uid())::text = user_id)',
      table_name || '_insert_own',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
       using ((select auth.uid())::text = user_id)
       with check ((select auth.uid())::text = user_id)',
      table_name || '_update_own',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated
       using ((select auth.uid())::text = user_id)',
      table_name || '_delete_own',
      table_name
    );
  end loop;
end $$;

drop policy if exists workout_exercises_insert_own on public.workout_exercises;
create policy workout_exercises_insert_own
  on public.workout_exercises
  for insert
  to authenticated
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1
      from public.workout_records parent
      where parent.id = record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists workout_exercises_update_own on public.workout_exercises;
create policy workout_exercises_update_own
  on public.workout_exercises
  for update
  to authenticated
  using ((select auth.uid())::text = user_id)
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1
      from public.workout_records parent
      where parent.id = record_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists workout_sets_insert_own on public.workout_sets;
create policy workout_sets_insert_own
  on public.workout_sets
  for insert
  to authenticated
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1
      from public.workout_exercises parent
      where parent.id = workout_exercise_id
        and parent.user_id = (select auth.uid())::text
    )
  );

drop policy if exists workout_sets_update_own on public.workout_sets;
create policy workout_sets_update_own
  on public.workout_sets
  for update
  to authenticated
  using ((select auth.uid())::text = user_id)
  with check (
    (select auth.uid())::text = user_id
    and exists (
      select 1
      from public.workout_exercises parent
      where parent.id = workout_exercise_id
        and parent.user_id = (select auth.uid())::text
    )
  );
