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
const getEncryptionKey = () => {
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
function encrypt(data) {
    const key = getEncryptionKey();
    return CryptoJS.AES.encrypt(data, key).toString();
}
function decrypt(ciphertext) {
    try {
        const key = getEncryptionKey();
        const bytes = CryptoJS.AES.decrypt(ciphertext, key);
        return bytes.toString(CryptoJS.enc.Utf8);
    }
    catch (error) {
        console.error('Decryption failed:', error);
        return null;
    }
}
/**
 * Store data securely in sessionStorage with encryption
 */
export function secureSet(key, value) {
    try {
        const stringified = JSON.stringify(value);
        const encrypted = encrypt(stringified);
        sessionStorage.setItem(STORAGE_PREFIX + key, encrypted);
    }
    catch (error) {
        console.error('Failed to securely store data:', error);
    }
}
/**
 * Retrieve and decrypt data from sessionStorage
 */
export function secureGet(key) {
    try {
        const encrypted = sessionStorage.getItem(STORAGE_PREFIX + key);
        if (!encrypted)
            return null;
        const decrypted = decrypt(encrypted);
        if (!decrypted)
            return null;
        return JSON.parse(decrypted);
    }
    catch (error) {
        console.error('Failed to retrieve secure data:', error);
        return null;
    }
}
/**
 * Remove data from secure storage
 */
export function secureRemove(key) {
    sessionStorage.removeItem(STORAGE_PREFIX + key);
}
/**
 * Clear all secure storage
 */
export function secureClear() {
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
const AUTH_TOKENS_KEY = 'auth_tokens';
const USER_SESSION_KEY = 'user_session';
/**
 * Store authentication tokens
 */
export function setAuthTokens(tokens) {
    secureSet(AUTH_TOKENS_KEY, tokens);
}
/**
 * Get authentication tokens
 */
export function getAuthTokens() {
    return secureGet(AUTH_TOKENS_KEY);
}
/**
 * Get access token
 */
export function getAccessToken() {
    const tokens = getAuthTokens();
    return tokens?.accessToken || null;
}
/**
 * Check if access token is expired
 */
export function isTokenExpired() {
    const tokens = getAuthTokens();
    if (!tokens)
        return true;
    // Add 1 minute buffer
    return Date.now() >= (tokens.expiresAt - 60000);
}
/**
 * Clear authentication tokens
 */
export function clearAuthTokens() {
    secureRemove(AUTH_TOKENS_KEY);
}
/**
 * Store user session data
 */
export function setUserSession(user) {
    secureSet(USER_SESSION_KEY, user);
}
/**
 * Get user session data
 */
export function getUserSession() {
    return secureGet(USER_SESSION_KEY);
}
/**
 * Clear user session
 */
export function clearUserSession() {
    secureRemove(USER_SESSION_KEY);
}
/**
 * Clear all auth data
 */
export function clearAuth() {
    clearAuthTokens();
    clearUserSession();
}
// ============================================================================
// Migration from localStorage
// ============================================================================
/**
 * Migrate data from insecure localStorage to secure storage
 */
export function migrateFromLocalStorage() {
    try {
        // Migrate user data
        const oldUser = localStorage.getItem('user');
        if (oldUser) {
            const userData = JSON.parse(oldUser);
            setUserSession(userData);
            localStorage.removeItem('user');
            console.log('✅ Migrated user data to secure storage');
        }
        // Migrate auth token
        const oldToken = localStorage.getItem('authToken');
        if (oldToken) {
            const tokens = {
                accessToken: oldToken,
                expiresAt: Date.now() + (24 * 60 * 60 * 1000), // Default 24 hours
            };
            setAuthTokens(tokens);
            localStorage.removeItem('authToken');
            console.log('✅ Migrated auth token to secure storage');
        }
        // Clear any other sensitive data patterns
        const sensitivePatterns = ['token', 'auth', 'password', 'session', 'secret'];
        Object.keys(localStorage).forEach(key => {
            if (sensitivePatterns.some(pattern => key.toLowerCase().includes(pattern))) {
                console.warn(`⚠️ Removing potentially sensitive data from localStorage: ${key}`);
                localStorage.removeItem(key);
            }
        });
    }
    catch (error) {
        console.error('Migration failed:', error);
    }
}
// ============================================================================
// Storage Monitoring
// ============================================================================
/**
 * Check if there's sensitive data in localStorage (security audit)
 */
export function auditLocalStorage() {
    const warnings = [];
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
export function checkStorageSecurity() {
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
export function isSecureStorageAvailable() {
    try {
        const test = '__storage_test__';
        sessionStorage.setItem(test, test);
        sessionStorage.removeItem(test);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Get storage size (for monitoring)
 */
export function getStorageSize() {
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
export function listSecureKeys() {
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
export function exportSecureData() {
    if (import.meta.env.PROD) {
        console.warn('exportSecureData is disabled in production');
        return {};
    }
    const data = {};
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
