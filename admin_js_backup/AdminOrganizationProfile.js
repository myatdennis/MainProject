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
var Button_1 = require("../../components/ui/Button");
var lucide_react_1 = require("lucide-react");
var documents_1 = require("../../dal/documents");
// clientWorkspaceService is dynamically imported where used so it can be bundled with the org-workspace chunk
var notifications_1 = require("../../dal/notifications");
var orgs_1 = require("../../dal/orgs");
var ToastContext_1 = require("../../context/ToastContext");
var tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'services', label: 'Services' },
    { key: 'resources', label: 'Resources' },
    { key: 'action-tracker', label: 'Action Tracker' },
    { key: 'metrics', label: 'Metrics' }
];
var AdminOrganizationProfile = function () {
    var orgId = (0, react_router_dom_1.useParams)().orgId;
    var showToast = (0, ToastContext_1.useToast)().showToast;
    var _a = (0, react_1.useState)('overview'), activeTab = _a[0], setActiveTab = _a[1];
    var _b = (0, react_1.useState)([]), documents = _b[0], setDocuments = _b[1];
    var _c = (0, react_1.useState)([]), actionItems = _c[0], setActionItems = _c[1];
    var _d = (0, react_1.useState)(0), strategicPlansCount = _d[0], setStrategicPlansCount = _d[1];
    var _e = (0, react_1.useState)(null), totalLearners = _e[0], setTotalLearners = _e[1];
    var _f = (0, react_1.useState)(null), avgCompletion = _f[0], setAvgCompletion = _f[1];
    var _g = (0, react_1.useState)(0), totalDownloads = _g[0], setTotalDownloads = _g[1];
    // Upload form state
    var _h = (0, react_1.useState)(null), file = _h[0], setFile = _h[1];
    var _j = (0, react_1.useState)(''), docName = _j[0], setDocName = _j[1];
    var _k = (0, react_1.useState)('Onboarding'), docCategory = _k[0], setDocCategory = _k[1];
    var _l = (0, react_1.useState)(''), docTags = _l[0], setDocTags = _l[1];
    // Action item form
    var _m = (0, react_1.useState)(''), newActionTitle = _m[0], setNewActionTitle = _m[1];
    var _o = (0, react_1.useState)(''), newActionDue = _o[0], setNewActionDue = _o[1];
    var _p = (0, react_1.useState)(''), newActionAssignee = _p[0], setNewActionAssignee = _p[1];
    (0, react_1.useEffect)(function () {
        if (!orgId)
            return;
        // load documents for resources tab
        documents_1.default.listDocuments({ orgId: orgId }).then(setDocuments).catch(function () { return setDocuments([]); });
        // load action items
        (function () { return __awaiter(void 0, void 0, void 0, function () {
            var svc, actions, plans, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../../services/clientWorkspaceService'); })];
                    case 1:
                        svc = _a.sent();
                        return [4 /*yield*/, svc.listActionItems(orgId)];
                    case 2:
                        actions = _a.sent();
                        setActionItems(actions);
                        return [4 /*yield*/, svc.listStrategicPlans(orgId)];
                    case 3:
                        plans = _a.sent();
                        setStrategicPlansCount(plans.length);
                        return [3 /*break*/, 5];
                    case 4:
                        e_1 = _a.sent();
                        setActionItems([]);
                        setStrategicPlansCount(0);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        }); })();
        // org totals
        orgs_1.default.getOrg(orgId).then(function (o) {
            if (o) {
                setTotalLearners(o.totalLearners || 0);
                setAvgCompletion(o.completionRate || 0);
            }
            else {
                setTotalLearners(null);
                setAvgCompletion(null);
            }
        }).catch(function () { setTotalLearners(null); setAvgCompletion(null); });
        // document downloads aggregate
        documents_1.default.listDocuments({ orgId: orgId }).then(function (list) { return setTotalDownloads(list.reduce(function (acc, d) { return acc + (d.downloadCount || 0); }, 0)); }).catch(function () { return setTotalDownloads(0); });
    }, [orgId]);
    var handleAssignDocument = function () { return __awaiter(void 0, void 0, void 0, function () {
        var meta, list;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, documents_1.default.addDocument({
                        name: "welcome-packet-".concat(Date.now()),
                        filename: 'welcome.pdf',
                        url: undefined,
                        category: 'Onboarding',
                        subcategory: undefined,
                        tags: ['welcome'],
                        fileType: 'application/pdf',
                        visibility: 'org',
                        orgId: orgId,
                        createdBy: 'Admin'
                    })];
                case 1:
                    meta = _a.sent();
                    if (!(meta && meta.id)) return [3 /*break*/, 5];
                    return [4 /*yield*/, documents_1.default.assignToOrg(meta.id, orgId)];
                case 2:
                    _a.sent();
                    // notificationService API is addNotification and expects body
                    return [4 /*yield*/, notifications_1.default.addNotification({
                            title: 'Document assigned',
                            body: "Assigned ".concat(meta.name, " to organization ").concat(orgId),
                            orgId: orgId
                        })];
                case 3:
                    // notificationService API is addNotification and expects body
                    _a.sent();
                    return [4 /*yield*/, documents_1.default.listDocuments({ orgId: orgId })];
                case 4:
                    list = _a.sent();
                    setDocuments(list);
                    _a.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleFileChange = function (f) { return setFile(f); };
    var handleUpload = function () { return __awaiter(void 0, void 0, void 0, function () {
        var url, doc, list;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!orgId)
                        return [2 /*return*/];
                    if (!file && !docName) {
                        showToast('Provide a name or file', 'error');
                        return [2 /*return*/];
                    }
                    url = undefined;
                    if (!file) return [3 /*break*/, 2];
                    return [4 /*yield*/, new Promise(function (res, rej) {
                            var r = new FileReader();
                            r.onload = function () { return res(String(r.result)); };
                            r.onerror = rej;
                            r.readAsDataURL(file);
                        })];
                case 1:
                    // read as data URL for local dev (documentService will also attempt storage upload)
                    url = _a.sent();
                    _a.label = 2;
                case 2: return [4 /*yield*/, documents_1.default.addDocument({
                        name: docName || file.name,
                        filename: file === null || file === void 0 ? void 0 : file.name,
                        url: url,
                        category: docCategory,
                        subcategory: undefined,
                        tags: docTags ? docTags.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [],
                        fileType: file === null || file === void 0 ? void 0 : file.type,
                        visibility: 'org',
                        orgId: orgId,
                        createdBy: 'Admin'
                    }, file || undefined)];
                case 3:
                    doc = _a.sent();
                    if (!(doc && doc.id)) return [3 /*break*/, 7];
                    return [4 /*yield*/, documents_1.default.assignToOrg(doc.id, orgId)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, notifications_1.default.addNotification({ title: 'New Document Shared', body: "A document \"".concat(doc.name, "\" was shared with your organization."), orgId: orgId })];
                case 5:
                    _a.sent();
                    setDocName('');
                    setFile(null);
                    setDocTags('');
                    return [4 /*yield*/, documents_1.default.listDocuments({ orgId: orgId })];
                case 6:
                    list = _a.sent();
                    setDocuments(list);
                    _a.label = 7;
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var handleAddAction = function () { return __awaiter(void 0, void 0, void 0, function () {
        var svc, list;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!orgId || !newActionTitle) {
                        showToast('Provide a title for the action', 'error');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../../services/clientWorkspaceService'); })];
                case 1:
                    svc = _a.sent();
                    return [4 /*yield*/, svc.addActionItem(orgId, {
                            title: newActionTitle,
                            description: '',
                            assignee: newActionAssignee || undefined,
                            dueDate: newActionDue || undefined,
                            status: 'Not Started'
                        })];
                case 2:
                    _a.sent();
                    setNewActionTitle('');
                    setNewActionDue('');
                    setNewActionAssignee('');
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../../services/clientWorkspaceService'); })];
                case 3: return [4 /*yield*/, (_a.sent()).listActionItems(orgId)];
                case 4:
                    list = _a.sent();
                    setActionItems(list);
                    showToast('Action item added', 'success');
                    return [2 /*return*/];
            }
        });
    }); };
    var toggleActionStatus = function (item) { return __awaiter(void 0, void 0, void 0, function () {
        var order, idx, next, updated, svc2, list;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!orgId)
                        return [2 /*return*/];
                    order = ['Not Started', 'In Progress', 'Completed'];
                    idx = order.indexOf(item.status || 'Not Started');
                    next = order[(idx + 1) % order.length];
                    updated = __assign(__assign({}, item), { status: next });
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../../services/clientWorkspaceService'); })];
                case 1:
                    svc2 = _a.sent();
                    return [4 /*yield*/, svc2.updateActionItem(orgId, updated)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, svc2.listActionItems(orgId)];
                case 3:
                    list = _a.sent();
                    setActionItems(list);
                    return [2 /*return*/];
            }
        });
    }); };
    var renderOverview = function () { return ((0, jsx_runtime_1.jsx)("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-start space-x-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-blue-50 p-4 rounded-lg", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Building2, { className: "h-6 w-6 text-blue-600" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("h2", { className: "text-2xl font-bold", children: ["Organization ", orgId] }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mt-2", children: "Basic organization information and contact details will appear here." }), (0, jsx_runtime_1.jsx)("div", { className: "mt-3", children: (0, jsx_runtime_1.jsx)(Button_1.default, { asChild: true, variant: "ghost", size: "sm", "aria-label": "Back to Organizations", children: (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/organizations", children: "Back to Organizations" }) }) })] })] }) })); };
    var renderServices = function () { return ((0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-bold text-lg mb-2", children: "Services" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600", children: "List and configure services provided to this organization." }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4", children: (0, jsx_runtime_1.jsx)("button", { className: "px-4 py-2 bg-orange-500 text-white rounded-lg", children: "Edit Services" }) })] })); };
    var renderResources = function () { return ((0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-bold text-lg", children: "Resources" }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center space-x-2", children: (0, jsx_runtime_1.jsx)("button", { onClick: handleAssignDocument, className: "px-3 py-1 bg-blue-600 text-white rounded-lg", children: "Assign Demo Document" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "md:col-span-2", children: documents.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-500", children: "No documents assigned to this organization." })) : ((0, jsx_runtime_1.jsx)("ul", { className: "space-y-2", children: documents.map(function (doc) { return ((0, jsx_runtime_1.jsxs)("li", { className: "p-3 border rounded-lg flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium", children: doc.name }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: doc.filename || doc.category })] }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-500", children: doc.visibility })] }, doc.id)); }) })) }), (0, jsx_runtime_1.jsxs)("div", { className: "p-4 border rounded-lg", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm font-medium mb-2", children: "Upload & Assign" }), (0, jsx_runtime_1.jsx)("input", { type: "text", placeholder: "Document name", value: docName, onChange: function (e) { return setDocName(e.target.value); }, className: "w-full mb-2 p-2 border rounded" }), (0, jsx_runtime_1.jsx)("input", { type: "text", placeholder: "Category", value: docCategory, onChange: function (e) { return setDocCategory(e.target.value); }, className: "w-full mb-2 p-2 border rounded" }), (0, jsx_runtime_1.jsx)("input", { type: "text", placeholder: "Tags (comma separated)", value: docTags, onChange: function (e) { return setDocTags(e.target.value); }, className: "w-full mb-2 p-2 border rounded" }), (0, jsx_runtime_1.jsx)("input", { type: "file", onChange: function (e) { var _a; return handleFileChange(((_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0]) || null); }, className: "w-full mb-2" }), (0, jsx_runtime_1.jsx)("div", { className: "text-right", children: (0, jsx_runtime_1.jsx)("button", { onClick: handleUpload, className: "px-3 py-1 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded", children: "Upload & Share" }) })] })] })] })); };
    var renderActionTracker = function () { return ((0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-between mb-4", children: (0, jsx_runtime_1.jsx)("h3", { className: "font-bold text-lg", children: "Action Tracker" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-4 grid grid-cols-1 md:grid-cols-3 gap-2", children: [(0, jsx_runtime_1.jsx)("input", { value: newActionTitle, onChange: function (e) { return setNewActionTitle(e.target.value); }, placeholder: "Action title", className: "p-2 border rounded" }), (0, jsx_runtime_1.jsx)("input", { value: newActionDue, onChange: function (e) { return setNewActionDue(e.target.value); }, placeholder: "Due date", type: "date", className: "p-2 border rounded" }), (0, jsx_runtime_1.jsx)("input", { value: newActionAssignee, onChange: function (e) { return setNewActionAssignee(e.target.value); }, placeholder: "Assignee", className: "p-2 border rounded" }), (0, jsx_runtime_1.jsx)("div", { className: "md:col-span-3 text-right", children: (0, jsx_runtime_1.jsx)("button", { onClick: handleAddAction, className: "px-3 py-1 bg-blue-600 text-white rounded", children: "Add Action" }) })] }), actionItems.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-500", children: "No action items for this organization." })) : ((0, jsx_runtime_1.jsx)("ul", { className: "space-y-2", children: actionItems.map(function (item) { return ((0, jsx_runtime_1.jsxs)("li", { className: "p-3 border rounded-lg flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium", children: item.title }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-gray-600", children: ["Due: ", item.dueDate || '—'] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-gray-500", children: ["Assignee: ", item.assignee || 'Unassigned'] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-end space-y-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "px-2 py-1 rounded-full text-sm ".concat(item.status === 'Completed' ? 'bg-green-100 text-green-800' : item.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'), children: item.status }), (0, jsx_runtime_1.jsx)("div", { className: "flex space-x-2", children: (0, jsx_runtime_1.jsx)("button", { onClick: function () { return toggleActionStatus(item); }, className: "px-2 py-1 bg-white border rounded text-sm", children: "Toggle Status" }) })] })] }, item.id)); }) }))] })); };
    var renderMetrics = function () { return ((0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-bold text-lg mb-2", children: "Metrics" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-3 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Documents" }), (0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold", children: documents.length })] }), (0, jsx_runtime_1.jsxs)("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Learners" }), (0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold", children: totalLearners === null ? '—' : totalLearners })] }), (0, jsx_runtime_1.jsxs)("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Action Items" }), (0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold", children: actionItems.length })] }), (0, jsx_runtime_1.jsxs)("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Completed" }), (0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold", children: actionItems.length === 0 ? '—' : "".concat(Math.round((actionItems.filter(function (a) { return a.status === 'Completed'; }).length / actionItems.length) * 100), "%") })] }), (0, jsx_runtime_1.jsxs)("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Avg Completion" }), (0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold", children: avgCompletion === null ? '—' : "".concat(avgCompletion, "%") })] }), (0, jsx_runtime_1.jsxs)("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Strategic Plans" }), (0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold", children: strategicPlansCount })] }), (0, jsx_runtime_1.jsxs)("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-600", children: "Downloads" }), (0, jsx_runtime_1.jsx)("div", { className: "text-2xl font-bold", children: totalDownloads })] })] })] })); };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-6xl mx-auto", children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-6 flex items-center justify-between", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-bold", children: "Organization Profile" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-600", children: "Manage organization details, resources and activity." })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "mb-6", children: (0, jsx_runtime_1.jsx)("nav", { className: "flex space-x-2", children: tabs.map(function (t) { return ((0, jsx_runtime_1.jsx)("button", { onClick: function () { return setActiveTab(t.key); }, className: "px-4 py-2 rounded-lg ".concat(activeTab === t.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700'), children: t.label }, t.key)); }) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [activeTab === 'overview' && renderOverview(), activeTab === 'services' && renderServices(), activeTab === 'resources' && renderResources(), activeTab === 'action-tracker' && renderActionTracker(), activeTab === 'metrics' && renderMetrics()] })] }));
};
exports.default = AdminOrganizationProfile;
