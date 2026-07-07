-- Migration: Fix tautological organization_id self-comparison in RLS policies
-- Generated: 2026-07-07
-- Purpose: Every "_consolidated"/"org_manage_*"/"org_select" policy created by
-- the 20260511_consolidate_generated_rls_policies.sql /
-- 20260513_consolidate_authenticated_rls_policies.sql generators contains
-- the same bug: their EXISTS subquery compares
--   (m.organization_id)::text = (m.organization_id)::text
-- i.e. the organization_memberships alias compared to ITSELF, which is
-- always true (for any non-null organization_id). The subquery was meant
-- to scope membership to the SPECIFIC row's own organization_id, i.e.
--   (m.organization_id)::text = (<table>.organization_id)::text
-- As written, these policies only checked "is this user a member of ANY
-- organization" rather than "are they a member of THIS row's organization"
-- — cross-tenant scoping was not actually enforced by these policies.
--
-- This was found while investigating Supabase's multiple_permissive_policies
-- linter warnings: most of these tables still carry an older, honestly wide-
-- open policy (e.g. a bare `true` USING clause) that currently makes this bug
-- moot in practice, since permissive policies are OR'd and the older policy
-- is even more permissive than the buggy "restrictive" one. This migration
-- fixes the underlying scoping bug on its own; a separate pass is needed to
-- review and drop the legacy wide-open policies now that the intended
-- restriction is actually correct, since removing them is a real access
-- change that needs table-by-table verification.
--
-- Confirmed all 37 affected tables have a direct organization_id column, so
-- the fix (m.organization_id = m.organization_id) -> (m.organization_id =
-- <table>.organization_id) is uniform across every policy below. Generated
-- programmatically from the live pg_policies catalog and verified to leave
-- zero remaining tautological self-comparisons across all policies in the
-- public schema.

ALTER POLICY "authenticated_delete_consolidated" ON public."analytics_events"
  USING ((((( SELECT auth.uid() AS uid))::text = (user_id)::text) OR (EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (analytics_events.organization_id)::text))))));

ALTER POLICY "authenticated_insert_consolidated" ON public."analytics_events"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (analytics_events.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."analytics_events"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (analytics_events.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."audit_logs"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (audit_logs.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."audit_logs"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (audit_logs.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."audit_logs"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (audit_logs.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."audit_logs"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (audit_logs.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."certificates"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (certificates.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."certificates"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (certificates.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."certificates"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (certificates.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."certificates"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (certificates.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."course_assignments"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (course_assignments.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."course_assignments"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (course_assignments.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."course_assignments"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (course_assignments.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."course_assignments"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (course_assignments.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "org_manage_delete" ON public."course_engagement"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (course_engagement.organization_id)::text)))));

ALTER POLICY "org_manage_insert" ON public."course_engagement"
  WITH CHECK ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (course_engagement.organization_id)::text)))));

ALTER POLICY "org_manage_update" ON public."course_engagement"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (course_engagement.organization_id)::text)))));

ALTER POLICY "org_select" ON public."course_engagement"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (course_engagement.organization_id)::text)))));

ALTER POLICY "org_manage_delete" ON public."course_media_assets"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (course_media_assets.organization_id)::text)))));

ALTER POLICY "org_manage_insert" ON public."course_media_assets"
  WITH CHECK ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (course_media_assets.organization_id)::text)))));

ALTER POLICY "org_manage_update" ON public."course_media_assets"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (course_media_assets.organization_id)::text)))));

ALTER POLICY "org_select" ON public."course_media_assets"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (course_media_assets.organization_id)::text)))));

ALTER POLICY "authenticated_delete_consolidated" ON public."documents"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (documents.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = COALESCE((created_by)::text, (user_id)::text))));

ALTER POLICY "authenticated_insert_consolidated" ON public."documents"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (documents.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = COALESCE((created_by)::text, (user_id)::text))));

ALTER POLICY "authenticated_select_consolidated" ON public."documents"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (documents.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = COALESCE((created_by)::text, (user_id)::text))));

