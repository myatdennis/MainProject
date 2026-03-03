-- Ensure learners always have a matching organization_memberships row by self-healing
-- when the client portal detects a missing membership.
create or replace function public.ensure_active_membership()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id text;
  v_profile_id uuid;
  v_now timestamptz := timezone('utc', now());
begin
  if v_user_id is null then
    return jsonb_build_object('ensured', false, 'reason', 'unauthenticated');
  end if;

  select organization_id, id
  into v_org_id, v_profile_id
  from public.user_profiles
  where user_id = v_user_id
  order by updated_at desc nulls last
  limit 1;

  if v_org_id is null then
    return jsonb_build_object('ensured', false, 'reason', 'no_org');
  end if;

  if exists (
    select 1
    from public.organization_memberships m
    where m.org_id = v_org_id
      and (m.user_id = v_user_id or m.profile_id = v_user_id)
      and lower(coalesce(m.status, 'active')) = 'active'
      and coalesce(m.is_active, true) = true
      and m.accepted_at is not null
  ) then
    return jsonb_build_object('ensured', false, 'reason', 'exists', 'org_id', v_org_id);
  end if;

  insert into public.organization_memberships (
    org_id,
    user_id,
    profile_id,
    role,
    status,
    is_active,
    accepted_at,
    created_at,
    updated_at
  )
  values (
    v_org_id,
    v_user_id,
    coalesce(v_profile_id, v_user_id),
    'member',
    'active',
    true,
    v_now,
    v_now,
    v_now
  )
  on conflict (org_id, user_id) do update
  set
    role = excluded.role,
    status = excluded.status,
    is_active = excluded.is_active,
    accepted_at = excluded.accepted_at,
    profile_id = coalesce(excluded.profile_id, public.organization_memberships.profile_id),
    updated_at = excluded.updated_at
  where (
    lower(coalesce(public.organization_memberships.status, '')) <> 'active'
    or coalesce(public.organization_memberships.is_active, true) is distinct from true
    or public.organization_memberships.accepted_at is null
  );

  return jsonb_build_object('ensured', true, 'org_id', v_org_id);
end;
$$;

comment on function public.ensure_active_membership() is
'Ensures the authenticated user has an active organization_memberships row derived from user_profiles.organization_id';

revoke all on function public.ensure_active_membership() from public;
grant execute on function public.ensure_active_membership() to authenticated;
grant execute on function public.ensure_active_membership() to service_role;
