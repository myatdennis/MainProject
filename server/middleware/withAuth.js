import { authenticate } from './authenticate.js';
import { enforceSingleAuth } from './enforceSingleAuth.js';

export function withAuth(...handlers) {
  return [authenticate, enforceSingleAuth, ...handlers];
}

export function withOptionalAuth(...handlers) {
  return [authenticate, enforceSingleAuth, ...handlers];
}
