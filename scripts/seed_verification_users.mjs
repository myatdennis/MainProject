#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[seed-verification-users] Missing required env: ${missing.join(', ')}`);
  process.exit(1);
}

const ORG_ID = process.env.VERIFICATION_ORG_ID || 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8';

const VERIFICATION_USERS = [
  {
    kind: 'admin',
    email: process.env.VERIFICATION_ADMIN_EMAIL || 'mya@the-huddle.co',
    password: process.env.VERIFICATION_ADMIN_PASSWORD || 'admin123',
    fallbackId: process.env.VERIFICATION_ADMIN_ID || '0f88f8c5-c5b8-4dc0-b0d0-8cbfc8a373b4',
    profile: {
      first_name: 'Mya',
      last_name: 'Dennis',
      role: 'admin',
      is_admin: true,
    },
    membershipRole: 'admin',
    platformRole: 'platform_admin',
    ensureAdminAllowlist: true,
  },
  {
    kind: 'learner',
    email: process.env.VERIFICATION_LEARNER_EMAIL || 'user@pacificcoast.edu',
    password: process.env.VERIFICATION_LEARNER_PASSWORD || 'user123',
    fallbackId: process.env.VERIFICATION_LEARNER_ID || '7d1e6f7c-69df-4f36-8517-4f8d53d94ea7',
    profile: {
      first_name: 'Sarah',
      last_name: 'Chen',
      role: 'member',
      is_admin: false,
    },
    membershipRole: 'member',
    platformRole: null,
    ensureAdminAllowlist: false,
  },
];

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const findAuthUserByEmail = async (email) => {
  if (typeof supabase.auth.admin.getUserByEmail === 'function') {
    const { data, error } = await supabase.auth.admin.getUserByEmail(email);
    if (error) throw error;
    return data?.user ?? null;
  }

  let page = 1;
  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match =
      data?.users?.find((entry) => normalizeEmail(entry?.email) === normalizeEmail(email)) ?? null;
    if (match) return match;
    if (!Array.isArray(data?.users) || data.users.length < 200) break;
    page += 1;
  }

  return null;
};

const findProfileByEmail = async (email) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id,email,role,is_admin')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
};

const ensureAuthUser = async (definition) => {
  const existingAuthUser = await findAuthUserByEmail(definition.email);
  const existingProfile = await findProfileByEmail(definition.email).catch(() => null);
  const preferredId = existingAuthUser?.id || existingProfile?.id || definition.fallbackId;

  if (!existingAuthUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      id: preferredId,
      email: definition.email,
      password: definition.password,
      email_confirm: true,
      user_metadata: {
        role: definition.profile.role,
        first_name: definition.profile.first_name,
        last_name: definition.profile.last_name,
      },
      app_metadata: {
        role: definition.profile.role,
        ...(definition.platformRole ? { platform_role: definition.platformRole } : {}),
      },
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.updateUserById(existingAuthUser.id, {
    email: definition.email,
    password: definition.password,
    email_confirm: true,
    user_metadata: {
      ...(existingAuthUser.user_metadata || {}),
      role: definition.profile.role,
      first_name: definition.profile.first_name,
      last_name: definition.profile.last_name,
    },
    app_metadata: {
      ...(existingAuthUser.app_metadata || {}),
      role: definition.profile.role,
      ...(definition.platformRole ? { platform_role: definition.platformRole } : {}),
    },
  });
  if (error) throw error;
  return data.user;
};

const ensureProfile = async ({ userId, definition }) => {
  const payload = {
    id: userId,
    email: definition.email,
    first_name: definition.profile.first_name,
    last_name: definition.profile.last_name,
    role: definition.profile.role,
    is_admin: definition.profile.is_admin,
    organization_id: ORG_ID,
  };
  const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
};

const ensureMembership = async ({ userId, definition }) => {
  const activePayload = {
    organization_id: ORG_ID,
    org_id: ORG_ID,
    user_id: userId,
    role: definition.membershipRole,
    status: 'active',
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const deactivateResult = await supabase
    .from('organization_memberships')
    .update({
      status: 'inactive',
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .neq('organization_id', ORG_ID);
  if (deactivateResult.error) {
    throw deactivateResult.error;
  }

  const { error } = await supabase
    .from('organization_memberships')
    .upsert(activePayload, { onConflict: 'organization_id,user_id' });
  if (error) throw error;
};

const ensureAdminAllowlist = async ({ userId, definition }) => {
  if (!definition.ensureAdminAllowlist) return;

  const modernPayload = {
    user_id: userId,
    organization_id: ORG_ID,
    email: definition.email,
    is_active: true,
    meta: { role: definition.membershipRole },
  };
  const modernResult = await supabase
    .from('admin_users')
    .upsert(modernPayload, { onConflict: 'user_id,organization_id' });

  if (!modernResult.error) return;
  const message = String(modernResult.error.message || modernResult.error.details || '').toLowerCase();
  const missingModernColumns =
    modernResult.error.code === 'PGRST204' ||
    message.includes('organization_id') ||
    message.includes('meta');

  if (!missingModernColumns) throw modernResult.error;

  const { error } = await supabase
    .from('admin_users')
    .upsert(
      {
        user_id: userId,
        email: definition.email,
        is_active: true,
      },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
};

const verifyState = async ({ userId, definition }) => {
  const { data: membership, error: membershipError } = await supabase
    .from('organization_memberships')
    .select('organization_id,user_id,role,status,is_active')
    .eq('organization_id', ORG_ID)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id,email,role,is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw profileError;

  return {
    email: definition.email,
    userId,
    membership,
    profile,
  };
};

const run = async () => {
  const summary = [];

  for (const definition of VERIFICATION_USERS) {
    const authUser = await ensureAuthUser(definition);
    await ensureProfile({ userId: authUser.id, definition });
    await ensureMembership({ userId: authUser.id, definition });
    await ensureAdminAllowlist({ userId: authUser.id, definition });
    summary.push(await verifyState({ userId: authUser.id, definition }));
  }

  console.log(
    JSON.stringify(
      {
        orgId: ORG_ID,
        users: summary,
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  console.error('[seed-verification-users] failed', error?.message || error);
  process.exit(1);
});
