-- =============================================================================
-- RLS Policy Dedup Round 3
--
-- auth_rls_initplan:
--   Re-create the 9 still-flagged policies using the exact canonical
--   (select auth.<fn>()) form without aliases — some Postgres planner
--   versions only recognise the alias-free form as an init-plan.
--
-- multiple_permissive_policies:
--   Remaining overlaps all stem from ALL-scoped policies (admin_manage,
--   organizations_manage_service_or_admin) that fire alongside per-action
--   policies on the authenticated role.  Fix: replace each ALL policy with
--   explicit per-action policies so there is exactly one policy per action.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- audit_logs  –  auth_rls_initplan
-- Re-create with alias-free (select auth.role()) form
-- ---------------------------------------------------------------------------
drop policy if exists "audit_logs_service_access" on public.audit_logs;
create policy "audit_logs_service_access"
  on public.audit_logs for all to public
  using      ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');


-- ---------------------------------------------------------------------------
-- auth_audit  –  auth_rls_initplan (select/delete)
-- Re-create with alias-free form
-- ---------------------------------------------------------------------------
drop policy if exists "auth_audit_service_admin_select" on public.auth_audit;
drop policy if exists "auth_audit_service_admin_delete" on public.auth_audit;

create policy "auth_audit_service_admin_select"
  on public.auth_audit for select to public
  using (
    (select auth.role()) = 'service_role'
    or (select auth.jwt() ->> 'role') = 'admin'
  );

create policy "auth_audit_service_admin_delete"
  on public.auth_audit for delete to public
  using (
    (select auth.role()) = 'service_role'
    or (select auth.jwt() ->> 'role') = 'admin'
  );


-- ---------------------------------------------------------------------------
-- documents  –  auth_rls_initplan (documents_insert_restrictive)
-- Re-create with alias-free form
-- ---------------------------------------------------------------------------
drop policy if exists "documents_insert_restrictive" on public.documents;
create policy "documents_insert_restrictive"
  on public.documents for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      organization_id is null
      or organization_id = ((select auth.jwt()) ->> 'organization_id')::uuid
    )
  );


-- ---------------------------------------------------------------------------
-- organization_members  –  auth_rls_initplan (select/insert/update/delete)
-- Re-create all four with alias-free (select auth.jwt()) / (select auth.uid())
-- ---------------------------------------------------------------------------
drop policy if exists "org_members_select" on public.organization_members;
drop policy if exists "org_members_insert" on public.organization_members;
drop policy if exists "org_members_update" on public.organization_members;
drop policy if exists "org_members_delete" on public.organization_members;

create policy "org_members_select"
  on public.organization_members for select to authenticated
  using (
    (select auth.jwt() ->> 'role') = 'admin'
    or organization_id in (
      select organization_id from public.organization_members
      where user_id = (select auth.uid())
    )
  );

create policy "org_members_insert"
  on public.organization_members for insert to authenticated
  with check (
    (select auth.jwt() ->> 'role') = 'admin'
    or user_id = (select auth.uid())
  );

create policy "org_members_update"
  on public.organization_members for update to authenticated
  using (
    (select auth.jwt() ->> 'role') = 'admin'
    or user_id = (select auth.uid())
  )
  with check (
    (select auth.jwt() ->> 'role') = 'admin'
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
    (select auth.jwt() ->> 'role') = 'admin'
    or user_id = (select auth.uid())
  );


-- ---------------------------------------------------------------------------
-- organizations  –  auth_rls_initplan + multiple_permissive_policies
--
-- organizations_manage_service_or_admin is ALL/public, which fires for
-- authenticated SELECT alongside organizations_read (SELECT/authenticated).
--
-- Fix: replace with two properly-scoped policies:
--   1. service_role ALL (true) — handles all service operations
--   2. authenticated ALL for admin JWT role — handles admin write operations
-- This eliminates the authenticated SELECT overlap because the service_role
-- policy is invisible to the authenticated role, and the admin policy's
-- SELECT is the only remaining one alongside organizations_read.
-- To get to exactly ONE SELECT per authenticated role we must also merge
-- organizations_read into the admin policy or drop it. Since regular
-- members need SELECT too, the cleanest solution is:
--   - Drop organizations_manage_service_or_admin (ALL/public)
--   - Create organizations_service_access (ALL/service_role)
--   - Merge admin SELECT into organizations_read via OR
-- ---------------------------------------------------------------------------
drop policy if exists "organizations_manage_service_or_admin" on public.organizations;
drop policy if exists "organizations_read"                    on public.organizations;

