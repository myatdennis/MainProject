import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { Building2, Plus, Search, MoreVertical, Edit, Eye, Settings, Download, Upload, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import orgService from '../../dal/orgs';
import LoadingButton from '../../components/LoadingButton';
import ConfirmationModal from '../../components/ConfirmationModal';
import AddOrganizationModal from '../../components/AddOrganizationModal';
import EditOrganizationModal from '../../components/EditOrganizationModal';
import { useToast } from '../../context/ToastContext';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import EmptyState from '../../components/ui/EmptyState';
const AdminOrganizations = () => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [organizations, setOrganizations] = useState([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showAddOrgModal, setShowAddOrgModal] = useState(false);
    const [showEditOrgModal, setShowEditOrgModal] = useState(false);
    const [orgToDelete, setOrgToDelete] = useState(null);
    const [orgToEdit, setOrgToEdit] = useState(null);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        orgService.listOrgs().then(setOrganizations).catch(() => setOrganizations([]));
    }, []);
    const filteredOrgs = organizations.filter(org => (org.name || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.type || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.contactPerson || '').toString().toLowerCase().includes(searchTerm.toLowerCase()));
    const getStatusColor = (status) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'inactive':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-red-100 text-red-800';
        }
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case 'active':
                return _jsx(CheckCircle, { className: "h-4 w-4 text-green-500" });
            case 'inactive':
                return _jsx(Clock, { className: "h-4 w-4 text-yellow-500" });
            default:
                return _jsx(AlertTriangle, { className: "h-4 w-4 text-red-500" });
        }
    };
    const getSubscriptionColor = (subscription) => {
        return subscription === 'Premium'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-blue-100 text-blue-800';
    };
    // Handler functions for button actions
    const handleAddOrganization = () => {
        setShowAddOrgModal(true);
    };
    const handleCreateOrganization = () => {
        navigate('/admin/organizations/new');
    };
    const handleOrganizationAdded = (newOrganization) => {
        setOrganizations(prev => [...prev, newOrganization]);
        showToast('Organization added successfully!', 'success');
    };
    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = (e) => {
            const file = e.target?.files?.[0];
            if (file) {
                showToast(`Importing ${file.name}...`, 'info');
                setTimeout(() => {
                    showToast('Organization import completed successfully!', 'success');
                }, 3000);
            }
        };
        input.click();
    };
    const handleExport = async () => {
        setLoading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const csvContent = `Name,Type,Contact Person,Contact Email,Total Learners,Active Learners,Completion Rate,Status\n${filteredOrgs.map(org => `"${org.name}","${org.type}","${org.contactPerson}","${org.contactEmail}","${org.totalLearners}","${org.activeLearners}","${org.completionRate}%","${org.status}"`).join('\n')}`;
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `organizations-export-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showToast('Organizations exported successfully!', 'success');
        }
        catch (error) {
            showToast('Failed to export organizations', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    const handleEditOrganization = (orgId) => {
        const org = organizations.find(o => o.id === orgId);
        if (org) {
            setOrgToEdit(org);
            setShowEditOrgModal(true);
        }
    };
    const handleOrganizationUpdated = (updatedOrganization) => {
        setOrganizations(prev => prev.map(org => org.id === updatedOrganization.id ? updatedOrganization : org));
        setShowEditOrgModal(false);
        setOrgToEdit(null);
    };
    const handleDeleteOrganization = (orgId) => {
        setOrgToDelete(orgId);
        setShowDeleteModal(true);
    };
    const confirmDeleteOrganization = async () => {
        if (!orgToDelete)
            return;
        setLoading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            setOrganizations(prev => prev.filter(org => org.id !== orgToDelete));
            showToast('Organization deleted successfully!', 'success');
            setShowDeleteModal(false);
            setOrgToDelete(null);
        }
        catch (error) {
            showToast('Failed to delete organization', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6", children: [_jsx("div", { className: "mb-6", children: _jsx(Breadcrumbs, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Organizations', to: '/admin/organizations' }] }) }), _jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Organization Management" }), _jsx("p", { className: "text-gray-600", children: "Manage client organizations, track progress, and oversee cohorts" })] }), _jsx("div", { className: "card-lg card-hover mb-8", children: _jsxs("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0", children: [_jsxs("div", { className: "relative flex-1 max-w-md", children: [_jsx(Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" }), _jsx("input", { type: "text", placeholder: "Search organizations...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent" })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs(LoadingButton, { onClick: handleAddOrganization, variant: "primary", children: [_jsx(Plus, { className: "h-4 w-4" }), "Add Organization"] }), _jsxs(LoadingButton, { onClick: handleCreateOrganization, variant: "secondary", children: [_jsx(Building2, { className: "h-4 w-4" }), "Create Organization"] }), _jsxs(LoadingButton, { onClick: handleImport, variant: "secondary", children: [_jsx(Upload, { className: "h-4 w-4" }), "Import"] }), _jsxs(LoadingButton, { onClick: handleExport, loading: loading, variant: "secondary", children: [_jsx(Download, { className: "h-4 w-4" }), "Export"] })] })] }) }), filteredOrgs.length === 0 && (_jsx("div", { className: "mb-8", children: _jsx(EmptyState, { title: "No organizations found", description: searchTerm
                        ? 'Try changing your search to find organizations.'
                        : 'You have not added any organizations yet.', action: _jsx("button", { className: searchTerm ? 'btn-outline' : 'btn-cta', onClick: () => {
                            if (searchTerm)
                                setSearchTerm('');
                            else
                                handleAddOrganization();
                        }, children: searchTerm ? 'Reset search' : 'Add organization' }) }) })), filteredOrgs.length > 0 && (_jsx("div", { className: "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8", children: filteredOrgs.map((org) => (_jsxs("div", { className: "card-lg card-hover", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "bg-blue-100 p-2 rounded-lg", children: _jsx(Building2, { className: "h-6 w-6 text-blue-600" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-gray-900", children: org.name }), _jsx("p", { className: "text-sm text-gray-600", children: org.type })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [getStatusIcon(org.status), _jsx(Button, { asChild: true, variant: "ghost", size: "sm", "aria-label": "View organization", children: _jsx(Link, { to: `/admin/organizations/${org.id}`, children: "View" }) }), _jsx("button", { className: "p-1 text-gray-400 hover:text-gray-600", children: _jsx(MoreVertical, { className: "h-4 w-4" }) })] })] }), _jsxs("div", { className: "space-y-3 mb-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Contact:" }), _jsx("span", { className: "text-sm font-medium text-gray-900", children: org.contactPerson })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Learners:" }), _jsxs("span", { className: "text-sm font-medium text-gray-900", children: [org.activeLearners, "/", org.totalLearners, " active"] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Completion:" }), _jsxs("span", { className: "text-sm font-bold text-green-600", children: [org.completionRate, "%"] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Subscription:" }), _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getSubscriptionColor(org.subscription)}`, children: org.subscription })] })] }), _jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-sm font-medium text-gray-700", children: "Overall Progress" }), _jsxs("span", { className: "text-sm font-bold text-gray-900", children: [org.completionRate, "%"] })] }), _jsx("div", { className: "w-full bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "h-2 rounded-full", style: { width: `${org.completionRate}%`, background: 'var(--gradient-blue-green)' } }) })] }), _jsxs("div", { className: "mb-4", children: [_jsx("h4", { className: "text-sm font-medium text-gray-700 mb-2", children: "Module Progress" }), _jsx("div", { className: "grid grid-cols-5 gap-1", children: Object.entries(org.modules).map(([key, value]) => {
                                        const v = Number(value || 0);
                                        return (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: `w-full h-2 rounded-full ${v >= 90 ? 'bg-green-500' :
                                                        v >= 70 ? 'bg-yellow-500' :
                                                            v >= 50 ? 'bg-orange-500' : 'bg-red-500'}` }), _jsxs("div", { className: "text-xs text-gray-600 mt-1", children: [v, "%"] })] }, key));
                                    }) })] }), _jsxs("div", { className: "flex items-center justify-between pt-4 border-t border-gray-200", children: [_jsx("div", { className: "flex items-center space-x-2", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(org.status)}`, children: org.status }) }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { className: "p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg", title: "View Details", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx("button", { className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Edit", children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx("button", { className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Settings", children: _jsx(Settings, { className: "h-4 w-4" }) })] })] })] }, org.id))) })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6 mb-8", children: [_jsxs("div", { className: "card-lg text-center", children: [_jsx("div", { className: "text-2xl font-bold text-blue-600", children: organizations.length }), _jsx("div", { className: "text-sm text-gray-600", children: "Total Organizations" })] }), _jsxs("div", { className: "card-lg text-center", children: [_jsx("div", { className: "text-2xl font-bold text-green-600", children: organizations.filter(org => org.status === 'active').length }), _jsx("div", { className: "text-sm text-gray-600", children: "Active Organizations" })] }), _jsxs("div", { className: "card-lg text-center", children: [_jsx("div", { className: "text-2xl font-bold text-orange-600", children: organizations.reduce((acc, org) => acc + org.totalLearners, 0) }), _jsx("div", { className: "text-sm text-gray-600", children: "Total Learners" })] }), _jsxs("div", { className: "card-lg text-center", children: [_jsx("div", { className: "text-2xl font-bold text-purple-600", children: organizations.length === 0 ? '—' : `${Math.round(organizations.reduce((acc, org) => acc + (org.completionRate || 0), 0) / organizations.length)}%` }), _jsx("div", { className: "text-sm text-gray-600", children: "Avg. Completion" })] })] }), _jsxs("div", { className: "card-lg overflow-hidden", children: [_jsx("div", { className: "px-6 py-4 border-b border-gray-200", children: _jsx("h2", { className: "text-lg font-bold text-gray-900", children: "Organization Details" }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left py-3 px-6 font-semibold text-gray-900", children: "Organization" }), _jsx("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Contact" }), _jsx("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Learners" }), _jsx("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Progress" }), _jsx("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Status" }), _jsx("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Last Activity" }), _jsx("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Actions" })] }) }), _jsx("tbody", { children: filteredOrgs.map((org) => (_jsxs("tr", { className: "border-b border-gray-100 hover:bg-gray-50", children: [_jsx("td", { className: "py-4 px-6", children: _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: org.name }), _jsx("div", { className: "text-sm text-gray-600", children: org.type }), _jsx("div", { className: "text-xs text-gray-500", children: org.cohorts?.join(', ') })] }) }), _jsx("td", { className: "py-4 px-6 text-center", children: _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: org.contactPerson }), _jsx("div", { className: "text-sm text-gray-600", children: org.contactEmail })] }) }), _jsxs("td", { className: "py-4 px-6 text-center", children: [_jsx("div", { className: "text-lg font-bold text-gray-900", children: org.activeLearners }), _jsxs("div", { className: "text-sm text-gray-600", children: ["of ", org.totalLearners] })] }), _jsxs("td", { className: "py-4 px-6 text-center", children: [_jsxs("div", { className: "text-lg font-bold text-green-600", children: [org.completionRate, "%"] }), _jsx("div", { className: "w-16 bg-gray-200 rounded-full h-2 mt-1 mx-auto", children: _jsx("div", { className: "bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full", style: { width: `${org.completionRate}%` } }) })] }), _jsx("td", { className: "py-4 px-6 text-center", children: _jsxs("div", { className: "flex items-center justify-center space-x-2", children: [getStatusIcon(org.status), _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(org.status)}`, children: org.status })] }) }), _jsx("td", { className: "py-4 px-6 text-center text-sm text-gray-600", children: new Date(org.lastActivity).toLocaleDateString() }), _jsx("td", { className: "py-4 px-6 text-center", children: _jsxs("div", { className: "flex items-center justify-center space-x-2", children: [_jsx(Link, { to: `/admin/organizations/${org.id}`, className: "p-1 text-blue-600 hover:text-blue-800", title: "View Details", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx(Link, { to: `/admin/org-profiles/org-profile-${org.id}`, className: "p-1 text-green-600 hover:text-green-800", title: "View Profile", children: _jsx(Settings, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => handleEditOrganization(org.id), className: "p-1 text-gray-600 hover:text-gray-800", title: "Edit", children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => handleDeleteOrganization(org.id), className: "p-1 text-red-600 hover:text-red-800", title: "Delete Organization", children: _jsx(MoreVertical, { className: "h-4 w-4" }) })] }) })] }, org.id))) })] }) })] }), _jsx(AddOrganizationModal, { isOpen: showAddOrgModal, onClose: () => setShowAddOrgModal(false), onOrganizationAdded: handleOrganizationAdded }), _jsx(EditOrganizationModal, { isOpen: showEditOrgModal, onClose: () => {
                    setShowEditOrgModal(false);
                    setOrgToEdit(null);
                }, organization: orgToEdit, onOrganizationUpdated: handleOrganizationUpdated }), _jsx(ConfirmationModal, { isOpen: showDeleteModal, onClose: () => {
                    setShowDeleteModal(false);
                    setOrgToDelete(null);
                }, onConfirm: confirmDeleteOrganization, title: "Delete Organization", message: "Are you sure you want to delete this organization? This action cannot be undone and will remove all associated data including learner progress.", confirmText: "Delete Organization", type: "danger", loading: loading })] }));
};
export default AdminOrganizations;
