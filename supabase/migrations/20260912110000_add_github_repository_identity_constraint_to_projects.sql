-- A Project is either GitHub-unlinked or linked to one complete repository
-- identity. Existing malformed partial tuples are normalized without touching
-- legacy repository/branch values or complete identities.
do $$
begin
  if to_regclass('public.projects') is not null then
    update public.projects
    set github_repository_id = null,
        github_owner = null,
        github_repo = null
    where not (
      (github_repository_id is null and github_owner is null and github_repo is null)
      or
      (github_repository_id is not null and github_owner is not null and github_repo is not null)
    );

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.projects'::regclass
        and conname = 'projects_github_identity_complete'
    ) then
      alter table public.projects
        add constraint projects_github_identity_complete check (
          (github_repository_id is null and github_owner is null and github_repo is null)
          or
          (github_repository_id is not null and github_owner is not null and github_repo is not null)
        );
    end if;
  end if;
end $$;
