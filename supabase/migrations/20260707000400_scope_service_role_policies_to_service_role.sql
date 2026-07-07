-- Migration: Scope service-role bypass policies to the service_role role only
-- Generated: 2026-07-07
-- Purpose: 14 policies (named *_service_only / *_service_access /
-- *_service_full_access) were defined with `roles={public}` and a
-- conditional check `auth.role() = 'service_role'`. Since roles={public}
-- applies to every role including anon/authenticated, Postgres evaluates
-- this policy (and the auth.role() function call) on every query for every
-- role, even though the condition is always false for non-service-role
-- sessions and never actually grants them anything. This is exactly what
-- Supabase's multiple_permissive_policies linter flags: these policies
-- "overlap" with the real authenticated-scoped policies on the same
-- table/action, even though they never contribute any actual access.
--
-- Fix: scope roles to {service_role} explicitly with an unconditional
-- `true` check (the same pattern _policy_backup_service_only already used
-- correctly). This lets Postgres skip evaluating the policy entirely for
-- non-service-role sessions (real performance win, not just fewer function
-- calls), and removes the linter-flagged overlap, since the policy no
-- longer applies to authenticated/anon/app_readonly roles at all.
--
-- Zero behavior change: service_role sessions still get unconditional
-- access (true, same as before when auth.role() = 'service_role' was true
-- for them); non-service-role sessions never matched the old condition
-- either, so they lose nothing.

ALTER POLICY "analytics_events_service_only" ON public."analytics_events" TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "audit_logs_service_only" ON public."audit_logs" TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "auth_audit_service_only" ON public."auth_audit" TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "certificates_service_only" ON public."certificates" TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "course_engagement_service_only" ON public."course_engagement" TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "email_logs_service_only" ON public."email_logs" TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "idempotency_keys_service_only" ON public."idempotency_keys" TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "message_logs_service_only" ON public."message_logs" TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "org_activation_events_service_only" ON public."org_activation_events" TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "org_activation_steps_service_only" ON public."org_activation_steps" TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "org_engagement_metrics_service_only" ON public."org_engagement_metrics" TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "org_invites_service_full_access" ON public."org_invites" TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "organization_profiles_service_access" ON public."organization_profiles" TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "rls_audit_log_service_only" ON public."rls_audit_log" TO service_role USING (true) WITH CHECK (true);
