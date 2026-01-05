import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Users, Lock, Mail, Eye, EyeOff, AlertCircle, Info, ShieldCheck } from 'lucide-react';
import { loginSchema, emailSchema, registerSchema } from '../../utils/validators';
import { sanitizeText } from '../../utils/sanitize';
import useRuntimeStatus from '../../hooks/useRuntimeStatus';
import type { z } from 'zod';

const LMSLogin: React.FC = () => {
  const { login, register, isAuthenticated, forgotPassword } = useAuth();
  const runtimeStatus = useRuntimeStatus();
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
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated.lms) navigate('/lms/dashboard');
  }, [isAuthenticated.lms, navigate]);

  useEffect(() => {
    if (!registrationAvailable && activeTab === 'register') {
      setActiveTab('login');
    }
  }, [registrationAvailable, activeTab]);

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
    
    const result = await login(sanitizedEmail, password, 'lms');
    setIsLoading(false);
    
    if (result.success) {
      navigate('/lms/dashboard');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link to="/" className="flex items-center justify-center space-x-2 mb-6">
            <div className="bg-gradient-to-r from-orange-400 to-red-500 p-3 rounded-lg">
              <Users className="h-8 w-8 text-white" />
            </div>
            <span className="font-bold text-2xl text-gray-900">The Huddle Co.</span>
          </Link>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
          <p className="text-gray-600">Sign in to access your learning portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className={`mb-6 border rounded-lg p-4 text-sm ${demoModeEnabled ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
            <div className="flex items-center mb-1">
              {demoModeEnabled ? <Info className="h-4 w-4 mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              <span className="font-medium">
                {demoModeEnabled ? 'Demo mode active' : 'Secure mode connected'}
              </span>
            </div>
            {demoModeEnabled ? (
              <div>
                Email: <code className="font-mono bg-blue-100 px-1 rounded">{DEMO_EMAIL}</code> •
                Password: <code className="font-mono bg-blue-100 px-1 rounded">{DEMO_PASSWORD}</code>
                <p className="mt-2">Production signup and password reset are disabled until the platform is connected to Supabase.</p>
              </div>
            ) : (
              <div>
                Supabase is online and registration is enabled. Create an account with your organization ID or sign in below.
                <p className="mt-2 flex items-center text-xs text-green-700">
                  <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 mr-2 text-[11px] uppercase tracking-wide">Status: {runtimeStatus.statusLabel}</span>
                  Last check {runtimeStatus.lastChecked ? new Date(runtimeStatus.lastChecked).toLocaleTimeString() : 'pending'}
                </p>
              </div>
            )}
          </div>
          
          {message && (
            <div className={`mb-4 p-3 border rounded-lg text-sm ${getMessageStyles(messageType)}`}>
              <div className="flex items-start">
                <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                <div className="flex-1">{message}</div>
              </div>
            </div>
          )}

          <div className="flex mb-6 rounded-lg bg-gray-100 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2 rounded-md transition ${activeTab === 'login' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => registrationAvailable && setActiveTab('register')}
              disabled={!registrationAvailable}
              className={`flex-1 py-2 rounded-md transition ${activeTab === 'register' ? 'bg-white shadow text-gray-900' : 'text-gray-500'} ${registrationAvailable ? '' : 'opacity-50 cursor-not-allowed'}`}
            >
              Create Account
            </button>
          </div>

          {activeTab === 'login' ? (
            <>
              {showTroubleshooting && (
                <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
                  <div className="flex items-center mb-2">
                    <Info className="h-4 w-4 mr-2 text-yellow-600" />
                    <span className="font-medium text-yellow-800">Troubleshooting Tips:</span>
                  </div>
                  <ul className="text-yellow-700 space-y-1 ml-6 list-disc">
                    <li>Double-check your email address and password</li>
                    <li>Make sure Caps Lock is off</li>
                    <li>Try the demo credentials: user@pacificcoast.edu / user123</li>
                    <li>Check your internet connection</li>
                    <li>If you have an account, try the "Forgot password?" link</li>
                    <li>Contact support if the issue persists</li>
                  </ul>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  id="email" 
                  name="email" 
                  type="email" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200 ${validationErrors.email ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Enter your email" 
                  aria-invalid={validationErrors.email ? 'true' : 'false'}
                  aria-describedby={validationErrors.email ? 'email-error' : undefined}
                />
              </div>
              {validationErrors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
              )}
        </div>

        <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  id="password" 
                  name="password" 
                  type={showPassword ? 'text' : 'password'} 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className={`block w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200 ${validationErrors.password ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Enter your password"
                  aria-invalid={validationErrors.password ? 'true' : 'false'}
                  aria-describedby={validationErrors.password ? 'password-error' : undefined}
                />
                <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" /> : <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />}</button>
              </div>
              {validationErrors.password && (
                <p id="password-error" className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
              )}
        </div>

        <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">Remember me</label>
              </div>
              <button type="button" onClick={handleForgot} className="text-sm text-orange-500 hover:text-orange-600">Forgot password?</button>
        </div>

        <button type="submit" disabled={isLoading} data-test="lms-sign-in" className="w-full bg-gradient-to-r from-orange-400 to-red-500 text-white py-3 px-4 rounded-lg font-semibold text-lg hover:from-orange-500 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input
                    id="firstName"
                    type="text"
                    value={registerForm.firstName}
                    onChange={(e) => handleRegisterChange('firstName', e.target.value)}
                    className={`block w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${registerErrors.firstName ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Jane"
                  />
                  {registerErrors.firstName && <p className="mt-1 text-sm text-red-600">{registerErrors.firstName}</p>}
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                  <input
                    id="lastName"
                    type="text"
                    value={registerForm.lastName}
                    onChange={(e) => handleRegisterChange('lastName', e.target.value)}
                    className={`block w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${registerErrors.lastName ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Doe"
                  />
                  {registerErrors.lastName && <p className="mt-1 text-sm text-red-600">{registerErrors.lastName}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="registerEmail" className="block text-sm font-medium text-gray-700 mb-2">Work Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="registerEmail"
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => handleRegisterChange('email', e.target.value)}
                    className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${registerErrors.email ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="you@company.com"
                  />
                </div>
                {registerErrors.email && <p className="mt-1 text-sm text-red-600">{registerErrors.email}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="registerPassword" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input
                    id="registerPassword"
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => handleRegisterChange('password', e.target.value)}
                    className={`block w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${registerErrors.password ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Create a password"
                  />
                  {registerErrors.password && <p className="mt-1 text-sm text-red-600">{registerErrors.password}</p>}
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={registerForm.confirmPassword}
                    onChange={(e) => handleRegisterChange('confirmPassword', e.target.value)}
                    className={`block w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${registerErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Re-enter password"
                  />
                  {registerErrors.confirmPassword && <p className="mt-1 text-sm text-red-600">{registerErrors.confirmPassword}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="organizationId" className="block text-sm font-medium text-gray-700 mb-2">Organization ID (optional)</label>
                <input
                  id="organizationId"
                  type="text"
                  value={registerForm.organizationId ?? ''}
                  onChange={(e) => handleRegisterChange('organizationId', e.target.value)}
                  className={`block w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${registerErrors.organizationId ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
                {registerErrors.organizationId && <p className="mt-1 text-sm text-red-600">{registerErrors.organizationId}</p>}
              </div>

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-lg font-semibold text-lg hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRegistering ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creating account...
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">Need help accessing your account?{' '}
              <Link to="/contact" className="text-orange-500 hover:text-orange-600 font-medium">Contact support</Link>
            </p>
          </div>
        </div>

        <div className="text-center">
          <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">← Back to main website</Link>
        </div>
      </div>
    </div>
  );
};

export default LMSLogin;