import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, Send, AlertTriangle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import { courseStore } from '../../store/courseStore';
import { useToast } from '../../context/ToastContext';
import { useSyncService } from '../../dal/sync';
import { addAssignments } from '../../utils/assignmentStorage';
const AdminCourseAssign = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const syncService = useSyncService();
    const course = useMemo(() => (courseId ? courseStore.getCourse(courseId) : null), [courseId]);
    const [emails, setEmails] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    if (!course) {
        return (_jsxs(Card, { tone: "muted", className: "flex flex-col items-start gap-4", children: [_jsx("span", { className: "flex h-12 w-12 items-center justify-center rounded-full bg-sunrise/10 text-sunrise", children: _jsx(AlertTriangle, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Course not found" }), _jsx("p", { className: "mt-2 text-sm text-slate/80", children: "Choose another course to assign from the course list." })] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigate('/admin/courses'), children: "Back to courses" })] }));
    }
    const handleAssign = async (event) => {
        event.preventDefault();
        const assignees = emails
            .split(/[\n,]/)
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean);
        if (assignees.length === 0) {
            showToast('Add at least one email or user ID', 'error');
            return;
        }
        setSubmitting(true);
        try {
            const assignments = await addAssignments(course.id, assignees, { dueDate, note });
            courseStore.saveCourse({
                ...course,
                enrollments: (course.enrollments || 0) + assignments.length,
                lastUpdated: new Date().toISOString(),
            }, { skipRemoteSync: true });
            assignments.forEach((record) => {
                syncService.logEvent({
                    type: 'assignment_created',
                    data: record,
                    timestamp: Date.now(),
                    courseId: record.courseId,
                    userId: record.userId,
                    source: 'admin',
                });
                // Log a secondary event for UX hooks; cast to any to allow custom event type without widening core union
                syncService.logEvent({
                    type: 'course_assigned',
                    data: record,
                    timestamp: Date.now(),
                });
            });
            showToast(`Assigned to ${assignments.length} learner(s)`, 'success');
            navigate('/admin/courses');
        }
        catch (error) {
            console.error(error);
            showToast('Unable to assign course right now', 'error');
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsx("div", { className: "space-y-8", children: _jsxs(Card, { tone: "muted", className: "space-y-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sunrise via-skyblue to-forest text-white", children: _jsx(Users, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx(Badge, { tone: "info", className: "mb-2 bg-skyblue/10 text-skyblue", children: "Assign Course" }), _jsxs("h1", { className: "font-heading text-3xl font-bold text-charcoal", children: ["Share \u201C", course.title, "\u201D with learners"] }), _jsx("p", { className: "mt-2 max-w-2xl text-sm text-slate/80", children: "Enter email addresses or user IDs to invite learners. Assignments sync to analytics so you can track progress." })] })] }), _jsxs("form", { onSubmit: handleAssign, className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-charcoal", children: "Learner emails or IDs *" }), _jsx("p", { className: "text-xs text-slate/70", children: "Separate multiple entries with commas or line breaks." }), _jsx("textarea", { value: emails, onChange: (event) => setEmails(event.target.value), className: "mt-2 h-32 w-full rounded-xl border border-mist px-4 py-3 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-skyblue focus:ring-offset-2 focus:ring-offset-softwhite", placeholder: "mya@thehuddleco.com\nteam@inclusive.org", required: true })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-charcoal", children: "Due date (optional)" }), _jsx(Input, { type: "date", value: dueDate, onChange: (event) => setDueDate(event.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-charcoal", children: "Notes to learners" }), _jsx("textarea", { value: note, onChange: (event) => setNote(event.target.value), className: "mt-2 h-24 w-full rounded-xl border border-mist px-4 py-3 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-skyblue focus:ring-offset-2 focus:ring-offset-softwhite", placeholder: "Highlight key outcomes or include login instructions." })] })] }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(Button, { type: "submit", size: "sm", disabled: submitting, leadingIcon: _jsx(Send, { className: "h-4 w-4" }), children: submitting ? 'Assigning…' : 'Assign course' }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigate('/admin/courses'), children: "Cancel" })] })] })] }) }));
};
export default AdminCourseAssign;
