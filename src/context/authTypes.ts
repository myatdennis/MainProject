import type { RefreshReason } from './surfaceAccess';

export interface RefreshOptions {
  reason?: RefreshReason;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  errorType?: 'invalid_credentials' | 'network_error' | 'validation_error' | 'unknown_error' | 'supabase_auth_error';
  mfaRequired?: boolean;
  mfaEmail?: string;
}

export type RegisterField = 'email' | 'password' | 'confirmPassword' | 'firstName' | 'lastName' | 'organizationId';

export interface RegisterInput {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
}

export interface RegisterResult extends LoginResult {
  fieldErrors?: Partial<Record<RegisterField, string>>;
}
