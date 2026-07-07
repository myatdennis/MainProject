-- Migration: Drop redundant permissive RLS policies (multiple_permissive_policies lint)
-- Generated: 2026-07-07
-- Purpose: Supabase's performance linter flagged 21 table/action/role groups
-- with multiple overlapping permissive policies. Of those, these 8 policies
-- are pure duplicates or fully subsumed by a sibling policy on the same
-- table/action, so dropping them changes nothing about who can access what
-- (permissive policies are OR'd; a strict duplicate or subset contributes no
-- additional access beyond what its sibling already grants).
--
-- Not included here (deliberately, needs individual review, not a mechanical
-- drop): org_invites (4 actions), organizations SELECT, and any table where
-- the "true"/wide-open legacy policy currently masks a real access
-- restriction that the newer policy is meant to enforce (analytics_events,
-- course_engagement, courses, lessons, modules) — see
-- 20260707000100_fix_organization_scoping_tautology.sql for the related bug
-- fix on those tables' restrictive policies. Dropping their legacy
-- wide-open policies is a real behavior change and is intentionally left
-- for a separate, carefully verified pass.

-- _policy_backup: identical effect to _policy_backup_service_only
-- (auth.role() = 'service_role' vs roles={service_role} + true — same set of
-- callers satisfy either).
DROP POLICY IF EXISTS "_policy_backup_service_access" ON public."_policy_backup";

-- audit_logs: byte-identical USING/WITH CHECK to audit_logs_service_only.
DROP POLICY IF EXISTS "audit_logs_service_access" ON public."audit_logs";

-- idempotency_keys: both are no-op (always-false) policies for the
-- authenticated role, contributing nothing to the permissive OR regardless
-- of idempotency_keys_service_only (the actual service-role bypass).
DROP POLICY IF EXISTS "deny_authenticated" ON public."idempotency_keys";
DROP POLICY IF EXISTS "idempotency_keys_server_only" ON public."idempotency_keys";

-- rls_audit_log: same no-op-false pattern as idempotency_keys above.
DROP POLICY IF EXISTS "deny_authenticated" ON public."rls_audit_log";

-- organization_courses: organization_courses_select_unified's condition is a
-- strict superset (same active-membership check, plus an additional
-- platform_admin OR-branch) of organization_courses_member_read.
DROP POLICY IF EXISTS "organization_courses_member_read" ON public."organization_courses";

-- organization_memberships: organization_memberships_select_unified's
-- condition is a strict superset (same self-user_id check, plus admin/owner
-- and platform_admin OR-branches) of memberships_read.
DROP POLICY IF EXISTS "memberships_read" ON public."organization_memberships";

-- user_profiles: profiles_update_self (id = auth.uid()) and
-- users_update_own_profile (auth.uid() = id) are the same condition with
-- operands swapped — byte-for-byte equivalent.
DROP POLICY IF EXISTS "profiles_update_self" ON public."user_profiles";
