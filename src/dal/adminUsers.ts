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
  const userId = String(row?.id ?? row?.userId ?? '').trim();
  const normalizedEmail = row?.email ? String(row.email).toLowerCase() : undefined;
  return {
    membershipId: String(row?.membershipId ?? row?.id ?? ''),
    orgId: String(row?.organization_id ?? row?.org?.id ?? row?.orgId ?? ''),
    userId,
    email: normalizedEmail ?? undefined,
    name: row?.name ?? ((`${row?.first_name ?? ''} ${row?.last_name ?? ''}`).trim() || undefined),
    role: row?.role ?? undefined,
    status: row?.status ?? 'active',
    title: undefined,
  };
};

export const listUsersByOrg = async (orgId: string): Promise<AdminUserRecord[]> => {
  if (!orgId) {
    throw new Error('orgId is required to load users');
  }
  const params = new URLSearchParams({ orgId });
  const json = await apiRequest<{ data: any[] }>(`/api/admin/users?${params.toString()}`);
  return (json.data ?? [])
    .filter((row) => row?.user_id || row?.userId || row?.profile?.email || row?.user?.email)
    .map(mapAdminUserRecord)
    .filter((record) => Boolean(record.userId));
};

export default {
  listUsersByOrg,
};
