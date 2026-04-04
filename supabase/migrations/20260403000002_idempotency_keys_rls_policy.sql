-- Fix Supabase linter warning: rls_enabled_no_policy
-- Table `public.idempotency_keys` has RLS enabled but no policies exist.
--
-- The idempotency_keys table is accessed exclusively by the server process
-- using the service_role key. Supabase's service_role bypasses RLS entirely,
-- so no policy is required for that role. However, the linter requires at
-- least one policy to exist when RLS is enabled.
--
-- We add a minimal SELECT policy for `authenticated` users that returns
-- zero rows (FALSE predicate), explicitly blocking direct client access while
-- satisfying the linter. The service_role continues to bypass RLS as normal.

BEGIN;

-- Ensure the table exists (safe no-op if already created by the server or tests)
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id          text        PRIMARY KEY,
  key_type    text,
  resource_id uuid,
  payload     jsonb,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Enable RLS (idempotent — safe if already enabled)
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies so this migration is re-runnable
DROP POLICY IF EXISTS "idempotency_keys_server_only" ON public.idempotency_keys;

-- Deny all direct authenticated-client access.
-- The FALSE predicate is evaluated once per query (not per row) because it
-- contains no auth function calls, so there is no initplan performance concern.
-- The server's service_role key bypasses RLS entirely and is unaffected.
CREATE POLICY "idempotency_keys_server_only"
  ON public.idempotency_keys
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
