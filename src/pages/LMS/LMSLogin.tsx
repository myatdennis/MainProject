import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useSecureAuth } from '../../context/SecureAuthContext';
import { Lock, Mail, Eye, EyeOff, AlertCircle, Info, ShieldCheck } from 'lucide-react';
import { loginSchema, emailSchema, registerSchema } from '../../utils/validators';
import { sanitizeText } from '../../utils/sanitize';
import useRuntimeStatus from '../../hooks/useRuntimeStatus';
import type { z } from 'zod';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';

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
    if (authMode === 'client') {
      if (isAuthenticated.lms) {
        navigate('/lms/dashboard', { replace: true });
      } else if (isAuthenticated.client) {
        navigate('/client/dashboard', { replace: true });
      }
    }
  }, [adminLandingTarget, authMode, isAuthenticated.admin, isAuthenticated.client, isAuthenticated.lms, isE2ERuntime, navigate]);

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
    <div className="min-h-screen bg-softwhite py-12 lg:py-16">
      <div className="container-page section mx-auto grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden bg-slate-900 text-slate-100 shadow-card-sm">
          <div className="relative overflow-hidden px-8 py-10 sm:px-10 sm:py-12">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-950/95" />
            <div className="pointer-events-none absolute inset-0 opacity-10">
              <img src="/logo.svg" alt="" className="h-full w-full object-contain" />
            </div>
            <div className="relative z-10">
              <Badge tone="info" className="inline-flex bg-white/10 text-slate-100 border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.32em] text-white/80">
                Premium leadership learning
              </Badge>
              <h1 className="mt-8 font-heading text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
                Welcome back to your learning hub
              </h1>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                Continue your leadership journey with guided lessons, reflections, and team connection in The Huddle Co. learner experience.
              </p>

              <div className="mt-10 space-y-4">
                {panelHighlights.map((item) => (
                  <div key={item.label} className="rounded-[28px] border border-white/10 bg-slate-800/80 p-5 backdrop-blur-sm shadow-[0_18px_90px_rgba(15,23,42,0.16)] transition hover:border-white/20">
                    <p className="text-sm font-semibold text-slate-100">{item.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card tone="default" className="rounded-[28px] border border-mist bg-white p-8 shadow-card-sm">
          <div className="mb-8">
            <div className="inline-flex items-center gap-3 rounded-[28px] bg-slate-100 px-4 py-3 shadow-sm shadow-slate-200/60">
              <div className="flex h-11 w-11 overflow-hidden rounded-2xl bg-white shadow-lg">
                <img src="/logo.svg" alt="The Huddle Co." className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">The Huddle Co.</p>
                <p className="text-2xl font-semibold tracking-tight text-charcoal">Sign in</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAuthMode('client')}
                aria-pressed={authMode === 'client'}
                className={`min-w-[130px] rounded-full border px-4 py-2 text-sm font-semibold transition ${authMode === 'client'
                  ? 'border-orange-500 bg-orange-500 text-white shadow-sm shadow-orange-200/40'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
              >
                Learner login
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('admin')}
                aria-pressed={authMode === 'admin'}
                className={`min-w-[130px] rounded-full border px-4 py-2 text-sm font-semibold transition ${authMode === 'admin'
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm shadow-slate-400/20'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
              >
                Admin login
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {authMode === 'admin'
                ? 'Use your admin credentials to access the protected admin portal.'
                : 'Sign in to your learner workspace with your cohort credentials.'}
            </p>
          </div>

          <div className="rounded-[28px] border border-mist bg-slate-50 p-5 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{authMode === 'admin' ? 'Protected admin workspace' : 'Private learner workspace'}</p>
            <p className="mt-2 text-slate-600">
              {authMode === 'admin'
                ? 'Only authorized admins can access this portal.'
                : 'Active cohorts and verified facilitators sign in here.'}
            </p>
          </div>

          <div className="mt-6 rounded-[28px] border border-mist bg-white p-5 text-sm text-slate-700 shadow-sm">
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
            <div className="mt-6 rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              <div className="font-semibold">Troubleshooting tips</div>
              <ul className="mt-3 space-y-2 pl-5 text-amber-900">
                <li>Verify your email and password</li>
                <li>Disable Caps Lock and try again</li>
                <li>Use the demo credentials when in demo mode</li>
              </ul>
            </div>
          )}

          {message && (
            <div className={`mt-6 rounded-[28px] border p-4 text-sm ${getMessageStyles(messageType)}`}>
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <div>{message}</div>
              </div>
            </div>
          )}

          <div className="mt-6 rounded-[28px] bg-slate-50 p-1">
            <div className="flex gap-1 rounded-full bg-white p-1 text-sm font-semibold shadow-sm shadow-slate-200/60" role="tablist" aria-label="Authentication action">
              <button
                id="lms-login-tab"
                type="button"
                role="tab"
                aria-controls="lms-login-panel"
                aria-selected={activeTab === 'login'}
                onClick={() => setActiveTab('login')}
                className={`flex-1 rounded-full py-3 transition ${activeTab === 'login' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Sign in
              </button>
              <button
                id="lms-register-tab"
                type="button"
                role="tab"
                aria-controls="lms-register-panel"
                aria-selected={activeTab === 'register'}
                onClick={() => registrationAvailable && authMode === 'client' && setActiveTab('register')}
                disabled={!registrationAvailable || authMode === 'admin'}
                className={`flex-1 rounded-full py-3 transition ${activeTab === 'register' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'} ${(!registrationAvailable || authMode === 'admin') ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Create account
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
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    hasError={!!validationErrors.email}
                    className="pl-12"
                    placeholder="you@company.com"
                    aria-invalid={!!validationErrors.email}
                    aria-describedby={validationErrors.email ? 'email-error' : undefined}
                  />
                </div>
                {validationErrors.email && <p id="email-error" className="mt-2 text-sm text-deepred">{validationErrors.email}</p>}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    hasError={!!validationErrors.password}
                    className="pl-12 pr-12"
                    placeholder="Enter your password"
                    aria-invalid={!!validationErrors.password}
                    aria-describedby={validationErrors.password ? 'password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide characters' : 'Show characters'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {validationErrors.password && <p id="password-error" className="mt-2 text-sm text-deepred">{validationErrors.password}</p>}
              </div>

              <div className="flex items-center justify-between text-sm text-slate-600">
                <button type="button" onClick={handleForgot} className="font-medium text-orange-500 hover:text-orange-600">Forgot password?</button>
                <span className="text-slate-500">Secure login</span>
              </div>

              <Button type="submit" size="lg" isFullWidth loading={isLoading}>
                {authMode === 'admin' ? 'Sign in to admin portal' : 'Sign in'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-5" id="lms-register-panel" role="tabpanel" aria-labelledby="lms-register-tab">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-2">First name</label>
                  <Input
                    id="firstName"
                    type="text"
                    value={registerForm.firstName}
                    onChange={(e) => handleRegisterChange('firstName', e.target.value)}
                    hasError={!!registerErrors.firstName}
                    placeholder="Jane"
                  />
                  {registerErrors.firstName && <p className="mt-2 text-sm text-deepred">{registerErrors.firstName}</p>}
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-2">Last name</label>
                  <Input
                    id="lastName"
                    type="text"
                    value={registerForm.lastName}
                    onChange={(e) => handleRegisterChange('lastName', e.target.value)}
                    hasError={!!registerErrors.lastName}
                    placeholder="Doe"
                  />
                  {registerErrors.lastName && <p className="mt-2 text-sm text-deepred">{registerErrors.lastName}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="registerEmail" className="block text-sm font-medium text-slate-700 mb-2">Work email</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <Input
                    id="registerEmail"
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => handleRegisterChange('email', e.target.value)}
                    hasError={!!registerErrors.email}
                    className="pl-12"
                    placeholder="you@company.com"
                  />
                </div>
                {registerErrors.email && <p className="mt-2 text-sm text-deepred">{registerErrors.email}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="registerPassword" className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                  <Input
                    id="registerPassword"
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => handleRegisterChange('password', e.target.value)}
                    hasError={!!registerErrors.password}
                    placeholder="Create a password"
                  />
                  {registerErrors.password && <p className="mt-2 text-sm text-deepred">{registerErrors.password}</p>}
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">Confirm password</label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={registerForm.confirmPassword}
                    onChange={(e) => handleRegisterChange('confirmPassword', e.target.value)}
                    hasError={!!registerErrors.confirmPassword}
                    placeholder="Re-enter password"
                  />
                  {registerErrors.confirmPassword && <p className="mt-2 text-sm text-deepred">{registerErrors.confirmPassword}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="organizationId" className="block text-sm font-medium text-slate-700 mb-2">Organization ID (optional)</label>
                <Input
                  id="organizationId"
                  type="text"
                  value={registerForm.organizationId ?? ''}
                  onChange={(e) => handleRegisterChange('organizationId', e.target.value)}
                  hasError={!!registerErrors.organizationId}
                  placeholder="Organization ID"
                />
                {registerErrors.organizationId && <p className="mt-2 text-sm text-deepred">{registerErrors.organizationId}</p>}
              </div>

              <Button type="submit" size="lg" isFullWidth loading={isRegistering} variant="success">
                Create account
              </Button>
            </form>
          )}

          <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
            <p>Need help accessing your account?</p>
            <Link to="/contact" className="font-medium text-skyblue hover:text-skyblue/80">Contact support</Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LMSLogin;
