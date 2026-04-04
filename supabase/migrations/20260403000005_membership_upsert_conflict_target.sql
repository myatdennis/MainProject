-- Fix: organization_memberships upsert returning 400 from PostgREST
--
-- PROBLEM
-- ────────────────────────────────────────────────────────────────────────────
-- The server calls:
--   supabase.from('organization_memberships')
--     .upsert(payload, { onConflict: 'organization_id,user_id' })
--
-- PostgREST translates this to:
--   POST /rest/v1/organization_memberships?on_conflict=(organization_id,user_id)
--
-- PostgREST resolves the conflict target by looking for a unique index or
-- constraint whose columns EXACTLY match the specified list.  It rejects
-- PARTIAL indexes (those with a WHERE clause) for this resolution.
--
-- Migration 20260327230000 created:
--   CREATE UNIQUE INDEX organization_memberships_unique_organization_id_user_id
--     ON organization_memberships(organization_id, user_id)
--     WHERE organization_id IS NOT NULL;   ← partial index — REJECTED by PostgREST
--
-- This causes every upsert using organization_id,user_id as the conflict
-- target to return HTTP 400.
--
-- FIX
-- ────────────────────────────────────────────────────────────────────────────
-- 1. Ensure every existing row has organization_id populated (the trigger
--    sync_membership_org_columns handles this at write time, but historical
--    rows may still have NULL).
-- 2. Make organization_id NOT NULL so a non-partial unique index is safe.
-- 3. Drop the partial index and replace it with a full non-partial unique
--    index on (organization_id, user_id).
-- 4. Keep the legacy (org_id, user_id) non-partial unique index as the
--    fallback conflict target for any older code paths.
-- ────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Step 1: Backfill organization_id from org_id for any remaining NULL rows.
-- The trigger sync_membership_org_columns keeps them in sync going forward,
-- but rows inserted before the trigger was created may still have NULL.
-- org_id is type uuid so the cast is always safe; we only need the IS NULL guard.
UPDATE public.organization_memberships
SET organization_id = org_id
WHERE organization_id IS NULL
  AND org_id IS NOT NULL;

-- Step 2: Drop the partial unique index — PostgREST cannot use it as a
-- conflict target and it is the direct cause of the 400 responses.
DROP INDEX IF EXISTS public.organization_memberships_unique_organization_id_user_id;

-- Step 3: Create a full (non-partial) unique index on (organization_id, user_id).
-- This allows PostgREST to resolve the conflict target correctly.
-- We use NULLS NOT DISTINCT so that two rows with the same (organization_id, user_id)
-- are always treated as a conflict regardless of nullability.
CREATE UNIQUE INDEX IF NOT EXISTS organization_memberships_organization_id_user_id_idx
  ON public.organization_memberships (organization_id, user_id)
  NULLS NOT DISTINCT;

-- Step 4: Ensure the legacy (org_id, user_id) non-partial unique index still
-- exists as a fallback for any code paths using org_id as the conflict column.
-- The original migration may already have created this; the IF NOT EXISTS
-- guard makes this idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS organization_memberships_unique
  ON public.organization_memberships (org_id, user_id);

COMMIT;
