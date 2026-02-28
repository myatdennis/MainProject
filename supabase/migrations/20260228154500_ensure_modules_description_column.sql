-- Ensure modules.description column exists for Course Builder autosave payloads
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'modules'
      and column_name = 'description'
  ) then
    alter table public.modules add column description text;
    update public.modules set description = '' where description is null;
    alter table public.modules alter column description set default '';
  else
    update public.modules set description = coalesce(description, '') where description is null;
    alter table public.modules alter column description set default '';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'modules'
      and column_name = 'client_temp_id'
  ) then
    alter table public.modules add column client_temp_id text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lessons'
      and column_name = 'client_temp_id'
  ) then
    alter table public.lessons add column client_temp_id text;
  end if;

  create unique index if not exists modules_course_client_temp_id_uq
    on public.modules (course_id, client_temp_id)
    where client_temp_id is not null;

  create unique index if not exists lessons_module_client_temp_id_uq
    on public.lessons (module_id, client_temp_id)
    where client_temp_id is not null;
exception
  when duplicate_column then
    null;
end$$;

notify pgrst, 'reload schema';
