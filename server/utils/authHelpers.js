export function isSupabaseAuthCreateUserAlreadyExists(error) {
  if (!error || typeof error !== 'object') return false;

  const message = String(error?.message || error?.error_description || error?.details || '').toLowerCase();
  const code = String(error?.code || error?.status || error?.statusCode || '').toLowerCase();
  const status = Number(error?.status || error?.statusCode || 0);

  return (
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('user already registered') ||
    message.includes('duplicate') ||
    code.includes('already') ||
    code.includes('duplicate') ||
    status === 409 ||
    status === 422
  );
}

export function isSupabaseAuthCreateUserDatabaseError(error) {
  if (!error || typeof error !== 'object') return false;

  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();

  return (
    code === 'unexpected_failure' ||
    message.includes('database error creating new user') ||
    message.includes('database error')
  );
}
