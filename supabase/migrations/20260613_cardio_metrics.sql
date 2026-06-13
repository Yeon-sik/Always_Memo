alter table if exists public.workout_records
  add column if not exists duration_seconds integer,
  add column if not exists average_heart_rate double precision;
