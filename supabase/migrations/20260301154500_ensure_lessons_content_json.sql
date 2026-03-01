-- Ensure lessons table exposes content_json for PostgREST and the builder autosave pipeline.
do $$
begin
  -- If legacy installs still have a "content" column, rename it so PostgREST exposes content_json.
  if exists (
    select
      1
    from
      information_schema.columns
    where
      table_schema = 'public'
      and table_name = 'lessons'
      and column_name = 'content'
  ) then
    execute 'alter table public.lessons rename column content to content_json';
  end if;

  -- Add the column when it is totally missing (fresh installs that never had content/content_json).
  if not exists (
    select
      1
    from
      information_schema.columns
    where
      table_schema = 'public'
      and table_name = 'lessons'
      and column_name = 'content_json'
  ) then
    execute 'alter table public.lessons add column content_json jsonb not null default ''{}''::jsonb';
  end if;
end
$$ language plpgsql;