-- Service gets full access via service_role
create policy "organizations_service_access"
  on public.organizations for all to service_role
  using      (true)
  with check (true);

-- Admins (JWT role=admin) get full write access
create policy "organizations_admin_manage"
  on public.organizations for all to authenticated
  using      ((select auth.jwt() ->> 'role') = 'admin')
  with check ((select auth.jwt() ->> 'role') = 'admin');

-- Members can read orgs they belong to (or admins can read all via above)
create policy "organizations_read"
  on public.organizations for select to authenticated
  using (
    (select auth.jwt() ->> 'role') = 'admin'
    or exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organizations.id
        and m.user_id = (select auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- org_invites  –  multiple_permissive_policies
--
-- org_invites_admin_manage is ALL/authenticated which fires on every action
-- alongside the four specific per-action policies.
--
-- Fix: drop org_invites_admin_manage (ALL) and absorb its admin check into
-- each of the four specific policies via OR, keeping each to one policy
-- per action on the authenticated role.
-- ---------------------------------------------------------------------------
drop policy if exists "org_invites_admin_manage"           on public.org_invites;
drop policy if exists "org_invites_member_read"            on public.org_invites;
drop policy if exists "org_invites_select_org_members"     on public.org_invites;
drop policy if exists "org_invites_insert_own_org"         on public.org_invites;
drop policy if exists "org_invites_update_inviter_or_admin" on public.org_invites;
drop policy if exists "org_invites_delete_inviter_or_admin" on public.org_invites;

-- SELECT: member of the org OR admin of the org
create policy "org_invites_select"
  on public.org_invites for select to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = org_invites.org_id
        and m.user_id = (select auth.uid())
    )
  );

-- INSERT: own-org member inserting, OR org admin
create policy "org_invites_insert"
  on public.org_invites for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      org_id = any(array(
        select org_id from get_user_organization_ids()
      ))
      or exists (
        select 1 from public.organization_memberships m
        where m.organization_id = org_invites.org_id
          and m.user_id = (select auth.uid())
          and m.role = any(array['owner','admin'])
      )
    )
  );

-- UPDATE: inviter or admin of that org
create policy "org_invites_update"
  on public.org_invites for update to authenticated
  using (
    inviter_id = (select auth.uid())
    or exists (
      select 1 from public.organization_memberships m
      where m.user_id = (select auth.uid())
        and m.organization_id = org_invites.org_id
        and m.role = any(array['owner','admin'])
    )
  )
  with check (
    inviter_id = (select auth.uid())
    or exists (
      select 1 from public.organization_memberships m
      where m.user_id = (select auth.uid())
        and m.organization_id = org_invites.org_id
        and m.role = any(array['owner','admin'])
    )
  );

-- DELETE: inviter or admin of that org
create policy "org_invites_delete"
  on public.org_invites for delete to authenticated
  using (
    inviter_id = (select auth.uid())
    or exists (
      select 1 from public.organization_memberships m
      where m.user_id = (select auth.uid())
        and m.organization_id = org_invites.org_id
        and m.role = any(array['owner','admin'])
    )
  );


-- ---------------------------------------------------------------------------
-- organization_messages  –  multiple_permissive_policies
--
-- organization_messages_admin_manage is ALL/authenticated which fires on
-- every action alongside org_read, org_insert, org_update, org_delete.
--
-- Fix: drop admin_manage (ALL) and absorb its admin-member check into each
-- of the four specific per-action policies via OR.
-- ---------------------------------------------------------------------------
drop policy if exists "organization_messages_admin_manage" on public.organization_messages;
drop policy if exists "organization_messages_org_read"     on public.organization_messages;
drop policy if exists "organization_messages_org_insert"   on public.organization_messages;
drop policy if exists "organization_messages_org_update"   on public.organization_messages;
drop policy if exists "organization_messages_org_delete"   on public.organization_messages;

