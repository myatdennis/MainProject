-- =============================================================================
-- RLS Policy Dedup Round 2
-- Fix remaining multiple_permissive_policies lints and 5 duplicate indexes.
-- Note: all remaining auth_rls_initplan warnings are already using (select ...)
-- wrappers — those lints are stale cache entries and require no SQL changes.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- org_invites
--
-- Problem: org_invites_service_full_access is FOR ALL TO PUBLIC (not service_role),
-- so it fires for every authenticated request, duplicating admin_manage,
-- delete_inviter_or_admin, insert_own_org, member_read, select_org_members,
-- update_inviter_or_admin on the authenticated role.
--
-- Fix: re-scope org_invites_service_full_access to service_role only.
-- All other org_invites policies are correctly scoped and non-redundant.
-- ---------------------------------------------------------------------------
drop policy if exists "org_invites_service_full_access" on public.org_invites;
create policy "org_invites_service_full_access"
  on public.org_invites for all to service_role
  using      (true)
  with check (true);


-- ---------------------------------------------------------------------------
-- organization_members
--
-- Problem: org_members_admin_all is FOR ALL TO AUTHENTICATED which fires on
-- SELECT/INSERT/UPDATE/DELETE alongside the four specific per-action policies.
--
-- Fix: drop org_members_admin_all and absorb the admin bypass into each of
-- the four specific policies via OR conditions.
-- ---------------------------------------------------------------------------
drop policy if exists "org_members_admin_all" on public.organization_members;
drop policy if exists "org_members_select"    on public.organization_members;
drop policy if exists "org_members_insert"    on public.organization_members;
drop policy if exists "org_members_update"    on public.organization_members;
drop policy if exists "org_members_delete"    on public.organization_members;

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
-- organization_memberships
--
-- Problem: 3 INSERT policies + 4 SELECT policies all on authenticated.
--
-- INSERT:
--   membership_insert      — user_id match OR can_invite_to_org()  (broadest)
--   membership_insert_self_only — user_id match only
--   membership_insert_user      — user_id match only  (identical to self_only)
--
--   Keep membership_insert (broadest, already correct). Drop the two narrower.
--
-- SELECT:
--   members_can_read_own_memberships — user_id OR profile_id match  (broadest)
--   memberships_read                 — user_id match
--   memberships_read_by_profile_id   — profile_id match
--   memberships_read_user            — user_id match  (duplicate of memberships_read)
--
--   Keep members_can_read_own_memberships (covers all cases). Drop the three
--   narrower duplicates.
-- ---------------------------------------------------------------------------
drop policy if exists "membership_insert_self_only"        on public.organization_memberships;
drop policy if exists "membership_insert_user"             on public.organization_memberships;
drop policy if exists "memberships_read"                   on public.organization_memberships;
drop policy if exists "memberships_read_by_profile_id"     on public.organization_memberships;
drop policy if exists "memberships_read_user"              on public.organization_memberships;


-- ---------------------------------------------------------------------------
-- organization_messages
--
-- Problem: org_messages_admin_manage (ALL/authenticated) + 4 specific org_*
-- policies (SELECT/INSERT/UPDATE/DELETE / authenticated).
-- READ_ADMINS is public role so doesn't create authenticated duplication.
-- Also: two identical service_role ALL policies exist.
--
-- The SELECT action has 4 policies: admin_manage + member_read + org_read + read_admins.
-- member_read is a strict subset of org_read (org_read covers member check + jwt org).
-- Keep admin_manage (covers admin write), keep org_read (covers member read),
-- drop member_read (redundant subset). Keep org_insert/update/delete as-is since
-- admin_manage's ALL covers those too but with different criteria (admin check vs
-- jwt org check) — both are needed for their distinct populations.
-- Also drop the duplicate service ALL policy.
-- ---------------------------------------------------------------------------
drop policy if exists "organization_messages_member_read"          on public.organization_messages;
drop policy if exists "organization_messages_service_full_access"  on public.organization_messages;


