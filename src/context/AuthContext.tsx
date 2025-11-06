/**
 * LEGACY COMPATIBILITY LAYER
 * This file re-exports from SecureAuthContext for backward compatibility.
 * All new code should import from SecureAuthContext directly.
 * 
 * @deprecated Use SecureAuthContext instead
 */

import { 
  SecureAuthProvider,
  useSecureAuth
} from './SecureAuthContext';

// Re-export the hook with the old name for backward compatibility
export const useAuth = useSecureAuth;

// Re-export the provider with the old name
export const AuthProvider = SecureAuthProvider;
