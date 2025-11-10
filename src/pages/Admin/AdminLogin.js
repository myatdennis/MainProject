import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSecureAuth } from '../../context/SecureAuthContext';
import { Shield, Lock, Mail, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { loginSchema, emailSchema } from '../../utils/validators';
import { sanitizeText } from '../../utils/sanitize';
const AdminLogin = () => {
    const { login, isAuthenticated, forgotPassword, authInitializing } = useSecureAuth();
    const [email, setEmail] = useState('admin@thehuddleco.com');
    const [password, setPassword] = useState('admin123');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [validationErrors, setValidationErrors] = useState({});
    const navigate = useNavigate();
    useEffect(() => {
        if (isAuthenticated.admin)
            navigate('/admin/dashboard');
    }, [isAuthenticated.admin, navigate]);
    if (authInitializing) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-softwhite", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-sunrise mx-auto mb-4" }), _jsx("h2", { className: "text-h2 font-heading text-charcoal mb-2", children: "Initializing authentication..." }), _jsx("p", { className: "text-body text-gray", children: "Please wait while we check your authentication status." })] }) }));
    }
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setValidationErrors({});
        // Validate inputs
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
            const errors = {};
            validation.error.errors.forEach((err) => {
                if (err.path[0] === 'email')
                    errors.email = err.message;
                if (err.path[0] === 'password')
                    errors.password = err.message;
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
        if (result.success)
            navigate('/admin/dashboard');
        else
            setError(result.error || 'Authentication failed.');
    };
    const handleForgot = async () => {
        if (!email)
            return setError('Enter your email to reset password');
        // Validate email
        const validation = emailSchema.safeParse(email);
        if (!validation.success) {
            setError(validation.error.errors[0]?.message || 'Invalid email address');
            return;
        }
        setIsLoading(true);
        const ok = await forgotPassword(email);
        setIsLoading(false);
        if (ok)
            setError('Password reset sent — check your email');
        else
            setError('Failed to send reset email');
    };
    return (_jsx("div", { className: "min-h-screen bg-softwhite flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "max-w-md w-full space-y-8", children: [_jsxs("div", { className: "text-center", children: [_jsxs("div", { className: "flex items-center justify-center space-x-2 mb-6", children: [_jsx("div", { className: "bg-sunrise p-3 rounded-xl shadow-card", children: _jsx(Shield, { className: "h-8 w-8 text-white" }) }), _jsxs("div", { className: "text-left", children: [_jsx("span", { className: "font-heading text-h2 text-charcoal", children: "Admin Portal" }), _jsx("p", { className: "text-small text-gray", children: "The Huddle Co." })] })] }), _jsx("h2", { className: "text-h1 font-heading text-charcoal mb-2", children: "Secure Access" }), _jsx("p", { className: "text-body text-gray", children: "Administrator and facilitator login only" })] }), _jsxs("div", { className: "card", children: [error && (_jsxs("div", { className: "mb-6 p-4 bg-deepred/10 border border-deepred rounded-lg flex items-center space-x-2", children: [_jsx(AlertTriangle, { className: "h-5 w-5 text-deepred" }), _jsx("span", { className: "text-deepred text-small", children: error })] })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-small font-heading text-charcoal mb-2", children: "Admin Email Address" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx(Mail, { className: "h-5 w-5 text-gray" }) }), _jsx("input", { id: "email", name: "email", type: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value), className: `input pl-10 pr-3 ${validationErrors.email ? 'border-deepred focus:ring-deepred' : ''}`, placeholder: "admin@thehuddleco.com", "aria-invalid": !!validationErrors.email, "aria-describedby": validationErrors.email ? 'email-error' : undefined })] }), validationErrors.email && (_jsxs("p", { id: "email-error", className: "mt-1 text-small text-deepred flex items-center", children: [_jsx(AlertTriangle, { className: "h-4 w-4 mr-1" }), validationErrors.email] }))] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "password", className: "block text-small font-heading text-charcoal mb-2", children: "Password" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx(Lock, { className: "h-5 w-5 text-gray" }) }), _jsx("input", { id: "password", name: "password", type: showPassword ? 'text' : 'password', required: true, value: password, onChange: (e) => setPassword(e.target.value), className: `input pl-10 pr-10 ${validationErrors.password ? 'border-deepred focus:ring-deepred' : ''}`, placeholder: "Enter admin password", "aria-invalid": !!validationErrors.password, "aria-describedby": validationErrors.password ? 'password-error' : undefined }), _jsx("button", { type: "button", className: "absolute inset-y-0 right-0 pr-3 flex items-center", onClick: () => setShowPassword(!showPassword), children: showPassword ? _jsx(EyeOff, { className: "h-5 w-5 text-gray hover:text-charcoal" }) : _jsx(Eye, { className: "h-5 w-5 text-gray hover:text-charcoal" }) })] }), validationErrors.password && (_jsxs("p", { id: "password-error", className: "mt-1 text-small text-deepred flex items-center", children: [_jsx(AlertTriangle, { className: "h-4 w-4 mr-1" }), validationErrors.password] }))] }), _jsx("div", { className: "bg-skyblue/10 border border-skyblue rounded-lg p-4", children: _jsxs("div", { className: "flex items-start space-x-2", children: [_jsx(Shield, { className: "h-5 w-5 text-skyblue mt-0.5" }), _jsxs("div", { children: [_jsx("h4", { className: "text-small font-heading text-skyblue", children: "Demo Credentials" }), _jsxs("p", { className: "text-small text-skyblue mt-1", children: ["Email: admin@thehuddleco.com", _jsx("br", {}), "Password: admin123"] })] })] }) }), _jsx("button", { type: "submit", disabled: isLoading, className: "btn-primary w-full {isLoading ? 'btn-disabled' : ''}", children: isLoading ? (_jsxs("div", { className: "flex items-center justify-center", children: [_jsx("div", { className: "animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" }), "Authenticating..."] })) : ('Access Admin Portal') })] }), _jsxs("div", { className: "mt-6 text-center", children: [_jsxs("p", { className: "text-small text-gray", children: ["Need help accessing the admin portal?", ' ', _jsx(Link, { to: "/contact", className: "text-skyblue hover:text-skyblue font-heading", children: "Contact support" })] }), _jsx("button", { onClick: handleForgot, className: "mt-3 text-small text-skyblue hover:text-skyblue", children: "Forgot password?" })] })] }), _jsx("div", { className: "text-center", children: _jsx(Link, { to: "/", className: "text-small text-gray hover:text-charcoal", children: "\u2190 Back to main website" }) })] }) }));
};
export default AdminLogin;
