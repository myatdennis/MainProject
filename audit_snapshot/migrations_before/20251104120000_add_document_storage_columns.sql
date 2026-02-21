alter table public.documents
  add column if not exists storage_path text,
  add column if not exists url_expires_at timestamptz,
  add column if not exists file_size bigint;

create index if not exists documents_storage_path_idx on public.documents(storage_path);
