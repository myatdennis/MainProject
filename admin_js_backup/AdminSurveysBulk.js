"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var react_router_dom_1 = require("react-router-dom");
var AdminSurveysBulk = function () {
    var searchParams = (0, react_router_dom_1.useSearchParams)()[0];
    var ids = searchParams.get('ids') || '';
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-5xl mx-auto", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-bold text-gray-900 mb-4", children: "Bulk Survey Actions" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mb-4", children: "Perform bulk actions on the following survey IDs:" }), (0, jsx_runtime_1.jsx)("pre", { className: "bg-gray-100 p-4 rounded", children: ids }), (0, jsx_runtime_1.jsx)("div", { className: "mt-6", children: (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/surveys", className: "text-sm text-orange-500", children: "\u2190 Back to Surveys" }) })] }));
};
exports.default = AdminSurveysBulk;
