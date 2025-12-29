/**
 * Secure Storage System
 * Encrypted sessionStorage to replace insecure localStorage for sensitive data
 */

import CryptoJS from 'crypto-js';

// ============================================================================
// Configuration
// ============================================================================

// In production, this should be an environment variable
// For now, generate a unique key per session
const getEncryptionKey = (): string => {
  // Check if we have a session key
  let sessionKey = sessionStorage.getItem('_sk');
  
  if (!sessionKey) {
    // Generate a new session key
    sessionKey = CryptoJS.lib.WordArray.random(32).toString();
    sessionStorage.setItem('_sk', sessionKey);
  }
  
  return sessionKey;
};

const STORAGE_PREFIX = 'secure_';

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
}

export interface UserSession {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
}

/**
 * Store data securely in sessionStorage with encryption
 */
export function secureSet(key: string, value: any): void {
  try {
    const stringified = JSON.stringify(value);
    const encrypted = encrypt(stringified);
    sessionStorage.setItem(STORAGE_PREFIX + key, encrypted);
  } catch (error) {
    console.error('Failed to securely store data:', error);
  }
}

/**
 * Retrieve and decrypt data from sessionStorage
 */
export function secureGet<T>(key: string): T | null {
  try {
    const encrypted = sessionStorage.getItem(STORAGE_PREFIX + key);
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
  sessionStorage.removeItem(STORAGE_PREFIX + key);
}

/**
 * Clear all secure storage
 */
export function secureClear(): void {
  // Only clear items with our prefix
  const keys = Object.keys(sessionStorage);
  keys.forEach(key => {
    if (key.startsWith(STORAGE_PREFIX)) {
      sessionStorage.removeItem(key);
    }
  });
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

// ============================================================================
// Migration from localStorage
// ============================================================================

/**
 * Migrate data from insecure localStorage to secure storage
 */
export function migrateFromLocalStorage(): void {
  try {
    // Migrate user data
    const oldUser = localStorage.getItem('user');
    if (oldUser) {
      const userData = JSON.parse(oldUser);
      setUserSession(userData);
      localStorage.removeItem('user');
      console.log('✅ Migrated user data to secure storage');
    }
    
    // Remove legacy auth token storage entirely
    const oldToken = localStorage.getItem('authToken');
    if (oldToken) {
      setAccessToken(oldToken);
      localStorage.removeItem('authToken');
      console.log('✅ Migrated legacy auth token to secure storage');
    }

    const oldRefreshToken = localStorage.getItem('refreshToken');
    if (oldRefreshToken) {
      setRefreshToken(oldRefreshToken);
      localStorage.removeItem('refreshToken');
      console.log('✅ Migrated legacy refresh token to secure storage');
    }
    
    // Clear any other sensitive data patterns
    const sensitivePatterns = ['token', 'auth', 'password', 'session', 'secret'];
    Object.keys(localStorage).forEach(key => {
      if (sensitivePatterns.some(pattern => key.toLowerCase().includes(pattern))) {
        console.warn(`⚠️ Removing potentially sensitive data from localStorage: ${key}`);
        localStorage.removeItem(key);
      }
    });
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
  
  Object.keys(localStorage).forEach(key => {
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

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if secure storage is available
 */
export function isSecureStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get storage size (for monitoring)
 */
export function getStorageSize(): { bytes: number; items: number } {
  let bytes = 0;
  let items = 0;
  
  Object.keys(sessionStorage).forEach(key => {
    if (key.startsWith(STORAGE_PREFIX)) {
      const value = sessionStorage.getItem(key);
      if (value) {
        bytes += key.length + value.length;
        items++;
      }
    }
  });
  
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
  
  return Object.keys(sessionStorage)
    .filter(key => key.startsWith(STORAGE_PREFIX))
    .map(key => key.replace(STORAGE_PREFIX, ''));
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
// Initialize on Import
// ============================================================================

// Run security check on import
if (import.meta.env.DEV) {
  checkStorageSecurity();
}
