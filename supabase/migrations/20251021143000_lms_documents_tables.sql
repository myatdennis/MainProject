create extension if not exists "uuid-ossp";

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

create index if not exists documents_visibility_idx on public.documents(visibility);
create index if not exists documents_org_idx on public.documents(org_id);
create index if not exists documents_user_idx on public.documents(user_id);
create index if not exists documents_category_idx on public.documents(category);

create or replace function public.increment_document_download(doc_id text)
returns public.documents as $$
  update public.documents
     set download_count = download_count + 1
   where id = doc_id
   returning *;
$$ language sql security definer;
