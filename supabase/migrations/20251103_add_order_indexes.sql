-- Add helpful indexes for ordering and lookups
create index if not exists idx_modules_course_order on public.modules (course_id, order_index);
create index if not exists idx_lessons_module_order on public.lessons (module_id, order_index);

-- Ensure FKs exist (ignore errors if already present)
alter table public.modules
  add constraint modules_course_id_fkey
  foreign key (course_id) references public.courses(id)
  on delete cascade;

alter table public.lessons
  add constraint lessons_module_id_fkey
  foreign key (module_id) references public.modules(id)
  on delete cascade;
