import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { History, RotateCcw, GitBranch, Clock, User, CheckCircle, AlertCircle } from 'lucide-react';
const VersionControl = ({ course, onRestore }) => {
    const [versions, setVersions] = useState([]);
    const [showDiff, setShowDiff] = useState(null);
    // Auto-save version when course changes significantly
    useEffect(() => {
        if (course.id && course.title) {
            const existingVersions = JSON.parse(localStorage.getItem(`course-versions-${course.id}`) || '[]');
            // Check if this is a significant change
            const lastVersion = existingVersions[0];
            const isSignificantChange = !lastVersion ||
                lastVersion.course.title !== course.title ||
                (lastVersion.course.modules?.length || 0) !== (course.modules?.length || 0) ||
                JSON.stringify(lastVersion.course.learningObjectives) !== JSON.stringify(course.learningObjectives);
            if (isSignificantChange) {
                const newVersion = {
                    id: `version-${Date.now()}`,
                    timestamp: Date.now(),
                    course: { ...course },
                    changeDescription: getChangeDescription(lastVersion?.course, course),
                    changedBy: 'Mya Dennis',
                    changeType: getChangeType(lastVersion?.course, course)
                };
                const updatedVersions = [newVersion, ...existingVersions.slice(0, 9)]; // Keep last 10 versions
                localStorage.setItem(`course-versions-${course.id}`, JSON.stringify(updatedVersions));
                setVersions(updatedVersions);
            }
            else {
                setVersions(existingVersions);
            }
        }
    }, [course]);
    const getChangeDescription = (oldCourse, newCourse) => {
        if (!oldCourse)
            return 'Course created';
        const changes = [];
        if (oldCourse.title !== newCourse.title)
            changes.push('title updated');
        if (oldCourse.description !== newCourse.description)
            changes.push('description modified');
        if ((oldCourse.modules?.length || 0) !== (newCourse.modules?.length || 0)) {
            changes.push(`modules count: ${oldCourse.modules?.length || 0} → ${newCourse.modules?.length || 0}`);
        }
        if (JSON.stringify(oldCourse.learningObjectives) !== JSON.stringify(newCourse.learningObjectives)) {
            changes.push('learning objectives updated');
        }
        return changes.length > 0 ? changes.join(', ') : 'minor updates';
    };
    const getChangeType = (oldCourse, newCourse) => {
        if (!oldCourse)
            return 'create';
        if ((oldCourse.modules?.length || 0) !== (newCourse.modules?.length || 0))
            return 'structure';
        if (oldCourse.title !== newCourse.title || oldCourse.description !== newCourse.description)
            return 'content';
        if (oldCourse.status !== newCourse.status || oldCourse.difficulty !== newCourse.difficulty)
            return 'settings';
        return 'update';
    };
    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        if (diffHours < 1)
            return 'Just now';
        if (diffHours < 24)
            return `${diffHours}h ago`;
        if (diffDays < 7)
            return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };
    const getChangeTypeIcon = (type) => {
        switch (type) {
            case 'create': return _jsx(CheckCircle, { className: "h-4 w-4 text-green-500" });
            case 'structure': return _jsx(GitBranch, { className: "h-4 w-4 text-blue-500" });
            case 'content': return _jsx(AlertCircle, { className: "h-4 w-4 text-orange-500" });
            case 'settings': return _jsx(CheckCircle, { className: "h-4 w-4 text-purple-500" });
            default: return _jsx(Clock, { className: "h-4 w-4 text-gray-500" });
        }
    };
    const getChangeTypeColor = (type) => {
        switch (type) {
            case 'create': return 'bg-green-50 border-green-200';
            case 'structure': return 'bg-blue-50 border-blue-200';
            case 'content': return 'bg-orange-50 border-orange-200';
            case 'settings': return 'bg-purple-50 border-purple-200';
            default: return 'bg-gray-50 border-gray-200';
        }
    };
    const handleRestore = (version) => {
        if (window.confirm(`Are you sure you want to restore to this version from ${formatTimestamp(version.timestamp)}? All current changes will be lost.`)) {
            onRestore(version);
        }
    };
    return (_jsxs("div", { className: "bg-white rounded-xl shadow-sm border border-gray-200 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "p-2 bg-blue-100 rounded-lg", children: _jsx(History, { className: "h-6 w-6 text-blue-600" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: "Version History" }), _jsx("p", { className: "text-sm text-gray-600", children: "Track changes and restore previous versions" })] })] }), _jsxs("span", { className: "text-sm text-gray-500", children: [versions.length, " versions saved"] })] }), _jsx("div", { className: "space-y-3", children: versions.length === 0 ? (_jsxs("div", { className: "text-center py-8", children: [_jsx(GitBranch, { className: "h-12 w-12 text-gray-300 mx-auto mb-3" }), _jsx("p", { className: "text-gray-500", children: "No version history yet" }), _jsx("p", { className: "text-sm text-gray-400", children: "Changes will be automatically tracked" })] })) : (versions.map((version, index) => (_jsxs("div", { className: `border rounded-lg p-4 transition-all hover:shadow-sm ${index === 0 ? 'ring-2 ring-blue-100 bg-blue-50/50' : getChangeTypeColor(version.changeType)}`, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-2", children: [getChangeTypeIcon(version.changeType), _jsx("span", { className: "font-medium text-gray-900", children: index === 0 ? 'Current Version' : `Version ${versions.length - index}` }), _jsx("span", { className: "text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full capitalize", children: version.changeType }), index === 0 && (_jsx("span", { className: "text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full", children: "Active" }))] }), _jsx("p", { className: "text-sm text-gray-700 mb-2", children: version.changeDescription }), _jsxs("div", { className: "flex items-center space-x-4 text-xs text-gray-500", children: [_jsxs("span", { className: "flex items-center space-x-1", children: [_jsx(User, { className: "h-3 w-3" }), _jsx("span", { children: version.changedBy })] }), _jsxs("span", { className: "flex items-center space-x-1", children: [_jsx(Clock, { className: "h-3 w-3" }), _jsx("span", { children: formatTimestamp(version.timestamp) })] })] })] }), index > 0 && (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs("button", { onClick: () => setShowDiff(showDiff === version.id ? null : version.id), className: "text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors", children: [showDiff === version.id ? 'Hide' : 'View', " Changes"] }), _jsxs("button", { onClick: () => handleRestore(version), className: "flex items-center space-x-1 text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors", children: [_jsx(RotateCcw, { className: "h-3 w-3" }), _jsx("span", { children: "Restore" })] })] }))] }), showDiff === version.id && (_jsx("div", { className: "mt-4 pt-4 border-t border-gray-200", children: _jsxs("div", { className: "bg-gray-50 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Changes in this version:" }), _jsx("div", { className: "space-y-2 text-sm", children: _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("span", { className: "font-medium text-gray-700", children: "Title:" }), _jsx("p", { className: "text-gray-600 truncate", children: version.course.title })] }), _jsxs("div", { children: [_jsx("span", { className: "font-medium text-gray-700", children: "Modules:" }), _jsxs("p", { className: "text-gray-600", children: [version.course.modules?.length || 0, " modules"] })] }), _jsxs("div", { children: [_jsx("span", { className: "font-medium text-gray-700", children: "Status:" }), _jsx("p", { className: "text-gray-600 capitalize", children: version.course.status })] }), _jsxs("div", { children: [_jsx("span", { className: "font-medium text-gray-700", children: "Duration:" }), _jsx("p", { className: "text-gray-600", children: version.course.duration })] })] }) })] }) }))] }, version.id)))) }), versions.length > 0 && (_jsxs("div", { className: "mt-6 p-4 bg-blue-50 rounded-lg", children: [_jsxs("div", { className: "flex items-center space-x-2 text-blue-700 mb-2", children: [_jsx(History, { className: "h-4 w-4" }), _jsx("span", { className: "font-medium text-sm", children: "Auto-Save Enabled" })] }), _jsx("p", { className: "text-sm text-blue-600", children: "Versions are automatically saved when you make significant changes. Up to 10 versions are kept." })] }))] }));
};
export default VersionControl;
