-- Phase 4 media pipeline: course media asset registry + signed URL metadata
create table if not exists public.course_media_assets (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  module_id uuid,
  lesson_id uuid,
  org_id uuid,
  bucket text not null,
  storage_path text not null,
  mime_type text,
  bytes bigint,
  checksum text,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),
  source text default 'api',
  status text default 'uploaded',
  metadata jsonb default '{}'::jsonb,
  signed_url text,
  signed_url_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_media_assets_course_idx on public.course_media_assets(course_id);
create index if not exists course_media_assets_lesson_idx on public.course_media_assets(lesson_id);
create index if not exists course_media_assets_org_idx on public.course_media_assets(org_id);
create index if not exists course_media_assets_storage_idx on public.course_media_assets(bucket, storage_path);

create or replace function public.course_media_assets_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger course_media_assets_updated_at
before update on public.course_media_assets
for each row execute procedure public.course_media_assets_set_updated_at();

alter table public.course_media_assets enable row level security;

drop policy if exists "allow org members" on public.course_media_assets;
create policy "allow org members" on public.course_media_assets
  using (
    org_id is null
    or exists (
      select 1 from public.organization_memberships m
      where m.org_id = course_media_assets.org_id
        and m.user_id = auth.uid()
        and coalesce(m.status, 'active') = 'active'
    )
  );