-- ---------------------------------------------------------------------------
-- organization_profiles
--
-- Problem: organization_profiles_service_access (ALL/authenticated) overlaps with
-- org_profiles_admin_manage (ALL/auth) and org_profiles_member_read (SELECT/auth).
--
-- organization_profiles_service_access uses current_setting('app.current_role')
-- which is a legacy app-level gate, but since org_profiles_service_full_access
-- (service_role) already handles all service operations, this policy is redundant
-- and purely causes the duplication lint. Drop it.
-- ---------------------------------------------------------------------------
drop policy if exists "organization_profiles_service_access" on public.organization_profiles;


-- ---------------------------------------------------------------------------
-- organizations
--
-- Problem: organizations_read and organizations_read_members are identical
-- SELECT/authenticated policies (both check membership).
-- Drop the older alias.
-- ---------------------------------------------------------------------------
drop policy if exists "organizations_read_members" on public.organizations;


-- ---------------------------------------------------------------------------
-- quiz_attempts
--
-- Problem: quiz_attempts_service (ALL/public) fires on authenticated SELECT,
-- duplicating quiz_attempts_self (SELECT/authenticated).
--
-- Fix: re-scope quiz_attempts_service to service_role only.
-- ---------------------------------------------------------------------------
drop policy if exists "quiz_attempts_service" on public.quiz_attempts;
create policy "quiz_attempts_service"
  on public.quiz_attempts for all to service_role
  using      (true)
  with check (true);


-- ---------------------------------------------------------------------------
-- user_course_progress
--
-- Problem: service_* policies are on authenticated role, same as self_* policies.
-- service_select is on public role (also hits authenticated).
--
-- Fix: re-scope all four service_* policies to service_role.
-- ---------------------------------------------------------------------------
drop policy if exists "user_course_progress_service_select" on public.user_course_progress;
drop policy if exists "user_course_progress_service_insert" on public.user_course_progress;
drop policy if exists "user_course_progress_service_update" on public.user_course_progress;
drop policy if exists "user_course_progress_service_delete" on public.user_course_progress;

create policy "user_course_progress_service_select"
  on public.user_course_progress for select to service_role
  using (true);

create policy "user_course_progress_service_insert"
  on public.user_course_progress for insert to service_role
  with check (true);

create policy "user_course_progress_service_update"
  on public.user_course_progress for update to service_role
  using      (true)
  with check (true);

create policy "user_course_progress_service_delete"
  on public.user_course_progress for delete to service_role
  using (true);


-- ---------------------------------------------------------------------------
-- user_profiles
--
-- Problem: user_profiles_owner_read duplicates users_read_own_profile (both
-- SELECT/authenticated, both check id = auth.uid()).
-- user_profiles_owner_update duplicates users_update_own_profile.
--
-- Keep the _owner_* versions (already use (select auth.uid())), drop the
-- users_* legacy ones.
-- ---------------------------------------------------------------------------
drop policy if exists "users_read_own_profile"   on public.user_profiles;
drop policy if exists "users_update_own_profile" on public.user_profiles;


-- ---------------------------------------------------------------------------
-- Duplicate indexes
-- Keep the more descriptive / canonical name in each pair.
-- ---------------------------------------------------------------------------

-- analytics_events: keep analytics_events_user_id_idx, drop idx_ alias
drop index if exists public.idx_analytics_events_user_id;

-- notifications: keep notifications_user_id_idx, drop idx_ alias
drop index if exists public.idx_notifications_user_id;

-- org_invites (org_id): keep org_invites_org_idx, drop idx_ alias
drop index if exists public.idx_org_invites_org_id;

-- org_invites (invite_token unique): both are UNIQUE constraints — must drop
-- the one that is NOT backing a named constraint.
-- org_invites_token_key is the older alias; org_invites_invite_token_key is canonical.
drop index if exists public.org_invites_token_key;

-- organization_contacts: keep organization_contacts_org_idx, drop idx_ alias
drop index if exists public.idx_organization_contacts_org_id;
