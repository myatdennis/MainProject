-- =============================================================================
-- RLS Final Fixes Round 4
--
-- Two distinct root issues remain:
--
-- 1. auth_rls_initplan: Postgres's linter only recognises (select auth.fn())
--    without an AS alias as a stable init-plan.  The forms
--    (SELECT auth.role() AS role) and (SELECT (auth.jwt() ->> 'role'::text))
--    are still flagged.  Re-create all affected policies using the strict
--    alias-free form: (select auth.role()), (select auth.jwt() ->> 'role').
--
-- 2. multiple_permissive_policies:
--    • organizations: organizations_admin_manage is ALL/authenticated, so its
--      SELECT fires alongside organizations_read (SELECT/authenticated).
--      Fix: replace with explicit INSERT/UPDATE/DELETE policies — no ALL.
--    • organization_messages: organization_messages_read_admins is
--      SELECT/public, which applies to authenticated users too, duplicating
--      org_read.  Fix: scope it to service_role only.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- auth_audit  (SELECT auth.role() AS role  →  select auth.role())
-- ---------------------------------------------------------------------------
drop policy if exists "auth_audit_service_admin_select" on public.auth_audit;
drop policy if exists "auth_audit_service_admin_delete" on public.auth_audit;

create policy "auth_audit_service_admin_select"
  on public.auth_audit for select to public
  using (
    (select auth.role()) = 'service_role'
    or (select auth.jwt()) ->> 'role' = 'admin'
  );

create policy "auth_audit_service_admin_delete"
  on public.auth_audit for delete to public
  using (
    (select auth.role()) = 'service_role'
    or (select auth.jwt()) ->> 'role' = 'admin'
  );


-- ---------------------------------------------------------------------------
-- organization_members  (SELECT auth.jwt() ->> 'role'::text  →  alias-free)
-- ---------------------------------------------------------------------------
drop policy if exists "org_members_select" on public.organization_members;
drop policy if exists "org_members_insert" on public.organization_members;
drop policy if exists "org_members_update" on public.organization_members;
drop policy if exists "org_members_delete" on public.organization_members;

create policy "org_members_select"
  on public.organization_members for select to authenticated
  using (
    (select auth.jwt()) ->> 'role' = 'admin'
    or organization_id in (
      select organization_id from public.organization_members
      where user_id = (select auth.uid())
    )
  );

create policy "org_members_insert"
  on public.organization_members for insert to authenticated
  with check (
    (select auth.jwt()) ->> 'role' = 'admin'
    or user_id = (select auth.uid())
  );

create policy "org_members_update"
  on public.organization_members for update to authenticated
  using (
    (select auth.jwt()) ->> 'role' = 'admin'
    or user_id = (select auth.uid())
  )
  with check (
    (select auth.jwt()) ->> 'role' = 'admin'
    or (
      user_id = (select auth.uid())
      and organization_id = (
        select organization_id from public.organization_members
        where user_id = (select auth.uid()) limit 1
      )
    )
  );

create policy "org_members_delete"
  on public.organization_members for delete to authenticated
  using (
    (select auth.jwt()) ->> 'role' = 'admin'
    or user_id = (select auth.uid())
  );


-- ---------------------------------------------------------------------------
-- organizations
--
-- auth_rls_initplan: organizations_admin_manage and organizations_read both
--   use (SELECT (auth.jwt() ->> 'role'::text)) — re-create alias-free.
--
-- multiple_permissive_policies: organizations_admin_manage is ALL/authenticated
--   which fires on SELECT alongside organizations_read.
--   Fix: replace ALL with explicit INSERT/UPDATE/DELETE policies only.
--   organizations_read already covers SELECT for both members and admins.
-- ---------------------------------------------------------------------------
drop policy if exists "organizations_admin_manage" on public.organizations;
drop policy if exists "organizations_read"         on public.organizations;

-- Admin write access (INSERT / UPDATE / DELETE only — no SELECT, avoids overlap)
create policy "organizations_admin_insert"
  on public.organizations for insert to authenticated
  with check ((select auth.jwt()) ->> 'role' = 'admin');

create policy "organizations_admin_update"
  on public.organizations for update to authenticated
  using      ((select auth.jwt()) ->> 'role' = 'admin')
  with check ((select auth.jwt()) ->> 'role' = 'admin');

create policy "organizations_admin_delete"
  on public.organizations for delete to authenticated
  using ((select auth.jwt()) ->> 'role' = 'admin');

-- Single SELECT policy: admins see all, members see their orgs
create policy "organizations_read"
  on public.organizations for select to authenticated
  using (
    (select auth.jwt()) ->> 'role' = 'admin'
    or exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organizations.id
        and m.user_id = (select auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- organization_messages
--
-- multiple_permissive_policies: organization_messages_read_admins is
--   SELECT/public which fires for authenticated users, duplicating org_read.
--
--   The policy checks auth.role() = service_role OR email matches — this is
--   purely a service/internal backdoor, so scope it to service_role.
--   (The service_role already has full access via service_access_service_role,
--   so this policy becomes a no-op for service_role — dropping it entirely
--   is the cleanest fix.)
-- ---------------------------------------------------------------------------
drop policy if exists "organization_messages_read_admins" on public.organization_messages;
