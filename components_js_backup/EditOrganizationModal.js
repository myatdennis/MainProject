import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { X, Building2, User, Mail, Phone, Globe, MapPin, Users, Calendar, DollarSign, Settings, Shield, CreditCard, Activity, Save, AlertTriangle } from 'lucide-react';
import LoadingButton from './LoadingButton';
import { useToast } from '../context/ToastContext';
const EditOrganizationModal = ({ isOpen, onClose, organization, onOrganizationUpdated }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');
    const [formData, setFormData] = useState({
        name: '',
        type: '',
        description: '',
        logo: '',
        contactPerson: '',
        contactEmail: '',
        contactPhone: '',
        website: '',
        address: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
        subscription: 'Standard',
        billingEmail: '',
        billingCycle: 'monthly',
        customPricing: 0,
        maxLearners: 100,
        maxCourses: 50,
        maxStorage: 10,
        features: {
            analytics: true,
            certificates: true,
            apiAccess: false,
            customBranding: false,
            sso: false,
            mobileApp: true,
            reporting: true,
            integrations: false,
        },
        settings: {
            autoEnrollment: false,
            emailNotifications: true,
            progressTracking: true,
            allowDownloads: true,
            requireCompletion: false,
            dataRetention: 24,
        },
        status: 'active',
        contractStart: '',
        contractEnd: '',
        notes: '',
        tags: [],
    });
    const [errors, setErrors] = useState({});
    // Load organization data when modal opens
    useEffect(() => {
        if (isOpen && organization) {
            setFormData({
                name: organization.name || '',
                type: organization.type || '',
                description: organization.description || '',
                logo: organization.logo || '',
                contactPerson: organization.contactPerson || '',
                contactEmail: organization.contactEmail || '',
                contactPhone: organization.contactPhone || '',
                website: organization.website || '',
                address: organization.address || '',
                city: organization.city || '',
                state: organization.state || '',
                country: organization.country || 'United States',
                postalCode: organization.postalCode || '',
                subscription: organization.subscription || 'Standard',
                billingEmail: organization.billingEmail || organization.contactEmail || '',
                billingCycle: organization.billingCycle || 'monthly',
                customPricing: organization.customPricing || 0,
                maxLearners: organization.maxLearners || 100,
                maxCourses: organization.maxCourses || 50,
                maxStorage: organization.maxStorage || 10,
                features: {
                    analytics: organization.features?.analytics ?? true,
                    certificates: organization.features?.certificates ?? true,
                    apiAccess: organization.features?.apiAccess ?? false,
                    customBranding: organization.features?.customBranding ?? false,
                    sso: organization.features?.sso ?? false,
                    mobileApp: organization.features?.mobileApp ?? true,
                    reporting: organization.features?.reporting ?? true,
                    integrations: organization.features?.integrations ?? false,
                },
                settings: {
                    autoEnrollment: organization.settings?.autoEnrollment ?? false,
                    emailNotifications: organization.settings?.emailNotifications ?? true,
                    progressTracking: organization.settings?.progressTracking ?? true,
                    allowDownloads: organization.settings?.allowDownloads ?? true,
                    requireCompletion: organization.settings?.requireCompletion ?? false,
                    dataRetention: organization.settings?.dataRetention ?? 24,
                },
                status: organization.status || 'active',
                contractStart: organization.contractStart || '',
                contractEnd: organization.contractEnd || '',
                notes: organization.notes || '',
                tags: organization.tags || [],
            });
        }
    }, [isOpen, organization]);
    if (!isOpen)
        return null;
    const organizationTypes = [
        'Educational Institution',
        'Healthcare Organization',
        'Technology Company',
        'Government Agency',
        'Non-Profit Organization',
        'Financial Services',
        'Manufacturing',
        'Consulting Firm',
        'Retail & E-commerce',
        'Media & Entertainment',
        'Transportation',
        'Real Estate',
        'Other'
    ];
    const subscriptionTypes = [
        { value: 'Trial', label: 'Trial (14 days)', price: 0 },
        { value: 'Standard', label: 'Standard', price: 299 },
        { value: 'Premium', label: 'Premium', price: 599 },
        { value: 'Enterprise', label: 'Enterprise', price: 1299 },
        { value: 'Custom', label: 'Custom Pricing', price: 0 }
    ];
    const statusOptions = [
        { value: 'active', label: 'Active', color: 'text-green-700 bg-green-100' },
        { value: 'trial', label: 'Trial', color: 'text-blue-700 bg-blue-100' },
        { value: 'inactive', label: 'Inactive', color: 'text-yellow-700 bg-yellow-100' },
        { value: 'suspended', label: 'Suspended', color: 'text-red-700 bg-red-100' },
    ];
    const validateForm = () => {
        const newErrors = {};
        if (!formData.name.trim()) {
            newErrors.name = 'Organization name is required';
        }
        if (!formData.type) {
            newErrors.type = 'Organization type is required';
        }
        if (!formData.contactEmail.trim()) {
            newErrors.contactEmail = 'Contact email is required';
        }
        else if (!/\S+@\S+\.\S+/.test(formData.contactEmail)) {
            newErrors.contactEmail = 'Contact email is invalid';
        }
        if (formData.billingEmail && !/\S+@\S+\.\S+/.test(formData.billingEmail)) {
            newErrors.billingEmail = 'Billing email is invalid';
        }
        if (formData.maxLearners && formData.maxLearners < 1) {
            newErrors.maxLearners = 'Max learners must be at least 1';
        }
        if (formData.contractStart && formData.contractEnd) {
            if (new Date(formData.contractStart) >= new Date(formData.contractEnd)) {
                newErrors.contractEnd = 'Contract end date must be after start date';
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            showToast('Please fix the errors before saving', 'error');
            return;
        }
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            const updatedOrganization = {
                ...organization,
                ...formData,
                id: organization?.id || Date.now().toString(),
                updatedAt: new Date().toISOString(),
                totalLearners: organization?.totalLearners || 0,
                activeLearners: organization?.activeLearners || 0,
                completionRate: organization?.completionRate || 0,
            };
            if (onOrganizationUpdated) {
                onOrganizationUpdated(updatedOrganization);
            }
            showToast('Organization updated successfully!', 'success');
            onClose();
        }
        catch (error) {
            showToast('Failed to update organization', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    const handleInputChange = (field, value) => {
        setFormData(prev => {
            if (field.includes('.')) {
                const [parent, child] = field.split('.');
                return {
                    ...prev,
                    [parent]: {
                        ...prev[parent],
                        [child]: value
                    }
                };
            }
            return { ...prev, [field]: value };
        });
        // Clear error for this field
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };
    const tabs = [
        { id: 'basic', label: 'Basic Info', icon: Building2 },
        { id: 'contact', label: 'Contact & Address', icon: User },
        { id: 'subscription', label: 'Subscription & Billing', icon: CreditCard },
        { id: 'features', label: 'Features & Access', icon: Shield },
        { id: 'settings', label: 'Settings & Preferences', icon: Settings },
    ];
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b border-gray-200", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "bg-blue-100 p-2 rounded-lg", children: _jsx(Building2, { className: "h-6 w-6 text-blue-600" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold text-gray-900", children: organization ? 'Edit Organization' : 'Add Organization' }), _jsx("p", { className: "text-sm text-gray-600", children: organization ? `Manage ${organization.name || 'organization'} settings` : 'Create a new organization' })] })] }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600 transition-colors", children: _jsx(X, { className: "h-6 w-6" }) })] }), _jsx("div", { className: "border-b border-gray-200", children: _jsx("nav", { className: "flex space-x-8 px-6", children: tabs.map((tab) => (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `py-3 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'}`, children: [_jsx(tab.icon, { className: "h-4 w-4" }), _jsx("span", { children: tab.label })] }, tab.id))) }) }), _jsxs("form", { onSubmit: handleSubmit, className: "flex-1 overflow-y-auto", children: [_jsxs("div", { className: "p-6 space-y-6", children: [activeTab === 'basic' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Organization Name *" }), _jsx("input", { type: "text", value: formData.name, onChange: (e) => handleInputChange('name', e.target.value), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.name ? 'border-red-300' : 'border-gray-300'}`, placeholder: "Enter organization name" }), errors.name && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.name }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Organization Type *" }), _jsxs("select", { value: formData.type, onChange: (e) => handleInputChange('type', e.target.value), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.type ? 'border-red-300' : 'border-gray-300'}`, children: [_jsx("option", { value: "", children: "Select type" }), organizationTypes.map((type) => (_jsx("option", { value: type, children: type }, type)))] }), errors.type && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.type }))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }), _jsx("textarea", { value: formData.description, onChange: (e) => handleInputChange('description', e.target.value), rows: 3, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "Brief description of the organization" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Status" }), _jsx("select", { value: formData.status, onChange: (e) => handleInputChange('status', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", children: statusOptions.map((status) => (_jsx("option", { value: status.value, children: status.label }, status.value))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Logo URL" }), _jsx("input", { type: "url", value: formData.logo, onChange: (e) => handleInputChange('logo', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "https://example.com/logo.png" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Tags" }), _jsx("input", { type: "text", value: formData.tags.join(', '), onChange: (e) => handleInputChange('tags', e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "VIP, Enterprise, Priority (comma-separated)" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Internal Notes" }), _jsx("textarea", { value: formData.notes, onChange: (e) => handleInputChange('notes', e.target.value), rows: 3, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "Internal notes for this organization" })] })] })), activeTab === 'contact' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: [_jsx(User, { className: "inline h-4 w-4 mr-1" }), "Primary Contact *"] }), _jsx("input", { type: "text", value: formData.contactPerson, onChange: (e) => handleInputChange('contactPerson', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "Full name" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: [_jsx(Mail, { className: "inline h-4 w-4 mr-1" }), "Contact Email *"] }), _jsx("input", { type: "email", value: formData.contactEmail, onChange: (e) => handleInputChange('contactEmail', e.target.value), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.contactEmail ? 'border-red-300' : 'border-gray-300'}`, placeholder: "contact@example.com" }), errors.contactEmail && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.contactEmail }))] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: [_jsx(Phone, { className: "inline h-4 w-4 mr-1" }), "Phone Number"] }), _jsx("input", { type: "tel", value: formData.contactPhone, onChange: (e) => handleInputChange('contactPhone', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "+1 (555) 123-4567" })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: [_jsx(Globe, { className: "inline h-4 w-4 mr-1" }), "Website"] }), _jsx("input", { type: "url", value: formData.website, onChange: (e) => handleInputChange('website', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "https://example.com" })] })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: [_jsx(MapPin, { className: "inline h-4 w-4 mr-1" }), "Address"] }), _jsx("input", { type: "text", value: formData.address, onChange: (e) => handleInputChange('address', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "Street address" })] }), _jsxs("div", { className: "grid grid-cols-4 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "City" }), _jsx("input", { type: "text", value: formData.city, onChange: (e) => handleInputChange('city', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "City" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "State/Province" }), _jsx("input", { type: "text", value: formData.state, onChange: (e) => handleInputChange('state', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "State" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Postal Code" }), _jsx("input", { type: "text", value: formData.postalCode, onChange: (e) => handleInputChange('postalCode', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "12345" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Country" }), _jsxs("select", { value: formData.country, onChange: (e) => handleInputChange('country', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", children: [_jsx("option", { value: "United States", children: "United States" }), _jsx("option", { value: "Canada", children: "Canada" }), _jsx("option", { value: "United Kingdom", children: "United Kingdom" }), _jsx("option", { value: "Australia", children: "Australia" }), _jsx("option", { value: "Germany", children: "Germany" }), _jsx("option", { value: "France", children: "France" }), _jsx("option", { value: "Other", children: "Other" })] })] })] })] })), activeTab === 'subscription' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: [_jsx(CreditCard, { className: "inline h-4 w-4 mr-1" }), "Subscription Plan"] }), _jsx("select", { value: formData.subscription, onChange: (e) => handleInputChange('subscription', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", children: subscriptionTypes.map((plan) => (_jsxs("option", { value: plan.value, children: [plan.label, " ", plan.price > 0 && `- $${plan.price}/month`] }, plan.value))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Billing Cycle" }), _jsxs("select", { value: formData.billingCycle, onChange: (e) => handleInputChange('billingCycle', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", children: [_jsx("option", { value: "monthly", children: "Monthly" }), _jsx("option", { value: "quarterly", children: "Quarterly" }), _jsx("option", { value: "annually", children: "Annually" })] })] })] }), formData.subscription === 'Custom' && (_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: [_jsx(DollarSign, { className: "inline h-4 w-4 mr-1" }), "Custom Monthly Price"] }), _jsx("input", { type: "number", value: formData.customPricing, onChange: (e) => handleInputChange('customPricing', parseInt(e.target.value)), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", placeholder: "0", min: "0" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Billing Email" }), _jsx("input", { type: "email", value: formData.billingEmail, onChange: (e) => handleInputChange('billingEmail', e.target.value), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.billingEmail ? 'border-red-300' : 'border-gray-300'}`, placeholder: "billing@example.com" }), errors.billingEmail && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.billingEmail }))] }), _jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: [_jsx(Users, { className: "inline h-4 w-4 mr-1" }), "Max Learners"] }), _jsx("input", { type: "number", value: formData.maxLearners, onChange: (e) => handleInputChange('maxLearners', parseInt(e.target.value)), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.maxLearners ? 'border-red-300' : 'border-gray-300'}`, min: "1" }), errors.maxLearners && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.maxLearners }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Max Courses" }), _jsx("input", { type: "number", value: formData.maxCourses, onChange: (e) => handleInputChange('maxCourses', parseInt(e.target.value)), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", min: "1" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Storage (GB)" }), _jsx("input", { type: "number", value: formData.maxStorage, onChange: (e) => handleInputChange('maxStorage', parseInt(e.target.value)), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", min: "1" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: [_jsx(Calendar, { className: "inline h-4 w-4 mr-1" }), "Contract Start Date"] }), _jsx("input", { type: "date", value: formData.contractStart, onChange: (e) => handleInputChange('contractStart', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Contract End Date" }), _jsx("input", { type: "date", value: formData.contractEnd, onChange: (e) => handleInputChange('contractEnd', e.target.value), className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.contractEnd ? 'border-red-300' : 'border-gray-300'}` }), errors.contractEnd && (_jsx("p", { className: "mt-1 text-sm text-red-600", children: errors.contractEnd }))] })] })] })), activeTab === 'features' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-4", children: "Available Features" }), _jsx("div", { className: "grid grid-cols-2 gap-4", children: Object.entries(formData.features).map(([key, value]) => (_jsxs("label", { className: "flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50", children: [_jsx("input", { type: "checkbox", checked: value, onChange: (e) => handleInputChange(`features.${key}`, e.target.checked), className: "rounded border-gray-300 text-blue-600 focus:ring-blue-500" }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900 capitalize", children: key.replace(/([A-Z])/g, ' $1').trim() }), _jsxs("div", { className: "text-sm text-gray-600", children: [key === 'analytics' && 'Advanced analytics and reporting', key === 'certificates' && 'Digital certificates and badges', key === 'apiAccess' && 'REST API access for integrations', key === 'customBranding' && 'Custom branding and white-label', key === 'sso' && 'Single Sign-On (SSO) integration', key === 'mobileApp' && 'Mobile app access', key === 'reporting' && 'Advanced reporting tools', key === 'integrations' && 'Third-party integrations'] })] })] }, key))) })] }), !formData.features.analytics && (_jsx("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4", children: _jsxs("div", { className: "flex", children: [_jsx(AlertTriangle, { className: "h-5 w-5 text-yellow-400" }), _jsxs("div", { className: "ml-3", children: [_jsx("h4", { className: "text-sm font-medium text-yellow-800", children: "Limited Analytics" }), _jsx("p", { className: "text-sm text-yellow-700 mt-1", children: "Without analytics enabled, this organization will have limited reporting capabilities." })] })] }) }))] })), activeTab === 'settings' && (_jsx("div", { className: "space-y-6", children: _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-4", children: "Organization Settings" }), _jsx("div", { className: "space-y-4", children: Object.entries(formData.settings).map(([key, value]) => {
                                                    if (key === 'dataRetention') {
                                                        return (_jsxs("div", { className: "flex items-center justify-between p-3 border rounded-lg", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: "Data Retention Period" }), _jsx("div", { className: "text-sm text-gray-600", children: "How long to keep user data after account deletion" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "number", value: value, onChange: (e) => handleInputChange(`settings.${key}`, parseInt(e.target.value)), className: "w-20 px-2 py-1 border border-gray-300 rounded text-sm", min: "1", max: "120" }), _jsx("span", { className: "text-sm text-gray-600", children: "months" })] })] }, key));
                                                    }
                                                    return (_jsxs("label", { className: "flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900 capitalize", children: key.replace(/([A-Z])/g, ' $1').trim() }), _jsxs("div", { className: "text-sm text-gray-600", children: [key === 'autoEnrollment' && 'Automatically enroll new users in default courses', key === 'emailNotifications' && 'Send email notifications to users', key === 'progressTracking' && 'Track and report user progress', key === 'allowDownloads' && 'Allow users to download course materials', key === 'requireCompletion' && 'Require course completion for certificates'] })] }), _jsx("input", { type: "checkbox", checked: value, onChange: (e) => handleInputChange(`settings.${key}`, e.target.checked), className: "rounded border-gray-300 text-blue-600 focus:ring-blue-500" })] }, key));
                                                }) })] }) }))] }), _jsxs("div", { className: "border-t border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50", children: [_jsxs("div", { className: "flex items-center space-x-2 text-sm text-gray-600", children: [_jsx(Activity, { className: "h-4 w-4" }), _jsxs("span", { children: ["Last updated: ", new Date().toLocaleString()] })] }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors", children: "Cancel" }), _jsxs(LoadingButton, { type: "submit", loading: loading, variant: "primary", children: [_jsx(Save, { className: "h-4 w-4" }), organization ? 'Update Organization' : 'Create Organization'] })] })] })] })] }) }));
};
export default EditOrganizationModal;
