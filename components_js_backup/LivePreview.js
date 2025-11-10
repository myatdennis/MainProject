import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Monitor, Smartphone, Tablet, RefreshCw, ExternalLink } from 'lucide-react';
const LivePreview = ({ course, currentModule, currentLesson, isOpen, onClose }) => {
    const [previewMode, setPreviewMode] = useState('desktop');
    const [viewType, setViewType] = useState('learner');
    const [refreshKey, setRefreshKey] = useState(0);
    // Auto-refresh preview when course content changes
    useEffect(() => {
        setRefreshKey(prev => prev + 1);
    }, [course, currentModule, currentLesson]);
    const getPreviewDimensions = () => {
        switch (previewMode) {
            case 'mobile':
                return { width: '375px', height: '667px' };
            case 'tablet':
                return { width: '768px', height: '1024px' };
            case 'desktop':
            default:
                return { width: '100%', height: '100%' };
        }
    };
    const generatePreviewUrl = () => {
        const baseUrl = window.location.origin;
        if (currentLesson && currentModule) {
            return `${baseUrl}/lms/module/${currentModule.id}/lesson/${currentLesson.id}?preview=true`;
        }
        return `${baseUrl}/lms/course/${course.id}?preview=true`;
    };
    if (!isOpen)
        return null;
    const dimensions = getPreviewDimensions();
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4", children: _jsxs("div", { className: "bg-white rounded-xl shadow-2xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b border-gray-200", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: "Live Preview" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "text-sm text-gray-600", children: "View as:" }), _jsxs("select", { value: viewType, onChange: (e) => setViewType(e.target.value), className: "text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "learner", children: "Learner" }), _jsx("option", { value: "instructor", children: "Instructor" })] })] })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("div", { className: "flex items-center bg-gray-100 rounded-lg p-1", children: [_jsx("button", { onClick: () => setPreviewMode('desktop'), className: `p-2 rounded transition-colors ${previewMode === 'desktop'
                                                ? 'bg-white text-blue-600 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'}`, title: "Desktop View", children: _jsx(Monitor, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => setPreviewMode('tablet'), className: `p-2 rounded transition-colors ${previewMode === 'tablet'
                                                ? 'bg-white text-blue-600 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'}`, title: "Tablet View", children: _jsx(Tablet, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => setPreviewMode('mobile'), className: `p-2 rounded transition-colors ${previewMode === 'mobile'
                                                ? 'bg-white text-blue-600 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'}`, title: "Mobile View", children: _jsx(Smartphone, { className: "h-4 w-4" }) })] }), _jsx("button", { onClick: () => setRefreshKey(prev => prev + 1), className: "p-2 text-gray-600 hover:text-gray-900 rounded hover:bg-gray-100 transition-colors", title: "Refresh Preview", children: _jsx(RefreshCw, { className: "h-4 w-4" }) }), _jsx("a", { href: generatePreviewUrl(), target: "_blank", rel: "noopener noreferrer", className: "p-2 text-gray-600 hover:text-gray-900 rounded hover:bg-gray-100 transition-colors", title: "Open in New Tab", children: _jsx(ExternalLink, { className: "h-4 w-4" }) }), _jsx("button", { onClick: onClose, className: "p-2 text-gray-600 hover:text-gray-900 rounded hover:bg-gray-100 transition-colors", title: "Close Preview", children: "\u2715" })] })] }), _jsx("div", { className: "flex-1 flex items-center justify-center bg-gray-100 p-4", children: _jsx("div", { className: `bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 ${previewMode === 'mobile' ? 'border-8 border-gray-800' :
                            previewMode === 'tablet' ? 'border-4 border-gray-600' : ''}`, style: {
                            width: dimensions.width,
                            height: dimensions.height,
                            maxWidth: '100%',
                            maxHeight: '100%'
                        }, children: _jsx("iframe", { src: generatePreviewUrl(), className: "w-full h-full border-0", title: "Course Preview", sandbox: "allow-same-origin allow-scripts allow-forms" }, refreshKey) }) }), _jsx("div", { className: "p-4 border-t border-gray-200 bg-gray-50", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4 text-sm text-gray-600", children: [_jsxs("span", { children: ["\uD83D\uDCF1 ", previewMode.charAt(0).toUpperCase() + previewMode.slice(1), " Preview"] }), _jsx("span", { children: "\u2022" }), _jsxs("span", { children: ["\uD83D\uDC64 ", viewType.charAt(0).toUpperCase() + viewType.slice(1), " View"] }), currentLesson && (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u2022" }), _jsxs("span", { children: ["\uD83D\uDCD6 ", currentLesson.title] })] }))] }), _jsxs("div", { className: "flex items-center space-x-2 text-xs text-gray-500", children: [_jsx("div", { className: "w-2 h-2 bg-green-500 rounded-full animate-pulse" }), _jsx("span", { children: "Live Preview" })] })] }) })] }) }));
};
export default LivePreview;
