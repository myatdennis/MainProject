-- =============================================================================
-- Fix Supabase Performance & Security Lints
-- 1. auth_rls_initplan  – wrap bare auth.<fn>() calls in (select ...) so they
--    are evaluated once per query, not once per row.
-- 2. multiple_permissive_policies – drop superseded legacy policies so only
--    one policy exists per table/role/action combination.
-- 3. duplicate_index – drop the older of the two identical indexes on
--    organization_members(user_id, organization_id).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- _policy_backup  (ALL / public)
-- qual: auth.role() -> (select auth.role())
-- ---------------------------------------------------------------------------
drop policy if exists "_policy_backup_service_access" on public._policy_backup;
create policy "_policy_backup_service_access"
  on public._policy_backup for all to public
  using      ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');


-- ---------------------------------------------------------------------------
-- audit_logs  (ALL / public)
-- Already uses (select ...) wrapper – just drop & recreate to be safe
-- ---------------------------------------------------------------------------
-- (audit_logs_service_access already has the wrapper – no change needed)


-- ---------------------------------------------------------------------------
-- auth_audit  (INSERT / SELECT / DELETE  /  public)
-- qual: auth.role() -> (select auth.role())
-- ---------------------------------------------------------------------------
drop policy if exists "auth_audit_service_insert"        on public.auth_audit;
drop policy if exists "auth_audit_service_admin_select"  on public.auth_audit;
drop policy if exists "auth_audit_service_admin_delete"  on public.auth_audit;

create policy "auth_audit_service_insert"
  on public.auth_audit for insert to public
  with check ((select auth.role()) = 'service_role');

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
-- course_engagement  (INSERT / authenticated)
-- qual: auth.jwt() -> (select auth.jwt())
-- ---------------------------------------------------------------------------
drop policy if exists "course_engagement_insert" on public.course_engagement;
create policy "course_engagement_insert"
  on public.course_engagement for insert to authenticated
  with check (
    organization_id is not null
    and organization_id = ((select auth.jwt()) ->> 'organization_id')::uuid
  );


-- ---------------------------------------------------------------------------
-- documents
--
-- ISSUES:
--   • documents_authenticated_read  – bare auth.uid() in EXISTS subquery
--   • documents_insert_restrictive  – already uses (select auth.uid()) ✓
--   • documents_read (SELECT / authenticated, qual: true) duplicates
--     documents_authenticated_read for the same role/action → DROP it
-- ---------------------------------------------------------------------------
drop policy if exists "documents_authenticated_read" on public.documents;
drop policy if exists "documents_read"               on public.documents;

-- Single consolidated SELECT policy with (select auth.uid())
create policy "documents_authenticated_read"
  on public.documents for select to authenticated
  using (
    visibility = 'global'
    or organization_id is null
    or exists (
      select 1 from public.organization_memberships m
      where m.organization_id = documents.organization_id
        and m.user_id = (select auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- notifications
--
-- ISSUES (multiple_permissive_policies):
--   SELECT / public: "Notifications select for owner"  AND  "Users can view their notifications"
--   UPDATE / public: "Users can update their own notifications"  AND  notifications_update_service_or_admin
--
-- Both SELECT policies are identical (user_id = (select auth.uid())).
-- Drop the old English-named one, keep the canonical one.
--
-- The two UPDATE policies serve *different* purposes (owner vs service/admin)
-- but are both on `public` role, causing the lint.  Fix: scope them to the
-- correct roles (authenticated for owner, service_role for service/admin).
-- Also fix bare auth.role() / auth.jwt() calls.
--
-- notifications_insert_service_only also has bare auth.role() → fix it.
-- ---------------------------------------------------------------------------

-- SELECT dedup: drop legacy name, keep "Users can view their notifications"
-- but also fix the remaining one's role to authenticated and use (select ...)
drop policy if exists "Notifications select for owner"         on public.notifications;
drop policy if exists "Users can view their notifications"     on public.notifications;

create policy "notifications_select_owner"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);

-- UPDATE dedup + fix: split into two properly-scoped policies
drop policy if exists "Users can update their own notifications" on public.notifications;
drop policy if exists "notifications_update_service_or_admin"   on public.notifications;
drop policy if exists "notifications_update_owner"              on public.notifications;

create policy "notifications_update_owner"
  on public.notifications for update to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "notifications_update_service_or_admin"
  on public.notifications for update to service_role
  using      (true)
  with check (true);

-- INSERT fix: bare auth.role()
drop policy if exists "notifications_insert_service_only" on public.notifications;
create policy "notifications_insert_service_only"
  on public.notifications for insert to service_role
  with check (user_id is not null);


-- ---------------------------------------------------------------------------
-- org_invites
--
-- ISSUES (multiple_permissive_policies):
--   org_invites_admin_manage (ALL / public) overlaps with:
--     org_invites_service_full_access (ALL / public)          → SELECT/INSERT/UPDATE/DELETE
--     org_invites_delete_inviter_or_admin (DELETE / authenticated)
--     org_invites_insert_own_org         (INSERT / authenticated)
--     org_invites_member_read            (SELECT / authenticated)
--     org_invites_select_org_members     (SELECT / authenticated)
--
--   org_invites_admin_manage is on role `public` but handles org-admin logic.
--   Fix: scope it to `authenticated`; this removes the `public`-role overlap
--   with org_invites_service_full_access.
--
-- ALSO: org_invites_service_full_access already uses (select auth.role()) ✓
--       org_invites_admin_manage has bare auth.uid() in subquery → fix
--       org_invites_member_read  has bare auth.uid() in subquery → fix
-- ---------------------------------------------------------------------------
drop policy if exists "org_invites_admin_manage" on public.org_invites;
create policy "org_invites_admin_manage"
  on public.org_invites for all to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = org_invites.org_id
        and m.user_id = (select auth.uid())
        and m.role = any(array['owner','admin'])
    )
  )
  with check (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = org_invites.org_id
        and m.user_id = (select auth.uid())
        and m.role = any(array['owner','admin'])
    )
  );

