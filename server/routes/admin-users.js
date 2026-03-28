import express from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import supabase from '../lib/supabaseClient.js';
import { buildOrgInviteInsertAttemptPayloads } from '../utils/orgInvites.js';
import { authenticate, requireAdmin, invalidateMembershipCache } from '../middleware/auth.js';
import { createHttpError, withHttpError } from '../middleware/apiErrorHandler.js';

const router = express.Router();

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

const isSupabaseAuthCreateUserDatabaseError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return code === 'unexpected_failure' || message.includes('database error creating new user');
};

const createInviteFallback = async ({ orgId, email, role, actorUserId = null, firstName = '', lastName = '' }) => {
  const orgColumn = await resolveOrgInvitesOrganizationColumn();
  const tokenColumn = await resolveOrgInvitesTokenColumn();
  const normalizedEmail = normalizeEmail(email);
  const token = randomUUID().replace(/-/g, '');

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
    if (error && error.message !== 'User not found') {
      throw error;
    }
    return data?.user ?? null;
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
  const temporaryPassword = passwordInput && passwordInput.length >= INVITE_PASSWORD_MIN_CHARS
    ? passwordInput
    : randomUUID().replace(/-/g, '').slice(0, 16);

  if (!orgId) {
    throw createHttpError(400, 'org_id_required', 'organizationId is required for each imported user');
  }
  if (!email || !derivedFirstName || !derivedLastName) {
    throw createHttpError(400, 'missing_fields', 'Imported users require first name, last name, and email');
  }

  let authUser = await findAuthUserByEmail(email);
  let created = false;
  let inviteOnly = false;
  let inviteId = null;
  let duplicateInvite = false;
  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        first_name: derivedFirstName,
        last_name: derivedLastName,
        full_name: `${derivedFirstName} ${derivedLastName}`.trim() || null,
        organization_id: orgId,
        onboarding_org_id: orgId,
      },
    });
    if (error) {
      if (isSupabaseAuthCreateUserDatabaseError(error)) {
        const invite = await createInviteFallback({
          orgId,
          email,
          role: membershipRole,
          actorUserId,
          firstName: derivedFirstName,
          lastName: derivedLastName,
        });
        inviteOnly = true;
        inviteId = invite.id;
        duplicateInvite = Boolean(invite.duplicate);
      } else {
        throw error;
      }
    }
    authUser = data?.user ?? null;
    created = Boolean(authUser);
  }

  if (inviteOnly) {
    return {
      email,
      userId: null,
      orgId,
      created: false,
      temporaryPassword: null,
      inviteOnly: true,
      inviteId,
      duplicateInvite,
    };
  }

  if (!authUser?.id) {
    throw createHttpError(500, 'auth_user_resolution_failed', 'Unable to resolve imported auth user');
  }

  const passwordHash = temporaryPassword ? await bcrypt.hash(temporaryPassword, 12) : null;
  const isAdmin = writableMembershipRoles.has(membershipRole);

  const { error: usersError } = await supabase.from('users').upsert({
    id: authUser.id,
    email,
    first_name: derivedFirstName,
    last_name: derivedLastName,
    role: isAdmin ? 'admin' : 'user',
    is_active: true,
    organization_id: orgId,
    ...(passwordHash ? { password_hash: passwordHash } : {}),
  }, { onConflict: 'id' });
  if (usersError) throw usersError;

  const metadata = {
    job_title: normalizeText(user.jobTitle || user.job_title || user.role),
    department: normalizeText(user.department),
    cohort: normalizeText(user.cohort),
    phone_number: normalizeText(user.phoneNumber || user.phone_number),
  };

  const { error: profileError } = await supabase.from('user_profiles').upsert({
    id: authUser.id,
    email,
    first_name: derivedFirstName,
    last_name: derivedLastName,
    organization_id: orgId,
    role: isAdmin ? 'admin' : 'learner',
    is_active: true,
    is_admin: isAdmin,
    metadata,
  }, { onConflict: 'id' });
  if (profileError) throw profileError;

  await upsertOrganizationMembership({
    orgId,
    userId: authUser.id,
    role: membershipRole,
    actorUserId,
  });

  invalidateMembershipCache(authUser.id);

  await assignPublishedOrganizationCoursesToUser({ orgId, userId: authUser.id, actorUserId });
  await assignPublishedOrganizationSurveysToUser({ orgId, userId: authUser.id, actorUserId });

  return {
    email,
    userId: authUser.id,
    orgId,
    created,
    temporaryPassword: created && !passwordInput ? temporaryPassword : null,
  };
};

// POST /api/admin/users/import
router.post('/import', async (req, res, next) => {
  try {
    if (!supabase) return next(createHttpError(503, 'supabase_not_configured', 'Supabase not configured'));
    const users = Array.isArray(req.body?.users) ? req.body.users : null;
    const defaultOrgId = normalizeText(req.body?.organizationId || req.body?.organization_id || req.body?.orgId || req.body?.org_id);
    const actorUserId = req.user?.id || req.user?.userId || null;

    if (!users) {
      return res.status(400).json({ error: 'invalid_users', message: 'Provide a users array.' });
    }

    const results = [];
    for (const user of users) {
      try {
        const result = await provisionImportedUser(user || {}, actorUserId, defaultOrgId);
        results.push({
          email: result.email,
          userId: result.userId,
          organizationId: result.orgId,
          status: result.inviteOnly ? 'invited' : 'ok',
          created: result.created,
          temporaryPassword: result.temporaryPassword,
          inviteOnly: Boolean(result.inviteOnly),
          inviteId: result.inviteId ?? null,
          duplicateInvite: Boolean(result.duplicateInvite),
        });
      } catch (error) {
        results.push({
          email: normalizeEmail(user?.email),
          organizationId: normalizeText(user?.organizationId || user?.organization_id || defaultOrgId),
          status: 'error',
          error: error?.message || String(error),
          code: error?.code || null,
        });
      }
    }

    res.json({ results });
  } catch (err) {
    return next(withHttpError(err, 500, 'admin_users_import_failed'));
  }
});

// GET /api/admin/users/export
router.get('/export', async (req, res, next) => {
  try {
    if (!supabase) return next(createHttpError(503, 'supabase_not_configured', 'Supabase not configured'));
    const { data, error } = await supabase.from('users').select('*');
    if (error) return next(createHttpError(500, 'admin_users_export_failed', error.message));
    res.json({ users: data });
  } catch (err) {
    return next(withHttpError(err, 500, 'admin_users_export_failed'));
  }
});

export default router;