ALTER POLICY "authenticated_update_consolidated" ON public."documents"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (documents.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = COALESCE((created_by)::text, (user_id)::text))));

ALTER POLICY "authenticated_delete_consolidated" ON public."email_logs"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (email_logs.organization_id)::text)))));

ALTER POLICY "authenticated_insert_consolidated" ON public."email_logs"
  WITH CHECK ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (email_logs.organization_id)::text)))));

ALTER POLICY "authenticated_select_consolidated" ON public."email_logs"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (email_logs.organization_id)::text)))));

ALTER POLICY "authenticated_update_consolidated" ON public."email_logs"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (email_logs.organization_id)::text)))));

ALTER POLICY "authenticated_delete_consolidated" ON public."hdi_assessment_results"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (hdi_assessment_results.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."hdi_assessment_results"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (hdi_assessment_results.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."hdi_assessment_results"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (hdi_assessment_results.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."hdi_assessment_results"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (hdi_assessment_results.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."learner_journeys"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (learner_journeys.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."learner_journeys"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (learner_journeys.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."learner_journeys"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (learner_journeys.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."learner_journeys"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (learner_journeys.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."lesson_reflections"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (lesson_reflections.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."lesson_reflections"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (lesson_reflections.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."lesson_reflections"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (lesson_reflections.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."lesson_reflections"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (lesson_reflections.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "org_manage_delete" ON public."lessons"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (lessons.organization_id)::text)))));

ALTER POLICY "org_manage_insert" ON public."lessons"
  WITH CHECK ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (lessons.organization_id)::text)))));

ALTER POLICY "org_manage_update" ON public."lessons"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (lessons.organization_id)::text)))));

ALTER POLICY "org_select" ON public."lessons"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (lessons.organization_id)::text)))));

ALTER POLICY "authenticated_delete_consolidated" ON public."message_logs"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (message_logs.organization_id)::text)))));

ALTER POLICY "authenticated_insert_consolidated" ON public."message_logs"
  WITH CHECK ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (message_logs.organization_id)::text)))));

ALTER POLICY "authenticated_select_consolidated" ON public."message_logs"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (message_logs.organization_id)::text)))));

ALTER POLICY "authenticated_update_consolidated" ON public."message_logs"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (message_logs.organization_id)::text)))));

ALTER POLICY "org_manage_delete" ON public."modules"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (modules.organization_id)::text)))));

ALTER POLICY "org_manage_insert" ON public."modules"
  WITH CHECK ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (modules.organization_id)::text)))));

ALTER POLICY "org_manage_update" ON public."modules"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (modules.organization_id)::text)))));

ALTER POLICY "org_select" ON public."modules"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (modules.organization_id)::text)))));

ALTER POLICY "authenticated_delete_consolidated" ON public."notifications"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (notifications.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = COALESCE((user_id)::text, (created_by)::text))));

ALTER POLICY "authenticated_insert_consolidated" ON public."notifications"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (notifications.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = COALESCE((user_id)::text, (created_by)::text))));

ALTER POLICY "authenticated_select_consolidated" ON public."notifications"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (notifications.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = COALESCE((user_id)::text, (created_by)::text))));

ALTER POLICY "authenticated_update_consolidated" ON public."notifications"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (notifications.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = COALESCE((user_id)::text, (created_by)::text))));

ALTER POLICY "org_manage_delete" ON public."org_activation_events"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_activation_events.organization_id)::text)))));

ALTER POLICY "org_manage_insert" ON public."org_activation_events"
  WITH CHECK ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_activation_events.organization_id)::text)))));

ALTER POLICY "org_manage_update" ON public."org_activation_events"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_activation_events.organization_id)::text)))));

ALTER POLICY "org_select" ON public."org_activation_events"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (org_activation_events.organization_id)::text)))));

ALTER POLICY "org_manage_delete" ON public."org_activation_steps"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_activation_steps.organization_id)::text)))));

