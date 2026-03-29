#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const NEW_PASSWORD = process.env.NEW_PASSWORD;
const ENSURE_ADMIN = process.env.ENSURE_ADMIN === '1';

const requireEnv = (name, value) => {
  if (!value) {
    console.error(`[reset-admin-login] Missing ${name}`);
    return false;
  }
  return true;
};

const run = async () => {
  const ok = [
    requireEnv('SUPABASE_URL', SUPABASE_URL),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE_KEY),
    requireEnv('ADMIN_EMAIL', ADMIN_EMAIL),
    requireEnv('NEW_PASSWORD', NEW_PASSWORD),
  ].every(Boolean);

  if (!ok) {
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(ADMIN_EMAIL);
  if (userError || !userData?.user) {
    console.error('[reset-admin-login] Unable to find user', userError?.message || userError);
    process.exit(1);
  }

  const user = userData.user;
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password: NEW_PASSWORD,
    email_confirm: true,
  });
  if (updateError) {
    console.error('[reset-admin-login] Failed to update password', updateError?.message || updateError);
    process.exit(1);
  }

  if (ENSURE_ADMIN) {
    const { error: adminError } = await supabase
      .from('admin_users')
      .upsert({ user_id: user.id, email: ADMIN_EMAIL, is_active: true }, { onConflict: 'user_id' });
    if (adminError) {
      console.warn('[reset-admin-login] Admin allowlist upsert failed', adminError?.message || adminError);
    }
  }

  console.log('[reset-admin-login] Password reset OK', { userId: user.id, email: ADMIN_EMAIL });
};

run().catch((error) => {
  console.error('[reset-admin-login] Unexpected error', error?.message || error);
  process.exit(1);
});
