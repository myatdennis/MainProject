import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Award, Plus, Search, Filter, Download, Upload, Edit, Copy, Eye, Calendar, Users, CheckCircle, AlertTriangle, Settings, Palette, FileText } from 'lucide-react';
const AdminCertificates = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedCerts, setSelectedCerts] = useState([]);
    const certificates = [
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
    const expiringCertificates = [
        { learner: 'Sarah Chen', certificate: 'Inclusive Leadership', expires: '2025-03-20', daysLeft: 9 },
        { learner: 'Marcus Rodriguez', certificate: 'Courageous Conversations', expires: '2025-03-25', daysLeft: 14 },
        { learner: 'Jennifer Walsh', certificate: 'DEI Foundations', expires: '2025-04-01', daysLeft: 21 },
        { learner: 'David Thompson', certificate: 'Inclusive Leadership', expires: '2025-04-05', daysLeft: 25 }
    ];
    const templates = [
        { id: 'template-1', name: 'Professional Template A', preview: 'template-1-preview.jpg' },
        { id: 'template-2', name: 'Modern Template B', preview: 'template-2-preview.jpg' },
        { id: 'template-3', name: 'Classic Template C', preview: 'template-3-preview.jpg' },
        { id: 'template-4', name: 'Executive Template D', preview: 'template-4-preview.jpg' }
    ];
    const filteredCertificates = certificates.filter(cert => {
        const matchesSearch = cert.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cert.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || cert.status === filterStatus;
        return matchesSearch && matchesFilter;
    });
    const handleSelectCert = (certId) => {
        setSelectedCerts(prev => prev.includes(certId)
            ? prev.filter(id => id !== certId)
            : [...prev, certId]);
    };
    const handleSelectAll = () => {
        if (selectedCerts.length === filteredCertificates.length) {
            setSelectedCerts([]);
        }
        else {
            setSelectedCerts(filteredCertificates.map(cert => cert.id));
        }
    };
    const getStatusColor = (status) => {
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
    const getExpiryColor = (daysLeft) => {
        if (daysLeft <= 7)
            return 'text-red-600';
        if (daysLeft <= 14)
            return 'text-yellow-600';
        return 'text-green-600';
    };
    return (_jsxs("div", { className: "p-6 max-w-7xl mx-auto", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Certificate Management" }), _jsx("p", { className: "text-gray-600", children: "Create, manage, and track digital certificates and credentials" })] }), _jsx("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8", children: _jsxs("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0", children: [_jsxs("div", { className: "flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1", children: [_jsxs("div", { className: "relative flex-1 max-w-md", children: [_jsx(Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" }), _jsx("input", { type: "text", placeholder: "Search certificates...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Filter, { className: "h-5 w-5 text-gray-400" }), _jsxs("select", { value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "all", children: "All Status" }), _jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "draft", children: "Draft" }), _jsx("option", { value: "archived", children: "Archived" })] })] })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [selectedCerts.length > 0 && (_jsx("div", { className: "flex items-center space-x-2", children: _jsxs("button", { className: "bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200", children: ["Bulk Actions (", selectedCerts.length, ")"] }) })), _jsxs("button", { className: "bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Plus, { className: "h-4 w-4" }), _jsx("span", { children: "Create Certificate" })] }), _jsxs("button", { className: "border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Upload, { className: "h-4 w-4" }), _jsx("span", { children: "Import Template" })] })] })] }) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-8", children: [_jsxs("div", { className: "lg:col-span-2", children: [_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 mb-8", children: filteredCertificates.map((cert) => (_jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: "h-32 bg-gradient-to-br from-orange-100 to-blue-100 flex items-center justify-center", children: _jsx(Award, { className: "h-12 w-12 text-orange-500" }) }), _jsx("div", { className: "absolute top-4 left-4", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(cert.status)}`, children: cert.status }) }), _jsx("div", { className: "absolute top-4 right-4", children: _jsx("input", { type: "checkbox", checked: selectedCerts.includes(cert.id), onChange: () => handleSelectCert(cert.id), className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded" }) })] }), _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "font-bold text-lg text-gray-900 mb-2", children: cert.name }), _jsx("p", { className: "text-gray-600 text-sm mb-4", children: cert.description }), _jsxs("div", { className: "space-y-2 mb-4", children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("span", { className: "text-gray-600", children: "Issued:" }), _jsx("span", { className: "font-medium text-gray-900", children: cert.issued })] }), _jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("span", { className: "text-gray-600", children: "Expiry:" }), _jsx("span", { className: "font-medium text-gray-900", children: cert.expiry })] }), _jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("span", { className: "text-gray-600", children: "Template:" }), _jsx("span", { className: "font-medium text-gray-900", children: cert.template })] })] }), _jsxs("div", { className: "mb-4", children: [_jsx("h4", { className: "text-sm font-medium text-gray-700 mb-2", children: "Requirements:" }), _jsxs("ul", { className: "space-y-1", children: [cert.requirements.slice(0, 2).map((req, index) => (_jsxs("li", { className: "flex items-center text-xs text-gray-600", children: [_jsx(CheckCircle, { className: "h-3 w-3 text-green-500 mr-2" }), req] }, index))), cert.requirements.length > 2 && (_jsxs("li", { className: "text-xs text-gray-500", children: ["+", cert.requirements.length - 2, " more requirements"] }))] })] }), _jsxs("div", { className: "flex items-center justify-between pt-4 border-t border-gray-200", children: [_jsxs("div", { className: "text-sm text-gray-600", children: ["Updated ", new Date(cert.lastUpdated).toLocaleDateString()] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { className: "p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg", title: "Preview", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx("button", { className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Edit", children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx("button", { className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Duplicate", children: _jsx(Copy, { className: "h-4 w-4" }) }), _jsx("button", { className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Settings", children: _jsx(Settings, { className: "h-4 w-4" }) })] })] })] })] }, cert.id))) }), _jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900", children: "Certificate Templates" }), _jsxs("button", { className: "bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Palette, { className: "h-4 w-4" }), _jsx("span", { children: "Design New Template" })] })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: templates.map((template) => (_jsxs("div", { className: "border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200", children: [_jsx("div", { className: "h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-3 flex items-center justify-center", children: _jsx(FileText, { className: "h-8 w-8 text-gray-400" }) }), _jsx("h3", { className: "font-medium text-gray-900 mb-2", children: template.name }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("button", { className: "text-sm text-blue-600 hover:text-blue-700", children: "Preview" }), _jsx("button", { className: "text-sm text-gray-600 hover:text-gray-700", children: "Use Template" })] })] }, template.id))) })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-4", children: [_jsx(AlertTriangle, { className: "h-5 w-5 text-yellow-500" }), _jsx("h3", { className: "text-lg font-bold text-gray-900", children: "Expiring Soon" })] }), _jsx("div", { className: "space-y-3", children: expiringCertificates.map((cert, index) => (_jsxs("div", { className: "flex items-center justify-between p-3 border border-gray-200 rounded-lg", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900 text-sm", children: cert.learner }), _jsx("div", { className: "text-xs text-gray-600", children: cert.certificate })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: `text-sm font-medium ${getExpiryColor(cert.daysLeft)}`, children: [cert.daysLeft, " days"] }), _jsx("div", { className: "text-xs text-gray-500", children: new Date(cert.expires).toLocaleDateString() })] })] }, index))) }), _jsx("button", { className: "w-full mt-4 bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600 transition-colors duration-200 text-sm", children: "Send Renewal Reminders" })] }), _jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsx("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Certificate Stats" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Total Issued" }), _jsx("span", { className: "font-bold text-gray-900", children: "510" })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Active" }), _jsx("span", { className: "font-bold text-green-600", children: "467" })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Expiring (30 days)" }), _jsx("span", { className: "font-bold text-yellow-600", children: "43" })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Expired" }), _jsx("span", { className: "font-bold text-red-600", children: "12" })] })] })] }), _jsxs("div", { className: "bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6", children: [_jsx("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Quick Actions" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("button", { className: "w-full bg-white text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Download, { className: "h-4 w-4" }), _jsx("span", { children: "Export All Certificates" })] }), _jsxs("button", { className: "w-full bg-white text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Calendar, { className: "h-4 w-4" }), _jsx("span", { children: "Schedule Renewals" })] }), _jsxs("button", { className: "w-full bg-white text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Users, { className: "h-4 w-4" }), _jsx("span", { children: "Bulk Issue Certificates" })] })] })] })] })] })] }));
};
export default AdminCertificates;
