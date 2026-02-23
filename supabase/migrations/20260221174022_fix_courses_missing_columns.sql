begin;

-- Fix Admin Courses 500s: backend expects these columns to exist
alter table public.courses
  add column if not exists difficulty text;

alter table public.courses
  add column if not exists thumbnail text;

commit;