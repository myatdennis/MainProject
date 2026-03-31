import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { createHttpError, withHttpError } from '../middleware/apiErrorHandler.js';
import { validateOrgId } from '../lib/inviteHelper.js';
const router = express.Router();

// PATCH /api/admin/users/:userId
router.patch('/:userId', async (req, res, next) => {
  try {
    if (!supabase) {
      return next(createHttpError(503, 'supabase_not_configured', 'Supabase not configured'));
    }

    const userId = normalizeText(req.params?.userId || '');
    if (!userId) {
      return next(createHttpError(400, 'user_id_required', 'userId is required.'));
    }

    // Only allow org transfer and membership role update for now
    const orgId =
      normalizeText(req.body?.orgId) ||
      normalizeText(req.body?.organizationId) ||
      normalizeText(req.body?.org_id) ||
      normalizeText(req.body?.organization_id) ||
      '';
    const membershipRole = normalizeOrgRole(req.body?.membershipRole || req.body?.membership_role || 'member');

    if (!orgId) {
      return next(createHttpError(400, 'org_id_required', 'organizationId is required.'));
    }

    // Update user_profiles
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ organization_id: orgId })
      .eq('id', userId);
    if (profileError) {
      return next(createHttpError(500, 'profile_update_failed', profileError.message));
    }

    // Upsert organization_memberships (ensure only one active membership)
    const orgColumn = await resolveOrganizationMembershipsOrgColumn();
    // Deactivate all memberships for this user first
    const { error: deactivateError } = await supabase
      .from('organization_memberships')
      .update({ status: 'inactive' })
      .eq('user_id', userId);
    if (deactivateError) {
      return next(createHttpError(500, 'membership_deactivate_failed', deactivateError.message));
    }
    // Upsert new active membership
    await upsertOrganizationMembership({ orgId, userId, role: membershipRole });

    // Optionally assign org content (courses/surveys) to user
    const actorUserId = req.user?.userId || req.user?.id || null;
    await assignPublishedOrganizationCoursesToUser({ orgId, userId, actorUserId });
    await assignPublishedOrganizationSurveysToUser({ orgId, userId, actorUserId });

    // Fetch updated user profile and membership for response
    const { data: profile, error: fetchProfileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (fetchProfileError || !profile) {
      return next(createHttpError(404, 'user_not_found', 'User profile not found after update.'));
    }
    const { data: membership, error: fetchMembershipError } = await supabase
      .from('organization_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq(orgColumn, orgId)
      .eq('status', 'active')
      .maybeSingle();
    if (fetchMembershipError || !membership) {
      return next(createHttpError(404, 'membership_not_found', 'Active membership not found after update.'));
    }

    // Normalize response: only one org, no conflicting org fields
    // Canonical org: active membership.organization_id
    let orgData = null;
    if (membership && membership.organization_id) {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', membership.organization_id)
        .maybeSingle();
      if (!orgError && org) orgData = org;
    }
    res.json({
      success: true,
      data: {
        id: profile.id,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        role: membership.role,
        organization_id: membership.organization_id,
        organization: orgData,
      },
    });
  } catch (err) {
    return next(withHttpError(err, 500, 'admin_users_update_failed'));
  }
});

router.use(authenticate, requireAdmin);

const INVITE_PASSWORD_MIN_CHARS = 8;
const writableMembershipRoles = new Set(['admin', 'owner', 'org_admin', 'organization_admin', 'super_admin']);
const ORG_ROLE_VALUES = new Set(['owner', 'admin', 'member', 'learner']);

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeOrgRole = (value, fallback = 'member') => {
  const normalized = normalizeText(value).toLowerCase();
  return ORG_ROLE_VALUES.has(normalized) ? normalized : fallback;
};
const isValidEmail = (value = '') => {
  const normalized = normalizeEmail(value);
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
};

const parseCsvLine = (line) => {
  const result = [];
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

const parseCsvText = (text) => {
  if (!text) return [];
  const lines = String(text).replace(/\r/g, '').split('\n').filter((line) => line.trim().length > 0);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map((h) => normalizeText(h));
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = normalizeText(values[idx] ?? '');
    });
    return row;
  });
};

const parseCourseIds = (value) => {
  if (Array.isArray(value)) return value.map((id) => normalizeText(id)).filter(Boolean);
  if (typeof value !== 'string') return [];
  const normalized = value.trim();
  if (!normalized) return [];
  return normalized
    .split(/[;|]/g)
    .flatMap((chunk) => chunk.split(',').map((id) => id.trim()))
    .filter(Boolean);
};

