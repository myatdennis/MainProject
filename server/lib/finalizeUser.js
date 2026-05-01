export function finalizeUser(user) {
  if (!user || typeof user !== 'object') return user;

  // Keep behavior consistent everywhere req.user is assigned.
  // Freeze in non-production so mutation bugs fail loudly during dev/test.
  if (process.env.NODE_ENV !== 'production') {
    try {
      return Object.freeze(user);
    } catch (e) {
      return user;
    }
  }

  return user;
}

export function isFinalizedUser(user) {
  if (!user || typeof user !== 'object') return false;

  if (process.env.NODE_ENV !== 'production') {
    return Object.isFrozen ? Object.isFrozen(user) : false;
  }

  return true;
}

export default finalizeUser;
