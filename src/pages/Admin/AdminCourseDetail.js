import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { courseStore } from '../../store/courseStore';
import { syncCourseToDatabase, CourseValidationError } from '../../dal/courses';
import { useToast } from '../../context/ToastContext';
// Removed unused UI imports to satisfy lints
import { ArrowLeft, Edit, Eye, Clock, Award, Calendar, CheckCircle, Play, FileText, Video, MessageSquare, Download, Star, BarChart3, Settings, Copy, Share, BookOpen, Target, AlertTriangle, Info, } from 'lucide-react';
const AdminCourseDetail = () => {
    const { courseId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [viewMode, setViewMode] = useState(searchParams.get('viewMode') === 'learner' ? 'learner' : 'admin');
    // Get course from store
    const course = courseId ? courseStore.getCourse(courseId) : null;
    const persistCourse = async (inputCourse, statusOverride) => {
        const prepared = {
            ...inputCourse,
            status: statusOverride ?? inputCourse.status ?? 'draft',
            lastUpdated: new Date().toISOString(),
            publishedDate: statusOverride === 'published'
                ? inputCourse.publishedDate || new Date().toISOString()
                : inputCourse.publishedDate,
        };
        const snapshot = await syncCourseToDatabase(prepared);
        const finalCourse = (snapshot ?? prepared);
        courseStore.saveCourse(finalCourse, { skipRemoteSync: true });
        return finalCourse;
    };
    const handleDuplicateCourse = async () => {
        if (!course)
            return;
        try {
            const newId = `course-${Date.now()}`;
            const cloned = {
                ...course,
                id: newId,
                title: `${course.title} (Copy)`,
                createdDate: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                enrollments: 0,
                completions: 0,
                completionRate: 0,
            };
            const persistedClone = await persistCourse(cloned);
            showToast('Course duplicated successfully.', 'success');
            navigate(`/admin/course-builder/${persistedClone.id}`);
        }
        catch (error) {
            if (error instanceof CourseValidationError) {
                showToast(`Duplicate failed: ${error.issues.join(' • ')}`, 'error');
            }
            else {
                console.warn('Duplicate failed', error);
                showToast('Unable to duplicate course right now.', 'error');
            }
        }
    };
    if (!course) {
        return (_jsxs("div", { className: "p-6 max-w-4xl mx-auto text-center", children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900 mb-4", children: "Course Not Found" }), _jsx("p", { className: "text-gray-600 mb-6", children: "The course you're looking for doesn't exist or has been removed." }), _jsxs(Link, { to: "/admin/courses", className: "inline-flex items-center text-orange-500 hover:text-orange-600 font-medium", children: [_jsx(ArrowLeft, { className: "h-4 w-4 mr-2" }), "Back to Course Management"] })] }));
    }
    const getStatusColor = (status) => {
        switch (status) {
            case 'published':
                return 'bg-green-100 text-green-800';
            case 'draft':
                return 'bg-yellow-100 text-yellow-800';
            case 'archived':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    const getDifficultyColor = (difficulty) => {
        switch (difficulty) {
            case 'Beginner':
                return 'bg-blue-100 text-blue-800';
            case 'Intermediate':
                return 'bg-yellow-100 text-yellow-800';
            case 'Advanced':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    const getLessonIcon = (type) => {
        switch (type) {
            case 'video':
                return _jsx(Video, { className: "h-5 w-5 text-blue-500" });
            case 'interactive':
                return _jsx(MessageSquare, { className: "h-5 w-5 text-green-500" });
            case 'quiz':
                return _jsx(CheckCircle, { className: "h-5 w-5 text-orange-500" });
            case 'download':
                return _jsx(FileText, { className: "h-5 w-5 text-purple-500" });
            default:
                return _jsx(BookOpen, { className: "h-5 w-5 text-gray-500" });
        }
    };
    const totalLessons = (course.modules ?? []).reduce((acc, module) => acc + (module.lessons?.length ?? 0), 0);
    const totalDuration = (course.modules ?? []).reduce((acc, module) => {
        const moduleDuration = (module.lessons ?? []).reduce((lessonAcc, lesson) => {
            const minutesStr = (lesson.duration ?? '0').toString().split(' ')[0];
            const minutes = parseInt(minutesStr || '0');
            return lessonAcc + (isNaN(minutes) ? 0 : minutes);
        }, 0);
        return acc + moduleDuration;
    }, 0);
    return (_jsxs("div", { className: "container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6", children: [_jsxs("div", { className: "mb-8", children: [_jsxs(Link, { to: "/admin/courses", className: "inline-flex items-center mb-4 font-medium text-[var(--hud-orange)] hover:opacity-80", children: [_jsx(ArrowLeft, { className: "h-4 w-4 mr-2" }), "Back to Course Management"] }), _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center space-x-3 mb-2", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900", children: course.title }), _jsx("span", { className: `px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(course.status)}`, children: course.status }), _jsx("span", { className: `px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(course.difficulty)}`, children: course.difficulty })] }), _jsx("p", { className: "text-gray-600 text-lg mb-4", children: course.description }), _jsxs("div", { className: "flex items-center space-x-4 mb-4", children: [_jsx("span", { className: "text-sm font-medium text-gray-700", children: "View Mode:" }), _jsxs("div", { className: "flex items-center bg-gray-100 rounded-lg p-1", children: [_jsxs("button", { onClick: () => setViewMode('admin'), className: `px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${viewMode === 'admin'
                                                            ? 'bg-white text-gray-900 shadow-sm'
                                                            : 'text-gray-600 hover:text-gray-900'}`, children: [_jsx(Settings, { className: "h-4 w-4 mr-1 inline" }), "Admin Preview"] }), _jsxs("button", { onClick: () => setViewMode('learner'), className: `px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${viewMode === 'learner'
                                                            ? 'bg-white text-gray-900 shadow-sm'
                                                            : 'text-gray-600 hover:text-gray-900'}`, children: [_jsx(Eye, { className: "h-4 w-4 mr-1 inline" }), "Learner View"] })] })] })] }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs(Link, { to: `/admin/course-builder/${course.id}`, className: "btn-cta px-4 py-2 rounded-lg flex items-center space-x-2", children: [_jsx(Edit, { className: "h-4 w-4" }), _jsx("span", { children: "Edit Course" })] }), _jsxs("button", { onClick: () => void handleDuplicateCourse(), className: "btn-outline px-4 py-2 rounded-lg flex items-center space-x-2", children: [_jsx(Copy, { className: "h-4 w-4" }), _jsx("span", { children: "Duplicate" })] }), _jsxs("button", { onClick: () => {
                                            try {
                                                const link = `${window.location.origin}/courses/${course.id}`;
                                                navigator.clipboard?.writeText(link).then(() => console.log('Link copied:', link)).catch(() => console.log('Copy not supported'));
                                            }
                                            catch (err) {
                                                console.warn('Share failed', err);
                                            }
                                        }, className: "btn-outline px-4 py-2 rounded-lg flex items-center space-x-2", children: [_jsx(Share, { className: "h-4 w-4" }), _jsx("span", { children: "Copy Link" })] })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-8", children: [_jsxs("div", { className: "lg:col-span-2 space-y-8", children: [_jsxs("div", { className: "card-lg overflow-hidden", children: [_jsx("img", { src: course.thumbnail, alt: course.title, className: "w-full h-64 object-cover" }), _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 mb-6", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-blue-600", children: totalLessons }), _jsx("div", { className: "text-sm text-gray-600", children: "Lessons" })] }), _jsxs("div", { className: "text-center", children: [_jsxs("div", { className: "text-2xl font-bold text-green-600", children: [totalDuration, "m"] }), _jsx("div", { className: "text-sm text-gray-600", children: "Duration" })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-orange-600", children: course.enrollments }), _jsx("div", { className: "text-sm text-gray-600", children: "Enrolled" })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-purple-600", children: course.avgRating }), _jsx("div", { className: "text-sm text-gray-600", children: "Rating" })] })] }), viewMode === 'admin' && (_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-2", children: [_jsx(Info, { className: "h-5 w-5 text-blue-500" }), _jsx("span", { className: "font-medium text-blue-900", children: "Admin Information" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-blue-700", children: "Created by:" }), _jsx("span", { className: "font-medium text-blue-900 ml-2", children: course.createdBy })] }), _jsxs("div", { children: [_jsx("span", { className: "text-blue-700", children: "Created:" }), _jsx("span", { className: "font-medium text-blue-900 ml-2", children: new Date(course.createdDate ?? new Date().toISOString()).toLocaleDateString() })] }), _jsxs("div", { children: [_jsx("span", { className: "text-blue-700", children: "Last Updated:" }), _jsx("span", { className: "font-medium text-blue-900 ml-2", children: new Date(course.lastUpdated ?? new Date().toISOString()).toLocaleDateString() })] }), course.publishedDate && (_jsxs("div", { children: [_jsx("span", { className: "text-blue-700", children: "Published:" }), _jsx("span", { className: "font-medium text-blue-900 ml-2", children: new Date(course.publishedDate).toLocaleDateString() })] }))] })] })), _jsx("div", { className: "flex flex-wrap gap-2", children: (course.tags ?? []).map((tag, index) => (_jsx("span", { className: "bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm", children: tag }, index))) })] })] }), _jsxs("div", { className: "card-lg", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-4", children: "Learning Objectives" }), _jsx("ul", { className: "space-y-3", children: (course.learningObjectives ?? []).map((objective, index) => (_jsxs("li", { className: "flex items-start space-x-3", children: [_jsx(Target, { className: "h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" }), _jsx("span", { className: "text-gray-700", children: objective })] }, index))) })] }), _jsxs("div", { className: "card-lg", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-6", children: "Course Content" }), _jsx("div", { className: "space-y-6", children: (course.modules ?? []).map((module, _moduleIndex) => (_jsxs("div", { className: "border border-gray-200 rounded-lg p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsxs("h3", { className: "text-lg font-bold text-gray-900", children: ["Module ", module.order, ": ", module.title] }), _jsx("p", { className: "text-gray-600", children: module.description })] }), _jsxs("div", { className: "text-sm text-gray-600 flex items-center", children: [_jsx(Clock, { className: "h-4 w-4 mr-1" }), module.duration] })] }), _jsx("div", { className: "space-y-3", children: module.lessons.map((lesson, _lessonIndex) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded-lg", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("div", { className: "flex items-center justify-center w-8 h-8 bg-white rounded-full border border-gray-200", children: getLessonIcon(lesson.type) }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900", children: lesson.title }), _jsxs("div", { className: "flex items-center space-x-4 text-sm text-gray-600", children: [_jsxs("span", { className: "flex items-center", children: [_jsx(Clock, { className: "h-3 w-3 mr-1" }), lesson.duration] }), _jsx("span", { className: "capitalize", children: lesson.type })] })] })] }), viewMode === 'admin' && (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { onClick: () => {
                                                                            try {
                                                                                const lessonUrl = `/courses/${course.id}/modules/${module.id}/lessons/${lesson.id}`;
                                                                                window.open(lessonUrl, '_blank');
                                                                            }
                                                                            catch (err) {
                                                                                console.warn('Preview failed', err);
                                                                            }
                                                                        }, className: "p-1 text-blue-600 hover:text-blue-800", title: "Preview Lesson", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => navigate(`/admin/course-builder/${course.id}?module=${module.id}&lesson=${lesson.id}`), className: "p-1 text-gray-600 hover:text-gray-800", title: "Edit Lesson", children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => navigate(`/admin/reports?courseId=${course.id}`), className: "p-1 text-gray-600 hover:text-gray-800", title: "Analytics", children: _jsx(BarChart3, { className: "h-4 w-4" }) })] })), viewMode === 'learner' && (_jsxs("button", { onClick: () => {
                                                                    try {
                                                                        const lessonUrl = `/courses/${course.id}/modules/${module.id}/lessons/${lesson.id}`;
                                                                        window.open(lessonUrl, '_blank');
                                                                    }
                                                                    catch (err) {
                                                                        console.warn('Start failed', err);
                                                                    }
                                                                }, className: "btn-cta px-4 py-2 rounded-lg flex items-center space-x-2", children: [_jsx(Play, { className: "h-4 w-4" }), _jsx("span", { children: "Start" })] }))] }, lesson.id))) })] }, module.id))) })] }), course.prerequisites && course.prerequisites.length > 0 && (_jsxs("div", { className: "card-lg", children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 mb-4", children: "Prerequisites" }), _jsx("ul", { className: "space-y-2", children: course.prerequisites.map((prerequisite, index) => (_jsxs("li", { className: "flex items-center space-x-3", children: [_jsx(AlertTriangle, { className: "h-4 w-4 text-yellow-500 flex-shrink-0" }), _jsx("span", { className: "text-gray-700", children: prerequisite })] }, index))) })] }))] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "card-lg", children: [_jsx("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Course Information" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Duration:" }), _jsx("span", { className: "font-medium text-gray-900", children: course.estimatedTime })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Difficulty:" }), _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(course.difficulty)}`, children: course.difficulty })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Due Date:" }), _jsxs("span", { className: "font-medium text-gray-900 flex items-center", children: [_jsx(Calendar, { className: "h-4 w-4 mr-1 text-orange-500" }), course.dueDate ? new Date(course.dueDate).toLocaleDateString() : '—'] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Enrolled:" }), _jsxs("span", { className: "font-medium text-gray-900", children: [course.enrollments, " learners"] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Completion Rate:" }), _jsxs("span", { className: "font-medium text-green-600", children: [course.completionRate, "%"] })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Average Rating:" }), _jsxs("div", { className: "flex items-center space-x-1", children: [_jsx(Star, { className: "h-4 w-4 text-yellow-400 fill-current" }), _jsx("span", { className: "font-medium text-gray-900", children: course.avgRating }), _jsxs("span", { className: "text-sm text-gray-500", children: ["(", course.totalRatings, ")"] })] })] })] })] }), course.certification && course.certification.available && (_jsxs("div", { className: "card-lg", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-4", children: [_jsx(Award, { className: "h-5 w-5 text-orange-500" }), _jsx("h3", { className: "text-lg font-bold text-gray-900", children: "Certification" })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: course.certification.name }), _jsxs("p", { className: "text-sm text-gray-600", children: ["Valid for ", course.certification.validFor] }), course.certification.renewalRequired && (_jsx("p", { className: "text-xs text-yellow-600 mt-1", children: "Renewal required" }))] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Requirements:" }), _jsx("ul", { className: "space-y-1", children: course.certification.requirements.map((requirement, index) => (_jsxs("li", { className: "flex items-start space-x-2", children: [_jsx(CheckCircle, { className: "h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" }), _jsx("span", { className: "text-sm text-gray-700", children: requirement })] }, index))) })] })] })] })), viewMode === 'admin' && (_jsxs("div", { className: "card-lg", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-4", children: [_jsx(BarChart3, { className: "h-5 w-5 text-blue-500" }), _jsx("h3", { className: "text-lg font-bold text-gray-900", children: "Performance Analytics" })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Completion Progress" }), _jsxs("span", { className: "text-sm font-medium text-gray-900", children: [course.completionRate, "%"] })] }), _jsx("div", { className: "w-full bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "h-2 rounded-full", style: { width: `${course.completionRate}%`, background: 'var(--gradient-blue-green)' } }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4 text-center", children: [_jsxs("div", { className: "bg-green-50 p-3 rounded-lg", children: [_jsx("div", { className: "text-lg font-bold text-green-600", children: course.completions }), _jsx("div", { className: "text-xs text-green-700", children: "Completed" })] }), _jsxs("div", { className: "bg-blue-50 p-3 rounded-lg", children: [_jsx("div", { className: "text-lg font-bold text-blue-600", children: (course.enrollments ?? 0) - (course.completions ?? 0) }), _jsx("div", { className: "text-xs text-blue-700", children: "In Progress" })] })] }), _jsx("button", { className: "w-full btn-outline py-2 rounded-lg text-sm", children: "View Detailed Analytics" })] })] })), viewMode === 'learner' && (_jsxs("div", { className: "rounded-xl p-6", style: { background: 'var(--gradient-banner)' }, children: [_jsx("h3", { className: "text-lg font-bold text-gray-900 mb-4", children: "Ready to Start Learning?" }), _jsx("p", { className: "text-gray-600 mb-6", children: "This course will help you develop essential inclusive leadership skills through interactive lessons, real-world scenarios, and practical exercises." }), _jsxs("div", { className: "flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3", children: [_jsxs("button", { className: "btn-cta px-6 py-3 rounded-lg flex items-center justify-center space-x-2", children: [_jsx(Play, { className: "h-5 w-5" }), _jsx("span", { children: "Start Course" })] }), _jsxs("button", { className: "border border-orange-500 text-orange-500 px-6 py-3 rounded-lg hover:bg-orange-500 hover:text-white transition-all duration-200 flex items-center justify-center space-x-2", children: [_jsx(Download, { className: "h-5 w-5" }), _jsx("span", { children: "Download Syllabus" })] })] })] }))] })] })] }));
};
export default AdminCourseDetail;
