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
var AdminIntegrationConfig = function () {
    var integrationId = (0, react_router_dom_1.useParams)().integrationId;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var showToast = (0, ToastContext_1.useToast)().showToast;
    var _a = (0, react_1.useState)(false), loading = _a[0], setLoading = _a[1];
    var _b = (0, react_1.useState)(false), testing = _b[0], setTesting = _b[1];
    var _c = (0, react_1.useState)(false), showApiKey = _c[0], setShowApiKey = _c[1];
    // Mock integration data - in real app, this would come from an API
    var getIntegrationData = function (id) {
        var integrations = {
            mailchimp: {
                id: 'mailchimp',
                name: 'Mailchimp',
                description: 'Email marketing and automation platform',
                status: 'connected',
                apiKey: 'mc_live_1234567890abcdef',
                webhookUrl: 'https://api.thehuddleco.com/webhooks/mailchimp',
                settings: {
                    listId: 'abc123def456',
                    automationEnabled: true,
                    doubleOptIn: true,
                    tagNewSubscribers: true,
                    defaultTags: 'huddle-learner,inclusive-leadership'
                }
            },
            stripe: {
                id: 'stripe',
                name: 'Stripe',
                description: 'Payment processing and billing',
                status: 'connected',
                apiKey: 'sk_live_1234567890abcdef',
                webhookUrl: 'https://api.thehuddleco.com/webhooks/stripe',
                settings: {
                    publicKey: 'pk_live_1234567890abcdef',
                    currency: 'USD',
                    collectTaxes: true,
                    invoiceReminders: true,
                    trialPeriod: 14
                }
            },
            zoom: {
                id: 'zoom',
                name: 'Zoom',
                description: 'Video conferencing and webinars',
                status: 'connected',
                apiKey: 'zoom_jwt_1234567890abcdef',
                settings: {
                    accountId: 'zoom_account_123',
                    autoRecord: true,
                    waitingRoom: true,
                    defaultDuration: 60,
                    allowScreenShare: true
                }
            },
            slack: {
                id: 'slack',
                name: 'Slack',
                description: 'Team communication and notifications',
                status: 'connected',
                apiKey: 'xoxb-1234567890-abcdef',
                webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
                settings: {
                    channel: '#general',
                    notifyCompletions: true,
                    notifyEnrollments: true,
                    mentionUsers: false,
                    quietHours: true
                }
            }
        };
        return integrations[id] || {
            id: id,
            name: id.charAt(0).toUpperCase() + id.slice(1),
            description: "".concat(id.charAt(0).toUpperCase() + id.slice(1), " integration"),
            status: 'disconnected',
            settings: {}
        };
    };
    var _d = (0, react_1.useState)(getIntegrationData(integrationId || '')), config = _d[0], setConfig = _d[1];
    var handleSave = function () { return __awaiter(void 0, void 0, void 0, function () {
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
                    showToast("".concat(config.name, " configuration saved successfully!"), 'success');
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    showToast('Failed to save configuration. Please try again.', 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleTest = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setTesting(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    // Simulate connection test
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 3000); })];
                case 2:
                    // Simulate connection test
                    _a.sent();
                    showToast("".concat(config.name, " connection test successful!"), 'success');
                    return [3 /*break*/, 5];
                case 3:
                    error_2 = _a.sent();
                    showToast('Connection test failed. Please check your settings.', 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setTesting(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleRegenerateApiKey = function () { return __awaiter(void 0, void 0, void 0, function () {
        var newApiKey_1, error_3;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    setLoading(true);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1500); })];
                case 2:
                    _b.sent();
                    newApiKey_1 = "".concat((_a = config.apiKey) === null || _a === void 0 ? void 0 : _a.split('_')[0], "_live_").concat(Math.random().toString(36).substring(7));
                    setConfig(function (prev) { return (__assign(__assign({}, prev), { apiKey: newApiKey_1 })); });
                    showToast('API key regenerated successfully!', 'success');
                    return [3 /*break*/, 5];
                case 3:
                    error_3 = _b.sent();
                    showToast('Failed to regenerate API key.', 'error');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var updateSetting = function (key, value) {
        setConfig(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), { settings: __assign(__assign({}, prev.settings), (_a = {}, _a[key] = value, _a)) }));
        });
    };
    var getStatusIcon = function (status) {
        switch (status) {
            case 'connected':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-5 w-5 text-green-500" });
            default:
                return (0, jsx_runtime_1.jsx)(lucide_react_1.AlertCircle, { className: "h-5 w-5 text-red-500" });
        }
    };
    var getStatusColor = function (status) {
        switch (status) {
            case 'connected':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-red-100 text-red-800';
        }
    };
    if (!integrationId) {
        return (0, jsx_runtime_1.jsx)("div", { children: "Integration not found" });
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-4xl mx-auto", children: [(0, jsx_runtime_1.jsx)("div", { className: "mb-8", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4 mb-4", children: [(0, jsx_runtime_1.jsx)("button", { onClick: function () { return navigate('/admin/integrations'); }, className: "p-2 text-gray-500 hover:text-gray-700 rounded-lg transition-colors", title: "Back to Integrations", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowLeft, { className: "h-5 w-5" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-3", children: [(0, jsx_runtime_1.jsxs)("h1", { className: "text-3xl font-bold text-gray-900", children: [config.name, " Configuration"] }), (0, jsx_runtime_1.jsxs)("span", { className: "px-2 py-1 rounded-full text-xs font-medium ".concat(getStatusColor(config.status), " flex items-center space-x-1"), children: [getStatusIcon(config.status), (0, jsx_runtime_1.jsx)("span", { children: config.status })] })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mt-1", children: config.description })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center space-x-2", children: (0, jsx_runtime_1.jsxs)(LoadingButton_1.default, { onClick: handleTest, loading: testing, variant: "secondary", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Zap, { className: "h-4 w-4" }), "Test Connection"] }) })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [(0, jsx_runtime_1.jsxs)("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Key, { className: "h-5 w-5 text-gray-600" }), (0, jsx_runtime_1.jsx)("span", { children: "API Configuration" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [config.apiKey && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "API Key" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex-1 relative", children: [(0, jsx_runtime_1.jsx)("input", { type: showApiKey ? 'text' : 'password', value: config.apiKey, onChange: function (e) { return setConfig(function (prev) { return (__assign(__assign({}, prev), { apiKey: e.target.value })); }); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: function () { return setShowApiKey(!showApiKey); }, className: "absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600", children: showApiKey ? (0, jsx_runtime_1.jsx)(lucide_react_1.EyeOff, { className: "h-4 w-4" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }) })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: handleRegenerateApiKey, disabled: loading, className: "px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center space-x-1", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCw, { className: "h-3 w-3" }), (0, jsx_runtime_1.jsx)("span", { children: "Regenerate" })] })] })] })), config.webhookUrl && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Webhook URL" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Globe, { className: "h-4 w-4 text-gray-400" }), (0, jsx_runtime_1.jsx)("input", { type: "url", value: config.webhookUrl, onChange: function (e) { return setConfig(function (prev) { return (__assign(__assign({}, prev), { webhookUrl: e.target.value })); }); }, className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] }))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [(0, jsx_runtime_1.jsxs)("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Shield, { className: "h-5 w-5 text-gray-600" }), (0, jsx_runtime_1.jsx)("span", { children: "Settings" })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: Object.entries(config.settings).map(function (_a) {
                                    var key = _a[0], value = _a[1];
                                    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: key.replace(/([A-Z])/g, ' $1').replace(/^./, function (str) { return str.toUpperCase(); }) }), typeof value === 'boolean' ? ((0, jsx_runtime_1.jsxs)("label", { className: "flex items-center", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: value, onChange: function (e) { return updateSetting(key, e.target.checked); }, className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }), (0, jsx_runtime_1.jsx)("span", { className: "ml-2 text-sm text-gray-600", children: value ? 'Enabled' : 'Disabled' })] })) : typeof value === 'number' ? ((0, jsx_runtime_1.jsx)("input", { type: "number", value: value, onChange: function (e) { return updateSetting(key, parseInt(e.target.value) || 0); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })) : ((0, jsx_runtime_1.jsx)("input", { type: "text", value: value, onChange: function (e) { return updateSetting(key, e.target.value); }, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" }))] }, key));
                                }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-end space-x-4 pt-6 border-t border-gray-200", children: [(0, jsx_runtime_1.jsx)("button", { onClick: function () { return navigate('/admin/integrations'); }, className: "px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200", disabled: loading || testing, children: "Cancel" }), (0, jsx_runtime_1.jsxs)(LoadingButton_1.default, { onClick: handleSave, loading: loading, variant: "primary", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Save, { className: "h-4 w-4" }), "Save Configuration"] })] })] })] }));
};
exports.default = AdminIntegrationConfig;