ALTER POLICY "org_manage_insert" ON public."org_activation_steps"
  WITH CHECK ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_activation_steps.organization_id)::text)))));

ALTER POLICY "org_manage_update" ON public."org_activation_steps"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_activation_steps.organization_id)::text)))));

ALTER POLICY "org_select" ON public."org_activation_steps"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (org_activation_steps.organization_id)::text)))));

ALTER POLICY "org_manage_delete" ON public."org_engagement_metrics"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_engagement_metrics.organization_id)::text)))));

ALTER POLICY "org_manage_insert" ON public."org_engagement_metrics"
  WITH CHECK ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_engagement_metrics.organization_id)::text)))));

ALTER POLICY "org_manage_update" ON public."org_engagement_metrics"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_engagement_metrics.organization_id)::text)))));

ALTER POLICY "org_select" ON public."org_engagement_metrics"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (org_engagement_metrics.organization_id)::text)))));

ALTER POLICY "authenticated_delete_consolidated" ON public."org_invites"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_invites.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (created_by)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."org_invites"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_invites.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (created_by)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."org_invites"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (org_invites.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (created_by)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."org_invites"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_invites.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (created_by)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."org_workspace_action_items"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_workspace_action_items.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (created_by)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."org_workspace_action_items"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_workspace_action_items.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (created_by)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."org_workspace_action_items"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (org_workspace_action_items.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (created_by)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."org_workspace_action_items"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_workspace_action_items.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (created_by)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."org_workspace_session_notes"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_workspace_session_notes.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (created_by)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."org_workspace_session_notes"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_workspace_session_notes.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (created_by)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."org_workspace_session_notes"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (org_workspace_session_notes.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (created_by)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."org_workspace_session_notes"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_workspace_session_notes.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (created_by)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."org_workspace_strategic_plans"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_workspace_strategic_plans.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = COALESCE((owner_id)::text, (created_by)::text))));

ALTER POLICY "authenticated_insert_consolidated" ON public."org_workspace_strategic_plans"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_workspace_strategic_plans.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = COALESCE((owner_id)::text, (created_by)::text))));

ALTER POLICY "authenticated_select_consolidated" ON public."org_workspace_strategic_plans"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (org_workspace_strategic_plans.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = COALESCE((owner_id)::text, (created_by)::text))));

ALTER POLICY "authenticated_update_consolidated" ON public."org_workspace_strategic_plans"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (org_workspace_strategic_plans.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = COALESCE((owner_id)::text, (created_by)::text))));

ALTER POLICY "org_manage_delete" ON public."organization_branding"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (organization_branding.organization_id)::text)))));

ALTER POLICY "org_manage_insert" ON public."organization_branding"
  WITH CHECK ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (organization_branding.organization_id)::text)))));

ALTER POLICY "org_manage_update" ON public."organization_branding"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (organization_branding.organization_id)::text)))));

ALTER POLICY "org_select" ON public."organization_branding"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (organization_branding.organization_id)::text)))));

ALTER POLICY "org_manage_delete" ON public."organization_contacts"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (organization_contacts.organization_id)::text)))));

ALTER POLICY "org_manage_insert" ON public."organization_contacts"
  WITH CHECK ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (organization_contacts.organization_id)::text)))));

ALTER POLICY "org_manage_update" ON public."organization_contacts"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (organization_contacts.organization_id)::text)))));

ALTER POLICY "org_select" ON public."organization_contacts"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (organization_contacts.organization_id)::text)))));

ALTER POLICY "authenticated_delete_consolidated" ON public."organization_members"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (organization_members.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."organization_members"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (organization_members.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."organization_members"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (organization_members.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."organization_members"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (organization_members.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "org_manage_delete" ON public."organization_messages"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (organization_messages.organization_id)::text)))));

ALTER POLICY "org_manage_insert" ON public."organization_messages"
  WITH CHECK ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (organization_messages.organization_id)::text)))));