drop policy if exists "org_invites_member_read" on public.org_invites;
create policy "org_invites_member_read"
  on public.org_invites for select to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = org_invites.org_id
        and m.user_id = (select auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- organization_members  (ALL / authenticated)
-- qual: auth.jwt() -> (select auth.jwt())
-- ---------------------------------------------------------------------------
drop policy if exists "org_members_admin_all" on public.organization_members;
create policy "org_members_admin_all"
  on public.organization_members for all to authenticated
  using      ((select auth.jwt() ->> 'role') = 'admin')
  with check ((select auth.jwt() ->> 'role') = 'admin');


-- ---------------------------------------------------------------------------
-- organization_memberships
--
-- ISSUES (auth_rls_initplan):
--   memberships_read_by_profile_id : bare auth.uid()
--   members_can_read_own_memberships: bare auth.uid()
--   membership_delete_user          : bare auth.uid()
--   membership_insert_user          : bare auth.uid()
--   membership_update_user          : bare auth.uid()
--   memberships_read_user           : bare auth.uid()
--
-- NOTE: membership_insert / membership_insert_self_only / memberships_read
--   already use (select auth.uid()) ✓ – leave untouched.
-- ---------------------------------------------------------------------------
drop policy if exists "memberships_read_by_profile_id"     on public.organization_memberships;
drop policy if exists "members_can_read_own_memberships"   on public.organization_memberships;
drop policy if exists "membership_delete_user"             on public.organization_memberships;
drop policy if exists "membership_insert_user"             on public.organization_memberships;
drop policy if exists "membership_update_user"             on public.organization_memberships;
drop policy if exists "memberships_read_user"              on public.organization_memberships;

create policy "memberships_read_by_profile_id"
  on public.organization_memberships for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "members_can_read_own_memberships"
  on public.organization_memberships for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = profile_id
  );

create policy "membership_delete_user"
  on public.organization_memberships for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "membership_insert_user"
  on public.organization_memberships for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "membership_update_user"
  on public.organization_memberships for update to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "memberships_read_user"
  on public.organization_memberships for select to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- organization_messages
--
-- ISSUES (auth_rls_initplan):
--   organization_messages_read_admins  : bare auth.role() / auth.email()
--   organization_messages_org_read     : bare auth.jwt() / bare auth.uid() in subquery
--   organization_messages_org_insert   : bare auth.jwt() / auth.uid() in subquery
--   organization_messages_org_update   : bare auth.jwt() / auth.uid() in subquery
--   organization_messages_org_delete   : bare auth.jwt() / auth.uid() in subquery
--   organization_messages_admin_manage : bare auth.uid() in subquery
--   organization_messages_member_read  : bare auth.uid() in subquery
-- ---------------------------------------------------------------------------
drop policy if exists "organization_messages_read_admins"  on public.organization_messages;
drop policy if exists "organization_messages_org_read"     on public.organization_messages;
drop policy if exists "organization_messages_org_insert"   on public.organization_messages;
drop policy if exists "organization_messages_org_update"   on public.organization_messages;
drop policy if exists "organization_messages_org_delete"   on public.organization_messages;
drop policy if exists "organization_messages_admin_manage" on public.organization_messages;
drop policy if exists "organization_messages_member_read"  on public.organization_messages;

