import { isFinalizedUser } from '../lib/finalizeUser.js';

export function enforceSingleAuth(req, res, next) {
  try {
    if (!req.user) return next();

    if (typeof req.user !== 'object' || !req.user.id) {
      console.error('[AUTH CORRUPTION]', req.user);
      return res.status(500).json({ error: 'invalid_auth_state' });
    }

    // Enforce canonical finalization invariant: assignments must use finalizeUser
    if (!isFinalizedUser(req.user)) {
      console.error('[AUTH INVARIANT VIOLATION] req.user was assigned but not finalized', {
        path: req.path,
        method: req.method,
        hasUser: !!req.user,
        userId: req.user?.id || req.user?.userId || null,
      });

      return res.status(500).json({
        ok: false,
        error: 'auth_invariant_violation',
        message: 'Canonical auth user was not finalized',
      });
    }

    return next();
  } catch (err) {
    console.error('[AUTH GUARD ERROR]', err);
    return res.status(500).json({ error: 'invalid_auth_state' });
  }
}

export default enforceSingleAuth;
