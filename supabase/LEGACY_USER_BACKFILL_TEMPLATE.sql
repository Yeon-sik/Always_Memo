-- Run only after a database backup.
-- Replace the placeholder with the UUID from Authentication > Users.
-- This intentionally is not an automatic migration.

begin;

do $$
declare
  target_user_id text := 'REPLACE_WITH_AUTH_USER_UUID';
  table_name text;
begin
  if target_user_id = 'REPLACE_WITH_AUTH_USER_UUID'
     or not exists (
       select 1 from auth.users where id::text = target_user_id
     ) then
    raise exception 'Set target_user_id to an existing auth.users.id.';
  end if;

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
      'update public.%I set user_id = $1 where user_id <> $1',
      table_name
    ) using target_user_id;
  end loop;
end $$;

commit;
