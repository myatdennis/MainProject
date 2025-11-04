-- 2025-11-01 13:00:00 - RLS / RBAC policy templates for MainProject
-- NOTE: This file contains example policies and helper SQL to get started with Row-Level Security (RLS)
-- Please review and adapt the policies to your Supabase/Postgres auth configuration before applying.
-- Common approach:
-- 1) Ensure your Supabase JWT includes user id and organization membership claims (e.g. `sub` and `org_id` or use membership table checks).
-- 2) Use policies that allow access when auth.uid() = resource.user_id OR when the user is a member of the resource.org_id (via organization_memberships table).
-- 3) For admin/service operations, prefer using the Supabase service role or an internal API (server) that runs with elevated privileges.

-- Enable RLS on tables we want to protect
-- Replace or extend the table list as needed for your schema

-- Example: courses
ALTER TABLE IF EXISTS public.courses ENABLE ROW LEVEL SECURITY;

-- Example policy: allow select on courses if course is public OR user is member of the organization OR user is an admin
-- The expression here assumes you will use supabase auth and membership tables. Adapt to your claim names accordingly.
DROP POLICY IF EXISTS "allow_select_courses_for_org" ON public.courses;
CREATE POLICY "allow_select_courses_for_org" ON public.courses
  FOR SELECT USING (
    (visibility = 'public') OR
    (org_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.org_id = org_id AND m.user_id = auth.uid())) OR
    (auth.role() = 'authenticated' AND auth.uid() = owner_id) -- owner_id sample column
  );

-- Example policy: allow insert/update/delete for org admins or course owners
DROP POLICY IF EXISTS "allow_manage_courses_for_org_admins" ON public.courses;
CREATE POLICY "allow_manage_courses_for_org_admins" ON public.courses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.org_id = org_id AND m.user_id = auth.uid() AND m.role IN ('admin','owner'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.org_id = org_id AND m.user_id = auth.uid() AND m.role IN ('admin','owner'))
  );

-- user_course_enrollments: learners can see their own enrollments, org admins can manage
ALTER TABLE IF EXISTS public.user_course_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_user_see_their_enrollments" ON public.user_course_enrollments;
CREATE POLICY "allow_user_see_their_enrollments" ON public.user_course_enrollments
  FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.org_id = org_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "allow_manage_enrollments_by_org_admin" ON public.user_course_enrollments;
CREATE POLICY "allow_manage_enrollments_by_org_admin" ON public.user_course_enrollments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.org_id = org_id AND m.user_id = auth.uid() AND m.role IN ('admin','owner'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.org_id = org_id AND m.user_id = auth.uid() AND m.role IN ('admin','owner'))
  );

-- assignments: only org admins can create global assignments; user-specific assignments visible to the user
ALTER TABLE IF EXISTS public.assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_user_view_assignments" ON public.assignments;
CREATE POLICY "allow_user_view_assignments" ON public.assignments
  FOR SELECT USING (
    (assigned_user_id IS NOT NULL AND assigned_user_id = auth.uid()) OR
    (org_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.org_id = org_id AND m.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "allow_manage_assignments_by_admin" ON public.assignments;
CREATE POLICY "allow_manage_assignments_by_admin" ON public.assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.org_id = org_id AND m.user_id = auth.uid() AND m.role IN ('admin','owner'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.org_id = org_id AND m.user_id = auth.uid() AND m.role IN ('admin','owner'))
  );

-- user_lesson_progress: learners may only write their own progress; org admins may view/manage
ALTER TABLE IF EXISTS public.user_lesson_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_user_manage_own_progress" ON public.user_lesson_progress;
CREATE POLICY "allow_user_manage_own_progress" ON public.user_lesson_progress
  FOR ALL USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.org_id = org_id AND m.user_id = auth.uid())
  ) WITH CHECK (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.org_id = org_id AND m.user_id = auth.uid())
  );

-- progress_events: typically write-only by the client (we may allow inserts from authenticated users)
ALTER TABLE IF EXISTS public.progress_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_insert_progress_events" ON public.progress_events;
CREATE POLICY "allow_insert_progress_events" ON public.progress_events
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

-- Helpful notes for deployment:
-- 1) If you use server-side requests (the server uses a service role), those requests should be made with the Supabase service key so they bypass RLS. Do NOT expose the service key in the browser.
-- 2) If your JWT does not include organization membership information, rely on membership table checks (as above) which query `organization_memberships` using auth.uid(). Ensure `organization_memberships` is populated and accurate.
-- 3) Test policies thoroughly in a staging environment prior to applying to production. Mistakes can lock out access.

-- This migration is a starting point. Replace column names (owner_id, org_id, assigned_user_id) with the actual columns in your schema and adjust role checks to match your membership model.

-- End of RLS policy templates
