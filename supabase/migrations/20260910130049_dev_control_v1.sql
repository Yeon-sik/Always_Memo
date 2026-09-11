-- Dev Control v1: person-owned project operating state.
-- All rows use the same local-first sync contract as notes/tasks. Deletion is
-- represented by a tombstone so an offline device can converge after reconnect.

create table if not exists public.projects (
  id uuid primary key,
  user_id text not null,
  name text not null,
  repository text,
  branch text,
  status text not null check (status in ('PLANNED', 'ACTIVE', 'COMPLETED')),
  current_summary text not null default '',
  target_summary text not null default '',
  last_verified_commit text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint projects_user_id_id_key unique (user_id, id),
  constraint projects_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.project_milestones (
  id uuid primary key,
  user_id text not null,
  project_id uuid not null,
  title text not null,
  status text not null check (status in ('PLANNED', 'IN_PROGRESS', 'COMPLETED')),
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint project_milestones_project_fk
    foreign key (user_id, project_id)
    references public.projects(user_id, id),
  constraint project_milestones_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.project_actions (
  id uuid primary key,
  user_id text not null,
  project_id uuid not null,
  title text not null,
  type text not null check (type in ('NEXT', 'LATER', 'BLOCKED')),
  status text not null check (status in ('OPEN', 'DONE')),
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint project_actions_project_fk
    foreign key (user_id, project_id)
    references public.projects(user_id, id),
  constraint project_actions_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.project_ideas (
  id uuid primary key,
  user_id text not null,
  project_id uuid not null,
  title text not null,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint project_ideas_project_fk
    foreign key (user_id, project_id)
    references public.projects(user_id, id),
  constraint project_ideas_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create table if not exists public.project_history (
  id uuid primary key,
  user_id text not null,
  project_id uuid not null,
  type text not null check (type in ('STATUS_CHANGE', 'MILESTONE', 'RELEASE', 'NOTE')),
  summary text not null,
  occurred_at timestamptz not null,
  github_ref text,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint project_history_project_fk
    foreign key (user_id, project_id)
    references public.projects(user_id, id),
  constraint project_history_device_fk
    foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create index if not exists projects_user_updated_at_idx
  on public.projects(user_id, updated_at desc);
create index if not exists projects_user_deleted_at_idx
  on public.projects(user_id, deleted_at);
create index if not exists project_milestones_user_project_updated_at_idx
  on public.project_milestones(user_id, project_id, updated_at desc);
create index if not exists project_actions_user_project_updated_at_idx
  on public.project_actions(user_id, project_id, updated_at desc);
create index if not exists project_ideas_user_project_updated_at_idx
  on public.project_ideas(user_id, project_id, updated_at desc);
create index if not exists project_history_user_project_occurred_at_idx
  on public.project_history(user_id, project_id, occurred_at desc);
create index if not exists project_history_user_updated_at_idx
  on public.project_history(user_id, updated_at desc);

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'projects',
      'project_milestones',
      'project_actions',
      'project_ideas',
      'project_history'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;

-- Keep the client-side merge rule true on the server as well. A stale update
-- is skipped; equal timestamps only allow an active row to become a tombstone.
create or replace function public.prevent_stale_sync_write()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' then
    if NEW.updated_at < OLD.updated_at then
      return null;
    end if;
    if NEW.updated_at = OLD.updated_at then
      if OLD.deleted_at is null and NEW.deleted_at is not null then
        return NEW;
      end if;
      return null;
    end if;
  end if;
  return NEW;
end;
$$;

revoke all on function public.prevent_stale_sync_write() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'notes',
    'tasks',
    'workout_records',
    'fitness_summary_projections_v2',
    'meal_records',
    'weight_records',
    'projects',
    'project_milestones',
    'project_actions',
    'project_ideas',
    'project_history'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_lww_guard', table_name);
    execute format(
      'create trigger %I before insert or update on public.%I
       for each row execute function public.prevent_stale_sync_write()',
      table_name || '_lww_guard',
      table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'projects',
    'project_milestones',
    'project_actions',
    'project_ideas',
    'project_history'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select, insert, update on table public.%I to authenticated', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
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
  end loop;
end;
$$;

comment on table public.projects is
  'Dev Control project operating state; GitHub remains implementation source of truth.';
comment on table public.project_ideas is
  'Uncommitted project candidates; ideas do not become actions automatically.';
