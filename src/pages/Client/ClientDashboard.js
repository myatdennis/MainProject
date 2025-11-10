import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Clock, Users, Award } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import { courseStore } from '../../store/courseStore';
import { useUserProfile } from '../../hooks/useUserProfile';
import { normalizeCourse } from '../../utils/courseNormalization';
import { getAssignmentsForUser } from '../../utils/assignmentStorage';
import { syncCourseProgressWithRemote, loadStoredCourseProgress, buildLearnerProgressSnapshot, } from '../../utils/courseProgress';
import { getPreferredLessonId, getFirstLessonId } from '../../utils/courseNavigation';
import { syncService } from '../../dal/sync';
const ClientDashboard = () => {
    const navigate = useNavigate();
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
    const [assignments, setAssignments] = useState([]);
    const [progressRefreshToken, setProgressRefreshToken] = useState(0);
    useEffect(() => {
        let isMounted = true;
        const refreshAssignments = async () => {
            try {
                const records = await getAssignmentsForUser(learnerId);
                if (isMounted) {
                    setAssignments(records);
                }
            }
            catch (error) {
                console.error('Failed to load assignments:', error);
            }
        };
        void refreshAssignments();
        const unsubscribeCreate = syncService.subscribe('assignment_created', () => {
            void refreshAssignments();
        });
        const unsubscribeUpdate = syncService.subscribe('assignment_updated', () => {
            void refreshAssignments();
        });
        const unsubscribeDelete = syncService.subscribe('assignment_deleted', () => {
            void refreshAssignments();
        });
        return () => {
            isMounted = false;
            unsubscribeCreate?.();
            unsubscribeUpdate?.();
            unsubscribeDelete?.();
        };
    }, [learnerId]);
    const courses = useMemo(() => assignments
        .map((record) => courseStore.getCourse(record.courseId))
        .filter(Boolean)
        .map((course) => normalizeCourse(course)), [assignments]);
    useEffect(() => {
        let isMounted = true;
        const syncProgress = async () => {
            if (!courses.length)
                return;
            const results = await Promise.all(courses.map(async (course) => {
                const lessonIds = course.chapters?.flatMap((chapter) => chapter.lessons?.map((lesson) => lesson.id) ?? []) ?? [];
                if (lessonIds.length === 0)
                    return null;
                return syncCourseProgressWithRemote({
                    courseSlug: course.slug,
                    courseId: course.id,
                    userId: learnerId,
                    lessonIds,
                });
            }));
            if (!isMounted)
                return;
            if (results.some((entry) => entry)) {
                setProgressRefreshToken((token) => token + 1);
            }
        };
        void syncProgress();
        return () => {
            isMounted = false;
        };
    }, [courses, learnerId]);
    const courseDetails = useMemo(() => courses.map((course) => {
        const stored = loadStoredCourseProgress(course.slug);
        const snapshot = buildLearnerProgressSnapshot(course, new Set(stored.completedLessonIds), stored.lessonProgress || {}, stored.lessonPositions || {});
        const assignment = assignments.find((record) => record.courseId === course.id);
        const progressPercent = (assignment?.progress ?? 0) || Math.round((snapshot.overallProgress || 0) * 100);
        const preferredLessonId = getPreferredLessonId(course, stored) ?? getFirstLessonId(course);
        return {
            course,
            snapshot,
            assignment,
            stored,
            progressPercent,
            preferredLessonId,
        };
    }), [assignments, courses, progressRefreshToken]);
    const completedCount = assignments.filter((record) => record.status === 'completed').length;
    const inProgressCount = assignments.filter((record) => record.status === 'in-progress').length;
    return (_jsxs("div", { className: "max-w-7xl px-6 py-10 lg:px-12", children: [_jsx(Card, { tone: "gradient", withBorder: false, className: "overflow-hidden", children: _jsxs("div", { className: "relative z-10 flex flex-col gap-4 text-charcoal md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsx(Badge, { tone: "info", className: "bg-white/80 text-skyblue", children: "Client Portal" }), _jsx("h1", { className: "mt-4 font-heading text-3xl font-bold md:text-4xl", children: "Welcome back" }), _jsx("p", { className: "mt-3 max-w-2xl text-sm text-slate/80", children: "Track assigned courses, follow due dates, and jump back into lessons in one place." })] }), _jsx("div", { className: "flex flex-wrap gap-3", children: _jsx(Button, { variant: "ghost", size: "sm", trailingIcon: _jsx(ArrowUpRight, { className: "h-4 w-4" }), onClick: () => navigate('/lms/dashboard'), children: "Go to full learning hub" }) })] }) }), _jsxs("div", { className: "mt-8 grid gap-4 md:grid-cols-4", children: [_jsxs(Card, { tone: "muted", className: "text-center py-6", children: [_jsx("div", { className: "font-heading text-3xl font-bold text-charcoal", children: assignments.length }), _jsx("p", { className: "text-xs uppercase tracking-wide text-slate/70", children: "Assigned courses" })] }), _jsxs(Card, { tone: "muted", className: "text-center py-6", children: [_jsx("div", { className: "font-heading text-3xl font-bold text-charcoal", children: completedCount }), _jsx("p", { className: "text-xs uppercase tracking-wide text-slate/70", children: "Completed" })] }), _jsxs(Card, { tone: "muted", className: "text-center py-6", children: [_jsx("div", { className: "font-heading text-3xl font-bold text-charcoal", children: inProgressCount }), _jsx("p", { className: "text-xs uppercase tracking-wide text-slate/70", children: "In progress" })] }), _jsxs(Card, { tone: "muted", className: "space-y-2 py-6", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-slate/70", children: "Quick actions" }), _jsx(Button, { size: "sm", className: "w-full", onClick: () => navigate('/client/courses'), children: "Browse courses" }), _jsx(Button, { variant: "ghost", size: "sm", className: "w-full", onClick: () => navigate('/lms/dashboard'), children: "Continue learning" })] })] }), _jsxs("div", { className: "mt-10 grid gap-6 lg:grid-cols-2", children: [_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Assigned courses" }), _jsx(Badge, { tone: "info", className: "bg-skyblue/10 text-skyblue", children: assignments.length })] }), assignments.length === 0 ? (_jsx("p", { className: "text-sm text-slate/70", children: "No assignments yet. Your facilitator will share programs here soon." })) : (_jsx("div", { className: "space-y-3", children: courseDetails.map(({ course, assignment, progressPercent, preferredLessonId }) => {
                                    return (_jsxs(Card, { tone: "muted", className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "font-heading text-sm font-semibold text-charcoal", children: course.title }), _jsxs("p", { className: "text-xs text-slate/70", children: ["Due ", assignment?.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : '—'] })] }), _jsx(Button, { size: "sm", onClick: () => {
                                                            if (preferredLessonId) {
                                                                navigate(`/client/courses/${course.slug}/lessons/${preferredLessonId}`);
                                                            }
                                                            else {
                                                                navigate(`/client/courses/${course.slug}`);
                                                            }
                                                        }, children: "Open" })] }), _jsx(ProgressBar, { value: progressPercent, srLabel: `${course.title} completion` })] }, course.id));
                                }) }))] }), _jsxs(Card, { tone: "muted", className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "flex h-11 w-11 items-center justify-center rounded-2xl bg-sunrise/10 text-sunrise", children: _jsx(Users, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-heading text-base font-semibold text-charcoal", children: "Stay connected" }), _jsx("p", { className: "text-xs text-slate/70", children: "Use the full LMS to access discussions, resources, and certificates." })] })] }), _jsxs("ul", { className: "space-y-2 text-sm text-slate/80", children: [_jsxs("li", { className: "flex items-center gap-2", children: [_jsx(Clock, { className: "h-4 w-4" }), " Resume lessons exactly where you left off."] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx(BookOpen, { className: "h-4 w-4" }), " Access downloadable resources and transcripts."] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx(Award, { className: "h-4 w-4" }), " Earn certificates when you finish programs."] })] }), _jsx(Button, { variant: "ghost", size: "sm", trailingIcon: _jsx(ArrowUpRight, { className: "h-4 w-4" }), onClick: () => navigate('/lms/dashboard'), children: "Go to LMS" })] })] })] }));
};
export default ClientDashboard;
