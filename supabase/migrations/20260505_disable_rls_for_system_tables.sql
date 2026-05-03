-- Migration: Disable RLS for system / internal tables
-- Generated: 2026-04-30
-- Purpose: Disable Row Level Security on non-user-facing/system/backup tables so service_role
-- and server-side processes can operate without needing policies. This migration is idempotent.

-- Logging / audit
ALTER TABLE IF EXISTS public.analytics_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auth_audit DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rls_audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_logs DISABLE ROW LEVEL SECURITY;

-- Idempotency / backend control
ALTER TABLE IF EXISTS public.idempotency_keys DISABLE ROW LEVEL SECURITY;

-- System-generated engagement / tracking
ALTER TABLE IF EXISTS public.course_engagement DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.org_engagement_metrics DISABLE ROW LEVEL SECURITY;

-- Internal workflow / system tables
ALTER TABLE IF EXISTS public.org_activation_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.org_activation_steps DISABLE ROW LEVEL SECURITY;

-- Messaging logs (NOT user-facing threads)
ALTER TABLE IF EXISTS public.message_logs DISABLE ROW LEVEL SECURITY;

-- Certificates / system outputs
ALTER TABLE IF EXISTS public.certificates DISABLE ROW LEVEL SECURITY;

-- Optional (only if NOT directly user-facing)
ALTER TABLE IF EXISTS public.learner_journeys DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_activity_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_gamification_profile DISABLE ROW LEVEL SECURITY;

-- BACKUP / LEGACY TABLES (SAFE TO CLEAN)
ALTER TABLE IF EXISTS public._backup_org_onboarding_progress_vw DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public._policy_backup DISABLE ROW LEVEL SECURITY;

-- NOTES:
-- - This migration deliberately disables RLS for designated system/internal tables. Ensure you
--   only apply to environments where this is acceptable (staging, production with service_role protections, etc.).
-- - If you prefer to retain RLS but add service-only policies, let me know and I can convert these to
--   targeted policies instead of blanket DISABLEs.
