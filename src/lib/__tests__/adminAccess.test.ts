import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasAdminPortalAccess,
  setAdminAccessSnapshot,
  getAdminAccessSnapshot,
  clearAdminAccessSnapshot,
  normalizeAdminAccessPayload,
} from '../adminAccess';

describe('adminAccess normalization', () => {
  beforeEach(() => {
    clearAdminAccessSnapshot();
  });

  it('unwraps envelope responses and preserves metadata', () => {
    const normalized = normalizeAdminAccessPayload({
      ok: true,
      requestId: 'req-123',
      data: {
        adminPortalAllowed: true,
        access: {
          adminPortal: true,
        },
      },
    });
    expect(normalized).not.toBeNull();
    expect(normalized?.adminPortalAllowed).toBe(true);
    expect(normalized?.requestId).toBe('req-123');
  });

  it('detects admin access from wrapped payloads', () => {
    const allowed = hasAdminPortalAccess({
      data: {
        access: { adminPortal: true },
      },
    });
    expect(allowed).toBe(true);
  });

  it('stores normalized payloads in snapshot state', () => {
    setAdminAccessSnapshot({
      ok: true,
      requestId: 'req-999',
      data: {
        access: { adminPortal: true },
        reason: 'allowlist',
      },
    } as any);
    const snapshot = getAdminAccessSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.payload?.access?.adminPortal).toBe(true);
    expect(snapshot?.payload?.requestId).toBe('req-999');
    expect(hasAdminPortalAccess(snapshot?.payload ?? null)).toBe(true);
  });
});
