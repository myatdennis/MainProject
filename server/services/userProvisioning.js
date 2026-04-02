import { isSupabaseAuthCreateUserAlreadyExists, isSupabaseAuthCreateUserDatabaseError } from '../utils/authHelpers.js';
import { logger as defaultLogger } from '../lib/logger.js';
import { resolveMembershipStatusUpdate } from '../lib/membershipUtils.js';

const ADMIN_ROLES = new Set(['admin', 'owner', 'org_admin', 'organization_admin', 'super_admin']);
const ALLOWED_ROLES = new Set(['owner', 'admin', 'member', 'learner', 'manager', 'editor', 'viewer', 'instructor', 'org_admin', 'organization_admin', 'super_admin']);

const MIN_PASSWORD_LENGTH = Number(process.env.CLIENT_INVITE_PASSWORD_MIN || 8);

export class ProvisioningError extends Error {
  constructor(stage, code, message, status = 400, details = null) {
    super(message);
    this.name = 'ProvisioningError';
    this.stage = stage;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeRole = (value, fallback = 'member') => {
  const normalized = normalizeText(value).toLowerCase();
  return ALLOWED_ROLES.has(normalized) ? normalized : fallback;
};

const isValidEmail = (value) => /\S+@\S+\.[A-Za-z]+/.test(value || '');

const isAuthUserNotFoundError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('user not found') || message.includes('not found');
};

const cleanupOrphanedProfileByEmail = async ({
  supabase,
  email,
  logger = defaultLogger,
  requestId = null,
  getOrganizationMembershipsOrgColumnName,
}) => {
  if (!supabase || !email) return false;

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (profileError || !profile?.id) return false;

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(profile.id);
    if (authData?.user?.id) return false;
    if (authError && !isAuthUserNotFoundError(authError)) return false;
  } catch (error) {
    if (!isAuthUserNotFoundError(error)) return false;
  }

  try {
    const membershipOrgColumn = getOrganizationMembershipsOrgColumnName
      ? await getOrganizationMembershipsOrgColumnName()
      : 'organization_id';
    await supabase.from('organization_memberships').delete().eq('user_id', profile.id);
    await supabase.from('admin_users').delete().eq('user_id', profile.id);
    await supabase.from('user_profiles').delete().eq('id', profile.id);
    logger.warn('provisioning_orphaned_profile_removed', {
      requestId,
      email,
      userId: profile.id,
      membershipOrgColumn,
    });
    return true;
  } catch (error) {
    logger.warn('provisioning_orphaned_profile_cleanup_failed', {
      requestId,
      email,
      userId: profile.id,
      message: error?.message || String(error),
    });
    return false;
  }
};

export const resolveSupabaseAuthUserByEmail = async ({ supabase, email, requestId = null, logger = defaultLogger }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!supabase || !normalizedEmail) return null;

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
    if (data?.user) return data.user;
  }

  const perPage = Number(process.env.SUPABASE_AUTH_LIST_USERS_PAGE_SIZE || 200);
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

  logger.info('auth_user_lookup_not_found', { requestId, email: normalizedEmail });
  return null;
};

const cleanupProvisionedUserAccount = async ({
  supabase,
  userId,
  orgId,
  logger = defaultLogger,
  requestId = null,
  getOrganizationMembershipsOrgColumnName,
}) => {
  if (!supabase || !userId) return;
  try {
    const membershipOrgColumn = getOrganizationMembershipsOrgColumnName
      ? await getOrganizationMembershipsOrgColumnName()
      : 'organization_id';
    if (orgId) {
      await supabase
        .from('organization_memberships')
        .delete()
        .eq(membershipOrgColumn, orgId)
        .eq('user_id', userId);

      try {
        await supabase
          .from('admin_users')
          .delete()
          .eq('organization_id', orgId)
          .eq('user_id', userId);
      } catch (adminDeleteError) {
        if (isMissingColumnError(adminDeleteError)) {
          await supabase
            .from('admin_users')
            .delete()
            .eq('user_id', userId);
        } else {
          throw adminDeleteError;
        }
      }
    }
    await supabase.from('user_profiles').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
  } catch (error) {
    logger.warn('provisioning_cleanup_failed', {
      requestId,
      userId,
      orgId,
      message: error?.message || String(error),
    });
  }
};