ALTER POLICY "org_manage_update" ON public."organization_messages"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (organization_messages.organization_id)::text)))));

ALTER POLICY "org_select" ON public."organization_messages"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (organization_messages.organization_id)::text)))));

ALTER POLICY "org_manage_delete" ON public."organization_profiles"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (organization_profiles.organization_id)::text)))));

ALTER POLICY "org_manage_insert" ON public."organization_profiles"
  WITH CHECK ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (organization_profiles.organization_id)::text)))));

ALTER POLICY "org_manage_update" ON public."organization_profiles"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (organization_profiles.organization_id)::text)))));

ALTER POLICY "org_select" ON public."organization_profiles"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (organization_profiles.organization_id)::text)))));

ALTER POLICY "authenticated_delete_consolidated" ON public."quiz_attempts"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (quiz_attempts.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."quiz_attempts"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (quiz_attempts.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."quiz_attempts"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (quiz_attempts.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."quiz_attempts"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (quiz_attempts.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."survey_responses"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (survey_responses.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."survey_responses"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (survey_responses.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."survey_responses"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (survey_responses.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."survey_responses"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (survey_responses.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."team_huddle_comments"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (team_huddle_comments.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."team_huddle_comments"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (team_huddle_comments.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."team_huddle_comments"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (team_huddle_comments.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."team_huddle_comments"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (team_huddle_comments.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."team_huddle_post_reactions"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (team_huddle_post_reactions.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."team_huddle_post_reactions"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (team_huddle_post_reactions.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."team_huddle_post_reactions"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (team_huddle_post_reactions.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."team_huddle_post_reactions"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (team_huddle_post_reactions.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."team_huddle_posts"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (team_huddle_posts.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."team_huddle_posts"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (team_huddle_posts.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."team_huddle_posts"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (team_huddle_posts.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."team_huddle_posts"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (team_huddle_posts.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."team_huddle_reactions"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (team_huddle_reactions.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."team_huddle_reactions"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (team_huddle_reactions.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."team_huddle_reactions"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (team_huddle_reactions.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."team_huddle_reactions"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (team_huddle_reactions.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "org_manage_delete" ON public."team_huddle_reports"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (team_huddle_reports.organization_id)::text)))));

ALTER POLICY "org_manage_insert" ON public."team_huddle_reports"
  WITH CHECK ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (team_huddle_reports.organization_id)::text)))));

ALTER POLICY "org_manage_update" ON public."team_huddle_reports"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (team_huddle_reports.organization_id)::text)))));

ALTER POLICY "org_select" ON public."team_huddle_reports"
  USING ((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (team_huddle_reports.organization_id)::text)))));

ALTER POLICY "authenticated_delete_consolidated" ON public."user_achievements"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (user_achievements.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."user_achievements"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (user_achievements.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."user_achievements"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (user_achievements.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."user_achievements"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (user_achievements.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."user_activity_log"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (user_activity_log.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."user_activity_log"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (user_activity_log.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."user_activity_log"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (user_activity_log.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."user_activity_log"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (user_activity_log.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."user_gamification_profile"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (user_gamification_profile.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."user_gamification_profile"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (user_gamification_profile.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."user_gamification_profile"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (user_gamification_profile.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."user_gamification_profile"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (user_gamification_profile.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_delete_consolidated" ON public."user_lesson_progress"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (user_lesson_progress.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_insert_consolidated" ON public."user_lesson_progress"
  WITH CHECK (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (user_lesson_progress.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_select_consolidated" ON public."user_lesson_progress"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND ((m.organization_id)::text = (user_lesson_progress.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

ALTER POLICY "authenticated_update_consolidated" ON public."user_lesson_progress"
  USING (((EXISTS ( SELECT 1 FROM organization_memberships m WHERE ((m.user_id = ( SELECT auth.uid() AS uid)) AND (lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND ((m.organization_id)::text = (user_lesson_progress.organization_id)::text)))) OR ((( SELECT auth.uid() AS uid))::text = (user_id)::text)));

