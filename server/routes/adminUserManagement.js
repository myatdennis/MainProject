import express from 'express';
import { sendError, sendOk } from '../lib/apiEnvelope.js';

export const createAdminUserManagementRouter = (deps) => {
  const router = express.Router();
  const {
    authenticate,
    requireAdmin,
    isDemoOrTestMode,
    e2eStore,
    normalizeOrgIdValue,
    pickOrgId,
    ensureSupabase,
    requireUserContext,
    requireOrgAccess,
    runSupabaseTransientRetry,
    fetchOrgMembersWithProfiles,
    logUsersStageError,
    createOrProvisionOrganizationUser,
    buildActorFromRequest,
    logger,
    supabase,
    sendEmail,
    getOrganizationMembershipsOrgColumnName,
    invalidateMembershipCache,
    assignPublishedOrganizationContentToUser,
    archiveOrganizationUserAccount,
    permanentlyDeleteUserAccount,
  } = deps;

  const shouldUseAdminUsersFallback = (req) => {
    if (isDemoOrTestMode) return true;
    const roleHeader = String(req?.headers?.['x-user-role'] || '').toLowerCase();
    const hostHeader = String(req?.headers?.host || '').toLowerCase();
    const looksLocal = hostHeader.includes('localhost') || hostHeader.includes('127.0.0.1');
    if (roleHeader === 'admin' && looksLocal) return true;

    const demoAdminId = '00000000-0000-0000-0000-000000000001';
    const requestUserId = req?.user?.userId ?? req?.user?.id ?? req?.userId ?? null;
    return Boolean(requestUserId && requestUserId === demoAdminId && looksLocal);
  };

  router.use(authenticate, requireAdmin);

  const DEMO_FALLBACK_USER_SEED = [
    {
      userId: 'demo-user-pacific-coast-1',
      email: 'faculty@pacificcoast.edu',
      organizationId: 'pacific-coast-university',
      firstName: 'Pacific',
      lastName: 'Faculty',
      role: 'member',
    },
    {
      userId: 'demo-user-mountain-view-1',
      email: 'teacher@mountainviewhs.edu',
      organizationId: 'mountain-view-high-school',
      firstName: 'Mountain',
      lastName: 'Teacher',
      role: 'member',
    },
  ];

  const buildDemoFallbackUsers = () => {
    const now = new Date().toISOString();
    return DEMO_FALLBACK_USER_SEED.map((entry) => ({
      id: entry.userId,
      user_id: entry.userId,
      organization_id: entry.organizationId,
      org_id: entry.organizationId,
      email: entry.email,
      role: entry.role,
      status: 'active',
      created_at: now,
      updated_at: now,
      profile: {
        id: entry.userId,
        email: entry.email,
        first_name: entry.firstName,
        last_name: entry.lastName,
        role: entry.role,
        organization_id: entry.organizationId,
        status: 'active',
        created_at: now,
        updated_at: now,
      },
      user: {
        id: entry.userId,
        email: entry.email,
        first_name: entry.firstName,
        last_name: entry.lastName,
        role: entry.role,
        status: 'active',
      },
    }));
  };

  router.get('/', async (req, res) => {
    const context = requireUserContext(req, res);
    if (!context) return;
    const orgId = pickOrgId(
      req.query.orgId,
      req.query.organizationId,
      context.requestedOrgId,
      context.activeOrganizationId,
    );

    if (shouldUseAdminUsersFallback(req)) {
      const normalizedOrgId = normalizeOrgIdValue(orgId);
      const allMembers = Array.isArray(e2eStore.users) && e2eStore.users.length > 0 ? e2eStore.users : buildDemoFallbackUsers();

      if (!normalizedOrgId && req.user?.isPlatformAdmin) {
        return sendOk(res, allMembers);
      }

      const members = allMembers.filter((member) => {
        const memberOrg = normalizeOrgIdValue(member?.organization_id ?? member?.org_id ?? null);
        return normalizedOrgId ? memberOrg === normalizedOrgId : true;
      });
      return sendOk(res, members, { meta: normalizedOrgId ? { orgId: normalizedOrgId } : undefined });
    }

    if (!ensureSupabase(res)) return;
    const isPlatformAdmin = Boolean(context.isPlatformAdmin || context.userRole === 'admin');
    if (!orgId) {
      return sendError(res, 400, 'org_id_required', 'orgId query parameter or X-Org-Id header is required.');
    }

    if (!isPlatformAdmin) {
      const access = await requireOrgAccess(req, res, orgId, { write: false, requireOrgAdmin: true });
      if (!access) return;
    }
    logger.info('admin_users_request_context', {
      requestId: req.requestId ?? null,
      route: '/api/admin/users',
      userId: context.userId ?? null,
      requestedOrgId: orgId,
      activeOrganizationId: context.activeOrganizationId ?? null,
      isPlatformAdmin,
    });

    try {
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
      const limit = Math.min(parseInt(req.query.limit, 10) || 500, 1000);
      const members = await runSupabaseTransientRetry('admin.users.list', async () =>
        fetchOrgMembersWithProfiles(orgId),
      );
      logger.info('admin_users_response_ready', {
        requestId: req.requestId ?? null,
        route: '/api/admin/users',
        requestedOrgId: orgId,
        rowCount: Array.isArray(members) ? members.length : 0,
        offset,
        limit,
      });
      return sendOk(res, members, { meta: { offset, limit } });
    } catch (error) {
      const normalized = logUsersStageError('memberships_fetch', error, {
        requestId: req.requestId ?? null,
        orgId,
        isPlatformAdmin,
      });
      return sendError(
        res,
        500,
        normalized.code ?? 'internal_error',
        normalized.message ?? 'Unexpected error while loading organization users',
        normalized.details ?? null,
        { requestId: req.requestId ?? null },
      );
    }
  });

  router.post('/', async (req, res) => {
    const orgId = pickOrgId(
      req.body?.orgId,
      req.body?.organizationId,
      req.body?.org_id,
      req.body?.organization_id,
    );
    const firstName =
      typeof req.body?.firstName === 'string'
        ? req.body.firstName.trim()
        : typeof req.body?.first_name === 'string'
          ? req.body.first_name.trim()
          : '';
    const lastName =
      typeof req.body?.lastName === 'string'
        ? req.body.lastName.trim()
        : typeof req.body?.last_name === 'string'
          ? req.body.last_name.trim()
          : '';
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const membershipRole = deps.normalizeOrgRole(req.body?.membershipRole || req.body?.membership_role || 'member');
    const jobTitle =
      typeof req.body?.jobTitle === 'string'
        ? req.body.jobTitle.trim()
        : typeof req.body?.job_title === 'string'
          ? req.body.job_title.trim()
          : '';
    const department = typeof req.body?.department === 'string' ? req.body.department.trim() : '';
    const cohort = typeof req.body?.cohort === 'string' ? req.body.cohort.trim() : '';
    const phoneNumber =
      typeof req.body?.phoneNumber === 'string'
        ? req.body.phoneNumber.trim()
        : typeof req.body?.phone_number === 'string'
          ? req.body.phone_number.trim()
          : '';

    if (!orgId) {
      return sendError(res, 400, 'org_id_required', 'organizationId is required.');
    }
    if (!firstName || !lastName || !rawEmail) {
      return sendError(res, 400, 'missing_fields', 'firstName, lastName, and email are required.');
    }
    if (password && password.length < deps.INVITE_PASSWORD_MIN_CHARS) {
      return sendError(
        res,
        400,
        'invalid_password',
        `Password must be at least ${deps.INVITE_PASSWORD_MIN_CHARS} characters.`,
      );
    }

    if (shouldUseAdminUsersFallback(req)) {
      const normalizedOrgId = normalizeOrgIdValue(orgId);
      const normalizedEmail = rawEmail.trim().toLowerCase();
      const existing = (Array.isArray(e2eStore.users) ? e2eStore.users : []).find((member) => {
        const memberOrg = normalizeOrgIdValue(member?.organization_id ?? member?.org_id ?? null);
        const memberEmail = String(member?.profile?.email ?? member?.email ?? '').trim().toLowerCase();
        return memberOrg === normalizedOrgId && memberEmail === normalizedEmail;
      });
      if (existing) {
        return sendOk(res, existing, {
          status: 200,
          meta: { created: false, existingAccount: true, membershipCreated: false, setupLink: existing.setupLink ?? null, emailSent: false, emailStatus: 'smtp_not_configured' },
        });
      }

      const now = new Date().toISOString();
      const userId = deps.randomUUID();
      const member = {
        id: userId,
        user_id: userId,
        organization_id: orgId,
        org_id: orgId,
        role: membershipRole,
        status: 'active',
        created_at: now,
        updated_at: now,
        email: rawEmail,
        profile: {
          id: userId,
          email: rawEmail,
          first_name: firstName,
          last_name: lastName,
          role: membershipRole,
          organization_id: orgId,
          status: 'active',
          created_at: now,
          updated_at: now,
        },
        user: {
          id: userId,
          email: rawEmail,
          first_name: firstName,
          last_name: lastName,
          role: membershipRole,
          status: 'active',
        },
        setupLink: `http://localhost:5174/setup?token=${deps.randomUUID()}`,
      };
      e2eStore.users = Array.isArray(e2eStore.users) ? e2eStore.users : [];
      e2eStore.users.push(member);
      return sendOk(res, member, {
        status: 201,
        meta: { created: true, existingAccount: false, membershipCreated: true, setupLink: member.setupLink, emailSent: false, emailStatus: 'smtp_not_configured' },
      });
    }

    const context = requireUserContext(req, res);
    if (!context) return;
    const access = await requireOrgAccess(req, res, orgId, { write: true, requireOrgAdmin: true });
    if (!access) return;
    if (!ensureSupabase(res)) return;

    try {
      const actor = buildActorFromRequest(req);
      const account = await createOrProvisionOrganizationUser(
        {
          orgId,
          email: rawEmail,
          password,
          firstName,
          lastName,
          membershipRole,
          jobTitle,
          department,
          cohort,
          phoneNumber,
          actor,
          requestId: req.requestId ?? null,
        },
        {
          supabase,
          logger,
          sendEmail,
          getOrganizationMembershipsOrgColumnName,
          invalidateMembershipCache,
          assignContentToUser: assignPublishedOrganizationContentToUser,
          fetchOrgMembersWithProfiles,
        },
      );

      return sendOk(res, account.member, {
        status: account.created ? 201 : 200,
        meta: {
          created: account.created,
          existingAccount: !account.created,
          membershipCreated: account.membershipCreated,
          setupLink: account.setupLink ?? null,
          emailSent: account.emailSent ?? false,
          emailStatus: account.emailResult?.reason ?? null,
        },
      });
    } catch (error) {
      const stage = error?.stage ?? 'user_create';
      const normalized = logUsersStageError(stage, error, {
        requestId: req.requestId ?? null,
        orgId,
        email: rawEmail,
      });
      const validationCodes = new Set([
        'invalid_password',
        'missing_fields',
        'org_id_required',
        'email_required',
        'invalid_email',
        'org_access_denied',
      ]);
      const status = validationCodes.has(normalized.code)
        ? normalized.code === 'org_access_denied'
          ? 403
          : 400
        : 500;
      return sendError(
        res,
        status,
        normalized.code ?? 'internal_error',
        normalized.message ?? 'Unexpected error while creating organization user',
        { stage, details: normalized.details ?? null },
        { requestId: req.requestId ?? null },
      );
    }
  });

  router.delete('/:userId', async (req, res) => {
    if (!ensureSupabase(res)) return;

    const { userId } = req.params;
    const orgId = pickOrgId(
      req.query?.orgId,
      req.query?.organizationId,
      req.body?.orgId,
      req.body?.organizationId,
    );
    const mode = String(req.query?.mode || req.body?.mode || 'archive').toLowerCase();
    const requestId = req.requestId ?? null;

    const context = requireUserContext(req, res);
    if (!context) return;
    const isPlatformAdmin = Boolean(context.isPlatformAdmin || context.userRole === 'admin');

    if (mode === 'archive') {
      if (!orgId) {
        return sendError(res, 400, 'org_id_required', 'organizationId is required to archive a user.');
      }
      const access = await requireOrgAccess(req, res, orgId, { write: true, requireOrgAdmin: true });
      if (!access) return;

      try {
        const result = await archiveOrganizationUserAccount({ userId, orgId, requestId });
        return sendOk(res, result);
      } catch (error) {
        const normalized = logUsersStageError('user_archive', error, { requestId, orgId, userId });
        const statusCode =
          normalized.code === 'membership_not_found'
            ? 404
            : normalized.code === 'owner_required' || normalized.code === 'invalid_archive_request'
              ? 400
              : 500;
        return sendError(
          res,
          statusCode,
          normalized.code ?? 'internal_error',
          normalized.message ?? 'Unexpected error while archiving organization user',
          normalized.details ?? null,
          { requestId },
        );
      }
    }

    if (mode !== 'delete') {
      return sendError(res, 400, 'invalid_mode', 'mode must be archive or delete.');
    }

    if (!isPlatformAdmin) {
      return sendError(res, 403, 'platform_admin_required', 'Hard-deleting a user requires platform admin access.');
    }

    try {
      await permanentlyDeleteUserAccount({ userId, requestId });
      return res.status(204).end();
    } catch (error) {
      const normalized = logUsersStageError('user_delete', error, { requestId, userId });
      return sendError(
        res,
        500,
        normalized.code ?? 'internal_error',
        normalized.message ?? 'Unexpected error while deleting user',
        normalized.details ?? null,
        { requestId },
      );
    }
  });

  return router;
};
