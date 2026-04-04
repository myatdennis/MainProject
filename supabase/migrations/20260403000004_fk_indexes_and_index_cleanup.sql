-- Fix Supabase linter warnings:
--   unindexed_foreign_keys  (5 missing FK covering indexes)
--   unused_index            (selectively drop provably redundant indexes)
--
-- PHILOSOPHY ON "UNUSED" INDEXES
-- ────────────────────────────────────────────────────────────────────────────
-- Supabase's unused_index lint fires whenever pg_stat_user_indexes shows
-- zero scans since the last stats reset.  On a recently-deployed or
-- restarted database this is EVERY index — including essential FK indexes.
-- Blindly dropping all flagged indexes would immediately re-trigger the
-- unindexed_foreign_keys warning for those same columns.
--
-- We therefore only drop indexes that are provably redundant:
--   1. The column is already covered by a composite unique constraint or
--      a composite index that leads with the same column (so the planner
--      will use the composite instead).
--   2. The column carries no FK constraint and the query pattern is
--      low-frequency enough that a seq-scan is acceptable.
--   3. The index duplicates another index on the same column(s).
--
-- All other "unused" indexes that back real FK columns are LEFT IN PLACE.
-- They will appear in the linter until the first time they are scanned.
-- ────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 1 — Add the 5 missing FK covering indexes
-- (these were dropped in 20260316290000 and never restored)
-- ════════════════════════════════════════════════════════════════════════════

-- certificates → course_id  (certificates_course_id_fkey)
CREATE INDEX IF NOT EXISTS certificates_course_id_idx
  ON public.certificates (course_id);

-- certificates → organization_id  (certificates_organization_id_fkey)
CREATE INDEX IF NOT EXISTS certificates_organization_id_idx
  ON public.certificates (organization_id);

-- course_assignments → assigned_by  (course_assignments_assigned_by_fkey)
CREATE INDEX IF NOT EXISTS course_assignments_assigned_by_idx
  ON public.course_assignments (assigned_by);

-- learner_journeys → organization_id  (learner_journeys_organization_id_fkey)
CREATE INDEX IF NOT EXISTS learner_journeys_organization_id_idx
  ON public.learner_journeys (organization_id);

-- user_lesson_progress → organization_id  (user_lesson_progress_organization_id_fkey)
CREATE INDEX IF NOT EXISTS user_lesson_progress_organization_id_idx
  ON public.user_lesson_progress (organization_id);

-- ════════════════════════════════════════════════════════════════════════════
-- PART 2 — Drop provably redundant "unused" indexes
-- ════════════════════════════════════════════════════════════════════════════

-- organization_memberships_organization_id_idx
--   Redundant: covered by the composite unique constraint
--   (organization_id, user_id) which the planner prefers for all lookups
--   that filter by organization_id alone.
DROP INDEX IF EXISTS public.organization_memberships_organization_id_idx;

-- organization_memberships_user_id_idx
--   Redundant: same composite unique constraint covers user_id-leading scans.
DROP INDEX IF EXISTS public.organization_memberships_user_id_idx;

-- org_invites_organization_id_idx (on organization_id column)
--   Redundant: org_invites_org_idx already covers the canonical org_id column;
--   all RLS and server queries were updated to use org_id.
--   The organization_id column is a migration-era alias kept for compatibility
--   but not queried independently.
DROP INDEX IF EXISTS public.org_invites_organization_id_idx;

-- idx_user_profiles_email  (functional index on lower(email))
--   Redundant: user_profiles has a UNIQUE constraint on email which already
--   provides an index. The lower() functional variant adds overhead without
--   benefit since emails are stored normalized to lowercase at insert time.
DROP INDEX IF EXISTS public.idx_user_profiles_email;

-- assignments_client_request_id_idx
--   The client_request_id column carries no FK constraint and is used only
--   for occasional deduplication checks, which are already handled in-memory
--   by the idempotency layer. Removing this index reduces write overhead on
--   the hot assignments table.
DROP INDEX IF EXISTS public.assignments_client_request_id_idx;

-- course_media_assets_lesson_idx  (on lesson_id)
--   lesson_id carries no FK constraint (lesson_id is nullable/informational).
--   The table is queried by course_id and org_id in practice.
DROP INDEX IF EXISTS public.course_media_assets_lesson_idx;

-- course_media_assets_org_idx  (on org_id)
--   Redundant with the RLS policy which filters via organization_memberships
--   (the join selectivity makes this index unhelpful at current table size).
--   course_media_assets_course_idx and course_media_assets_storage_idx
--   cover all real query patterns.
DROP INDEX IF EXISTS public.course_media_assets_org_idx;

COMMIT;
