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
var supabaseClient_1 = require("../../lib/supabaseClient");
var AnalyticsDashboard = function () {
    var _a, _b, _c;
    var _d = (0, react_1.useState)({}), overview = _d[0], setOverview = _d[1];
    var _e = (0, react_1.useState)([]), courses = _e[0], setCourses = _e[1];
    var _f = (0, react_1.useState)([]), dropoffs = _f[0], setDropoffs = _f[1];
    var _g = (0, react_1.useState)(false), loading = _g[0], setLoading = _g[1];
    var fetchData = function () { return __awaiter(void 0, void 0, void 0, function () {
        var res, json, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, fetch('/api/admin/analytics', { credentials: 'include' })];
                case 2:
                    res = _a.sent();
                    return [4 /*yield*/, res.json()];
                case 3:
                    json = _a.sent();
                    setOverview(json.overview || {});
                    setCourses(Array.isArray(json.courses) ? json.courses : []);
                    setDropoffs(Array.isArray(json.dropoffs) ? json.dropoffs : []);
                    return [3 /*break*/, 6];
                case 4:
                    err_1 = _a.sent();
                    console.error('Failed to load analytics', err_1);
                    return [3 /*break*/, 6];
                case 5:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () {
        fetchData();
        // If Supabase client is available, use realtime subscriptions for fresh updates
        var subscription = null;
        if (supabaseClient_1.default) {
            try {
                subscription = supabaseClient_1.default
                    .channel('public:analytics')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_course_progress' }, function () {
                    fetchData();
                })
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_lesson_progress' }, function () {
                    fetchData();
                })
                    .subscribe();
            }
            catch (err) {
                console.warn('Realtime subscription failed, falling back to polling', err);
            }
        }
        // Fallback polling every 3s if realtime not available
        var id = setInterval(function () {
            if (!supabaseClient_1.default)
                fetchData();
        }, 3000);
        return function () {
            clearInterval(id);
            try {
                if (subscription && subscription.unsubscribe)
                    subscription.unsubscribe();
            }
            catch (e) { }
        };
    }, []);
    var exportCsv = function () { return __awaiter(void 0, void 0, void 0, function () {
        var a;
        return __generator(this, function (_a) {
            a = document.createElement('a');
            a.href = '/api/admin/analytics/export';
            a.download = 'analytics.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            return [2 /*return*/];
        });
    }); };
    var requestSummary = function () { return __awaiter(void 0, void 0, void 0, function () {
        var res, json, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, fetch('/api/admin/analytics/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}), credentials: 'include' })];
                case 1:
                    res = _a.sent();
                    return [4 /*yield*/, res.json()];
                case 2:
                    json = _a.sent();
                    alert(JSON.stringify(json.sample || json.ai || json.prompt, null, 2));
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _a.sent();
                    console.error('Summary request failed', err_2);
                    alert('Failed to generate summary');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    return ((0, jsx_runtime_1.jsxs)("div", { style: { padding: 20 }, children: [(0, jsx_runtime_1.jsx)("h2", { children: "Admin Analytics" }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', gap: 16, marginBottom: 16 }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { padding: 12, border: '1px solid #eee', borderRadius: 8 }, children: [(0, jsx_runtime_1.jsx)("div", { style: { fontSize: 12, color: '#666' }, children: "Active learners" }), (0, jsx_runtime_1.jsx)("div", { style: { fontSize: 20 }, children: (_a = overview.total_active_learners) !== null && _a !== void 0 ? _a : '—' })] }), (0, jsx_runtime_1.jsxs)("div", { style: { padding: 12, border: '1px solid #eee', borderRadius: 8 }, children: [(0, jsx_runtime_1.jsx)("div", { style: { fontSize: 12, color: '#666' }, children: "Orgs" }), (0, jsx_runtime_1.jsx)("div", { style: { fontSize: 20 }, children: (_b = overview.total_orgs) !== null && _b !== void 0 ? _b : '—' })] }), (0, jsx_runtime_1.jsxs)("div", { style: { padding: 12, border: '1px solid #eee', borderRadius: 8 }, children: [(0, jsx_runtime_1.jsx)("div", { style: { fontSize: 12, color: '#666' }, children: "Courses" }), (0, jsx_runtime_1.jsx)("div", { style: { fontSize: 20 }, children: (_c = overview.total_courses) !== null && _c !== void 0 ? _c : '—' })] })] }), (0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: 12 }, children: [(0, jsx_runtime_1.jsx)("button", { onClick: exportCsv, style: { marginRight: 8 }, children: "Export CSV" }), (0, jsx_runtime_1.jsx)("button", { onClick: requestSummary, children: "AI Summary" })] }), (0, jsx_runtime_1.jsx)("h3", { children: "Top courses (by completion %)" }), loading ? (0, jsx_runtime_1.jsx)("div", { children: "Loading\u2026" }) : ((0, jsx_runtime_1.jsxs)("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { style: { textAlign: 'left', padding: 8 }, children: "Course" }), (0, jsx_runtime_1.jsx)("th", { style: { textAlign: 'right', padding: 8 }, children: "Completion %" }), (0, jsx_runtime_1.jsx)("th", { style: { textAlign: 'right', padding: 8 }, children: "Avg progress" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: courses.map(function (c) {
                            var _a, _b;
                            return ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { style: { padding: 8 }, children: c.course_id }), (0, jsx_runtime_1.jsx)("td", { style: { padding: 8, textAlign: 'right' }, children: (_a = c.completion_percent) !== null && _a !== void 0 ? _a : '—' }), (0, jsx_runtime_1.jsx)("td", { style: { padding: 8, textAlign: 'right' }, children: (_b = c.avg_progress) !== null && _b !== void 0 ? _b : '—' })] }, c.course_id));
                        }) })] })), (0, jsx_runtime_1.jsx)("h3", { style: { marginTop: 20 }, children: "Top lesson dropoffs" }), (0, jsx_runtime_1.jsx)("ul", { children: dropoffs.map(function (d) { return ((0, jsx_runtime_1.jsxs)("li", { children: [d.course_id, " / ", d.lesson_id, " \u2014 dropoff ", d.dropoff_percent, "%"] }, "".concat(d.course_id, "_").concat(d.lesson_id))); }) })] }));
};
exports.default = AnalyticsDashboard;
