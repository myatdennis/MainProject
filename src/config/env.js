const readBoolean = (value, fallback = false) => {
    if (value === undefined)
        return fallback;
    return value === '1' || value === 'true' || value === 'on' || value === 'yes';
};
export const getConfig = () => {
    const apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || null;
    return {
        apiBaseUrl,
        features: {
            dalEnabled: readBoolean(import.meta.env?.VITE_FEATURE_DAL_ENABLED, false),
            sentryEnabled: readBoolean(import.meta.env?.VITE_SENTRY_ENABLED, false),
        },
        timeouts: {
            requestMs: Number(import.meta.env?.VITE_REQUEST_TIMEOUT_MS || 15000),
        },
        retries: {
            attempts: Number(import.meta.env?.VITE_RETRY_ATTEMPTS || 2),
            backoffMs: Number(import.meta.env?.VITE_RETRY_BACKOFF_MS || 300),
        },
    };
};
export const config = getConfig();
