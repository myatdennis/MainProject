begin;

-- Ensure gen_random_uuid() is available (Supabase usually has this already)
create extension if not exists pgcrypto;

do $$
declare
  id_type text;
begin
  select data_type
  into id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'analytics_events'
    and column_name  = 'id';

  if id_type is null then
    raise exception 'public.analytics_events.id column not found';
  end if;

  -- If id is uuid, use uuid default
  if id_type = 'uuid' then
    execute 'alter table public.analytics_events alter column id set default gen_random_uuid()';

  -- If id is text (or something else), store uuid as text
  else
    execute 'alter table public.analytics_events alter column id set default gen_random_uuid()::text';
  end if;
end $$;

commit;