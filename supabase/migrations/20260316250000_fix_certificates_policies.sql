-- Fix multiple_permissive_policies on public.certificates
--
-- Problem: both cert_own_select and cert_service_all apply to ALL roles
-- (postgres role = 'public'), causing every role to evaluate two SELECT
-- policies on every query.
--
-- Solution:
--   1. Drop both broad policies.
--   2. Re-create cert_own_select scoped TO authenticated only.
--   3. Drop cert_service_all entirely — service_role already bypasses RLS
--      by default in Supabase (superuser), so a policy is not needed.

-- Step 1: remove the existing policies
drop policy if exists "cert_own_select" on public.certificates;
drop policy if exists "cert_service_all" on public.certificates;

-- Step 2: learners can read only their own certificates
create policy "cert_own_select"
  on public.certificates
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
