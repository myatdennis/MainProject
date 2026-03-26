/**
 * authBootstrapState — module-level flag that tracks whether auth bootstrap
 * is currently in progress.
 *
 * Problem it solves:
 *   apiClient.handleAuthFailure() calls window.location.replace() on ANY 401.
 *   If a 401 arrives while SecureAuthContext is still running runBootstrap()
 *   (e.g. from a courseStore.init() that fires before the session cookie is
 *   confirmed), the redirect fires before the session is ever resolved,
 *   sending the user to the login page for no reason.
 *
 * Solution:
 *   SecureAuthContext writes `setAuthBootstrapping(true)` when it starts
 *   runBootstrap and `setAuthBootstrapping(false)` when it finishes.
 *   apiClient reads `isAuthBootstrapping()` in handleAuthFailure and defers
 *   the hard redirect until bootstrap completes.
 *
 * This is intentionally a plain module — no React, no circular deps.
 */

let _bootstrapping = true; // conservative default: assume booting until context says otherwise

/** Returns true while SecureAuthContext.runBootstrap() is in progress. */
export function isAuthBootstrapping(): boolean {
  return _bootstrapping;
}

/** Called by SecureAuthContext immediately before/after runBootstrap(). */
export function setAuthBootstrapping(value: boolean): void {
  _bootstrapping = value;
  if (import.meta.env?.DEV) {
    console.debug('[authBootstrapState]', value ? 'BOOTSTRAPPING' : 'SETTLED', Date.now());
  }
}
