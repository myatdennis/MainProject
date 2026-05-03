-- Harden SECURITY DEFINER functions exposed in the public schema.
--
-- These functions are internal RPC, trigger, or maintenance helpers. They
-- should not be directly executable through PostgREST by anon/authenticated
-- clients. Backend/admin flows that need RPC access use the service role.

do $$
declare
  function_signature text;
  function_signatures text[] := array[
    'public.analytics_events_set_owner()',
    'public.analytics_events_set_owner_impl()',
    'public.can_invite_to_org(uuid, uuid)',
    'public.ensure_active_membership_impl()',
    'public.get_platform_role_claims()',
    'public.handle_new_user()',
    'public.is_platform_admin_inviter(uuid)',
    'public.log_auth_event(text, uuid, inet, text, jsonb)',
    'public.org_invites_integrity_trigger()',
    'public.org_invites_integrity_trigger_impl()',
    'public.refresh_survey_assignment_aggregates(text)',
    'public.refresh_survey_assignment_aggregates_impl(text)',
    'public.rls_auto_enable()',
    'public.set_course_assignments_updated_at()',
    'public.set_created_by_from_auth_uid()',
    'public.set_created_by_from_auth_uid_impl()',
    'public.sync_course_progress_percent()',
    'public.sync_membership_org_columns()',
    'public.sync_org_invites_org_columns()',
    'public.upsert_course_graph(jsonb)',
    'public.upsert_course_graph(jsonb, uuid, uuid)',
    'public.upsert_course_graph_impl(jsonb)',
    'public.upsert_course_graph_impl(jsonb, uuid, uuid)'
  ];
begin
  foreach function_signature in array function_signatures loop
    execute format('revoke all on function %s from public', function_signature);
    execute format('revoke all on function %s from anon', function_signature);
    execute format('revoke all on function %s from authenticated', function_signature);
    execute format('grant execute on function %s to service_role', function_signature);
  end loop;
end
$$;
