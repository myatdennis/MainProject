import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useSecureAuth } from '../../context/SecureAuthContext';
import { Shield, Lock, Mail, Eye, EyeOff, AlertTriangle, Info, ShieldCheck, Activity, LifeBuoy } from 'lucide-react';
import { loginSchema, emailSchema } from '../../utils/validators';
import { sanitizeText } from '../../utils/sanitize';
import useRuntimeStatus from '../../hooks/useRuntimeStatus';
import type { RuntimeStatus } from '../../state/runtimeStatus';
import apiRequest, { ApiError } from '../../utils/apiClient';
import { getAccessToken } from '../../lib/secureStorage';

interface AdminCapabilityResponse {
  user?: Record<string, any>;
  access?: {
    allowed?: boolean;
    reason?: string | null;
  };
  error?: string;
  message?: string;
}

interface CapabilityCheckResult {
  allowed: boolean;
  user?: Record<string, any>;
  reason?: string;
}


const AdminLogin: React.FC = () => {
  const { login, isAuthenticated, forgotPassword, authInitializing, verifyMfa } = useSecureAuth();
  const runtimeStatus = useRuntimeStatus();
  const supabaseReady = runtimeStatus.supabaseConfigured && runtimeStatus.supabaseHealthy;
  const [email, setEmail] = useState('mya@the-huddle.co');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaEmail, setMfaEmail] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [authError, setAuthError] = useState('');
  const [capabilityFallbackActive, setCapabilityFallbackActive] = useState(false);
  const [capabilityRetrying, setCapabilityRetrying] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const landingLogRef = useRef(false);

  const landingTarget = useMemo(() => {
    let rawReturnTo: string | null = null;
    let chosenTarget = '/admin/courses';

    try {
      const params = new URLSearchParams(location.search);
      rawReturnTo = params.get('returnTo');
    } catch (error) {
      console.warn('[AdminLogin] failed to parse returnTo param', error);
    }

    const sanitizedReturnTo = rawReturnTo && rawReturnTo.startsWith('/admin/') && !rawReturnTo.startsWith('/admin/login')
      ? rawReturnTo
      : null;

    if (sanitizedReturnTo) {
      chosenTarget = sanitizedReturnTo;
    }

    return { rawReturnTo, chosenTarget };
  }, [location.search]);

  const navigateToAdminLanding = useCallback(
    (options?: { replace?: boolean }) => {
      if (!landingLogRef.current && import.meta.env.DEV) {
        console.info('[AdminLogin] admin_login_landing', {
          returnTo: landingTarget.rawReturnTo,
          chosenTarget: landingTarget.chosenTarget,
        });
      }
      landingLogRef.current = true;
      navigate(landingTarget.chosenTarget, { replace: true, ...(options ?? {}) });
    },
    [landingTarget, navigate],
  );

  useEffect(() => {
    if (isAuthenticated.admin) {
      navigateToAdminLanding({ replace: true });
    }
  }, [isAuthenticated.admin, navigateToAdminLanding]);

  const capabilityErrorMessage = (reason?: string) => {
    switch (reason) {
      case 'admin_capability_error':
        return 'We could not confirm your admin access. Please try again or contact support.';
      case 'org_admin_required':
      case 'not_authorized':
      default:
        return 'Your account is not authorized for the Admin Portal.';
    }
  };

  const verifyAdminCapability = async (): Promise<CapabilityCheckResult> => {
    try {
      const response = await apiRequest<AdminCapabilityResponse>('/api/admin/me');
      if (response?.access?.allowed) {
        return { allowed: true, user: response.user };
      }
      const reason = response?.access?.reason || response?.error || response?.message || 'not_authorized';
      return { allowed: false, reason };
    } catch (capabilityError) {
      let fallbackReason = 'admin_capability_error';
      if (capabilityError instanceof ApiError) {
        const body = capabilityError.body as AdminCapabilityResponse | undefined;
        fallbackReason = body?.access?.reason || body?.error || body?.message || fallbackReason;
      }
      console.warn('[AdminLogin] capability check failed, falling back to session endpoint', capabilityError);
      try {
        const hasStoredToken = Boolean(getAccessToken());
        const fallback = await apiRequest<{ user?: Record<string, any> }>('/api/auth/session', {
          requireAuth: hasStoredToken,
          allowAnonymous: !hasStoredToken,
        });
        const user = fallback?.user;
        if (user?.isPlatformAdmin) {
          return { allowed: true, user };
        }
        return { allowed: false, reason: fallbackReason };
      } catch (sessionError) {
        console.error('[AdminLogin] capability fallback failed', sessionError);
      }
      return { allowed: false, reason: 'admin_capability_error' };
    }
  };

  const statusBadgeCopy: Record<RuntimeStatus['statusLabel'], { label: string; description: string }> = {
    ok: {
      label: 'Operational',
      description: 'Supabase connection verified. Live production data.',
    },
    degraded: {
      label: 'Degraded',
      description: 'We detected slower connectivity. Expect brief delays during sign-in.',
    },
    'demo-fallback': {
      label: 'Demo safeguards',
      description: 'Running with limited write access while the platform is in demo mode.',
    },
    unknown: {
      label: 'Status unknown',
      description: 'Checking backend health. You can continue with demo credentials.',
    },
  };

  const getStatusBadgeClass = (status: RuntimeStatus['statusLabel']) => {
    switch (status) {
      case 'ok':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'degraded':
        return 'bg-amber-50 text-amber-700 border border-amber-100';
      case 'demo-fallback':
        return 'bg-skyblue/10 text-skyblue border border-skyblue/30';
      default:
        return 'bg-gray-100 text-gray border border-gray-200';
    }
  };

  const trustSignals = [
    {
      icon: ShieldCheck,
      title: 'Multi-factor enforced',
      description: 'Every admin session requires a one-time verification code.',
    },
    {
      icon: Activity,
      title: 'Monitored changes',
      description: 'Course, invite, and org updates are logged for audit readiness.',
    },
    {
      icon: LifeBuoy,
      title: 'Concierge support',
      description: 'Need a new admin seat? We respond to access requests within 1 business day.',
    },
  ];

  const handleCapabilityGate = useCallback(async () => {
    setCapabilityFallbackActive(false);
    const capability = await verifyAdminCapability();
    if (capability.allowed) {
      navigateToAdminLanding({ replace: true });
      return true;
    }
    if (capability.reason === 'admin_capability_error') {
      setAuthError('We couldn’t confirm admin access due to a network issue.');
      setCapabilityFallbackActive(true);
      return false;
    }
    setAuthError(capabilityErrorMessage(capability.reason));
    return false;
  }, [navigateToAdminLanding, verifyAdminCapability, capabilityErrorMessage]);

  const handleRetryCapability = useCallback(async () => {
    setCapabilityRetrying(true);
    try {
      await handleCapabilityGate();
    } finally {
      setCapabilityRetrying(false);
    }
  }, [handleCapabilityGate]);

  const handleRefreshPage = () => {
    window.location.reload();
  };

  const handleContinueToDashboard = () => {
    navigateToAdminLanding({ replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setValidationErrors({});
    setAuthError('');
    setCapabilityFallbackActive(false);

    // Validate inputs
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const errors: { email?: string; password?: string } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === 'email') errors.email = err.message;
        if (err.path[0] === 'password') errors.password = err.message;
      });
      setValidationErrors(errors);
      setIsLoading(false);
      return;
    }

    // Sanitize inputs before sending
    const sanitizedEmail = sanitizeText(email);
    const sanitizedPassword = sanitizeText(password);

    let result;
    try {
      result = await login(sanitizedEmail, sanitizedPassword, 'admin');
    } catch (loginError) {
      console.warn('[AdminLogin] login request failed', loginError);
      if (loginError instanceof ApiError) {
        if (loginError.status === 401) {
          setError('Invalid email or password. Please try again.');
        } else if (loginError.status === 403) {
          setAuthError('Your account is not authorized for the Admin Portal.');
        } else {
          const friendlyMessage =
            (loginError.body as { message?: string } | undefined)?.message || 'Unable to sign in right now.';
          setError(friendlyMessage);
        }
      } else {
        setError('Something went wrong—try again.');
      }
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
    if (result.success) {
      await handleCapabilityGate();
    } else if (result.mfaRequired) {
      setMfaRequired(true);
      setMfaEmail(result.mfaEmail || sanitizedEmail);
      setError('');
    } else {
      setError(result.error || 'Authentication failed.');
    }
  };

  if (authInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-softwhite">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sunrise mx-auto mb-4"></div>
          <h2 className="text-h2 font-heading text-charcoal mb-2">Initializing authentication...</h2>
          <p className="text-body text-gray">Please wait while we check your authentication status.</p>
        </div>
      </div>
    );
  }

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMfaError('');
    const ok = await verifyMfa(mfaEmail, mfaCode);
    setIsLoading(false);
    if (ok) {
      // Try login again with MFA code
      setIsLoading(true);
      const result = await login(mfaEmail, password, 'admin', mfaCode);
      setIsLoading(false);
      if (result.success) {
        const allowed = await handleCapabilityGate();
        if (allowed) {
          setMfaRequired(false);
          setMfaCode('');
        }
      } else {
        setMfaError(result.error || 'Login failed after MFA.');
      }
    } else {
      setMfaError('Invalid MFA code. Please try again.');
    }
  };

  const handleForgot = async () => {
    if (!email) return setError('Enter your email to reset password');
    
    // Validate email
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      setError(validation.error.errors[0]?.message || 'Invalid email address');
      return;
    }
    
    setIsLoading(true);
    const ok = await forgotPassword(email);
    setIsLoading(false);
    if (ok) setError('Password reset sent — check your email');
    else setError('Failed to send reset email');
  };

  return (
    <div className="min-h-screen bg-softwhite flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="bg-sunrise p-3 rounded-xl shadow-card">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div className="text-left">
              <span className="font-heading text-h2 text-charcoal">Admin Portal</span>
              <p className="text-small text-gray">The Huddle Co.</p>
            </div>
          </div>
          <h2 className="text-h1 font-heading text-charcoal mb-2">Secure Access</h2>
          <p className="text-body text-gray">
            Program operations, enrollment leads, and facilitators sign in here to manage org-wide learning.
          </p>
          <p className="mt-3 text-small text-gray">
            Learners should continue to the{' '}
            <Link to="/lms/login" className="text-skyblue underline-offset-2 hover:underline">
              learning portal
            </Link>
            .
          </p>
        </div>

        <div className="card">
          {(error || authError) && (
            <div className="mb-6 p-4 bg-deepred/10 border border-deepred rounded-lg" role="alert">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-deepred" />
                <span className="text-deepred text-small">{authError || error}</span>
              </div>
              {capabilityFallbackActive && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg bg-sunrise text-charcoal font-semibold px-4 py-2 text-sm transition hover:brightness-95 disabled:opacity-70"
                    onClick={handleRetryCapability}
                    disabled={capabilityRetrying}
                  >
                    {capabilityRetrying ? 'Retrying…' : 'Retry'}
                  </button>
                  {isAuthenticated.admin ? (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-lg border border-slate text-charcoal px-4 py-2 text-sm hover:bg-slate/10"
                      onClick={handleContinueToDashboard}
                    >
                      Continue to dashboard
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-lg border border-slate text-charcoal px-4 py-2 text-sm hover:bg-slate/10"
                      onClick={handleRefreshPage}
                    >
                      Refresh page
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mb-6 rounded-2xl border border-mist/60 bg-softwhite/60 p-4 shadow-card-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-small font-heading text-charcoal">Platform health</p>
                <p className="text-small text-gray">
                  {supabaseReady
                    ? statusBadgeCopy.ok.description
                    : runtimeStatus.demoModeEnabled
                      ? statusBadgeCopy['demo-fallback'].description
                      : statusBadgeCopy[runtimeStatus.statusLabel].description}
                </p>
                {runtimeStatus.lastChecked && (
                  <p className="mt-1 text-xs text-gray">
                    Last verified {new Date(runtimeStatus.lastChecked).toLocaleTimeString()}
                  </p>
                )}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(runtimeStatus.statusLabel)}`}>
                {statusBadgeCopy[runtimeStatus.statusLabel].label}
              </span>
            </div>

            {!supabaseReady && !runtimeStatus.demoModeEnabled && (
              <p className="mt-3 flex items-start gap-2 text-small text-amber-700">
                <Info className="mt-0.5 h-4 w-4" />
                We&apos;re reconnecting to Supabase. Stay on this page or use the demo credentials below while we finish syncing.
              </p>
            )}

            <div className="mt-4 grid gap-3">
              {trustSignals.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex items-start gap-3 rounded-xl bg-white/70 px-3 py-2">
                  <Icon className="h-4 w-4 text-sunrise" />
                  <div>
                    <p className="text-small font-heading text-charcoal">{title}</p>
                    <p className="text-small text-gray">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!mfaRequired ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-small font-heading text-charcoal mb-2">Admin Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`input pl-10 pr-3 ${validationErrors.email ? 'border-deepred focus:ring-deepred' : ''}`}
                    placeholder="mya@the-huddle.co"
                    aria-invalid={!!validationErrors.email}
                    aria-describedby={validationErrors.email ? 'email-error' : undefined}
                  />
                </div>
                {validationErrors.email && (
                  <p id="email-error" className="mt-1 text-small text-deepred flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {validationErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-small font-heading text-charcoal mb-2">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`input pl-10 pr-10 ${validationErrors.password ? 'border-deepred focus:ring-deepred' : ''}`}
                    placeholder="Enter admin password"
                    aria-invalid={!!validationErrors.password}
                    aria-describedby={validationErrors.password ? 'password-error' : undefined}
                  />
                  <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-5 w-5 text-gray hover:text-charcoal" /> : <Eye className="h-5 w-5 text-gray hover:text-charcoal" />}
                  </button>
                </div>
                {validationErrors.password && (
                  <p id="password-error" className="mt-1 text-small text-deepred flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {validationErrors.password}
                  </p>
                )}
              </div>

              <div className="bg-skyblue/10 border border-skyblue rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <Shield className="h-5 w-5 text-skyblue mt-0.5" />
                  <div>
                    <h4 className="text-small font-heading text-skyblue">Demo Credentials</h4>
                    <p className="text-small text-skyblue mt-1">Email: mya@the-huddle.co<br />Password: admin123</p>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full {isLoading ? 'btn-disabled' : ''}">
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Authenticating...
                  </div>
                ) : (
                  'Sign in securely'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-6">
              <div>
                <label htmlFor="mfaCode" className="block text-small font-heading text-charcoal mb-2">Multi-Factor Authentication Code</label>
                <input
                  id="mfaCode"
                  name="mfaCode"
                  type="text"
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="input"
                  placeholder="Enter the code sent to your email"
                  autoFocus
                />
                {mfaError && (
                  <p className="mt-1 text-small text-deepred flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {mfaError}
                  </p>
                )}
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full {isLoading ? 'btn-disabled' : ''}">
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Verifying...
                  </div>
                ) : (
                  'Verify Code & Access Portal'
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-small text-gray">Need help accessing the admin portal?{' '}
              <Link to="/contact" className="text-skyblue hover:text-skyblue font-heading">Contact support</Link>
            </p>
            <button onClick={handleForgot} className="mt-3 text-small text-skyblue hover:text-skyblue">Forgot password?</button>
          </div>
        </div>

        <div className="text-center">
          <Link to="/" className="text-small text-gray hover:text-charcoal">← Back to main website</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
