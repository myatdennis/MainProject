/**
 * Secure Storage System
 * Encrypted sessionStorage to replace insecure localStorage for sensitive data
 */

import CryptoJS from 'crypto-js';

// ============================================================================
// Storage Helpers
// ============================================================================

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(index: number): string | null;
  readonly length: number;
};

const memoryStorage = new Map<string, string>();

const memoryStorageAdapter: StorageLike = {
  get length() {
    return memoryStorage.size;
  },
  clear() {
    memoryStorage.clear();
  },
  getItem(key) {
    return memoryStorage.has(key) ? memoryStorage.get(key)! : null;
  },
  key(index) {
    const keys = Array.from(memoryStorage.keys());
    return keys[index] ?? null;
  },
  removeItem(key) {
    memoryStorage.delete(key);
  },
  setItem(key, value) {
    memoryStorage.set(key, value);
  },
};

const warn = (message: string, error?: unknown) => {
  if (typeof console === 'undefined') return;
  if (error && error instanceof Error) {
    console.warn(message, error.message);
  } else {
    console.warn(message);
  }
};

let warnedFallback = false;
let warnedSessionUnavailable = false;

const getBrowserSessionStorage = (): StorageLike | null => {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return null;
  }
  try {
    const testKey = '__secure_storage_probe__';
    window.sessionStorage.setItem(testKey, testKey);
    window.sessionStorage.removeItem(testKey);
    return window.sessionStorage;
  } catch (error) {
    if (!warnedSessionUnavailable) {
      warn('[secureStorage] sessionStorage is not accessible; falling back to in-memory storage.', error);
      warnedSessionUnavailable = true;
    }
    return null;
  }
};

const getStorage = (): StorageLike => {
  const storage = getBrowserSessionStorage();
  if (storage) {
    return storage;
  }
  if (!warnedFallback) {
    warn('[secureStorage] Using in-memory storage fallback. Data will be cleared on reload.');
    warnedFallback = true;
  }
  return memoryStorageAdapter;
};

// ============================================================================
// Configuration
// ============================================================================

// In production, this should be an environment variable
// For now, generate a unique key per session
const SESSION_KEY_NAME = '_sk';

const getEncryptionKey = (): string => {
  const storage = getStorage();
  let sessionKey = storage.getItem(SESSION_KEY_NAME);

  if (!sessionKey) {
    // Generate a new session key
    sessionKey = CryptoJS.lib.WordArray.random(32).toString();
    try {
      storage.setItem(SESSION_KEY_NAME, sessionKey);
    } catch (error) {
      warn('[secureStorage] Failed to persist session key.', error);
    }
  }

  return sessionKey;
};

const STORAGE_PREFIX = 'secure_';
const ACTIVE_ORG_PREFERENCE_KEY = 'active_org_preference';
const LOCAL_STORAGE_GUARD_FLAG = '__secure_storage_guard_installed__';
const BLOCKED_LOCAL_STORAGE_PATTERNS = [
  /token/i,
  /auth/i,
  /session/i,
  /secret/i,
  /password/i,
  /huddle_user/i,
  /huddle_active_org/i,
  /huddle_org_profiles/i,
  /huddle_user_profiles/i,
  /huddle_orgs/i,
];

// ============================================================================
// Encryption/Decryption
// ============================================================================

function encrypt(data: string): string {
  const key = getEncryptionKey();
  return CryptoJS.AES.encrypt(data, key).toString();
}

