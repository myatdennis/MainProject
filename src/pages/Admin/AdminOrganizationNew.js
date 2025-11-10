import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, Users, Save, ArrowLeft } from 'lucide-react';
import LoadingButton from '../../components/LoadingButton';
import { useToast } from '../../context/ToastContext';
const AdminOrganizationCreate = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        type: '',
        industry: '',
        size: '',
        contactPerson: '',
        contactEmail: '',
        contactPhone: '',
        website: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        description: '',
        subscription: 'Standard'
    });
    const organizationTypes = [
        'Educational Institution',
        'Healthcare Organization',
        'Non-Profit',
        'Government Agency',
        'Corporate/Business',
        'Community Organization'
    ];
    const industries = [
        'Education',
        'Healthcare',
        'Technology',
        'Finance',
        'Manufacturing',
        'Retail',
        'Non-Profit',
        'Government',
        'Other'
    ];
    const organizationSizes = [
        '1-10 employees',
        '11-50 employees',
        '51-200 employees',
        '201-1000 employees',
        '1000+ employees'
    ];
    const subscriptionTiers = [
        'Standard',
        'Premium',
        'Enterprise'
    ];
    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        // Basic validation
        if (!formData.name.trim() || !formData.contactPerson.trim() || !formData.contactEmail.trim()) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            const newOrganization = {
                id: Date.now().toString(),
                ...formData,
                status: 'active',
                totalLearners: 0,
                activeLearners: 0,
                completionRate: 0,
                createdAt: new Date().toISOString()
            };
            console.log('Created organization:', newOrganization);
            showToast('Organization created successfully!', 'success');
            // Navigate back to organizations list
            navigate('/admin/organizations');
        }
        catch (error) {
            showToast('Failed to create organization. Please try again.', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "p-6 max-w-4xl mx-auto", children: [_jsx("div", { className: "mb-8", children: _jsxs("div", { className: "flex items-center space-x-4 mb-4", children: [_jsx("button", { onClick: () => navigate('/admin/organizations'), className: "p-2 text-gray-500 hover:text-gray-700 rounded-lg transition-colors", title: "Back to Organizations", children: _jsx(ArrowLeft, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900", children: "Create Organization" }), _jsx("p", { className: "text-gray-600", children: "Add a new client organization to the system" })] })] }) }), _jsx("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200", children: _jsxs("form", { onSubmit: handleSubmit, className: "p-6 space-y-8", children: [_jsxs("div", { children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2", children: [_jsx(Building2, { className: "h-5 w-5 text-gray-600" }), _jsx("span", { children: "Basic Information" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Organization Name *" }), _jsx("input", { type: "text", value: formData.name, onChange: (e) => handleInputChange('name', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Enter organization name", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Organization Type" }), _jsxs("select", { value: formData.type, onChange: (e) => handleInputChange('type', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "", children: "Select Type" }), organizationTypes.map(type => (_jsx("option", { value: type, children: type }, type)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Industry" }), _jsxs("select", { value: formData.industry, onChange: (e) => handleInputChange('industry', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "", children: "Select Industry" }), industries.map(industry => (_jsx("option", { value: industry, children: industry }, industry)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Organization Size" }), _jsxs("select", { value: formData.size, onChange: (e) => handleInputChange('size', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "", children: "Select Size" }), organizationSizes.map(size => (_jsx("option", { value: size, children: size }, size)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Subscription Tier" }), _jsx("select", { value: formData.subscription, onChange: (e) => handleInputChange('subscription', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: subscriptionTiers.map(tier => (_jsx("option", { value: tier, children: tier }, tier))) })] })] })] }), _jsxs("div", { children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2", children: [_jsx(Users, { className: "h-5 w-5 text-gray-600" }), _jsx("span", { children: "Contact Information" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Contact Person *" }), _jsx("input", { type: "text", value: formData.contactPerson, onChange: (e) => handleInputChange('contactPerson', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Primary contact name", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Contact Email *" }), _jsx("input", { type: "email", value: formData.contactEmail, onChange: (e) => handleInputChange('contactEmail', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "contact@organization.com", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Contact Phone" }), _jsx("input", { type: "tel", value: formData.contactPhone, onChange: (e) => handleInputChange('contactPhone', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "(555) 123-4567" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Website" }), _jsx("input", { type: "url", value: formData.website, onChange: (e) => handleInputChange('website', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "https://www.organization.com" })] })] })] }), _jsxs("div", { children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2", children: [_jsx(MapPin, { className: "h-5 w-5 text-gray-600" }), _jsx("span", { children: "Address Information" })] }), _jsxs("div", { className: "grid grid-cols-1 gap-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Street Address" }), _jsx("input", { type: "text", value: formData.address, onChange: (e) => handleInputChange('address', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "123 Main Street" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "City" }), _jsx("input", { type: "text", value: formData.city, onChange: (e) => handleInputChange('city', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "City" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "State" }), _jsx("input", { type: "text", value: formData.state, onChange: (e) => handleInputChange('state', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "State" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "ZIP Code" }), _jsx("input", { type: "text", value: formData.zipCode, onChange: (e) => handleInputChange('zipCode', e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "12345" })] })] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }), _jsx("textarea", { value: formData.description, onChange: (e) => handleInputChange('description', e.target.value), rows: 4, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Brief description of the organization and its goals..." })] }), _jsxs("div", { className: "flex items-center justify-end space-x-4 pt-6 border-t border-gray-200", children: [_jsx("button", { type: "button", onClick: () => navigate('/admin/organizations'), className: "px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200", disabled: loading, children: "Cancel" }), _jsxs(LoadingButton, { type: "submit", loading: loading, variant: "primary", children: [_jsx(Save, { className: "h-4 w-4" }), loading ? 'Creating...' : 'Create Organization'] })] })] }) })] }));
};
export default AdminOrganizationCreate;
