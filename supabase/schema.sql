-- LocalSyncMemo development schema
-- 개발 초기에는 USER_ID 단일 사용자 식별자를 사용한다.
-- 운영 배포 전에는 Supabase Auth 기반 RLS 정책으로 교체해야 한다.

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
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint tasks_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

alter table public.tasks
  add column if not exists due_date date;

alter table public.tasks
  add column if not exists due_time time;

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
end $$;

-- RLS proposal for later:
-- alter table public.notes enable row level security;
-- alter table public.tasks enable row level security;
-- alter table public.devices enable row level security;
--
-- create policy "notes are scoped to authenticated user"
--   on public.notes
--   for all
--   using (user_id = auth.uid()::text)
--   with check (user_id = auth.uid()::text);
--
-- create policy "tasks are scoped to authenticated user"
--   on public.tasks
--   for all
--   using (user_id = auth.uid()::text)
--   with check (user_id = auth.uid()::text);
--
-- create policy "devices are scoped to authenticated user"
--   on public.devices
--   for all
--   using (user_id = auth.uid()::text)
--   with check (user_id = auth.uid()::text);
