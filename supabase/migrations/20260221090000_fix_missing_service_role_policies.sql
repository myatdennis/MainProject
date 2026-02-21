begin;

-- audit_logs: service role full access
drop policy if exists "audit_logs_service_access" on public.audit_logs;
create policy "audit_logs_service_access"
on public.audit_logs
for all
to public
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- org_invites: service role full access
drop policy if exists "org_invites_service_full_access" on public.org_invites;
create policy "org_invites_service_full_access"
on public.org_invites
for all
to public
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- organization_profiles: service role full access
drop policy if exists "organization_profiles_service_access" on public.organization_profiles;
create policy "organization_profiles_service_access"
on public.organization_profiles
for all
to public
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- _policy_backup: service role full access (internal table)
drop policy if exists "_policy_backup_service_access" on public._policy_backup;
create policy "_policy_backup_service_access"
on public._policy_backup
for all
to public
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

commit;