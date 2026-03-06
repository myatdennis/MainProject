export type AuthRedirectMeta = Record<string, unknown>;

declare global {
  interface Window {
    __HUDDLE_LAST_AUTH_REDIRECT__?: {
      context: string;
      meta: AuthRedirectMeta;
      timestamp: number;
    };
    __HUDDLE_AUTH_DEBUG__?: Record<string, unknown>;
  }
}

export const logAuthRedirect = (context: string, meta: AuthRedirectMeta = {}) => {
  try {
    console.warn('[AUTH_REDIRECT]', { context, ...meta });
    if (typeof console.trace === 'function') {
      console.trace('[AUTH_REDIRECT_TRACE]', context);
    }
    if (typeof window !== 'undefined') {
      window.__HUDDLE_LAST_AUTH_REDIRECT__ = {
        context,
        meta,
        timestamp: Date.now(),
      };
    }
  } catch {
    // no-op
  }
};

export const logAuthDiagnostic = (context: string, meta: AuthRedirectMeta = {}) => {
  try {
    console.debug('[AUTH_DIAGNOSTIC]', { context, ...meta });
    if (typeof window !== 'undefined') {
      window.__HUDDLE_AUTH_DEBUG__ = {
        ...(window.__HUDDLE_AUTH_DEBUG__ || {}),
        lastDiagnostic: {
          context,
          meta,
          timestamp: Date.now(),
        },
      };
    }
  } catch {
    // no-op
  }
};
