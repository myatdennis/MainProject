-- DRAFT migration: consolidation guidance for storage.objects INSERT (AUTHENTICATED)
-- Generated: 2026-05-02
-- WARNING: This group contains unconditional policies. Manual review required.

-- Existing policies detected:
-- - Users upload own avatars    qual: <null or unconditional>
-- - Org members upload org-assets    qual: <null or unconditional>
-- - Authenticated upload avatars + org-assets    qual: <null or unconditional>

-- Because these policies are unconditional, naive consolidation would produce a permissive policy.
-- Suggested actions:
-- 1) Replace unconditional policies with explicit USING conditions that reflect intended restrictions (e.g., bucket_id checks and owner checks).
-- 2) After converting to conditional policies, use a consolidation migration similar to others.

-- Draft consolidation is intentionally omitted because it would be unsafe to auto-create a permissive policy here.
