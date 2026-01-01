"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var SecureAuthContext_1 = require("../../context/SecureAuthContext");
var lucide_react_1 = require("lucide-react");
var validators_1 = require("../../utils/validators");
var sanitize_1 = require("../../utils/sanitize");
var AdminLogin = function () {
    var _a = (0, SecureAuthContext_1.useSecureAuth)(), login = _a.login, isAuthenticated = _a.isAuthenticated, forgotPassword = _a.forgotPassword, authInitializing = _a.authInitializing;
    var _b = (0, react_1.useState)('mya@the-huddle.co'), email = _b[0], setEmail = _b[1];
    var _c = (0, react_1.useState)('admin123'), password = _c[0], setPassword = _c[1];
    var _d = (0, react_1.useState)(false), showPassword = _d[0], setShowPassword = _d[1];
    var _e = (0, react_1.useState)(false), isLoading = _e[0], setIsLoading = _e[1];
    var _f = (0, react_1.useState)(''), error = _f[0], setError = _f[1];
    var _g = (0, react_1.useState)({}), validationErrors = _g[0], setValidationErrors = _g[1];
    var navigate = (0, react_router_dom_1.useNavigate)();
    (0, react_1.useEffect)(function () {
        if (isAuthenticated.admin)
            navigate('/admin/dashboard');
    }, [isAuthenticated.admin, navigate]);
    if (authInitializing) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen flex items-center justify-center bg-softwhite", children: (0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-sunrise mx-auto mb-4" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-h2 font-heading text-charcoal mb-2", children: "Initializing authentication..." }), (0, jsx_runtime_1.jsx)("p", { className: "text-body text-gray", children: "Please wait while we check your authentication status." })] }) }));
    }
    var handleSubmit = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var validation, errors_1, sanitizedEmail, sanitizedPassword, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    setIsLoading(true);
                    setError('');
                    setValidationErrors({});
                    validation = validators_1.loginSchema.safeParse({ email: email, password: password });
                    if (!validation.success) {
                        errors_1 = {};
                        validation.error.errors.forEach(function (err) {
                            if (err.path[0] === 'email')
                                errors_1.email = err.message;
                            if (err.path[0] === 'password')
                                errors_1.password = err.message;
                        });
                        setValidationErrors(errors_1);
                        setIsLoading(false);
                        return [2 /*return*/];
                    }
                    sanitizedEmail = (0, sanitize_1.sanitizeText)(email);
                    sanitizedPassword = (0, sanitize_1.sanitizeText)(password);
                    return [4 /*yield*/, login(sanitizedEmail, sanitizedPassword, 'admin')];
                case 1:
                    result = _a.sent();
                    setIsLoading(false);
                    if (result.success)
                        navigate('/admin/dashboard');
                    else
                        setError(result.error || 'Authentication failed.');
                    return [2 /*return*/];
            }
        });
    }); };
    var handleForgot = function () { return __awaiter(void 0, void 0, void 0, function () {
        var validation, ok;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!email)
                        return [2 /*return*/, setError('Enter your email to reset password')];
                    validation = validators_1.emailSchema.safeParse(email);
                    if (!validation.success) {
                        setError(((_a = validation.error.errors[0]) === null || _a === void 0 ? void 0 : _a.message) || 'Invalid email address');
                        return [2 /*return*/];
                    }
                    setIsLoading(true);
                    return [4 /*yield*/, forgotPassword(email)];
                case 1:
                    ok = _b.sent();
                    setIsLoading(false);
                    if (ok)
                        setError('Password reset sent — check your email');
                    else
                        setError('Failed to send reset email');
                    return [2 /*return*/];
            }
        });
    }); };
    return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen bg-softwhite flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8", children: (0, jsx_runtime_1.jsxs)("div", { className: "max-w-md w-full space-y-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center space-x-2 mb-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-sunrise p-3 rounded-xl shadow-card", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Shield, { className: "h-8 w-8 text-white" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "text-left", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-heading text-h2 text-charcoal", children: "Admin Portal" }), (0, jsx_runtime_1.jsx)("p", { className: "text-small text-gray", children: "The Huddle Co." })] })] }), (0, jsx_runtime_1.jsx)("h2", { className: "text-h1 font-heading text-charcoal mb-2", children: "Secure Access" }), (0, jsx_runtime_1.jsx)("p", { className: "text-body text-gray", children: "Administrator and facilitator login only" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card", children: [error && ((0, jsx_runtime_1.jsxs)("div", { className: "mb-6 p-4 bg-deepred/10 border border-deepred rounded-lg flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-5 w-5 text-deepred" }), (0, jsx_runtime_1.jsx)("span", { className: "text-deepred text-small", children: error })] })), (0, jsx_runtime_1.jsxs)("form", { onSubmit: handleSubmit, className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "email", className: "block text-small font-heading text-charcoal mb-2", children: "Admin Email Address" }), (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Mail, { className: "h-5 w-5 text-gray" }) }), (0, jsx_runtime_1.jsx)("input", { id: "email", name: "email", type: "email", required: true, value: email, onChange: function (e) { return setEmail(e.target.value); }, className: "input pl-10 pr-3 ".concat(validationErrors.email ? 'border-deepred focus:ring-deepred' : ''), placeholder: "mya@the-huddle.co", "aria-invalid": !!validationErrors.email, "aria-describedby": validationErrors.email ? 'email-error' : undefined })] }), validationErrors.email && ((0, jsx_runtime_1.jsxs)("p", { id: "email-error", className: "mt-1 text-small text-deepred flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-4 w-4 mr-1" }), validationErrors.email] }))] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "password", className: "block text-small font-heading text-charcoal mb-2", children: "Password" }), (0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Lock, { className: "h-5 w-5 text-gray" }) }), (0, jsx_runtime_1.jsx)("input", { id: "password", name: "password", type: showPassword ? 'text' : 'password', required: true, value: password, onChange: function (e) { return setPassword(e.target.value); }, className: "input pl-10 pr-10 ".concat(validationErrors.password ? 'border-deepred focus:ring-deepred' : ''), placeholder: "Enter admin password", "aria-invalid": !!validationErrors.password, "aria-describedby": validationErrors.password ? 'password-error' : undefined }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "absolute inset-y-0 right-0 pr-3 flex items-center", onClick: function () { return setShowPassword(!showPassword); }, children: showPassword ? (0, jsx_runtime_1.jsx)(lucide_react_1.EyeOff, { className: "h-5 w-5 text-gray hover:text-charcoal" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-5 w-5 text-gray hover:text-charcoal" }) })] }), validationErrors.password && ((0, jsx_runtime_1.jsxs)("p", { id: "password-error", className: "mt-1 text-small text-deepred flex items-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-4 w-4 mr-1" }), validationErrors.password] }))] }), (0, jsx_runtime_1.jsx)("div", { className: "bg-skyblue/10 border border-skyblue rounded-lg p-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-start space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Shield, { className: "h-5 w-5 text-skyblue mt-0.5" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h4", { className: "text-small font-heading text-skyblue", children: "Demo Credentials" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-small text-skyblue mt-1", children: ["Email: mya@the-huddle.co", (0, jsx_runtime_1.jsx)("br", {}), "Password: admin123"] })] })] }) }), (0, jsx_runtime_1.jsx)("button", { type: "submit", disabled: isLoading, className: "btn-primary w-full {isLoading ? 'btn-disabled' : ''}", children: isLoading ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" }), "Authenticating..."] })) : ('Access Admin Portal') })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 text-center", children: [(0, jsx_runtime_1.jsxs)("p", { className: "text-small text-gray", children: ["Need help accessing the admin portal?", ' ', (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/contact", className: "text-skyblue hover:text-skyblue font-heading", children: "Contact support" })] }), (0, jsx_runtime_1.jsx)("button", { onClick: handleForgot, className: "mt-3 text-small text-skyblue hover:text-skyblue", children: "Forgot password?" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "text-center", children: (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/", className: "text-small text-gray hover:text-charcoal", children: "\u2190 Back to main website" }) })] }) }));
};
exports.default = AdminLogin;