const normalizeImportRow = (row, index, fallbackOrgId) => {
  const email = normalizeEmail(row.email || row.email_address || row.user_email);
  const orgId =
    normalizeText(row.organization_id || row.organizationId || row.org_id || row.orgId) ||
    normalizeText(fallbackOrgId) ||
    '';
  const role = normalizeText(row.role || row.membership_role || row.membershipRole || '').toLowerCase();
  return {
    index,
    raw: row,
    email,
    orgId,
    role,
    firstName: normalizeText(row.first_name || row.firstName || row.given_name || ''),
    lastName: normalizeText(row.last_name || row.lastName || row.family_name || ''),
    jobTitle: normalizeText(row.job_title || row.jobTitle || ''),
    department: normalizeText(row.department || ''),
    phoneNumber: normalizeText(row.phone_number || row.phoneNumber || ''),
    courseIds: parseCourseIds(row.course_ids || row.courseIds || row.courses || ''),
  };
};

const isMissingColumnError = (error) =>
  error?.code === '42703' ||
  error?.code === 'PGRST204' ||
  /column .* does not exist/i.test(String(error?.message || '')) ||
  /Could not find ['"]?([\w.]+)['"]? column/i.test(String(error?.message || ''));

const extractMissingColumnName = (error) => {
  const text = String(error?.message || '');
  const match =
    text.match(/column\s+"?([\w.]+)"?\s+does not exist/i) ||
    text.match(/Could not find ['"]?([\w.]+)['"]? column/i);
  return match?.[1] ?? null;
};

let organizationMembershipsOrgColumn = null;
let assignmentsOrgColumn = null;
let orgInvitesOrganizationColumn = null;
let orgInvitesTokenColumn = null;

const resolveOrganizationMembershipsOrgColumn = async () => {
  if (!supabase) return 'organization_id';
  if (organizationMembershipsOrgColumn) return organizationMembershipsOrgColumn;

  for (const column of ['organization_id', 'org_id']) {
    const { error } = await supabase
      .from('organization_memberships')
      .select('user_id', { head: true, count: 'exact' })
      .is(column, null)
      .limit(1);
    if (error) {
      if (isMissingColumnError(error)) continue;
      throw error;
    }
    organizationMembershipsOrgColumn = column;
    return column;
  }

  organizationMembershipsOrgColumn = 'organization_id';
  return organizationMembershipsOrgColumn;
};

const resolveOrgInvitesOrganizationColumn = async () => {
  if (!supabase) return 'organization_id';
  if (orgInvitesOrganizationColumn) return orgInvitesOrganizationColumn;

  for (const column of ['organization_id', 'org_id']) {
    const { error } = await supabase
      .from('org_invites')
      .select('email', { head: true, count: 'exact' })
      .is(column, null)
      .limit(1);
    if (error) {
      if (isMissingColumnError(error)) continue;
      throw error;
    }
    orgInvitesOrganizationColumn = column;
    return column;
  }

  orgInvitesOrganizationColumn = 'organization_id';
  return orgInvitesOrganizationColumn;
};

const resolveAssignmentsOrgColumn = async () => {
  if (!supabase) return 'organization_id';
  if (assignmentsOrgColumn) return assignmentsOrgColumn;

  for (const column of ['organization_id', 'org_id']) {
    const { error } = await supabase
      .from('assignments')
      .select('id', { head: true, count: 'exact' })
      .is(column, null)
      .limit(1);
    if (error) {
      if (isMissingColumnError(error)) continue;
      throw error;
    }
    assignmentsOrgColumn = column;
    return column;
  }

  assignmentsOrgColumn = 'organization_id';
  return assignmentsOrgColumn;
};

const resolveOrgInvitesTokenColumn = async () => {
  if (!supabase) return 'token';
  if (orgInvitesTokenColumn) return orgInvitesTokenColumn;

  for (const column of ['token', 'invite_token']) {
    const { error } = await supabase
      .from('org_invites')
      .select('email', { head: true, count: 'exact' })
      .is(column, null)
      .limit(1);
    if (error) {
      if (isMissingColumnError(error)) continue;
      throw error;
    }
    orgInvitesTokenColumn = column;
    return column;
  }

  orgInvitesTokenColumn = 'token';
  return orgInvitesTokenColumn;
};

const getOrganizationMembershipsOrgColumnName = async () => resolveOrganizationMembershipsOrgColumn();

const createInviteFallback = async ({ orgId, email, role, actorUserId = null, firstName = '', lastName = '' }) => {
  validateOrgId(orgId, 'organizationId is required for invite fallback');
  const orgColumn = await resolveOrgInvitesOrganizationColumn();
  const tokenColumn = await resolveOrgInvitesTokenColumn();
  const normalizedEmail = normalizeEmail(email);
  const token = randomUUID().replace(/-/g, '');

  // Helpful structured log for debugging invite creation attempts in fallback flow.
  logInviteInsertAttempt({ orgId, email: normalizedEmail });

  const { data: existing, error: existingError } = await supabase
    .from('org_invites')
    .select('*')
    .eq(orgColumn, orgId)
    .eq('email', normalizedEmail)
    .in('status', ['pending', 'sent'])
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    return { id: existing.id, email: normalizedEmail, duplicate: true };
  }

  const basePayload = {
    email: normalizedEmail,
    role,
    status: 'pending',
    expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    created_by: actorUserId ?? null,
    inviter_id: actorUserId ?? null,
    invited_name: `${normalizeText(firstName)} ${normalizeText(lastName)}`.trim() || null,
  };
  // If the complementary org column exists, add both to the payload so
  // database-side triggers that still reference the legacy column see a value.
  try {
    const complementaryOrgColumn = orgColumn === 'organization_id' ? 'org_id' : 'organization_id';
    const { error: compErr } = await supabase
      .from('org_invites')
      .select('id', { head: true, count: 'exact' })
      .is(complementaryOrgColumn, null)
      .limit(1);
    if (!compErr) {
      basePayload[orgColumn] = orgId;
      basePayload[complementaryOrgColumn] = orgId;
    } else {
      basePayload[orgColumn] = orgId;
    }
  } catch (probeErr) {
    basePayload[orgColumn] = orgId;
  }

  // Likewise include both token column names when available.
  try {
    const complementaryTokenColumn = tokenColumn === 'token' ? 'invite_token' : 'token';
    const { error: tErr } = await supabase
      .from('org_invites')
      .select('id', { head: true, count: 'exact' })
      .is(complementaryTokenColumn, null)
      .limit(1);
    if (!tErr) {
      basePayload[tokenColumn] = token;
      basePayload[complementaryTokenColumn] = token;
    } else {
      basePayload[tokenColumn] = token;
    }
  } catch (probeErr) {
    basePayload[tokenColumn] = token;
  }

  const attemptPayloads = buildOrgInviteInsertAttemptPayloads({
    orgColumn,
    tokenColumn,
    orgId,
    token,
    basePayload,
  });

  let lastError = null;
  for (const candidate of attemptPayloads) {
    const { data, error } = await supabase.from('org_invites').insert(candidate).select('id,email').single();
    if (!error) {
      return { id: data?.id ?? null, email: normalizedEmail, duplicate: false };
    }
    lastError = error;
    if (!isMissingColumnError(error)) {
      throw error;
    }
    const missingColumn = extractMissingColumnName(error);
    if (missingColumn !== 'token' && missingColumn !== 'invite_token') {
      throw error;
    }
  }

  throw lastError ?? new Error('org_invites_insert_failed');
};

const upsertOrganizationMembership = async ({ orgId, userId, role, actorUserId = null }) => {
  const orgColumn = await resolveOrganizationMembershipsOrgColumn();
  const payload = {
    user_id: userId,
    role,
    status: 'active',
    invited_by: actorUserId ?? null,
  };
  payload[orgColumn] = orgId;

  const { error } = await supabase
    .from('organization_memberships')
    .upsert(payload, { onConflict: `${orgColumn},user_id` });
  if (error) throw error;
};

const findAuthUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !supabase) return null;

  const directLookup = supabase.auth?.admin?.getUserByEmail;
  if (typeof directLookup === 'function') {
    const { data, error } = await directLookup.call(supabase.auth.admin, normalizedEmail);
    if (error) {
      const message = String(error?.message || '').toLowerCase();
      const isNotFound = message.includes('user not found');
      if (!isNotFound) {
        throw error;
      }
    }
    if (data?.user) {
      return data.user;
    }
  }

  const perPage = 200;
  let page = 1;
  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = Array.isArray(data?.users) ? data.users : [];
    const match = users.find((user) => normalizeEmail(user?.email) === normalizedEmail) ?? null;
    if (match) return match;
    const nextPage = Number(data?.nextPage ?? 0);
    if (Number.isFinite(nextPage) && nextPage > page) {
      page = nextPage;
      continue;
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
};

const listPublishedOrganizationCourseIds = async (orgId) => {
  if (!supabase || !orgId) return [];

  for (const column of ['organization_id', 'org_id']) {
    const { data, error } = await supabase
      .from('courses')
      .select('id')
      .eq(column, orgId)
      .eq('status', 'published');
    if (error) {
      if (isMissingColumnError(error)) continue;
      throw error;
    }
    return Array.from(new Set((data || []).map((row) => row?.id).filter(Boolean)));
  }

  return [];
};

const listPublishedOrganizationSurveyIds = async (orgId) => {
  if (!supabase || !orgId) return [];

  const { data: surveyRows, error: surveyError } = await supabase
    .from('surveys')
    .select('id')
    .eq('status', 'published');
  if (surveyError) throw surveyError;

  const publishedIds = new Set((surveyRows || []).map((row) => row?.id).filter(Boolean));
  if (!publishedIds.size) return [];

  const assignmentOrgColumn = await resolveAssignmentsOrgColumn();
  const { data: assignmentRows, error: assignmentError } = await supabase
    .from('assignments')
    .select('survey_id')
    .eq('assignment_type', 'survey')
    .eq(assignmentOrgColumn, orgId)
    .is('user_id', null)
    .eq('active', true);

  if (!assignmentError) {
    return Array.from(
      new Set((assignmentRows || []).map((row) => row?.survey_id).filter((id) => id && publishedIds.has(id))),
    );
  }

  const { data: legacyRows, error: legacyError } = await supabase
    .from('survey_assignments')
    .select('survey_id')
    .contains('organization_ids', [orgId]);
  if (legacyError) throw legacyError;

  return Array.from(
    new Set((legacyRows || []).map((row) => row?.survey_id).filter((id) => id && publishedIds.has(id))),
  );
};

const assignPublishedOrganizationCoursesToUser = async ({ orgId, userId, actorUserId = null }) => {
  const courseIds = await listPublishedOrganizationCourseIds(orgId);
  if (!courseIds.length) return { inserted: 0, updated: 0 };

  const assignmentOrgColumn = await resolveAssignmentsOrgColumn();
  const { data: existingRows, error: existingError } = await supabase
    .from('assignments')
    .select('id,course_id,metadata,assigned_by')
    .eq(assignmentOrgColumn, orgId)
    .eq('user_id', userId)
    .eq('assignment_type', 'course')
    .eq('active', true)
    .in('course_id', courseIds);
  if (existingError) throw existingError;

  const existingMap = new Map((existingRows || []).filter((row) => row?.course_id).map((row) => [String(row.course_id), row]));
  const updates = [];
  const inserts = [];

  for (const courseId of courseIds) {
    const existing = existingMap.get(String(courseId));
    if (existing) {
      updates.push({
        id: existing.id,
        metadata: {
          ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
          assigned_via: 'organization_membership_auto_assign',
          assignment_source: 'organization_membership',
        },
        assigned_by: existing.assigned_by ?? actorUserId ?? null,
        active: true,
      });
      continue;
    }

    inserts.push({
      organization_id: orgId,
      course_id: courseId,
      user_id: userId,
      assignment_type: 'course',
      assigned_by: actorUserId ?? null,
      status: 'assigned',
      progress: 0,
      metadata: {
        assigned_via: 'organization_membership_auto_assign',
        assignment_source: 'organization_membership',
      },
      active: true,
      due_at: null,
      note: null,
    });
  }

  for (const update of updates) {
    const { id, ...changes } = update;
    const { error } = await supabase.from('assignments').update(changes).eq('id', id);
    if (error) throw error;
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('assignments').insert(inserts);
    if (error) throw error;
  }

  return { inserted: inserts.length, updated: updates.length };
};

const assignCourseIdsToUser = async ({ orgId, userId, courseIds, actorUserId = null }) => {
  if (!courseIds?.length) return { inserted: 0, updated: 0 };
  const uniqueCourseIds = Array.from(new Set(courseIds.map((id) => String(id))));

  const assignmentOrgColumn = await resolveAssignmentsOrgColumn();
  const { data: existingRows, error: existingError } = await supabase
    .from('assignments')
    .select('id,course_id,metadata,assigned_by')
    .eq(assignmentOrgColumn, orgId)
    .eq('user_id', userId)
    .eq('assignment_type', 'course')
    .eq('active', true)
    .in('course_id', uniqueCourseIds);
  if (existingError) throw existingError;

  const existingMap = new Map(
    (existingRows || []).filter((row) => row?.course_id).map((row) => [String(row.course_id), row]),
  );
  const updates = [];
  const inserts = [];

  for (const courseId of uniqueCourseIds) {
    const existing = existingMap.get(String(courseId));
    if (existing) {
      updates.push({
        id: existing.id,
        metadata: {
          ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
          assigned_via: 'csv_import',
          assignment_source: 'csv_import',
        },
        assigned_by: existing.assigned_by ?? actorUserId ?? null,
        active: true,
      });
      continue;
    }

    inserts.push({
      organization_id: orgId,
      user_id: userId,
      assignment_type: 'course',
      course_id: courseId,
      status: 'assigned',
      assigned_by: actorUserId ?? null,
      active: true,
      metadata: {
        assigned_via: 'csv_import',
        assignment_source: 'csv_import',
      },
    });
  }

  for (const update of updates) {
    const { id, ...changes } = update;
    const { error } = await supabase.from('assignments').update(changes).eq('id', id);
    if (error) throw error;
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('assignments').insert(inserts);
    if (error) throw error;
  }

  return { inserted: inserts.length, updated: updates.length };
};

const fetchOrganizationsByIds = async (supabaseClient, orgIds) => {
  const ids = Array.from(new Set((orgIds || []).filter(Boolean)));
  if (!ids.length) return new Set();
  const { data, error } = await supabaseClient.from('organizations').select('id').in('id', ids);
  if (error) throw error;
  return new Set((data || []).map((row) => row?.id).filter(Boolean));
};

const fetchCoursesByIds = async (supabaseClient, courseIds) => {
  const ids = Array.from(new Set((courseIds || []).filter(Boolean)));
  if (!ids.length) return new Map();
  const { data, error } = await supabaseClient
    .from('courses')
    .select('id, organization_id')
    .in('id', ids);
  if (error) throw error;
  const map = new Map();
  (data || []).forEach((row) => {
    if (!row?.id) return;
    const orgId = row.organization_id ?? null;
    if (!map.has(orgId)) map.set(orgId, new Set());
    map.get(orgId).add(String(row.id));
  });
  return map;
};

const validateImportRows = ({ rows, validOrgIds, courseIdsByOrg }) => {
  const errors = new Map();
  const seenKeys = new Set();

  rows.forEach((row) => {
    const rowErrors = [];
    if (!row.email || !isValidEmail(row.email)) {
      rowErrors.push('invalid email');
    }
    if (!row.orgId) {
      rowErrors.push('organization_id is required');
    } else if (validOrgIds && validOrgIds.size && !validOrgIds.has(row.orgId)) {
      rowErrors.push('organization_id not found');
    }
    if (!row.role || !ORG_ROLE_VALUES.has(row.role)) {
      rowErrors.push('invalid role');
    }

    const key = `${row.email}|${row.orgId}`;
    if (row.email && row.orgId) {
      if (seenKeys.has(key)) {
        rowErrors.push('duplicate row in file');
      } else {
        seenKeys.add(key);
      }
    }

    if (row.courseIds?.length) {
      const validCourses = courseIdsByOrg?.get(row.orgId) || new Set();
      const invalid = row.courseIds.filter((id) => !validCourses.has(String(id)));
      if (invalid.length) {
        rowErrors.push(`invalid course_ids: ${invalid.join(', ')}`);
      }
    }

    if (rowErrors.length) {
      errors.set(row.index, rowErrors);
    }
  });

  return errors;
};

const processUserImportRows = async ({ rows, defaultOrgId, actorUserId, requestId, deps = {} }) => {
  const supabaseClient = deps.supabaseClient || supabase;
  const loggerInstance = deps.logger || logger;
  const provisionUser = deps.provisionUser || ((row) => provisionImportedUser(row, actorUserId, defaultOrgId));
  const assignCourses = deps.assignCourses || assignCourseIdsToUser;

  if (!supabaseClient) {
    throw createHttpError(503, 'supabase_not_configured', 'Supabase not configured');
  }

  const normalizedRows = rows.map((row, index) => normalizeImportRow(row, index, defaultOrgId));
  const orgIds = normalizedRows.map((row) => row.orgId).filter(Boolean);
  const courseIds = normalizedRows.flatMap((row) => row.courseIds || []);

  const validOrgIds = await fetchOrganizationsByIds(supabaseClient, orgIds);
  const courseIdsByOrg = await fetchCoursesByIds(supabaseClient, courseIds);
  const validationErrors = validateImportRows({ rows: normalizedRows, validOrgIds, courseIdsByOrg });

  if (validationErrors.size) {
    validationErrors.forEach((messages, index) => {
      const row = normalizedRows.find((entry) => entry.index === index);
      loggerInstance.warn('admin_users_import_validation_failed', {
        requestId,
        rowIndex: index,
        email: row?.email ?? null,
        organizationId: row?.orgId ?? null,
        message: messages.join('; '),
      });
    });
  }

  const results = [];
  const batchSize = 10;

  for (let i = 0; i < normalizedRows.length; i += batchSize) {
    const batch = normalizedRows.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (row) => {
        if (validationErrors.has(row.index)) {
          return {
            email: row.email,
            organizationId: row.orgId,
            status: 'failed',
            message: validationErrors.get(row.index).join('; '),
            userId: null,
            emailSent: false,
            setupLinkPresent: false,
          };
        }

        try {
          const provisionResult = await provisionUser(row.raw);
          if (row.courseIds?.length) {
            await assignCourses({
              orgId: provisionResult.orgId,
              userId: provisionResult.userId,
              courseIds: row.courseIds,
              actorUserId,
            });
          }

          const status = provisionResult.created
            ? 'created'
            : provisionResult.membershipCreated
              ? 'updated'
              : 'skipped';

          return {
            email: provisionResult.email,
            organizationId: provisionResult.orgId,
            status,
            message: provisionResult.created
              ? 'user created'
              : provisionResult.membershipCreated
                ? 'existing user updated'
                : 'existing membership reused',
            userId: provisionResult.userId,
            emailSent: Boolean(provisionResult.emailSent),
            setupLinkPresent: Boolean(provisionResult.setupLink),
          };
        } catch (error) {
          loggerInstance.warn('admin_users_import_row_failed', {
            requestId,
            email: row.email,
            organizationId: row.orgId,
            message: error?.message || String(error),
          });
          return {
            email: row.email,
            organizationId: row.orgId,
            status: 'failed',
            message: error?.message || 'provisioning failed',
            userId: null,
            emailSent: false,
            setupLinkPresent: false,
          };
        }
      }),
    );
    results.push(...batchResults);
  }

  return { results };
};

