import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Users, Send, Clock, Mail, Bell, Target, Download, Copy, QrCode, Globe, Eye, AlertCircle, CheckCircle } from 'lucide-react';
const SurveyDistribution = ({ surveyId, surveyTitle, onAssignmentSave }) => {
    const [activeTab, setActiveTab] = useState('assign');
    const [organizations, setOrganizations] = useState([]);
    const [users, setUsers] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(false);
    // Assignment Form State
    const [assignment, setAssignment] = useState({
        surveyId,
        surveyTitle,
        assignedTo: [],
        assignedOrganizations: [],
        assignedDepartments: [],
        reminderSchedule: {
            enabled: true,
            frequency: 'weekly',
            daysBeforeDeadline: [7, 3, 1]
        },
        accessControl: {
            requireLogin: true,
            allowAnonymous: false,
            oneTimeAccess: true
        },
        status: 'draft'
    });
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [selectedOrganizations, setSelectedOrganizations] = useState([]);
    const [filterDepartment, setFilterDepartment] = useState('');
    const [filterRole, setFilterRole] = useState('');
    // Mock Data - In real app, this would come from API
    useEffect(() => {
        setOrganizations([
            { id: 'org1', name: 'Technology Division', userCount: 245 },
            { id: 'org2', name: 'Human Resources', userCount: 32 },
            { id: 'org3', name: 'Marketing', userCount: 67 },
            { id: 'org4', name: 'Operations', userCount: 189 },
            { id: 'org5', name: 'Finance', userCount: 43 }
        ]);
        setUsers([
            { id: '1', name: 'Sarah Johnson', email: 'sarah.j@company.com', organization: 'Technology Division', department: 'Engineering', role: 'Senior Developer' },
            { id: '2', name: 'Michael Chen', email: 'michael.c@company.com', organization: 'Technology Division', department: 'Product', role: 'Product Manager' },
            { id: '3', name: 'Emily Rodriguez', email: 'emily.r@company.com', organization: 'Human Resources', department: 'Talent Acquisition', role: 'HR Manager' },
            { id: '4', name: 'David Kim', email: 'david.k@company.com', organization: 'Marketing', department: 'Digital Marketing', role: 'Marketing Specialist' },
            { id: '5', name: 'Lisa Thompson', email: 'lisa.t@company.com', organization: 'Operations', department: 'Customer Success', role: 'Team Lead' }
        ]);
        setAssignments([
            {
                id: 'assign1',
                surveyId,
                surveyTitle,
                assignedTo: ['1', '2', '3'],
                assignedOrganizations: ['org1'],
                assignedDepartments: ['Engineering'],
                startDate: new Date(),
                endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                reminderSchedule: {
                    enabled: true,
                    frequency: 'weekly',
                    daysBeforeDeadline: [7, 3, 1]
                },
                accessControl: {
                    requireLogin: true,
                    allowAnonymous: false,
                    oneTimeAccess: true
                },
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
                responses: {
                    total: 245,
                    completed: 123,
                    inProgress: 34
                }
            }
        ]);
    }, [surveyId, surveyTitle]);
    const handleUserSelection = (userId, selected) => {
        if (selected) {
            setSelectedUsers(prev => [...prev, userId]);
        }
        else {
            setSelectedUsers(prev => prev.filter(id => id !== userId));
        }
    };
    const handleOrganizationSelection = (orgId, selected) => {
        if (selected) {
            setSelectedOrganizations(prev => [...prev, orgId]);
        }
        else {
            setSelectedOrganizations(prev => prev.filter(id => id !== orgId));
        }
    };
    const handleSaveAssignment = async () => {
        setLoading(true);
        const newAssignment = {
            ...assignment,
            id: `assign-${Date.now()}`,
            assignedTo: selectedUsers,
            assignedOrganizations: selectedOrganizations,
            createdAt: new Date(),
            updatedAt: new Date(),
            responses: {
                total: 0,
                completed: 0,
                inProgress: 0
            }
        };
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setAssignments(prev => [...prev, newAssignment]);
        onAssignmentSave(newAssignment);
        setLoading(false);
        // Reset form
        setSelectedUsers([]);
        setSelectedOrganizations([]);
        setAssignment(prev => ({ ...prev, status: 'draft' }));
    };
    const filteredUsers = users.filter(user => {
        const matchesDepartment = !filterDepartment || user.department?.includes(filterDepartment);
        const matchesRole = !filterRole || user.role?.includes(filterRole);
        return matchesDepartment && matchesRole;
    });
    const departments = Array.from(new Set(users.map(user => user.department).filter(Boolean)));
    const roles = Array.from(new Set(users.map(user => user.role).filter(Boolean)));
    return (_jsxs("div", { className: "max-w-7xl mx-auto bg-white", children: [_jsxs("div", { className: "border-b border-gray-200 bg-white sticky top-0 z-10", children: [_jsx("div", { className: "px-6 py-4", children: _jsx("div", { className: "flex items-center justify-between", children: _jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold text-gray-900", children: "Survey Distribution" }), _jsx("p", { className: "text-sm text-gray-600", children: surveyTitle })] }) }) }), _jsx("div", { className: "px-6", children: _jsx("nav", { className: "flex space-x-8", children: [
                                { id: 'assign', label: 'Assignment', icon: Target },
                                { id: 'monitor', label: 'Monitor', icon: Eye },
                                { id: 'links', label: 'Share Links', icon: Globe },
                            ].map(({ id, label, icon: Icon }) => (_jsxs("button", { onClick: () => setActiveTab(id), className: `flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${activeTab === id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: [_jsx(Icon, { className: "w-4 h-4" }), _jsx("span", { children: label })] }, id))) }) })] }), _jsxs("div", { className: "p-6", children: [activeTab === 'assign' && (_jsxs("div", { className: "grid grid-cols-3 gap-8", children: [_jsxs("div", { className: "col-span-1 space-y-6", children: [_jsxs("div", { className: "bg-gray-50 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Assignment Settings" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Survey Period" }), _jsxs("div", { className: "space-y-2", children: [_jsx("input", { type: "datetime-local", value: assignment.startDate?.toISOString().slice(0, 16) || '', onChange: (e) => setAssignment(prev => ({
                                                                            ...prev,
                                                                            startDate: new Date(e.target.value)
                                                                        })), className: "w-full p-2 border border-gray-300 rounded-lg" }), _jsx("input", { type: "datetime-local", value: assignment.endDate?.toISOString().slice(0, 16) || '', onChange: (e) => setAssignment(prev => ({
                                                                            ...prev,
                                                                            endDate: new Date(e.target.value)
                                                                        })), className: "w-full p-2 border border-gray-300 rounded-lg" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Reminder Settings" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: assignment.reminderSchedule?.enabled || false, onChange: (e) => setAssignment(prev => ({
                                                                                    ...prev,
                                                                                    reminderSchedule: {
                                                                                        ...prev.reminderSchedule,
                                                                                        enabled: e.target.checked
                                                                                    }
                                                                                })), className: "rounded border-gray-300" }), _jsx("span", { className: "text-sm", children: "Enable automatic reminders" })] }), assignment.reminderSchedule?.enabled && (_jsxs("div", { className: "space-y-2 ml-6", children: [_jsxs("select", { value: assignment.reminderSchedule.frequency, onChange: (e) => setAssignment(prev => ({
                                                                                    ...prev,
                                                                                    reminderSchedule: {
                                                                                        ...prev.reminderSchedule,
                                                                                        frequency: e.target.value
                                                                                    }
                                                                                })), className: "w-full p-2 border border-gray-300 rounded-lg", children: [_jsx("option", { value: "daily", children: "Daily" }), _jsx("option", { value: "weekly", children: "Weekly" }), _jsx("option", { value: "bi-weekly", children: "Bi-weekly" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Send reminders (days before deadline)" }), _jsx("input", { type: "text", placeholder: "e.g., 7, 3, 1", value: assignment.reminderSchedule.daysBeforeDeadline.join(', '), onChange: (e) => {
                                                                                            const days = e.target.value.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
                                                                                            setAssignment(prev => ({
                                                                                                ...prev,
                                                                                                reminderSchedule: {
                                                                                                    ...prev.reminderSchedule,
                                                                                                    daysBeforeDeadline: days
                                                                                                }
                                                                                            }));
                                                                                        }, className: "w-full p-2 border border-gray-300 rounded-lg text-sm" })] })] }))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Access Control" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: assignment.accessControl?.requireLogin || false, onChange: (e) => setAssignment(prev => ({
                                                                                    ...prev,
                                                                                    accessControl: {
                                                                                        ...prev.accessControl,
                                                                                        requireLogin: e.target.checked
                                                                                    }
                                                                                })), className: "rounded border-gray-300" }), _jsx("span", { className: "text-sm", children: "Require login" })] }), _jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: assignment.accessControl?.allowAnonymous || false, onChange: (e) => setAssignment(prev => ({
                                                                                    ...prev,
                                                                                    accessControl: {
                                                                                        ...prev.accessControl,
                                                                                        allowAnonymous: e.target.checked
                                                                                    }
                                                                                })), className: "rounded border-gray-300" }), _jsx("span", { className: "text-sm", children: "Allow anonymous responses" })] }), _jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: assignment.accessControl?.oneTimeAccess || false, onChange: (e) => setAssignment(prev => ({
                                                                                    ...prev,
                                                                                    accessControl: {
                                                                                        ...prev.accessControl,
                                                                                        oneTimeAccess: e.target.checked
                                                                                    }
                                                                                })), className: "rounded border-gray-300" }), _jsx("span", { className: "text-sm", children: "One-time access only" })] })] })] })] }), _jsx("button", { onClick: handleSaveAssignment, disabled: loading || (selectedUsers.length === 0 && selectedOrganizations.length === 0), className: "w-full mt-6 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2", children: loading ? (_jsx("div", { className: "w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" })) : (_jsxs(_Fragment, { children: [_jsx(Send, { className: "w-4 h-4" }), _jsx("span", { children: "Send Survey" })] })) })] }), _jsxs("div", { className: "bg-blue-50 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-blue-900 mb-2", children: "Selection Summary" }), _jsxs("div", { className: "text-sm text-blue-700 space-y-1", children: [_jsxs("div", { children: ["Organizations: ", selectedOrganizations.length] }), _jsxs("div", { children: ["Individual Users: ", selectedUsers.length] }), _jsxs("div", { children: ["Total Recipients: ~", organizations
                                                                .filter(org => selectedOrganizations.includes(org.id))
                                                                .reduce((sum, org) => sum + org.userCount, 0) + selectedUsers.length] })] })] })] }), _jsxs("div", { className: "col-span-2 space-y-6", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Select Organizations" }), _jsx("div", { className: "grid grid-cols-2 gap-4", children: organizations.map((org) => (_jsx("div", { className: "border border-gray-200 rounded-lg p-4", children: _jsxs("label", { className: "flex items-center space-x-3", children: [_jsx("input", { type: "checkbox", checked: selectedOrganizations.includes(org.id), onChange: (e) => handleOrganizationSelection(org.id, e.target.checked), className: "rounded border-gray-300" }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-medium text-gray-900", children: org.name }), _jsxs("div", { className: "text-sm text-gray-600", children: [org.userCount, " users"] })] })] }) }, org.id))) })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: "Select Individual Users" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("select", { value: filterDepartment, onChange: (e) => setFilterDepartment(e.target.value), className: "p-2 border border-gray-300 rounded-lg text-sm", children: [_jsx("option", { value: "", children: "All Departments" }), departments.map((dept) => (_jsx("option", { value: dept, children: dept }, dept)))] }), _jsxs("select", { value: filterRole, onChange: (e) => setFilterRole(e.target.value), className: "p-2 border border-gray-300 rounded-lg text-sm", children: [_jsx("option", { value: "", children: "All Roles" }), roles.map((role) => (_jsx("option", { value: role, children: role }, role)))] })] })] }), _jsx("div", { className: "border border-gray-200 rounded-lg", children: _jsx("div", { className: "max-h-96 overflow-y-auto", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-gray-50 border-b border-gray-200", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left p-3 text-sm font-medium text-gray-700", children: _jsx("input", { type: "checkbox", onChange: (e) => {
                                                                                    if (e.target.checked) {
                                                                                        setSelectedUsers(filteredUsers.map(user => user.id));
                                                                                    }
                                                                                    else {
                                                                                        setSelectedUsers([]);
                                                                                    }
                                                                                }, className: "rounded border-gray-300" }) }), _jsx("th", { className: "text-left p-3 text-sm font-medium text-gray-700", children: "Name" }), _jsx("th", { className: "text-left p-3 text-sm font-medium text-gray-700", children: "Organization" }), _jsx("th", { className: "text-left p-3 text-sm font-medium text-gray-700", children: "Department" }), _jsx("th", { className: "text-left p-3 text-sm font-medium text-gray-700", children: "Role" })] }) }), _jsx("tbody", { children: filteredUsers.map((user) => (_jsxs("tr", { className: "border-b border-gray-100 hover:bg-gray-50", children: [_jsx("td", { className: "p-3", children: _jsx("input", { type: "checkbox", checked: selectedUsers.includes(user.id), onChange: (e) => handleUserSelection(user.id, e.target.checked), className: "rounded border-gray-300" }) }), _jsx("td", { className: "p-3", children: _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: user.name }), _jsx("div", { className: "text-sm text-gray-600", children: user.email })] }) }), _jsx("td", { className: "p-3 text-sm text-gray-700", children: user.organization }), _jsx("td", { className: "p-3 text-sm text-gray-700", children: user.department }), _jsx("td", { className: "p-3 text-sm text-gray-700", children: user.role })] }, user.id))) })] }) }) })] })] })] })), activeTab === 'monitor' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-4 gap-6", children: [_jsx("div", { className: "bg-blue-50 rounded-lg p-6", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(Send, { className: "w-8 h-8 text-blue-600" }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-blue-900", children: assignments.filter(a => a.status === 'active').length }), _jsx("div", { className: "text-sm text-blue-700", children: "Active Assignments" })] })] }) }), _jsx("div", { className: "bg-green-50 rounded-lg p-6", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(CheckCircle, { className: "w-8 h-8 text-green-600" }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-green-900", children: assignments.reduce((sum, a) => sum + a.responses.completed, 0) }), _jsx("div", { className: "text-sm text-green-700", children: "Completed Responses" })] })] }) }), _jsx("div", { className: "bg-yellow-50 rounded-lg p-6", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(Clock, { className: "w-8 h-8 text-yellow-600" }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-yellow-900", children: assignments.reduce((sum, a) => sum + a.responses.inProgress, 0) }), _jsx("div", { className: "text-sm text-yellow-700", children: "In Progress" })] })] }) }), _jsx("div", { className: "bg-gray-50 rounded-lg p-6", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(Users, { className: "w-8 h-8 text-gray-600" }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-gray-900", children: assignments.reduce((sum, a) => sum + a.responses.total, 0) }), _jsx("div", { className: "text-sm text-gray-700", children: "Total Assigned" })] })] }) })] }), _jsxs("div", { className: "bg-white border border-gray-200 rounded-lg", children: [_jsx("div", { className: "px-6 py-4 border-b border-gray-200", children: _jsx("h3", { className: "text-lg font-semibold text-gray-900", children: "Survey Assignments" }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-gray-50 border-b border-gray-200", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left p-4 text-sm font-medium text-gray-700", children: "Assignment" }), _jsx("th", { className: "text-left p-4 text-sm font-medium text-gray-700", children: "Period" }), _jsx("th", { className: "text-left p-4 text-sm font-medium text-gray-700", children: "Recipients" }), _jsx("th", { className: "text-left p-4 text-sm font-medium text-gray-700", children: "Response Rate" }), _jsx("th", { className: "text-left p-4 text-sm font-medium text-gray-700", children: "Status" }), _jsx("th", { className: "text-left p-4 text-sm font-medium text-gray-700", children: "Actions" })] }) }), _jsx("tbody", { children: assignments.map((assignment) => {
                                                        const responseRate = assignment.responses.total > 0
                                                            ? ((assignment.responses.completed / assignment.responses.total) * 100).toFixed(1)
                                                            : '0';
                                                        return (_jsxs("tr", { className: "border-b border-gray-100 hover:bg-gray-50", children: [_jsxs("td", { className: "p-4", children: [_jsx("div", { className: "font-medium text-gray-900", children: assignment.surveyTitle }), _jsxs("div", { className: "text-sm text-gray-600", children: ["Created ", assignment.createdAt.toLocaleDateString()] })] }), _jsx("td", { className: "p-4 text-sm text-gray-700", children: assignment.startDate && (_jsxs("div", { children: [_jsx("div", { children: assignment.startDate.toLocaleDateString() }), assignment.endDate && (_jsxs("div", { children: ["to ", assignment.endDate.toLocaleDateString()] }))] })) }), _jsxs("td", { className: "p-4 text-sm text-gray-700", children: [_jsxs("div", { children: [assignment.responses.total, " total"] }), _jsxs("div", { className: "text-xs text-gray-600", children: [assignment.assignedOrganizations.length, " orgs, ", assignment.assignedTo.length, " users"] })] }), _jsxs("td", { className: "p-4", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "flex-1 bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "bg-blue-500 h-2 rounded-full", style: { width: `${responseRate}%` } }) }), _jsxs("span", { className: "text-sm font-medium", children: [responseRate, "%"] })] }), _jsxs("div", { className: "text-xs text-gray-600 mt-1", children: [assignment.responses.completed, " of ", assignment.responses.total] })] }), _jsx("td", { className: "p-4", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${assignment.status === 'active'
                                                                            ? 'bg-green-100 text-green-800'
                                                                            : assignment.status === 'scheduled'
                                                                                ? 'bg-yellow-100 text-yellow-800'
                                                                                : assignment.status === 'paused'
                                                                                    ? 'bg-red-100 text-red-800'
                                                                                    : 'bg-gray-100 text-gray-800'}`, children: assignment.status }) }), _jsx("td", { className: "p-4", children: _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { className: "p-1 text-blue-600 hover:bg-blue-100 rounded", children: _jsx(Bell, { className: "w-4 h-4" }) }), _jsx("button", { className: "p-1 text-gray-600 hover:bg-gray-100 rounded", children: _jsx(Eye, { className: "w-4 h-4" }) }), _jsx("button", { className: "p-1 text-green-600 hover:bg-green-100 rounded", children: _jsx(Download, { className: "w-4 h-4" }) })] }) })] }, assignment.id));
                                                    }) })] }) })] })] })), activeTab === 'links' && (_jsxs("div", { className: "max-w-4xl space-y-6", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Share Survey Links" }), _jsx("p", { className: "text-gray-600 mb-6", children: "Generate different types of links for various distribution methods" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [_jsxs("div", { className: "border border-gray-200 rounded-lg p-6", children: [_jsxs("div", { className: "flex items-center space-x-3 mb-4", children: [_jsx(Globe, { className: "w-6 h-6 text-blue-600" }), _jsx("h4", { className: "font-semibold text-gray-900", children: "Public Link" })] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Anyone with this link can access the survey. No login required." }), _jsx("div", { className: "bg-gray-50 rounded p-3 mb-4", children: _jsxs("code", { className: "text-sm text-gray-800 break-all", children: ["https://yourapp.com/survey/", surveyId, "/public"] }) }), _jsxs("div", { className: "flex space-x-2", children: [_jsxs("button", { className: "flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center space-x-1", children: [_jsx(Copy, { className: "w-4 h-4" }), _jsx("span", { children: "Copy" })] }), _jsx("button", { className: "px-3 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50", children: _jsx(QrCode, { className: "w-4 h-4" }) })] })] }), _jsxs("div", { className: "border border-gray-200 rounded-lg p-6", children: [_jsxs("div", { className: "flex items-center space-x-3 mb-4", children: [_jsx(Users, { className: "w-6 h-6 text-green-600" }), _jsx("h4", { className: "font-semibold text-gray-900", children: "Authenticated Link" })] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Requires users to log in. Responses are linked to user accounts." }), _jsx("div", { className: "bg-gray-50 rounded p-3 mb-4", children: _jsxs("code", { className: "text-sm text-gray-800 break-all", children: ["https://yourapp.com/survey/", surveyId, "/auth"] }) }), _jsxs("div", { className: "flex space-x-2", children: [_jsxs("button", { className: "flex-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center space-x-1", children: [_jsx(Copy, { className: "w-4 h-4" }), _jsx("span", { children: "Copy" })] }), _jsx("button", { className: "px-3 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50", children: _jsx(QrCode, { className: "w-4 h-4" }) })] })] }), _jsxs("div", { className: "border border-gray-200 rounded-lg p-6", children: [_jsxs("div", { className: "flex items-center space-x-3 mb-4", children: [_jsx(Mail, { className: "w-6 h-6 text-purple-600" }), _jsx("h4", { className: "font-semibold text-gray-900", children: "Email Template" })] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Pre-formatted email invitation for copy/paste into your email client." }), _jsxs("div", { className: "bg-gray-50 rounded p-3 mb-4 text-sm", children: [_jsxs("div", { className: "font-medium mb-2", children: ["Subject: Your input needed - ", surveyTitle] }), _jsxs("div", { className: "text-gray-700", children: ["Hello,", _jsx("br", {}), _jsx("br", {}), "You've been invited to participate in our survey: ", surveyTitle, ".", _jsx("br", {}), _jsx("br", {}), "Your feedback is valuable and will help us improve our workplace culture.", _jsx("br", {}), _jsx("br", {}), _jsx("a", { href: "#", className: "text-blue-600 underline", children: "Take Survey Now" }), _jsx("br", {}), _jsx("br", {}), "Thank you for your participation."] })] }), _jsxs("button", { className: "w-full px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center justify-center space-x-1", children: [_jsx(Copy, { className: "w-4 h-4" }), _jsx("span", { children: "Copy Email Template" })] })] }), _jsxs("div", { className: "border border-gray-200 rounded-lg p-6", children: [_jsxs("div", { className: "flex items-center space-x-3 mb-4", children: [_jsx(AlertCircle, { className: "w-6 h-6 text-orange-600" }), _jsx("h4", { className: "font-semibold text-gray-900", children: "Embed Code" })] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Embed the survey directly into your website or intranet." }), _jsx("div", { className: "bg-gray-50 rounded p-3 mb-4", children: _jsx("code", { className: "text-xs text-gray-800 break-all", children: `<iframe src="https://yourapp.com/survey/${surveyId}/embed" width="100%" height="600" frameborder="0"></iframe>` }) }), _jsxs("button", { className: "w-full px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 flex items-center justify-center space-x-1", children: [_jsx(Copy, { className: "w-4 h-4" }), _jsx("span", { children: "Copy Embed Code" })] })] })] }), _jsxs("div", { className: "border border-gray-200 rounded-lg p-6", children: [_jsx("h4", { className: "font-semibold text-gray-900 mb-4", children: "Link Analytics" }), _jsxs("div", { className: "grid grid-cols-4 gap-4 text-center", children: [_jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-blue-600", children: "1,234" }), _jsx("div", { className: "text-sm text-gray-600", children: "Total Clicks" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-green-600", children: "567" }), _jsx("div", { className: "text-sm text-gray-600", children: "Started Survey" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-purple-600", children: "345" }), _jsx("div", { className: "text-sm text-gray-600", children: "Completed" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-orange-600", children: "28%" }), _jsx("div", { className: "text-sm text-gray-600", children: "Completion Rate" })] })] })] })] }))] })] }));
};
export default SurveyDistribution;
