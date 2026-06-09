-- Yeonsik's Note Auth/RLS migration draft
-- Review against current supabase/schema.sql before applying.
-- Do not run in production without backup and explicit user_id backfill plan.

begin;

-- 1. Add user_id columns as nullable first for safe backfill.
alter table if exists public.devices add column if not exists user_id uuid references auth.users(id);
alter table if exists public.notes add column if not exists user_id uuid references auth.users(id);
alter table if exists public.tasks add column if not exists user_id uuid references auth.users(id);
alter table if exists public.workout_records add column if not exists user_id uuid references auth.users(id);
alter table if exists public.meal_records add column if not exists user_id uuid references auth.users(id);
alter table if exists public.weight_records add column if not exists user_id uuid references auth.users(id);

-- 2. Backfill placeholder.
-- Replace this block with an explicit migration user id after login migration is designed.
-- Example only:
-- update public.notes set user_id = '00000000-0000-0000-0000-000000000000' where user_id is null;

-- 3. Enable RLS.
alter table if exists public.devices enable row level security;
alter table if exists public.notes enable row level security;
alter table if exists public.tasks enable row level security;
alter table if exists public.workout_records enable row level security;
alter table if exists public.meal_records enable row level security;
alter table if exists public.weight_records enable row level security;

-- 4. Policies. Drop/recreate names to keep migration repeatable in dev.
drop policy if exists devices_select_own on public.devices;
drop policy if exists devices_insert_own on public.devices;
drop policy if exists devices_update_own on public.devices;
create policy devices_select_own on public.devices for select using (auth.uid() = user_id);
create policy devices_insert_own on public.devices for insert with check (auth.uid() = user_id);
create policy devices_update_own on public.devices for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists notes_select_own on public.notes;
drop policy if exists notes_insert_own on public.notes;
drop policy if exists notes_update_own on public.notes;
create policy notes_select_own on public.notes for select using (auth.uid() = user_id);
create policy notes_insert_own on public.notes for insert with check (auth.uid() = user_id);
create policy notes_update_own on public.notes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists tasks_select_own on public.tasks;
drop policy if exists tasks_insert_own on public.tasks;
drop policy if exists tasks_update_own on public.tasks;
create policy tasks_select_own on public.tasks for select using (auth.uid() = user_id);
create policy tasks_insert_own on public.tasks for insert with check (auth.uid() = user_id);
create policy tasks_update_own on public.tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists workout_records_select_own on public.workout_records;
drop policy if exists workout_records_insert_own on public.workout_records;
drop policy if exists workout_records_update_own on public.workout_records;
create policy workout_records_select_own on public.workout_records for select using (auth.uid() = user_id);
create policy workout_records_insert_own on public.workout_records for insert with check (auth.uid() = user_id);
create policy workout_records_update_own on public.workout_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists meal_records_select_own on public.meal_records;
drop policy if exists meal_records_insert_own on public.meal_records;
drop policy if exists meal_records_update_own on public.meal_records;
create policy meal_records_select_own on public.meal_records for select using (auth.uid() = user_id);
create policy meal_records_insert_own on public.meal_records for insert with check (auth.uid() = user_id);
create policy meal_records_update_own on public.meal_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists weight_records_select_own on public.weight_records;
drop policy if exists weight_records_insert_own on public.weight_records;
drop policy if exists weight_records_update_own on public.weight_records;
create policy weight_records_select_own on public.weight_records for select using (auth.uid() = user_id);
create policy weight_records_insert_own on public.weight_records for insert with check (auth.uid() = user_id);
create policy weight_records_update_own on public.weight_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. Hard delete is intentionally not enabled in app policy.
-- Tombstone updates via deleted_at/deletedAt must be used instead.

-- 6. After backfill, add not-null constraints in a later migration:
-- alter table public.notes alter column user_id set not null;

commit;
