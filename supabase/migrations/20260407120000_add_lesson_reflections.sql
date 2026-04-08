create table if not exists public.lesson_reflections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  response_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lesson_reflections_unique_scope
  on public.lesson_reflections (organization_id, course_id, lesson_id, user_id);

create index if not exists lesson_reflections_org_course_idx
  on public.lesson_reflections (organization_id, course_id, lesson_id);

create index if not exists lesson_reflections_user_idx
  on public.lesson_reflections (user_id, updated_at desc);

create or replace trigger lesson_reflections_set_updated_at
before update on public.lesson_reflections
for each row execute function public.set_updated_at();
