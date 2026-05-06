-- Launch readiness: restore the canonical organization membership uniqueness
-- constraint after removing legacy org_id compatibility triggers.

begin;

create unique index if not exists organization_memberships_unique
  on public.organization_memberships (organization_id, user_id)
  nulls not distinct;

commit;
