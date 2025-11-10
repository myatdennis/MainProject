"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var lucide_react_1 = require("lucide-react");
var LoadingButton_1 = require("../../components/LoadingButton");
var ToastContext_1 = require("../../context/ToastContext");
var AdminOrganizationCreate = function () {
    var navigate = (0, react_router_dom_1.useNavigate)();
    var showToast = (0, ToastContext_1.useToast)().showToast;
    var _a = (0, react_1.useState)(false), loading = _a[0], setLoading = _a[1];
    var _b = (0, react_1.useState)({
        name: '',
        type: '',
        industry: '',
        size: '',
        contactPerson: '',
        contactEmail: '',
        contactPhone: '',
        website: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        description: '',
        subscription: 'Standard'
    }), formData = _b[0], setFormData = _b[1];
    var organizationTypes = [
        'Educational Institution',
        'Healthcare Organization',
        'Non-Profit',
        'Government Agency',
        'Corporate/Business',
        'Community Organization'
    ];
    var industries = [
        'Education',
        'Healthcare',
        'Technology',
        'Finance',
        'Manufacturing',
        'Retail',
        'Non-Profit',
        'Government',
        'Other'
    ];
    var organizationSizes = [
        '1-10 employees',
        '11-50 employees',
        '51-200 employees',
        '201-1000 employees',
        '1000+ employees'
    ];
    var subscriptionTiers = [
        'Standard',
        'Premium',
        'Enterprise'
    ];
    var handleInputChange = function (field, value) {
        setFormData(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[field] = value, _a)));
        });
    };
    var handleSubmit = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var newOrganization, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    // Basic validation
                    if (!formData.name.trim() || !formData.contactPerson.trim() || !formData.contactEmail.trim()) {
                        showToast('Please fill in all required fields', 'error');
                        return [2 /*return*/];
                    }
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    // Simulate API call
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                case 2:
                    // Simulate API call
                    _a.sent();
                    newOrganization = __assign(__assign({ id: Date.now().toString() }, formData), { status: 'active', totalLearners: 0, activeLearners: 0, completionRate: 0, createdAt: new Date().toISOString() });
                    console.log('Created organization:', newOrganization);
                    showToast('Organization created successfully!', 'success');
                    // Navigate back to organizations list
                    navigate('/admin/organizations');
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    showToast('Failed to create organization. Please try again.', 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-4xl mx-auto", children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-8", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4 mb-4", children: [(0, jsx_runtime_1.jsx)("button", { onClick: function () { return navigate('/admin/organizations'); }, className: "p-2 text-gray-500 hover:text-gray-700 rounded-lg transition-colors", title: "Back to Organizations", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowLeft, { className: "h-5 w-5" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-bold text-gray-900", children: "Create Organization" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600", children: "Add a new client organization to the system" })] })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200", children: (0, jsx_runtime_1.jsxs)("form", { onSubmit: handleSubmit, className: "p-6 space-y-8", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Building2, { className: "h-5 w-5 text-gray-600" }), (0, jsx_runtime_1.jsx)("span", { children: "Basic Information" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Organization Name *" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: formData.name, onChange: function (e) { return handleInputChange('name', e.target.value); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Enter organization name", required: true })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Organization Type" }), (0, jsx_runtime_1.jsxs)("select", { value: formData.type, onChange: function (e) { return handleInputChange('type', e.target.value); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "Select Type" }), organizationTypes.map(function (type) { return ((0, jsx_runtime_1.jsx)("option", { value: type, children: type }, type)); })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Industry" }), (0, jsx_runtime_1.jsxs)("select", { value: formData.industry, onChange: function (e) { return handleInputChange('industry', e.target.value); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "Select Industry" }), industries.map(function (industry) { return ((0, jsx_runtime_1.jsx)("option", { value: industry, children: industry }, industry)); })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Organization Size" }), (0, jsx_runtime_1.jsxs)("select", { value: formData.size, onChange: function (e) { return handleInputChange('size', e.target.value); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "Select Size" }), organizationSizes.map(function (size) { return ((0, jsx_runtime_1.jsx)("option", { value: size, children: size }, size)); })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Subscription Tier" }), (0, jsx_runtime_1.jsx)("select", { value: formData.subscription, onChange: function (e) { return handleInputChange('subscription', e.target.value); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: subscriptionTiers.map(function (tier) { return ((0, jsx_runtime_1.jsx)("option", { value: tier, children: tier }, tier)); }) })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Users, { className: "h-5 w-5 text-gray-600" }), (0, jsx_runtime_1.jsx)("span", { children: "Contact Information" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Contact Person *" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: formData.contactPerson, onChange: function (e) { return handleInputChange('contactPerson', e.target.value); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Primary contact name", required: true })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Contact Email *" }), (0, jsx_runtime_1.jsx)("input", { type: "email", value: formData.contactEmail, onChange: function (e) { return handleInputChange('contactEmail', e.target.value); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "contact@organization.com", required: true })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Contact Phone" }), (0, jsx_runtime_1.jsx)("input", { type: "tel", value: formData.contactPhone, onChange: function (e) { return handleInputChange('contactPhone', e.target.value); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "(555) 123-4567" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Website" }), (0, jsx_runtime_1.jsx)("input", { type: "url", value: formData.website, onChange: function (e) { return handleInputChange('website', e.target.value); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "https://www.organization.com" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.MapPin, { className: "h-5 w-5 text-gray-600" }), (0, jsx_runtime_1.jsx)("span", { children: "Address Information" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Street Address" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: formData.address, onChange: function (e) { return handleInputChange('address', e.target.value); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "123 Main Street" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "City" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: formData.city, onChange: function (e) { return handleInputChange('city', e.target.value); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "City" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "State" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: formData.state, onChange: function (e) { return handleInputChange('state', e.target.value); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "State" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "ZIP Code" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: formData.zipCode, onChange: function (e) { return handleInputChange('zipCode', e.target.value); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "12345" })] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }), (0, jsx_runtime_1.jsx)("textarea", { value: formData.description, onChange: function (e) { return handleInputChange('description', e.target.value); }, rows: 4, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Brief description of the organization and its goals..." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-end space-x-4 pt-6 border-t border-gray-200", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: function () { return navigate('/admin/organizations'); }, className: "px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200", disabled: loading, children: "Cancel" }), (0, jsx_runtime_1.jsxs)(LoadingButton_1.default, { type: "submit", loading: loading, variant: "primary", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Save, { className: "h-4 w-4" }), loading ? 'Creating...' : 'Create Organization'] })] })] }) })] }));
};
exports.default = AdminOrganizationCreate;
