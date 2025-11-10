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
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var react_1 = require("react");
var api_1 = require("../../lib/api");
var AdminWebpageEditor = function () {
    var _a = (0, react_1.useState)([]), textItems = _a[0], setTextItems = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(false), saving = _c[0], setSaving = _c[1];
    var _d = (0, react_1.useState)(null), error = _d[0], setError = _d[1];
    var _e = (0, react_1.useState)(false), success = _e[0], setSuccess = _e[1];
    (0, react_1.useEffect)(function () {
        (0, api_1.api)('/api/text-content')
            .then(function (res) { return res.json(); })
            .then(function (data) {
            setTextItems(data);
            setLoading(false);
        })
            .catch(function () {
            setError('Failed to load content');
            setLoading(false);
        });
    }, []);
    var handleChange = function (key, value) {
        setTextItems(function (items) { return items.map(function (item) {
            return item.key === key ? __assign(__assign({}, item), { value: value }) : item;
        }); });
        setSuccess(false);
        setError(null);
    };
    var handleSave = function () {
        setSaving(true);
        (0, api_1.api)('/api/text-content', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(textItems)
        })
            .then(function (res) {
            if (!res.ok)
                throw new Error('Failed to save');
            setSuccess(true);
            setSaving(false);
        })
            .catch(function () {
            setError('Failed to save');
            setSaving(false);
        });
    };
    if (loading)
        return (0, jsx_runtime_1.jsx)("div", { children: "Loading..." });
    if (error)
        return (0, jsx_runtime_1.jsx)("div", { className: "text-red-500", children: error });
    return ((0, jsx_runtime_1.jsxs)("div", { className: "max-w-3xl mx-auto mt-8 p-6 bg-white rounded-lg shadow", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-bold mb-4", children: "Edit Website Text" }), (0, jsx_runtime_1.jsxs)("form", { children: [textItems.map(function (item) { return ((0, jsx_runtime_1.jsxs)("div", { className: "mb-6", children: [(0, jsx_runtime_1.jsx)("label", { className: "font-semibold text-gray-800", children: item.key }), (0, jsx_runtime_1.jsx)("textarea", { className: "w-full border rounded mt-2 p-2", value: item.value, onChange: function (e) { return handleChange(item.key, e.target.value); }, rows: 2 })] }, item.key)); }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "bg-blue-500 text-white px-6 py-2 rounded font-semibold", onClick: handleSave, disabled: saving, children: saving ? "Saving..." : "Save Changes" }), success && (0, jsx_runtime_1.jsx)("div", { className: "text-green-500 mt-2", children: "Saved!" }), error && (0, jsx_runtime_1.jsx)("div", { className: "text-red-500 mt-2", children: error })] })] }));
};
exports.default = AdminWebpageEditor;
