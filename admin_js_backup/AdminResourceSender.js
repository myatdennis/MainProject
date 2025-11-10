"use strict";
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
var ResourceSender_1 = require("../../components/ResourceSender");
var AdminResourceSender = function () {
    var _a = (0, react_1.useState)([]), sentResources = _a[0], setSentResources = _a[1];
    var handleResourceSent = function (resource, profileType, profileId) {
        setSentResources(function (prev) { return __spreadArray(__spreadArray([], prev, true), [{ resource: resource, profileType: profileType, profileId: profileId, sentAt: new Date() }], false); });
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-7xl mx-auto", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-6", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-bold text-gray-900 mb-2", children: "Send Resources" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600", children: "Send documents, links, notes, and other resources directly to user or organization profiles." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [(0, jsx_runtime_1.jsx)("div", { className: "lg:col-span-2", children: (0, jsx_runtime_1.jsx)(ResourceSender_1.default, { onResourceSent: handleResourceSent }) }), (0, jsx_runtime_1.jsx)("div", { className: "lg:col-span-1", children: (0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Recent Activity" }), sentResources.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "text-gray-500 text-sm", children: "No resources sent yet." })) : ((0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: sentResources.slice(-5).reverse().map(function (item, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "p-3 bg-gray-50 rounded-lg", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-sm text-gray-900", children: item.resource.title }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-gray-600 mt-1", children: ["Sent to ", item.profileType, " \u2022 ", item.sentAt.toLocaleTimeString()] })] }, index)); }) }))] }) })] })] }));
};
exports.default = AdminResourceSender;