create policy "organization_messages_read_admins"
  on public.organization_messages for select to public
  using (
    (select auth.role()) = 'service_role'
    or (select auth.email()) ilike '%@the-huddle.co'
  );

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

create policy "organization_messages_org_insert"
  on public.organization_messages for insert to authenticated
  with check (
    organization_id is not null
    and organization_id = ((select auth.jwt()) ->> 'organization_id')::uuid
    and (sent_by is null or sent_by = (select auth.uid()))
  );

create policy "organization_messages_org_update"
  on public.organization_messages for update to authenticated
  using      (organization_id = ((select auth.jwt()) ->> 'organization_id')::uuid and sent_by = (select auth.uid()))
  with check (organization_id = ((select auth.jwt()) ->> 'organization_id')::uuid and sent_by = (select auth.uid()));

create policy "organization_messages_org_delete"
  on public.organization_messages for delete to authenticated
  using (
    organization_id = ((select auth.jwt()) ->> 'organization_id')::uuid
    and sent_by = (select auth.uid())
  );

create policy "organization_messages_admin_manage"
  on public.organization_messages for all to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organization_messages.org_id
        and m.user_id = (select auth.uid())
        and m.role = any(array['owner','admin'])
    )
  )
  with check (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organization_messages.org_id
        and m.user_id = (select auth.uid())
        and m.role = any(array['owner','admin'])
    )
  );

