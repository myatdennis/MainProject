-- Align user_organizations_vw columns with application expectations.
DROP VIEW IF EXISTS public.user_organizations_vw;

CREATE VIEW public.user_organizations_vw AS
SELECT
  m.user_id,
  m.organization_id,
  m.role,
  COALESCE(m.status, 'active') AS status,
  COALESCE(m.is_active, true) AS is_active,
  m.accepted_at,
  m.created_at,
  m.updated_at,
  m.last_seen_at,
  o.name AS organization_name,
  o.slug AS organization_slug,
  o.status AS organization_status,
  o.subscription,
  o.features
FROM public.organization_memberships AS m
JOIN public.organizations AS o
  ON o.id = m.organization_id;

GRANT SELECT ON public.user_organizations_vw TO anon;
GRANT SELECT ON public.user_organizations_vw TO authenticated;
GRANT SELECT ON public.user_organizations_vw TO service_role;

-- Verification (run manually):
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='user_organizations_vw';