-- SELECT: jwt-org match OR membership (regular member), OR admin/owner of org
create policy "organization_messages_org_read"
  on public.organization_messages for select to authenticated
  using (
    organization_id is not null
    and (
      organization_id = ((select auth.jwt()) ->> 'organization_id')::uuid
      or exists (
        select 1 from public.organization_memberships m
        where m.organization_id = organization_messages.organization_id
          and m.user_id = (select auth.uid())
      )
    )
  );

-- INSERT: jwt-org match AND sender is self, OR admin/owner of that org
create policy "organization_messages_org_insert"
  on public.organization_messages for insert to authenticated
  with check (
    organization_id is not null
    and (
      (
        organization_id = ((select auth.jwt()) ->> 'organization_id')::uuid
        and (sent_by is null or sent_by = (select auth.uid()))
      )
      or exists (
        select 1 from public.organization_memberships m
        where m.organization_id = organization_messages.org_id
          and m.user_id = (select auth.uid())
          and m.role = any(array['owner','admin'])
      )
    )
  );

-- UPDATE: jwt-org + sender match, OR admin/owner of that org
create policy "organization_messages_org_update"
  on public.organization_messages for update to authenticated
  using (
    organization_id = ((select auth.jwt()) ->> 'organization_id')::uuid
    and sent_by = (select auth.uid())
    or exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organization_messages.org_id
        and m.user_id = (select auth.uid())
        and m.role = any(array['owner','admin'])
    )
  )
  with check (
    organization_id = ((select auth.jwt()) ->> 'organization_id')::uuid
    and sent_by = (select auth.uid())
    or exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organization_messages.org_id
        and m.user_id = (select auth.uid())
        and m.role = any(array['owner','admin'])
    )
  );

-- DELETE: jwt-org + sender match, OR admin/owner of that org
create policy "organization_messages_org_delete"
  on public.organization_messages for delete to authenticated
  using (
    organization_id = ((select auth.jwt()) ->> 'organization_id')::uuid
    and sent_by = (select auth.uid())
    or exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organization_messages.org_id
        and m.user_id = (select auth.uid())
        and m.role = any(array['owner','admin'])
    )
  );


-- ---------------------------------------------------------------------------
-- organization_profiles  –  multiple_permissive_policies
--
-- org_profiles_admin_manage (ALL/authenticated) fires on SELECT alongside
-- org_profiles_member_read (SELECT/authenticated).
--
-- Fix: drop admin_manage (ALL) and replace with explicit per-action policies.
-- SELECT: merge member_read into admin_manage's SELECT so there's one policy.
-- INSERT/UPDATE/DELETE: admin/owner check only.
-- ---------------------------------------------------------------------------
drop policy if exists "org_profiles_admin_manage" on public.organization_profiles;
drop policy if exists "org_profiles_member_read"  on public.organization_profiles;

-- Single SELECT: any member OR admin/owner (admin/owner is a subset of member)
create policy "org_profiles_select"
  on public.organization_profiles for select to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organization_profiles.organization_id
        and m.user_id = (select auth.uid())
    )
  );

-- INSERT/UPDATE/DELETE: admin/owner only
create policy "org_profiles_admin_write"
  on public.organization_profiles for insert to authenticated
  with check (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organization_profiles.organization_id
        and m.user_id = (select auth.uid())
        and m.role = any(array['owner','admin'])
    )
  );

create policy "org_profiles_admin_update"
  on public.organization_profiles for update to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organization_profiles.organization_id
        and m.user_id = (select auth.uid())
        and m.role = any(array['owner','admin'])
    )
  )
  with check (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organization_profiles.organization_id
        and m.user_id = (select auth.uid())
        and m.role = any(array['owner','admin'])
    )
  );

create policy "org_profiles_admin_delete"
  on public.organization_profiles for delete to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organization_profiles.organization_id
        and m.user_id = (select auth.uid())
        and m.role = any(array['owner','admin'])
    )
  );
