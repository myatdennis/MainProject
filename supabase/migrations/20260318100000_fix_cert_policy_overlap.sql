-- Fix: multiple_permissive_policies linter warning on public.certificates
--
-- Root cause: cert_service_all was created with no role restriction (applies
-- to ALL roles), so every role (anon, authenticated, authenticator, etc.)
-- evaluates both cert_own_select AND cert_service_all on every SELECT query.
-- This triggers the Supabase linter "multiple_permissive_policies" warning.
--
-- service_role is a Supabase superuser that bypasses RLS by default — it does
-- NOT need an explicit policy.  cert_service_all is therefore both redundant
-- and harmful (it widens access for every other role as a side-effect).
--
-- Resolution:
--   1. Drop both existing policies (idempotent — safe to re-run).
--   2. Re-create a single cert_own_select scoped to `authenticated` only.
--      Authenticated users can read only their own certificates.
--   3. service_role continues to access the table via its RLS bypass — no
--      additional policy is required.

-- ── Step 1: remove all existing certificate SELECT policies ──────────────────
drop policy if exists "cert_own_select" on public.certificates;
drop policy if exists "cert_service_all" on public.certificates;

-- ── Step 2: create a single, correctly-scoped SELECT policy ─────────────────
create policy "cert_own_select"
  on public.certificates
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
