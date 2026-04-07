const LMS_PREFIX = '/lms';

export const getLearnerPortalBasePath = (pathname?: string): '/client' | '/lms' => {
  const normalizedPath = String(pathname || '').toLowerCase();
  if (normalizedPath === LMS_PREFIX || normalizedPath.startsWith(`${LMS_PREFIX}/`)) {
    return '/lms';
  }
  return '/client';
};
