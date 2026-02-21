-- MISMATCH REPORT ------------------------------------------------------------
-- 1) Table `public.course_media_assets` (plus its trigger function/policy) is
--    absent from current_schema_inventory.csv even though the server uploads
--    (server/services/mediaService.js) call `supabase.from('course_media_assets')`
--    and migration 20260112_media_assets.sql defines it. Missing columns are
--    blocking media uploads and org-aware tracking.
-- 2) `storage.objects` still has the original "Public can view" / "Authenticated
--    users can upload" policies (see current_rls_policies.csv) which do not
--    enforce organization scoping. The backend now requires org-aware access
--    (see mediaService + ADMIN_PHASE4_MEDIA_PIPELINE_AUDIT.md), so we must drop
--    the permissive policies and replace them with org-member READ policies that
--    leverage `course_media_assets`.
-------------------------------------------------------------------------------

begin;

-------------------------------------------------------------------------------
-- Tables + Columns
-------------------------------------------------------------------------------

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

-------------------------------------------------------------------------------
-- Indexes
-------------------------------------------------------------------------------

create index if not exists course_media_assets_course_idx on public.course_media_assets(course_id);
create index if not exists course_media_assets_lesson_idx on public.course_media_assets(lesson_id);
create index if not exists course_media_assets_org_idx on public.course_media_assets(org_id);
create index if not exists course_media_assets_storage_idx on public.course_media_assets(bucket, storage_path);

-------------------------------------------------------------------------------
-- Functions & Triggers
-------------------------------------------------------------------------------

create or replace function public.course_media_assets_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists course_media_assets_updated_at on public.course_media_assets;
create trigger course_media_assets_updated_at
before update on public.course_media_assets
for each row
execute procedure public.course_media_assets_set_updated_at();

-------------------------------------------------------------------------------
-- Row Level Security + Policies
-------------------------------------------------------------------------------

alter table public.course_media_assets enable row level security;

drop policy if exists "allow org members" on public.course_media_assets;
create policy "allow org members" on public.course_media_assets
  using (
    org_id is null
    or exists (
      select 1
      from public.organization_memberships m
      where m.org_id = public.course_media_assets.org_id
        and m.user_id = auth.uid()
        and coalesce(m.status, 'active') = 'active'
    )
  );

-------------------------------------------------------------------------------
-- Storage bucket tightening (course media buckets only)
-------------------------------------------------------------------------------

alter table storage.objects enable row level security;

drop policy if exists "Public can view course videos" on storage.objects;
drop policy if exists "Public can view course resources" on storage.objects;
drop policy if exists "Authenticated users can upload course videos" on storage.objects;
drop policy if exists "Authenticated users can upload course resources" on storage.objects;
drop policy if exists "Authenticated users can update course videos" on storage.objects;
drop policy if exists "Authenticated users can update course resources" on storage.objects;
drop policy if exists "Authenticated users can delete course videos" on storage.objects;
drop policy if exists "Authenticated users can delete course resources" on storage.objects;

create policy if not exists "Org members read course media"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id in ('course-videos', 'course-resources')
    and exists (
      select 1
      from public.course_media_assets cma
      where cma.bucket = storage.objects.bucket_id
        and cma.storage_path = storage.objects.name
        and (
          cma.org_id is null
          or public._is_org_member(cma.org_id)
        )
    )
  );

-- Writes are handled via the backend service-role key, which bypasses RLS.

commit;

-------------------------------------------------------------------------------
-- VERIFY
-------------------------------------------------------------------------------
-- select count(*) from information_schema.columns
--   where table_schema = 'public' and table_name = 'course_media_assets';
-- select tablename, policyname from pg_policies
--   where schemaname = 'storage' and tablename = 'objects';
