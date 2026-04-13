-- Migration: drop duplicate index on user_course_progress
-- Date: 2026-04-13
-- The linter identified identical indexes: user_course_progress_pkey and user_course_progress_unique
-- Recommendation: keep the primary key (user_course_progress_pkey) and drop the duplicate unique index.

-- IMPORTANT: Confirm which index enforces the primary key / unique constraint before running.
-- If user_course_progress_unique is used as a constraint, dropping it may remove a constraint. The primary key
-- is normally enforced by the pkey. Verify in your DB before applying.

-- Backup step: create a SQL file that contains the CREATE INDEX definition for the duplicate index (use scripts/collect_unused_index_defs.sql)
-- Run safely with psql during a maintenance window.

DROP INDEX CONCURRENTLY IF EXISTS public.user_course_progress_unique;

-- End of migration
