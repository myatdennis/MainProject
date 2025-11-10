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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var lucide_react_1 = require("lucide-react");
var orgs_1 = require("../../dal/orgs");
var LoadingButton_1 = require("../../components/LoadingButton");
var EditOrganizationModal_1 = require("../../components/EditOrganizationModal");
var ToastContext_1 = require("../../context/ToastContext");
var recharts_1 = require("recharts");
var OrganizationDetails = function () {
    var id = (0, react_router_dom_1.useParams)().id;
    var showToast = (0, ToastContext_1.useToast)().showToast;
    var _a = (0, react_1.useState)(null), organization = _a[0], setOrganization = _a[1];
    var _b = (0, react_1.useState)(null), orgStats = _b[0], setOrgStats = _b[1];
    var _c = (0, react_1.useState)(true), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)(false), showEditModal = _d[0], setShowEditModal = _d[1];
    var _e = (0, react_1.useState)('overview'), activeTab = _e[0], setActiveTab = _e[1];
    var _f = (0, react_1.useState)([]), members = _f[0], setMembers = _f[1];
    var _g = (0, react_1.useState)(false), membersLoading = _g[0], setMembersLoading = _g[1];
    var _h = (0, react_1.useState)({ userId: '', role: 'member' }), memberForm = _h[0], setMemberForm = _h[1];
    var _j = (0, react_1.useState)(false), memberSubmitting = _j[0], setMemberSubmitting = _j[1];
    var loadMembers = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var data, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!id)
                        return [2 /*return*/];
                    setMembersLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, orgs_1.listOrgMembers)(id)];
                case 2:
                    data = _a.sent();
                    setMembers(data);
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    console.error('Failed to load organization members:', error_1);
                    showToast('Failed to load organization members', 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setMembersLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [id, showToast]);
    (0, react_1.useEffect)(function () {
        var fetchData = function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, orgData, statsData, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!id)
                            return [2 /*return*/];
                        setLoading(true);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, Promise.all([
                                (0, orgs_1.getOrg)(id),
                                (0, orgs_1.getOrgStats)(id)
                            ])];
                    case 2:
                        _a = _b.sent(), orgData = _a[0], statsData = _a[1];
                        setOrganization(orgData);
                        setOrgStats(statsData);
                        return [3 /*break*/, 5];
                    case 3:
                        error_2 = _b.sent();
                        showToast('Failed to load organization details', 'error');
                        return [3 /*break*/, 5];
                    case 4:
                        setLoading(false);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        fetchData();
    }, [id, showToast]);
    (0, react_1.useEffect)(function () {
        loadMembers();
    }, [loadMembers]);
    var handleOrganizationUpdated = function (updatedOrg) {
        setOrganization(updatedOrg);
        showToast('Organization updated successfully!', 'success');
    };
    var handleAddMember = function () { return __awaiter(void 0, void 0, void 0, function () {
        var userId, member_1, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!id)
                        return [2 /*return*/];
                    userId = memberForm.userId.trim();
                    if (!userId) {
                        showToast('User ID is required', 'error');
                        return [2 /*return*/];
                    }
                    setMemberSubmitting(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, orgs_1.addOrgMember)(id, { userId: userId, role: memberForm.role })];
                case 2:
                    member_1 = _a.sent();
                    setMembers(function (prev) {
                        var exists = prev.find(function (m) { return m.id === member_1.id; });
                        if (exists) {
                            return prev.map(function (m) { return (m.id === member_1.id ? member_1 : m); });
                        }
                        return __spreadArray([member_1], prev, true);
                    });
                    setMemberForm(function (form) { return (__assign(__assign({}, form), { userId: '' })); });
                    showToast('Member added successfully', 'success');
                    return [3 /*break*/, 5];
                case 3:
                    error_3 = _a.sent();
                    console.error('Failed to add organization member:', error_3);
                    showToast('Failed to add organization member', 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setMemberSubmitting(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleRemoveMember = function (membershipId) { return __awaiter(void 0, void 0, void 0, function () {
        var error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!id)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, orgs_1.removeOrgMember)(id, membershipId)];
                case 2:
                    _a.sent();
                    setMembers(function (prev) { return prev.filter(function (member) { return member.id !== membershipId; }); });
                    showToast('Member removed successfully', 'success');
                    return [3 /*break*/, 4];
                case 3:
                    error_4 = _a.sent();
                    console.error('Failed to remove organization member:', error_4);
                    showToast('Failed to remove organization member', 'error');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    if (loading) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center h-64", children: (0, jsx_runtime_1.jsx)("div", { className: "w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    }
    if (!organization) {
        return ((0, jsx_runtime_1.jsxs)("div", { className: "text-center py-12", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertCircle, { className: "w-12 h-12 text-gray-400 mx-auto mb-4" }), (0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "Organization Not Found" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mb-4", children: "The organization you're looking for doesn't exist." }), (0, jsx_runtime_1.jsxs)(react_router_dom_1.Link, { to: "/admin/organizations", className: "inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ArrowLeft, { className: "w-4 h-4 mr-2" }), "Back to Organizations"] })] }));
    }
    var getStatusColor = function (status) {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'trial': return 'bg-blue-100 text-blue-800';
            case 'inactive': return 'bg-yellow-100 text-yellow-800';
            case 'suspended': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    var getStatusIcon = function (status) {
        switch (status) {
            case 'active': return (0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "w-4 h-4 text-green-500" });
            case 'trial': return (0, jsx_runtime_1.jsx)(lucide_react_1.Clock, { className: "w-4 h-4 text-blue-500" });
            case 'inactive': return (0, jsx_runtime_1.jsx)(lucide_react_1.AlertCircle, { className: "w-4 h-4 text-yellow-500" });
            case 'suspended': return (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "w-4 h-4 text-red-500" });
            default: return (0, jsx_runtime_1.jsx)(lucide_react_1.AlertCircle, { className: "w-4 h-4 text-gray-500" });
        }
    };
    var COLORS = ['#3A7DFF', '#228B22', '#F6C87B', '#D72638', '#de7b12'];
    var tabs = [
        { id: 'overview', label: 'Overview', icon: lucide_react_1.BarChart3 },
        { id: 'users', label: 'Users & Learners', icon: lucide_react_1.Users },
        { id: 'analytics', label: 'Analytics', icon: lucide_react_1.TrendingUp },
        { id: 'settings', label: 'Settings', icon: lucide_react_1.Settings },
        { id: 'billing', label: 'Billing', icon: lucide_react_1.CreditCard },
    ];
    return ((0, jsx_runtime_1.jsxs)("div", { className: "max-w-7xl mx-auto space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg shadow-sm border border-gray-200 p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4", children: [(0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/organizations", className: "p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowLeft, { className: "w-5 h-5" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-blue-100 p-3 rounded-lg", children: organization.logo ? ((0, jsx_runtime_1.jsx)("img", { src: organization.logo, alt: "Logo", className: "w-8 h-8 rounded" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Building2, { className: "w-8 h-8 text-blue-600" })) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-bold text-gray-900", children: organization.name }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3 mt-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: organization.type }), (0, jsx_runtime_1.jsx)("span", { className: "text-gray-300", children: "\u2022" }), (0, jsx_runtime_1.jsxs)("div", { className: "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ".concat(getStatusColor(organization.status)), children: [getStatusIcon(organization.status), (0, jsx_runtime_1.jsx)("span", { className: "ml-1 capitalize", children: organization.status })] }), organization.tags && organization.tags.map(function (tag) { return ((0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800", children: tag }, tag)); })] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsxs)("button", { className: "flex items-center space-x-2 px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Share, { className: "w-4 h-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Share" })] }), (0, jsx_runtime_1.jsxs)("button", { className: "flex items-center space-x-2 px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Download, { className: "w-4 h-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Export" })] }), (0, jsx_runtime_1.jsxs)(LoadingButton_1.default, { onClick: function () { return setShowEditModal(true); }, variant: "primary", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Edit, { className: "w-4 h-4" }), "Edit Organization"] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-4 gap-4 mt-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-blue-50 rounded-lg p-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Users, { className: "w-8 h-8 text-blue-600" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-blue-900", children: organization.totalLearners }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-blue-700", children: "Total Learners" })] })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "bg-green-50 rounded-lg p-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Activity, { className: "w-8 h-8 text-green-600" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-green-900", children: organization.activeLearners }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-green-700", children: "Active Learners" })] })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "bg-yellow-50 rounded-lg p-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Target, { className: "w-8 h-8 text-yellow-600" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-2xl font-bold text-yellow-900", children: [organization.completionRate, "%"] }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-yellow-700", children: "Completion Rate" })] })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "bg-purple-50 rounded-lg p-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Award, { className: "w-8 h-8 text-purple-600" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-purple-900", children: organization.cohorts.length }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-purple-700", children: "Active Cohorts" })] })] }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg shadow-sm border border-gray-200", children: [(0, jsx_runtime_1.jsx)("div", { className: "border-b border-gray-200", children: (0, jsx_runtime_1.jsx)("nav", { className: "flex space-x-8 px-6", children: tabs.map(function (tab) { return ((0, jsx_runtime_1.jsxs)("button", { onClick: function () { return setActiveTab(tab.id); }, className: "py-3 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ".concat(activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'), children: [(0, jsx_runtime_1.jsx)(tab.icon, { className: "w-4 h-4" }), (0, jsx_runtime_1.jsx)("span", { children: tab.label })] }, tab.id)); }) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "p-6", children: [activeTab === 'overview' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-gray-900", children: "Organization Information" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Mail, { className: "w-5 h-5 text-gray-400" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: "Primary Contact" }), (0, jsx_runtime_1.jsx)("div", { className: "text-gray-600", children: organization.contactPerson }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-500", children: organization.contactEmail })] })] }), organization.contactPhone && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Phone, { className: "w-5 h-5 text-gray-400" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: "Phone" }), (0, jsx_runtime_1.jsx)("div", { className: "text-gray-600", children: organization.contactPhone })] })] })), organization.website && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Globe, { className: "w-5 h-5 text-gray-400" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: "Website" }), (0, jsx_runtime_1.jsx)("a", { href: organization.website, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:underline", children: organization.website })] })] })), organization.address && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-start space-x-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.MapPin, { className: "w-5 h-5 text-gray-400 mt-0.5" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: "Address" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-gray-600", children: [organization.address, (0, jsx_runtime_1.jsx)("br", {}), organization.city && "".concat(organization.city, ", "), organization.state, " ", organization.postalCode, (0, jsx_runtime_1.jsx)("br", {}), organization.country] })] })] }))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-gray-900", children: "Subscription Details" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CreditCard, { className: "w-5 h-5 text-gray-400" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: "Plan" }), (0, jsx_runtime_1.jsx)("div", { className: "text-gray-600", children: organization.subscription }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-500", children: organization.billingCycle && "Billed ".concat(organization.billingCycle) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Calendar, { className: "w-5 h-5 text-gray-400" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: "Contract Period" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-gray-600", children: [organization.contractStart ? new Date(organization.contractStart).toLocaleDateString() : 'Not set', organization.contractEnd && " - ".concat(new Date(organization.contractEnd).toLocaleDateString())] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Zap, { className: "w-5 h-5 text-gray-400" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: "Limits" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-gray-600 space-y-1", children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Max Learners: ", organization.maxLearners || 'Unlimited'] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Max Courses: ", organization.maxCourses || 'Unlimited'] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Storage: ", organization.maxStorage || 'Unlimited', " GB"] })] })] })] })] })] })] }), orgStats && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Performance Overview" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-gray-50 rounded-lg p-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900 mb-3", children: "User Growth (12 months)" }), (0, jsx_runtime_1.jsx)("div", { className: "h-40", children: (0, jsx_runtime_1.jsx)(recharts_1.ResponsiveContainer, { width: "100%", height: "100%", children: (0, jsx_runtime_1.jsxs)(recharts_1.LineChart, { data: orgStats.trends.userGrowth, children: [(0, jsx_runtime_1.jsx)(recharts_1.XAxis, { dataKey: "month", fontSize: 12 }), (0, jsx_runtime_1.jsx)(recharts_1.YAxis, { fontSize: 12 }), (0, jsx_runtime_1.jsx)(recharts_1.CartesianGrid, { strokeDasharray: "3 3" }), (0, jsx_runtime_1.jsx)(recharts_1.Tooltip, {}), (0, jsx_runtime_1.jsx)(recharts_1.Line, { type: "monotone", dataKey: "users", stroke: "#3A7DFF", strokeWidth: 2 })] }) }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-gray-50 rounded-lg p-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900 mb-3", children: "Module Progress" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: Object.entries(organization.modules).map(function (_a) {
                                                                    var module = _a[0], progress = _a[1];
                                                                    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium text-gray-700 capitalize", children: module }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "w-16 h-2 bg-gray-200 rounded-full", children: (0, jsx_runtime_1.jsx)("div", { className: "h-2 bg-blue-500 rounded-full", style: { width: "".concat(Number(progress), "%") } }) }), (0, jsx_runtime_1.jsxs)("span", { className: "text-sm text-gray-600", children: [Number(progress), "%"] })] })] }, module));
                                                                }) })] })] })] })), (organization.description || organization.notes) && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [organization.description && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-gray-900 mb-2", children: "Description" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600", children: organization.description })] })), organization.notes && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-gray-900 mb-2", children: "Internal Notes" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg p-3", children: organization.notes })] }))] }))] })), activeTab === 'users' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-lg border border-gray-200 shadow-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 border-b border-gray-200", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("h3", { className: "text-lg font-semibold text-gray-900 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("span", { children: "Organization Members" }), (0, jsx_runtime_1.jsx)(lucide_react_1.Users, { className: "w-4 h-4 text-gray-500" })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600", children: "Manage member access for this organization workspace." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col md:flex-row md:items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: memberForm.userId, onChange: function (e) { return setMemberForm(function (form) { return (__assign(__assign({}, form), { userId: e.target.value })); }); }, placeholder: "Supabase User ID", className: "w-full md:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" }), (0, jsx_runtime_1.jsxs)("select", { value: memberForm.role, onChange: function (e) { return setMemberForm(function (form) { return (__assign(__assign({}, form), { role: e.target.value })); }); }, className: "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", children: [(0, jsx_runtime_1.jsx)("option", { value: "member", children: "Member" }), (0, jsx_runtime_1.jsx)("option", { value: "editor", children: "Editor" }), (0, jsx_runtime_1.jsx)("option", { value: "manager", children: "Manager" }), (0, jsx_runtime_1.jsx)("option", { value: "admin", children: "Admin" }), (0, jsx_runtime_1.jsx)("option", { value: "owner", children: "Owner" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: handleAddMember, disabled: memberSubmitting, className: "inline-flex items-center justify-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-60", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.UserPlus, { className: "w-4 h-4 mr-2" }), memberSubmitting ? 'Adding…' : 'Add Member'] })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-hidden", children: membersLoading ? ((0, jsx_runtime_1.jsx)("div", { className: "p-6 flex items-center justify-center text-sm text-gray-500", children: "Loading members\u2026" })) : members.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "p-6 text-sm text-gray-500", children: "No members found for this organization." })) : ((0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full divide-y divide-gray-200", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-gray-50", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "User ID" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Role" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Invited By" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Added" }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { className: "bg-white divide-y divide-gray-200", children: members.map(function (member) {
                                                                    var _a;
                                                                    return ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-sm text-gray-900 font-mono", children: member.userId }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-sm text-gray-700 capitalize", children: member.role }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-sm text-gray-500 font-mono", children: (_a = member.invitedBy) !== null && _a !== void 0 ? _a : '—' }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-sm text-gray-500", children: new Date(member.createdAt).toLocaleString() }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-right", children: (0, jsx_runtime_1.jsxs)("button", { onClick: function () { return handleRemoveMember(member.id); }, className: "inline-flex items-center px-2.5 py-1.5 border border-red-200 text-sm text-red-600 rounded-lg hover:bg-red-50", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "w-4 h-4 mr-1" }), "Remove"] }) })] }, member.id));
                                                                }) })] }) })) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-gray-900", children: "User Engagement Insights" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { className: "px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50", children: "Import Users" }), (0, jsx_runtime_1.jsx)("button", { className: "px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600", children: "Add User" })] })] }), orgStats && ((0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-gray-50 rounded-lg p-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900 mb-3", children: "User Engagement" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Daily Active" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium", children: orgStats.engagement.dailyActiveUsers })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Weekly Active" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium", children: orgStats.engagement.weeklyActiveUsers })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Monthly Active" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium", children: orgStats.engagement.monthlyActiveUsers })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-gray-50 rounded-lg p-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900 mb-3", children: "Learning Performance" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Courses Completed" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium", children: orgStats.performance.coursesCompleted })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Certificates Issued" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium", children: orgStats.performance.certificatesIssued })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Avg Session Time" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-medium", children: [orgStats.overview.avgSessionTime, "min"] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-gray-50 rounded-lg p-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900 mb-3", children: "Average Scores" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: Object.entries(orgStats.performance.avgScores || {}).map(function (_a) {
                                                            var module = _a[0], score = _a[1];
                                                            return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600 capitalize", children: module }), (0, jsx_runtime_1.jsxs)("span", { className: "font-medium", children: [score, "%"] })] }, module));
                                                        }) })] })] })), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900 mb-3", children: "Active Cohorts" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: organization.cohorts.map(function (cohort, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between p-3 border border-gray-200 rounded-lg", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-medium text-gray-900", children: cohort }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Active" })] }, index)); }) })] })] })), activeTab === 'analytics' && orgStats && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-gray-900", children: "Analytics Dashboard" }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-gray-50 rounded-lg p-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900 mb-3", children: "Daily Completions (30 days)" }), (0, jsx_runtime_1.jsx)("div", { className: "h-64", children: (0, jsx_runtime_1.jsx)(recharts_1.ResponsiveContainer, { width: "100%", height: "100%", children: (0, jsx_runtime_1.jsxs)(recharts_1.BarChart, { data: orgStats.trends.completionTrends, children: [(0, jsx_runtime_1.jsx)(recharts_1.XAxis, { dataKey: "date", fontSize: 12 }), (0, jsx_runtime_1.jsx)(recharts_1.YAxis, { fontSize: 12 }), (0, jsx_runtime_1.jsx)(recharts_1.CartesianGrid, { strokeDasharray: "3 3" }), (0, jsx_runtime_1.jsx)(recharts_1.Tooltip, {}), (0, jsx_runtime_1.jsx)(recharts_1.Bar, { dataKey: "completions", fill: "#228B22" })] }) }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-gray-50 rounded-lg p-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900 mb-3", children: "Module Progress Distribution" }), (0, jsx_runtime_1.jsx)("div", { className: "h-48", children: (0, jsx_runtime_1.jsx)(recharts_1.ResponsiveContainer, { width: "100%", height: "100%", children: (0, jsx_runtime_1.jsxs)(recharts_1.PieChart, { children: [(0, jsx_runtime_1.jsx)(recharts_1.Pie, { data: Object.entries(organization.modules).map(function (_a) {
                                                                            var name = _a[0], value = _a[1];
                                                                            return ({ name: name, value: value });
                                                                        }), cx: "50%", cy: "50%", outerRadius: 60, dataKey: "value", label: true, children: Object.entries(organization.modules).map(function (_, index) { return ((0, jsx_runtime_1.jsx)(recharts_1.Cell, { fill: COLORS[index % COLORS.length] }, "cell-".concat(index))); }) }), (0, jsx_runtime_1.jsx)(recharts_1.Tooltip, {})] }) }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-gray-50 rounded-lg p-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900 mb-3", children: "Key Metrics" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "User Retention Rate" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-green-600", children: [Math.round((orgStats.engagement.weeklyActiveUsers / orgStats.overview.totalUsers) * 100), "%"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Course Completion Rate" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-blue-600", children: [organization.completionRate, "%"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Average Score" }), (0, jsx_runtime_1.jsxs)("span", { className: "font-semibold text-purple-600", children: [orgStats.performance.avgScores && Object.keys(orgStats.performance.avgScores).length > 0
                                                                                ? Math.round(Object.values(orgStats.performance.avgScores).reduce(function (a, b) { return a + b; }, 0) / Object.values(orgStats.performance.avgScores).length)
                                                                                : 0, "%"] })] })] })] })] })] })), activeTab === 'settings' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-gray-900", children: "Organization Settings" }), organization.features && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900 mb-3", children: "Enabled Features" }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-2 gap-4", children: Object.entries(organization.features).map(function (_a) {
                                                    var feature = _a[0], enabled = _a[1];
                                                    return ((0, jsx_runtime_1.jsx)("div", { className: "p-3 border rounded-lg ".concat(enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'), children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-medium capitalize", children: feature.replace(/([A-Z])/g, ' $1').trim() }), (0, jsx_runtime_1.jsx)("div", { className: "w-2 h-2 rounded-full ".concat(enabled ? 'bg-green-500' : 'bg-gray-400') })] }) }, feature));
                                                }) })] })), organization.settings && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900 mb-3", children: "Configuration" }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: Object.entries(organization.settings).map(function (_a) {
                                                    var setting = _a[0], value = _a[1];
                                                    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between p-3 border border-gray-200 rounded-lg", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-medium capitalize", children: setting.replace(/([A-Z])/g, ' $1').trim() }), (0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : String(value) })] }, setting));
                                                }) })] }))] })), activeTab === 'billing' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-gray-900", children: "Billing & Subscription" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900", children: "Current Plan" }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-blue-900", children: organization.subscription }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm text-blue-700", children: organization.billingCycle })] }), organization.customPricing && organization.customPricing > 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "text-2xl font-bold text-blue-900", children: ["$", organization.customPricing, "/month"] })) : ((0, jsx_runtime_1.jsx)("div", { className: "text-sm text-blue-700", children: "Custom pricing" }))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-gray-900", children: "Billing Contact" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-sm", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Email:" }), (0, jsx_runtime_1.jsx)("span", { className: "ml-2 font-medium", children: organization.billingEmail || organization.contactEmail })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Next billing:" }), (0, jsx_runtime_1.jsx)("span", { className: "ml-2 font-medium", children: organization.contractEnd ? new Date(organization.contractEnd).toLocaleDateString() : 'Not set' })] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "font-medium text-yellow-900 mb-2", children: "Usage & Limits" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-3 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-yellow-700", children: "Learners" }), (0, jsx_runtime_1.jsxs)("div", { className: "font-semibold text-yellow-900", children: [organization.totalLearners, " / ", organization.maxLearners || '∞'] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-yellow-700", children: "Courses" }), (0, jsx_runtime_1.jsxs)("div", { className: "font-semibold text-yellow-900", children: [organization.cohorts.length, " / ", organization.maxCourses || '∞'] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-yellow-700", children: "Storage" }), (0, jsx_runtime_1.jsxs)("div", { className: "font-semibold text-yellow-900", children: ["2.3 GB / ", organization.maxStorage || '∞', " GB"] })] })] })] })] }))] })] }), (0, jsx_runtime_1.jsx)(EditOrganizationModal_1.default, { isOpen: showEditModal, onClose: function () { return setShowEditModal(false); }, organization: organization, onOrganizationUpdated: handleOrganizationUpdated })] }));
};
exports.default = OrganizationDetails;
