import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
// import { useNavigate, useLocation } from 'react-router-dom'; // TODO: Implement when needed
import { ChevronDown, ChevronRight, CheckCircle, Circle, Play, Clock, FileText, Video, HelpCircle, Download, Trophy, Lock, X, Menu } from 'lucide-react';
const CourseProgressSidebar = ({ course, currentLessonId, lessonProgress, onLessonSelect, collapsed = false, onCollapsedChange, className = '' }) => {
    // const navigate = useNavigate(); // TODO: Implement navigation features
    // const location = useLocation(); // TODO: Implement location-based features
    const [expandedModules, setExpandedModules] = useState({});
    const [isMobile, setIsMobile] = useState(false);
    // Initialize expanded state
    useEffect(() => {
        if (course?.modules) {
            const initialExpanded = {};
            // Expand module containing current lesson
            course.modules.forEach(module => {
                const hasCurrentLesson = module.lessons.some(lesson => lesson.id === currentLessonId);
                if (hasCurrentLesson) {
                    initialExpanded[module.id] = true;
                }
                else {
                    initialExpanded[module.id] = false;
                }
            });
            setExpandedModules(initialExpanded);
        }
    }, [course, currentLessonId]);
    // Handle responsive behavior
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const toggleModuleExpansion = (moduleId) => {
        setExpandedModules(prev => ({
            ...prev,
            [moduleId]: !prev[moduleId]
        }));
    };
    const getLessonIcon = (lesson) => {
        switch (lesson.type) {
            case 'video':
                return _jsx(Video, { className: "h-4 w-4" });
            case 'interactive':
                return _jsx(HelpCircle, { className: "h-4 w-4" });
            case 'quiz':
                return _jsx(Circle, { className: "h-4 w-4" });
            case 'resource':
                return _jsx(Download, { className: "h-4 w-4" });
            case 'text':
                return _jsx(FileText, { className: "h-4 w-4" });
            default:
                return _jsx(Circle, { className: "h-4 w-4" });
        }
    };
    const getLessonStatusIcon = (lesson) => {
        const progress = lessonProgress[lesson.id];
        if (lesson.isLocked) {
            return _jsx(Lock, { className: "h-4 w-4 text-gray-400" });
        }
        if (progress?.completed) {
            return _jsx(CheckCircle, { className: "h-4 w-4 text-green-500" });
        }
        if (progress && progress.progressPercentage > 0) {
            return (_jsxs("div", { className: "relative w-4 h-4", children: [_jsx(Circle, { className: "h-4 w-4 text-gray-300" }), _jsx("div", { className: "absolute top-0 left-0 w-4 h-4 rounded-full border-2 border-orange-500", style: {
                            clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos((progress.progressPercentage * 3.6 - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((progress.progressPercentage * 3.6 - 90) * Math.PI / 180)}%, 50% 50%)`
                        } })] }));
        }
        return _jsx(Circle, { className: "h-4 w-4 text-gray-300" });
    };
    const calculateModuleProgress = (module) => {
        if (!module.lessons.length)
            return 0;
        const completedLessons = module.lessons.filter(lesson => lessonProgress[lesson.id]?.completed).length;
        return Math.round((completedLessons / module.lessons.length) * 100);
    };
    const calculateOverallProgress = () => {
        if (!course?.modules?.length)
            return 0;
        const totalLessons = course.modules.reduce((acc, module) => acc + module.lessons.length, 0);
        const completedLessons = course.modules.reduce((acc, module) => acc + module.lessons.filter(lesson => lessonProgress[lesson.id]?.completed).length, 0);
        return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    };
    const handleLessonClick = (moduleId, lesson) => {
        if (lesson.isLocked)
            return;
        onLessonSelect(moduleId, lesson.id);
        // On mobile, collapse sidebar after selection
        if (isMobile && onCollapsedChange) {
            onCollapsedChange(true);
        }
    };
    const overallProgress = calculateOverallProgress();
    if (collapsed && !isMobile) {
        return (_jsxs("div", { className: `w-16 bg-white border-r border-gray-200 ${className}`, children: [_jsx("div", { className: "p-4", children: _jsx("button", { onClick: () => onCollapsedChange?.(false), className: "w-full flex justify-center text-gray-600 hover:text-gray-900", title: "Expand course outline", children: _jsx(Menu, { className: "h-5 w-5" }) }) }), _jsxs("div", { className: "px-2", children: [_jsx("div", { className: "w-full bg-gray-200 rounded-full h-2 mb-2", children: _jsx("div", { className: "h-2 rounded-full transition-all duration-300", style: { width: `${overallProgress}%`, background: 'var(--gradient-blue-green)' } }) }), _jsxs("div", { className: "text-xs text-center text-gray-600 font-medium", children: [overallProgress, "%"] })] }), _jsx("div", { className: "mt-4 px-2 space-y-2", children: course?.modules?.map((module, index) => {
                        const moduleProgress = calculateModuleProgress(module);
                        const hasCurrentLesson = module.lessons.some(lesson => lesson.id === currentLessonId);
                        return (_jsx("div", { className: `w-full h-8 rounded flex items-center justify-center text-xs font-medium ${hasCurrentLesson
                                ? 'bg-orange-100 text-orange-800'
                                : moduleProgress === 100
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-600'}`, title: `Module ${index + 1}: ${module.title} (${moduleProgress}% complete)`, children: index + 1 }, module.id));
                    }) })] }));
    }
    return (_jsxs("div", { className: `w-80 bg-white border-r border-gray-200 flex flex-col ${className}`, children: [_jsxs("div", { className: "p-4 border-b border-gray-200", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h2", { className: "font-semibold text-gray-900 text-lg", children: "Course Outline" }), _jsx("button", { onClick: () => onCollapsedChange?.(!collapsed), className: "text-gray-600 hover:text-gray-900", title: collapsed ? "Expand" : "Collapse", children: isMobile ? _jsx(X, { className: "h-5 w-5" }) : _jsx(X, { className: "h-5 w-5" }) })] }), _jsx("div", { className: "text-sm text-gray-600 mb-3 line-clamp-2", children: course?.title }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("span", { className: "text-gray-600", children: "Progress" }), _jsxs("span", { className: "font-medium text-gray-900", children: [overallProgress, "%"] })] }), _jsx("div", { className: "w-full bg-gray-200 rounded-full h-3 overflow-hidden", children: _jsx("div", { className: "h-3 rounded-full transition-all duration-500 relative", style: { width: `${overallProgress}%`, background: 'var(--gradient-blue-green)' }, children: overallProgress > 20 && (_jsx("div", { className: "absolute inset-0 bg-white bg-opacity-20 animate-pulse" })) }) }), overallProgress === 100 && (_jsxs("div", { className: "flex items-center justify-center text-green-600 text-sm font-medium", children: [_jsx(Trophy, { className: "h-4 w-4 mr-1" }), "Course Complete!"] }))] })] }), _jsx("div", { className: "flex-1 overflow-y-auto", children: _jsx("div", { className: "p-4 space-y-3", children: course?.modules?.map((module, moduleIndex) => {
                        const moduleProgress = calculateModuleProgress(module);
                        const isExpanded = expandedModules[module.id];
                        const hasCurrentLesson = module.lessons.some(lesson => lesson.id === currentLessonId);
                        return (_jsxs("div", { className: "border border-gray-200 rounded-lg overflow-hidden", children: [_jsx("button", { onClick: () => toggleModuleExpansion(module.id), className: `w-full p-3 text-left hover:bg-gray-50 transition-colors ${hasCurrentLesson ? 'bg-orange-50' : ''}`, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3 flex-1", children: [isExpanded ? (_jsx(ChevronDown, { className: "h-4 w-4 text-gray-600" })) : (_jsx(ChevronRight, { className: "h-4 w-4 text-gray-600" })), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "font-medium text-gray-900 text-sm", children: ["Module ", moduleIndex + 1, ": ", module.title] }), module.description && (_jsx("div", { className: "text-xs text-gray-600 mt-1 line-clamp-2", children: module.description })), _jsxs("div", { className: "flex items-center space-x-3 mt-2", children: [_jsxs("div", { className: "flex items-center text-xs text-gray-600", children: [_jsx(Clock, { className: "h-3 w-3 mr-1" }), module.duration || '~30 min'] }), _jsxs("div", { className: "text-xs text-gray-600", children: [module.lessons.length, " lesson", module.lessons.length !== 1 ? 's' : ''] })] })] })] }), _jsxs("div", { className: "flex items-center space-x-2 ml-2", children: [_jsxs("div", { className: "text-xs font-medium text-gray-600", children: [moduleProgress, "%"] }), _jsx("div", { className: "w-12 bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "h-2 rounded-full transition-all duration-300", style: { width: `${moduleProgress}%`, background: moduleProgress === 100 ? 'var(--hud-green)' : 'var(--gradient-blue-green)' } }) })] })] }) }), isExpanded && (_jsx("div", { className: "border-t border-gray-200 bg-gray-50", children: module.lessons.map((lesson, lessonIndex) => {
                                        const isCurrentLesson = lesson.id === currentLessonId;
                                        const progress = lessonProgress[lesson.id];
                                        return (_jsx("button", { onClick: () => handleLessonClick(module.id, lesson), disabled: lesson.isLocked, className: `w-full p-3 text-left hover:bg-white transition-colors border-b border-gray-200 last:border-b-0 ${isCurrentLesson ? 'bg-orange-100 border-orange-200' : ''} ${lesson.isLocked ? 'cursor-not-allowed opacity-60' : ''}`, children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [getLessonStatusIcon(lesson), getLessonIcon(lesson)] }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: `text-sm font-medium ${isCurrentLesson ? 'text-orange-900' : 'text-gray-900'}`, children: [lessonIndex + 1, ". ", lesson.title] }), _jsxs("div", { className: "flex items-center space-x-3 mt-1", children: [_jsx("div", { className: "text-xs text-gray-600", children: lesson.duration || '5 min' }), progress && progress.progressPercentage > 0 && !progress.completed && (_jsxs("div", { className: "text-xs text-orange-600 font-medium", children: [progress.progressPercentage, "% complete"] })), progress?.completed && (_jsx("div", { className: "text-xs text-green-600 font-medium", children: "Completed" }))] })] }), isCurrentLesson && (_jsx("div", { className: "flex items-center text-orange-600", children: _jsx(Play, { className: "h-4 w-4" }) }))] }) }, lesson.id));
                                    }) }))] }, module.id));
                    }) }) }), _jsx("div", { className: "p-4 border-t border-gray-200 bg-gray-50", children: _jsxs("div", { className: "flex items-center justify-between text-sm text-gray-600", children: [_jsxs("span", { children: [course?.modules?.reduce((acc, m) => acc + m.lessons.filter(l => lessonProgress[l.id]?.completed).length, 0) || 0, " of", ' ', course?.modules?.reduce((acc, m) => acc + m.lessons.length, 0) || 0, " lessons complete"] }), overallProgress === 100 && (_jsxs("button", { className: "text-green-600 hover:text-green-700 font-medium flex items-center space-x-1", children: [_jsx(Trophy, { className: "h-4 w-4" }), _jsx("span", { children: "View Certificate" })] }))] }) })] }));
};
export default CourseProgressSidebar;