const assignPublishedOrganizationSurveysToUser = async ({ orgId, userId, actorUserId = null }) => {
  const surveyIds = await listPublishedOrganizationSurveyIds(orgId);
  if (!surveyIds.length) return { inserted: 0, updated: 0 };

  const assignmentOrgColumn = await resolveAssignmentsOrgColumn();
  const { data: existingRows, error: existingError } = await supabase
    .from('assignments')
    .select('id,survey_id,metadata,assigned_by')
    .eq(assignmentOrgColumn, orgId)
    .eq('user_id', userId)
    .eq('assignment_type', 'survey')
    .eq('active', true)
    .in('survey_id', surveyIds);
  if (existingError) throw existingError;

  const existingMap = new Map((existingRows || []).filter((row) => row?.survey_id).map((row) => [String(row.survey_id), row]));
  const updates = [];
  const inserts = [];

  for (const surveyId of surveyIds) {
    const existing = existingMap.get(String(surveyId));
    if (existing) {
      updates.push({
        id: existing.id,
        metadata: {
          ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
          assigned_via: 'organization_membership_auto_assign',
          assignment_source: 'organization_membership',
        },
        assigned_by: existing.assigned_by ?? actorUserId ?? null,
        active: true,
      });
      continue;
    }

    inserts.push({
      survey_id: surveyId,
      course_id: null,
      organization_id: orgId,
      user_id: userId,
      assignment_type: 'survey',
      assigned_by: actorUserId ?? null,
      status: 'assigned',
      metadata: {
        assigned_via: 'organization_membership_auto_assign',
        assignment_source: 'organization_membership',
      },
      active: true,
      due_at: null,
      note: null,
    });
  }

  for (const update of updates) {
    const { id, ...changes } = update;
    const { error } = await supabase.from('assignments').update(changes).eq('id', id);
    if (error) throw error;
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('assignments').insert(inserts);
    if (error) throw error;
  }

  return { inserted: inserts.length, updated: updates.length };
};

