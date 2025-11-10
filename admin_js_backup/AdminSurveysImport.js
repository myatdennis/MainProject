"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var react_router_dom_1 = require("react-router-dom");
var SEO_1 = require("../../components/SEO/SEO");
var Button_1 = require("../../components/ui/Button");
var AdminSurveysImport = function () {
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(SEO_1.default, { title: "Admin - Surveys Import", description: "Import surveys via CSV or JSON into the admin console." }), (0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-5xl mx-auto", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-bold text-gray-900 mb-4", children: "Import Surveys" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mb-6", children: "Upload CSV or JSON files to bulk create or update survey templates. This is a lightweight placeholder page \u2014 implement import logic when ready." }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white p-6 rounded-lg shadow-sm border border-gray-200", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-500 mb-4", children: "Choose a file to upload or paste survey JSON below." }), (0, jsx_runtime_1.jsx)("div", { className: "border border-dashed border-gray-200 rounded p-6 text-center", children: (0, jsx_runtime_1.jsx)("div", { className: "text-gray-400", children: "Drag & drop files here, or use the import tool in the admin console." }) }), (0, jsx_runtime_1.jsx)("div", { className: "mt-6 text-right", children: (0, jsx_runtime_1.jsx)(Button_1.default, { asChild: true, variant: "ghost", size: "sm", "aria-label": "Back to Surveys", "data-test": "admin-back-to-surveys", children: (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/surveys", children: "\u2190 Back to Surveys" }) }) })] })] })] }));
};
exports.default = AdminSurveysImport;