const ensureProfile = async ({ supabase, userId, profilePayload, requestId, logger }) => {
  const { error } = await supabase.from('user_profiles').upsert(profilePayload, { onConflict: 'id' });
  if (error) {
    throw new ProvisioningError('profile_upsert', 'profile_upsert_failed', error.message || 'Profile upsert failed', 500, error);
  }

  const { data: profileRow, error: profileCheckError } = await supabase
    .from('user_profiles')
    .select('id, email, first_name, last_name, organization_id, role')
    .eq('id', userId)
    .maybeSingle();

  if (profileCheckError || !profileRow?.id) {
    throw new ProvisioningError('profile_upsert', 'profile_not_found', 'Profile not found after upsert', 500, profileCheckError);
  }

  if (profileRow.email && profileRow.email.toLowerCase() !== profilePayload.email) {
    logger.warn('profile_email_mismatch', {
      requestId,
      userId,
      expected: profilePayload.email,
      actual: profileRow.email,
    });
  }

  return profileRow;
};

const isUuid = (value) => {
  if (!value || typeof value !== 'string') return false;
  const normalized = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized);
};

const resolveUserIdentifierToUuid = async (supabase, identifier) => {
  if (!supabase || identifier === null || identifier === undefined) return null;
  const raw = String(identifier).trim();
  if (!raw) return null;
  if (isUuid(raw)) return raw;

  const lookupEmail = /^[^@\s]+@[^@\s]+\.[A-Za-z]+$/.test(raw);
  if (lookupEmail) {
    const { data, error } = await supabase.from('user_profiles').select('id').ilike('email', raw).maybeSingle();
    if (!error && data && data.id && isUuid(data.id)) return data.id;
  }

  const idFields = ['id', 'external_id', 'username'];
  for (const field of idFields) {
    try {
      const { data, error } = await supabase.from('user_profiles').select('id').eq(field, raw).maybeSingle();
      if (!error && data && data.id && isUuid(data.id)) return data.id;
    } catch (_err) {
      continue;
    }
  }

  return null;
};

const ensureMembership = async ({
  supabase,
  orgId,
  userId,
  role,
  actor,
  requestId,
  getOrganizationMembershipsOrgColumnName,
  getOrganizationMembershipsStatusColumnName,
  getOrganizationMembershipsHasIsActiveColumn,
}) => {
  const membershipOrgColumn = getOrganizationMembershipsOrgColumnName
    ? await getOrganizationMembershipsOrgColumnName()
    : 'organization_id';
  const statusColumn = getOrganizationMembershipsStatusColumnName
    ? await getOrganizationMembershipsStatusColumnName()
    : 'status';
  const hasIsActiveColumn = getOrganizationMembershipsHasIsActiveColumn
    ? await getOrganizationMembershipsHasIsActiveColumn()
    : false;

  const canonicalState = resolveMembershipStatusUpdate({ status: 'active', is_active: true });

  let invitedBy = actor?.userId ?? null;
  if (invitedBy && !isUuid(invitedBy)) {
    const resolved = await resolveUserIdentifierToUuid(supabase, invitedBy).catch(() => null);
    invitedBy = resolved && isUuid(resolved) ? resolved : null;
  }

  defaultLogger.info('provisioning_ensure_membership_payload', {
    requestId,
    orgId,
    userId,
    actorUserId: actor?.userId ?? null,
    resolvedInvitedBy: invitedBy,
    role,
    membershipOrgColumn,
    statusColumn,
    hasIsActiveColumn,
  });

  const payload = {
    user_id: userId,
    role,
    invited_by: invitedBy,
  };
  if (statusColumn === 'status') {
    payload.status = canonicalState.status;
  }
  if (hasIsActiveColumn) {
    payload.is_active = canonicalState.is_active;
  }
  payload[membershipOrgColumn] = orgId;

  const { data, error } = await supabase
    .from('organization_memberships')
    .upsert(payload, { onConflict: `${membershipOrgColumn},user_id` })
    .select('*')
    .single();

  if (error) {
    throw new ProvisioningError('membership_upsert', 'membership_upsert_failed', error.message || 'Membership upsert failed', 500, error);
  }

  const { data: membershipCheck, error: membershipCheckError } = await supabase
    .from('organization_memberships')
    .select('id, role, status')
    .eq('user_id', userId)
    .eq(membershipOrgColumn, orgId)
    .maybeSingle();

  if (membershipCheckError || !membershipCheck?.id) {
    throw new ProvisioningError('membership_upsert', 'membership_not_found', 'Membership not found after upsert', 500, membershipCheckError);
  }

  if (membershipCheck.status && membershipCheck.status.toLowerCase() !== 'active') {
    throw new ProvisioningError('membership_upsert', 'membership_not_active', 'Membership is not active', 500);
  }

  return data;
};