create policy "organization_messages_member_read"
  on public.organization_messages for select to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organization_messages.org_id
        and m.user_id = (select auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- organization_profiles
--
-- ISSUES (auth_rls_initplan):
--   org_profiles_admin_manage : bare auth.uid() (role = public)
--   org_profiles_member_read  : bare auth.uid() (role = authenticated)
-- ---------------------------------------------------------------------------
drop policy if exists "org_profiles_admin_manage" on public.organization_profiles;
drop policy if exists "org_profiles_member_read"  on public.organization_profiles;

create policy "org_profiles_admin_manage"
  on public.organization_profiles for all to authenticated
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

create policy "org_profiles_member_read"
  on public.organization_profiles for select to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = organization_profiles.organization_id
        and m.user_id = (select auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- organizations  (ALL / public)
-- qual: auth.role() / auth.jwt() → (select ...)
-- ---------------------------------------------------------------------------
drop policy if exists "organizations_manage_service_or_admin" on public.organizations;
create policy "organizations_manage_service_or_admin"
  on public.organizations for all to public
  using      ((select auth.role()) = 'service_role' or (select auth.jwt() ->> 'role') = 'admin')
  with check ((select auth.role()) = 'service_role' or (select auth.jwt() ->> 'role') = 'admin');


-- ---------------------------------------------------------------------------
-- quiz_attempts
--
-- ISSUES (auth_rls_initplan):
--   quiz_attempts_select  : bare auth.uid()
--   quiz_attempts_service : bare auth.role()
--
-- quiz_attempts_self already uses (select auth.uid()) and covers the same
-- SELECT/authenticated case → drop the redundant quiz_attempts_select.
-- ---------------------------------------------------------------------------
drop policy if exists "quiz_attempts_select"  on public.quiz_attempts;
drop policy if exists "quiz_attempts_service" on public.quiz_attempts;

-- quiz_attempts_self already exists and is correct – no need to recreate SELECT.

create policy "quiz_attempts_service"
  on public.quiz_attempts for all to public
  using      ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');


-- ---------------------------------------------------------------------------
-- user_course_progress
--
-- ISSUES (multiple_permissive_policies + auth_rls_initplan):
--   Duplicate legacy policies (public role, bare auth.uid()):
--     "read own course progress"    SELECT / public  → superseded by user_course_progress_self_select
--     "upsert own course progress"  INSERT / public  → superseded by user_course_progress_self_insert
--     "update own course progress"  UPDATE / public  → superseded by user_course_progress_self_update
--     user_course_progress_self_delete DELETE / public – bare auth.uid()
--     user_course_progress_self_insert INSERT / public – bare auth.uid()
--     user_course_progress_self_select SELECT / public – bare auth.uid()
--     user_course_progress_self_update UPDATE / public – bare auth.uid()
--
--   Fix: drop legacy names; recreate _self_* policies scoped to authenticated
--   with (select auth.uid()) so only one policy per action remains.
-- ---------------------------------------------------------------------------
drop policy if exists "read own course progress"             on public.user_course_progress;
drop policy if exists "upsert own course progress"           on public.user_course_progress;
drop policy if exists "update own course progress"           on public.user_course_progress;
drop policy if exists "user_course_progress_self_select"     on public.user_course_progress;
drop policy if exists "user_course_progress_self_insert"     on public.user_course_progress;
drop policy if exists "user_course_progress_self_update"     on public.user_course_progress;
drop policy if exists "user_course_progress_self_delete"     on public.user_course_progress;
-- user_course_progress_select (authenticated) is a duplicate of self_select → drop too
drop policy if exists "user_course_progress_select"          on public.user_course_progress;

create policy "user_course_progress_self_select"
  on public.user_course_progress for select to authenticated
  using (user_id = (select auth.uid()));

create policy "user_course_progress_self_insert"
  on public.user_course_progress for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "user_course_progress_self_update"
  on public.user_course_progress for update to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "user_course_progress_self_delete"
  on public.user_course_progress for delete to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- user_lesson_progress
--
-- ISSUES (multiple_permissive_policies + auth_rls_initplan):
--   "upsert own lesson progress" (INSERT / public) + user_lesson_progress_service (ALL / public)
--     → both fire for INSERT on public role → dedup
--   "read_own_lesson_progress" (SELECT / authenticated) – bare auth.uid()
--   "user_lesson_progress_select" (SELECT / authenticated) – bare auth.uid()
--     → duplicate SELECT, drop one
--   user_lesson_progress_service (ALL / public) – bare auth.role()
-- ---------------------------------------------------------------------------
drop policy if exists "upsert own lesson progress"      on public.user_lesson_progress;
drop policy if exists "read_own_lesson_progress"        on public.user_lesson_progress;
drop policy if exists "user_lesson_progress_select"     on public.user_lesson_progress;
drop policy if exists "user_lesson_progress_service"    on public.user_lesson_progress;

-- Single SELECT policy
create policy "user_lesson_progress_select"
  on public.user_lesson_progress for select to authenticated
  using (user_id = (select auth.uid()));

-- INSERT scoped to authenticated (removes public-role overlap with service)
create policy "user_lesson_progress_self_insert"
  on public.user_lesson_progress for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Service ALL policy fixed to use (select auth.role())
create policy "user_lesson_progress_service"
  on public.user_lesson_progress for all to service_role
  using      (true)
  with check (true);


-- ---------------------------------------------------------------------------
-- user_profiles
--
-- ISSUES (auth_rls_initplan):
--   user_profiles_owner_read   : bare auth.uid()
--   user_profiles_owner_update : bare auth.uid()
-- ---------------------------------------------------------------------------
drop policy if exists "user_profiles_owner_read"   on public.user_profiles;
drop policy if exists "user_profiles_owner_update" on public.user_profiles;

create policy "user_profiles_owner_read"
  on public.user_profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "user_profiles_owner_update"
  on public.user_profiles for update to authenticated
  using      (id = (select auth.uid()))
  with check (id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- org_workspace_* tables  (auth_rls_initplan)
-- The three workspace member_access policies all use bare auth.uid()
-- ---------------------------------------------------------------------------
drop policy if exists "org_workspace_strategic_plans_member_access" on public.org_workspace_strategic_plans;
create policy "org_workspace_strategic_plans_member_access"
  on public.org_workspace_strategic_plans for all to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = org_workspace_strategic_plans.org_id
        and m.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = org_workspace_strategic_plans.org_id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "org_workspace_session_notes_member_access" on public.org_workspace_session_notes;
create policy "org_workspace_session_notes_member_access"
  on public.org_workspace_session_notes for all to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = org_workspace_session_notes.org_id
        and m.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = org_workspace_session_notes.org_id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "org_workspace_action_items_member_access" on public.org_workspace_action_items;
create policy "org_workspace_action_items_member_access"
  on public.org_workspace_action_items for all to authenticated
  using (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = org_workspace_action_items.org_id
        and m.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.organization_memberships m
      where m.organization_id = org_workspace_action_items.org_id
        and m.user_id = (select auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- Duplicate index on organization_members
-- Drop the older alias; keep idx_organization_members_user_org
-- ---------------------------------------------------------------------------
drop index if exists public.idx_org_members_user_org;
