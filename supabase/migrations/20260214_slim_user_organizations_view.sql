-- 2026-02-14 Ensure user_organizations_vw only references stable organization_memberships columns

DROP VIEW IF EXISTS public.user_organizations_vw;

CREATE OR REPLACE VIEW public.user_organizations_vw AS
SELECT
  m.user_id,
  m.org_id AS organization_id,
  m.org_id AS org_id,
  m.role,
  'active'::text AS status,
  NULL::timestamptz AS accepted_at,
  NULL::timestamptz AS last_seen_at,
  o.name AS organization_name,
  o.slug AS organization_slug,
  o.slug AS org_slug,
  o.status AS organization_status,
  o.subscription,
  o.features,
  o.created_at AS organization_created_at
FROM public.organization_memberships AS m
JOIN public.organizations AS o
  ON o.id = m.org_id;

GRANT SELECT ON public.user_organizations_vw TO anon;
GRANT SELECT ON public.user_organizations_vw TO authenticated;
GRANT SELECT ON public.user_organizations_vw TO service_role;
