-- =============================================================================
-- Migration: Fix function_search_path_mutable on public.log_auth_event
--
-- Functions with SECURITY DEFINER must pin search_path to prevent privilege
-- escalation via schema injection. Setting search_path = '' (empty) is the
-- safest option — all references must then be schema-qualified, which they
-- already are (public.auth_audit).
-- =============================================================================

create or replace function public.log_auth_event(
  p_event_type text,
  p_user_id    uuid    default null,
  p_ip         inet    default null,
  p_user_agent text    default null,
  p_details    jsonb   default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.auth_audit(event_type, user_id, ip, user_agent, details)
  values (p_event_type, p_user_id, p_ip, p_user_agent, p_details);
end;
$$;
