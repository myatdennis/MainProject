export const USER_IMPORT_HEADERS = [
  'email',
  'first_name',
  'last_name',
  'organization_id',
  'role',
  'job_title',
  'department',
  'phone_number',
  'course_ids',
];

export type ParsedUserImportRow = {
  index: number;
  raw: Record<string, string>;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  role: string;
  jobTitle: string;
  department: string;
  phoneNumber: string;
  courseIds: string[];
};

export type UserImportIssue = {
  index: number;
  message: string;
};

export type UserImportResult = {
  email: string;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  message: string;
  userId?: string | null;
  organizationId?: string | null;
  emailSent?: boolean;
  setupLinkPresent?: boolean;
};

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const normalizeEmail = (value: unknown) => normalizeText(value).toLowerCase();
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  result.push(current);
  return result;
};

export const parseUserImportCsv = (text: string): Record<string, string>[] => {
  const lines = text.replace(/\r/g, '').split('\n').filter((line) => line.trim().length > 0);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map((header) => normalizeText(header));
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = normalizeText(values[idx] ?? '');
    });
    return row;
  });
};

const parseCourseIds = (value: string): string[] => {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized
    .split(/[;|]/g)
    .flatMap((chunk) => chunk.split(',').map((id) => id.trim()))
    .filter(Boolean);
};

export const normalizeUserImportRows = (rows: Record<string, string>[]): ParsedUserImportRow[] => {
  return rows.map((row, index) => ({
    index,
    raw: row,
    email: normalizeEmail(row.email || row.email_address || row.user_email),
    firstName: normalizeText(row.first_name || row.firstName || row.given_name),
    lastName: normalizeText(row.last_name || row.lastName || row.family_name),
    organizationId: normalizeText(row.organization_id || row.organizationId || row.org_id || row.orgId),
    role: normalizeText(row.role || row.membership_role || row.membershipRole),
    jobTitle: normalizeText(row.job_title || row.jobTitle),
    department: normalizeText(row.department),
    phoneNumber: normalizeText(row.phone_number || row.phoneNumber),
    courseIds: parseCourseIds(row.course_ids || row.courseIds || row.courses || ''),
  }));
};

export const validateUserImportRows = (
  rows: ParsedUserImportRow[],
  options: {
    validOrgIds?: Set<string>;
    validRoles?: Set<string>;
    validCourseIdsByOrg?: Map<string, Set<string>>;
  } = {},
): UserImportIssue[] => {
  const issues: UserImportIssue[] = [];
  const seenKeys = new Set<string>();

  rows.forEach((row) => {
    const rowIssues: string[] = [];
    if (!row.email || !isValidEmail(row.email)) {
      rowIssues.push('invalid email');
    }
    if (!row.organizationId) {
      rowIssues.push('organization_id is required');
    } else if (options.validOrgIds && !options.validOrgIds.has(row.organizationId)) {
      rowIssues.push('organization_id not found');
    }
    if (!row.role) {
      rowIssues.push('role is required');
    } else if (options.validRoles && !options.validRoles.has(row.role.toLowerCase())) {
      rowIssues.push('invalid role');
    }

    if (row.email && row.organizationId) {
      const key = `${row.email}|${row.organizationId}`;
      if (seenKeys.has(key)) {
        rowIssues.push('duplicate row in file');
      } else {
        seenKeys.add(key);
      }
    }

    if (row.courseIds.length && options.validCourseIdsByOrg?.has(row.organizationId)) {
      const validCourses = options.validCourseIdsByOrg.get(row.organizationId) || new Set();
      const invalid = row.courseIds.filter((id) => !validCourses.has(id));
      if (invalid.length) {
        rowIssues.push(`invalid course_ids: ${invalid.join(', ')}`);
      }
    }

    if (rowIssues.length) {
      issues.push({ index: row.index, message: rowIssues.join('; ') });
    }
  });

  return issues;
};

const escapeCsvValue = (value: unknown) => {
  const text = value == null ? '' : String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const buildResultsCsv = (results: UserImportResult[]): string => {
  const headers = [
    'email',
    'status',
    'message',
    'userId',
    'organizationId',
    'emailSent',
    'setupLinkPresent',
  ];
  const rows = results.map((result) =>
    [
      result.email,
      result.status,
      result.message,
      result.userId ?? '',
      result.organizationId ?? '',
      result.emailSent ? 'true' : 'false',
      result.setupLinkPresent ? 'true' : 'false',
    ].map(escapeCsvValue).join(','),
  );
  return [headers.join(','), ...rows].join('\n');
};

export const buildFailedRowsCsv = (
  rows: ParsedUserImportRow[],
  issues: UserImportIssue[],
): string => {
  const issueMap = new Map(issues.map((issue) => [issue.index, issue.message]));
  const headers = [...USER_IMPORT_HEADERS, 'error'];
  const csvRows = rows
    .filter((row) => issueMap.has(row.index))
    .map((row) => {
      const raw = row.raw;
      const values = USER_IMPORT_HEADERS.map((header) => raw[header] ?? '');
      values.push(issueMap.get(row.index) ?? '');
      return values.map(escapeCsvValue).join(',');
    });
  return [headers.join(','), ...csvRows].join('\n');
};