function decrypt(ciphertext: string): string | null {
  try {
    const key = getEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

// ============================================================================
// Secure Storage Interface
// ============================================================================

export interface SessionMetadata {
  accessExpiresAt?: number;
  refreshExpiresAt?: number;
  accessIssuedAt?: number;
  refreshIssuedAt?: number;
  sessionVersion?: string | null;
}

export interface UserMembership {
  orgId: string;
  organizationId?: string;
  role?: string | null;
  status?: string | null;
  organizationName?: string | null;
  organizationStatus?: string | null;
  subscription?: string | null;
  features?: Record<string, unknown> | null;
  acceptedAt?: string | null;
  lastSeenAt?: string | null;
}

export interface UserSession {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string | null;
  organizationIds?: string[];
  memberships?: UserMembership[];
  activeOrgId?: string | null;
  platformRole?: string | null;
  isPlatformAdmin?: boolean;
  appMetadata?: Record<string, unknown> | null;
  userMetadata?: Record<string, unknown> | null;
}

/**
 * Store data securely in sessionStorage with encryption
 */
export function secureSet(key: string, value: any): void {
  try {
    const stringified = JSON.stringify(value);
    const encrypted = encrypt(stringified);
    getStorage().setItem(STORAGE_PREFIX + key, encrypted);
  } catch (error) {
    console.error('Failed to securely store data:', error);
  }
}

/**
 * Retrieve and decrypt data from sessionStorage
 */
export function secureGet<T>(key: string): T | null {
  try {
    const encrypted = getStorage().getItem(STORAGE_PREFIX + key);
    if (!encrypted) return null;
    
    const decrypted = decrypt(encrypted);
    if (!decrypted) return null;
    
    return JSON.parse(decrypted) as T;
  } catch (error) {
    console.error('Failed to retrieve secure data:', error);
    return null;
  }
}

/**
 * Remove data from secure storage
 */
export function secureRemove(key: string): void {
  getStorage().removeItem(STORAGE_PREFIX + key);
}

/**
 * Clear all secure storage
 */
export function secureClear(): void {
  // Only clear items with our prefix
  const storage = getStorage();
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => storage.removeItem(key));
  storage.removeItem(SESSION_KEY_NAME);
}

// ============================================================================
// Auth-Specific Storage
// ============================================================================

const SESSION_METADATA_KEY = 'session_metadata';
const USER_SESSION_KEY = 'user_session';
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// ============================================================================
// Token Helpers
// ============================================================================

export function setAccessToken(token: string | null): void {
  if (!token) {
    secureRemove(ACCESS_TOKEN_KEY);
    return;
  }
  secureSet(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
  return secureGet<string>(ACCESS_TOKEN_KEY);
}

export function clearAccessToken(): void {
  secureRemove(ACCESS_TOKEN_KEY);
}

export function setRefreshToken(token: string | null): void {
  if (!token) {
    secureRemove(REFRESH_TOKEN_KEY);
    return;
  }
  secureSet(REFRESH_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return secureGet<string>(REFRESH_TOKEN_KEY);
}

export function clearRefreshToken(): void {
  secureRemove(REFRESH_TOKEN_KEY);
}

export function setSessionMetadata(metadata: SessionMetadata): void {
  const existing = getSessionMetadata() || {};
  secureSet(SESSION_METADATA_KEY, { ...existing, ...metadata });
}

export function getSessionMetadata(): SessionMetadata | null {
  return secureGet<SessionMetadata>(SESSION_METADATA_KEY);
}

export function clearSessionMetadata(): void {
  secureRemove(SESSION_METADATA_KEY);
}

/**
 * Store user session data
 */
export function setUserSession(user: UserSession): void {
  secureSet(USER_SESSION_KEY, user);
}

/**
 * Get user session data
 */
export function getUserSession(): UserSession | null {
  return secureGet<UserSession>(USER_SESSION_KEY);
}

/**
 * Clear user session
 */
export function clearUserSession(): void {
  secureRemove(USER_SESSION_KEY);
}

/**
 * Clear all auth data
 */
export function clearAuth(): void {
  clearSessionMetadata();
  clearUserSession();
  clearAccessToken();
  clearRefreshToken();
}

export function setActiveOrgPreference(orgId: string | null): void {
  if (!orgId) {
    secureRemove(ACTIVE_ORG_PREFERENCE_KEY);
    return;
  }
  secureSet(ACTIVE_ORG_PREFERENCE_KEY, orgId);
}

export function getActiveOrgPreference(): string | null {
  return secureGet<string>(ACTIVE_ORG_PREFERENCE_KEY);
}

export function clearActiveOrgPreference(): void {
  secureRemove(ACTIVE_ORG_PREFERENCE_KEY);
}

// ============================================================================
// Migration from localStorage
// ============================================================================

/**
 * Migrate data from insecure localStorage to secure storage
 */
export function migrateFromLocalStorage(): void {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return;
    }
    const removedKeys: string[] = [];
    // Migrate user data
    const oldUser = window.localStorage.getItem('user');
    if (oldUser) {
      const userData = JSON.parse(oldUser);
      setUserSession(userData);
      window.localStorage.removeItem('user');
      removedKeys.push('user');
      console.log('✅ Migrated user data to secure storage');
    }
    const legacyHuddleUser = window.localStorage.getItem('huddle_user');
    if (legacyHuddleUser) {
      try {
        const parsed = JSON.parse(legacyHuddleUser) as Record<string, any>;
        if (parsed && typeof parsed === 'object') {
          const normalized: UserSession = {
            id: String(parsed.id ?? parsed.userId ?? `legacy-${Date.now()}`),
            email: String(parsed.email ?? parsed.username ?? 'legacy@demo.local'),
            role: String(parsed.role ?? parsed.platformRole ?? 'member'),
            firstName: parsed.firstName ?? parsed.givenName ?? parsed.name ?? undefined,
            lastName: parsed.lastName ?? parsed.familyName ?? undefined,
            organizationId: parsed.organizationId ?? parsed.orgId ?? null,
            organizationIds: Array.isArray(parsed.organizationIds)
              ? parsed.organizationIds.map((value: any) => String(value))
              : undefined,
            memberships: Array.isArray(parsed.memberships)
              ? (parsed.memberships as UserMembership[])
              : undefined,
            activeOrgId: parsed.activeOrgId ?? parsed.organizationId ?? null,
            platformRole: parsed.platformRole ?? parsed.role ?? null,
            isPlatformAdmin: Boolean(parsed.isPlatformAdmin || parsed.role === 'admin'),
            appMetadata: parsed.appMetadata ?? null,
            userMetadata: parsed.userMetadata ?? null,
          };
          setUserSession(normalized);
        }
      } catch (error) {
        console.warn('[secureStorage] Failed to migrate legacy huddle_user entry:', error);
      }
      window.localStorage.removeItem('huddle_user');
      removedKeys.push('huddle_user');
      console.log('✅ Migrated legacy huddle_user data to secure storage');
    }
    
    // Remove legacy auth token storage entirely
    const oldToken = window.localStorage.getItem('authToken');
    if (oldToken) {
      setAccessToken(oldToken);
      window.localStorage.removeItem('authToken');
      removedKeys.push('authToken');
      console.log('✅ Migrated legacy auth token to secure storage');
    }

    const oldRefreshToken = window.localStorage.getItem('refreshToken');
    if (oldRefreshToken) {
      setRefreshToken(oldRefreshToken);
      window.localStorage.removeItem('refreshToken');
      removedKeys.push('refreshToken');
      console.log('✅ Migrated legacy refresh token to secure storage');
    }

    const legacyActiveOrg = window.localStorage.getItem('huddle_active_org');
    if (legacyActiveOrg) {
      setActiveOrgPreference(legacyActiveOrg);
      window.localStorage.removeItem('huddle_active_org');
      removedKeys.push('huddle_active_org');
      console.log('✅ Migrated active organization preference to secure storage');
    }

    ['huddle_user_profiles_v1', 'huddle_org_profiles_v1', 'huddle_orgs_v1'].forEach((key) => {
      if (window.localStorage.getItem(key) !== null) {
        window.localStorage.removeItem(key);
        removedKeys.push(key);
        console.log(`🧹 Removed legacy profile cache from localStorage: ${key}`);
      }
    });
    
    // Clear any other sensitive data patterns
    const sensitivePatterns = ['token', 'auth', 'password', 'session', 'secret'];
    Object.keys(window.localStorage).forEach(key => {
      if (sensitivePatterns.some(pattern => key.toLowerCase().includes(pattern))) {
        console.warn(`⚠️ Removing potentially sensitive data from localStorage: ${key}`);
        window.localStorage.removeItem(key);
        removedKeys.push(key);
      }
    });
    if (removedKeys.length > 0) {
      console.log('[secureStorage] Cleared sensitive localStorage entries:', removedKeys);
    }
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// ============================================================================
// Storage Monitoring
// ============================================================================

/**
 * Check if there's sensitive data in localStorage (security audit)
 */
export function auditLocalStorage(): string[] {
  const warnings: string[] = [];
  const sensitivePatterns = ['token', 'auth', 'password', 'session', 'secret', 'user'];
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return warnings;
  }

  Object.keys(window.localStorage).forEach(key => {
    if (sensitivePatterns.some(pattern => key.toLowerCase().includes(pattern))) {
      warnings.push(key);
    }
  });

  return warnings;
}

/**
 * Log security warnings
 */
export function checkStorageSecurity(): void {
  const warnings = auditLocalStorage();
  if (warnings.length > 0) {
    console.warn('⚠️ SECURITY WARNING: Sensitive data detected in localStorage:', warnings);
    console.warn('Consider migrating to secure storage with migrateFromLocalStorage()');
  }
}

export function installLocalStorageGuards(): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  if ((window as any)[LOCAL_STORAGE_GUARD_FLAG]) {
    return;
  }
  const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
  window.localStorage.setItem = (key: string, value: string) => {
    if (BLOCKED_LOCAL_STORAGE_PATTERNS.some((pattern) => pattern.test(key))) {
      const message = `[secureStorage] Blocked attempt to write sensitive key "${key}" to localStorage. Use secureStorage utilities instead.`;
      console.error(message);
      throw new Error(message);
    }
    return originalSetItem(key, value);
  };
  (window as any)[LOCAL_STORAGE_GUARD_FLAG] = true;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if secure storage is available
 */
export function isSecureStorageAvailable(): boolean {
  return getBrowserSessionStorage() !== null;
}

/**
 * Get storage size (for monitoring)
 */
export function getStorageSize(): { bytes: number; items: number } {
  let bytes = 0;
  let items = 0;
  const storage = getStorage();
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      const value = storage.getItem(key);
      if (value) {
        bytes += key.length + value.length;
        items += 1;
      }
    }
  }

  return { bytes, items };
}