// POST /api/admin/users
router.post('/', async (req, res, next) => {
  try {
    if (!supabase) {
      return next(createHttpError(503, 'supabase_not_configured', 'Supabase not configured'));
    }

    const orgId =
      normalizeText(req.body?.orgId) ||
      normalizeText(req.body?.organizationId) ||
      normalizeText(req.body?.org_id) ||
      normalizeText(req.body?.organization_id) ||
      '';
    const firstName = normalizeText(req.body?.firstName ?? req.body?.first_name ?? '');
    const lastName = normalizeText(req.body?.lastName ?? req.body?.last_name ?? '');
    const email = normalizeEmail(req.body?.email ?? '');
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const membershipRole = normalizeOrgRole(req.body?.membershipRole || req.body?.membership_role || 'member');
    const jobTitle = normalizeText(req.body?.jobTitle ?? req.body?.job_title ?? req.body?.role ?? '');
    const department = normalizeText(req.body?.department ?? '');
    const cohort = normalizeText(req.body?.cohort ?? '');
    const phoneNumber = normalizeText(req.body?.phoneNumber ?? req.body?.phone_number ?? '');

    if (!orgId) {
      return next(createHttpError(400, 'org_id_required', 'organizationId is required.'));
    }
    if (!firstName || !lastName || !email) {
      return next(createHttpError(400, 'missing_fields', 'firstName, lastName, and email are required.'));
    }
    if (password && password.length < INVITE_PASSWORD_MIN_CHARS) {
      return next(createHttpError(400, 'invalid_password', `Password must be at least ${INVITE_PASSWORD_MIN_CHARS} characters.`));
    }

    const actorUserId = req.user?.userId || req.user?.id || null;
    const result = await createOrProvisionOrganizationUser(
      {
        orgId,
        email,
        password,
        firstName,
        lastName,
        membershipRole,
        jobTitle,
        department,
        cohort,
        phoneNumber,
        actor: actorUserId ? { userId: actorUserId } : null,
        requestId: req.requestId ?? null,
      },
      {
        supabase,
        supabaseAuthClient,
        logger,
        sendEmail,
        getOrganizationMembershipsOrgColumnName: resolveOrganizationMembershipsOrgColumn,
        invalidateMembershipCache,
        assignContentToUser: async ({ orgId: targetOrgId, userId }) => {
          await assignPublishedOrganizationCoursesToUser({ orgId: targetOrgId, userId, actorUserId });
          await assignPublishedOrganizationSurveysToUser({ orgId: targetOrgId, userId, actorUserId });
        },
      },
    );

    // Normalize response: only one org, no conflicting org fields
    let orgData = null;
    let canonicalOrgId = null;
    if (result.membership && result.membership.organization_id) {
      canonicalOrgId = result.membership.organization_id;
    } else if (result.member && result.member.organization_id) {
      canonicalOrgId = result.member.organization_id;
    } else if (result.profile && result.profile.organization_id) {
      canonicalOrgId = result.profile.organization_id;
    }
    if (canonicalOrgId) {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', canonicalOrgId)
        .maybeSingle();
      if (!orgError && org) orgData = org;
    }
    res.status(result.created ? 201 : 200).json({
      success: true,
      data: {
        id: result.profile?.id ?? result.member?.id ?? result.membership?.user_id ?? null,
        email: result.profile?.email ?? result.member?.email ?? null,
        first_name: result.profile?.first_name ?? result.member?.first_name ?? null,
        last_name: result.profile?.last_name ?? result.member?.last_name ?? null,
        role: result.membership?.role ?? result.member?.role ?? null,
        organization_id: canonicalOrgId,
        organization: orgData,
      },
      created: result.created,
      existingAccount: !result.created,
      membershipCreated: result.membershipCreated,
      setupLink: result.setupLink ?? null,
      emailSent: result.emailSent ?? false,
      emailStatus: result.emailResult?.reason ?? null,
    });
  } catch (err) {
    return next(withHttpError(err, 500, 'admin_users_create_failed'));
  }
});

