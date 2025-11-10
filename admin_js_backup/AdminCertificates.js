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
var lucide_react_1 = require("lucide-react");
var AdminCertificates = function () {
    var _a = (0, react_1.useState)(''), searchTerm = _a[0], setSearchTerm = _a[1];
    var _b = (0, react_1.useState)('all'), filterStatus = _b[0], setFilterStatus = _b[1];
    var _c = (0, react_1.useState)([]), selectedCerts = _c[0], setSelectedCerts = _c[1];
    var certificates = [
        {
            id: '1',
            name: 'Inclusive Leadership Certification',
            description: 'Comprehensive certification for completing all 5 core modules',
            template: 'Professional Template A',
            issued: 142,
            expiry: '1 year',
            status: 'active',
            lastUpdated: '2025-02-15',
            requirements: ['Complete all 5 modules', 'Pass final assessment (80%)', 'Submit action plan'],
            design: {
                primaryColor: '#de7b12',
                secondaryColor: '#D72638',
                logo: 'huddle-co-logo.png',
                background: 'certificate-bg-1.jpg'
            }
        },
        {
            id: '2',
            name: 'Courageous Conversations Certificate',
            description: 'Specialized certificate for mastering difficult conversations',
            template: 'Modern Template B',
            issued: 89,
            expiry: '6 months',
            status: 'active',
            lastUpdated: '2025-02-10',
            requirements: ['Complete Conversations module', 'Practice session recording', 'Peer feedback'],
            design: {
                primaryColor: '#3A7DFF',
                secondaryColor: '#228B22',
                logo: 'huddle-co-logo.png',
                background: 'certificate-bg-2.jpg'
            }
        },
        {
            id: '3',
            name: 'DEI Foundations Certificate',
            description: 'Entry-level certificate for basic DEI understanding',
            template: 'Classic Template C',
            issued: 234,
            expiry: 'No expiry',
            status: 'active',
            lastUpdated: '2025-01-20',
            requirements: ['Complete Foundations module', 'Pass quiz (70%)', 'Reflection submission'],
            design: {
                primaryColor: '#228B22',
                secondaryColor: '#de7b12',
                logo: 'huddle-co-logo.png',
                background: 'certificate-bg-3.jpg'
            }
        },
        {
            id: '4',
            name: 'Advanced Leadership Certificate',
            description: 'Premium certification for senior leaders',
            template: 'Executive Template D',
            issued: 45,
            expiry: '2 years',
            status: 'draft',
            lastUpdated: '2025-03-01',
            requirements: ['Complete all modules', 'Leadership project', 'Mentor 2 colleagues', 'Executive assessment'],
            design: {
                primaryColor: '#D72638',
                secondaryColor: '#3A7DFF',
                logo: 'huddle-co-logo.png',
                background: 'certificate-bg-4.jpg'
            }
        }
    ];
    var expiringCertificates = [
        { learner: 'Sarah Chen', certificate: 'Inclusive Leadership', expires: '2025-03-20', daysLeft: 9 },
        { learner: 'Marcus Rodriguez', certificate: 'Courageous Conversations', expires: '2025-03-25', daysLeft: 14 },
        { learner: 'Jennifer Walsh', certificate: 'DEI Foundations', expires: '2025-04-01', daysLeft: 21 },
        { learner: 'David Thompson', certificate: 'Inclusive Leadership', expires: '2025-04-05', daysLeft: 25 }
    ];
    var templates = [
        { id: 'template-1', name: 'Professional Template A', preview: 'template-1-preview.jpg' },
        { id: 'template-2', name: 'Modern Template B', preview: 'template-2-preview.jpg' },
        { id: 'template-3', name: 'Classic Template C', preview: 'template-3-preview.jpg' },
        { id: 'template-4', name: 'Executive Template D', preview: 'template-4-preview.jpg' }
    ];
    var filteredCertificates = certificates.filter(function (cert) {
        var matchesSearch = cert.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cert.description.toLowerCase().includes(searchTerm.toLowerCase());
        var matchesFilter = filterStatus === 'all' || cert.status === filterStatus;
        return matchesSearch && matchesFilter;
    });
    var handleSelectCert = function (certId) {
        setSelectedCerts(function (prev) {
            return prev.includes(certId)
                ? prev.filter(function (id) { return id !== certId; })
                : __spreadArray(__spreadArray([], prev, true), [certId], false);
        });
    };
    var handleSelectAll = function () {
        if (selectedCerts.length === filteredCertificates.length) {
            setSelectedCerts([]);
        }
        else {
            setSelectedCerts(filteredCertificates.map(function (cert) { return cert.id; }));
        }
    };
    var getStatusColor = function (status) {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'draft':
                return 'bg-yellow-100 text-yellow-800';
            case 'archived':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    var getExpiryColor = function (daysLeft) {
        if (daysLeft <= 7)
            return 'text-red-600';
        if (daysLeft <= 14)
            return 'text-yellow-600';
        return 'text-green-600';
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 max-w-7xl mx-auto", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-8", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Certificate Management" }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600", children: "Create, manage, and track digital certificates and credentials" })] }), (0, jsx_runtime_1.jsx)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative flex-1 max-w-md", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" }), (0, jsx_runtime_1.jsx)("input", { type: "text", placeholder: "Search certificates...", value: searchTerm, onChange: function (e) { return setSearchTerm(e.target.value); }, className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Filter, { className: "h-5 w-5 text-gray-400" }), (0, jsx_runtime_1.jsxs)("select", { value: filterStatus, onChange: function (e) { return setFilterStatus(e.target.value); }, className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [(0, jsx_runtime_1.jsx)("option", { value: "all", children: "All Status" }), (0, jsx_runtime_1.jsx)("option", { value: "active", children: "Active" }), (0, jsx_runtime_1.jsx)("option", { value: "draft", children: "Draft" }), (0, jsx_runtime_1.jsx)("option", { value: "archived", children: "Archived" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-4", children: [selectedCerts.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center space-x-2", children: (0, jsx_runtime_1.jsxs)("button", { className: "bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200", children: ["Bulk Actions (", selectedCerts.length, ")"] }) })), (0, jsx_runtime_1.jsxs)("button", { className: "bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Create Certificate" })] }), (0, jsx_runtime_1.jsxs)("button", { className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Upload, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Import Template" })] })] })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: "lg:col-span-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 mb-8", children: filteredCertificates.map(function (cert) { return ((0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)("div", { className: "h-32 bg-gradient-to-br from-orange-100 to-blue-100 flex items-center justify-center", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Award, { className: "h-12 w-12 text-orange-500" }) }), (0, jsx_runtime_1.jsx)("div", { className: "absolute top-4 left-4", children: (0, jsx_runtime_1.jsx)("span", { className: "px-2 py-1 rounded-full text-xs font-medium ".concat(getStatusColor(cert.status)), children: cert.status }) }), (0, jsx_runtime_1.jsx)("div", { className: "absolute top-4 right-4", children: (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: selectedCerts.includes(cert.id), onChange: function () { return handleSelectCert(cert.id); }, className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "p-6", children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-bold text-lg text-gray-900 mb-2", children: cert.name }), (0, jsx_runtime_1.jsx)("p", { className: "text-gray-600 text-sm mb-4", children: cert.description }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 mb-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Issued:" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-gray-900", children: cert.issued })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Expiry:" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-gray-900", children: cert.expiry })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between text-sm", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Template:" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-gray-900", children: cert.template })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: [(0, jsx_runtime_1.jsx)("h4", { className: "text-sm font-medium text-gray-700 mb-2", children: "Requirements:" }), (0, jsx_runtime_1.jsxs)("ul", { className: "space-y-1", children: [cert.requirements.slice(0, 2).map(function (req, index) { return ((0, jsx_runtime_1.jsxs)("li", { className: "flex items-center text-xs text-gray-600", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-3 w-3 text-green-500 mr-2" }), req] }, index)); }), cert.requirements.length > 2 && ((0, jsx_runtime_1.jsxs)("li", { className: "text-xs text-gray-500", children: ["+", cert.requirements.length - 2, " more requirements"] }))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between pt-4 border-t border-gray-200", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-gray-600", children: ["Updated ", new Date(cert.lastUpdated).toLocaleDateString()] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("button", { className: "p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg", title: "Preview", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Eye, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Edit", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Edit, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Duplicate", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Copy, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)("button", { className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Settings", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Settings, { className: "h-4 w-4" }) })] })] })] })] }, cert.id)); }) }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-6", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-bold text-gray-900", children: "Certificate Templates" }), (0, jsx_runtime_1.jsxs)("button", { className: "bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Palette, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Design New Template" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: templates.map(function (template) { return ((0, jsx_runtime_1.jsxs)("div", { className: "border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200", children: [(0, jsx_runtime_1.jsx)("div", { className: "h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-3 flex items-center justify-center", children: (0, jsx_runtime_1.jsx)(lucide_react_1.FileText, { className: "h-8 w-8 text-gray-400" }) }), (0, jsx_runtime_1.jsx)("h3", { className: "font-medium text-gray-900 mb-2", children: template.name }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("button", { className: "text-sm text-blue-600 hover:text-blue-700", children: "Preview" }), (0, jsx_runtime_1.jsx)("button", { className: "text-sm text-gray-600 hover:text-gray-700", children: "Use Template" })] })] }, template.id)); }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2 mb-4", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-5 w-5 text-yellow-500" }), (0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-bold text-gray-900", children: "Expiring Soon" })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: expiringCertificates.map(function (cert, index) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between p-3 border border-gray-200 rounded-lg", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-gray-900 text-sm", children: cert.learner }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-gray-600", children: cert.certificate })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-right", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-sm font-medium ".concat(getExpiryColor(cert.daysLeft)), children: [cert.daysLeft, " days"] }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-gray-500", children: new Date(cert.expires).toLocaleDateString() })] })] }, index)); }) }), (0, jsx_runtime_1.jsx)("button", { className: "w-full mt-4 bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600 transition-colors duration-200 text-sm", children: "Send Renewal Reminders" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Certificate Stats" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Total Issued" }), (0, jsx_runtime_1.jsx)("span", { className: "font-bold text-gray-900", children: "510" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Active" }), (0, jsx_runtime_1.jsx)("span", { className: "font-bold text-green-600", children: "467" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Expiring (30 days)" }), (0, jsx_runtime_1.jsx)("span", { className: "font-bold text-yellow-600", children: "43" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-600", children: "Expired" }), (0, jsx_runtime_1.jsx)("span", { className: "font-bold text-red-600", children: "12" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Quick Actions" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("button", { className: "w-full bg-white text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Download, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Export All Certificates" })] }), (0, jsx_runtime_1.jsxs)("button", { className: "w-full bg-white text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Calendar, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Schedule Renewals" })] }), (0, jsx_runtime_1.jsxs)("button", { className: "w-full bg-white text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Users, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsx)("span", { children: "Bulk Issue Certificates" })] })] })] })] })] })] }));
};
exports.default = AdminCertificates;
