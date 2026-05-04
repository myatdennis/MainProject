
-- Consolidation migration for storage.objects INSERT policies (safe, idempotent)
-- Generated: 2026-05-02 (finalized)
-- Purpose: replace unconditional INSERT policies for storage.objects with explicit, scoped
-- policies that restrict uploads to specific buckets and verify ownership or org membership.
--
-- IMPORTANT: This migration makes assumptions about how ownership/org are represented on
-- storage.objects rows. Read the "Assumptions" section below and adapt if your schema
-- stores owner/org on different columns or uses server-side stamping.

-- Assumptions
--  - storage.objects.bucket_id (text) contains the bucket name (e.g. 'avatars', 'org-assets')
--  - storage.objects.metadata is jsonb and, for uploads, contains either:
--      - metadata->>'user_id'    (string) for avatar uploads
--      - metadata->>'organization_id' (string) for org-asset uploads
--  - public.organization_memberships exists and has columns (organization_id uuid, user_id uuid, status text)
--  - public.is_org_admin_for(uuid) exists (SECURITY DEFINER) and is callable by authenticated role

BEGIN;

-- 1) Drop previously-named unconditional policies if they exist. Replace names below if your DB
-- uses different policy names. Using IF EXISTS keeps this idempotent.
DROP POLICY IF EXISTS "Users upload own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Org members upload org-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload avatars + org-assets" ON storage.objects;

-- 2) Ensure authenticated has rights needed for the membership checks used below. These grants are
-- idempotent and safe to include if the objects/function already permit access.
GRANT SELECT ON public.organization_memberships TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin_for(uuid) TO authenticated;

-- 3) Create a conservative policy for uploading avatars to the 'avatars' bucket.
--    - Only allow inserts where metadata.user_id matches the authenticated user
--    - This prevents a user from creating an avatar object for someone else
CREATE POLICY IF NOT EXISTS storage_objects_insert_avatars_authenticated
	ON storage.objects
	FOR INSERT
	TO authenticated
	WITH CHECK (
		bucket_id = 'avatars'
		AND coalesce((metadata->>'user_id'), '') = auth.uid()
	);

-- 4) Create a policy allowing active org members to insert org-assets into the 'org-assets' bucket.
--    Uses an EXISTS check against organization_memberships. Compare auth.uid() to the stored user_id
--    by casting to text which tolerates uuid/text differences across schemas.
CREATE POLICY IF NOT EXISTS storage_objects_insert_org_assets_members
	ON storage.objects
	FOR INSERT
	TO authenticated
	WITH CHECK (
		bucket_id = 'org-assets'
		AND (metadata->>'organization_id') IS NOT NULL
		AND EXISTS (
			SELECT 1 FROM public.organization_memberships om
			WHERE om.organization_id = (metadata->>'organization_id')::uuid
				AND om.user_id::text = auth.uid()
				AND om.status = 'active'
		)
	);

-- 5) Optionally allow org admins (via is_org_admin_for) to insert org-assets as well.
--    This is stricter if your is_org_admin_for function encapsulates admin logic.
CREATE POLICY IF NOT EXISTS storage_objects_insert_org_assets_admins
	ON storage.objects
	FOR INSERT
	TO authenticated
	WITH CHECK (
		bucket_id = 'org-assets'
		AND (metadata->>'organization_id') IS NOT NULL
		AND public.is_org_admin_for((metadata->>'organization_id')::uuid)
	);

COMMIT;

-- Testing notes (manual):
-- 1) As a normal authenticated user, attempt to insert an object with:
--      bucket_id = 'avatars', metadata->>'user_id' = auth.uid()   => should succeed
-- 2) As the same user, attempt to insert with metadata->>'user_id' != auth.uid() => should fail
-- 3) As an active org member, attempt to insert to bucket_id = 'org-assets' with metadata->>'organization_id'=orgId => should succeed
-- 4) As a non-member, same attempt should fail
--
-- If your upload flow stamps ownership server-side, prefer that and change the WITH CHECK
-- expressions to reference server-set columns rather than client-provided metadata.
