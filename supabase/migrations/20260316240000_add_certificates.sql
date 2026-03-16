-- Phase 4: Create certificates table
-- This table records issued certificates when a user completes a course.

create table if not exists public.certificates (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  course_id       uuid not null references public.courses(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  pdf_url         text,
  issued_at       timestamptz not null default timezone('utc', now()),
  metadata        jsonb not null default '{}',
  unique(user_id, course_id)
);

-- Ensure created_at is present for consistency with server ORDER BY created_at
alter table public.certificates
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.certificates enable row level security;

-- Learners can read their own certificates
create policy "cert_own_select"
  on public.certificates for select
  using ((select auth.uid()) = user_id);

-- Service role has full access (used by server-side API)
create policy "cert_service_all"
  on public.certificates
  using ((select auth.role()) = 'service_role');