const buildProvisioningEmail = ({ firstName, setupLink, orgName }) => {
  const subject = orgName
    ? `Set up your ${orgName} learner portal password`
    : 'Set up your learner portal password';
  const text = `Hi ${firstName || 'there'},\n\nYour administrator added you to the learning portal. Click the link below to set your password and sign in:\n\n${setupLink}\n\nIf you did not request this, please ignore.`;
  return { subject, text };
};

// POST /api/admin/users/:userId/resend-email
router.post('/:userId/resend-email', async (req, res, next) => {
  try {
    if (!supabase) {
      return next(createHttpError(503, 'supabase_not_configured', 'Supabase not configured'));
    }

    const userId = normalizeText(req.params?.userId || '');
    if (!userId) {
      return next(createHttpError(400, 'user_id_required', 'userId is required.'));
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, organization_id')
      .eq('id', userId)
      .maybeSingle();
    if (profileError || !profile?.email) {
      return next(createHttpError(404, 'user_not_found', 'User profile not found.'));
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
    });
    const setupLink = linkData?.action_link || linkData?.properties?.action_link || null;
    if (linkError || !setupLink) {
      return next(createHttpError(500, 'setup_link_generate_failed', 'Unable to generate setup link.'));
    }

    const { subject, text } = buildProvisioningEmail({
      firstName: profile.first_name,
      setupLink,
      orgName: null,
    });

    const emailResult = await sendEmail({
      to: profile.email,
      subject,
      text,
      logContext: { recipientType: 'resend_setup', recipientId: userId },
    });

    res.json({
      success: true,
      setupLink,
      emailSent: Boolean(emailResult?.delivered),
      messageId: emailResult?.id ?? null,
      error: emailResult?.delivered ? null : emailResult?.reason ?? 'smtp_send_failed',
    });
  } catch (err) {
    return next(withHttpError(err, 500, 'admin_users_resend_failed'));
  }
});

