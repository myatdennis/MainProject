export interface AdminAccessPayload {
  adminPortalAllowed?: boolean;
  access?: {
    allowed?: boolean;
    adminPortal?: boolean;
    admin?: boolean;
    isAdmin?: boolean;
    via?: string | null;
    reason?: string | null;
    capabilities?: Record<string, boolean | undefined>;
    scopes?: string[];
    permissions?: string[];
    timestamp?: string;
  } | null;
  user?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
  reason?: string | null;
  message?: string | null;
  error?: string | null;
  instructions?: string | null;
  hint?: string | null;
  requestId?: string | null;
}

type EnvelopeLike = {
  data?: AdminAccessPayload | EnvelopeLike | null;
  requestId?: string | null;
  reason?: string | null;
  message?: string | null;
  error?: string | null;
  instructions?: string | null;
  hint?: string | null;
};

export type AdminAccessResponse = AdminAccessPayload | EnvelopeLike | null;

type Snapshot = {
  payload: AdminAccessPayload | null;
  fetchedAt: number;
};

const ADMIN_ACCESS_TTL_MS = 2 * 60 * 1000;

let snapshot: Snapshot | null = null;
const snapshotListeners = new Set<() => void>();

const notifySnapshotListeners = () => {
  snapshotListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn('[adminAccess] snapshot listener error', error);
    }
  });
};

export const hasAdminPortalAccess = (payload?: AdminAccessResponse): boolean => {
  const normalized = normalizeAdminAccessPayload(payload);
  if (!normalized) {
    return false;
  }
  if (normalized.adminPortalAllowed === true) {
    return true;
  }
  if (!normalized.access) {
    return false;
  }
  const access = normalized.access;
  return (
    access.allowed === true ||
    access.adminPortal === true ||
    access.admin === true ||
    Boolean(access.capabilities?.adminPortal)
  );
};

export const setAdminAccessSnapshot = (payload: AdminAccessResponse) => {
  const normalized = normalizeAdminAccessPayload(payload);
  snapshot = normalized
    ? {
        payload: normalized,
        fetchedAt: Date.now(),
      }
    : null;
  notifySnapshotListeners();
};

export const getAdminAccessSnapshot = (): Snapshot | null => snapshot;

export const isAdminAccessSnapshotFresh = (ttlMs = ADMIN_ACCESS_TTL_MS): boolean => {
  if (!snapshot) {
    return false;
  }
  return Date.now() - snapshot.fetchedAt < ttlMs;
};

export const clearAdminAccessSnapshot = () => {
  snapshot = null;
  notifySnapshotListeners();
};

export const subscribeAdminAccessSnapshot = (listener: () => void) => {
  snapshotListeners.add(listener);
  return () => {
    snapshotListeners.delete(listener);
  };
};

export { ADMIN_ACCESS_TTL_MS };

const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const cloneNested = <T extends Record<string, unknown>>(value: T | null | undefined): T | null => {
  if (!isObjectLike(value)) {
    return value ?? null;
  }
  return { ...value };
};

const mergeEnvelopeMeta = (
  payload: AdminAccessPayload,
  envelope: Record<string, unknown>,
): AdminAccessPayload => {
  const merged: AdminAccessPayload = {
    ...payload,
    access: payload.access
      ? { ...payload.access, capabilities: payload.access.capabilities ? { ...payload.access.capabilities } : undefined }
      : payload.access ?? null,
    user: cloneNested(payload.user),
    context: cloneNested(payload.context),
  };
  if (merged.reason == null && typeof envelope.reason === 'string') {
    merged.reason = envelope.reason;
  }
  if (merged.message == null && typeof envelope.message === 'string') {
    merged.message = envelope.message;
  }
  if (merged.error == null && typeof envelope.error === 'string') {
    merged.error = envelope.error;
  }
  if (merged.instructions == null && typeof envelope.instructions === 'string') {
    merged.instructions = envelope.instructions;
  }
  if (merged.hint == null && typeof envelope.hint === 'string') {
    merged.hint = envelope.hint;
  }
  if (merged.requestId == null && typeof envelope.requestId !== 'undefined') {
    merged.requestId = (envelope.requestId as string | null) ?? null;
  }
  return merged;
};

export const normalizeAdminAccessPayload = (
  raw: AdminAccessPayload | EnvelopeLike | null | undefined,
): AdminAccessPayload | null => {
  if (!raw) {
    return null;
  }
  if (isObjectLike(raw) && Object.prototype.hasOwnProperty.call(raw, 'data')) {
    const envelope = raw as EnvelopeLike;
    const normalizedInner = normalizeAdminAccessPayload(envelope.data ?? null);
    if (!normalizedInner) {
      return null;
    }
    return mergeEnvelopeMeta(normalizedInner, envelope);
  }
  if (!isObjectLike(raw)) {
    return null;
  }
  return raw as AdminAccessPayload;
};
