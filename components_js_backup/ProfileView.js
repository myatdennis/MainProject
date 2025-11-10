import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { User, Building2, Mail, Phone, Globe, MapPin, Calendar, Activity, BookOpen, Award, ChevronRight, FileText, Link, Video, StickyNote, ClipboardList, Filter, Eye, CheckCircle, Circle } from 'lucide-react';
import { getUserProfile, getOrganizationProfile, updateResourceStatus } from '../dal/profile';
const ProfileView = ({ profileType, profileId, isAdmin = false, onResourceStatusChange }) => {
    const [userProfile, setUserProfile] = useState(null);
    const [orgProfile, setOrgProfile] = useState(null);
    const [resources, setResources] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [resourceFilter, setResourceFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        loadProfile();
    }, [profileType, profileId]);
    const loadProfile = async () => {
        try {
            setLoading(true);
            if (profileType === 'user') {
                const profile = await getUserProfile(profileId);
                setUserProfile(profile);
                if (profile) {
                    setResources(profile.resources);
                }
            }
            else {
                const profile = await getOrganizationProfile(profileId);
                setOrgProfile(profile);
                if (profile) {
                    setResources(profile.resources);
                }
            }
        }
        catch (error) {
            console.error('Failed to load profile:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const handleResourceStatusChange = async (resourceId, status) => {
        try {
            await updateResourceStatus(profileType, profileId, resourceId, status);
            setResources(prev => prev.map(r => r.id === resourceId ? { ...r, status } : r));
            onResourceStatusChange?.(resourceId, status);
        }
        catch (error) {
            console.error('Failed to update resource status:', error);
        }
    };
    const getResourceIcon = (type) => {
        switch (type) {
            case 'document': return _jsx(FileText, { className: "h-4 w-4" });
            case 'link': return _jsx(Link, { className: "h-4 w-4" });
            case 'video': return _jsx(Video, { className: "h-4 w-4" });
            case 'note': return _jsx(StickyNote, { className: "h-4 w-4" });
            case 'assignment': return _jsx(ClipboardList, { className: "h-4 w-4" });
            default: return _jsx(FileText, { className: "h-4 w-4" });
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'text-green-600 bg-green-100';
            case 'read': return 'text-blue-600 bg-blue-100';
            case 'unread': return 'text-gray-600 bg-gray-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };
    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return 'border-l-red-500';
            case 'medium': return 'border-l-yellow-500';
            case 'low': return 'border-l-green-500';
            default: return 'border-l-gray-300';
        }
    };
    const filteredResources = resources.filter(resource => {
        if (resourceFilter === 'all')
            return true;
        if (resourceFilter === 'unread')
            return resource.status === 'unread';
        if (resourceFilter === 'read')
            return resource.status === 'read';
        if (resourceFilter === 'completed')
            return resource.status === 'completed';
        return resource.type === resourceFilter;
    });
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" }), _jsx("p", { className: "mt-4 text-gray-600", children: "Loading profile..." })] }) }));
    }
    if (!userProfile && !orgProfile) {
        return (_jsxs("div", { className: "text-center py-12", children: [_jsx("div", { className: "text-gray-400", children: profileType === 'user' ? _jsx(User, { className: "h-16 w-16 mx-auto mb-4" }) : _jsx(Building2, { className: "h-16 w-16 mx-auto mb-4" }) }), _jsx("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "Profile Not Found" }), _jsxs("p", { className: "text-gray-600", children: ["The requested ", profileType, " profile could not be found."] })] }));
    }
    const profile = userProfile || orgProfile;
    if (!profile)
        return null;
    const renderUserOverview = () => {
        if (!userProfile)
            return null;
        return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [_jsxs("div", { className: "flex items-start space-x-4", children: [_jsx("div", { className: "flex-shrink-0", children: userProfile.avatar ? (_jsx("img", { src: userProfile.avatar, alt: userProfile.name, className: "h-16 w-16 rounded-full object-cover" })) : (_jsx("div", { className: "h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center", children: _jsx(User, { className: "h-8 w-8 text-orange-600" }) })) }), _jsxs("div", { className: "flex-1", children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: userProfile.name }), _jsx("p", { className: "text-lg text-gray-600", children: userProfile.role }), _jsx("p", { className: "text-sm text-gray-500", children: userProfile.organization }), userProfile.bio && (_jsx("p", { className: "mt-3 text-gray-700", children: userProfile.bio }))] })] }), _jsxs("div", { className: "mt-6 grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "flex items-center space-x-3 text-gray-600", children: [_jsx(Mail, { className: "h-4 w-4" }), _jsx("span", { children: userProfile.email })] }), userProfile.contactInfo?.phone && (_jsxs("div", { className: "flex items-center space-x-3 text-gray-600", children: [_jsx(Phone, { className: "h-4 w-4" }), _jsx("span", { children: userProfile.contactInfo.phone })] })), userProfile.enrollmentDate && (_jsxs("div", { className: "flex items-center space-x-3 text-gray-600", children: [_jsx(Calendar, { className: "h-4 w-4" }), _jsxs("span", { children: ["Enrolled: ", new Date(userProfile.enrollmentDate).toLocaleDateString()] })] })), userProfile.lastActivity && (_jsxs("div", { className: "flex items-center space-x-3 text-gray-600", children: [_jsx(Activity, { className: "h-4 w-4" }), _jsxs("span", { children: ["Last active: ", new Date(userProfile.lastActivity).toLocaleDateString()] })] }))] })] }), userProfile.contactInfo && (_jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Contact Information" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [userProfile.contactInfo.department && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Department" }), _jsx("p", { className: "mt-1 text-gray-900", children: userProfile.contactInfo.department })] })), userProfile.contactInfo.title && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Title" }), _jsx("p", { className: "mt-1 text-gray-900", children: userProfile.contactInfo.title })] }))] })] }))] }));
    };
    const renderOrgOverview = () => {
        if (!orgProfile)
            return null;
        return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [_jsxs("div", { className: "flex items-start space-x-4", children: [_jsx("div", { className: "flex-shrink-0", children: orgProfile.logo ? (_jsx("img", { src: orgProfile.logo, alt: orgProfile.name, className: "h-16 w-16 rounded-lg object-cover" })) : (_jsx("div", { className: "h-16 w-16 rounded-lg bg-blue-100 flex items-center justify-center", children: _jsx(Building2, { className: "h-8 w-8 text-blue-600" }) })) }), _jsxs("div", { className: "flex-1", children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: orgProfile.name }), _jsx("p", { className: "text-lg text-gray-600", children: orgProfile.type }), _jsx("div", { className: "mt-2", children: _jsx("span", { className: `inline-flex px-2 py-1 text-xs font-medium rounded-full ${orgProfile.status === 'active' ? 'bg-green-100 text-green-800' :
                                                    orgProfile.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                                                        'bg-yellow-100 text-yellow-800'}`, children: orgProfile.status.charAt(0).toUpperCase() + orgProfile.status.slice(1) }) }), orgProfile.description && (_jsx("p", { className: "mt-3 text-gray-700", children: orgProfile.description }))] })] }), _jsxs("div", { className: "mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: [_jsxs("div", { className: "flex items-center space-x-3 text-gray-600", children: [_jsx(User, { className: "h-4 w-4" }), _jsx("span", { children: orgProfile.contactPerson })] }), orgProfile.contactEmail && (_jsxs("div", { className: "flex items-center space-x-3 text-gray-600", children: [_jsx(Mail, { className: "h-4 w-4" }), _jsx("span", { children: orgProfile.contactEmail })] })), orgProfile.website && (_jsxs("div", { className: "flex items-center space-x-3 text-gray-600", children: [_jsx(Globe, { className: "h-4 w-4" }), _jsx("a", { href: orgProfile.website, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:text-blue-800", children: "Website" })] })), orgProfile.enrollmentDate && (_jsxs("div", { className: "flex items-center space-x-3 text-gray-600", children: [_jsx(Calendar, { className: "h-4 w-4" }), _jsxs("span", { children: ["Enrolled: ", new Date(orgProfile.enrollmentDate).toLocaleDateString()] })] })), orgProfile.lastActivity && (_jsxs("div", { className: "flex items-center space-x-3 text-gray-600", children: [_jsx(Activity, { className: "h-4 w-4" }), _jsxs("span", { children: ["Last active: ", new Date(orgProfile.lastActivity).toLocaleDateString()] })] })), orgProfile.subscription && (_jsxs("div", { className: "flex items-center space-x-3 text-gray-600", children: [_jsx(Award, { className: "h-4 w-4" }), _jsxs("span", { children: [orgProfile.subscription, " Plan"] })] }))] })] }), orgProfile.address && (_jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 mb-4 flex items-center", children: [_jsx(MapPin, { className: "h-5 w-5 mr-2" }), "Address"] }), _jsxs("div", { className: "text-gray-700", children: [orgProfile.address.street && _jsx("p", { children: orgProfile.address.street }), _jsxs("p", { children: [orgProfile.address.city, orgProfile.address.state ? `, ${orgProfile.address.state}` : '', " ", orgProfile.address.zip] }), orgProfile.address.country && _jsx("p", { children: orgProfile.address.country })] })] })), orgProfile.metrics && (_jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Metrics" }), _jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Total Learners" }), _jsx("div", { className: "text-2xl font-bold", children: orgProfile.metrics.totalLearners })] }), _jsxs("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Active Learners" }), _jsx("div", { className: "text-2xl font-bold", children: orgProfile.metrics.activeLearners })] }), _jsxs("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Completion Rate" }), _jsxs("div", { className: "text-2xl font-bold", children: [orgProfile.metrics.completionRate, "%"] })] }), _jsxs("div", { className: "p-4 bg-gray-50 rounded-lg text-center", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Downloads" }), _jsx("div", { className: "text-2xl font-bold", children: orgProfile.metrics.totalDownloads })] })] })] }))] }));
    };
    const renderProgress = () => {
        const progressData = userProfile?.learningProgress ||
            (orgProfile ? {
                completedModules: Object.values(orgProfile.modules).filter(v => v >= 80).length,
                totalModules: Object.keys(orgProfile.modules).length,
                completionRate: orgProfile.metrics?.completionRate || 0,
                modules: orgProfile.modules
            } : null);
        if (!progressData)
            return null;
        return (_jsxs("div", { className: "bg-white p-6 rounded-xl shadow-sm border border-gray-200", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("h3", { className: "text-lg font-semibold text-gray-900 flex items-center", children: [_jsx(BookOpen, { className: "h-5 w-5 mr-2" }), "Learning Progress"] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "text-2xl font-bold text-gray-900", children: [progressData.completionRate, "%"] }), _jsx("div", { className: "text-sm text-gray-600", children: "Overall Progress" })] })] }), _jsxs("div", { className: "mb-6", children: [_jsx("div", { className: "flex items-center justify-between mb-2", children: _jsxs("span", { className: "text-sm font-medium text-gray-700", children: [progressData.completedModules, " of ", progressData.totalModules, " modules completed"] }) }), _jsx("div", { className: "w-full bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "bg-orange-500 h-2 rounded-full", style: { width: `${(progressData.completedModules / progressData.totalModules) * 100}%` } }) })] }), _jsxs("div", { className: "space-y-4", children: [_jsx("h4", { className: "text-md font-medium text-gray-900", children: "Module Breakdown" }), Object.entries(progressData.modules).map(([module, progress]) => (_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm text-gray-700 capitalize", children: module.replace(/([A-Z])/g, ' $1').trim() }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "w-24 bg-gray-200 rounded-full h-2", children: _jsx("div", { className: `h-2 rounded-full ${progress >= 80 ? 'bg-green-500' : progress >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`, style: { width: `${progress}%` } }) }), _jsxs("span", { className: "text-sm font-medium text-gray-900 w-12 text-right", children: [progress, "%"] })] })] }, module)))] })] }));
    };
    const renderResources = () => {
        return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: "Resources" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Filter, { className: "h-4 w-4 text-gray-400" }), _jsxs("select", { value: resourceFilter, onChange: (e) => setResourceFilter(e.target.value), className: "text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "all", children: "All Resources" }), _jsx("option", { value: "unread", children: "Unread" }), _jsx("option", { value: "read", children: "Read" }), _jsx("option", { value: "completed", children: "Completed" }), _jsx("option", { value: "document", children: "Documents" }), _jsx("option", { value: "link", children: "Links" }), _jsx("option", { value: "video", children: "Videos" }), _jsx("option", { value: "note", children: "Notes" }), _jsx("option", { value: "assignment", children: "Assignments" })] })] })] }), filteredResources.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No resources found." })) : (_jsx("div", { className: "space-y-3", children: filteredResources.map((resource) => (_jsx("div", { className: `bg-white p-4 rounded-lg border-l-4 shadow-sm hover:shadow-md transition-shadow ${getPriorityColor(resource.priority)}`, children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex items-start space-x-3 flex-1", children: [_jsx("div", { className: "flex-shrink-0 mt-1", children: getResourceIcon(resource.type) }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("h4", { className: "font-medium text-gray-900", children: resource.title }), resource.priority && (_jsx("span", { className: `px-2 py-1 text-xs font-medium rounded-full ${resource.priority === 'high' ? 'bg-red-100 text-red-800' :
                                                                resource.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-green-100 text-green-800'}`, children: resource.priority }))] }), resource.description && (_jsx("p", { className: "text-sm text-gray-600 mt-1", children: resource.description })), _jsxs("div", { className: "flex items-center space-x-4 mt-2 text-xs text-gray-500", children: [_jsxs("span", { children: ["Type: ", resource.type] }), resource.category && _jsxs("span", { children: ["Category: ", resource.category] }), _jsxs("span", { children: ["From: ", resource.createdBy] }), _jsx("span", { children: new Date(resource.createdAt).toLocaleDateString() })] }), resource.tags.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1 mt-2", children: resource.tags.map(tag => (_jsx("span", { className: "px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full", children: tag }, tag))) }))] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: `px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(resource.status)}`, children: resource.status }), !isAdmin && (_jsxs("div", { className: "flex items-center space-x-1", children: [_jsx("button", { onClick: () => handleResourceStatusChange(resource.id, 'read'), className: `p-1 rounded ${resource.status === 'read' ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`, title: "Mark as read", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => handleResourceStatusChange(resource.id, 'completed'), className: `p-1 rounded ${resource.status === 'completed' ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`, title: "Mark as completed", children: resource.status === 'completed' ? _jsx(CheckCircle, { className: "h-4 w-4" }) : _jsx(Circle, { className: "h-4 w-4" }) })] })), _jsx("button", { onClick: () => {
                                                if (resource.url)
                                                    window.open(resource.url, '_blank');
                                            }, title: "Open resource", className: "p-1 rounded text-gray-400 hover:text-gray-700", children: _jsx(ChevronRight, { className: "h-4 w-4" }) })] })] }) }, resource.id))) }))] }));
    };
    return (_jsxs("div", { className: "max-w-4xl mx-auto", children: [_jsx("div", { className: "mb-6", children: _jsx("nav", { className: "flex space-x-1", children: ['overview', 'resources', 'progress'].map((tab) => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === tab
                            ? 'bg-orange-500 text-white'
                            : 'bg-white text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`, children: tab }, tab))) }) }), _jsxs("div", { children: [activeTab === 'overview' && (profileType === 'user' ? renderUserOverview() : renderOrgOverview()), activeTab === 'resources' && renderResources(), activeTab === 'progress' && renderProgress()] })] }));
};
export default ProfileView;
