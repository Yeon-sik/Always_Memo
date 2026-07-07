alter table public.tasks
  add column if not exists planned_date date;

create index if not exists tasks_user_planned_date_idx
  on public.tasks(user_id, planned_date);