const isMissingColumnError = (error) => {
  const message = String(error?.message || error?.details || '');
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /column .* does not exist/i.test(message) ||
    /Could not find .* column/i.test(message) ||
    /Could not find the 'meta' column of 'admin_users' in the schema cache/i.test(message)
  );
};

const ensureAdminRoleMapping = async ({ supabase, orgId, userId, role, email = null }) => {
  if (!ADMIN_ROLES.has(role)) return null;

  if (!supabase || !userId) {
    throw new ProvisioningError('admin_role_upsert', 'admin_role_upsert_failed', 'Supabase not configured or missing userId', 500);
  }

  const tryLegacyAdminUserUpsert = async () => {
    const payload = {
      user_id: userId,
      is_active: true,
      ...(email ? { email } : {}),
    };
    const { error } = await supabase.from('admin_users').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      throw new ProvisioningError('admin_role_upsert', 'admin_role_upsert_failed', error.message || 'Admin role upsert failed', 500, error);
    }
    return true;
  };

  const modernPayload = {
    user_id: userId,
    organization_id: orgId,
    meta: { role },
    is_active: true,
    ...(email ? { email } : {}),
  };

  try {
    const { error } = await supabase
      .from('admin_users')
      .upsert(modernPayload, { onConflict: 'user_id,organization_id' });

    if (error) {
      if (isMissingColumnError(error)) {
        return await tryLegacyAdminUserUpsert();
      }
      throw error;
    }

    return true;
  } catch (error) {
    if (isMissingColumnError(error)) {
      return await tryLegacyAdminUserUpsert();
    }
    throw new ProvisioningError('admin_role_upsert', 'admin_role_upsert_failed', error.message || 'Admin role upsert failed', 500, error);
  }
};

const generatePasswordSetupLink = async ({ supabase, email }) => {
  const { data, error } = await supabase.auth.admin.generateLink({ type: 'recovery', email });
  const actionLink = data?.action_link || data?.properties?.action_link || null;
  if (error || !actionLink) {
    defaultLogger.warn('provisioning_setup_link_failed', {
      email,
      message: error?.message || String(error),
      code: error?.code ?? null,
      status: error?.status ?? error?.statusCode ?? null,
      hasData: Boolean(data),
      dataKeys: data ? Object.keys(data) : null,
    });
    throw new ProvisioningError('setup_link_generate', 'setup_link_not_generated', 'Unable to generate password setup link', 500, error);
  }
  return actionLink;
};

