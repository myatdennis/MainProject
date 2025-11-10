import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
const LMSDownloadsPackage = () => {
    return (_jsxs("div", { className: "p-6 max-w-4xl mx-auto text-center", children: [_jsx("h1", { className: "text-2xl font-bold mb-4", children: "Download Complete Package" }), _jsx("p", { className: "text-gray-700 mb-6", children: "This is a placeholder page that would handle a large ZIP download and present download progress." }), _jsx("div", { className: "bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6", children: _jsx("button", { onClick: () => alert('Starting download (mock)'), className: "inline-flex items-center bg-gradient-to-r from-orange-400 to-red-500 text-white px-6 py-3 rounded-lg hover:from-orange-500 hover:to-red-600 transition-colors duration-200", children: "Download Complete Package (128.5 MB)" }) }), _jsx(Link, { to: "/lms/downloads", className: "text-sm text-orange-500", children: "\u2190 Back to Downloads" })] }));
};
export default LMSDownloadsPackage;
