import { createHttpError } from '../middleware/apiErrorHandler.js';
import { logger } from './logger.js';

export function validateOrgId(orgId, message) {
  if (!orgId) {
    throw createHttpError(400, 'org_id_required', message || 'organizationId is required.');
  }
}

export function logInviteInsertAttempt(meta = {}) {
  try {
    logger.info('invite_insert_attempt', meta);
  } catch (_) {
    // best-effort logging
  }
}

export default { validateOrgId, logInviteInsertAttempt };
