import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Users, Lock, Mail, Eye, EyeOff, AlertCircle, Info } from 'lucide-react';
import { loginSchema, emailSchema } from '../../utils/validators';
import { sanitizeText } from '../../utils/sanitize';
const LMSLogin = () => {
    const { login, isAuthenticated, forgotPassword } = useAuth();
    const [email, setEmail] = useState('user@pacificcoast.edu');
    const [password, setPassword] = useState('user123');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('error');
    const [showTroubleshooting, setShowTroubleshooting] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});
    const navigate = useNavigate();
    useEffect(() => {
        if (isAuthenticated.lms)
            navigate('/lms/dashboard');
    }, [isAuthenticated.lms, navigate]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');
        setShowTroubleshooting(false);
        setValidationErrors({});
        // Validate input
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
            setIsLoading(false);
            const errors = {};
            validation.error.errors.forEach((err) => {
                const field = err.path[0];
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
        }
        else {
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
        // Check if we're in demo mode
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
            setMessage('Password reset is not available in demo mode. Use the demo credentials above or contact support for assistance.');
            setMessageType('info');
            return;
        }
        setIsLoading(true);
        const ok = await forgotPassword(email);
        setIsLoading(false);
        if (ok) {
            setMessage('Password reset sent — check your email');
            setMessageType('success');
        }
        else {
            setMessage('Failed to send reset email. Please check your email address or try again later.');
            setMessageType('error');
        }
    };
    const getMessageStyles = (type) => {
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
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "max-w-md w-full space-y-8", children: [_jsxs("div", { className: "text-center", children: [_jsxs(Link, { to: "/", className: "flex items-center justify-center space-x-2 mb-6", children: [_jsx("div", { className: "bg-gradient-to-r from-orange-400 to-red-500 p-3 rounded-lg", children: _jsx(Users, { className: "h-8 w-8 text-white" }) }), _jsx("span", { className: "font-bold text-2xl text-gray-900", children: "The Huddle Co." })] }), _jsx("h2", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Welcome Back" }), _jsx("p", { className: "text-gray-600", children: "Sign in to access your learning portal" })] }), _jsxs("div", { className: "bg-white rounded-2xl shadow-xl p-8", children: [_jsxs("div", { className: "mb-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700", children: [_jsxs("div", { className: "flex items-center", children: [_jsx(Info, { className: "h-4 w-4 mr-2" }), _jsx("span", { className: "font-medium", children: "Demo credentials:" })] }), _jsxs("div", { className: "mt-1", children: ["Email: ", _jsx("code", { className: "font-mono bg-blue-100 px-1 rounded", children: "user@pacificcoast.edu" }), " \u2022 Password: ", _jsx("code", { className: "font-mono bg-blue-100 px-1 rounded", children: "user123" })] })] }), message && (_jsx("div", { className: `mb-4 p-3 border rounded-lg text-sm ${getMessageStyles(messageType)}`, children: _jsxs("div", { className: "flex items-start", children: [_jsx(AlertCircle, { className: "h-4 w-4 mr-2 mt-0.5 flex-shrink-0" }), _jsx("div", { className: "flex-1", children: message })] }) })), showTroubleshooting && (_jsxs("div", { className: "mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm", children: [_jsxs("div", { className: "flex items-center mb-2", children: [_jsx(Info, { className: "h-4 w-4 mr-2 text-yellow-600" }), _jsx("span", { className: "font-medium text-yellow-800", children: "Troubleshooting Tips:" })] }), _jsxs("ul", { className: "text-yellow-700 space-y-1 ml-6 list-disc", children: [_jsx("li", { children: "Double-check your email address and password" }), _jsx("li", { children: "Make sure Caps Lock is off" }), _jsx("li", { children: "Try the demo credentials: user@pacificcoast.edu / user123" }), _jsx("li", { children: "Check your internet connection" }), _jsx("li", { children: "If you have an account, try the \"Forgot password?\" link" }), _jsx("li", { children: "Contact support if the issue persists" })] })] })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-sm font-medium text-gray-700 mb-2", children: "Email Address" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx(Mail, { className: "h-5 w-5 text-gray-400" }) }), _jsx("input", { id: "email", name: "email", type: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value), className: `block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200 ${validationErrors.email ? 'border-red-500' : 'border-gray-300'}`, placeholder: "Enter your email", "aria-invalid": validationErrors.email ? 'true' : 'false', "aria-describedby": validationErrors.email ? 'email-error' : undefined })] }), validationErrors.email && (_jsx("p", { id: "email-error", className: "mt-1 text-sm text-red-600", children: validationErrors.email }))] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "password", className: "block text-sm font-medium text-gray-700 mb-2", children: "Password" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx(Lock, { className: "h-5 w-5 text-gray-400" }) }), _jsx("input", { id: "password", name: "password", type: showPassword ? 'text' : 'password', required: true, value: password, onChange: (e) => setPassword(e.target.value), className: `block w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200 ${validationErrors.password ? 'border-red-500' : 'border-gray-300'}`, placeholder: "Enter your password", "aria-invalid": validationErrors.password ? 'true' : 'false', "aria-describedby": validationErrors.password ? 'password-error' : undefined }), _jsx("button", { type: "button", className: "absolute inset-y-0 right-0 pr-3 flex items-center", onClick: () => setShowPassword(!showPassword), children: showPassword ? _jsx(EyeOff, { className: "h-5 w-5 text-gray-400 hover:text-gray-600" }) : _jsx(Eye, { className: "h-5 w-5 text-gray-400 hover:text-gray-600" }) })] }), validationErrors.password && (_jsx("p", { id: "password-error", className: "mt-1 text-sm text-red-600", children: validationErrors.password }))] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("input", { id: "remember-me", name: "remember-me", type: "checkbox", className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), _jsx("label", { htmlFor: "remember-me", className: "ml-2 block text-sm text-gray-700", children: "Remember me" })] }), _jsx("button", { type: "button", onClick: handleForgot, className: "text-sm text-orange-500 hover:text-orange-600", children: "Forgot password?" })] }), _jsx("button", { type: "submit", disabled: isLoading, "data-test": "lms-sign-in", className: "w-full bg-gradient-to-r from-orange-400 to-red-500 text-white py-3 px-4 rounded-lg font-semibold text-lg hover:from-orange-500 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed", children: isLoading ? (_jsxs("div", { className: "flex items-center justify-center", children: [_jsx("div", { className: "animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" }), "Signing in..."] })) : ('Sign In') })] }), _jsx("div", { className: "mt-6 text-center", children: _jsxs("p", { className: "text-sm text-gray-600", children: ["Need help accessing your account?", ' ', _jsx(Link, { to: "/contact", className: "text-orange-500 hover:text-orange-600 font-medium", children: "Contact support" })] }) })] }), _jsx("div", { className: "text-center", children: _jsx(Link, { to: "/", className: "text-sm text-gray-600 hover:text-gray-900", children: "\u2190 Back to main website" }) })] }) }));
};
export default LMSLogin;