const provisionImportedUser = async (user, actorUserId, defaultOrgId) => {
  const orgId =
    normalizeText(user.organizationId) ||
    normalizeText(user.organization_id) ||
    normalizeText(user.orgId) ||
    normalizeText(user.org_id) ||
    defaultOrgId ||
    '';
  const email = normalizeEmail(user.email);
  const firstName = normalizeText(user.firstName || user.first_name || user.given_name);
  const lastName = normalizeText(user.lastName || user.last_name || user.family_name);
  const fullName = normalizeText(user.name || user.full_name);
  const derivedFirstName = firstName || (fullName ? fullName.split(/\s+/).slice(0, -1).join(' ') || fullName.split(/\s+/)[0] : '');
  const derivedLastName = lastName || (fullName ? fullName.split(/\s+/).slice(1).join(' ') : '');
  const membershipRole = normalizeOrgRole(user.membershipRole || user.membership_role || user.orgRole || user.org_role || 'member');
  const passwordInput = typeof user.password === 'string' ? user.password : '';

  if (!orgId) {
    throw createHttpError(400, 'org_id_required', 'organizationId is required for each imported user');
  }
  if (!email || !derivedFirstName || !derivedLastName) {
    throw createHttpError(400, 'missing_fields', 'Imported users require first name, last name, and email');
  }

  const result = await createOrProvisionOrganizationUser(
    {
      orgId,
      email,
      password: passwordInput,
      firstName: derivedFirstName,
      lastName: derivedLastName,
      membershipRole,
      jobTitle: normalizeText(user.jobTitle || user.job_title || user.role),
      department: normalizeText(user.department),
      cohort: normalizeText(user.cohort),
      phoneNumber: normalizeText(user.phoneNumber || user.phone_number),
      actor: actorUserId ? { userId: actorUserId } : null,
      requestId: null,
    },
    {
      supabase,
      logger,
      sendEmail,
      getOrganizationMembershipsOrgColumnName,
      invalidateMembershipCache,
      assignContentToUser: async ({ orgId: targetOrgId, userId }) => {
        await assignPublishedOrganizationCoursesToUser({ orgId: targetOrgId, userId, actorUserId });
        await assignPublishedOrganizationSurveysToUser({ orgId: targetOrgId, userId, actorUserId });
      },
    },
  );

  return {
    email,
    userId: result.userId,
    orgId,
    created: result.created,
    membershipCreated: result.membershipCreated,
    setupLink: result.setupLink,
    emailSent: result.emailSent,
  };
};

