import { describe, expect, it } from 'vitest';
import { computeAuthState } from '../surfaceAccess';

describe('surfaceAccess', () => {
  it('grants admin only on admin surface for admins', () => {
    expect(computeAuthState({ id: '1', role: 'admin' } as any, 'admin')).toEqual({
      admin: true,
      lms: false,
      client: false,
    });
  });

  it('grants learner/client on default surface for non-admin users', () => {
    expect(computeAuthState({ id: '2', role: 'learner' } as any)).toEqual({
      admin: false,
      lms: true,
      client: true,
    });
  });
});

