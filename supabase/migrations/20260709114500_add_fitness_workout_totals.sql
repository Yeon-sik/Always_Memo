-- Store completed workout totals without introducing a separate workout_sessions parent.

begin;

alter table public.workout_records
  add column if not exists total_volume_kg double precision not null default 0;

alter table public.workout_sets
  add column if not exists volume_kg double precision;

commit;
