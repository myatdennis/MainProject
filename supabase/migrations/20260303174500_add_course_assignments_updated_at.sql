-- Ensure course_assignments timestamps exist for ordering
alter table if exists public.course_assignments
  add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

alter table if exists public.course_assignments
  add column if not exists updated_at timestamptz;

update public.course_assignments
set updated_at = coalesce(updated_at, created_at, timezone('utc'::text, now()));

create or replace function public.set_course_assignments_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  if new.created_at is null then
    new.created_at = timezone('utc'::text, now());
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists course_assignments_set_updated_at on public.course_assignments;

create trigger course_assignments_set_updated_at
before update on public.course_assignments
for each row execute function public.set_course_assignments_updated_at();
