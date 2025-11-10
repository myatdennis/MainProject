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
var lucide_react_1 = require("lucide-react");
var AddUserModal_1 = require("../../components/AddUserModal");
var ConfirmationModal_1 = require("../../components/ConfirmationModal");
var CourseAssignmentModal_1 = require("../../components/CourseAssignmentModal");
var LoadingButton_1 = require("../../components/LoadingButton");
var ToastContext_1 = require("../../context/ToastContext");
var PageWrapper_1 = require("../../components/PageWrapper");
var Breadcrumbs_1 = require("../../components/ui/Breadcrumbs");
var EmptyState_1 = require("../../components/ui/EmptyState");
var AdminUsers = function () {
    var showToast = (0, ToastContext_1.useToast)().showToast;
    var _a = (0, react_1.useState)(''), searchTerm = _a[0], setSearchTerm = _a[1];
    var _b = (0, react_1.useState)('all'), filterOrg = _b[0], setFilterOrg = _b[1];
    var _c = (0, react_1.useState)('all'), filterStatus = _c[0], setFilterStatus = _c[1];
    var _d = (0, react_1.useState)([]), selectedUsers = _d[0], setSelectedUsers = _d[1];
    var _e = (0, react_1.useState)(false), showAddUserModal = _e[0], setShowAddUserModal = _e[1];
    var _f = (0, react_1.useState)(false), showDeleteModal = _f[0], setShowDeleteModal = _f[1];
    var _g = (0, react_1.useState)(false), showCourseAssignModal = _g[0], setShowCourseAssignModal = _g[1];
    var _h = (0, react_1.useState)(false), showEditUserModal = _h[0], setShowEditUserModal = _h[1];
    var _j = (0, react_1.useState)(null), userToDelete = _j[0], setUserToDelete = _j[1];
    var _k = (0, react_1.useState)(null), userToEdit = _k[0], setUserToEdit = _k[1];
    var _l = (0, react_1.useState)(false), loading = _l[0], setLoading = _l[1];
    var users = [
        {
            id: '1',
            name: 'Sarah Chen',
            email: 'sarah.chen@pacificcoast.edu',
            organization: 'Pacific Coast University',
            cohort: 'Spring 2025 Leadership',
            role: 'VP Student Affairs',
            enrolled: '2025-01-15',
            lastLogin: '2025-03-10',
            progress: {
                foundations: 100,
                bias: 75,
                empathy: 50,
                conversations: 0,
                planning: 0
            },
            overallProgress: 45,
            status: 'active',
            completedModules: 1,
            totalModules: 5,
            feedbackSubmitted: true
        },
        {
            id: '2',
            name: 'Marcus Rodriguez',
            email: 'mrodriguez@mvhs.edu',
            organization: 'Mountain View High School',
            cohort: 'Spring 2025 Leadership',
            role: 'Athletic Director',
            enrolled: '2025-01-20',
            lastLogin: '2025-03-09',
            progress: {
                foundations: 100,
                bias: 100,
                empathy: 80,
                conversations: 25,
                planning: 0
            },
            overallProgress: 61,
            status: 'active',
            completedModules: 2,
            totalModules: 5,
            feedbackSubmitted: true
        },
        {
            id: '3',
            name: 'Jennifer Walsh',
            email: 'jwalsh@communityimpact.org',
            organization: 'Community Impact Network',
            cohort: 'Spring 2025 Leadership',
            role: 'Executive Director',
            enrolled: '2025-01-10',
            lastLogin: '2025-02-28',
            progress: {
                foundations: 100,
                bias: 50,
                empathy: 0,
                conversations: 0,
                planning: 0
            },
            overallProgress: 30,
            status: 'inactive',
            completedModules: 1,
            totalModules: 5,
            feedbackSubmitted: false
        },
        {
            id: '4',
            name: 'David Thompson',
            email: 'dthompson@regionalfire.gov',
            organization: 'Regional Fire Department',
            cohort: 'Winter 2025 Leadership',
            role: 'Training Commander',
            enrolled: '2024-12-01',
            lastLogin: '2025-03-08',
            progress: {
                foundations: 100,
                bias: 100,
                empathy: 100,
                conversations: 75,
                planning: 50
            },
            overallProgress: 85,
            status: 'active',
            completedModules: 3,
            totalModules: 5,
            feedbackSubmitted: true
        },
        {
            id: '5',
            name: 'Lisa Park',
            email: 'lpark@techforward.com',
            organization: 'TechForward Solutions',
            cohort: 'Spring 2025 Leadership',
            role: 'Chief HR Officer',
            enrolled: '2025-02-01',
            lastLogin: '2025-03-11',
            progress: {
                foundations: 100,
                bias: 100,
                empathy: 100,
                conversations: 100,
                planning: 80
            },
            overallProgress: 96,
            status: 'active',
            completedModules: 4,
            totalModules: 5,
            feedbackSubmitted: true
        }
    ];
    var _m = (0, react_1.useState)(users), usersList = _m[0], setUsersList = _m[1]; // Make users editable
    var organizations = [
        'Pacific Coast University',
        'Mountain View High School',
        'Community Impact Network',
        'Regional Fire Department',
        'TechForward Solutions'
    ];
    var modules = [
        { key: 'foundations', name: 'Foundations of Inclusive Leadership' },
        { key: 'bias', name: 'Recognizing and Mitigating Bias' },
        { key: 'empathy', name: 'Empathy in Action' },
        { key: 'conversations', name: 'Courageous Conversations at Work' },
        { key: 'planning', name: 'Personal & Team Action Planning' }
    ];
    var filteredUsers = usersList.filter(function (user) {
        var matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.organization.toLowerCase().includes(searchTerm.toLowerCase());
        var matchesOrg = filterOrg === 'all' || user.organization === filterOrg;
        var matchesStatus = filterStatus === 'all' || user.status === filterStatus;
        return matchesSearch && matchesOrg && matchesStatus;
    });
    var handleSelectUser = function (userId) {
        setSelectedUsers(function (prev) {
            return prev.includes(userId)
                ? prev.filter(function (id) { return id !== userId; })
                : __spreadArray(__spreadArray([], prev, true), [userId], false);
        });
    };
    var handleSelectAll = function () {
        if (selectedUsers.length === filteredUsers.length) {
            setSelectedUsers([]);
        }
        else {
            setSelectedUsers(filteredUsers.map(function (user) { return user.id; }));
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
    // Handler functions for button actions
    var handleAddUser = function () {
        setShowAddUserModal(true);
    };
    var handleUserAdded = function (newUser) {
        setUsersList(function (prev) { return __spreadArray(__spreadArray([], prev, true), [newUser], false); });
        showToast('User added successfully!', 'success');
    };
    var handleSendReminder = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    // Simulate API call
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                case 2:
                    // Simulate API call
                    _a.sent();
                    showToast("Reminder sent to ".concat(selectedUsers.length, " user(s)"), 'success');
                    setSelectedUsers([]);
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    showToast('Failed to send reminders', 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleAssignCourse = function () {
        setShowCourseAssignModal(true);
    };
    var handleCourseAssignComplete = function () {
        setSelectedUsers([]);
        setShowCourseAssignModal(false);
    };
    var handleImportCSV = function () {
        // Create file input element
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = function (e) {
            var _a, _b;
            var file = (_b = (_a = e.target) === null || _a === void 0 ? void 0 : _a.files) === null || _b === void 0 ? void 0 : _b[0];
            if (file) {
                showToast("Importing ".concat(file.name, "..."), 'info');
                // Here you would implement the actual CSV import logic
                setTimeout(function () {
                    showToast('CSV import completed successfully!', 'success');
                }, 3000);
            }
        };
        input.click();
    };
    var handleExport = function () { return __awaiter(void 0, void 0, void 0, function () {
        var csvContent, blob, url, a, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    // Simulate export
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1500); })];
                case 2:
                    // Simulate export
                    _a.sent();
                    csvContent = "Name,Email,Organization,Status,Progress\n".concat(filteredUsers.map(function (user) {
                        return "\"".concat(user.name, "\",\"").concat(user.email, "\",\"").concat(user.organization, "\",\"").concat(user.status, "\",\"").concat(user.overallProgress, "%\"");
                    }).join('\n'));
                    blob = new Blob([csvContent], { type: 'text/csv' });
                    url = window.URL.createObjectURL(blob);
                    a = document.createElement('a');
                    a.href = url;
                    a.download = "users-export-".concat(new Date().toISOString().split('T')[0], ".csv");
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    showToast('Users exported successfully!', 'success');
                    return [3 /*break*/, 5];
                case 3:
                    error_2 = _a.sent();
                    showToast('Failed to export users', 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleDeleteUser = function (userId) {
        setUserToDelete(userId);
        setShowDeleteModal(true);
    };
    var confirmDeleteUser = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!userToDelete)
                        return [2 /*return*/];
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    // Simulate API call
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                case 2:
                    // Simulate API call
                    _a.sent();
                    setUsersList(function (prev) { return prev.filter(function (user) { return user.id !== userToDelete; }); });
                    showToast('User deleted successfully!', 'success');
                    setShowDeleteModal(false);
                    setUserToDelete(null);
                    return [3 /*break*/, 5];
                case 3:
                    error_3 = _a.sent();
                    showToast('Failed to delete user', 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleEditUser = function (userId) {
        var user = usersList.find(function (u) { return u.id === userId; });
        if (user) {
            setUserToEdit(user);
            setShowEditUserModal(true);
        }
    };
    var handleUserUpdated = function (updatedUser) {
        setUsersList(function (prev) {
            return prev.map(function (user) {
                return user.id === updatedUser.id ? updatedUser : user;
            });
        });
        showToast('User updated successfully!', 'success');
        setShowEditUserModal(false);
        setUserToEdit(null);
    };
    var handleMoreOptions = function (userId) {
        var user = usersList.find(function (u) { return u.id === userId; });
        if (user) {
            // For now, show a menu with common actions
            var actions = [
                'Reset Password',
                'Send Welcome Email',
                'View Activity Log',
                'Duplicate User',
                'Export User Data'
            ];
            var action = prompt("Select action for ".concat(user.name, ":\n").concat(actions.map(function (a, i) { return "".concat(i + 1, ". ").concat(a); }).join('\n'), "\n\nEnter number (1-").concat(actions.length, "):"));
            if (action && parseInt(action) >= 1 && parseInt(action) <= actions.length) {
                var selectedAction = actions[parseInt(action) - 1];
                showToast("".concat(selectedAction, " for ").concat(user.name, " - Feature coming soon!"), 'info');
            }
        }
    };
    return ((0, jsx_runtime_1.jsxs)(PageWrapper_1.default, { children: [(0, jsx_runtime_1.jsx)(Breadcrumbs_1.default, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Users', to: '/admin/users' }] }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-8", children: [(0, jsx_runtime_1.jsx)("h1", { className: "h1", children: "User Management" }), (0, jsx_runtime_1.jsx)("p", { className: "muted-text", children: "Monitor learner progress, assign courses, and manage user accounts" })] }), (0, jsx_runtime_1.jsx)("div", { className: "card mb-8", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 sm:flex-row", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative flex-1 max-w-[520px]", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 muted-text" }), (0, jsx_runtime_1.jsx)("input", { type: "text", placeholder: "Search users...", value: searchTerm, onChange: function (e) { return setSearchTerm(e.target.value); }, className: "input pl-10", "aria-label": "Search users" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Filter, { className: "h-4 w-4 muted-text" }), (0, jsx_runtime_1.jsxs)("select", { value: filterOrg, onChange: function (e) { return setFilterOrg(e.target.value); }, className: "input min-w-[160px]", "aria-label": "Filter by organization", children: [(0, jsx_runtime_1.jsx)("option", { value: "all", children: "All Organizations" }), organizations.map(function (org) { return ((0, jsx_runtime_1.jsx)("option", { value: org, children: org }, org)); })] }), (0, jsx_runtime_1.jsxs)("select", { value: filterStatus, onChange: function (e) { return setFilterStatus(e.target.value); }, className: "input min-w-[140px]", "aria-label": "Filter by status", children: [(0, jsx_runtime_1.jsx)("option", { value: "all", children: "All Status" }), (0, jsx_runtime_1.jsx)("option", { value: "active", children: "Active" }), (0, jsx_runtime_1.jsx)("option", { value: "inactive", children: "Inactive" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [selectedUsers.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsxs)(LoadingButton_1.default, { onClick: handleSendReminder, loading: loading, variant: "primary", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Mail, { className: "icon-16" }), "Send Reminder (", selectedUsers.length, ")"] }), (0, jsx_runtime_1.jsx)(LoadingButton_1.default, { onClick: handleAssignCourse, loading: loading, variant: "success", children: "Assign Course" })] })), (0, jsx_runtime_1.jsxs)(LoadingButton_1.default, { onClick: handleAddUser, variant: "primary", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "icon-16" }), "Add User"] }), (0, jsx_runtime_1.jsxs)(LoadingButton_1.default, { onClick: handleImportCSV, variant: "secondary", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Upload, { className: "icon-16" }), "Import CSV"] }), (0, jsx_runtime_1.jsxs)(LoadingButton_1.default, { onClick: handleExport, loading: loading, variant: "secondary", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Download, { className: "icon-16" }), "Export"] })] })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "table-card", children: (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full table-collapse", children: [(0, jsx_runtime_1.jsx)("thead", { className: "table-head", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "table-cell", children: (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: selectedUsers.length === filteredUsers.length && filteredUsers.length > 0, onChange: handleSelectAll, "aria-label": "Select all users", className: "checkbox-sm" }) }), (0, jsx_runtime_1.jsx)("th", { className: "table-cell table-head-cell", scope: "col", children: "User" }), (0, jsx_runtime_1.jsx)("th", { className: "table-cell table-head-cell", scope: "col", children: "Organization" }), (0, jsx_runtime_1.jsx)("th", { className: "table-cell table-head-cell text-center", scope: "col", children: "Progress" }), (0, jsx_runtime_1.jsx)("th", { className: "table-cell table-head-cell text-center", scope: "col", children: "Modules" }), (0, jsx_runtime_1.jsx)("th", { className: "table-cell table-head-cell text-center", scope: "col", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "table-cell table-head-cell text-center", scope: "col", children: "Last Login" }), (0, jsx_runtime_1.jsx)("th", { className: "table-cell table-head-cell text-center", scope: "col", children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: filteredUsers.map(function (user) { return ((0, jsx_runtime_1.jsxs)("tr", { className: "table-row-border", children: [(0, jsx_runtime_1.jsx)("td", { className: "table-cell", children: (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: selectedUsers.includes(user.id), onChange: function () { return handleSelectUser(user.id); }, "aria-label": "Select user ".concat(user.name), className: "checkbox-sm" }) }), (0, jsx_runtime_1.jsx)("td", { className: "table-cell", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "progress-number", children: user.name }), (0, jsx_runtime_1.jsx)("div", { className: "muted-small text-13", children: user.email }), (0, jsx_runtime_1.jsx)("div", { className: "muted-small text-12", children: user.role })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "table-cell", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "progress-number", children: user.organization }), (0, jsx_runtime_1.jsx)("div", { className: "muted-small text-13", children: user.cohort })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "table-cell text-center", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "progress-number", children: [user.overallProgress, "%"] }), (0, jsx_runtime_1.jsx)("div", { className: "progress-track mt-1", children: (0, jsx_runtime_1.jsx)("div", { className: "progress-fill", style: { width: "".concat(user.overallProgress, "%") }, role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": user.overallProgress, "aria-label": "".concat(user.name, " overall progress") }) })] }) }), (0, jsx_runtime_1.jsxs)("td", { className: "table-cell text-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-13", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-bold", children: user.completedModules }), (0, jsx_runtime_1.jsxs)("span", { className: "muted-text", children: ["/ ", user.totalModules] })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex justify-center gap-2 mt-1", children: modules.map(function (module) {
                                                        var val = user.progress[module.key];
                                                        var color = val === 100 ? 'var(--accent-success)' : val > 0 ? 'var(--highlight)' : 'var(--surface-muted)';
                                                        return ((0, jsx_runtime_1.jsx)("div", { title: "".concat(module.name, ": ").concat(val, "%"), className: "module-dot", style: { background: color } }, module.key));
                                                    }) })] }), (0, jsx_runtime_1.jsx)("td", { className: "table-cell text-center", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center gap-2", children: [getStatusIcon(user.status), (0, jsx_runtime_1.jsx)("span", { className: "status-badge ".concat(user.status === 'active' ? 'status-active' : user.status === 'inactive' ? 'status-inactive' : 'status-error'), children: user.status })] }) }), (0, jsx_runtime_1.jsx)("td", { className: "table-cell text-center muted-text text-13", children: new Date(user.lastLogin).toLocaleDateString() }), (0, jsx_runtime_1.jsx)("td", { className: "table-cell text-center", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-center gap-2", children: [(0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/users/user-".concat(user.id), title: "View Profile", "aria-label": "View profile for ".concat(user.name), className: "icon-action secondary", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "icon-16" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return handleEditUser(user.id); }, title: "Edit User", "aria-label": "Edit ".concat(user.name), className: "icon-action muted", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Edit, { className: "icon-16" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return handleDeleteUser(user.id); }, title: "Delete User", "aria-label": "Delete ".concat(user.name), className: "icon-action primary", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "icon-16" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return handleMoreOptions(user.id); }, title: "More Options", "aria-label": "More options for ".concat(user.name), className: "icon-action muted", children: (0, jsx_runtime_1.jsx)(lucide_react_1.MoreVertical, { className: "icon-16" }) })] }) })] }, user.id)); }) })] }) }) }), filteredUsers.length === 0 && ((0, jsx_runtime_1.jsx)("div", { className: "mt-8", children: (0, jsx_runtime_1.jsx)(EmptyState_1.default, { title: "No users found", description: "Try adjusting your search or filter criteria.", action: ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: function () { setSearchTerm(''); setFilterOrg('all'); setFilterStatus('all'); setSelectedUsers([]); }, className: "btn-outline", children: "Reset filters" })), illustrationSrc: undefined }) })), (0, jsx_runtime_1.jsxs)("div", { className: "mt-8 grid grid-cols-1 md:grid-cols-4 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-blue-600", children: filteredUsers.length }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Total Users" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-green-600", children: filteredUsers.filter(function (u) { return u.status === 'active'; }).length }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Active Users" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-2xl font-bold text-orange-600", children: [Math.round(filteredUsers.reduce(function (acc, user) { return acc + user.overallProgress; }, 0) / filteredUsers.length) || 0, "%"] }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Avg. Progress" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold text-purple-600", children: filteredUsers.filter(function (u) { return u.feedbackSubmitted; }).length }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Feedback Submitted" })] })] }), (0, jsx_runtime_1.jsx)(AddUserModal_1.default, { isOpen: showAddUserModal, onClose: function () { return setShowAddUserModal(false); }, onUserAdded: handleUserAdded }), (0, jsx_runtime_1.jsx)(CourseAssignmentModal_1.default, { isOpen: showCourseAssignModal, onClose: function () { return setShowCourseAssignModal(false); }, selectedUsers: selectedUsers, onAssignComplete: handleCourseAssignComplete }), (0, jsx_runtime_1.jsx)(ConfirmationModal_1.default, { isOpen: showDeleteModal, onClose: function () {
                    setShowDeleteModal(false);
                    setUserToDelete(null);
                }, onConfirm: confirmDeleteUser, title: "Delete User", message: "Are you sure you want to delete this user? This action cannot be undone and will remove all their progress data.", confirmText: "Delete User", type: "danger", loading: loading }), showEditUserModal && userToEdit && ((0, jsx_runtime_1.jsx)(AddUserModal_1.default, { isOpen: showEditUserModal, onClose: function () {
                    setShowEditUserModal(false);
                    setUserToEdit(null);
                }, onUserAdded: handleUserUpdated, editUser: userToEdit }))] }));
};
exports.default = AdminUsers;
