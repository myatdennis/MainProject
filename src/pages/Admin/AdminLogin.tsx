import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSecureAuth } from '../../context/SecureAuthContext';
import { Shield, Lock, Mail, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { loginSchema, emailSchema } from '../../utils/validators';
import { sanitizeText } from '../../utils/sanitize';

const AdminLogin: React.FC = () => {
  const { login, isAuthenticated, forgotPassword, authInitializing } = useSecureAuth();
  const [email, setEmail] = useState('admin@thehuddleco.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated.admin) navigate('/admin/dashboard');
  }, [isAuthenticated.admin, navigate]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setValidationErrors({});

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

    const result = await login(sanitizedEmail, sanitizedPassword, 'admin');
    setIsLoading(false);
    if (result.success) navigate('/admin/dashboard');
    else setError(result.error || 'Authentication failed.');
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
          <p className="text-body text-gray">Administrator and facilitator login only</p>
        </div>

        <div className="card">
          {error && (
            <div className="mb-6 p-4 bg-deepred/10 border border-deepred rounded-lg flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-deepred" />
              <span className="text-deepred text-small">{error}</span>
            </div>
          )}

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
                  placeholder="admin@thehuddleco.com"
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
                  <p className="text-small text-skyblue mt-1">Email: admin@thehuddleco.com<br />Password: admin123</p>
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
                'Access Admin Portal'
              )}
            </button>
          </form>

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
