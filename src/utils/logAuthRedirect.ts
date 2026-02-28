export type AuthRedirectMeta = Record<string, unknown>;

export const logAuthRedirect = (context: string, meta: AuthRedirectMeta = {}) => {
  try {
    console.warn('[AUTH_REDIRECT]', { context, ...meta });
    if (typeof console.trace === 'function') {
      console.trace('[AUTH_REDIRECT_TRACE]', context);
    }
  } catch {
    // no-op
  }
};

