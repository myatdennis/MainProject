create or replace view public.user_organizations_vw as
select
  uo.user_id,
  uo.organization_id,
  o.name as organization_name,
  uo.role,
  uo.status,
  uo.created_at,
  uo.updated_at
from public.user_organizations uo
join public.organizations o
  on o.id = uo.organization_id;

grant select on public.user_organizations_vw to authenticated;
grant select on public.user_organizations_vw to service_role;
grant select on public.user_organizations_vw to anon;
