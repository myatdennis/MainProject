-- STEP 3: Harden schema so server and Supabase stay in sync
-- Ensure consistent memberships surface, learner notifications metadata, and analytics idempotency key support.

BEGIN;

-- 1) Recreate the membership view with the exact columns expected by the server
CREATE OR REPLACE VIEW public.user_organizations_vw AS
SELECT
  om.user_id,
  om.org_id AS organization_id,
  COALESCE(NULLIF(om.role, ''), 'member') AS role,
  'active'::text AS status,
  org.name AS organization_name,
  org.status AS organization_status,
  org.subscription,
  org.features,
  om.created_at AS accepted_at,
  om.updated_at AS last_seen_at
FROM public.organization_memberships AS om
LEFT JOIN public.organizations AS org
  ON org.id = om.org_id;

GRANT SELECT ON public.user_organizations_vw TO anon;
GRANT SELECT ON public.user_organizations_vw TO authenticated;
GRANT SELECT ON public.user_organizations_vw TO service_role;

-- 2) Ensure notifications have a dispatch_status column available for server writes/reads
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dispatch_status text;

UPDATE public.notifications
SET dispatch_status = COALESCE(dispatch_status, 'queued');

ALTER TABLE public.notifications
  ALTER COLUMN dispatch_status SET DEFAULT 'queued';

-- 3) Ensure analytics events can store client_event_id for idempotency
ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS client_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_client_event_id_key
  ON public.analytics_events (client_event_id)
  WHERE client_event_id IS NOT NULL;

COMMIT;
