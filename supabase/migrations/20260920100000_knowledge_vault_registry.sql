-- Knowledge Vault registry. Markdown bodies never enter Supabase.
alter table public.projects
  add column if not exists description text not null default '';

create table if not exists public.knowledge_documents (
  id uuid primary key,
  user_id text not null,
  title text not null,
  type text not null check (type in ('IDEA', 'PLAN', 'DESIGN', 'RESEARCH', 'NOTE')),
  project_id uuid,
  workstream_id uuid,
  relative_path text not null,
  created_at timestamptz not null default now(),
  is_backfilled boolean not null default false,
  backfilled_at timestamptz,
  backfill_reason text,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  constraint knowledge_documents_owner_exclusive check (
    not (project_id is not null and workstream_id is not null)
  ),
  constraint knowledge_documents_project_fk foreign key (user_id, project_id)
    references public.projects(user_id, id),
  constraint knowledge_documents_workstream_fk foreign key (user_id, workstream_id)
    references public.workstreams(user_id, id),
  constraint knowledge_documents_device_fk foreign key (user_id, device_id)
    references public.devices(user_id, id)
);

create index if not exists knowledge_documents_user_updated_at_idx
  on public.knowledge_documents(user_id, updated_at desc);
create index if not exists knowledge_documents_user_project_idx
  on public.knowledge_documents(user_id, project_id, updated_at desc)
  where project_id is not null;
create index if not exists knowledge_documents_user_workstream_idx
  on public.knowledge_documents(user_id, workstream_id, updated_at desc)
  where workstream_id is not null;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'knowledge_documents'
     ) then
    alter publication supabase_realtime add table public.knowledge_documents;
  end if;
end;
$$;

drop trigger if exists knowledge_documents_lww_guard
  on public.knowledge_documents;
create trigger knowledge_documents_lww_guard
before insert or update on public.knowledge_documents
for each row execute function public.prevent_stale_sync_write();

alter table public.knowledge_documents enable row level security;
revoke all on table public.knowledge_documents from anon;
grant select, insert, update on table public.knowledge_documents to authenticated;
drop policy if exists knowledge_documents_select_own on public.knowledge_documents;
drop policy if exists knowledge_documents_insert_own on public.knowledge_documents;
drop policy if exists knowledge_documents_update_own on public.knowledge_documents;
create policy knowledge_documents_select_own on public.knowledge_documents
  for select to authenticated
  using ((select auth.uid())::text = user_id);
create policy knowledge_documents_insert_own on public.knowledge_documents
  for insert to authenticated
  with check ((select auth.uid())::text = user_id);
create policy knowledge_documents_update_own on public.knowledge_documents
  for update to authenticated
  using ((select auth.uid())::text = user_id)
  with check ((select auth.uid())::text = user_id);
