import apiRequest from '../utils/apiClient';

export interface AdminUserRecord {
  membershipId: string;
  orgId: string;
  organization_id?: string;
  org_id?: string;
  userId: string;
  user_id?: string;
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  title?: string;
  profile?: any;
  user?: any;
  organization?: string;
  org?: any;
}

const normalizeUserId = (row: any) =>
  String(
    row?.user_id ??
      row?.user?.id ??
      row?.userId ??
      row?.id ??
      row?.user_id_uuid ??
      '',
  ).trim();

const normalizeOrgId = (row: any) =>
  String(
    row?.organization_id ??
      row?.org_id ??
      row?.orgId ??
      row?.org?.id ??
      row?.organization ??
      '',
  ).trim();

const mapAdminUserRecord = (row: any): AdminUserRecord => {
  const userId = normalizeUserId(row);
  const orgId = normalizeOrgId(row);

  const rawName =
    row?.name ||
    ((`${row?.first_name ?? ''} ${row?.last_name ?? ''}`).trim() || undefined);
  const status =
    row?.status ||
    row?.membership_status ||
    row?.profile?.status ||
    row?.user?.status ||
    'active';

  return {
    membershipId: String(row?.membershipId ?? row?.id ?? row?.membership_id ?? '').trim(),
    orgId,
    organization_id: orgId,
    org_id: orgId,
    userId,
    user_id: String(row?.user_id ?? row?.user?.id ?? '').trim(),
    email:
      row?.email ??
      row?.profile?.email ??
      row?.user?.email ??
      (row?.userId ? String(row.userId).toLowerCase() : undefined),
    name: rawName,
    role: row?.role ?? row?.membershipRole ?? row?.user?.role ?? row?.profile?.role ?? '',
    status: String(status).toLowerCase(),
    title: row?.title ?? row?.user?.title ?? row?.profile?.title ?? '',
    profile: row?.profile,
    user: row?.user,
    organization: row?.organization ?? orgId,
    org: row?.org ?? { id: orgId },
  };
};

export const listUsersByOrg = async (orgId: string): Promise<AdminUserRecord[]> => {
  if (!orgId) {
    throw new Error('orgId is required to load users');
  }
  const params = new URLSearchParams({ orgId });
  const json = await apiRequest<{ data: any[] }>(`/api/admin/users?${params.toString()}`);
  return (json.data ?? [])
    .filter((row) =>
      Boolean(
        row?.user_id ||
          row?.user?.id ||
          row?.userId ||
          row?.profile?.email ||
          row?.user?.email ||
          row?.email,
      ),
    )
    .map(mapAdminUserRecord)
    .filter((record) => Boolean(record.userId));
};

export default {
  listUsersByOrg,
};