const sendProvisioningEmail = async ({ sendEmail, email, firstName, setupLink, orgName, actorId, orgId }) => {
  if (!sendEmail) {
    return { delivered: false, reason: 'smtp_not_configured' };
  }
  const subject = orgName
    ? `Set up your ${orgName} learner portal password`
    : 'Set up your learner portal password';
  const text = `Hi ${firstName},\n\nYour administrator added you to the learning portal. Click the link below to set your password and sign in:\n\n${setupLink}\n\nIf you did not request this, please ignore.`;
  const result = await sendEmail({
    to: email,
    subject,
    text,
    logContext: { recipientType: 'new_user', organizationId: orgId, sentBy: actorId ?? null },
  });
  return result;
};

const verifyProvisionedUserState = async ({ supabase, orgId, userId, email, setupLink, getOrganizationMembershipsOrgColumnName }) => {
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError || !authData?.user?.id) {
    throw new ProvisioningError('final_verify', 'auth_user_missing', 'Auth user missing after provisioning', 500, authError);
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, email, organization_id, role')
    .eq('id', userId)
    .maybeSingle();
  if (profileError || !profile?.id) {
    throw new ProvisioningError('final_verify', 'profile_missing', 'Profile missing after provisioning', 500, profileError);
  }

  const membershipOrgColumn = getOrganizationMembershipsOrgColumnName
    ? await getOrganizationMembershipsOrgColumnName()
    : 'organization_id';
  const { data: membership, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('id, role, status')
    .eq('user_id', userId)
    .eq(membershipOrgColumn, orgId)
    .maybeSingle();

  if (membershipError || !membership?.id) {
    throw new ProvisioningError('final_verify', 'membership_missing', 'Membership missing after provisioning', 500, membershipError);
  }

  if (!setupLink) {
    throw new ProvisioningError('final_verify', 'setup_link_missing', 'Setup link missing after provisioning', 500);
  }

  if (email && profile.email && profile.email.toLowerCase() !== email.toLowerCase()) {
    throw new ProvisioningError('final_verify', 'email_mismatch', 'Profile email does not match auth email', 500);
  }

  return { ok: true, authUser: authData.user, profile, membership };
};

export const createOrProvisionOrganizationUser = async (input, deps = {}) => {
  const {
    supabase,
    supabaseAuthClient,
    logger = defaultLogger,
    sendEmail,
    getOrganizationMembershipsOrgColumnName,
    getOrganizationMembershipsStatusColumnName,
    getOrganizationMembershipsHasIsActiveColumn,
    invalidateMembershipCache,
    assignContentToUser,
    fetchOrgMembersWithProfiles,
  } = deps;

  const {
    orgId,
    email,
    password,
    firstName,
    lastName,
    membershipRole = 'member',
    jobTitle = '',
    department = '',
    cohort = '',
    phoneNumber = '',
    actor = null,
    requestId = null,
    orgName = null,
  } = input || {};

  let stage = 'validate_input';

  if (!supabase) {
    throw new ProvisioningError(stage, 'supabase_not_configured', 'Supabase not configured', 503);
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedFirstName = normalizeText(firstName);
  const normalizedLastName = normalizeText(lastName);
  const normalizedRole = normalizeRole(membershipRole, 'member');

  if (!orgId) {
    throw new ProvisioningError(stage, 'org_id_required', 'organizationId is required', 400);
  }
  if (!normalizedEmail || !normalizedFirstName || !normalizedLastName) {
    throw new ProvisioningError(stage, 'missing_fields', 'firstName, lastName, and email are required', 400);
  }
  if (!isValidEmail(normalizedEmail)) {
    throw new ProvisioningError(stage, 'invalid_email', 'Valid email is required', 400);
  }
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    throw new ProvisioningError(stage, 'invalid_password', `Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400);
  }

  stage = 'auth_create_or_resolve';
  let authUser = null;
  let created = false;
  let createError = null;
  let createdWithMinimalPayload = false;
  let createdViaSignUp = false;

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: {
        first_name: normalizedFirstName,
        last_name: normalizedLastName,
        full_name: `${normalizedFirstName} ${normalizedLastName}`.trim(),
        organization_id: orgId,
        onboarding_org_id: orgId,
      },
      ...(password ? { password } : {}),
    });
    if (error) throw error;
    authUser = data?.user ?? null;
    created = Boolean(authUser?.id);
  } catch (error) {
    createError = error;
    logger.warn('auth_create_user_error', {
      requestId,
      email: normalizedEmail,
      message: error?.message || String(error),
      code: error?.code ?? null,
      status: error?.status ?? error?.statusCode ?? null,
      details: error?.details ?? null,
    });
    if (isSupabaseAuthCreateUserAlreadyExists(error) || isSupabaseAuthCreateUserDatabaseError(error)) {
      authUser = await resolveSupabaseAuthUserByEmail({ supabase, email: normalizedEmail, requestId, logger });
      created = false;
    } else {
      throw new ProvisioningError(stage, 'auth_create_failed', error?.message || 'Unable to create auth user', 500, error);
    }
  }

  if (!authUser?.id) {
    if (isSupabaseAuthCreateUserDatabaseError(createError)) {
      if (!authUser?.id && supabaseAuthClient && password) {
        try {
          const { data, error } = await supabaseAuthClient.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
              data: {
                first_name: normalizedFirstName,
                last_name: normalizedLastName,
                full_name: `${normalizedFirstName} ${normalizedLastName}`.trim(),
                organization_id: orgId,
                onboarding_org_id: orgId,
              },
            },
          });
          if (error) throw error;
          authUser = data?.user ?? null;
          created = Boolean(authUser?.id);
          createdViaSignUp = created;
        } catch (signupError) {
          logger.warn('auth_signup_fallback_failed', {
            requestId,
            email: normalizedEmail,
            message: signupError?.message || String(signupError),
            code: signupError?.code ?? null,
            status: signupError?.status ?? signupError?.statusCode ?? null,
          });
        }
      }

      if (!authUser?.id && password) {
        try {
          const { data, error } = await supabase.auth.admin.generateLink({
            type: 'signup',
            email: normalizedEmail,
            password,
            options: {
              data: {
                first_name: normalizedFirstName,
                last_name: normalizedLastName,
                full_name: `${normalizedFirstName} ${normalizedLastName}`.trim(),
                organization_id: orgId,
                onboarding_org_id: orgId,
              },
            },
          });
          if (error) throw error;
          authUser = data?.user ?? null;
          created = Boolean(authUser?.id);
          createdViaSignUp = created;
        } catch (linkError) {
          logger.warn('auth_generate_signup_link_failed', {
            requestId,
            email: normalizedEmail,
            message: linkError?.message || String(linkError),
            code: linkError?.code ?? null,
            status: linkError?.status ?? linkError?.statusCode ?? null,
          });
        }
      }

      if (!authUser?.id) {
        try {
          const { data, error } = await supabase.auth.admin.createUser({
            email: normalizedEmail,
            email_confirm: true,
          });
          if (error) throw error;
          authUser = data?.user ?? null;
          created = Boolean(authUser?.id);
          createdWithMinimalPayload = created;
        } catch (minimalError) {
          logger.warn('auth_create_user_minimal_failed', {
            requestId,
            email: normalizedEmail,
            message: minimalError?.message || String(minimalError),
            code: minimalError?.code ?? null,
            status: minimalError?.status ?? minimalError?.statusCode ?? null,
          });
        }
      }

      const cleaned = await cleanupOrphanedProfileByEmail({
        supabase,
        email: normalizedEmail,
        logger,
        requestId,
        getOrganizationMembershipsOrgColumnName,
      });
      if (cleaned) {
        try {
          const { data, error } = await supabase.auth.admin.createUser({
            email: normalizedEmail,
            email_confirm: true,
            user_metadata: {
              first_name: normalizedFirstName,
              last_name: normalizedLastName,
              full_name: `${normalizedFirstName} ${normalizedLastName}`.trim(),
              organization_id: orgId,
              onboarding_org_id: orgId,
            },
            ...(password ? { password } : {}),
          });
          if (error) throw error;
          authUser = data?.user ?? null;
          created = Boolean(authUser?.id);
        } catch (retryError) {
          throw new ProvisioningError(stage, 'auth_create_retry_failed', retryError?.message || 'Unable to create auth user', 500, retryError);
        }
      }
    }
  }

  if (!authUser?.id) {
    throw new ProvisioningError(stage, 'auth_user_resolution_failed', 'Unable to resolve auth user', 500);
  }

  let existingProfile = null;
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('organization_id, active_organization_id')
      .eq('id', authUser.id)
      .maybeSingle();
    existingProfile = data ?? null;
  } catch (error) {
    logger.warn('provisioning_existing_profile_lookup_failed', {
      requestId,
      userId: authUser.id,
      message: error?.message || String(error),
    });
  }

  const existingUserMetadata = authUser.user_metadata && typeof authUser.user_metadata === 'object'
    ? authUser.user_metadata
    : {};
  const shouldSeedOrgMetadata = created || !existingUserMetadata.organization_id;
  const shouldSeedOnboardingMetadata = created || !existingUserMetadata.onboarding_org_id;
  const shouldSeedActiveOrgMetadata = created || !existingUserMetadata.active_organization_id;
  const mergedUserMetadata = {
    ...existingUserMetadata,
    first_name: normalizedFirstName,
    last_name: normalizedLastName,
    full_name: `${normalizedFirstName} ${normalizedLastName}`.trim(),
    ...(shouldSeedOrgMetadata ? { organization_id: orgId } : {}),
    ...(shouldSeedOnboardingMetadata ? { onboarding_org_id: orgId } : {}),
    ...(shouldSeedActiveOrgMetadata ? { active_organization_id: orgId } : {}),
  };

  if (password || createdWithMinimalPayload || createdViaSignUp || Object.keys(mergedUserMetadata).length > 0) {
    try {
      await supabase.auth.admin.updateUserById(authUser.id, {
        ...(password ? { password } : {}),
        email_confirm: true,
        user_metadata: mergedUserMetadata,
      });
    } catch (error) {
      await cleanupProvisionedUserAccount({
        supabase,
        userId: authUser.id,
        orgId,
        logger,
        requestId,
        getOrganizationMembershipsOrgColumnName,
      });
      throw new ProvisioningError(stage, 'auth_update_failed', error?.message || 'Unable to update auth user', 500, error);
    }
  }

  stage = 'profile_upsert';
  const resolvedProfileOrgId =
    created || !existingProfile?.organization_id
      ? orgId
      : existingProfile.organization_id;
  const resolvedActiveOrgId =
    created || !existingProfile?.active_organization_id
      ? orgId
      : existingProfile.active_organization_id;

  const profilePayload = {
    id: authUser.id,
    email: normalizedEmail,
    first_name: normalizedFirstName,
    last_name: normalizedLastName,
    full_name: `${normalizedFirstName} ${normalizedLastName}`.trim(),
    organization_id: resolvedProfileOrgId,
    active_organization_id: resolvedActiveOrgId,
    role: normalizedRole,
    is_active: true,
    metadata: {
      job_title: jobTitle || null,
      department: department || null,
      cohort: cohort || null,
      phone_number: phoneNumber || null,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    await ensureProfile({ supabase, userId: authUser.id, profilePayload, requestId, logger });
  } catch (error) {
    if (created) {
      await cleanupProvisionedUserAccount({
        supabase,
        userId: authUser.id,
        orgId,
        logger,
        requestId,
        getOrganizationMembershipsOrgColumnName,
      });
    }
    throw error;
  }

  stage = 'membership_upsert';
  let membership = null;
  try {
    const resolvedActorId = actor?.userId ?? null;
    defaultLogger.info('provisioning_membership_upsert_start', {
      requestId,
      orgId,
      userId: authUser.id,
      actorUserId: actor?.userId ?? null,
      resolvedActorId,
    });

    membership = await ensureMembership({
      supabase,
      orgId,
      userId: authUser.id,
      role: normalizedRole,
      actor,
      requestId,
      getOrganizationMembershipsOrgColumnName,
      getOrganizationMembershipsStatusColumnName,
      getOrganizationMembershipsHasIsActiveColumn,
    });

    defaultLogger.info('provisioning_membership_upsert_success', {
      requestId,
      orgId,
      userId: authUser.id,
      membershipId: membership?.id ?? null,
    });

    if (invalidateMembershipCache) {
      invalidateMembershipCache(authUser.id);
    }

    let actorUserUuid = actor?.userId ?? null;
    if (actorUserUuid && !isUuid(actorUserUuid)) {
      actorUserUuid = await resolveUserIdentifierToUuid(supabase, actorUserUuid).catch(() => null);
    }

    if (assignContentToUser) {
      await assignContentToUser({
        orgId,
        userId: authUser.id,
        actorUserId: actorUserUuid,
      });
    }
  } catch (error) {
    if (created) {
      await cleanupProvisionedUserAccount({
        supabase,
        userId: authUser.id,
        orgId,
        logger,
        requestId,
        getOrganizationMembershipsOrgColumnName,
      });
    }
    throw error;
  }

  stage = 'admin_role_upsert';
  try {
    await ensureAdminRoleMapping({ supabase, orgId, userId: authUser.id, role: normalizedRole, email: normalizedEmail });
  } catch (error) {
    if (created) {
      await cleanupProvisionedUserAccount({
        supabase,
        userId: authUser.id,
        orgId,
        logger,
        requestId,
        getOrganizationMembershipsOrgColumnName,
      });
    }
    throw error;
  }

  stage = 'setup_link_generate';
  let setupLink = null;
  try {
    setupLink = await generatePasswordSetupLink({ supabase, email: normalizedEmail });
  } catch (error) {
    if (created) {
      await cleanupProvisionedUserAccount({
        supabase,
        userId: authUser.id,
        orgId,
        logger,
        requestId,
        getOrganizationMembershipsOrgColumnName,
      });
    }
    throw error;
  }

  stage = 'email_delivery';
  let emailSent = false;
  let emailResult = null;
  try {
    emailResult = await sendProvisioningEmail({
      sendEmail,
      email: normalizedEmail,
      firstName: normalizedFirstName,
      setupLink,
      orgName,
      actorId: actor?.userId ?? null,
      orgId,
    });
    emailSent = Boolean(emailResult?.delivered);
  } catch (error) {
    logger.warn('provisioning_email_failed', {
      requestId,
      orgId,
      userId: authUser.id,
      message: error?.message || String(error),
    });
    emailSent = false;
  }

  stage = 'final_verify';
  const verification = await verifyProvisionedUserState({
    supabase,
    orgId,
    userId: authUser.id,
    email: normalizedEmail,
    setupLink,
    getOrganizationMembershipsOrgColumnName,
  });
  if (!verification?.ok) {
    throw new ProvisioningError('final_verify', 'verification_failed', 'Provisioning verification failed', 500);
  }

  logger.info('[USER CREATED VERIFIED]', {
    requestId,
    orgId,
    userId: authUser.id,
    email: normalizedEmail,
    membershipId: verification.membership?.id ?? null,
    created,
  });

  let members = null;
  if (fetchOrgMembersWithProfiles) {
    try {
      const rows = await fetchOrgMembersWithProfiles(orgId);
      members = rows.find((row) => String(row?.user_id ?? '') === String(authUser.id)) || null;
    } catch (error) {
      logger.warn('provisioning_member_reload_failed', {
        requestId,
        orgId,
        userId: authUser.id,
        message: error?.message || String(error),
      });
    }
  }

  return {
    created,
    membershipCreated: Boolean(membership?.id),
    member: members || membership,
    userId: authUser.id,
    setupLink,
    emailSent,
    emailResult,
    profile: verification.profile,
    membership: verification.membership,
  };
};
