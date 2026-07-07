-- Migration: Drop legacy wide-open policies now superseded by correctly-scoped ones
-- Generated: 2026-07-07
-- Purpose: These 6 policies predate the org-scoping "_consolidated"/"_unified"
-- policies and are more permissive than them (a bare `true`, or membership of
-- any status rather than active), which meant the newer, properly-scoped
-- policy had no actual effect (permissive policies are OR'd, so the wider
-- one always wins). Now that 20260707000100_fix_organization_scoping_tautology.sql
-- corrected the org-scoping bug in the newer policies, these legacy ones can
-- be dropped so the intended restriction actually takes effect.
--
-- Verified before dropping: analytics_events and course_engagement have zero
-- direct frontend Supabase queries (backend/service-role only, which bypasses
-- RLS entirely). courses/lessons/modules have a few direct frontend calls,
-- but they're gated behind `if (VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY)`
-- / getSupabase() returning null when unconfigured — and netlify.toml's
-- production build environment does not set those vars, so those code paths
-- do not execute in production today. organizations has zero direct frontend
-- queries. So this is a real security-correctness fix (proper tenant
-- isolation now enforced) with no impact on current live application
-- behavior, and it only matters for direct external API access (e.g. a
-- leaked anon key, or local dev with real Supabase credentials configured).
--
-- org_invites' four action pairs are intentionally NOT included here: unlike
-- the tables above, each pair covers genuinely different, non-overlapping
-- cases (JWT platform-admin bypass vs. org owner/admin membership vs. an
-- "editor" role, and a created_by vs. inviter_id column split) that need a
-- product/business decision about intended permissions, not a mechanical
-- dedupe.

DROP POLICY IF EXISTS "analytics_insert" ON public."analytics_events";
DROP POLICY IF EXISTS "course_engagement_insert" ON public."course_engagement";
DROP POLICY IF EXISTS "courses_read" ON public."courses";
DROP POLICY IF EXISTS "lessons_read" ON public."lessons";
DROP POLICY IF EXISTS "modules_read" ON public."modules";
DROP POLICY IF EXISTS "organizations_read" ON public."organizations";
