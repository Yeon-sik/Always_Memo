-- Project remains Personal OS-owned operating state. These nullable fields
-- identify an optional GitHub repository without copying GitHub observations
-- into the synchronized Project row.
alter table if exists public.projects
  add column if not exists github_repository_id text,
  add column if not exists github_owner text,
  add column if not exists github_repo text;

create index if not exists projects_user_github_repository_id_idx
  on public.projects(user_id, github_repository_id)
  where github_repository_id is not null;

comment on column public.projects.github_repository_id is
  'Canonical GitHub repository identity selected by the user; nullable.';
comment on column public.projects.github_owner is
  'GitHub repository owner copied from the selected identity for display.';
comment on column public.projects.github_repo is
  'GitHub repository name copied from the selected identity for display.';
