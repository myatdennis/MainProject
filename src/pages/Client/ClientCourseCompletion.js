import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SEO from '../../components/SEO/SEO';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse } from '../../utils/courseNormalization';
import { loadStoredCourseProgress } from '../../utils/courseProgress';
const ClientCourseCompletion = () => {
    const navigate = useNavigate();
    const { courseId } = useParams();
    const course = useMemo(() => {
        if (!courseId)
            return null;
        return courseStore.resolveCourse(courseId);
    }, [courseId]);
    const normalized = useMemo(() => (course ? normalizeCourse(course) : null), [course]);
    const stored = useMemo(() => (normalized ? loadStoredCourseProgress(normalized.slug) : null), [normalized]);
    const percent = useMemo(() => {
        if (!stored || !normalized)
            return 0;
        const lessonIds = new Set(stored.completedLessonIds);
        const total = normalized.lessons || 0;
        return total > 0 ? Math.round((lessonIds.size / total) * 100) : 0;
    }, [stored, normalized]);
    const goBack = () => navigate('/client/courses');
    return (_jsxs("div", { className: "p-6 max-w-5xl mx-auto", children: [_jsx(SEO, { title: "Course Completion", description: "Congrats! You finished your course." }), _jsx(Breadcrumbs, { items: [{ label: 'My Courses', to: '/client/courses' }, { label: 'Completion', to: `/client/courses/${courseId}/completion` }] }), _jsxs(Card, { tone: "muted", className: "mt-4 space-y-3", children: [_jsxs("h1", { className: "font-heading text-2xl font-bold text-charcoal", children: [normalized?.title || 'Course', " \u2014 Completion"] }), _jsxs("p", { className: "text-sm text-slate/80", children: ["Great work! You completed ", percent, "% of this course."] }), _jsxs("div", { className: "flex gap-2 pt-2", children: [_jsx(Button, { onClick: goBack, children: "Back to My Courses" }), normalized?.slug && (_jsx(Button, { variant: "ghost", onClick: () => navigate(`/client/courses/${normalized.slug}`), children: "View Course Overview" }))] })] }), !normalized && (_jsx("div", { className: "mt-6", children: _jsxs(Card, { tone: "muted", children: [_jsx("p", { className: "text-sm text-slate/80", children: "This course may have been unpublished. You can browse your catalog to continue learning." }), _jsx("div", { className: "mt-3", children: _jsx(Button, { variant: "ghost", onClick: goBack, children: "Go to My Courses" }) })] }) }))] }));
};
export default ClientCourseCompletion;
