import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import ResourceSender from '../../components/ResourceSender';
const AdminResourceSender = () => {
    const [sentResources, setSentResources] = useState([]);
    const handleResourceSent = (resource, profileType, profileId) => {
        setSentResources(prev => [...prev, { resource, profileType, profileId, sentAt: new Date() }]);
    };
    return (_jsxs("div", { className: "p-6 max-w-7xl mx-auto", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900 mb-2", children: "Send Resources" }), _jsx("p", { className: "text-gray-600", children: "Send documents, links, notes, and other resources directly to user or organization profiles." })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsx("div", { className: "lg:col-span-2", children: _jsx(ResourceSender, { onResourceSent: handleResourceSent }) }), _jsx("div", { className: "lg:col-span-1", children: _jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Recent Activity" }), sentResources.length === 0 ? (_jsx("p", { className: "text-gray-500 text-sm", children: "No resources sent yet." })) : (_jsx("div", { className: "space-y-3", children: sentResources.slice(-5).reverse().map((item, index) => (_jsxs("div", { className: "p-3 bg-gray-50 rounded-lg", children: [_jsx("div", { className: "font-medium text-sm text-gray-900", children: item.resource.title }), _jsxs("div", { className: "text-xs text-gray-600 mt-1", children: ["Sent to ", item.profileType, " \u2022 ", item.sentAt.toLocaleTimeString()] })] }, index))) }))] }) })] })] }));
};
export default AdminResourceSender;
