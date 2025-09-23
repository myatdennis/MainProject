import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Shield, Lock, Mail, Eye, EyeOff, AlertTriangle } from 'lucide-react';

const AdminLogin: React.FC = () => {
  const { login, isAuthenticated, forgotPassword } = useAuth();
  const [email, setEmail] = useState('admin@thehuddleco.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated.admin) navigate('/admin/dashboard');
  }, [isAuthenticated.admin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const ok = await login(email, password, 'admin');
    setIsLoading(false);
    if (ok) navigate('/admin/dashboard');
    else setError('Authentication failed.');
  };

  const handleForgot = async () => {
    if (!email) return setError('Enter your email to reset password');
    setIsLoading(true);
    const ok = await forgotPassword(email);
    setIsLoading(false);
    if (ok) setError('Password reset sent — check your email');
    else setError('Failed to send reset email');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="bg-gradient-to-r from-orange-400 to-red-500 p-3 rounded-lg">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div className="text-left">
              <span className="font-bold text-2xl text-white">Admin Portal</span>
              <p className="text-sm text-gray-300">The Huddle Co.</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Secure Access</h2>
          <p className="text-gray-300">Administrator and facilitator login only</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Admin Email Address</label>
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
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                  placeholder="admin@thehuddleco.com"
                />
              </div>
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
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                  placeholder="Enter admin password"
                />
                <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" /> : <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />}
                </button>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Demo Credentials</h4>
                  <p className="text-sm text-yellow-700 mt-1">Email: admin@thehuddleco.com<br />Password: admin123</p>
                </div>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-orange-400 to-red-500 text-white py-3 px-4 rounded-lg font-semibold text-lg hover:from-orange-500 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
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
            <p className="text-sm text-gray-600">Need help accessing the admin portal?{' '}
              <Link to="/contact" className="text-orange-500 hover:text-orange-600 font-medium">Contact support</Link>
            </p>
            <button onClick={handleForgot} className="mt-3 text-sm text-orange-500 hover:text-orange-600">Forgot password?</button>
          </div>
        </div>

        <div className="text-center">
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-300">← Back to main website</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;