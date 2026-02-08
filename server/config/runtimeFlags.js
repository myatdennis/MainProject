const truthyValues = new Set(['true', '1', 'yes', 'y', 'on']);
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

const supabaseUrlEnv = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceEnv =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
export const supabaseServerConfigured = Boolean(supabaseUrlEnv && supabaseServiceEnv);

const allowDemoFlag = parseFlag(process.env.ALLOW_DEMO);
const demoModeFlag = parseFlag(process.env.DEMO_MODE);
const devFallbackFlag = parseFlag(process.env.DEV_FALLBACK);

export const allowDemoExplicit = !isProduction && allowDemoFlag;
export const demoModeExplicit = !isProduction && demoModeFlag;
const devFallbackExplicit = !isProduction && devFallbackFlag;
export const allowLegacyDemoUsers = parseFlag(process.env.ALLOW_LEGACY_DEMO_USERS);
export const E2E_TEST_MODE = parseFlag(process.env.E2E_TEST_MODE);
export const FORCE_ORG_ENFORCEMENT = parseFlag(
  process.env.FORCE_ORG_ENFORCEMENT ?? process.env.ENFORCE_ORG_ENFORCEMENT ?? process.env.FORCE_ORG_GUARDS
);

export const DEV_FALLBACK = Boolean(devFallbackExplicit || allowDemoExplicit || demoModeExplicit);
export const implicitDemoFallback = !isProduction && !supabaseServerConfigured;
export const demoLoginEnabled = Boolean(
  (E2E_TEST_MODE && !isProduction) ||
    (!isProduction &&
      (allowDemoExplicit ||
        demoModeExplicit ||
        DEV_FALLBACK ||
        (implicitDemoFallback && !demoModeFlag && !devFallbackFlag))),
);
const demoAutoAuthExplicit = parseFlag(
  process.env.ALLOW_DEMO_AUTO_AUTH ?? process.env.DEMO_AUTO_AUTH ?? process.env.DEMO_AUTO_LOGIN,
);
export const demoAutoAuthEnabled = Boolean(E2E_TEST_MODE || (DEV_FALLBACK && demoAutoAuthExplicit));
export const demoModeSource = (() => {
  if (E2E_TEST_MODE) return 'e2e';
  if (DEV_FALLBACK) return 'dev-fallback';
  if (allowDemoExplicit || demoModeExplicit) return 'explicit';
  if (implicitDemoFallback && !demoModeFlag && !devFallbackFlag) return 'dev-missing-supabase';
  return null;
})();

export const describeDemoMode = () => {
  if (!demoLoginEnabled) {
    return { enabled: false };
  }
  return {
    enabled: true,
    source: demoModeSource,
    e2e: Boolean(E2E_TEST_MODE),
    devFallback: Boolean(DEV_FALLBACK),
    explicit: Boolean(allowDemoExplicit || demoModeExplicit),
    implicit: Boolean(implicitDemoFallback),
  };
};

export { truthyValues };
