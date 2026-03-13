import apiRequest from '../utils/apiClient';

export interface AdminUserRecord {
  membershipId: string;
  orgId: string;
  userId: string;
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  title?: string;
}

const mapAdminUserRecord = (row: any): AdminUserRecord => {
  const profile = row?.profile ?? {};
  const firstName = profile.first_name ?? profile.firstName ?? '';
  const lastName = profile.last_name ?? profile.lastName ?? '';
  const displayName =
    profile.full_name ??
    profile.fullName ??
    profile.name ??
    `${firstName} ${lastName}`.trim();

  const normalizedEmail = (row?.invited_email ?? profile.email ?? '').toLowerCase() || undefined;
  let userId = String(row?.user_id ?? row?.userId ?? row?.user_id_uuid ?? row?.userUuid ?? '').trim();
  if (!userId && normalizedEmail) {
    userId = normalizedEmail;
  }

  return {
    membershipId: String(row?.id ?? row?.membership_id ?? row?.membershipId ?? ''),
    orgId: String(row?.org_id ?? row?.organization_id ?? row?.orgId ?? ''),
    userId,
    email: normalizedEmail ?? profile.email ?? row?.profile?.contact_email ?? undefined,
    name: displayName || undefined,
    role: row?.role ?? undefined,
    status: row?.status ?? undefined,
    title: profile.title ?? profile.job_title ?? undefined,
  };
};

export const listUsersByOrg = async (orgId: string): Promise<AdminUserRecord[]> => {
  if (!orgId) {
    throw new Error('orgId is required to load users');
  }
  const params = new URLSearchParams({ orgId });
  const json = await apiRequest<{ data: any[] }>(`/api/admin/users?${params.toString()}`);
  return (json.data ?? [])
    .filter((row) => row?.user_id || row?.userId || row?.invited_email)
    .map(mapAdminUserRecord)
    .filter((record) => Boolean(record.userId));
};

export default {
  listUsersByOrg,
};
