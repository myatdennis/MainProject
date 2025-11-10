"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var react_router_dom_1 = require("react-router-dom");
var lucide_react_1 = require("lucide-react");
var ProfileView_1 = require("../../components/ProfileView");
var AdminUserProfile = function () {
    var userId = (0, react_router_dom_1.useParams)().userId;
    if (!userId) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "p-6", children: (0, jsx_runtime_1.jsxs)("div", { className: "text-center py-12", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "User ID Not Found" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 mb-4", children: "Please select a user to view their profile." }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/admin/users", className: "text-orange-600 hover:text-orange-700 font-medium", children: "Back to Users" })] }) }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-7xl mx-auto", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-6", children: [(0, jsx_runtime_1.jsxs)(react_router_dom_1.Link, { to: "/admin/users", className: "flex items-center text-gray-600 hover:text-gray-900 mb-4", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ArrowLeft, { className: "h-4 w-4 mr-2" }), "Back to Users"] }), (0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-bold text-gray-900", children: "User Profile" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600", children: "View user details, learning progress, and manage resources." })] }), (0, jsx_runtime_1.jsx)(ProfileView_1.default, { profileType: "user", profileId: userId, isAdmin: true })] }));
};
exports.default = AdminUserProfile;
