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
var supabase_1 = require("../../lib/supabase");
var react_router_dom_1 = require("react-router-dom");
var lucide_react_1 = require("lucide-react");
var Breadcrumbs_1 = require("../../components/ui/Breadcrumbs");
var EmptyState_1 = require("../../components/ui/EmptyState");
var AdminSurveys = function () {
    var _a = (0, react_1.useState)(''), searchTerm = _a[0], setSearchTerm = _a[1];
    var _b = (0, react_1.useState)('all'), filterStatus = _b[0], setFilterStatus = _b[1];
    var _c = (0, react_1.useState)('all'), filterType = _c[0], setFilterType = _c[1];
    var _d = (0, react_1.useState)([]), selectedSurveys = _d[0], setSelectedSurveys = _d[1];
    var _e = (0, react_1.useState)([
        {
            id: 'climate-2025-q1',
            title: 'Q1 2025 Climate Assessment',
            description: 'Quarterly organizational climate and culture assessment',
            type: 'climate-assessment',
            status: 'active',
            createdAt: '2025-03-01',
            launchedAt: '2025-03-05',
            closedAt: null,
            totalInvites: 247,
            totalResponses: 189,
            completionRate: 77,
            avgCompletionTime: 12,
            assignedOrgs: ['Pacific Coast University', 'Regional Fire Department', 'TechForward Solutions'],
            assignedOrgIds: ['1', '4', '5'],
            lastActivity: '2025-03-11'
        },
        {
            id: 'inclusion-index-2025',
            title: 'Annual Inclusion Index',
            description: 'Comprehensive inclusion measurement with benchmarking',
            type: 'inclusion-index',
            status: 'draft',
            createdAt: '2025-02-28',
            launchedAt: null,
            closedAt: null,
            totalInvites: 0,
            totalResponses: 0,
            completionRate: 0,
            avgCompletionTime: 0,
            assignedOrgs: [],
            assignedOrgIds: [],
            lastActivity: '2025-03-10'
        },
        {
            id: 'equity-lens-pilot',
            title: 'Equity Lens Pilot Study',
            description: 'Pilot assessment of equity in organizational practices',
            type: 'equity-lens',
            status: 'completed',
            createdAt: '2025-01-15',
            launchedAt: '2025-01-20',
            closedAt: '2025-02-20',
            totalInvites: 156,
            totalResponses: 142,
            completionRate: 91,
            avgCompletionTime: 15,
            assignedOrgs: ['Community Impact Network', 'Mountain View High School'],
            assignedOrgIds: ['3', '2'],
            lastActivity: '2025-02-20'
        },
        {
            id: 'leadership-360',
            title: 'Leadership 360 Assessment',
            description: 'Multi-rater feedback for inclusive leadership development',
            type: 'custom',
            status: 'paused',
            createdAt: '2025-02-10',
            launchedAt: '2025-02-15',
            closedAt: null,
            totalInvites: 89,
            totalResponses: 34,
            completionRate: 38,
            avgCompletionTime: 18,
            assignedOrgs: ['Pacific Coast University'],
            assignedOrgIds: ['1'],
            lastActivity: '2025-03-08'
        }
    ]), surveys = _e[0], setSurveys = _e[1];
    // Organizations (same sample set used across admin pages)
    var organizations = [
        { id: '1', name: 'Pacific Coast University' },
        { id: '2', name: 'Mountain View High School' },
        { id: '3', name: 'Community Impact Network' },
        { id: '4', name: 'Regional Fire Department' },
        { id: '5', name: 'TechForward Solutions' },
        { id: '6', name: 'Regional Medical Center' },
        { id: '7', name: 'Unity Community Church' }
    ];
    var _f = (0, react_1.useState)(false), showAssignModal = _f[0], setShowAssignModal = _f[1];
    var _g = (0, react_1.useState)(null), assignTargetSurveyId = _g[0], setAssignTargetSurveyId = _g[1];
    var _h = (0, react_1.useState)([]), selectedOrgIds = _h[0], setSelectedOrgIds = _h[1];
    var openAssignModal = function (surveyId) {
        var _a;
        var survey = surveys.find(function (s) { return s.id === surveyId; });
        setAssignTargetSurveyId(surveyId);
        setSelectedOrgIds((_a = survey === null || survey === void 0 ? void 0 : survey.assignedOrgIds) !== null && _a !== void 0 ? _a : []);
        setShowAssignModal(true);
    };
    var navigate = (0, react_router_dom_1.useNavigate)();
    var handleBulkActions = function () {
        if (selectedSurveys.length === 0) {
            alert('Select at least one survey to perform bulk actions');
            return;
        }
        navigate("/admin/surveys/bulk?ids=".concat(selectedSurveys.join(',')));
    };
    var handleAICreator = function () {
        navigate('/admin/surveys/builder?ai=1');
    };
    var handleImport = function () {
        navigate('/admin/surveys/import');
    };
    var handleQueue = function () {
        navigate('/admin/surveys/queue');
    };
    var duplicateSurvey = function (surveyId) {
        var s = surveys.find(function (s) { return s.id === surveyId; });
        if (!s)
            return;
        var copy = __assign(__assign({}, s), { id: "".concat(s.id, "-copy-").concat(Date.now()), title: "Copy of ".concat(s.title), createdAt: new Date().toISOString(), lastActivity: new Date().toISOString() });
        setSurveys(function (prev) { return __spreadArray([copy], prev, true); });
        // Navigate to builder for the new copy
        navigate("/admin/surveys/builder/".concat(copy.id));
    };
    var closeAssignModal = function () {
        setShowAssignModal(false);
        setAssignTargetSurveyId(null);
        setSelectedOrgIds([]);
    };
    var toggleSelectOrg = function (orgId) {
        setSelectedOrgIds(function (prev) { return prev.includes(orgId) ? prev.filter(function (id) { return id !== orgId; }) : __spreadArray(__spreadArray([], prev, true), [orgId], false); });
    };
    var saveAssignment = function () {
        if (!assignTargetSurveyId)
            return;
        // Optimistic update locally
        setSurveys(function (prev) { return prev.map(function (s) { return s.id === assignTargetSurveyId ? __assign(__assign({}, s), { assignedOrgIds: selectedOrgIds, assignedOrgs: organizations.filter(function (o) { return selectedOrgIds.includes(o.id); }).map(function (o) { return o.name; }) }) : s; }); });
        // Persist to Supabase (table: survey_assignments) if configured
        (function () { return __awaiter(void 0, void 0, void 0, function () {
            var supabase, payload, _a, data, error, err_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        if (!supabase_1.hasSupabaseConfig)
                            return [2 /*return*/];
                        return [4 /*yield*/, (0, supabase_1.getSupabase)()];
                    case 1:
                        supabase = _b.sent();
                        if (!supabase)
                            return [2 /*return*/];
                        payload = {
                            survey_id: assignTargetSurveyId,
                            organization_ids: selectedOrgIds,
                            updated_at: new Date().toISOString()
                        };
                        return [4 /*yield*/, supabase.from('survey_assignments').upsert(payload).select()];
                    case 2:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.warn('Failed to save assignment to Supabase:', error.message || error);
                        }
                        else {
                            console.log('Saved survey assignment to Supabase:', data);
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _b.sent();
                        console.warn('Supabase error saving assignment:', err_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); })();
        closeAssignModal();
    };
    var filteredSurveys = surveys.filter(function (survey) {
        var matchesSearch = survey.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            survey.description.toLowerCase().includes(searchTerm.toLowerCase());
        var matchesStatus = filterStatus === 'all' || survey.status === filterStatus;
        var matchesType = filterType === 'all' || survey.type === filterType;
        return matchesSearch && matchesStatus && matchesType;
    });
    var getStatusColor = function (status) {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'draft':
                return 'bg-gray-100 text-gray-800';
            case 'paused':
                return 'bg-yellow-100 text-yellow-800';
            case 'completed':
                return 'bg-blue-100 text-blue-800';
            case 'archived':
                return 'bg-purple-100 text-purple-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    var getStatusIcon = function (status) {
        switch (status) {
            case 'active':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Play, { className: "h-4 w-4 text-green-500" });
            case 'draft':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Edit, { className: "h-4 w-4 text-gray-500" });
            case 'paused':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Pause, { className: "h-4 w-4 text-yellow-500" });
            case 'completed':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-4 w-4 text-blue-500" });
            case 'archived':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Archive, { className: "h-4 w-4 text-purple-500" });
            default:
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Clock, { className: "h-4 w-4 text-gray-500" });
        }
    };
    var getTypeColor = function (type) {
        switch (type) {
            case 'climate-assessment':
                return 'bg-blue-100 text-blue-800';
            case 'inclusion-index':
                return 'bg-green-100 text-green-800';
            case 'equity-lens':
                return 'bg-orange-100 text-orange-800';
            case 'custom':
                return 'bg-purple-100 text-purple-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    var handleSelectSurvey = function (surveyId) {
        setSelectedSurveys(function (prev) {
            return prev.includes(surveyId)
                ? prev.filter(function (id) { return id !== surveyId; })
                : __spreadArray(__spreadArray([], prev, true), [surveyId], false);
        });
    };
    // removed handleSelectAll (not used)
    return ((0, jsx_runtime_1.jsxs)("div", { className: "container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-6", children: (0, jsx_runtime_1.jsx)(Breadcrumbs_1.default, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Surveys', to: '/admin/surveys' }] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-8", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "DEI Survey Platform" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600", children: "Create, manage, and analyze DEI surveys with advanced analytics and insights" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6 mb-8", children: [(0, jsx_runtime_1.jsx)("div", { className: "card-lg", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-medium text-gray-600", children: "Active Surveys" }), (0, jsx_runtime_1.jsx)("p", { className: "text-2xl font-bold text-gray-900 mt-1", children: surveys.filter(function (s) { return s.status === 'active'; }).length })] }), (0, jsx_runtime_1.jsx)("div", { className: "p-3 rounded-lg bg-green-50", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Target, { className: "h-6 w-6 text-green-500" }) })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "card-lg", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-medium text-gray-600", children: "Total Responses" }), (0, jsx_runtime_1.jsx)("p", { className: "text-2xl font-bold text-gray-900 mt-1", children: surveys.reduce(function (acc, s) { return acc + s.totalResponses; }, 0) })] }), (0, jsx_runtime_1.jsx)("div", { className: "p-3 rounded-lg bg-blue-50", children: (0, jsx_runtime_1.jsx)(lucide_react_1.MessageSquare, { className: "h-6 w-6 text-blue-500" }) })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "card-lg", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-medium text-gray-600", children: "Avg. Completion" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-2xl font-bold text-gray-900 mt-1", children: [Math.round(surveys.filter(function (s) { return s.totalInvites > 0; }).reduce(function (acc, s) { return acc + s.completionRate; }, 0) / surveys.filter(function (s) { return s.totalInvites > 0; }).length) || 0, "%"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "p-3 rounded-lg bg-orange-50", children: (0, jsx_runtime_1.jsx)(lucide_react_1.TrendingUp, { className: "h-6 w-6 text-orange-500" }) })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "card-lg", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-medium text-gray-600", children: "Organizations" }), (0, jsx_runtime_1.jsx)("p", { className: "text-2xl font-bold text-gray-900 mt-1", children: new Set(surveys.flatMap(function (s) { return s.assignedOrgs; })).size })] }), (0, jsx_runtime_1.jsx)("div", { className: "p-3 rounded-lg bg-purple-50", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Users, { className: "h-6 w-6 text-purple-500" }) })] }) })] }), (0, jsx_runtime_1.jsx)("div", { className: "card-lg card-hover mb-8", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative flex-1 max-w-md", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" }), (0, jsx_runtime_1.jsx)("input", { type: "text", placeholder: "Search surveys...", value: searchTerm, onChange: function (e) { return setSearchTerm(e.target.value); }, className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Filter, { className: "h-5 w-5 text-gray-400" }), (0, jsx_runtime_1.jsxs)("select", { value: filterStatus, onChange: function (e) { return setFilterStatus(e.target.value); }, className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [(0, jsx_runtime_1.jsx)("option", { value: "all", children: "All Status" }), (0, jsx_runtime_1.jsx)("option", { value: "draft", children: "Draft" }), (0, jsx_runtime_1.jsx)("option", { value: "active", children: "Active" }), (0, jsx_runtime_1.jsx)("option", { value: "paused", children: "Paused" }), (0, jsx_runtime_1.jsx)("option", { value: "completed", children: "Completed" }), (0, jsx_runtime_1.jsx)("option", { value: "archived", children: "Archived" })] }), (0, jsx_runtime_1.jsxs)("select", { value: filterType, onChange: function (e) { return setFilterType(e.target.value); }, className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [(0, jsx_runtime_1.jsx)("option", { value: "all", children: "All Types" }), (0, jsx_runtime_1.jsx)("option", { value: "climate-assessment", children: "Climate Assessment" }), (0, jsx_runtime_1.jsx)("option", { value: "inclusion-index", children: "Inclusion Index" }), (0, jsx_runtime_1.jsx)("option", { value: "equity-lens", children: "Equity Lens" }), (0, jsx_runtime_1.jsx)("option", { value: "custom", children: "Custom" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4", children: [selectedSurveys.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center space-x-2", children: (0, jsx_runtime_1.jsxs)("button", { onClick: handleBulkActions, className: "btn-outline", children: ["Bulk Actions (", selectedSurveys.length, ")"] }) })), (0, jsx_runtime_1.jsxs)("button", { onClick: handleAICreator, className: "btn-outline px-4 py-2 rounded-lg flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Brain, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "AI Survey Creator" })] }), (0, jsx_runtime_1.jsxs)(react_router_dom_1.Link, { to: "/admin/surveys/builder", className: "btn-cta px-4 py-2 rounded-lg flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Create Survey" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: handleImport, className: "btn-outline px-4 py-2 rounded-lg flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Upload, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Import" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: handleQueue, className: "btn-outline px-4 py-2 rounded-lg flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Clock, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Queue" })] })] })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8", children: filteredSurveys.map(function (survey) { return ((0, jsx_runtime_1.jsx)("div", { className: "card-lg card-hover overflow-hidden", children: (0, jsx_runtime_1.jsxs)("div", { className: "p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2 mb-2", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-bold text-lg text-gray-900", children: survey.title }), (0, jsx_runtime_1.jsx)("span", { className: "px-2 py-1 rounded-full text-xs font-medium ".concat(getStatusColor(survey.status)), children: survey.status })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 text-sm mb-3", children: survey.description }), (0, jsx_runtime_1.jsx)("span", { className: "px-2 py-1 rounded-full text-xs font-medium ".concat(getTypeColor(survey.type)), children: survey.type.replace('-', ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [getStatusIcon(survey.status), (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: selectedSurveys.includes(survey.id), onChange: function () { return handleSelectSurvey(survey.id); }, className: "h-4 w-4 border-gray-300 rounded focus:ring-[var(--hud-orange)]" })] })] }), survey.status !== 'draft' && ((0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4 mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xl font-bold text-blue-600", children: survey.totalResponses }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-gray-600", children: "Responses" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-center", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-xl font-bold text-green-600", children: [survey.completionRate, "%"] }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-gray-600", children: "Completion" })] })] })), survey.status === 'active' && ((0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm text-gray-600", children: "Progress" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-sm font-medium text-gray-900", children: [survey.completionRate, "%"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "w-full bg-gray-200 rounded-full h-2", children: (0, jsx_runtime_1.jsx)("div", { className: "h-2 rounded-full", style: { width: "".concat(survey.completionRate, "%"), background: 'var(--gradient-blue-green)' } }) })] })), survey.assignedOrgs.length === 0 && ((0, jsx_runtime_1.jsx)("div", { className: "mb-4", children: (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-red-500 italic", children: "Not assigned" }) })), (0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600 mb-2", children: "Assigned Organizations:" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-1", children: [survey.assignedOrgs.length > 0 ? (survey.assignedOrgs.slice(0, 2).map(function (org, index) { return ((0, jsx_runtime_1.jsx)("span", { className: "bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs", children: org }, index)); })) : ((0, jsx_runtime_1.jsx)("span", { className: "text-xs text-gray-500 italic", children: "No assignments" })), survey.assignedOrgs.length > 2 && ((0, jsx_runtime_1.jsxs)("span", { className: "bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs", children: ["+", survey.assignedOrgs.length - 2, " more"] }))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between pt-4 border-t border-gray-200", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-gray-600", children: [survey.status === 'draft' ? 'Created' : 'Last activity', ": ", new Date(survey.lastActivity).toLocaleDateString()] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { className: "p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg", title: "AI Insights", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Brain, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/surveys/".concat(survey.id, "/analytics"), className: "p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg", title: "View Analytics", children: (0, jsx_runtime_1.jsx)(lucide_react_1.BarChart3, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return openAssignModal(survey.id); }, className: "p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg", title: "Assign to Organizations", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Users, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/surveys/".concat(survey.id, "/preview"), className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Preview Survey", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/surveys/builder/".concat(survey.id), className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Edit Survey", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Edit, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return duplicateSurvey(survey.id); }, className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Duplicate", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Copy, { className: "h-4 w-4" }) })] })] })] }) }, survey.id)); }) }), filteredSurveys.length === 0 && ((0, jsx_runtime_1.jsx)("div", { className: "mb-8", children: (0, jsx_runtime_1.jsx)(EmptyState_1.default, { title: "No surveys found", description: searchTerm || filterStatus !== 'all' || filterType !== 'all' ? 'Try adjusting your search or filters to find surveys.' : 'Create your first survey to get started.', action: searchTerm || filterStatus !== 'all' || filterType !== 'all' ? ((0, jsx_runtime_1.jsx)("button", { className: "btn-outline", onClick: function () { setSearchTerm(''); setFilterStatus('all'); setFilterType('all'); }, children: "Reset filters" })) : ((0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/surveys/builder", className: "btn-cta", children: "Create Your First Survey" })) }) })), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl p-8", style: { background: 'var(--gradient-banner)' }, children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-center mb-8", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-2xl font-bold text-gray-900 mb-4", children: "Start with a Template" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 max-w-2xl mx-auto", children: "Choose from our research-backed DEI survey templates designed by experts in organizational psychology and inclusive leadership." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "card-lg hover:shadow-md transition-shadow duration-200", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4", children: (0, jsx_runtime_1.jsx)(lucide_react_1.BarChart3, { className: "h-6 w-6 text-blue-600" }) }), (0, jsx_runtime_1.jsx)("h3", { className: "font-bold text-gray-900 mb-2", children: "Climate Assessment" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 text-sm mb-4", children: "Comprehensive workplace culture and belonging assessment" }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/surveys/builder?template=climate-assessment", className: "text-blue-600 hover:text-blue-700 font-medium text-sm", children: "Use Template \u2192" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg hover:shadow-md transition-shadow duration-200", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Target, { className: "h-6 w-6 text-green-600" }) }), (0, jsx_runtime_1.jsx)("h3", { className: "font-bold text-gray-900 mb-2", children: "Inclusion Index" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 text-sm mb-4", children: "Measure inclusion across key dimensions with benchmarking" }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/surveys/builder?template=inclusion-index", className: "text-green-600 hover:text-green-700 font-medium text-sm", children: "Use Template \u2192" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card-lg hover:shadow-md transition-shadow duration-200", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-orange-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4", children: (0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-6 w-6 text-orange-600" }) }), (0, jsx_runtime_1.jsx)("h3", { className: "font-bold text-gray-900 mb-2", children: "Equity Lens" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 text-sm mb-4", children: "Evaluate organizational practices through an equity framework" }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/surveys/builder?template=equity-lens", className: "text-orange-600 hover:text-orange-700 font-medium text-sm", children: "Use Template \u2192" })] })] })] }), showAssignModal && ((0, jsx_runtime_1.jsxs)("div", { className: "fixed inset-0 flex items-center justify-center z-50", children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 bg-black opacity-30", onClick: closeAssignModal }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-2xl z-50 w-full max-w-2xl p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-bold", children: "Assign Survey to Organizations" }), (0, jsx_runtime_1.jsx)("button", { onClick: closeAssignModal, className: "text-gray-500 hover:text-gray-800", children: "Close" })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600 mb-4", children: "Select which organizations should receive this survey. Assignments can be changed later." }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 max-h-64 overflow-y-auto", children: organizations.map(function (org) { return ((0, jsx_runtime_1.jsxs)("label", { className: "flex items-center space-x-3 p-3 rounded-lg border ".concat(selectedOrgIds.includes(org.id) ? 'border-orange-400 bg-orange-50' : 'border-gray-100 bg-white'), children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: selectedOrgIds.includes(org.id), onChange: function () { return toggleSelectOrg(org.id); }, className: "h-4 w-4 text-orange-500" }), (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900", children: org.name }) })] }, org.id)); }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-end space-x-3", children: [(0, jsx_runtime_1.jsx)("button", { onClick: closeAssignModal, className: "btn-outline", children: "Cancel" }), (0, jsx_runtime_1.jsx)("button", { onClick: saveAssignment, className: "btn-cta", children: "Save Assignment" })] })] })] }))] }));
};
exports.default = AdminSurveys;
