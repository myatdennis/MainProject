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
var AdminQueueMonitor = function () {
    var _a = (0, react_1.useState)([]), queue = _a[0], setQueue = _a[1];
    var _b = (0, react_1.useState)(null), lastFlush = _b[0], setLastFlush = _b[1];
    var refresh = function () { return __awaiter(void 0, void 0, void 0, function () {
        var mod;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../../dal/surveys'); })];
                case 1:
                    mod = _a.sent();
                    setQueue(mod.getQueueSnapshot());
                    setLastFlush(mod.getLastFlushTime());
                    return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () {
        refresh();
        var mounted = true;
        Promise.resolve().then(function () { return require('../../dal/surveys'); }).then(function (mod) {
            var handler = function () { if (mounted)
                refresh(); };
            mod.surveyQueueEvents.addEventListener('queuechange', handler);
            mod.surveyQueueEvents.addEventListener('flush', handler);
            return function () { mounted = false; mod.surveyQueueEvents.removeEventListener('queuechange', handler); mod.surveyQueueEvents.removeEventListener('flush', handler); };
        });
    }, []);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-5xl mx-auto", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-6", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-bold", children: "Queue Monitor" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/surveys", className: "text-sm text-orange-500 mr-4", children: "\u2190 Back to Surveys" }), (0, jsx_runtime_1.jsx)("button", { onClick: function () { return __awaiter(void 0, void 0, void 0, function () { var mod; return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../../dal/surveys'); })];
                                        case 1:
                                            mod = _a.sent();
                                            return [4 /*yield*/, mod.flushNow()];
                                        case 2:
                                            _a.sent();
                                            refresh();
                                            return [2 /*return*/];
                                    }
                                }); }); }, className: "px-3 py-2 bg-blue-600 text-white rounded", children: "Flush Now" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-4 rounded shadow-sm border", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-4 text-sm text-gray-600", children: ["Pending items: ", (0, jsx_runtime_1.jsx)("strong", { children: queue.length })] }), lastFlush && (0, jsx_runtime_1.jsxs)("div", { className: "mb-4 text-xs text-gray-500", children: ["Last flush: ", new Date(lastFlush).toLocaleString()] }), queue.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-500", children: "Queue is empty." })) : ((0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: queue.map(function (item, idx) { return ((0, jsx_runtime_1.jsxs)("div", { className: "p-3 border rounded", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium", children: item.title || item.id }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-gray-600", children: ["Status: ", item.status || 'draft'] }), (0, jsx_runtime_1.jsx)("pre", { className: "text-xs mt-2 bg-gray-50 p-2 rounded max-h-40 overflow-auto", children: JSON.stringify(item, null, 2) })] }, idx)); }) }))] })] }));
};
exports.default = AdminQueueMonitor;
