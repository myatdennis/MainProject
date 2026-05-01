-- Launch readiness: restore unique indexes required by verification.
-- Current production schema uses organization_memberships.organization_id
-- and no longer has the legacy org_id column.

begin;

create unique index if not exists organization_memberships_unique
  on public.organization_memberships (organization_id, user_id)
  nulls not distinct;

create unique index if not exists user_course_progress_unique
  on public.user_course_progress (user_id, course_id);

commit;