// ============================================================================
// Development Helpers
// ============================================================================

/**
 * List all secure storage keys (development only)
 */
export function listSecureKeys(): string[] {
  if (import.meta.env.PROD) {
    console.warn('listSecureKeys is disabled in production');
    return [];
  }

  const storage = getStorage();
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      keys.push(key.replace(STORAGE_PREFIX, ''));
    }
  }
  return keys;
}

/**
 * Export all secure data (development only - for debugging)
 */
export function exportSecureData(): Record<string, any> {
  if (import.meta.env.PROD) {
    console.warn('exportSecureData is disabled in production');
    return {};
  }
  
  const data: Record<string, any> = {};
  const keys = listSecureKeys();
  
  keys.forEach(key => {
    data[key] = secureGet(key);
  });
  
  return data;
}

// ============================================================================
// Test Utilities (not for production use)
// ============================================================================

export function __dangerouslyResetSecureStorageStateForTests(): void {
  memoryStorage.clear();
  warnedFallback = false;
  warnedSessionUnavailable = false;

  const storage = getBrowserSessionStorage();
  if (storage) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && (key.startsWith(STORAGE_PREFIX) || key === SESSION_KEY_NAME)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => storage.removeItem(key));
  }
}

// ============================================================================
// Initialize on Import
// ============================================================================

// Run security check on import
if (import.meta.env.DEV) {
  checkStorageSecurity();
}
