-- =============================================================================
-- Migration: Fix security_definer_view ERRORs on 4 views
--
-- Views created via Supabase helpers default to SECURITY DEFINER, which
-- bypasses RLS for the querying user. Recreating each view with
-- security_invoker = true ensures RLS is evaluated as the calling user.
-- =============================================================================

-- ── 1. user_organizations_vw ─────────────────────────────────────────────────
drop view if exists public.user_organizations_vw;
create view public.user_organizations_vw
  with (security_invoker = true)
as
  select
    m.user_id,
    m.organization_id,
    m.role,
    coalesce(m.status, 'active') as status,
    coalesce(m.is_active, true)  as is_active,
    m.accepted_at,
    m.created_at,
    m.updated_at,
    m.last_seen_at,
    o.name   as organization_name,
    o.slug   as organization_slug,
    o.status as organization_status,
    o.subscription,
    o.features
  from organization_memberships m
  join organizations o on o.id = m.organization_id;

-- ── 2. organization_invites ───────────────────────────────────────────────────
drop view if exists public.organization_invites;
create view public.organization_invites
  with (security_invoker = true)
as
  select
    id,
    org_id as organization_id,
    org_id,
    email,
    role,
    status,
    invite_token                          as token,
    coalesce(invited_by, inviter_id)      as invited_by,
    coalesce(invited_at, created_at)      as invited_at,
    accepted_at,
    accepted_user_id,
    expires_at,
    last_sent_at,
    reminder_count,
    duplicate_of,
    metadata,
    inviter_id,
    inviter_email,
    invited_name,
    note,
    created_at,
    updated_at
  from public.org_invites i;

-- ── 3. auth_audit_summary ─────────────────────────────────────────────────────
drop view if exists public.auth_audit_summary;
create view public.auth_audit_summary
  with (security_invoker = true)
as
  select
    event_type,
    count(*) filter (where created_at >= now() - interval '7 days')    as last_7_days,
    count(*) filter (where created_at >= now() - interval '24 hours')  as last_24_hours,
    count(*) filter (where created_at >= now() - interval '1 hour')    as last_1_hour
  from auth_audit
  group by event_type
  order by last_24_hours desc;

-- ── 4. org_onboarding_progress_vw ────────────────────────────────────────────
drop view if exists public.org_onboarding_progress_vw;
create view public.org_onboarding_progress_vw
  with (security_invoker = true)
as
  with step_counts as (
    select
      org_id,
      count(*)                                                             as total_steps,
      count(*) filter (where status = 'completed')                        as completed_steps,
      min(created_at)   filter (where step = 'org_created')               as org_created_at,
      max(completed_at) filter (where step = 'first_login')               as first_login_at
    from org_activation_steps
    group by org_id
  ),
  invite_counts as (
    select
      org_id,
      count(*) filter (where status in ('pending', 'sent'))               as pending_invites,
      count(*) filter (where status = 'accepted')                         as accepted_invites,
      count(*) filter (
        where status = 'pending'
          and created_at < (timezone('utc', now()) - interval '7 days')
      )                                                                    as stale_invites,
      max(last_sent_at)                                                    as last_sent_at
    from org_invites
    group by org_id
  )
  select
    o.id                                          as org_id,
    o.name                                        as org_name,
    coalesce(sc.total_steps,      0::bigint)      as total_steps,
    coalesce(sc.completed_steps,  0::bigint)      as completed_steps,
    coalesce(ic.pending_invites,  0::bigint)      as pending_invites,
    coalesce(ic.accepted_invites, 0::bigint)      as accepted_invites,
    coalesce(ic.stale_invites,    0::bigint)      as stale_invites,
    ic.last_sent_at,
    sc.org_created_at,
    sc.first_login_at
  from organizations o
  left join step_counts  sc on sc.org_id = o.id
  left join invite_counts ic on ic.org_id = o.id;
