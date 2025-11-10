import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { X, Building2, Users, Check } from 'lucide-react';
const AssignmentModal = ({ isOpen, onClose, organizations, selectedOrganizations, onSave }) => {
    const [tempSelected, setTempSelected] = useState(selectedOrganizations);
    if (!isOpen)
        return null;
    const handleToggleOrganization = (orgId) => {
        setTempSelected(prev => prev.includes(orgId)
            ? prev.filter(id => id !== orgId)
            : [...prev, orgId]);
    };
    const handleSave = () => {
        onSave(tempSelected);
        onClose();
    };
    const totalSelectedLearners = organizations
        .filter(org => tempSelected.includes(org.id))
        .reduce((sum, org) => sum + org.learners, 0);
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", role: "dialog", "aria-modal": "true", "aria-labelledby": "assignment-modal-title", children: _jsxs("div", { className: "bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b border-gray-200", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "bg-blue-100 p-2 rounded-lg", children: _jsx(Building2, { className: "h-6 w-6 text-blue-600" }) }), _jsxs("div", { children: [_jsx("h2", { id: "assignment-modal-title", className: "text-xl font-bold text-gray-900", children: "Assign Survey to Organizations" }), _jsx("p", { className: "text-sm text-gray-600", children: "Select organizations that should receive this survey" })] })] }), _jsx("button", { onClick: onClose, className: "p-2 text-gray-400 hover:text-gray-600 rounded-lg", "aria-label": "Close assignment modal", children: _jsx(X, { className: "h-5 w-5" }) })] }), _jsxs("div", { className: "p-6 overflow-y-auto max-h-[60vh]", children: [_jsxs("div", { className: "mb-4 p-4 bg-blue-50 rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("span", { className: "text-gray-600", children: "Selected Organizations:" }), _jsx("span", { className: "font-medium text-gray-900", children: tempSelected.length })] }), _jsxs("div", { className: "flex items-center justify-between text-sm mt-1", children: [_jsx("span", { className: "text-gray-600", children: "Total Learners:" }), _jsx("span", { className: "font-medium text-blue-600", children: totalSelectedLearners })] })] }), _jsx("div", { className: "space-y-3", children: organizations.map((org) => {
                                const isSelected = tempSelected.includes(org.id);
                                return (_jsx("div", { className: `p-4 rounded-lg border-2 cursor-pointer transition-all ${isSelected
                                        ? 'border-blue-300 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'}`, onClick: () => handleToggleOrganization(org.id), children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: `w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected
                                                            ? 'bg-blue-600 border-blue-600'
                                                            : 'border-gray-300'}`, children: isSelected && _jsx(Check, { className: "h-3 w-3 text-white" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-medium text-gray-900", children: org.name }), _jsx("p", { className: "text-sm text-gray-600", children: org.type })] })] }), _jsx("div", { className: "text-right", children: _jsxs("div", { className: "flex items-center space-x-1 text-sm text-gray-600", children: [_jsx(Users, { className: "h-4 w-4" }), _jsxs("span", { children: [org.learners, " learners"] })] }) })] }) }, org.id));
                            }) })] }), _jsxs("div", { className: "flex items-center justify-between p-6 border-t border-gray-200", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-gray-600 hover:text-gray-800", children: "Cancel" }), _jsxs("button", { onClick: handleSave, className: "px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors", children: ["Save Assignment (", tempSelected.length, " organizations)"] })] })] }) }));
};
export default AssignmentModal;
