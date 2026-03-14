# RLS Policy Matrix (extracted)

This file lists CREATE POLICY occurrences found in supabase/migrations.

| migration | policy_name | on_clause | example_line |
|---|---|---|---|
| 20250919231840_wild_cliff.sql | Users can read own profile |  | CREATE POLICY "Users can read own profile" |
| 20250919231840_wild_cliff.sql | Users can update own profile |  | CREATE POLICY "Users can update own profile" |
| 20250919231840_wild_cliff.sql | Users can insert own profile |  | CREATE POLICY "Users can insert own profile" |
| 20250919231840_wild_cliff.sql | Anyone can read published courses |  | CREATE POLICY "Anyone can read published courses" |
| 20250919231840_wild_cliff.sql | Admins can manage all courses |  | CREATE POLICY "Admins can manage all courses" |
| 20250919231840_wild_cliff.sql | Anyone can read modules of published courses |  | CREATE POLICY "Anyone can read modules of published courses" |
| 20250919231840_wild_cliff.sql | Admins can manage all modules |  | CREATE POLICY "Admins can manage all modules" |
| 20250919231840_wild_cliff.sql | Anyone can read lessons of published courses |  | CREATE POLICY "Anyone can read lessons of published courses" |
| 20250919231840_wild_cliff.sql | Admins can manage all lessons |  | CREATE POLICY "Admins can manage all lessons" |
| 20250919231840_wild_cliff.sql | Users can read own enrollments |  | CREATE POLICY "Users can read own enrollments" |
| 20250919231840_wild_cliff.sql | Users can manage own enrollments |  | CREATE POLICY "Users can manage own enrollments" |
| 20250919231840_wild_cliff.sql | Users can read own lesson progress |  | CREATE POLICY "Users can read own lesson progress" |
| 20250919231840_wild_cliff.sql | Users can manage own lesson progress |  | CREATE POLICY "Users can manage own lesson progress" |
| 20250919231840_wild_cliff.sql | Users can read own quiz attempts |  | CREATE POLICY "Users can read own quiz attempts" |
| 20250919231840_wild_cliff.sql | Users can manage own quiz attempts |  | CREATE POLICY "Users can manage own quiz attempts" |
| 20250919231840_wild_cliff.sql | Users can read own reflections |  | CREATE POLICY "Users can read own reflections" |
| 20250919231840_wild_cliff.sql | Users can manage own reflections |  | CREATE POLICY "Users can manage own reflections" |
| 20250919231840_wild_cliff.sql | Admins can read all user data |  | CREATE POLICY "Admins can read all user data" |
| 20250919231840_wild_cliff.sql | Admins can read all lesson progress |  | CREATE POLICY "Admins can read all lesson progress" |
| 20250919231840_wild_cliff.sql | Admins can read all quiz attempts |  | CREATE POLICY "Admins can read all quiz attempts" |
| 20250919231840_wild_cliff.sql | Admins can read all reflections |  | CREATE POLICY "Admins can read all reflections" |
| 20250919233050_peaceful_river.sql | Authenticated users can read published courses |  | CREATE POLICY "Authenticated users can read published courses" |
| 20250919233050_peaceful_river.sql | Authenticated users can manage courses |  | CREATE POLICY "Authenticated users can manage courses" |
| 20250919234713_fading_dew.sql | Anonymous users can read published courses |  | CREATE POLICY "Anonymous users can read published courses" |
| 20250919234713_fading_dew.sql | Authenticated users can read all courses |  | CREATE POLICY "Authenticated users can read all courses" |
| 20250919234713_fading_dew.sql | Authenticated users can insert courses |  | CREATE POLICY "Authenticated users can insert courses" |
| 20250919234713_fading_dew.sql | Authenticated users can update courses |  | CREATE POLICY "Authenticated users can update courses" |
| 20250919234713_fading_dew.sql | Authenticated users can delete courses |  | CREATE POLICY "Authenticated users can delete courses" |
| 20250919234713_fading_dew.sql | Service role has full access |  | CREATE POLICY "Service role has full access" |
| 20250919235815_sunny_sunset.sql | Public can view course videos |  | CREATE POLICY "Public can view course videos" |
| 20250919235815_sunny_sunset.sql | Authenticated users can upload course videos |  | CREATE POLICY "Authenticated users can upload course videos" |
| 20250919235815_sunny_sunset.sql | Authenticated users can update course videos |  | CREATE POLICY "Authenticated users can update course videos" |
| 20250919235815_sunny_sunset.sql | Authenticated users can delete course videos |  | CREATE POLICY "Authenticated users can delete course videos" |
| 20250919235815_sunny_sunset.sql | Public can view course resources |  | CREATE POLICY "Public can view course resources" |
| 20250919235815_sunny_sunset.sql | Authenticated users can upload course resources |  | CREATE POLICY "Authenticated users can upload course resources" |
| 20250919235815_sunny_sunset.sql | Authenticated users can update course resources |  | CREATE POLICY "Authenticated users can update course resources" |
| 20250919235815_sunny_sunset.sql | Authenticated users can delete course resources |  | CREATE POLICY "Authenticated users can delete course resources" |
| 20251019120000_add_course_assignments.sql | Authenticated users can read course assignments |  | CREATE POLICY "Authenticated users can read course assignments" |
| 20251019120000_add_course_assignments.sql | Authenticated users can insert course assignments |  | CREATE POLICY "Authenticated users can insert course assignments" |
| 20251019120000_add_course_assignments.sql | Authenticated users can update course assignments |  | CREATE POLICY "Authenticated users can update course assignments" |
| 20251019120000_add_course_assignments.sql | Authenticated users can delete course assignments |  | CREATE POLICY "Authenticated users can delete course assignments" |
| 20251019123000_add_learning_goals_and_achievements.sql | Users can manage own learning goals |  | CREATE POLICY "Users can manage own learning goals" |
| 20251019123000_add_learning_goals_and_achievements.sql | Users can manage own achievements |  | CREATE POLICY "Users can manage own achievements" |
| 20251022160000_org_workspace_tables.sql | Authenticated access to strategic plans |  | create policy "Authenticated access to strategic plans" |
| 20251022160000_org_workspace_tables.sql | Service role access to strategic plans |  | create policy "Service role access to strategic plans" |
| 20251022160000_org_workspace_tables.sql | Authenticated access to session notes |  | create policy "Authenticated access to session notes" |
| 20251022160000_org_workspace_tables.sql | Service role access to session notes |  | create policy "Service role access to session notes" |
| 20251022160000_org_workspace_tables.sql | Authenticated access to action items |  | create policy "Authenticated access to action items" |
| 20251022160000_org_workspace_tables.sql | Service role access to action items |  | create policy "Service role access to action items" |
| 20251022160000_org_workspace_tables.sql | Authenticated access to notifications |  | create policy "Authenticated access to notifications" |
| 20251022160000_org_workspace_tables.sql | Service role access to notifications |  | create policy "Service role access to notifications" |
| 20251022170000_org_memberships_and_access.sql | Members can view their membership |  | create policy "Members can view their membership" |
| 20251022170000_org_memberships_and_access.sql | Org admins manage memberships |  | create policy "Org admins manage memberships" |
| 20251022170000_org_memberships_and_access.sql | Service role access to memberships |  | create policy "Service role access to memberships" |
| 20251022170000_org_memberships_and_access.sql | Members read strategic plans |  | create policy "Members read strategic plans" |
| 20251022170000_org_memberships_and_access.sql | Editors manage strategic plans |  | create policy "Editors manage strategic plans" |
| 20251022170000_org_memberships_and_access.sql | Members read session notes |  | create policy "Members read session notes" |
| 20251022170000_org_memberships_and_access.sql | Editors manage session notes |  | create policy "Editors manage session notes" |
| 20251022170000_org_memberships_and_access.sql | Members read action items |  | create policy "Members read action items" |
| 20251022170000_org_memberships_and_access.sql | Editors manage action items |  | create policy "Editors manage action items" |
| 20251022170000_org_memberships_and_access.sql | Service role access to strategic plans |  | create policy "Service role access to strategic plans" |
| 20251022170000_org_memberships_and_access.sql | Service role access to session notes |  | create policy "Service role access to session notes" |
| 20251022170000_org_memberships_and_access.sql | Service role access to action items |  | create policy "Service role access to action items" |
| 20251022170000_org_memberships_and_access.sql | Users read their notifications |  | create policy "Users read their notifications" |
| 20251022170000_org_memberships_and_access.sql | Org editors manage notifications |  | create policy "Org editors manage notifications" |
| 20251022170000_org_memberships_and_access.sql | Service role access to notifications |  | create policy "Service role access to notifications" |
| 20251031200311_persistent_courses_api.sql | Courses service role full access |  | create policy "Courses service role full access" |
| 20251031200311_persistent_courses_api.sql | Courses admin manage |  | create policy "Courses admin manage" |
| 20251031200311_persistent_courses_api.sql | Courses member read |  | create policy "Courses member read" |
| 20251031200311_persistent_courses_api.sql | Courses owner update |  | create policy "Courses owner update" |
| 20251031200311_persistent_courses_api.sql | Courses owner delete |  | create policy "Courses owner delete" |
| 20251031215913_api_contract_rls_updates.sql | Modules service role access |  | create policy "Modules service role access" |
| 20251031215913_api_contract_rls_updates.sql | Modules member read |  | create policy "Modules member read" |
| 20251031215913_api_contract_rls_updates.sql | Modules admin manage |  | create policy "Modules admin manage" |
| 20251031215913_api_contract_rls_updates.sql | Lessons service role access |  | create policy "Lessons service role access" |
| 20251031215913_api_contract_rls_updates.sql | Lessons member read |  | create policy "Lessons member read" |
| 20251031215913_api_contract_rls_updates.sql | Lessons admin manage |  | create policy "Lessons admin manage" |
| 20251031215913_api_contract_rls_updates.sql | Assignments service role access |  | create policy "Assignments service role access" |
| 20251031215913_api_contract_rls_updates.sql | Assignments learner read |  | create policy "Assignments learner read" |
| 20251031215913_api_contract_rls_updates.sql | Assignments admin manage |  | create policy "Assignments admin manage" |
| 20251031215913_api_contract_rls_updates.sql | Course enrollments service role |  | create policy "Course enrollments service role" |
| 20251031215913_api_contract_rls_updates.sql | Course enrollments self manage |  | create policy "Course enrollments self manage" |
| 20251031215913_api_contract_rls_updates.sql | Course enrollments admin read |  | create policy "Course enrollments admin read" |
| 20251031215913_api_contract_rls_updates.sql | Lesson progress service role |  | create policy "Lesson progress service role" |
| 20251031215913_api_contract_rls_updates.sql | Lesson progress self manage |  | create policy "Lesson progress self manage" |
| 20251031215913_api_contract_rls_updates.sql | Lesson progress admin read |  | create policy "Lesson progress admin read" |
| 20251031215913_api_contract_rls_updates.sql | Analytics events service role |  | create policy "Analytics events service role" |
| 20251031215913_api_contract_rls_updates.sql | Learner journeys service role |  | create policy "Learner journeys service role" |
| 20251101130000_rls_policy_templates.sql | allow_select_courses_for_org | public.courses | CREATE POLICY "allow_select_courses_for_org" ON public.courses |
| 20251101130000_rls_policy_templates.sql | allow_manage_courses_for_org_admins | public.courses | CREATE POLICY "allow_manage_courses_for_org_admins" ON public.courses |
| 20251101130000_rls_policy_templates.sql | allow_user_see_their_enrollments | public.user_course_enrollments | CREATE POLICY "allow_user_see_their_enrollments" ON public.user_course_enrollments |
| 20251101130000_rls_policy_templates.sql | allow_manage_enrollments_by_org_admin | public.user_course_enrollments | CREATE POLICY "allow_manage_enrollments_by_org_admin" ON public.user_course_enrollments |
| 20251101130000_rls_policy_templates.sql | allow_user_view_assignments | public.assignments | CREATE POLICY "allow_user_view_assignments" ON public.assignments |
| 20251101130000_rls_policy_templates.sql | allow_manage_assignments_by_admin | public.assignments | CREATE POLICY "allow_manage_assignments_by_admin" ON public.assignments |
| 20251101130000_rls_policy_templates.sql | allow_user_manage_own_progress | public.user_lesson_progress | CREATE POLICY "allow_user_manage_own_progress" ON public.user_lesson_progress |
| 20251101130000_rls_policy_templates.sql | allow_insert_progress_events | public.progress_events | CREATE POLICY "allow_insert_progress_events" ON public.progress_events |
| 20251101130000_rls_policy_templates.sql | allow_select_progress_events | public.progress_events | CREATE POLICY "allow_select_progress_events" ON public.progress_events |
| 20251101130000_rls_policy_templates.sql | progress_events_service_role | public.progress_events | CREATE POLICY "progress_events_service_role" ON public.progress_events |
| 20251228120000_surveys_org_rls.sql | Surveys service role |  | create policy "Surveys service role" |
| 20251228120000_surveys_org_rls.sql | Surveys member read |  | create policy "Surveys member read" |
| 20251228120000_surveys_org_rls.sql | Surveys admin manage |  | create policy "Surveys admin manage" |
| 20251228120000_surveys_org_rls.sql | Survey responses service role |  | create policy "Survey responses service role" |
| 20251228120000_surveys_org_rls.sql | Survey responses own |  | create policy "Survey responses own" |
| 20251228120000_surveys_org_rls.sql | Survey responses submit |  | create policy "Survey responses submit" |
| 20251228120000_surveys_org_rls.sql | Survey responses admin manage |  | create policy "Survey responses admin manage" |
| 20251228120000_surveys_org_rls.sql | Survey assignments service role |  | create policy "Survey assignments service role" |
| 20251228120000_surveys_org_rls.sql | Survey assignments member read |  | create policy "Survey assignments member read" |
| 20251228120000_surveys_org_rls.sql | Survey assignments admin manage |  | create policy "Survey assignments admin manage" |
| 20251229133000_harden_org_scoped_rls.sql | courses_service_full_access |  | create policy "courses_service_full_access" |
| 20251229133000_harden_org_scoped_rls.sql | courses_member_read |  | create policy "courses_member_read" |
| 20251229133000_harden_org_scoped_rls.sql | courses_admin_manage |  | create policy "courses_admin_manage" |
| 20251229133000_harden_org_scoped_rls.sql | assignments_service_full_access |  | create policy "assignments_service_full_access" |
| 20251229133000_harden_org_scoped_rls.sql | assignments_self_access |  | create policy "assignments_self_access" |
| 20251229133000_harden_org_scoped_rls.sql | assignments_member_read |  | create policy "assignments_member_read" |
| 20251229133000_harden_org_scoped_rls.sql | assignments_admin_manage |  | create policy "assignments_admin_manage" |
| 20251229133000_harden_org_scoped_rls.sql | user_course_progress_service |  | create policy "user_course_progress_service" |
| 20251229133000_harden_org_scoped_rls.sql | user_course_progress_self |  | create policy "user_course_progress_self" |
| 20251229133000_harden_org_scoped_rls.sql | user_course_progress_admin |  | create policy "user_course_progress_admin" |
| 20251229133000_harden_org_scoped_rls.sql | user_lesson_progress_service |  | create policy "user_lesson_progress_service" |
| 20251229133000_harden_org_scoped_rls.sql | user_lesson_progress_self |  | create policy "user_lesson_progress_self" |
| 20251229133000_harden_org_scoped_rls.sql | user_lesson_progress_admin |  | create policy "user_lesson_progress_admin" |
| 20251229133000_harden_org_scoped_rls.sql | surveys_service_full_access |  | create policy "surveys_service_full_access" |
| 20251229133000_harden_org_scoped_rls.sql | surveys_member_read |  | create policy "surveys_member_read" |
| 20251229133000_harden_org_scoped_rls.sql | surveys_admin_manage |  | create policy "surveys_admin_manage" |
| 20251229133000_harden_org_scoped_rls.sql | survey_assignments_service |  | create policy "survey_assignments_service" |
| 20251229133000_harden_org_scoped_rls.sql | survey_assignments_member_read |  | create policy "survey_assignments_member_read" |
| 20251229133000_harden_org_scoped_rls.sql | survey_assignments_admin_manage |  | create policy "survey_assignments_admin_manage" |
| 20251229133000_harden_org_scoped_rls.sql | survey_responses_service |  | create policy "survey_responses_service" |
| 20251229133000_harden_org_scoped_rls.sql | survey_responses_self |  | create policy "survey_responses_self" |
| 20251229133000_harden_org_scoped_rls.sql | survey_responses_member_read |  | create policy "survey_responses_member_read" |
| 20251229133000_harden_org_scoped_rls.sql | survey_responses_admin_manage |  | create policy "survey_responses_admin_manage" |
| 20260115090500_restore_org_invites_and_audit_logs.sql | org_invites_service_full_access |  | create policy "org_invites_service_full_access" |
| 20260115090500_restore_org_invites_and_audit_logs.sql | org_invites_member_read |  | create policy "org_invites_member_read" |
| 20260115090500_restore_org_invites_and_audit_logs.sql | org_invites_admin_manage |  | create policy "org_invites_admin_manage" |
| 20260115090500_restore_org_invites_and_audit_logs.sql | audit_logs_service_access |  | create policy audit_logs_service_access |
| 20260115090500_restore_org_invites_and_audit_logs.sql | audit_logs_member_read |  | create policy audit_logs_member_read |
| 20260220225422_add_baseline_rls_policies.sql | users_read_own_profile |  | create policy "users_read_own_profile" |
| 20260220225422_add_baseline_rls_policies.sql | users_update_own_profile |  | create policy "users_update_own_profile" |
| 20260220225422_add_baseline_rls_policies.sql | memberships_read |  | create policy "memberships_read" |
| 20260220225422_add_baseline_rls_policies.sql | organizations_read |  | create policy "organizations_read" |
| 20260220225422_add_baseline_rls_policies.sql | courses_read |  | create policy "courses_read" |
| 20260220225422_add_baseline_rls_policies.sql | lessons_read |  | create policy "lessons_read" |
| 20260220225422_add_baseline_rls_policies.sql | modules_read |  | create policy "modules_read" |
| 20260220230009_add_write_rls_policies.sql | users_insert_profile |  | create policy "users_insert_profile" |
| 20260220230009_add_write_rls_policies.sql | membership_insert |  | create policy "membership_insert" |
| 20260220230009_add_write_rls_policies.sql | analytics_insert |  | create policy "analytics_insert" |
| 20260220230009_add_write_rls_policies.sql | course_engagement_insert |  | create policy "course_engagement_insert" |
| 20260221090000_fix_missing_service_role_policies.sql | audit_logs_service_access |  | create policy "audit_logs_service_access" |
| 20260221090000_fix_missing_service_role_policies.sql | org_invites_service_full_access |  | create policy "org_invites_service_full_access" |
| 20260221090000_fix_missing_service_role_policies.sql | organization_profiles_service_access |  | create policy "organization_profiles_service_access" |
| 20260221090000_fix_missing_service_role_policies.sql | _policy_backup_service_access |  | create policy "_policy_backup_service_access" |
| 20260301161000_create_notifications_table.sql | Notifications select for owner | public.notifications | create policy "Notifications select for owner" on public.notifications |
| 20260301161000_create_notifications_table.sql | Notifications update read flag | public.notifications | create policy "Notifications update read flag" on public.notifications |
| 20260301170000_ensure_learning_tables.sql | course_assignments_user_select |  | CREATE POLICY "course_assignments_user_select" |
| 20260301170000_ensure_learning_tables.sql | course_assignments_service_all |  | CREATE POLICY "course_assignments_service_all" |
| 20260301170000_ensure_learning_tables.sql | user_course_progress_self |  | CREATE POLICY "user_course_progress_self" |
| 20260301170000_ensure_learning_tables.sql | user_course_progress_service |  | CREATE POLICY "user_course_progress_service" |
| 20260301170000_ensure_learning_tables.sql | user_lesson_progress_self |  | CREATE POLICY "user_lesson_progress_self" |
| 20260301170000_ensure_learning_tables.sql | user_lesson_progress_service |  | CREATE POLICY "user_lesson_progress_service" |
| 20260301170000_ensure_learning_tables.sql | quiz_attempts_self |  | CREATE POLICY "quiz_attempts_self" |
| 20260301170000_ensure_learning_tables.sql | quiz_attempts_service |  | CREATE POLICY "quiz_attempts_service" |
| 20260304165000_fix_learning_policies.sql | course_assignments_service_select |  | CREATE POLICY "course_assignments_service_select" |
| 20260304165000_fix_learning_policies.sql | course_assignments_service_insert |  | CREATE POLICY "course_assignments_service_insert" |
| 20260304165000_fix_learning_policies.sql | course_assignments_service_update |  | CREATE POLICY "course_assignments_service_update" |
| 20260304165000_fix_learning_policies.sql | course_assignments_service_delete |  | CREATE POLICY "course_assignments_service_delete" |
| 20260304165000_fix_learning_policies.sql | user_course_progress_self_select |  | CREATE POLICY "user_course_progress_self_select" |
| 20260304165000_fix_learning_policies.sql | user_course_progress_self_insert |  | CREATE POLICY "user_course_progress_self_insert" |
| 20260304165000_fix_learning_policies.sql | user_course_progress_self_update |  | CREATE POLICY "user_course_progress_self_update" |
| 20260304165000_fix_learning_policies.sql | user_course_progress_self_delete |  | CREATE POLICY "user_course_progress_self_delete" |
| 20260304165000_fix_learning_policies.sql | user_course_progress_service_select |  | CREATE POLICY "user_course_progress_service_select" |
| 20260304165000_fix_learning_policies.sql | user_course_progress_service_insert |  | CREATE POLICY "user_course_progress_service_insert" |
| 20260304165000_fix_learning_policies.sql | user_course_progress_service_update |  | CREATE POLICY "user_course_progress_service_update" |
| 20260304165000_fix_learning_policies.sql | user_course_progress_service_delete |  | CREATE POLICY "user_course_progress_service_delete" |
| 20260312190000_org_schema_guardrails.sql | if |  | create policy if not exists "org_invites_service_full_access" |
| 20260312190000_org_schema_guardrails.sql | if |  | create policy if not exists "org_invites_member_read" |
| 20260312190000_org_schema_guardrails.sql | if |  | create policy if not exists "org_invites_admin_manage" |
| 20260312190000_org_schema_guardrails.sql | if |  | create policy if not exists "org_activation_steps_service_full_access" |
| 20260312190000_org_schema_guardrails.sql | if |  | create policy if not exists "org_activation_events_service_full_access" |
| 20260313023500_organization_messages.sql | if |  | create policy if not exists "organization_messages_service_full_access" |
| 20260313023500_organization_messages.sql | if |  | create policy if not exists "organization_messages_admin_manage" |
| 20260313023500_organization_messages.sql | if |  | create policy if not exists "organization_messages_member_read" |
| 20260313133000_notifications_email_logs.sql | email_logs_service_full_access |  | create policy "email_logs_service_full_access" |
| 20260313133000_notifications_email_logs.sql | message_logs_service_full_access |  | create policy "message_logs_service_full_access" |
