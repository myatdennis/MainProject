import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Download, FileText, Video, Archive, Search, Filter, Calendar, Folder } from 'lucide-react';
import EmptyState from '../../components/ui/EmptyState';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
const LMSDownloads = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [selectedItems, setSelectedItems] = useState([]);
    const resources = [
        {
            id: '1',
            title: 'Leadership Self-Assessment',
            type: 'PDF',
            category: 'Foundations of Inclusive Leadership',
            size: '2.3 MB',
            uploadDate: '2025-01-15',
            description: 'Comprehensive self-assessment tool to evaluate your current leadership style and identify areas for growth.',
            downloadUrl: '#',
            icon: FileText,
            color: 'text-red-500'
        },
        {
            id: '2',
            title: 'Psychological Safety Checklist',
            type: 'PDF',
            category: 'Foundations of Inclusive Leadership',
            size: '1.8 MB',
            uploadDate: '2025-01-15',
            description: 'Practical checklist to assess and improve psychological safety within your team.',
            downloadUrl: '#',
            icon: FileText,
            color: 'text-red-500'
        },
        {
            id: '3',
            title: 'Team Reflection Worksheet',
            type: 'PDF',
            category: 'Foundations of Inclusive Leadership',
            size: '1.2 MB',
            uploadDate: '2025-01-15',
            description: 'Guided worksheet for team reflection sessions and goal setting.',
            downloadUrl: '#',
            icon: FileText,
            color: 'text-red-500'
        },
        {
            id: '4',
            title: 'Bias Recognition Toolkit',
            type: 'PDF',
            category: 'Recognizing and Mitigating Bias',
            size: '3.1 MB',
            uploadDate: '2025-01-10',
            description: 'Complete toolkit with exercises and frameworks for identifying and addressing unconscious bias.',
            downloadUrl: '#',
            icon: FileText,
            color: 'text-red-500'
        },
        {
            id: '5',
            title: 'Structured Interview Guide',
            type: 'PDF',
            category: 'Recognizing and Mitigating Bias',
            size: '2.7 MB',
            uploadDate: '2025-01-10',
            description: 'Step-by-step guide for conducting bias-free interviews and evaluations.',
            downloadUrl: '#',
            icon: FileText,
            color: 'text-red-500'
        },
        {
            id: '6',
            title: 'Introduction to Inclusive Leadership',
            type: 'MP4',
            category: 'Foundations of Inclusive Leadership',
            size: '45.2 MB',
            uploadDate: '2025-01-15',
            description: 'Foundational video covering the principles and practices of inclusive leadership.',
            downloadUrl: '#',
            icon: Video,
            color: 'text-blue-500'
        },
        {
            id: '7',
            title: 'Understanding Psychological Safety',
            type: 'MP4',
            category: 'Foundations of Inclusive Leadership',
            size: '67.8 MB',
            uploadDate: '2025-01-15',
            description: 'Deep dive into creating and maintaining psychological safety in teams.',
            downloadUrl: '#',
            icon: Video,
            color: 'text-blue-500'
        },
        {
            id: '8',
            title: 'Conversation Planning Template',
            type: 'DOCX',
            category: 'Courageous Conversations at Work',
            size: '0.8 MB',
            uploadDate: '2025-01-05',
            description: 'Editable template for planning and structuring difficult conversations.',
            downloadUrl: '#',
            icon: FileText,
            color: 'text-green-500'
        },
        {
            id: '9',
            title: 'Action Planning Workbook',
            type: 'PDF',
            category: 'Personal & Team Action Planning',
            size: '4.2 MB',
            uploadDate: '2025-01-01',
            description: 'Comprehensive workbook for creating personal and team development action plans.',
            downloadUrl: '#',
            icon: FileText,
            color: 'text-red-500'
        },
        {
            id: '10',
            title: 'Complete Resource Package',
            type: 'ZIP',
            category: 'All Modules',
            size: '128.5 MB',
            uploadDate: '2025-01-15',
            description: 'All course materials, videos, and worksheets in one convenient package.',
            downloadUrl: '#',
            icon: Archive,
            color: 'text-purple-500'
        }
    ];
    const categories = [
        'All Modules',
        'Foundations of Inclusive Leadership',
        'Recognizing and Mitigating Bias',
        'Empathy in Action',
        'Courageous Conversations at Work',
        'Personal & Team Action Planning'
    ];
    const filteredResources = resources.filter(resource => {
        const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            resource.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'all' || resource.type.toLowerCase() === filterType.toLowerCase();
        return matchesSearch && matchesFilter;
    });
    const handleSelectItem = (id) => {
        setSelectedItems(prev => prev.includes(id)
            ? prev.filter(item => item !== id)
            : [...prev, id]);
    };
    const handleSelectAll = () => {
        if (selectedItems.length === filteredResources.length) {
            setSelectedItems([]);
        }
        else {
            setSelectedItems(filteredResources.map(resource => resource.id));
        }
    };
    const handleDownloadSelected = () => {
        // In a real app, this would trigger downloads for selected items
        console.log('Downloading selected items:', selectedItems);
    };
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };
    const getFileTypeColor = (type) => {
        switch (type.toLowerCase()) {
            case 'pdf':
                return 'bg-red-100 text-red-800';
            case 'mp4':
                return 'bg-blue-100 text-blue-800';
            case 'docx':
                return 'bg-green-100 text-green-800';
            case 'zip':
                return 'bg-purple-100 text-purple-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-softwhite", children: _jsxs("div", { className: "container-page section", children: [_jsx(Breadcrumbs, { items: [{ label: 'Downloads', to: '/lms/downloads' }] }), _jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "h1", children: "Downloads" }), _jsx("p", { className: "lead", children: "Access all your course materials, worksheets, and resources" })] }), _jsx("div", { className: "card-lg card-hover mb-8", children: _jsxs("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0", children: [_jsxs("div", { className: "flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1", children: [_jsxs("div", { className: "relative flex-1 max-w-md", children: [_jsx(Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" }), _jsx("input", { type: "text", placeholder: "Search resources...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "w-full pl-10 pr-4 py-2 rounded-lg border border-mist focus:ring-2 focus:ring-orange-500 focus:border-transparent" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Filter, { className: "h-5 w-5 text-gray-400" }), _jsxs("select", { value: filterType, onChange: (e) => setFilterType(e.target.value), className: "rounded-lg border border-mist px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent", children: [_jsx("option", { value: "all", children: "All Types" }), _jsx("option", { value: "pdf", children: "PDF" }), _jsx("option", { value: "mp4", children: "Video" }), _jsx("option", { value: "docx", children: "Document" }), _jsx("option", { value: "zip", children: "Archive" })] })] })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [selectedItems.length > 0 && (_jsxs("button", { onClick: handleDownloadSelected, className: "btn-cta px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Download, { className: "h-4 w-4" }), _jsxs("span", { children: ["Download Selected (", selectedItems.length, ")"] })] })), _jsx("button", { onClick: handleSelectAll, className: "nav-link font-medium", children: selectedItems.length === filteredResources.length ? 'Deselect All' : 'Select All' })] })] }) }), _jsxs("div", { className: "mb-8", children: [_jsx("h2", { className: "h2 mb-4", children: "Browse by Category" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: categories.map((category) => {
                                const categoryCount = resources.filter(r => r.category === category).length;
                                return (_jsx("div", { className: "card-lg card-hover cursor-pointer", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "bg-orange-50 p-2 rounded-lg", children: _jsx(Folder, { className: "h-5 w-5 text-orange-500" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-medium text-charcoal", children: category }), _jsxs("p", { className: "text-sm text-slate/80", children: [categoryCount, " resources"] })] })] }) }, category));
                            }) })] }), _jsx("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: filteredResources.map((resource) => {
                        const Icon = resource.icon;
                        const isSelected = selectedItems.includes(resource.id);
                        return (_jsx("div", { className: `card-lg card-hover transition-all duration-200 ${isSelected ? 'ring-2 ring-orange-500' : ''}`, children: _jsxs("div", { className: "", children: [_jsx("div", { className: "flex items-start justify-between mb-4", children: _jsxs("div", { className: "flex items-start space-x-4 flex-1", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("input", { type: "checkbox", checked: isSelected, onChange: () => handleSelectItem(resource.id), className: "h-4 w-4 text-orange-500 focus:ring-orange-500 border-mist rounded" }) }), _jsx("div", { className: `p-3 rounded-lg bg-white/50`, children: _jsx(Icon, { className: `h-6 w-6 ${resource.color}` }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h3", { className: "font-heading text-lg font-semibold text-charcoal mb-1", children: resource.title }), _jsx("p", { className: "text-sm text-slate/80 mb-2", children: resource.description }), _jsxs("div", { className: "flex items-center space-x-4 text-xs text-slate/70", children: [_jsx("span", { className: `px-2 py-1 rounded-full font-medium ${getFileTypeColor(resource.type)}`, children: resource.type }), _jsxs("span", { className: "flex items-center", children: [_jsx(Calendar, { className: "h-3 w-3 mr-1" }), formatDate(resource.uploadDate)] }), _jsx("span", { children: resource.size })] })] })] }) }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-slate/80", children: [_jsx("span", { className: "font-medium", children: "Category:" }), " ", resource.category] }), _jsxs("a", { href: resource.downloadUrl, className: "btn-outline px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2", children: [_jsx(Download, { className: "h-4 w-4" }), _jsx("span", { children: "Download" })] })] })] }) }, resource.id));
                    }) }), filteredResources.length === 0 && (_jsx("div", { className: "mt-8", children: _jsx(EmptyState, { title: "No resources found", description: "Try adjusting your search or filter criteria.", action: (_jsx("button", { type: "button", onClick: () => { setSearchTerm(''); setFilterType('all'); setSelectedItems([]); }, className: "btn-outline", children: "Reset filters" })), illustrationSrc: undefined }) })), _jsx("div", { className: "mt-12 rounded-xl p-8", style: { background: 'linear-gradient(90deg, color-mix(in srgb, var(--hud-blue) 10%, transparent), color-mix(in srgb, var(--hud-green) 10%, transparent))' }, children: _jsxs("div", { className: "text-center", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-4", children: "Need Everything at Once?" }), _jsx("p", { className: "text-gray-600 mb-6 max-w-2xl mx-auto", children: "Download our complete resource package containing all course materials, videos, and worksheets in one convenient ZIP file." }), _jsxs("a", { href: "/lms/downloads/package", className: "btn-cta px-8 py-4 rounded-full font-semibold text-lg transition-all duration-200 transform hover:scale-105 flex items-center mx-auto space-x-2", children: [_jsx(Archive, { className: "h-5 w-5" }), _jsx("span", { children: "Download Complete Package (128.5 MB)" })] })] }) })] }) }));
};
export default LMSDownloads;
