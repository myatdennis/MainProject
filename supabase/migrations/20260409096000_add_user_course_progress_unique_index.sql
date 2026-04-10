-- Launch-readiness schema contract: ensure canonical unique index exists.
-- Required by scripts/verify_launch_readiness_schema.mjs

begin;

create unique index if not exists user_course_progress_unique
  on public.user_course_progress (user_id, course_id);

commit;

