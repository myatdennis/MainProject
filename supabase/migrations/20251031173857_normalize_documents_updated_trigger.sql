-- Ensure documents table exists (matches your earlier schema)
create table if not exists public.documents (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  filename text,
  url text,
  category text not null,
  subcategory text,
  tags jsonb not null default '[]'::jsonb,
  file_type text,
  visibility text not null default 'global',
  org_id text,
  user_id text,
  created_at timestamptz not null default now(),
  created_by text,
  download_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

-- Ensure updated_at column
alter table public.documents
  add column if not exists updated_at timestamptz not null default now();

-- Normalize the trigger function (drop anything bad, then recreate)
drop function if exists public.set_updated_at();
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Create the trigger if missing
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'documents_set_updated_at'
      and tgrelid = 'public.documents'::regclass
  ) then
    create trigger documents_set_updated_at
      before update on public.documents
      for each row
      execute function public.set_updated_at();
  end if;
end $$;

-- Recreate the download incrementer (NOT a trigger; it's a plain SQL function)
create or replace function public.increment_document_download(doc_id text)
returns public.documents
language sql
security definer
set search_path = public
as $fn$
  update public.documents
     set download_count = download_count + 1,
         updated_at     = now()
   where id = doc_id
   returning *;
$fn$;
