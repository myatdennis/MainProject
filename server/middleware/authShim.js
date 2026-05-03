// This file intentionally left blank to avoid breaking imports during
// rollouts. No legacy compatibility behavior is present here.
const isDev = process.env.NODE_ENV !== 'production';

export default function authShim(req, _res, next) {
  if (isDev) {
    console.log('[AUTH COMPAT]', {
      hasUser: !!req.user,
      userId: req.user?.id,
      legacyUser: !!req.supabaseJwtUser,
    });
  }
  return next();
}
