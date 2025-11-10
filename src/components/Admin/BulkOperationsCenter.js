import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from 'react';
import { Upload, Download, Mail, Award, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
const BulkOperationsCenter = () => {
    const { showToast } = useToast();
    const fileInputRef = useRef(null);
    const [operations, setOperations] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [selectedCourses, setSelectedCourses] = useState([]);
    const mockUsers = [
        'Sarah Chen', 'Mike Johnson', 'Emma Davis', 'Alex Rodriguez', 'Lisa Thompson'
    ];
    const mockCourses = [
        'Inclusive Leadership', 'Bias Awareness', 'Cultural Intelligence', 'Communication Skills'
    ];
    const startOperation = (type, description) => {
        const newOperation = {
            id: Date.now().toString(),
            type,
            status: 'processing',
            progress: 0,
            total: 100,
            processed: 0,
            errors: [],
            startTime: new Date()
        };
        setOperations(prev => [newOperation, ...prev]);
        // Simulate progress
        const interval = setInterval(() => {
            setOperations(prev => prev.map(op => {
                if (op.id === newOperation.id && op.status === 'processing') {
                    const newProcessed = Math.min(op.processed + Math.random() * 10, op.total);
                    const newProgress = (newProcessed / op.total) * 100;
                    if (newProcessed >= op.total) {
                        clearInterval(interval);
                        showToast(`${description} completed successfully!`, 'success');
                        return {
                            ...op,
                            status: 'completed',
                            progress: 100,
                            processed: op.total,
                            endTime: new Date()
                        };
                    }
                    return {
                        ...op,
                        progress: newProgress,
                        processed: newProcessed
                    };
                }
                return op;
            }));
        }, 500);
        showToast(`${description} started...`, 'info');
    };
    const handleFileUpload = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
                showToast('Please upload a CSV or Excel file', 'error');
                return;
            }
            startOperation('import', `Importing users from ${file.name}`);
        }
    };
    const handleBulkAssignment = () => {
        if (selectedUsers.length === 0 || selectedCourses.length === 0) {
            showToast('Please select users and courses', 'error');
            return;
        }
        startOperation('assign', `Assigning ${selectedCourses.length} courses to ${selectedUsers.length} users`);
    };
    const handleBulkEmail = () => {
        if (selectedUsers.length === 0) {
            showToast('Please select users to email', 'error');
            return;
        }
        startOperation('email', `Sending emails to ${selectedUsers.length} users`);
    };
    const handleBulkCertificates = () => {
        if (selectedUsers.length === 0) {
            showToast('Please select users for certificates', 'error');
            return;
        }
        startOperation('certificate', `Generating certificates for ${selectedUsers.length} users`);
    };
    const exportUsers = () => {
        startOperation('export', 'Exporting user data');
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case 'processing':
                return _jsx(Loader, { className: "w-4 h-4 text-blue-500 animate-spin" });
            case 'completed':
                return _jsx(CheckCircle, { className: "w-4 h-4 text-green-500" });
            case 'failed':
                return _jsx(AlertCircle, { className: "w-4 h-4 text-red-500" });
            default:
                return _jsx("div", { className: "w-4 h-4 bg-gray-300 rounded-full" });
        }
    };
    const getOperationName = (type) => {
        switch (type) {
            case 'import': return 'User Import';
            case 'export': return 'Data Export';
            case 'assign': return 'Course Assignment';
            case 'email': return 'Bulk Email';
            case 'certificate': return 'Certificate Generation';
            default: return 'Operation';
        }
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900", children: "Bulk Operations Center" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [_jsxs("div", { className: "flex items-center mb-4", children: [_jsx(Upload, { className: "w-5 h-5 text-blue-500 mr-2" }), _jsx("h3", { className: "font-semibold text-gray-900", children: "Import Users" })] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Upload CSV or Excel file with user data" }), _jsx("input", { ref: fileInputRef, type: "file", accept: ".csv,.xlsx", onChange: handleFileUpload, className: "hidden" }), _jsx("button", { onClick: () => fileInputRef.current?.click(), className: "w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors", children: "Upload File" })] }), _jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [_jsxs("div", { className: "flex items-center mb-4", children: [_jsx(Download, { className: "w-5 h-5 text-green-500 mr-2" }), _jsx("h3", { className: "font-semibold text-gray-900", children: "Export Data" })] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Download user and course data" }), _jsx("button", { onClick: exportUsers, className: "w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors", children: "Export CSV" })] }), _jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [_jsxs("div", { className: "flex items-center mb-4", children: [_jsx(Mail, { className: "w-5 h-5 text-orange-500 mr-2" }), _jsx("h3", { className: "font-semibold text-gray-900", children: "Send Emails" })] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Send notifications to multiple users" }), _jsx("button", { onClick: handleBulkEmail, className: "w-full bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors", children: "Send Bulk Email" })] }), _jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [_jsxs("div", { className: "flex items-center mb-4", children: [_jsx(Award, { className: "w-5 h-5 text-purple-500 mr-2" }), _jsx("h3", { className: "font-semibold text-gray-900", children: "Certificates" })] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Generate certificates in bulk" }), _jsx("button", { onClick: handleBulkCertificates, className: "w-full bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors", children: "Generate Certificates" })] })] }), _jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Selection Panel" }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: ["Select Users (", selectedUsers.length, " selected)"] }), _jsx("div", { className: "border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto", children: mockUsers.map(user => (_jsxs("label", { className: "flex items-center space-x-2 p-1", children: [_jsx("input", { type: "checkbox", checked: selectedUsers.includes(user), onChange: (e) => {
                                                        if (e.target.checked) {
                                                            setSelectedUsers(prev => [...prev, user]);
                                                        }
                                                        else {
                                                            setSelectedUsers(prev => prev.filter(u => u !== user));
                                                        }
                                                    }, className: "rounded border-gray-300" }), _jsx("span", { className: "text-sm", children: user })] }, user))) })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: ["Select Courses (", selectedCourses.length, " selected)"] }), _jsx("div", { className: "border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto", children: mockCourses.map(course => (_jsxs("label", { className: "flex items-center space-x-2 p-1", children: [_jsx("input", { type: "checkbox", checked: selectedCourses.includes(course), onChange: (e) => {
                                                        if (e.target.checked) {
                                                            setSelectedCourses(prev => [...prev, course]);
                                                        }
                                                        else {
                                                            setSelectedCourses(prev => prev.filter(c => c !== course));
                                                        }
                                                    }, className: "rounded border-gray-300" }), _jsx("span", { className: "text-sm", children: course })] }, course))) })] })] }), _jsx("div", { className: "mt-4", children: _jsx("button", { onClick: handleBulkAssignment, className: "bg-indigo-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-600 transition-colors", children: "Assign Selected Courses to Selected Users" }) })] }), _jsxs("div", { className: "bg-white rounded-lg border border-gray-200 p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Operation History" }), operations.length === 0 ? (_jsx("p", { className: "text-gray-500 text-center py-8", children: "No operations yet" })) : (_jsx("div", { className: "space-y-3", children: operations.map(operation => (_jsxs("div", { className: "border border-gray-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [getStatusIcon(operation.status), _jsx("span", { className: "font-medium text-gray-900", children: getOperationName(operation.type) }), _jsx("span", { className: "text-sm text-gray-500", children: operation.startTime.toLocaleTimeString() })] }), _jsxs("span", { className: "text-sm text-gray-600", children: [operation.processed, "/", operation.total] })] }), operation.status === 'processing' && (_jsx("div", { className: "w-full bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "bg-blue-500 h-2 rounded-full transition-all duration-300", style: { width: `${operation.progress}%` } }) })), operation.status === 'completed' && operation.endTime && (_jsxs("p", { className: "text-sm text-green-600", children: ["Completed in ", Math.round((operation.endTime.getTime() - operation.startTime.getTime()) / 1000), "s"] }))] }, operation.id))) }))] })] }));
};
export default BulkOperationsCenter;
