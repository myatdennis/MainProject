import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Clock } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse } from '../../utils/courseNormalization';
import { loadStoredCourseProgress, buildLearnerProgressSnapshot } from '../../utils/courseProgress';
import CoursePlayer from '../../components/CoursePlayer/CoursePlayer';
const ClientLessonView = () => {
    const navigate = useNavigate();
    const { courseId } = useParams();
    const resolvedCourse = useMemo(() => {
        if (!courseId)
            return null;
        return courseStore.resolveCourse(courseId);
    }, [courseId]);
    const normalizedCourse = useMemo(() => {
        return resolvedCourse ? normalizeCourse(resolvedCourse) : null;
    }, [resolvedCourse]);
    const storedProgress = useMemo(() => {
        if (!normalizedCourse) {
            return null;
        }
        return loadStoredCourseProgress(normalizedCourse.slug);
    }, [normalizedCourse]);
    const learnerSnapshot = useMemo(() => {
        if (!normalizedCourse || !storedProgress) {
            return null;
        }
        return buildLearnerProgressSnapshot(normalizedCourse, new Set(storedProgress.completedLessonIds), storedProgress.lessonProgress || {}, storedProgress.lessonPositions || {});
    }, [normalizedCourse, storedProgress]);
    const progressPercent = learnerSnapshot ? Math.round((learnerSnapshot.overallProgress || 0) * 100) : 0;
    const handleBackToCourse = () => {
        if (normalizedCourse?.slug) {
            navigate(`/client/courses/${normalizedCourse.slug}`);
            return;
        }
        navigate('/client/courses');
    };
    if (!resolvedCourse || !normalizedCourse) {
        return (_jsx("div", { className: "mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-6 py-12 lg:px-12", children: _jsxs(Card, { tone: "muted", className: "space-y-4", children: [_jsx("h1", { className: "font-heading text-2xl font-bold text-charcoal", children: "Course not available" }), _jsx("p", { className: "text-sm text-slate/80", children: "We couldn\u2019t find the course you were trying to open. It might have been unpublished or reassigned." }), _jsx(Button, { size: "sm", onClick: () => navigate('/client/courses'), children: "Browse my courses" })] }) }));
    }
    const difficultyLabel = normalizedCourse.difficulty || 'Program';
    const lessonCount = (normalizedCourse.chapters || []).reduce((total, chapter) => total + chapter.lessons.length, 0);
    const durationLabel = normalizedCourse.duration || 'Self-paced';
    return (_jsx("div", { className: "bg-mist/30", children: _jsxs("div", { className: "mx-auto max-w-6xl px-6 py-8 lg:px-10", children: [_jsx(Button, { variant: "ghost", size: "sm", leadingIcon: _jsx(ArrowLeft, { className: "h-4 w-4" }), onClick: handleBackToCourse, children: "Back to course overview" }), _jsxs(Card, { tone: "muted", className: "mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Badge, { tone: "info", className: "bg-skyblue/10 text-skyblue", children: difficultyLabel }), _jsx("h1", { className: "font-heading text-2xl font-bold text-charcoal", children: normalizedCourse.title }), _jsxs("div", { className: "flex flex-wrap gap-4 text-xs text-slate/70", children: [_jsxs("span", { className: "flex items-center gap-2", children: [_jsx(Clock, { className: "h-4 w-4" }), durationLabel] }), _jsxs("span", { className: "flex items-center gap-2", children: [_jsx(BookOpen, { className: "h-4 w-4" }), lessonCount, " lessons"] })] })] }), _jsxs("div", { className: "w-full max-w-xs space-y-3 rounded-2xl border border-mist bg-white p-4 shadow-card-sm", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate/70", children: "Overall progress" }), _jsx(ProgressBar, { value: progressPercent, srLabel: "Course completion progress" }), _jsx("p", { className: "text-xs text-slate/70", children: progressPercent >= 100 ? 'Completed' : `${progressPercent}% complete` })] })] }), _jsx("div", { className: "mt-8 overflow-hidden rounded-3xl border border-mist bg-white shadow-card-lg", children: _jsx(CoursePlayer, { namespace: "client" }) })] }) }));
};
export default ClientLessonView;
