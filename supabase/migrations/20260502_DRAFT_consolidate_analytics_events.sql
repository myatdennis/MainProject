-- DRAFT migration: consolidate RLS policies for public.analytics_events (AUTHENTICATED)
-- Generated: 2026-05-02
-- WARNING: Review and test in staging. This file is a DRAFT and the CREATE POLICY block is commented out.

-- Existing policies detected:
-- - owner_update    qual: ((( SELECT auth.uid() AS uid))::text = (user_id)::text)
-- - org_manage_update    qual: (EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (m.organization_id)::text))))

-- Optional: DROP old policies after verification (commented)
-- DROP POLICY IF EXISTS owner_update ON public.analytics_events;
-- DROP POLICY IF EXISTS org_manage_update ON public.analytics_events;

/*
-- Suggested consolidated policy: combine USING conditions with OR
CREATE POLICY consolidated_authenticated_update ON public.analytics_events
  FOR UPDATE
  TO authenticated
  USING (
    ((( SELECT auth.uid() AS uid))::text = (user_id)::text)
    OR
    (EXISTS ( SELECT 1 FROM organization_memberships m
              WHERE ((m.user_id = ( SELECT auth.uid() AS uid))
                 AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text]))
                 AND ((m.organization_id)::text = (m.organization_id)::text))))
  )
  WITH CHECK (
    ((( SELECT auth.uid() AS uid))::text = (user_id)::text)
  );
*/

-- To apply: remove the surrounding /* ... */ block, run migration in staging, validate behavior, then you can DROP the old policies and keep/rename the consolidated policy.
