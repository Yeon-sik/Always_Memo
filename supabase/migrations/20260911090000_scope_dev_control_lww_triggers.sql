-- Keep server-side LWW protection on the note/task and Dev Control sync
-- contracts only. Fitness-owned and external projection tables retain their
-- existing write semantics and are not governed by this trigger.
do $$
declare
  table_name text;
begin
  foreach table_name in array[
    'workout_records',
    'meal_records',
    'weight_records',
    'fitness_summary_projections_v2'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      table_name || '_lww_guard',
      table_name
    );
  end loop;

  foreach table_name in array[
    'notes',
    'tasks',
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
