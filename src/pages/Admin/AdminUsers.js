import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Plus, Download, Upload, MoreVertical, CheckCircle, Clock, AlertTriangle, Mail, Edit, Trash2, Eye } from 'lucide-react';
import AddUserModal from '../../components/AddUserModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import CourseAssignmentModal from '../../components/CourseAssignmentModal';
import LoadingButton from '../../components/LoadingButton';
import { useToast } from '../../context/ToastContext';
import PageWrapper from '../../components/PageWrapper';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import EmptyState from '../../components/ui/EmptyState';
const AdminUsers = () => {
    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterOrg, setFilterOrg] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showCourseAssignModal, setShowCourseAssignModal] = useState(false);
    const [showEditUserModal, setShowEditUserModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [userToEdit, setUserToEdit] = useState(null);
    const [loading, setLoading] = useState(false);
    const users = [
        {
            id: '1',
            name: 'Sarah Chen',
            email: 'sarah.chen@pacificcoast.edu',
            organization: 'Pacific Coast University',
            cohort: 'Spring 2025 Leadership',
            role: 'VP Student Affairs',
            enrolled: '2025-01-15',
            lastLogin: '2025-03-10',
            progress: {
                foundations: 100,
                bias: 75,
                empathy: 50,
                conversations: 0,
                planning: 0
            },
            overallProgress: 45,
            status: 'active',
            completedModules: 1,
            totalModules: 5,
            feedbackSubmitted: true
        },
        {
            id: '2',
            name: 'Marcus Rodriguez',
            email: 'mrodriguez@mvhs.edu',
            organization: 'Mountain View High School',
            cohort: 'Spring 2025 Leadership',
            role: 'Athletic Director',
            enrolled: '2025-01-20',
            lastLogin: '2025-03-09',
            progress: {
                foundations: 100,
                bias: 100,
                empathy: 80,
                conversations: 25,
                planning: 0
            },
            overallProgress: 61,
            status: 'active',
            completedModules: 2,
            totalModules: 5,
            feedbackSubmitted: true
        },
        {
            id: '3',
            name: 'Jennifer Walsh',
            email: 'jwalsh@communityimpact.org',
            organization: 'Community Impact Network',
            cohort: 'Spring 2025 Leadership',
            role: 'Executive Director',
            enrolled: '2025-01-10',
            lastLogin: '2025-02-28',
            progress: {
                foundations: 100,
                bias: 50,
                empathy: 0,
                conversations: 0,
                planning: 0
            },
            overallProgress: 30,
            status: 'inactive',
            completedModules: 1,
            totalModules: 5,
            feedbackSubmitted: false
        },
        {
            id: '4',
            name: 'David Thompson',
            email: 'dthompson@regionalfire.gov',
            organization: 'Regional Fire Department',
            cohort: 'Winter 2025 Leadership',
            role: 'Training Commander',
            enrolled: '2024-12-01',
            lastLogin: '2025-03-08',
            progress: {
                foundations: 100,
                bias: 100,
                empathy: 100,
                conversations: 75,
                planning: 50
            },
            overallProgress: 85,
            status: 'active',
            completedModules: 3,
            totalModules: 5,
            feedbackSubmitted: true
        },
        {
            id: '5',
            name: 'Lisa Park',
            email: 'lpark@techforward.com',
            organization: 'TechForward Solutions',
            cohort: 'Spring 2025 Leadership',
            role: 'Chief HR Officer',
            enrolled: '2025-02-01',
            lastLogin: '2025-03-11',
            progress: {
                foundations: 100,
                bias: 100,
                empathy: 100,
                conversations: 100,
                planning: 80
            },
            overallProgress: 96,
            status: 'active',
            completedModules: 4,
            totalModules: 5,
            feedbackSubmitted: true
        }
    ];
    const [usersList, setUsersList] = useState(users); // Make users editable
    const organizations = [
        'Pacific Coast University',
        'Mountain View High School',
        'Community Impact Network',
        'Regional Fire Department',
        'TechForward Solutions'
    ];
    const modules = [
        { key: 'foundations', name: 'Foundations of Inclusive Leadership' },
        { key: 'bias', name: 'Recognizing and Mitigating Bias' },
        { key: 'empathy', name: 'Empathy in Action' },
        { key: 'conversations', name: 'Courageous Conversations at Work' },
        { key: 'planning', name: 'Personal & Team Action Planning' }
    ];
    const filteredUsers = usersList.filter((user) => {
        const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.organization.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesOrg = filterOrg === 'all' || user.organization === filterOrg;
        const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
        return matchesSearch && matchesOrg && matchesStatus;
    });
    const handleSelectUser = (userId) => {
        setSelectedUsers((prev) => prev.includes(userId)
            ? prev.filter((id) => id !== userId)
            : [...prev, userId]);
    };
    const handleSelectAll = () => {
        if (selectedUsers.length === filteredUsers.length) {
            setSelectedUsers([]);
        }
        else {
            setSelectedUsers(filteredUsers.map((user) => user.id));
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
    // Handler functions for button actions
    const handleAddUser = () => {
        setShowAddUserModal(true);
    };
    const handleUserAdded = (newUser) => {
        setUsersList((prev) => [...prev, newUser]);
        showToast('User added successfully!', 'success');
    };
    const handleSendReminder = async () => {
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            showToast(`Reminder sent to ${selectedUsers.length} user(s)`, 'success');
            setSelectedUsers([]);
        }
        catch (error) {
            showToast('Failed to send reminders', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    const handleAssignCourse = () => {
        setShowCourseAssignModal(true);
    };
    const handleCourseAssignComplete = () => {
        setSelectedUsers([]);
        setShowCourseAssignModal(false);
    };
    const handleImportCSV = () => {
        // Create file input element
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = (e) => {
            const file = e.target?.files?.[0];
            if (file) {
                showToast(`Importing ${file.name}...`, 'info');
                // Here you would implement the actual CSV import logic
                setTimeout(() => {
                    showToast('CSV import completed successfully!', 'success');
                }, 3000);
            }
        };
        input.click();
    };
    const handleExport = async () => {
        setLoading(true);
        try {
            // Simulate export
            await new Promise(resolve => setTimeout(resolve, 1500));
            // Create and download CSV
            const csvContent = `Name,Email,Organization,Status,Progress\n${filteredUsers.map((user) => `"${user.name}","${user.email}","${user.organization}","${user.status}","${user.overallProgress}%"`).join('\n')}`;
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showToast('Users exported successfully!', 'success');
        }
        catch (error) {
            showToast('Failed to export users', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    const handleDeleteUser = (userId) => {
        setUserToDelete(userId);
        setShowDeleteModal(true);
    };
    const confirmDeleteUser = async () => {
        if (!userToDelete)
            return;
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            setUsersList((prev) => prev.filter((user) => user.id !== userToDelete));
            showToast('User deleted successfully!', 'success');
            setShowDeleteModal(false);
            setUserToDelete(null);
        }
        catch (error) {
            showToast('Failed to delete user', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    const handleEditUser = (userId) => {
        const user = usersList.find(u => u.id === userId);
        if (user) {
            setUserToEdit(user);
            setShowEditUserModal(true);
        }
    };
    const handleUserUpdated = (updatedUser) => {
        setUsersList((prev) => prev.map((user) => user.id === updatedUser.id ? updatedUser : user));
        showToast('User updated successfully!', 'success');
        setShowEditUserModal(false);
        setUserToEdit(null);
    };
    const handleMoreOptions = (userId) => {
        const user = usersList.find(u => u.id === userId);
        if (user) {
            // For now, show a menu with common actions
            const actions = [
                'Reset Password',
                'Send Welcome Email',
                'View Activity Log',
                'Duplicate User',
                'Export User Data'
            ];
            const action = prompt(`Select action for ${user.name}:\n${actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nEnter number (1-${actions.length}):`);
            if (action && parseInt(action) >= 1 && parseInt(action) <= actions.length) {
                const selectedAction = actions[parseInt(action) - 1];
                showToast(`${selectedAction} for ${user.name} - Feature coming soon!`, 'info');
            }
        }
    };
    return (_jsxs(PageWrapper, { children: [_jsx(Breadcrumbs, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Users', to: '/admin/users' }] }), _jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "h1", children: "User Management" }), _jsx("p", { className: "muted-text", children: "Monitor learner progress, assign courses, and manage user accounts" })] }), _jsx("div", { className: "card mb-8", children: _jsxs("div", { className: "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between", children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row", children: [_jsxs("div", { className: "relative flex-1 max-w-[520px]", children: [_jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 muted-text" }), _jsx("input", { type: "text", placeholder: "Search users...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "input pl-10", "aria-label": "Search users" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Filter, { className: "h-4 w-4 muted-text" }), _jsxs("select", { value: filterOrg, onChange: (e) => setFilterOrg(e.target.value), className: "input min-w-[160px]", "aria-label": "Filter by organization", children: [_jsx("option", { value: "all", children: "All Organizations" }), organizations.map(org => (_jsx("option", { value: org, children: org }, org)))] }), _jsxs("select", { value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), className: "input min-w-[140px]", "aria-label": "Filter by status", children: [_jsx("option", { value: "all", children: "All Status" }), _jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "inactive", children: "Inactive" })] })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [selectedUsers.length > 0 && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(LoadingButton, { onClick: handleSendReminder, loading: loading, variant: "primary", children: [_jsx(Mail, { className: "icon-16" }), "Send Reminder (", selectedUsers.length, ")"] }), _jsx(LoadingButton, { onClick: handleAssignCourse, loading: loading, variant: "success", children: "Assign Course" })] })), _jsxs(LoadingButton, { onClick: handleAddUser, variant: "primary", children: [_jsx(Plus, { className: "icon-16" }), "Add User"] }), _jsxs(LoadingButton, { onClick: handleImportCSV, variant: "secondary", children: [_jsx(Upload, { className: "icon-16" }), "Import CSV"] }), _jsxs(LoadingButton, { onClick: handleExport, loading: loading, variant: "secondary", children: [_jsx(Download, { className: "icon-16" }), "Export"] })] })] }) }), _jsx("div", { className: "table-card", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full table-collapse", children: [_jsx("thead", { className: "table-head", children: _jsxs("tr", { children: [_jsx("th", { className: "table-cell", children: _jsx("input", { type: "checkbox", checked: selectedUsers.length === filteredUsers.length && filteredUsers.length > 0, onChange: handleSelectAll, "aria-label": "Select all users", className: "checkbox-sm" }) }), _jsx("th", { className: "table-cell table-head-cell", scope: "col", children: "User" }), _jsx("th", { className: "table-cell table-head-cell", scope: "col", children: "Organization" }), _jsx("th", { className: "table-cell table-head-cell text-center", scope: "col", children: "Progress" }), _jsx("th", { className: "table-cell table-head-cell text-center", scope: "col", children: "Modules" }), _jsx("th", { className: "table-cell table-head-cell text-center", scope: "col", children: "Status" }), _jsx("th", { className: "table-cell table-head-cell text-center", scope: "col", children: "Last Login" }), _jsx("th", { className: "table-cell table-head-cell text-center", scope: "col", children: "Actions" })] }) }), _jsx("tbody", { children: filteredUsers.map((user) => (_jsxs("tr", { className: "table-row-border", children: [_jsx("td", { className: "table-cell", children: _jsx("input", { type: "checkbox", checked: selectedUsers.includes(user.id), onChange: () => handleSelectUser(user.id), "aria-label": `Select user ${user.name}`, className: "checkbox-sm" }) }), _jsx("td", { className: "table-cell", children: _jsxs("div", { children: [_jsx("div", { className: "progress-number", children: user.name }), _jsx("div", { className: "muted-small text-13", children: user.email }), _jsx("div", { className: "muted-small text-12", children: user.role })] }) }), _jsx("td", { className: "table-cell", children: _jsxs("div", { children: [_jsx("div", { className: "progress-number", children: user.organization }), _jsx("div", { className: "muted-small text-13", children: user.cohort })] }) }), _jsx("td", { className: "table-cell text-center", children: _jsxs("div", { className: "flex flex-col items-center", children: [_jsxs("div", { className: "progress-number", children: [user.overallProgress, "%"] }), _jsx("div", { className: "progress-track mt-1", children: _jsx("div", { className: "progress-fill", style: { width: `${user.overallProgress}%` }, role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": user.overallProgress, "aria-label": `${user.name} overall progress` }) })] }) }), _jsxs("td", { className: "table-cell text-center", children: [_jsxs("div", { className: "text-13", children: [_jsx("span", { className: "font-bold", children: user.completedModules }), _jsxs("span", { className: "muted-text", children: ["/ ", user.totalModules] })] }), _jsx("div", { className: "flex justify-center gap-2 mt-1", children: modules.map((module) => {
                                                        const val = user.progress[module.key];
                                                        const color = val === 100 ? 'var(--accent-success)' : val > 0 ? 'var(--highlight)' : 'var(--surface-muted)';
                                                        return (_jsx("div", { title: `${module.name}: ${val}%`, className: "module-dot", style: { background: color } }, module.key));
                                                    }) })] }), _jsx("td", { className: "table-cell text-center", children: _jsxs("div", { className: "flex items-center justify-center gap-2", children: [getStatusIcon(user.status), _jsx("span", { className: `status-badge ${user.status === 'active' ? 'status-active' : user.status === 'inactive' ? 'status-inactive' : 'status-error'}`, children: user.status })] }) }), _jsx("td", { className: "table-cell text-center muted-text text-13", children: new Date(user.lastLogin).toLocaleDateString() }), _jsx("td", { className: "table-cell text-center", children: _jsxs("div", { className: "flex items-center justify-center gap-2", children: [_jsx(Link, { to: `/admin/users/user-${user.id}`, title: "View Profile", "aria-label": `View profile for ${user.name}`, className: "icon-action secondary", children: _jsx(Eye, { className: "icon-16" }) }), _jsx("button", { onClick: () => handleEditUser(user.id), title: "Edit User", "aria-label": `Edit ${user.name}`, className: "icon-action muted", children: _jsx(Edit, { className: "icon-16" }) }), _jsx("button", { onClick: () => handleDeleteUser(user.id), title: "Delete User", "aria-label": `Delete ${user.name}`, className: "icon-action primary", children: _jsx(Trash2, { className: "icon-16" }) }), _jsx("button", { onClick: () => handleMoreOptions(user.id), title: "More Options", "aria-label": `More options for ${user.name}`, className: "icon-action muted", children: _jsx(MoreVertical, { className: "icon-16" }) })] }) })] }, user.id))) })] }) }) }), filteredUsers.length === 0 && (_jsx("div", { className: "mt-8", children: _jsx(EmptyState, { title: "No users found", description: "Try adjusting your search or filter criteria.", action: (_jsx("button", { type: "button", onClick: () => { setSearchTerm(''); setFilterOrg('all'); setFilterStatus('all'); setSelectedUsers([]); }, className: "btn-outline", children: "Reset filters" })), illustrationSrc: undefined }) })), _jsxs("div", { className: "mt-8 grid grid-cols-1 md:grid-cols-4 gap-6", children: [_jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center", children: [_jsx("div", { className: "text-2xl font-bold text-blue-600", children: filteredUsers.length }), _jsx("div", { className: "text-sm text-gray-600", children: "Total Users" })] }), _jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center", children: [_jsx("div", { className: "text-2xl font-bold text-green-600", children: filteredUsers.filter((u) => u.status === 'active').length }), _jsx("div", { className: "text-sm text-gray-600", children: "Active Users" })] }), _jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center", children: [_jsxs("div", { className: "text-2xl font-bold text-orange-600", children: [Math.round(filteredUsers.reduce((acc, user) => acc + user.overallProgress, 0) / filteredUsers.length) || 0, "%"] }), _jsx("div", { className: "text-sm text-gray-600", children: "Avg. Progress" })] }), _jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center", children: [_jsx("div", { className: "text-2xl font-bold text-purple-600", children: filteredUsers.filter((u) => u.feedbackSubmitted).length }), _jsx("div", { className: "text-sm text-gray-600", children: "Feedback Submitted" })] })] }), _jsx(AddUserModal, { isOpen: showAddUserModal, onClose: () => setShowAddUserModal(false), onUserAdded: handleUserAdded }), _jsx(CourseAssignmentModal, { isOpen: showCourseAssignModal, onClose: () => setShowCourseAssignModal(false), selectedUsers: selectedUsers, onAssignComplete: handleCourseAssignComplete }), _jsx(ConfirmationModal, { isOpen: showDeleteModal, onClose: () => {
                    setShowDeleteModal(false);
                    setUserToDelete(null);
                }, onConfirm: confirmDeleteUser, title: "Delete User", message: "Are you sure you want to delete this user? This action cannot be undone and will remove all their progress data.", confirmText: "Delete User", type: "danger", loading: loading }), showEditUserModal && userToEdit && (_jsx(AddUserModal, { isOpen: showEditUserModal, onClose: () => {
                    setShowEditUserModal(false);
                    setUserToEdit(null);
                }, onUserAdded: handleUserUpdated, editUser: userToEdit }))] }));
};
export default AdminUsers;
