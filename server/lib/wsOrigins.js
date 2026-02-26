const STATIC_WS_ORIGINS = new Set([
  'https://the-huddle.co',
  'https://www.the-huddle.co',
]);

const NETLIFY_PREVIEW_REGEX = /^https:\/\/deploy-preview-\d+--the-huddleco\.netlify\.app$/i;
const NETLIFY_SUFFIX = '.netlify.app';

const isNetlifyOrigin = (origin) => {
  if (typeof origin !== 'string') return false;
  try {
    const { hostname } = new URL(origin);
    return typeof hostname === 'string' && hostname.toLowerCase().endsWith(NETLIFY_SUFFIX);
  } catch (err) {
    return false;
  }
};

const isLocalDevOrigin = (origin) =>
  typeof origin === 'string' && (origin.startsWith('http://localhost') || origin.startsWith('http://127.'));

/**
 * Determine whether a WebSocket upgrade origin should be accepted.
 * @param {string | undefined | null} origin
 * @param {{ isProduction?: boolean }} [options]
 */
export const isAllowedWsOrigin = (origin, options = {}) => {
  const { isProduction = process.env.NODE_ENV === 'production' } = options;

  if (!origin) {
    return {
      allowed: false,
      reason: 'missing_origin',
    };
  }

  if (STATIC_WS_ORIGINS.has(origin)) {
    return { allowed: true, reason: 'static_allowlist' };
  }

  if (NETLIFY_PREVIEW_REGEX.test(origin)) {
    return { allowed: true, reason: 'netlify_preview' };
  }

  if (isNetlifyOrigin(origin)) {
    return { allowed: true, reason: 'netlify_any' };
  }

  if (!isProduction && isLocalDevOrigin(origin)) {
    return { allowed: true, reason: 'local_dev' };
  }

  return { allowed: false, reason: 'not_allowed' };
};

export const describeAllowedWsOrigins = () => ({
  staticOrigins: Array.from(STATIC_WS_ORIGINS),
  netlifyPreviewPattern: NETLIFY_PREVIEW_REGEX.toString(),
  netlifySuffix: NETLIFY_SUFFIX,
});
