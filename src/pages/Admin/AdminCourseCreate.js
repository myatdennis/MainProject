import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Sparkles } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import CourseEditModal from '../../components/CourseEditModal';
import { courseStore } from '../../store/courseStore';
import { useToast } from '../../context/ToastContext';
import { useSyncService } from '../../dal/sync';
import { syncCourseToDatabase, CourseValidationError } from '../../dal/courses';
const AdminCourseCreate = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const syncService = useSyncService();
    const [builderOpen, setBuilderOpen] = useState(true);
    const handleSave = async (course) => {
        try {
            const snapshot = await syncCourseToDatabase({
                ...course,
                status: course.status || 'draft',
                lastUpdated: new Date().toISOString(),
            });
            const created = (snapshot ?? course);
            courseStore.saveCourse(created, { skipRemoteSync: true });
            syncService.logEvent({
                type: 'course_created',
                data: created,
                timestamp: Date.now(),
            });
            showToast('Course saved successfully', 'success');
            navigate(`/admin/courses/${created.id}/details`);
        }
        catch (err) {
            if (err instanceof CourseValidationError) {
                showToast(`Save failed: ${err.issues.join(' • ')}`, 'error');
            }
            else {
                console.error('Failed to save course', err);
                // Extract detailed error message from API error
                const errorMessage = err?.message || err?.body?.error || 'Could not save course. Please try again.';
                const errorDetails = err?.body?.details;
                const fullMessage = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;
                showToast(fullMessage, 'error');
            }
        }
    };
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs(Card, { tone: "muted", className: "space-y-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sunrise via-skyblue to-forest text-white", children: _jsx(BookOpen, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx(Badge, { tone: "info", className: "mb-2 bg-skyblue/10 text-skyblue", children: "Course Builder" }), _jsx("h1", { className: "font-heading text-3xl font-bold text-charcoal", children: "Create a new learning experience" }), _jsx("p", { className: "mt-2 max-w-2xl text-sm text-slate/80", children: "Draft the course outline, add lessons, and publish when you\u2019re ready. Autosave keeps edits safe every time you pause for more than ten seconds." })] })] }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(Button, { size: "sm", leadingIcon: _jsx(Sparkles, { className: "h-4 w-4" }), onClick: () => setBuilderOpen(true), children: "Launch builder" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigate('/admin/courses'), children: "Back to courses" })] })] }), _jsx(CourseEditModal, { isOpen: builderOpen, onClose: () => setBuilderOpen(false), onSave: handleSave, mode: "create" })] }));
};
export default AdminCourseCreate;
