import { getUserSession } from '../lib/secureStorage';

const buildSessionAuditHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};

  try {
    const session = getUserSession();
    if (!session) {
      return headers;
    }

    if (session.id) {
      headers['X-User-Id'] = session.id;
    }
    // Do not include role/org override headers from the frontend.
    // Keep only a stable X-User-Id for lightweight audit/correlation.
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[sessionAuditHeaders] Failed to read session context for headers', error);
    }
  }

  return headers;
};

export default buildSessionAuditHeaders;
