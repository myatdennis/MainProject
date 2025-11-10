import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Clock, Users, Download, Play } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse } from '../../utils/courseNormalization';
import { loadStoredCourseProgress, buildLearnerProgressSnapshot, syncCourseProgressWithRemote } from '../../utils/courseProgress';
import { getAssignment } from '../../utils/assignmentStorage';
import { getPreferredLessonId, getFirstLessonId } from '../../utils/courseNavigation';
import { useUserProfile } from '../../hooks/useUserProfile';
const ClientCourseDetail = () => {
    const navigate = useNavigate();
    const { courseId } = useParams();
    const { user } = useUserProfile();
    const learnerId = useMemo(() => {
        if (user)
            return (user.email || user.id).toLowerCase();
        try {
            const raw = localStorage.getItem('huddle_user');
            if (raw) {
                const parsed = JSON.parse(raw);
                return (parsed.email || parsed.id || 'local-user').toLowerCase();
            }
        }
        catch (error) {
            console.warn('Failed to read learner identity (legacy fallback):', error);
        }
        return 'local-user';
    }, [user]);
    const course = courseId ? courseStore.resolveCourse(courseId) : null;
    const normalized = course ? normalizeCourse(course) : null;
    const [assignment, setAssignment] = useState();
    const normalizedId = normalized?.id;
    const [progressRefreshToken, setProgressRefreshToken] = useState(0);
    useEffect(() => {
        let isMounted = true;
        const fetchAssignment = async () => {
            if (!normalizedId)
                return;
            try {
                const record = await getAssignment(normalizedId, learnerId);
                if (isMounted) {
                    setAssignment(record);
                }
            }
            catch (error) {
                console.error('Failed to load assignment:', error);
                if (isMounted) {
                    setAssignment(undefined);
                }
            }
        };
        void fetchAssignment();
        return () => {
            isMounted = false;
        };
    }, [normalizedId, learnerId]);
    useEffect(() => {
        let isMounted = true;
        const syncProgress = async () => {
            if (!normalized)
                return;
            const lessonIds = normalized.chapters?.flatMap((chapter) => chapter.lessons?.map((lesson) => lesson.id) ?? []) ?? [];
            if (!lessonIds.length)
                return;
            const result = await syncCourseProgressWithRemote({
                courseSlug: normalized.slug,
                courseId: normalized.id,
                userId: learnerId,
                lessonIds,
            });
            if (isMounted && result) {
                setProgressRefreshToken((token) => token + 1);
            }
        };
        void syncProgress();
        return () => {
            isMounted = false;
        };
    }, [normalized, learnerId]);
    const storedProgress = useMemo(() => normalized
        ? loadStoredCourseProgress(normalized.slug)
        : { completedLessonIds: [], lessonProgress: {}, lessonPositions: {} }, [normalized?.slug, progressRefreshToken]);
    const snapshot = useMemo(() => normalized
        ? buildLearnerProgressSnapshot(normalized, new Set(storedProgress.completedLessonIds), storedProgress.lessonProgress || {})
        : null, [normalized, storedProgress]);
    const progressPercent = assignment?.progress ?? Math.round(((snapshot?.overallProgress ?? 0) || 0) * 100);
    const preferredLessonId = normalized
        ? getPreferredLessonId(normalized, storedProgress) ?? getFirstLessonId(normalized)
        : undefined;
    const handleLaunchCourse = () => {
        if (normalized && preferredLessonId) {
            navigate(`/client/courses/${normalized.slug}/lessons/${preferredLessonId}`);
        }
        else {
            navigate(`/client/courses/${normalized?.slug ?? courseId}`);
        }
    };
    if (!normalized || !snapshot) {
        return (_jsx("div", { className: "max-w-3xl px-6 py-12 lg:px-12", children: _jsxs(Card, { tone: "muted", className: "space-y-4", children: [_jsx("h1", { className: "font-heading text-2xl font-bold text-charcoal", children: "Course not found" }), _jsx("p", { className: "text-sm text-slate/80", children: "The course you\u2019re looking for might have been removed or is not published yet." }), _jsx(Button, { size: "sm", onClick: () => navigate('/client/courses'), children: "Back to courses" })] }) }));
    }
    return (_jsxs("div", { className: "space-y-8 px-6 py-10 lg:px-12", children: [_jsx(Button, { variant: "ghost", size: "sm", leadingIcon: _jsx(ArrowLeft, { className: "h-4 w-4" }), onClick: () => navigate('/client/courses'), children: "Back to courses" }), _jsx(Card, { tone: "muted", className: "space-y-6", children: _jsxs("div", { className: "flex flex-col gap-6 md:flex-row md:items-start md:justify-between", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Badge, { tone: "info", className: "bg-skyblue/10 text-skyblue", children: normalized.difficulty }), _jsx("h1", { className: "font-heading text-3xl font-bold text-charcoal", children: normalized.title }), _jsx("p", { className: "max-w-3xl text-sm text-slate/80", children: normalized.description }), _jsxs("div", { className: "flex flex-wrap gap-4 text-xs text-slate/70", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Clock, { className: "h-4 w-4" }), " ", normalized.duration] }), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx(BookOpen, { className: "h-4 w-4" }), " ", (normalized.chapters || []).reduce((sum, chapter) => sum + chapter.lessons.length, 0), " lessons"] }), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Users, { className: "h-4 w-4" }), " ", normalized.enrollments || 0, " learners enrolled"] })] })] }), _jsxs("div", { className: "w-full max-w-sm space-y-3 rounded-2xl border border-mist bg-white p-4 shadow-card-sm", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate/70", children: "Your progress" }), _jsxs("div", { className: "flex items-baseline gap-2", children: [_jsxs("span", { className: "font-heading text-3xl font-bold text-charcoal", children: [progressPercent, "%"] }), _jsx("span", { className: "text-xs text-slate/70", children: "complete" })] }), _jsx(Button, { size: "sm", className: "w-full", onClick: handleLaunchCourse, children: assignment?.status === 'completed' ? 'Review lessons' : progressPercent > 0 ? 'Continue learning' : 'Start course' })] })] }) }), _jsxs(Card, { tone: "muted", className: "space-y-4", children: [_jsx("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Modules" }), _jsx("div", { className: "space-y-3", children: (normalized.chapters || []).map((chapter) => (_jsxs(Card, { tone: "muted", className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "font-heading text-sm font-semibold text-charcoal", children: chapter.title }), _jsx("p", { className: "text-xs text-slate/70", children: chapter.description })] }), _jsxs(Badge, { tone: "info", className: "bg-white text-skyblue", children: [chapter.lessons.length, " lessons"] })] }), _jsx("ul", { className: "space-y-1 text-xs text-slate/70", children: chapter.lessons.map((lesson) => (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx(Play, { className: "h-3 w-3" }), " ", lesson.title] }, lesson.id))) })] }, chapter.id))) }), _jsx("div", { className: "flex flex-wrap gap-3", children: (normalized.keyTakeaways || []).map((item, index) => (_jsx(Badge, { tone: "info", className: "bg-sunrise/10 text-sunrise", children: item }, index))) }), preferredLessonId && (_jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(Button, { size: "sm", leadingIcon: _jsx(Play, { className: "h-4 w-4" }), onClick: handleLaunchCourse, children: "Resume lesson" }), _jsx(Button, { variant: "ghost", size: "sm", trailingIcon: _jsx(ArrowRight, { className: "h-4 w-4" }), onClick: () => navigate(`/client/courses/${normalized.slug}/lessons/${preferredLessonId}`), children: "Open lesson view" })] })), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(Button, { variant: "ghost", size: "sm", leadingIcon: _jsx(Download, { className: "h-4 w-4" }), onClick: () => navigate(`/lms/course/${normalized.slug}`), children: "Download resources in LMS" }), _jsx(Button, { variant: "ghost", size: "sm", trailingIcon: _jsx(ArrowRight, { className: "h-4 w-4" }), onClick: () => navigate(`/lms/course/${normalized.slug}`), children: "View full LMS experience" })] })] })] }));
};
export default ClientCourseDetail;
