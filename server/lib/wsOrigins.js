const STATIC_WS_ORIGINS = new Set([
  'https://the-huddle.co',
  'https://www.the-huddle.co'
]);

const NETLIFY_PREVIEW_REGEX = /^https:\/\/deploy-preview-\d+--the-huddleco\.netlify\.app$/i;

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
    return !isProduction;
  }

  if (STATIC_WS_ORIGINS.has(origin)) {
    return true;
  }

  if (NETLIFY_PREVIEW_REGEX.test(origin)) {
    return true;
  }

  if (!isProduction && isLocalDevOrigin(origin)) {
    return true;
  }

  return false;
};

export const describeAllowedWsOrigins = () => ({
  staticOrigins: Array.from(STATIC_WS_ORIGINS),
  netlifyPreviewPattern: NETLIFY_PREVIEW_REGEX.toString()
});
