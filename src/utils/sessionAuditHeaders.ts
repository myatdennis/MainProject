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
    if (session.role) {
      headers['X-User-Role'] = session.role;
    }
    const preferredOrgId = session.activeOrgId || session.organizationId;
    if (preferredOrgId) {
      headers['X-Org-Id'] = preferredOrgId;
    }
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('[sessionAuditHeaders] Failed to read session context for headers', error);
    }
  }

  return headers;
};

export default buildSessionAuditHeaders;
