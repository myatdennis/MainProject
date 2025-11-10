import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Send, X, FileText, Link as LinkIcon, Video, StickyNote, ClipboardList, Search, User, Building2, AlertTriangle, CheckCircle } from 'lucide-react';
import profileService from '../dal/profile';
import documentService from '../dal/documents';
const ResourceSender = ({ onResourceSent, onClose, isModal = false, preselectedProfile }) => {
    // Form state
    const [selectedProfileType, setSelectedProfileType] = useState(preselectedProfile?.type || 'user');
    const [selectedProfileId, setSelectedProfileId] = useState(preselectedProfile?.id || '');
    const [resourceType, setResourceType] = useState('document');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [url, setUrl] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('');
    const [priority, setPriority] = useState('medium');
    const [tags, setTags] = useState('');
    const [selectedDocumentId, setSelectedDocumentId] = useState('');
    const [message, setMessage] = useState('');
    const [notifyRecipient, setNotifyRecipient] = useState(true);
    // Data state
    const [userProfiles, setUserProfiles] = useState([]);
    const [orgProfiles, setOrgProfiles] = useState([]);
    const [documents, setDocuments] = useState([]);
    // UI state
    const [profileSearch, setProfileSearch] = useState('');
    const [documentSearch, setDocumentSearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    useEffect(() => {
        loadProfiles();
        loadDocuments();
    }, []);
    const loadProfiles = async () => {
        try {
            const [users, orgs] = await Promise.all([
                profileService.listUserProfiles(),
                profileService.listOrganizationProfiles()
            ]);
            setUserProfiles(users);
            setOrgProfiles(orgs);
        }
        catch (error) {
            console.error('Failed to load profiles:', error);
            setError('Failed to load profiles');
        }
    };
    const loadDocuments = async () => {
        try {
            const docs = await documentService.listDocuments();
            setDocuments(docs);
        }
        catch (error) {
            console.error('Failed to load documents:', error);
        }
    };
    const resetForm = () => {
        if (!preselectedProfile) {
            setSelectedProfileType('user');
            setSelectedProfileId('');
        }
        setResourceType('document');
        setTitle('');
        setDescription('');
        setUrl('');
        setContent('');
        setCategory('');
        setPriority('medium');
        setTags('');
        setSelectedDocumentId('');
        setMessage('');
        setNotifyRecipient(true);
        setError('');
        setSuccess('');
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedProfileId) {
            setError('Please select a profile');
            return;
        }
        if (!title.trim()) {
            setError('Please provide a title');
            return;
        }
        if (resourceType === 'document' && !selectedDocumentId) {
            setError('Please select a document');
            return;
        }
        if ((resourceType === 'link' || resourceType === 'video') && !url.trim()) {
            setError('Please provide a URL');
            return;
        }
        if (resourceType === 'note' && !content.trim()) {
            setError('Please provide content for the note');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const resource = {
                type: resourceType,
                title: title.trim(),
                description: description.trim() || undefined,
                url: (resourceType === 'link' || resourceType === 'video') ? url.trim() : undefined,
                content: resourceType === 'note' ? content.trim() : undefined,
                documentId: resourceType === 'document' ? selectedDocumentId : undefined,
                tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
                category: category.trim() || undefined,
                priority
            };
            const request = {
                profileType: selectedProfileType,
                profileId: selectedProfileId,
                resource,
                notifyRecipient,
                message: message.trim() || undefined
            };
            const createdResource = await profileService.addResourceToProfile(request);
            setSuccess('Resource sent successfully!');
            onResourceSent?.(createdResource, selectedProfileType, selectedProfileId);
            // Reset form after short delay
            setTimeout(() => {
                resetForm();
                if (isModal && onClose) {
                    onClose();
                }
            }, 1500);
        }
        catch (error) {
            console.error('Failed to send resource:', error);
            setError('Failed to send resource. Please try again.');
        }
        finally {
            setIsLoading(false);
        }
    };
    const getResourceTypeIcon = (type) => {
        switch (type) {
            case 'document': return _jsx(FileText, { className: "h-4 w-4" });
            case 'link': return _jsx(LinkIcon, { className: "h-4 w-4" });
            case 'video': return _jsx(Video, { className: "h-4 w-4" });
            case 'note': return _jsx(StickyNote, { className: "h-4 w-4" });
            case 'assignment': return _jsx(ClipboardList, { className: "h-4 w-4" });
        }
    };
    const filteredUserProfiles = userProfiles.filter(profile => profile.name.toLowerCase().includes(profileSearch.toLowerCase()) ||
        profile.email.toLowerCase().includes(profileSearch.toLowerCase()) ||
        profile.organization?.toLowerCase().includes(profileSearch.toLowerCase()));
    const filteredOrgProfiles = orgProfiles.filter(profile => profile.name.toLowerCase().includes(profileSearch.toLowerCase()) ||
        profile.type.toLowerCase().includes(profileSearch.toLowerCase()) ||
        profile.contactPerson.toLowerCase().includes(profileSearch.toLowerCase()));
    const filteredDocuments = documents.filter(doc => doc.name.toLowerCase().includes(documentSearch.toLowerCase()) ||
        doc.category.toLowerCase().includes(documentSearch.toLowerCase()) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(documentSearch.toLowerCase())));
    const selectedProfile = selectedProfileType === 'user'
        ? userProfiles.find(p => p.id === selectedProfileId)
        : orgProfiles.find(p => p.id === selectedProfileId);
    const content_component = (_jsxs("div", { className: `bg-white ${isModal ? 'p-6 rounded-lg shadow-xl max-w-2xl mx-auto' : 'p-6 rounded-xl shadow-sm border border-gray-200'}`, children: [isModal && (_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900", children: "Send Resource" }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600", children: _jsx(X, { className: "h-6 w-6" }) })] })), !isModal && (_jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-2", children: "Send Resource to Profile" }), _jsx("p", { className: "text-gray-600", children: "Send documents, links, notes, and other resources to user or organization profiles." })] })), error && (_jsxs("div", { className: "mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2", children: [_jsx(AlertTriangle, { className: "h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" }), _jsx("span", { className: "text-red-700", children: error })] })), success && (_jsxs("div", { className: "mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-2", children: [_jsx(CheckCircle, { className: "h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" }), _jsx("span", { className: "text-green-700", children: success })] })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [!preselectedProfile && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Profile Type" }), _jsxs("div", { className: "flex space-x-4", children: [_jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "radio", value: "user", checked: selectedProfileType === 'user', onChange: (e) => {
                                                            setSelectedProfileType(e.target.value);
                                                            setSelectedProfileId('');
                                                        }, className: "mr-2" }), _jsx(User, { className: "h-4 w-4 mr-1" }), "User Profile"] }), _jsxs("label", { className: "flex items-center", children: [_jsx("input", { type: "radio", value: "organization", checked: selectedProfileType === 'organization', onChange: (e) => {
                                                            setSelectedProfileType(e.target.value);
                                                            setSelectedProfileId('');
                                                        }, className: "mr-2" }), _jsx(Building2, { className: "h-4 w-4 mr-1" }), "Organization Profile"] })] })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: ["Search ", selectedProfileType === 'user' ? 'Users' : 'Organizations'] }), _jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-3 top-3 h-4 w-4 text-gray-400" }), _jsx("input", { type: "text", placeholder: `Search ${selectedProfileType === 'user' ? 'users' : 'organizations'}...`, value: profileSearch, onChange: (e) => setProfileSearch(e.target.value), className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: ["Select ", selectedProfileType === 'user' ? 'User' : 'Organization'] }), _jsx("div", { className: "max-h-48 overflow-y-auto border border-gray-300 rounded-lg", children: selectedProfileType === 'user' ? (filteredUserProfiles.length === 0 ? (_jsx("div", { className: "p-4 text-center text-gray-500", children: "No users found" })) : (filteredUserProfiles.map(profile => (_jsxs("label", { className: "flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0", children: [_jsx("input", { type: "radio", value: profile.id, checked: selectedProfileId === profile.id, onChange: (e) => setSelectedProfileId(e.target.value), className: "mr-3" }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-medium text-gray-900", children: profile.name }), _jsx("div", { className: "text-sm text-gray-600", children: profile.email }), profile.organization && (_jsx("div", { className: "text-xs text-gray-500", children: profile.organization }))] })] }, profile.id))))) : (filteredOrgProfiles.length === 0 ? (_jsx("div", { className: "p-4 text-center text-gray-500", children: "No organizations found" })) : (filteredOrgProfiles.map(profile => (_jsxs("label", { className: "flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0", children: [_jsx("input", { type: "radio", value: profile.id, checked: selectedProfileId === profile.id, onChange: (e) => setSelectedProfileId(e.target.value), className: "mr-3" }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-medium text-gray-900", children: profile.name }), _jsx("div", { className: "text-sm text-gray-600", children: profile.type }), _jsx("div", { className: "text-xs text-gray-500", children: profile.contactPerson })] })] }, profile.id))))) })] })] })), preselectedProfile && selectedProfile && (_jsx("div", { className: "p-4 bg-gray-50 rounded-lg", children: _jsxs("div", { className: "flex items-center space-x-3", children: [selectedProfileType === 'user' ? _jsx(User, { className: "h-5 w-5 text-gray-600" }) : _jsx(Building2, { className: "h-5 w-5 text-gray-600" }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: selectedProfile.name }), _jsx("div", { className: "text-sm text-gray-600", children: selectedProfileType === 'user' ? selectedProfile.email : selectedProfile.type })] })] }) })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Resource Type" }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-5 gap-2", children: ['document', 'link', 'video', 'note', 'assignment'].map(type => (_jsxs("label", { className: `flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors ${resourceType === type
                                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                                        : 'border-gray-300 hover:border-gray-400'}`, children: [_jsx("input", { type: "radio", value: type, checked: resourceType === type, onChange: (e) => setResourceType(e.target.value), className: "sr-only" }), getResourceTypeIcon(type), _jsx("span", { className: "text-xs mt-1 capitalize", children: type })] }, type))) })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "title", className: "block text-sm font-medium text-gray-700 mb-1", children: "Title *" }), _jsx("input", { type: "text", id: "title", value: title, onChange: (e) => setTitle(e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Enter resource title", required: true })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "description", className: "block text-sm font-medium text-gray-700 mb-1", children: "Description" }), _jsx("textarea", { id: "description", value: description, onChange: (e) => setDescription(e.target.value), rows: 3, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Enter resource description" })] }), resourceType === 'document' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Select Document *" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-3 top-3 h-4 w-4 text-gray-400" }), _jsx("input", { type: "text", placeholder: "Search documents...", value: documentSearch, onChange: (e) => setDocumentSearch(e.target.value), className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsx("div", { className: "max-h-40 overflow-y-auto border border-gray-300 rounded-lg", children: filteredDocuments.length === 0 ? (_jsx("div", { className: "p-4 text-center text-gray-500", children: "No documents found" })) : (filteredDocuments.map(doc => (_jsxs("label", { className: "flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0", children: [_jsx("input", { type: "radio", value: doc.id, checked: selectedDocumentId === doc.id, onChange: (e) => setSelectedDocumentId(e.target.value), className: "mr-3" }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-medium text-gray-900", children: doc.name }), _jsx("div", { className: "text-sm text-gray-600", children: doc.category }), doc.tags && doc.tags.length > 0 && (_jsxs("div", { className: "text-xs text-gray-500", children: ["Tags: ", doc.tags.join(', ')] }))] })] }, doc.id)))) })] })] })), (resourceType === 'link' || resourceType === 'video') && (_jsxs("div", { children: [_jsx("label", { htmlFor: "url", className: "block text-sm font-medium text-gray-700 mb-1", children: "URL *" }), _jsx("input", { type: "url", id: "url", value: url, onChange: (e) => setUrl(e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: `Enter ${resourceType} URL`, required: true })] })), resourceType === 'note' && (_jsxs("div", { children: [_jsx("label", { htmlFor: "content", className: "block text-sm font-medium text-gray-700 mb-1", children: "Content *" }), _jsx("textarea", { id: "content", value: content, onChange: (e) => setContent(e.target.value), rows: 6, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Enter note content", required: true })] })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "category", className: "block text-sm font-medium text-gray-700 mb-1", children: "Category" }), _jsx("input", { type: "text", id: "category", value: category, onChange: (e) => setCategory(e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "e.g., Training, Documentation" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "priority", className: "block text-sm font-medium text-gray-700 mb-1", children: "Priority" }), _jsxs("select", { id: "priority", value: priority, onChange: (e) => setPriority(e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "medium", children: "Medium" }), _jsx("option", { value: "high", children: "High" })] })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "tags", className: "block text-sm font-medium text-gray-700 mb-1", children: "Tags" }), _jsx("input", { type: "text", id: "tags", value: tags, onChange: (e) => setTags(e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Enter tags separated by commas" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Separate multiple tags with commas" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "message", className: "block text-sm font-medium text-gray-700 mb-1", children: "Message to Recipient" }), _jsx("textarea", { id: "message", value: message, onChange: (e) => setMessage(e.target.value), rows: 3, className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent", placeholder: "Optional message to include with the resource" })] }), _jsxs("div", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", id: "notify", checked: notifyRecipient, onChange: (e) => setNotifyRecipient(e.target.checked), className: "mr-2" }), _jsx("label", { htmlFor: "notify", className: "text-sm text-gray-700", children: "Send notification to recipient" })] })] }), _jsxs("div", { className: "flex items-center justify-end space-x-3", children: [isModal && (_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50", disabled: isLoading, children: "Cancel" })), _jsx("button", { type: "submit", disabled: isLoading || !selectedProfileId, className: "flex items-center space-x-2 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed", children: isLoading ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "animate-spin rounded-full h-4 w-4 border-b-2 border-white" }), _jsx("span", { children: "Sending..." })] })) : (_jsxs(_Fragment, { children: [_jsx(Send, { className: "h-4 w-4" }), _jsx("span", { children: "Send Resource" })] })) })] })] })] }));
    if (isModal) {
        return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsx("div", { className: "max-h-[90vh] overflow-y-auto", children: content_component }) }));
    }
    return content_component;
};
export default ResourceSender;
