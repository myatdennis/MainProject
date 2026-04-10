import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useSecureAuth } from '../../context/SecureAuthContext';
import { Lock, Mail, Eye, EyeOff, AlertCircle, Info, ShieldCheck } from 'lucide-react';
import { loginSchema, emailSchema, registerSchema } from '../../utils/validators';
import { sanitizeText } from '../../utils/sanitize';
import useRuntimeStatus from '../../hooks/useRuntimeStatus';
import type { z } from 'zod';

const LMSLogin: React.FC = () => {
  const { login, register, isAuthenticated, forgotPassword } = useSecureAuth();
  const location = useLocation();
  const runtimeStatus = useRuntimeStatus();
  const isE2ERuntime =
    (import.meta.env.VITE_E2E_TEST_MODE ?? '').toString() === 'true' ||
    (import.meta.env.VITE_DEV_FALLBACK ?? '').toString() === 'true';
  const supabaseReady = runtimeStatus.supabaseConfigured && runtimeStatus.supabaseHealthy;
  const demoModeEnabled = runtimeStatus.demoModeEnabled || !supabaseReady;
  const registrationAvailable = supabaseReady && !runtimeStatus.demoModeEnabled;

  const DEMO_EMAIL = 'user@pacificcoast.edu';
  const DEMO_PASSWORD = 'user123';
  const hasPrefilledDemo = useRef(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success' | 'info'>('error');
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});
  type RegisterFormState = z.infer<typeof registerSchema>;
  type RegisterField = keyof RegisterFormState;
  type RegisterErrors = Partial<Record<RegisterField, string>>;
  const initialRegisterState: RegisterFormState = useMemo(() => ({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    organizationId: undefined,
  }), []);

  const [registerForm, setRegisterForm] = useState<RegisterFormState>(() => ({ ...initialRegisterState }));
  const [registerErrors, setRegisterErrors] = useState<RegisterErrors>({});
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [authMode, setAuthMode] = useState<'client' | 'admin'>('client');
  const navigate = useNavigate();

  const panelHighlights = [
    { label: 'Cohort-driven learning', description: 'Trusted pathways for every team and leader.' },
    { label: 'Reflection-backed progress', description: 'Keep your development grounded in real insight.' },
    { label: 'Secure team collaboration', description: 'Connect with your cohort in a protected learning space.' },
  ];

  const adminLandingTarget = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const rawReturnTo = params.get('returnTo');
    if (rawReturnTo && rawReturnTo.startsWith('/admin/') && !rawReturnTo.startsWith('/admin/login')) {
      return rawReturnTo;
    }
    return '/admin';
  }, [location.search]);

  useEffect(() => {
    const requestedRole = new URLSearchParams(location.search).get('role');
    if (requestedRole === 'admin') {
      setAuthMode('admin');
      setActiveTab('login');
      return;
    }
    setAuthMode('client');
  }, [location.search]);

  useEffect(() => {
    if (isE2ERuntime) return;
    if (authMode === 'admin' && isAuthenticated.admin) {
      navigate(adminLandingTarget, { replace: true });
      return;
    }
    if (authMode === 'client' && isAuthenticated.lms) {
      navigate('/lms/dashboard', { replace: true });
    }
  }, [adminLandingTarget, authMode, isAuthenticated.admin, isAuthenticated.lms, isE2ERuntime, navigate]);

  useEffect(() => {
    if ((!registrationAvailable || authMode === 'admin') && activeTab === 'register') {
      setActiveTab('login');
    }
  }, [registrationAvailable, activeTab, authMode]);

  useEffect(() => {
    if (demoModeEnabled && !hasPrefilledDemo.current) {
      setEmail(DEMO_EMAIL);
      setPassword(DEMO_PASSWORD);
      hasPrefilledDemo.current = true;
    }
  }, [demoModeEnabled]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setShowTroubleshooting(false);
    setValidationErrors({});
    
    // Validate input
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      setIsLoading(false);
      const errors: { email?: string; password?: string } = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as 'email' | 'password';
        if (field) {
          errors[field] = err.message;
        }
      });
      setValidationErrors(errors);
      setMessage('Please fix the validation errors below');
      setMessageType('error');
      return;
    }
    
    // Sanitize inputs
    const sanitizedEmail = sanitizeText(email.toLowerCase().trim());

    const loginType = authMode === 'admin' ? 'admin' : 'lms';
    const result = await login(sanitizedEmail, password, loginType);
    setIsLoading(false);
    
    if (result.success) {
      navigate(loginType === 'admin' ? adminLandingTarget : '/lms/dashboard', { replace: true });
    } else {
      setMessage(result.error || 'Sign-in failed.');
      setMessageType('error');
      
      // Show troubleshooting tips for certain error types
      if (result.errorType === 'invalid_credentials' || result.errorType === 'network_error') {
        setShowTroubleshooting(true);
      }
    }
  };

  const handleForgot = async () => {
    if (!email) {
      setMessage('Enter your email to reset password');
      setMessageType('info');
      return;
    }
    
    // Validate email
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      setMessage('Please enter a valid email address');
      setMessageType('error');
      return;
    }
    
    // Password reset only works when Supabase is online
    if (!supabaseReady) {
      setMessage('Password reset is unavailable while the platform is in demo or maintenance mode. Use the demo credentials above or contact support.');
      setMessageType('info');
      return;
    }
    
    setIsLoading(true);
    const ok = await forgotPassword(email);
    setIsLoading(false);
    if (ok) {
      setMessage('Password reset sent — check your email');
      setMessageType('success');
    } else {
      setMessage('Failed to send reset email. Please check your email address or try again later.');
      setMessageType('error');
    }
  };

  const handleRegisterChange = (field: RegisterField, value: string) => {
    setRegisterForm((prev) => ({
      ...prev,
      [field]: field === 'organizationId' ? value.trim() : value,
    }));
    setRegisterErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    setMessage('');
    setRegisterErrors({});

    const payload: RegisterFormState = {
      email: sanitizeText(registerForm.email.toLowerCase().trim()),
      password: registerForm.password,
      confirmPassword: registerForm.confirmPassword,
      firstName: sanitizeText(registerForm.firstName.trim()),
      lastName: sanitizeText(registerForm.lastName.trim()),
      organizationId: registerForm.organizationId?.trim() || undefined,
    };

    const result = await register(payload);
    setIsRegistering(false);

    if (result.success) {
      setMessage('Account created successfully! You can now sign in.');
      setMessageType('success');
      setActiveTab('login');
      setEmail(payload.email);
      setPassword('');
  setRegisterForm({ ...initialRegisterState });
      return;
    }

    if (result.fieldErrors) {
      setRegisterErrors(result.fieldErrors);
    }

    setMessage(result.error || 'Registration failed. Please try again.');
    setMessageType(result.errorType === 'network_error' ? 'info' : 'error');
  };

  const getMessageStyles = (type: 'error' | 'success' | 'info') => {
    switch (type) {
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-orange-600 bg-orange-50 border-orange-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-emerald-50">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 overflow-hidden lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden bg-slate-950 px-6 py-16 text-white sm:px-10 lg:px-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.16),transparent_36%)]" />
          <div className="pointer-events-none absolute -right-16 top-1/2 h-[420px] w-[420px] -translate-y-1/2 opacity-10 sm:-right-10">
            <img src="/logo.svg" alt="" className="h-full w-full object-contain" />
          </div>
          <div className="relative z-10 flex h-full flex-col justify-center">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-200/80 shadow-[0_10px_30px_rgba(15,23,42,0.1)]">
                Premium leadership learning
              </div>
              <h1 className="mt-10 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Welcome back to your learning hub
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-200/80 sm:text-lg">
                Continue your leadership journey with guided lessons, reflections, and team connection.
              </p>
              <div className="mt-10 space-y-4">
                {panelHighlights.map((item) => (
                  <div key={item.label} className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition hover:border-white/20">
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-200/75">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-white px-6 py-12 sm:px-10 lg:px-14">
          <div className="w-full max-w-md">
            <div className="mb-8 space-y-4">
              <div className="inline-flex items-center gap-3 rounded-3xl bg-slate-100 px-4 py-3 shadow-sm shadow-slate-200/70">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-lg shadow-orange-500/10">
                  <img src="/logo.svg" alt="The Huddle Co." className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">The Huddle Co.</p>
                  <p className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</p>
                </div>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                Secure login for your leadership and cohort experience.
              </p>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
              <div className="rounded-full bg-slate-100 p-1 shadow-sm shadow-slate-200/60">
                <div className="grid grid-cols-2 gap-1 rounded-full bg-transparent p-1">
                  <button
                    type="button"
                    onClick={() => setAuthMode('client')}
                    className={`rounded-full px-4 py-3 text-sm font-semibold transition ${authMode === 'client' ? 'bg-white text-slate-900 shadow-sm shadow-slate-200/80' : 'text-slate-500 hover:text-slate-900'}`}
                    aria-pressed={authMode === 'client'}
                  >
                    Client
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('admin');
                      setActiveTab('login');
                    }}
                    className={`rounded-full px-4 py-3 text-sm font-semibold transition ${authMode === 'admin' ? 'bg-white text-slate-900 shadow-sm shadow-slate-200/80' : 'text-slate-500 hover:text-slate-900'}`}
                    aria-pressed={authMode === 'admin'}
                  >
                    Admin
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200/70 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{authMode === 'admin' ? 'Protected admin workspace' : 'Private learner workspace'}</p>
                <p className="mt-2 text-slate-600">
                  {authMode === 'admin'
                    ? 'Only authorized admins can access this portal.'
                    : 'Active cohorts and verified facilitators sign in here.'}
                </p>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200/80 bg-white p-4 text-sm text-slate-700">
                <div className="flex items-center gap-3">
                  {demoModeEnabled ? <Info className="h-4 w-4 text-blue-500" /> : <ShieldCheck className="h-4 w-4 text-emerald-500" />}
                  <div>
                    <p className="font-semibold text-slate-900">{demoModeEnabled ? 'Demo mode active' : 'Secure mode connected'}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {demoModeEnabled
                        ? 'Use the demo credentials below until Supabase is connected.'
                        : 'Your data is protected and stored securely.'}
                    </p>
                  </div>
                </div>
              </div>

              {showTroubleshooting && (
                <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="font-semibold">Troubleshooting tips</div>
                  <ul className="mt-3 space-y-2 pl-5 text-amber-900">
                    <li>Verify your email and password</li>
                    <li>Disable Caps Lock and try again</li>
                    <li>Use the demo credentials when in demo mode</li>
                  </ul>
                </div>
              )}

              {message && (
                <div className={`mt-6 rounded-3xl border p-4 text-sm ${getMessageStyles(messageType)}`}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <div>{message}</div>
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-3xl bg-slate-50 p-1">
                <div className="flex gap-1 rounded-full bg-white p-1 text-sm font-semibold shadow-sm shadow-slate-200/60" role="tablist" aria-label="Authentication action">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'login'}
                    onClick={() => setActiveTab('login')}
                    className={`flex-1 rounded-full py-3 transition ${activeTab === 'login' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'register'}
                    onClick={() => registrationAvailable && authMode === 'client' && setActiveTab('register')}
                    disabled={!registrationAvailable || authMode === 'admin'}
                    className={`flex-1 rounded-full py-3 transition ${activeTab === 'register' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'} ${(!registrationAvailable || authMode === 'admin') ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Create Account
                  </button>
                </div>
              </div>

              {activeTab === 'login' ? (
                <form onSubmit={handleSubmit} className="mt-6 space-y-5" id="lms-login-panel" role="tabpanel" aria-labelledby="lms-login-tab">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">Email address</label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <Mail className="h-5 w-5" />
                      </div>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`block w-full rounded-2xl border px-4 py-3 pl-12 text-sm text-slate-900 shadow-sm transition duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400 ${validationErrors.email ? 'border-red-500' : 'border-slate-200'}`}
                        placeholder="you@company.com"
                        aria-invalid={!!validationErrors.email}
                        aria-describedby={validationErrors.email ? 'email-error' : undefined}
                      />
                    </div>
                    {validationErrors.email && <p id="email-error" className="mt-2 text-sm text-red-600">{validationErrors.email}</p>}
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <Lock className="h-5 w-5" />
                      </div>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`block w-full rounded-2xl border px-4 py-3 pl-12 pr-12 text-sm text-slate-900 shadow-sm transition duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400 ${validationErrors.password ? 'border-red-500' : 'border-slate-200'}`}
                        placeholder="Enter your password"
                        aria-invalid={!!validationErrors.password}
                        aria-describedby={validationErrors.password ? 'password-error' : undefined}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600">
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {validationErrors.password && <p id="password-error" className="mt-2 text-sm text-red-600">{validationErrors.password}</p>}
                  </div>

                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <button type="button" onClick={handleForgot} className="font-medium text-orange-500 hover:text-orange-600">Forgot password?</button>
                    <span className="text-slate-500">Secure login</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-4 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-orange-400 to-red-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition duration-200 hover:from-orange-500 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                        Signing in...
                      </div>
                    ) : (
                      authMode === 'admin' ? 'Sign in to admin portal' : 'Sign in'
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-5" id="lms-register-panel" role="tabpanel" aria-labelledby="lms-register-tab">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-2">First name</label>
                      <input
                        id="firstName"
                        type="text"
                        value={registerForm.firstName}
                        onChange={(e) => handleRegisterChange('firstName', e.target.value)}
                        className={`block w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 shadow-sm transition duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400 ${registerErrors.firstName ? 'border-red-500' : 'border-slate-200'}`}
                        placeholder="Jane"
                      />
                      {registerErrors.firstName && <p className="mt-2 text-sm text-red-600">{registerErrors.firstName}</p>}
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-2">Last name</label>
                      <input
                        id="lastName"
                        type="text"
                        value={registerForm.lastName}
                        onChange={(e) => handleRegisterChange('lastName', e.target.value)}
                        className={`block w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 shadow-sm transition duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400 ${registerErrors.lastName ? 'border-red-500' : 'border-slate-200'}`}
                        placeholder="Doe"
                      />
                      {registerErrors.lastName && <p className="mt-2 text-sm text-red-600">{registerErrors.lastName}</p>}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="registerEmail" className="block text-sm font-medium text-slate-700 mb-2">Work email</label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <Mail className="h-5 w-5" />
                      </div>
                      <input
                        id="registerEmail"
                        type="email"
                        value={registerForm.email}
                        onChange={(e) => handleRegisterChange('email', e.target.value)}
                        className={`block w-full rounded-2xl border px-4 py-3 pl-12 text-sm text-slate-900 shadow-sm transition duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400 ${registerErrors.email ? 'border-red-500' : 'border-slate-200'}`}
                        placeholder="you@company.com"
                      />
                    </div>
                    {registerErrors.email && <p className="mt-2 text-sm text-red-600">{registerErrors.email}</p>}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="registerPassword" className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                      <input
                        id="registerPassword"
                        type="password"
                        value={registerForm.password}
                        onChange={(e) => handleRegisterChange('password', e.target.value)}
                        className={`block w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 shadow-sm transition duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400 ${registerErrors.password ? 'border-red-500' : 'border-slate-200'}`}
                        placeholder="Create a password"
                      />
                      {registerErrors.password && <p className="mt-2 text-sm text-red-600">{registerErrors.password}</p>}
                    </div>
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">Confirm password</label>
                      <input
                        id="confirmPassword"
                        type="password"
                        value={registerForm.confirmPassword}
                        onChange={(e) => handleRegisterChange('confirmPassword', e.target.value)}
                        className={`block w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 shadow-sm transition duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400 ${registerErrors.confirmPassword ? 'border-red-500' : 'border-slate-200'}`}
                        placeholder="Re-enter password"
                      />
                      {registerErrors.confirmPassword && <p className="mt-2 text-sm text-red-600">{registerErrors.confirmPassword}</p>}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="organizationId" className="block text-sm font-medium text-slate-700 mb-2">Organization ID (optional)</label>
                    <input
                      id="organizationId"
                      type="text"
                      value={registerForm.organizationId ?? ''}
                      onChange={(e) => handleRegisterChange('organizationId', e.target.value)}
                      className={`block w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 shadow-sm transition duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400 ${registerErrors.organizationId ? 'border-red-500' : 'border-slate-200'}`}
                      placeholder="Organization ID"
                    />
                    {registerErrors.organizationId && <p className="mt-2 text-sm text-red-600">{registerErrors.organizationId}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={isRegistering}
                    className="mt-4 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-green-500/20 transition duration-200 hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isRegistering ? (
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                        Creating account...
                      </div>
                    ) : (
                      'Create account'
                    )}
                  </button>
                </form>
              )}

              <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
                <p>Need help accessing your account?</p>
                <Link to="/contact" className="font-medium text-orange-500 hover:text-orange-600">Contact support</Link>
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-slate-500">
              <Link to="/" className="font-medium text-slate-600 hover:text-slate-900">← Back to main website</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LMSLogin;