// POST /api/admin/users/import
router.post('/import', async (req, res, next) => {
  try {
    const defaultOrgId = normalizeText(req.body?.organizationId || req.body?.organization_id || req.body?.orgId || req.body?.org_id);
    const actorUserId = req.user?.id || req.user?.userId || null;
    const requestId = req.requestId ?? null;

    const users = Array.isArray(req.body?.users) ? req.body.users : null;
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : users;
    const csvText = typeof req.body?.csvText === 'string' ? req.body.csvText : null;

    const parsedRows = rows ?? (csvText ? parseCsvText(csvText) : null);
    if (!parsedRows || !Array.isArray(parsedRows) || parsedRows.length === 0) {
      return res.status(400).json({ error: 'invalid_rows', message: 'Provide rows or csvText with at least one row.' });
    }

    const { results } = await processUserImportRows({
      rows: parsedRows,
      defaultOrgId,
      actorUserId,
      requestId,
    });

    res.json({ results });
  } catch (err) {
    return next(withHttpError(err, 500, 'admin_users_import_failed'));
  }
});

// GET /api/admin/users/export
router.get('/export', async (req, res, next) => {
  try {
    if (!supabase) return next(createHttpError(503, 'supabase_not_configured', 'Supabase not configured'));
  // Export user profiles (this project keeps user data in `user_profiles`)
  const { data, error } = await supabase.from('user_profiles').select('*');
    if (error) return next(createHttpError(500, 'admin_users_export_failed', error.message));
    res.json({ users: data });
  } catch (err) {
    return next(withHttpError(err, 500, 'admin_users_export_failed'));
  }
});

export default router;

// Named exports for testing and reuse
export {
  createInviteFallback,
  provisionImportedUser,
  processUserImportRows,
  parseCsvText,
  normalizeImportRow,
};
