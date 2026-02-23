begin;

-- Add missing columns expected by the API for /api/admin/courses

alter table public.courses
  add column if not exists duration integer;

alter table public.courses
  add column if not exists difficulty text;

-- Optional: reasonable defaults (safe; only affects new rows)
-- If you don't want defaults, comment these two lines out.
alter table public.courses
  alter column duration set default 0;

alter table public.courses
  alter column difficulty set default 'unspecified';

commit;