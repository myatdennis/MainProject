const PLACEHOLDER_PATTERNS = [
  /REPLACE_ME/i,
  /CHANGE_ME/i,
  /your-very-secret/i,
  /public-anon-key-here/i,
  /service-role-secret/i,
  /your-project/i,
];

const sanitize = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const resolveEnvValue = (keys = []) => {
  for (const key of keys) {
    const value = sanitize(process.env[key]);
    if (!value) continue;
    if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))) {
      continue;
    }
    return { key, value };
  }
  return { key: null, value: '' };
};

const SUPABASE_URL_KEYS = ['SUPABASE_URL', 'VITE_SUPABASE_URL'];
const SUPABASE_SERVICE_ROLE_KEYS = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SUPABASE_KEY'];
const SUPABASE_ANON_KEYS = ['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'];

export const getSupabaseConfig = () => {
  const url = resolveEnvValue(SUPABASE_URL_KEYS);
  const serviceRole = resolveEnvValue(SUPABASE_SERVICE_ROLE_KEYS);
  const anon = resolveEnvValue(SUPABASE_ANON_KEYS);
  const missing = [];
  if (!url.value) missing.push('SUPABASE_URL');
  if (!serviceRole.value) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  const configured = Boolean(url.value && serviceRole.value);
  const error = configured
    ? null
    : {
        code: 'AUTH_NOT_CONFIGURED',
        status: 503,
        message:
          missing.length > 0
            ? `Supabase credentials missing: ${missing.join(', ')}`
            : 'Supabase credentials are not configured.',
        missingEnv: missing,
      };

  return {
    url: url.value || null,
    serviceRoleKey: serviceRole.value || null,
    anonKey: anon.value || null,
    urlSource: url.key,
    serviceKeySource: serviceRole.key,
    anonKeySource: anon.key,
    configured,
    missing,
    error,
  };
};
