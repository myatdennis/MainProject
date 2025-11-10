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
var Button_1 = require("../../components/ui/Button");
var lucide_react_1 = require("lucide-react");
var orgs_1 = require("../../dal/orgs");
var LoadingButton_1 = require("../../components/LoadingButton");
var ConfirmationModal_1 = require("../../components/ConfirmationModal");
var AddOrganizationModal_1 = require("../../components/AddOrganizationModal");
var EditOrganizationModal_1 = require("../../components/EditOrganizationModal");
var ToastContext_1 = require("../../context/ToastContext");
var Breadcrumbs_1 = require("../../components/ui/Breadcrumbs");
var EmptyState_1 = require("../../components/ui/EmptyState");
var AdminOrganizations = function () {
    var showToast = (0, ToastContext_1.useToast)().showToast;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, react_1.useState)(''), searchTerm = _a[0], setSearchTerm = _a[1];
    var _b = (0, react_1.useState)([]), organizations = _b[0], setOrganizations = _b[1];
    var _c = (0, react_1.useState)(false), showDeleteModal = _c[0], setShowDeleteModal = _c[1];
    var _d = (0, react_1.useState)(false), showAddOrgModal = _d[0], setShowAddOrgModal = _d[1];
    var _e = (0, react_1.useState)(false), showEditOrgModal = _e[0], setShowEditOrgModal = _e[1];
    var _f = (0, react_1.useState)(null), orgToDelete = _f[0], setOrgToDelete = _f[1];
    var _g = (0, react_1.useState)(null), orgToEdit = _g[0], setOrgToEdit = _g[1];
    var _h = (0, react_1.useState)(false), loading = _h[0], setLoading = _h[1];
    (0, react_1.useEffect)(function () {
        orgs_1.default.listOrgs().then(setOrganizations).catch(function () { return setOrganizations([]); });
    }, []);
    var filteredOrgs = organizations.filter(function (org) {
        return (org.name || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
            (org.type || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
            (org.contactPerson || '').toString().toLowerCase().includes(searchTerm.toLowerCase());
    });
    var getStatusColor = function (status) {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'inactive':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-red-100 text-red-800';
        }
    };
    var getStatusIcon = function (status) {
        switch (status) {
            case 'active':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-4 w-4 text-green-500" });
            case 'inactive':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Clock, { className: "h-4 w-4 text-yellow-500" });
            default:
                return (0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-4 w-4 text-red-500" });
        }
    };
    var getSubscriptionColor = function (subscription) {
        return subscription === 'Premium'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-blue-100 text-blue-800';
    };
    // Handler functions for button actions
    var handleAddOrganization = function () {
        setShowAddOrgModal(true);
    };
    var handleCreateOrganization = function () {
        navigate('/admin/organizations/new');
    };
    var handleOrganizationAdded = function (newOrganization) {
        setOrganizations(function (prev) { return __spreadArray(__spreadArray([], prev, true), [newOrganization], false); });
        showToast('Organization added successfully!', 'success');
    };
    var handleImport = function () {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = function (e) {
            var _a, _b;
            var file = (_b = (_a = e.target) === null || _a === void 0 ? void 0 : _a.files) === null || _b === void 0 ? void 0 : _b[0];
            if (file) {
                showToast("Importing ".concat(file.name, "..."), 'info');
                setTimeout(function () {
                    showToast('Organization import completed successfully!', 'success');
                }, 3000);
            }
        };
        input.click();
    };
    var handleExport = function () { return __awaiter(void 0, void 0, void 0, function () {
        var csvContent, blob, url, a, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1500); })];
                case 2:
                    _a.sent();
                    csvContent = "Name,Type,Contact Person,Contact Email,Total Learners,Active Learners,Completion Rate,Status\n".concat(filteredOrgs.map(function (org) {
                        return "\"".concat(org.name, "\",\"").concat(org.type, "\",\"").concat(org.contactPerson, "\",\"").concat(org.contactEmail, "\",\"").concat(org.totalLearners, "\",\"").concat(org.activeLearners, "\",\"").concat(org.completionRate, "%\",\"").concat(org.status, "\"");
                    }).join('\n'));
                    blob = new Blob([csvContent], { type: 'text/csv' });
                    url = window.URL.createObjectURL(blob);
                    a = document.createElement('a');
                    a.href = url;
                    a.download = "organizations-export-".concat(new Date().toISOString().split('T')[0], ".csv");
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    showToast('Organizations exported successfully!', 'success');
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    showToast('Failed to export organizations', 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleEditOrganization = function (orgId) {
        var org = organizations.find(function (o) { return o.id === orgId; });
        if (org) {
            setOrgToEdit(org);
            setShowEditOrgModal(true);
        }
    };
    var handleOrganizationUpdated = function (updatedOrganization) {
        setOrganizations(function (prev) { return prev.map(function (org) {
            return org.id === updatedOrganization.id ? updatedOrganization : org;
        }); });
        setShowEditOrgModal(false);
        setOrgToEdit(null);
    };
    var handleDeleteOrganization = function (orgId) {
        setOrgToDelete(orgId);
        setShowDeleteModal(true);
    };
    var confirmDeleteOrganization = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!orgToDelete)
                        return [2 /*return*/];
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                case 2:
                    _a.sent();
                    setOrganizations(function (prev) { return prev.filter(function (org) { return org.id !== orgToDelete; }); });
                    showToast('Organization deleted successfully!', 'success');
                    setShowDeleteModal(false);
                    setOrgToDelete(null);
                    return [3 /*break*/, 5];
                case 3:
                    error_2 = _a.sent();
                    showToast('Failed to delete organization', 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-6", children: (0, jsx_runtime_1.jsx)(Breadcrumbs_1.default, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Organizations', to: '/admin/organizations' }] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-8", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Organization Management" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600", children: "Manage client organizations, track progress, and oversee cohorts" })] }), (0, jsx_runtime_1.jsx)("div", { className: "card-lg card-hover mb-8", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative flex-1 max-w-md", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" }), (0, jsx_runtime_1.jsx)("input", { type: "text", placeholder: "Search organizations...", value: searchTerm, onChange: function (e) { return setSearchTerm(e.target.value); }, className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4", children: [(0, jsx_runtime_1.jsxs)(LoadingButton_1.default, { onClick: handleAddOrganization, variant: "primary", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-4 w-4" }), "Add Organization"] }), (0, jsx_runtime_1.jsxs)(LoadingButton_1.default, { onClick: handleCreateOrganization, variant: "secondary", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Building2, { className: "h-4 w-4" }), "Create Organization"] }), (0, jsx_runtime_1.jsxs)(LoadingButton_1.default, { onClick: handleImport, variant: "secondary", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Upload, { className: "h-4 w-4" }), "Import"] }), (0, jsx_runtime_1.jsxs)(LoadingButton_1.default, { onClick: handleExport, loading: loading, variant: "secondary", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Download, { className: "h-4 w-4" }), "Export"] })] })] }) }), filteredOrgs.length === 0 && ((0, jsx_runtime_1.jsx)("div", { className: "mb-8", children: (0, jsx_runtime_1.jsx)(EmptyState_1.default, { title: "No organizations found", description: searchTerm
                        ? 'Try changing your search to find organizations.'
                        : 'You have not added any organizations yet.', action: (0, jsx_runtime_1.jsx)("button", { className: searchTerm ? 'btn-outline' : 'btn-cta', onClick: function () {
                            if (searchTerm)
                                setSearchTerm('');
                            else
                                handleAddOrganization();
                        }, children: searchTerm ? 'Reset search' : 'Add organization' }) }) })), filteredOrgs.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8", children: filteredOrgs.map(function (org) { return ((0, jsx_runtime_1.jsxs)("div", { className: "card-lg card-hover", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-blue-100 p-2 rounded-lg", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Building2, { className: "h-6 w-6 text-blue-600" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-bold text-gray-900", children: org.name }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600", children: org.type })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [getStatusIcon(org.status), (0, jsx_runtime_1.jsx)(Button_1.default, { asChild: true, variant: "ghost", size: "sm", "aria-label": "View organization", children: (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/organizations/".concat(org.id), children: "View" }) }), (0, jsx_runtime_1.jsx)("button", { className: "p-1 text-gray-400 hover:text-gray-600", children: (0, jsx_runtime_1.jsx)(lucide_react_1.MoreVertical, { className: "h-4 w-4" }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Contact:" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium text-gray-900", children: org.contactPerson })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Learners:" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-sm font-medium text-gray-900", children: [org.activeLearners, "/", org.totalLearners, " active"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Completion:" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-sm font-bold text-green-600", children: [org.completionRate, "%"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Subscription:" }), (0, jsx_runtime_1.jsx)("span", { className: "px-2 py-1 rounded-full text-xs font-medium ".concat(getSubscriptionColor(org.subscription)), children: org.subscription })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium text-gray-700", children: "Overall Progress" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-sm font-bold text-gray-900", children: [org.completionRate, "%"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "w-full bg-gray-200 rounded-full h-2", children: (0, jsx_runtime_1.jsx)("div", { className: "h-2 rounded-full", style: { width: "".concat(org.completionRate, "%"), background: 'var(--gradient-blue-green)' } }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "text-sm font-medium text-gray-700 mb-2", children: "Module Progress" }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-5 gap-1", children: Object.entries(org.modules).map(function (_a) {
                                        var key = _a[0], value = _a[1];
                                        var v = Number(value || 0);
                                        return ((0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "w-full h-2 rounded-full ".concat(v >= 90 ? 'bg-green-500' :
                                                        v >= 70 ? 'bg-yellow-500' :
                                                            v >= 50 ? 'bg-orange-500' : 'bg-red-500') }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-gray-600 mt-1", children: [v, "%"] })] }, key));
                                    }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between pt-4 border-t border-gray-200", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center space-x-2", children: (0, jsx_runtime_1.jsx)("span", { className: "px-2 py-1 rounded-full text-xs font-medium ".concat(getStatusColor(org.status)), children: org.status }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { className: "p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg", title: "View Details", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Edit", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Edit, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Settings", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Settings, { className: "h-4 w-4" }) })] })] })] }, org.id)); }) })), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6 mb-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: "card-lg text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-blue-600", children: organizations.length }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Total Organizations" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-green-600", children: organizations.filter(function (org) { return org.status === 'active'; }).length }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Active Organizations" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-orange-600", children: organizations.reduce(function (acc, org) { return acc + org.totalLearners; }, 0) }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Total Learners" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-purple-600", children: organizations.length === 0 ? '—' : "".concat(Math.round(organizations.reduce(function (acc, org) { return acc + (org.completionRate || 0); }, 0) / organizations.length), "%") }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Avg. Completion" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg overflow-hidden", children: [(0, jsx_runtime_1.jsx)("div", { className: "px-6 py-4 border-b border-gray-200", children: (0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-bold text-gray-900", children: "Organization Details" }) }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-gray-50", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "text-left py-3 px-6 font-semibold text-gray-900", children: "Organization" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Contact" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Learners" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Progress" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Last Activity" }), (0, jsx_runtime_1.jsx)("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: filteredOrgs.map(function (org) {
                                        var _a;
                                        return ((0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-gray-100 hover:bg-gray-50", children: [(0, jsx_runtime_1.jsx)("td", { className: "py-4 px-6", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: org.name }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: org.type }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-gray-500", children: (_a = org.cohorts) === null || _a === void 0 ? void 0 : _a.join(', ') })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-6 text-center", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: org.contactPerson }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: org.contactEmail })] }) }), (0, jsx_runtime_1.jsxs)("td", { className: "py-4 px-6 text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-lg font-bold text-gray-900", children: org.activeLearners }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-gray-600", children: ["of ", org.totalLearners] })] }), (0, jsx_runtime_1.jsxs)("td", { className: "py-4 px-6 text-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-lg font-bold text-green-600", children: [org.completionRate, "%"] }), (0, jsx_runtime_1.jsx)("div", { className: "w-16 bg-gray-200 rounded-full h-2 mt-1 mx-auto", children: (0, jsx_runtime_1.jsx)("div", { className: "bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full", style: { width: "".concat(org.completionRate, "%") } }) })] }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-6 text-center", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center space-x-2", children: [getStatusIcon(org.status), (0, jsx_runtime_1.jsx)("span", { className: "px-2 py-1 rounded-full text-xs font-medium ".concat(getStatusColor(org.status)), children: org.status })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-6 text-center text-sm text-gray-600", children: new Date(org.lastActivity).toLocaleDateString() }), (0, jsx_runtime_1.jsx)("td", { className: "py-4 px-6 text-center", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center space-x-2", children: [(0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/organizations/".concat(org.id), className: "p-1 text-blue-600 hover:text-blue-800", title: "View Details", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/org-profiles/org-profile-".concat(org.id), className: "p-1 text-green-600 hover:text-green-800", title: "View Profile", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Settings, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return handleEditOrganization(org.id); }, className: "p-1 text-gray-600 hover:text-gray-800", title: "Edit", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Edit, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return handleDeleteOrganization(org.id); }, className: "p-1 text-red-600 hover:text-red-800", title: "Delete Organization", children: (0, jsx_runtime_1.jsx)(lucide_react_1.MoreVertical, { className: "h-4 w-4" }) })] }) })] }, org.id));
                                    }) })] }) })] }), (0, jsx_runtime_1.jsx)(AddOrganizationModal_1.default, { isOpen: showAddOrgModal, onClose: function () { return setShowAddOrgModal(false); }, onOrganizationAdded: handleOrganizationAdded }), (0, jsx_runtime_1.jsx)(EditOrganizationModal_1.default, { isOpen: showEditOrgModal, onClose: function () {
                    setShowEditOrgModal(false);
                    setOrgToEdit(null);
                }, organization: orgToEdit, onOrganizationUpdated: handleOrganizationUpdated }), (0, jsx_runtime_1.jsx)(ConfirmationModal_1.default, { isOpen: showDeleteModal, onClose: function () {
                    setShowDeleteModal(false);
                    setOrgToDelete(null);
                }, onConfirm: confirmDeleteOrganization, title: "Delete Organization", message: "Are you sure you want to delete this organization? This action cannot be undone and will remove all associated data including learner progress.", confirmText: "Delete Organization", type: "danger", loading: loading })] }));
};
exports.default = AdminOrganizations;
