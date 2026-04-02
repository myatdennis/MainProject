;const truthyValues = new Set(['true', '1', 'yes', 'y', 'on']);
const falsyValues = new Set(['false', '0', 'no', 'n', 'off']);

const normalizeFlag = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return String(value).trim().toLowerCase();
};

export const parseFlag = (value, fallback = false) => {
  const normalized = normalizeFlag(value);
  if (!normalized) return Boolean(fallback);
  if (truthyValues.has(normalized)) return true;
  if (falsyValues.has(normalized)) return false;
  return Boolean(fallback);
};

export const NODE_ENV = (process.env.NODE_ENV || '').toLowerCase();
export const isProduction = NODE_ENV === 'production';
export const isDevelopment = NODE_ENV === 'development';
export const isTestEnvironment = NODE_ENV === 'test';

const demoModeRaw = parseFlag(process.env.DEMO_MODE);
const allowDemoRaw = parseFlag(process.env.ALLOW_DEMO);
const devFallbackRaw = parseFlag(process.env.DEV_FALLBACK);
const e2eTestRaw = parseFlag(process.env.E2E_TEST_MODE);
const allowDemoExplicitRaw = parseFlag(process.env.ALLOW_DEMO_EXPLICIT);
const demoModeExplicitRaw = parseFlag(process.env.DEMO_MODE_EXPLICIT);
const allowLegacyDemoUsersRaw = parseFlag(process.env.ALLOW_LEGACY_DEMO_USERS);
const forceOrgEnforcementRaw = parseFlag(process.env.FORCE_ORG_ENFORCEMENT);
const idempotencyFallbackRaw = parseFlag(process.env.TEST_IDEMPOTENCY_FALLBACK_MODE);

if (isProduction && (demoModeRaw || allowDemoRaw || devFallbackRaw || e2eTestRaw)) {
  console.error('[FATAL] DEMO_MODE, DEV_FALLBACK, ALLOW_DEMO or E2E_TEST_MODE cannot be enabled in production.');
  console.error('Set NODE_ENV=production without these flags to start safely.');
  process.exit(1);
}

export const DEMO_MODE = !isProduction && (demoModeRaw || allowDemoRaw || devFallbackRaw);
export const E2E_TEST_MODE = !isProduction && e2eTestRaw;
export const DEV_FALLBACK = DEMO_MODE;
export const TEST_IDEMPOTENCY_FALLBACK_MODE = !isProduction && idempotencyFallbackRaw;

export const allowDemoExplicit = !isProduction && allowDemoExplicitRaw;
export const demoModeExplicit = !isProduction && demoModeExplicitRaw;
export const allowLegacyDemoUsers = !isProduction && allowLegacyDemoUsersRaw;
export const FORCE_ORG_ENFORCEMENT = !isProduction && forceOrgEnforcementRaw;

export const getRuntimeMode = () => {
  if (isTestEnvironment || E2E_TEST_MODE) return 'test';
  if (DEMO_MODE) return 'demo';
  if (isDevelopment) return 'dev';
  return 'production';
};

export const RUNTIME_MODE = getRuntimeMode();
export const isDemoMode = RUNTIME_MODE === 'demo';
export const isTestMode = RUNTIME_MODE === 'test';
export const isDevMode = RUNTIME_MODE === 'dev';

const supabaseUrlEnv = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceEnv =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
export const supabaseServerConfigured = Boolean(supabaseUrlEnv && supabaseServiceEnv);

export const demoLoginEnabled = Boolean(
  isDemoMode && parseFlag(process.env.DEMO_AUTO_AUTH)
);

export const demoAutoAuthEnabled = demoLoginEnabled;

export const demoModeSource = (() => {
  if (isDemoMode) {
    if (demoModeRaw) return 'explicit';
    if (allowDemoRaw) return 'allow_demo';
    if (devFallbackRaw) return 'dev-fallback';
  }
  if (isTestMode) return 'test';
  if (isDevMode) return 'dev';
  return null;
})();

export const describeDemoMode = () => {
  if (!demoLoginEnabled) {
    return { enabled: false };
  }
  return {
    enabled: true,
    source: demoModeSource,
    demo: isDemoMode,
    devFallback: DEV_FALLBACK,
    explicit: Boolean(allowDemoRaw || demoModeRaw),
    e2e: Boolean(E2E_TEST_MODE),
  };
};

export { truthyValues };
