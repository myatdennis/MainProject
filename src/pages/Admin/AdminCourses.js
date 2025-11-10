import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { courseStore } from '../../store/courseStore';
import { syncCourseToDatabase, CourseValidationError } from '../../dal/courses';
import { BookOpen, Plus, Search, Filter, Edit, Copy, Trash2, Eye, Users, Clock, Play, FileText, Video, BarChart3, Settings, Upload, Download, UserPlus } from 'lucide-react';
import LoadingButton from '../../components/LoadingButton';
import ConfirmationModal from '../../components/ConfirmationModal';
import CourseEditModal from '../../components/CourseEditModal';
import { useToast } from '../../context/ToastContext';
import { useSyncService } from '../../dal/sync';
import { slugify } from '../../utils/courseNormalization';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
const AdminCourses = () => {
    const { showToast } = useToast();
    const syncService = useSyncService();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedCourses, setSelectedCourses] = useState([]);
    const [version, setVersion] = useState(0); // bump to force re-render when store changes
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    // Get courses from store (re-read when version changes)
    const courses = useMemo(() => courseStore.getAllCourses(), [version]);
    // Ensure course store refreshes on landing (always fetch & merge latest)
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                if (typeof courseStore.init === 'function') {
                    setLoading(true);
                    await courseStore.init();
                    if (!active)
                        return;
                    setVersion((v) => v + 1);
                }
            }
            catch (err) {
                console.warn('[AdminCourses] Failed to initialize course store:', err);
            }
            finally {
                if (active)
                    setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, []);
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
    const filteredCourses = courses.filter((course) => {
        const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (course.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesFilter = filterStatus === 'all' || course.status === filterStatus;
        return matchesSearch && matchesFilter;
    });
    const handleSelectCourse = (courseId) => {
        setSelectedCourses(prev => prev.includes(courseId)
            ? prev.filter(id => id !== courseId)
            : [...prev, courseId]);
    };
    const handleSelectAll = () => {
        if (selectedCourses.length === filteredCourses.length) {
            setSelectedCourses([]);
        }
        else {
            setSelectedCourses(filteredCourses.map((course) => course.id));
        }
    };
    const handleEditCourse = (course) => {
        navigate(`/admin/courses/${course.id}/edit`);
    };
    const handleCreateCourse = () => {
        setSearchParams(prev => {
            const params = new URLSearchParams(prev);
            params.set('create', '1');
            return params;
        });
        setShowCreateModal(true);
    };
    const handleAssignCourse = (course) => {
        navigate(`/admin/courses/${course.id}/assign`);
    };
    const handleCreateCourseSave = (course) => {
        const normalizedSlug = slugify(course.slug || course.title || course.id);
        const created = courseStore.createCourse({
            ...course,
            slug: normalizedSlug,
            status: course.status || 'draft',
            lastUpdated: new Date().toISOString(),
        });
        syncService.logEvent({
            type: 'course_created',
            data: created,
            timestamp: Date.now(),
        });
        showToast('Course created successfully.', 'success');
        closeCreateModal();
        refresh();
        navigate(`/admin/courses/${created.id}/details`);
    };
    const closeCreateModal = () => {
        setShowCreateModal(false);
        setSearchParams(prev => {
            const params = new URLSearchParams(prev);
            params.delete('create');
            return params;
        });
    };
    useEffect(() => {
        if (searchParams.get('create') === '1') {
            setShowCreateModal(true);
        }
    }, [searchParams]);
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
    const getTypeIcon = (type) => {
        switch (type) {
            case 'video':
                return _jsx(Video, { className: "h-4 w-4" });
            case 'interactive':
                return _jsx(Play, { className: "h-4 w-4" });
            case 'worksheet':
                return _jsx(FileText, { className: "h-4 w-4" });
            case 'case-study':
                return _jsx(BookOpen, { className: "h-4 w-4" });
            default:
                return _jsx(BookOpen, { className: "h-4 w-4" });
        }
    };
    const getTypeColor = (type) => {
        switch (type) {
            case 'video':
                return 'text-blue-600 bg-blue-50';
            case 'interactive':
                return 'text-green-600 bg-green-50';
            case 'worksheet':
                return 'text-orange-600 bg-orange-50';
            case 'case-study':
                return 'text-purple-600 bg-purple-50';
            default:
                return 'text-gray-600 bg-gray-50';
        }
    };
    const duplicateCourse = async (courseId) => {
        const original = courseStore.getCourse(courseId);
        if (!original)
            return;
        // Create a shallow clone with a new id and title
        const newId = `course-${Date.now()}`;
        const cloned = {
            ...original,
            id: newId,
            title: `${original.title} (Copy)`,
            createdDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            enrollments: 0,
            completions: 0,
            completionRate: 0,
        };
        // Save to store and navigate to builder
        try {
            const persistedClone = await persistCourse(cloned);
            syncService.logEvent({
                type: 'course_created',
                data: persistedClone,
                timestamp: Date.now()
            });
            setVersion(v => v + 1);
            navigate(`/admin/course-builder/${persistedClone.id}`);
            showToast('Course duplicated successfully.', 'success');
        }
        catch (err) {
            if (err instanceof CourseValidationError) {
                showToast(`Duplicate failed: ${err.issues.join(' • ')}`, 'error');
            }
            else {
                console.warn('Failed to duplicate course', err);
                const errorMessage = err?.message || err?.body?.error || 'Could not duplicate course. Please try again.';
                const errorDetails = err?.body?.details;
                const fullMessage = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;
                showToast(fullMessage, 'error');
            }
        }
    };
    const refresh = () => setVersion(v => v + 1);
    const publishSelected = async () => {
        if (selectedCourses.length === 0) {
            showToast('No courses selected', 'error');
            return;
        }
        setLoading(true);
        try {
            const publishResults = await Promise.allSettled(selectedCourses.map(async (id) => {
                const existing = courseStore.getCourse(id);
                if (!existing) {
                    return null;
                }
                const updated = {
                    ...existing,
                    status: 'published',
                    publishedDate: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                };
                const persisted = await persistCourse(updated, 'published');
                syncService.logEvent({
                    type: 'course_updated',
                    data: persisted,
                    timestamp: Date.now(),
                });
                return persisted;
            }));
            const successes = publishResults.filter((result) => result.status === 'fulfilled').length;
            const validationErrors = publishResults
                .filter((result) => result.status === 'rejected' && result.reason instanceof CourseValidationError)
                .map((result) => result.reason);
            if (successes > 0) {
                showToast(`${successes} course(s) published successfully!`, 'success');
            }
            if (validationErrors.length > 0) {
                const messages = Array.from(new Set(validationErrors.flatMap((error) => error.issues)));
                showToast(`Some courses failed validation: ${messages.join(' • ')}`, 'error');
            }
            setSelectedCourses([]);
            refresh();
        }
        catch (error) {
            showToast('Failed to publish courses', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    const exportCourses = (scope = 'selected') => {
        let toExport = filteredCourses;
        if (scope === 'selected' && selectedCourses.length > 0) {
            toExport = selectedCourses.map(id => courseStore.getCourse(id)).filter(Boolean);
        }
        else if (scope === 'all') {
            toExport = courseStore.getAllCourses();
        }
        try {
            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(toExport, null, 2));
            const dlAnchor = document.createElement('a');
            dlAnchor.setAttribute('href', dataStr);
            dlAnchor.setAttribute('download', `courses-export-${Date.now()}.json`);
            document.body.appendChild(dlAnchor);
            dlAnchor.click();
            dlAnchor.remove();
        }
        catch (err) {
            console.warn('Export failed', err);
            alert('Failed to export courses');
        }
    };
    const deleteCourse = (id) => {
        setCourseToDelete(id);
        setShowDeleteModal(true);
    };
    const confirmDeleteCourse = async () => {
        if (!courseToDelete)
            return;
        setLoading(true);
        try {
            courseStore.deleteCourse(courseToDelete);
            syncService.logEvent({
                type: 'course_deleted',
                data: { id: courseToDelete },
                timestamp: Date.now()
            });
            setSelectedCourses((prev) => prev.filter((x) => x !== courseToDelete));
            refresh();
            showToast('Course deleted successfully!', 'success');
            setShowDeleteModal(false);
            setCourseToDelete(null);
        }
        catch (error) {
            showToast('Failed to delete course', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    const handleImportCourses = () => {
        navigate('/admin/courses/import');
    };
    const handleExportCourses = async () => {
        setLoading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            exportCourses(selectedCourses.length > 0 ? 'selected' : 'all');
            showToast('Courses exported successfully!', 'success');
        }
        catch (error) {
            showToast('Failed to export courses', 'error');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6", children: [_jsx("div", { className: "mb-6", children: _jsx(Breadcrumbs, { items: [{ label: 'Admin', to: '/admin' }, { label: 'Courses', to: '/admin/courses' }] }) }), _jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Course Management" }), _jsx("p", { className: "text-gray-600", children: "Create, edit, and manage training modules and learning paths" })] }), _jsx("div", { className: "card-lg card-hover mb-8", children: _jsxs("div", { className: "flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0", children: [_jsxs("div", { className: "flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1", children: [_jsxs("div", { className: "relative flex-1 max-w-md", children: [_jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate/60" }), _jsx(Input, { className: "pl-9", placeholder: "Search courses...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value) })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Filter, { className: "h-5 w-5 text-gray-400" }), _jsxs("select", { value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), className: "border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--hud-orange)] focus:border-transparent", children: [_jsx("option", { value: "all", children: "All Status" }), _jsx("option", { value: "published", children: "Published" }), _jsx("option", { value: "draft", children: "Draft" }), _jsx("option", { value: "archived", children: "Archived" })] })] })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [selectedCourses.length > 0 && (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => navigate(`/admin/courses/bulk?ids=${selectedCourses.join(',')}`), children: ["Bulk Assign (", selectedCourses.length, ")"] }), _jsx(Button, { size: "sm", onClick: publishSelected, "data-test": "admin-publish-selected", children: "Publish Selected" })] })), _jsx(Button, { size: "md", onClick: handleCreateCourse, leadingIcon: _jsx(Plus, { className: "h-4 w-4" }), "data-test": "admin-new-course", children: "New Course" }), _jsx(LoadingButton, { onClick: () => navigate('/admin/courses/new'), variant: "secondary", icon: BookOpen, children: "Create Course" }), _jsx(LoadingButton, { onClick: handleImportCourses, variant: "secondary", icon: Upload, disabled: loading, children: "Import" })] })] }) }), filteredCourses.length === 0 && (_jsx("div", { className: "mb-8", children: _jsx(EmptyState, { title: "No courses found", description: searchTerm || filterStatus !== 'all'
                        ? 'Try adjusting your search or filters to find courses.'
                        : "You haven't created any courses yet. Get started by creating your first course.", action: _jsx(Button, { variant: searchTerm || filterStatus !== 'all' ? 'outline' : 'primary', onClick: () => {
                            if (searchTerm || filterStatus !== 'all') {
                                setSearchTerm('');
                                setFilterStatus('all');
                            }
                            else {
                                handleCreateCourse();
                            }
                        }, children: searchTerm || filterStatus !== 'all' ? 'Reset filters' : 'Create course' }) }) })), filteredCourses.length > 0 && (_jsx("div", { className: "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8", children: filteredCourses.map((course) => (_jsxs("div", { className: "card-lg card-hover overflow-hidden", "data-test": "admin-course-card", children: [_jsxs("div", { className: "relative", children: [_jsx("img", { src: course.thumbnail, alt: course.title, className: "w-full h-48 object-cover" }), _jsx("div", { className: "absolute top-4 left-4", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(course.status)}`, children: course.status }) }), _jsx("div", { className: "absolute top-4 right-4", children: _jsx("input", { type: "checkbox", checked: selectedCourses.includes(course.id), onChange: () => handleSelectCourse(course.id), className: "h-4 w-4 border-gray-300 rounded focus:ring-[var(--hud-orange)]" }) }), _jsx("div", { className: "absolute bottom-4 left-4", children: _jsxs("div", { className: `flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(course.type || 'Mixed')}`, children: [getTypeIcon(course.type || 'Mixed'), _jsx("span", { className: "capitalize", children: course.type })] }) })] }), _jsxs("div", { className: "p-6", children: [_jsx("h3", { className: "font-bold text-lg text-gray-900 mb-2", children: course.title }), _jsx("p", { className: "text-gray-600 text-sm mb-4 line-clamp-2", children: course.description }), _jsxs("div", { className: "flex items-center justify-between text-sm text-gray-600 mb-4", children: [_jsxs("span", { className: "flex items-center", children: [_jsx(Clock, { className: "h-4 w-4 mr-1" }), course.duration] }), _jsxs("span", { className: "flex items-center", children: [_jsx(BookOpen, { className: "h-4 w-4 mr-1" }), course.lessons, " lessons"] }), _jsxs("span", { className: "flex items-center", children: [_jsx(Users, { className: "h-4 w-4 mr-1" }), course.enrollments] })] }), course.status === 'published' && (_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "flex items-center justify-between text-sm mb-1", children: [_jsx("span", { className: "text-gray-600", children: "Completion Rate" }), _jsxs("span", { className: "font-medium text-gray-900", children: [course.completionRate, "%"] })] }), _jsx("div", { className: "w-full bg-gray-200 rounded-full h-2", children: _jsx("div", { className: "h-2 rounded-full", style: { width: `${course.completionRate}%`, background: 'var(--gradient-blue-green)' } }) })] })), _jsx("div", { className: "flex flex-wrap gap-1 mb-4", children: (course.tags || []).map((tag, index) => (_jsx("span", { className: "bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs", children: tag }, index))) }), _jsxs("div", { className: "flex items-center justify-between pt-4 border-t border-gray-200", children: [_jsxs("div", { className: "text-sm text-gray-600", children: ["Updated ", new Date(course.lastUpdated || course.createdDate || new Date().toISOString()).toLocaleDateString()] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Link, { to: `/admin/courses/${course.id}/details`, className: "p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg", title: "Preview as Participant", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => handleEditCourse(course), className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Edit Course", children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => void duplicateCourse(course.id), className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Duplicate", children: _jsx(Copy, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => handleAssignCourse(course), className: "p-2 text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded-lg", title: "Assign Course", children: _jsx(UserPlus, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => navigate(`/admin/reports?courseId=${course.id}`), className: "p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg", title: "Analytics", children: _jsx(BarChart3, { className: "h-4 w-4" }) }), _jsx(LoadingButton, { onClick: () => deleteCourse(course.id), variant: "danger", size: "sm", icon: Trash2, loading: loading && courseToDelete === course.id, disabled: loading, title: "Delete course", children: "Delete" })] })] })] })] }, course.id))) })), _jsxs("div", { className: "card-lg overflow-hidden", children: [_jsxs("div", { className: "px-6 py-4 border-b border-gray-200 flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-gray-900", children: "Course Details" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { onClick: handleSelectAll, className: "text-sm text-gray-600 hover:text-gray-900 font-medium", children: selectedCourses.length === filteredCourses.length ? 'Deselect All' : 'Select All' }), _jsx(LoadingButton, { onClick: handleExportCourses, variant: "secondary", icon: Download, loading: loading, disabled: loading, children: "Export" })] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left py-3 px-6", children: _jsx("input", { type: "checkbox", checked: selectedCourses.length === filteredCourses.length && filteredCourses.length > 0, onChange: handleSelectAll, className: "h-4 w-4 border-gray-300 rounded focus:ring-[var(--hud-orange)]" }) }), _jsx("th", { className: "text-left py-3 px-6 font-semibold text-gray-900", children: "Course" }), _jsx("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Type" }), _jsx("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Enrollments" }), _jsx("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Completion" }), _jsx("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Rating" }), _jsx("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Status" }), _jsx("th", { className: "text-center py-3 px-6 font-semibold text-gray-900", children: "Actions" })] }) }), _jsx("tbody", { children: filteredCourses.map((course) => (_jsxs("tr", { className: "border-b border-gray-100 hover:bg-gray-50", children: [_jsx("td", { className: "py-4 px-6", children: _jsx("input", { type: "checkbox", checked: selectedCourses.includes(course.id), onChange: () => handleSelectCourse(course.id), className: "h-4 w-4 border-gray-300 rounded focus:ring-[var(--hud-orange)]" }) }), _jsx("td", { className: "py-4 px-6", children: _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("img", { src: course.thumbnail, alt: course.title, className: "w-12 h-12 rounded-lg object-cover" }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-gray-900", children: course.title }), _jsxs("div", { className: "text-sm text-gray-600", children: [course.lessons, " lessons \u2022 ", course.duration] })] })] }) }), _jsx("td", { className: "py-4 px-6 text-center", children: _jsxs("div", { className: `inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(course.type || 'Mixed')}`, children: [getTypeIcon(course.type || 'Mixed'), _jsx("span", { className: "capitalize", children: course.type })] }) }), _jsxs("td", { className: "py-4 px-6 text-center", children: [_jsx("div", { className: "font-medium text-gray-900", children: course.enrollments }), _jsxs("div", { className: "text-sm text-gray-600", children: [course.completions, " completed"] })] }), _jsxs("td", { className: "py-4 px-6 text-center", children: [_jsxs("div", { className: "font-medium text-gray-900", children: [course.completionRate, "%"] }), _jsx("div", { className: "w-16 bg-gray-200 rounded-full h-1 mt-1 mx-auto", children: _jsx("div", { className: "h-1 rounded-full", style: { width: `${course.completionRate}%`, background: 'var(--gradient-blue-green)' } }) })] }), _jsx("td", { className: "py-4 px-6 text-center", children: (course.avgRating || 0) > 0 ? (_jsxs("div", { className: "flex items-center justify-center space-x-1", children: [_jsx("span", { className: "font-medium text-gray-900", children: course.avgRating }), _jsx("div", { className: "text-yellow-400", children: "\u2605" })] })) : (_jsx("span", { className: "text-gray-400", children: "-" })) }), _jsx("td", { className: "py-4 px-6 text-center", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(course.status)}`, children: course.status }) }), _jsx("td", { className: "py-4 px-6 text-center", children: _jsxs("div", { className: "flex items-center justify-center space-x-2", children: [_jsx(Link, { to: `/admin/courses/${course.id}/details?viewMode=learner`, className: "p-1 text-blue-600 hover:text-blue-800", title: "Preview as Participant", children: _jsx(Eye, { className: "h-4 w-4" }) }), _jsx(Link, { to: `/admin/course-builder/${course.id}`, className: "p-1 text-gray-600 hover:text-gray-800", title: "Edit Course", children: _jsx(Edit, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => void duplicateCourse(course.id), className: "p-1 text-gray-600 hover:text-gray-800", title: "Duplicate", children: _jsx(Copy, { className: "h-4 w-4" }) }), _jsx("button", { onClick: () => navigate(`/admin/courses/${course.id}/settings`), className: "p-1 text-gray-600 hover:text-gray-800", title: "Settings", children: _jsx(Settings, { className: "h-4 w-4" }) }), _jsx(LoadingButton, { onClick: () => deleteCourse(course.id), variant: "danger", size: "sm", icon: Trash2, loading: loading && courseToDelete === course.id, disabled: loading, title: "Delete course", children: "Delete" })] }) })] }, course.id))) })] }) })] }), _jsxs("div", { className: "mt-8 grid grid-cols-1 md:grid-cols-4 gap-6", children: [_jsxs("div", { className: "card-lg text-center", children: [_jsx("div", { className: "text-2xl font-bold text-blue-600", children: courses.length }), _jsx("div", { className: "text-sm text-gray-600", children: "Total Courses" })] }), _jsxs("div", { className: "card-lg text-center", children: [_jsx("div", { className: "text-2xl font-bold text-green-600", children: courses.filter((c) => c.status === 'published').length }), _jsx("div", { className: "text-sm text-gray-600", children: "Published" })] }), _jsxs("div", { className: "card-lg text-center", children: [_jsx("div", { className: "text-2xl font-bold text-orange-600", children: courses.reduce((acc, course) => acc + (course.enrollments || 0), 0) }), _jsx("div", { className: "text-sm text-gray-600", children: "Total Enrollments" })] }), _jsxs("div", { className: "card-lg text-center", children: [_jsx("div", { className: "text-2xl font-bold text-purple-600", children: Math.round(courses.filter((c) => (c.avgRating || 0) > 0).reduce((acc, course) => acc + (course.avgRating || 0), 0) / courses.filter((c) => (c.avgRating || 0) > 0).length * 10) / 10 || 0 }), _jsx("div", { className: "text-sm text-gray-600", children: "Avg. Rating" })] })] }), _jsx(ConfirmationModal, { isOpen: showDeleteModal, onClose: () => {
                    setShowDeleteModal(false);
                    setCourseToDelete(null);
                }, onConfirm: confirmDeleteCourse, title: "Delete Course", message: "Are you sure you want to delete this course? This action cannot be undone and will remove all associated data including enrollments and progress.", confirmText: "Delete Course", cancelText: "Cancel", type: "danger" }), _jsx(CourseEditModal, { isOpen: showCreateModal, onClose: closeCreateModal, onSave: handleCreateCourseSave, mode: "create" })] }));
};
export default AdminCourses;
