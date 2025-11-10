import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { X, Building2, User } from 'lucide-react';
import LoadingButton from './LoadingButton';
import { useToast } from '../context/ToastContext';
const AddOrganizationModal = ({ isOpen, onClose, onOrganizationAdded }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        type: '',
        contactPerson: '',
        contactEmail: '',
        contactPhone: '',
        website: '',
        address: '',
        subscription: 'Standard',
        maxLearners: 100
    });
    const [errors, setErrors] = useState({});
    const organizationTypes = [
        'Educational Institution',
        'Healthcare Organization',
        'Technology Company',
        'Government Agency',
        'Non-Profit Organization',
        'Financial Services',
        'Manufacturing',
        'Consulting Firm',
        'Other'
    ];
    const subscriptionTypes = [
        'Standard',
        'Premium',
        'Enterprise'
    ];
    if (!isOpen)
        return null;
    const validateForm = () => {
        const newErrors = {};
        if (!formData.name.trim()) {
            newErrors.name = 'Organization name is required';
        }
        if (!formData.type) {
            newErrors.type = 'Organization type is required';
        }
        if (!formData.contactEmail.trim()) {
            newErrors.contactEmail = 'Email is required';
        }
        else if (!/\S+@\S+\.\S+/.test(formData.contactEmail)) {
            newErrors.contactEmail = 'Email is invalid';
        }
        if (formData.maxLearners && formData.maxLearners < 1) {
            newErrors.maxLearners = 'Max learners must be at least 1';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            return;
        }
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            const newOrganization = {
                id: Date.now().toString(),
                name: formData.name,
                type: formData.type,
                contactPerson: formData.contactPerson,
                contactEmail: formData.contactEmail,
                contactPhone: formData.contactPhone,
                website: formData.website,
                address: formData.address,
                subscription: formData.subscription,
                maxLearners: formData.maxLearners || 100,
                activeLearners: 0,
                totalLearners: 0,
                completionRate: 0,
                status: 'active',
                lastActivity: new Date().toISOString(),
                cohorts: [],
                modules: {
                    foundations: 0,
                    bias: 0,
                    empathy: 0,
                    conversations: 0,
                    planning: 0
                }
            };
            onOrganizationAdded?.(newOrganization);
            showToast('Organization added successfully!', 'success');
            // Reset form
            setFormData({
                name: '',
                type: '',
                contactPerson: '',
                contactEmail: '',
                contactPhone: '',
                website: '',
                address: '',
                subscription: 'Standard',
                maxLearners: 100
            });
            onClose();
        }
        catch (error) {
            showToast('Failed to add organization. Please try again.', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error when user starts typing
        if (errors[field]) {
            const newErrors = { ...errors };
            delete newErrors[field];
            setErrors(newErrors);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b border-gray-200", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "bg-orange-100 p-2 rounded-lg", children: _jsx(Building2, { className: "h-6 w-6 text-orange-600" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-gray-900", children: "Add New Organization" }), _jsx("p", { className: "text-sm text-gray-600", children: "Create a new client organization" })] })] }), _jsx("button", { onClick: onClose, className: "p-2 text-gray-400 hover:text-gray-600 rounded-lg", disabled: loading, children: _jsx(X, { className: "h-5 w-5" }) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "p-6 space-y-6", children: [_jsxs("div", { children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2", children: [_jsx(Building2, { className: "h-5 w-5 text-gray-600" }), _jsx("span", { children: "Organization Information" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Organization Name *" }), _jsx("input", { type: "text", value: formData.name, onChange: (e) => handleInputChange('name', e.target.value), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.name ? 'border-red-300' : 'border-gray-300'}`, disabled: loading }), errors.name && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.name }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Organization Type *" }), _jsxs("select", { value: formData.type, onChange: (e) => handleInputChange('type', e.target.value), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.type ? 'border-red-300' : 'border-gray-300'}`, disabled: loading, children: [_jsx("option", { value: "", children: "Select Type" }), organizationTypes.map(type => (_jsx("option", { value: type, children: type }, type)))] }), errors.type && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.type }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Subscription Plan" }), _jsx("select", { value: formData.subscription, onChange: (e) => handleInputChange('subscription', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", disabled: loading, children: subscriptionTypes.map(plan => (_jsx("option", { value: plan, children: plan }, plan))) })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mt-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Website" }), _jsx("input", { type: "url", value: formData.website, onChange: (e) => handleInputChange('website', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", disabled: loading })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Max Learners" }), _jsx("input", { type: "number", min: "1", value: formData.maxLearners, onChange: (e) => handleInputChange('maxLearners', parseInt(e.target.value) || 0), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", disabled: loading })] })] }), _jsxs("div", { className: "mt-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Address" }), _jsx("textarea", { rows: 3, value: formData.address, onChange: (e) => handleInputChange('address', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", disabled: loading })] })] }), _jsxs("div", { children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2", children: [_jsx(User, { className: "h-5 w-5 text-gray-600" }), _jsx("span", { children: "Contact Information" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Contact Person *" }), _jsx("input", { type: "text", value: formData.contactPerson, onChange: (e) => handleInputChange('contactPerson', e.target.value), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.contactPerson ? 'border-red-300' : 'border-gray-300'}`, disabled: loading }), errors.contactPerson && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.contactPerson }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Contact Email *" }), _jsx("input", { type: "email", value: formData.contactEmail, onChange: (e) => handleInputChange('contactEmail', e.target.value), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${errors.contactEmail ? 'border-red-300' : 'border-gray-300'}`, disabled: loading }), errors.contactEmail && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.contactEmail }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Contact Phone" }), _jsx("input", { type: "tel", value: formData.contactPhone, onChange: (e) => handleInputChange('contactPhone', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", disabled: loading })] })] })] }), _jsxs("div", { className: "flex items-center justify-end space-x-4 pt-6 border-t border-gray-200", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200", disabled: loading, children: "Cancel" }), _jsxs(LoadingButton, { type: "submit", loading: loading, variant: "primary", children: [_jsx(Building2, { className: "h-4 w-4" }), "Add Organization"] })] })] })] }) }));
};
export default AddOrganizationModal;
