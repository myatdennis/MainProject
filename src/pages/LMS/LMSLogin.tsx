import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Users, Lock, Mail, Eye, EyeOff } from 'lucide-react';

const LMSLogin: React.FC = () => {
  const { login, isAuthenticated, forgotPassword } = useAuth();
  const [email, setEmail] = useState('user@pacificcoast.edu');
  const [password, setPassword] = useState('user123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated.lms) navigate('/lms/dashboard');
  }, [isAuthenticated.lms, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    
    const result = await login(email, password, 'lms');
    setIsLoading(false);
    
    if (result.success) {
      navigate('/lms/dashboard');
    } else {
      // Show specific error message from the login function
      setMessage(result.error || 'Sign-in failed. Please check your credentials and try again.');
    }
  };

  const handleForgot = async () => {
    if (!email) return setMessage('Enter your email to reset password');
    setIsLoading(true);
    const ok = await forgotPassword(email);
    setIsLoading(false);
    if (ok) setMessage('Password reset sent — check your email');
    else setMessage('Failed to send reset email');
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
          <div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
            Demo credentials: Email: user@pacificcoast.edu • Password: user123
          </div>
          {message && (
            <div className={`mb-3 text-sm text-center rounded-lg p-3 ${
              message.includes('Demo mode') || message.includes('Demo credentials') 
                ? 'text-blue-700 bg-blue-50 border border-blue-100' 
                : 'text-red-700 bg-red-50 border border-red-100'
            }`}>
              {message}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input id="email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200" placeholder="Enter your email" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200" placeholder="Enter your password" />
                <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" /> : <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />}</button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">Remember me</label>
              </div>
              <button type="button" onClick={handleForgot} className="text-sm text-orange-500 hover:text-orange-600">Forgot password?</button>
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-orange-400 to-red-500 text-white py-3 px-4 rounded-lg font-semibold text-lg hover:from-orange-500 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
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