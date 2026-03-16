-- Fix course_assignments RLS policies:
-- 1. Replaces auth.uid() / auth.role() with (select ...) to avoid per-row re-evaluation
-- 2. Merges the two overlapping SELECT policies into one to eliminate multiple_permissive_policies

-- Drop both old policies
drop policy if exists "course_assignments_user_select" on public.course_assignments;
drop policy if exists "course_assignments_service_all" on public.course_assignments;

-- Single SELECT policy: own rows OR service_role
create policy "course_assignments_select"
  on public.course_assignments
  for select
  using (
    (select auth.uid()) = user_id
    or (select auth.role()) = 'service_role'
  );

-- Service-role write policies (INSERT / UPDATE / DELETE)
create policy "course_assignments_service_insert"
  on public.course_assignments
  for insert
  with check ((select auth.role()) = 'service_role');

create policy "course_assignments_service_update"
  on public.course_assignments
  for update
  using ((select auth.role()) = 'service_role')
  with check ((select auth.role()) = 'service_role');

create policy "course_assignments_service_delete"
  on public.course_assignments
  for delete
  using ((select auth.role()) = 'service_role');
