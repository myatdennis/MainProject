import { waitForAuthReady as canonicalWaitForAuthReady, getCanonicalSession } from './canonicalAuth';
import { getAuthState } from '../store/authStore';
import { resolveOrgContextFromBridge, BRIDGE_SNAPSHOT_EVENT } from '../store/courseStoreOrgBridge';

export async function waitForAuthReady(timeoutMs = 5000) {
  try {
    // Leverage existing canonical auth readiness helper
    const ready = await canonicalWaitForAuthReady(timeoutMs);
    return ready;
  } catch (err) {
    throw new Error('auth_ready_timeout');
  }
}

export async function waitForOrgReady(timeoutMs = 5000) {
  // Fast path: bridge snapshot already contains an org
  try {
    const snapshot = resolveOrgContextFromBridge();
    if (snapshot && (snapshot.activeOrgId || snapshot.orgId) && snapshot.status === 'ready') {
      return { orgId: snapshot.activeOrgId ?? snapshot.orgId, role: snapshot.role ?? null };
    }
  } catch (e) {
    void e; // ignore and fall through to event/polling wait
  }

  if (typeof window === 'undefined') {
    // In SSR/non-browser we cannot wait for bridge events; fail fast
    throw new Error('org_ready_unavailable');
  }

  // Combine event-driven wakeup with polling to match legacy wait behavior
  return await new Promise<{ orgId: string | null; role: string | null }>((resolve, reject) => {
    let settled = false;
    const start = Date.now();
    const delays = [50, 100, 200, 400, 800, 1200];
    let attempt = 0;

    const checkSnapshot = () => {
      try {
        const snap = resolveOrgContextFromBridge();
        if (snap && (snap.activeOrgId || snap.orgId) && snap.status === 'ready') {
          if (!settled) {
            settled = true;
            cleanup();
            resolve({ orgId: snap.activeOrgId ?? snap.orgId, role: snap.role ?? null });
          }
          return true;
        }
      } catch (e) {
        void e; // ignore
      }
      return false;
    };

    const onEvent = () => {
      if (checkSnapshot()) return;
    };

    const cleanup = () => {
      try {
        window.removeEventListener(BRIDGE_SNAPSHOT_EVENT, onEvent as EventListener);
      } catch (e) { void e; }
      if (timer) clearTimeout(timer);
    };

    window.addEventListener(BRIDGE_SNAPSHOT_EVENT, onEvent as EventListener);

    const tick = async () => {
      if (settled) return;
      if (Date.now() - start >= timeoutMs) {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error('org_ready_timeout'));
        }
        return;
      }
      const did = checkSnapshot();
      if (did) return;
      const delay = delays[Math.min(attempt, delays.length - 1)];
      attempt += 1;
      timer = setTimeout(tick, delay);
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    // Kick off the polling loop and also do an immediate check
    Promise.resolve().then(tick);
  });
}

export async function ensureSessionAndOrg(options?: { requireAdmin?: boolean; timeoutMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? 5000;
  try {
    await waitForAuthReady(timeoutMs);
  } catch (err) {
    throw new Error('session_required');
  }

  let orgInfo;
  try {
    orgInfo = await waitForOrgReady(timeoutMs);
  } catch (err) {
    throw new Error('org_required');
  }

  const session = getCanonicalSession();
  if (!session || !session.userId) {
    throw new Error('session_missing');
  }

  if (options?.requireAdmin) {
    const auth = getAuthState();
    const isAdmin = Boolean(auth?.isAdmin);
    if (!isAdmin) {
      throw new Error('admin_required');
    }
  }

  return { session, orgId: orgInfo.orgId, role: orgInfo.role };
}

export default {
  waitForAuthReady,
  waitForOrgReady,
  ensureSessionAndOrg,
};
