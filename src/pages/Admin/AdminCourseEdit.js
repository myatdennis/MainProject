import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, AlertTriangle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import CourseEditModal from '../../components/CourseEditModal';
import { courseStore } from '../../store/courseStore';
import { useToast } from '../../context/ToastContext';
import { useSyncService } from '../../dal/sync';
import { syncCourseToDatabase, CourseValidationError } from '../../dal/courses';
const AdminCourseEdit = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const syncService = useSyncService();
    const [course, setCourse] = useState(null);
    const [builderOpen, setBuilderOpen] = useState(true);
    useEffect(() => {
        if (!courseId)
            return;
        setCourse(courseStore.getCourse(courseId) || null);
    }, [courseId]);
    const handleSave = async (updatedCourse) => {
        try {
            const snapshot = await syncCourseToDatabase({
                ...updatedCourse,
                lastUpdated: new Date().toISOString(),
            });
            const finalCourse = (snapshot ?? updatedCourse);
            courseStore.saveCourse(finalCourse, { skipRemoteSync: true });
            syncService.logEvent({
                type: 'course_updated',
                data: finalCourse,
                timestamp: Date.now(),
            });
            showToast('Course updated', 'success');
            setBuilderOpen(false);
            setCourse(courseStore.getCourse(finalCourse.id) || null);
        }
        catch (err) {
            if (err instanceof CourseValidationError) {
                showToast(`Update failed: ${err.issues.join(' • ')}`, 'error');
            }
            else {
                console.error('Failed to update course', err);
                // Extract detailed error message from API error
                const errorMessage = err?.message || err?.body?.error || 'Could not update course. Please try again.';
                const errorDetails = err?.body?.details;
                const fullMessage = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;
                showToast(fullMessage, 'error');
            }
        }
    };
    if (!course) {
        return (_jsxs(Card, { tone: "muted", className: "flex flex-col items-start gap-4", children: [_jsx("span", { className: "flex h-12 w-12 items-center justify-center rounded-full bg-sunrise/10 text-sunrise", children: _jsx(AlertTriangle, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Course not found" }), _jsx("p", { className: "mt-2 text-sm text-slate/80", children: "The course you\u2019re trying to edit may have been removed. Return to the course list to create a new one." })] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigate('/admin/courses'), children: "Back to courses" })] }));
    }
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs(Card, { tone: "muted", className: "space-y-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sunrise via-skyblue to-forest text-white", children: _jsx(Pencil, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx(Badge, { tone: "info", className: "mb-2 bg-skyblue/10 text-skyblue", children: "Editing" }), _jsx("h1", { className: "font-heading text-3xl font-bold text-charcoal", children: course.title }), _jsx("p", { className: "mt-2 max-w-2xl text-sm text-slate/80", children: "Update the outline, refresh lesson content, or publish changes. Autosave keeps edits safe every ten seconds." })] })] }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(Button, { size: "sm", onClick: () => setBuilderOpen(true), children: "Reopen builder" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigate(`/admin/courses/${course.id}/details`), children: "View course details" })] })] }), _jsx(CourseEditModal, { isOpen: builderOpen, onClose: () => setBuilderOpen(false), onSave: handleSave, course: course, mode: "edit" })] }));
};
export default AdminCourseEdit;
