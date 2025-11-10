import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Search, Filter, ArrowRight } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse } from '../../utils/courseNormalization';
import { getAssignmentsForUser } from '../../utils/assignmentStorage';
import { syncCourseProgressWithRemote, buildLearnerProgressSnapshot, loadStoredCourseProgress, } from '../../utils/courseProgress';
import { getPreferredLessonId, getFirstLessonId } from '../../utils/courseNavigation';
import { syncService } from '../../dal/sync';
import { useUserProfile } from '../../hooks/useUserProfile';
const ClientCourses = () => {
    const { user } = useUserProfile();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const navigate = useNavigate();
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
            console.warn('Failed to read learner identity:', error);
        }
        return 'local-user';
    }, [user]);
    const [assignments, setAssignments] = useState([]);
    const [progressRefreshToken, setProgressRefreshToken] = useState(0);
    // Normalize courses (convert modules to chapters if needed)
    const normalizedCoursesAll = courseStore
        .getAllCourses()
        .map((course) => normalizeCourse(course));
    console.log('[ClientCourses] courseStore.getAllCourses():', courseStore.getAllCourses());
    console.log('[ClientCourses] normalizedCourses(all):', normalizedCoursesAll);
    useEffect(() => {
        const ensureStore = async () => {
            try {
                if (typeof courseStore.init === 'function') {
                    await courseStore.init();
                }
            }
            catch (err) {
                console.warn('Failed to initialize course store:', err);
            }
        };
        void ensureStore();
    }, []);
    useEffect(() => {
        let isMounted = true;
        const syncProgress = async () => {
            if (!normalizedCourses.length)
                return;
            const results = await Promise.all(normalizedCourses.map(async (course) => {
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
    }, [normalizedCoursesAll, learnerId]);
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
    // Learners see published + assigned only
    const assignedSet = useMemo(() => new Set(assignments.map((a) => a.courseId)), [assignments]);
    const normalizedCourses = useMemo(() => normalizedCoursesAll.filter((c) => c.status === 'published' || assignedSet.has(c.id)), [normalizedCoursesAll, assignedSet]);
    const courseSnapshots = useMemo(() => normalizedCourses.map((course) => {
        const stored = loadStoredCourseProgress(course.slug);
        return {
            course,
            snapshot: buildLearnerProgressSnapshot(course, new Set(stored.completedLessonIds), stored.lessonProgress || {}),
            assignment: assignments.find((record) => record.courseId === course.id),
            stored,
            preferredLessonId: getPreferredLessonId(course, stored) ?? getFirstLessonId(course),
        };
    }), [normalizedCourses, assignments, progressRefreshToken]);
    console.log('[ClientCourses] courseSnapshots:', courseSnapshots);
    console.log('[ClientCourses] searchTerm:', searchTerm, 'filterStatus:', filterStatus);
    const filtered = courseSnapshots.filter(({ course, snapshot, assignment }) => {
        const searchMatch = course.title.toLowerCase().includes(searchTerm.toLowerCase());
        if (!searchMatch)
            return false;
        const status = assignment?.status || (snapshot.overallProgress >= 1 ? 'completed' : snapshot.overallProgress > 0 ? 'in-progress' : 'not-started');
        if (filterStatus === 'all')
            return true;
        if (filterStatus === 'in-progress')
            return status === 'in-progress';
        if (filterStatus === 'completed')
            return status === 'completed';
        if (filterStatus === 'not-started')
            return status === 'not-started';
        return true;
    });
    console.log('[ClientCourses] filtered:', filtered);
    return (_jsxs("div", { className: "max-w-7xl px-6 py-10 lg:px-12", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "font-heading text-3xl font-bold text-charcoal", children: "My courses" }), _jsx("p", { className: "mt-2 text-sm text-slate/80", children: "Assigned programs appear here along with your progress." })] }), _jsx(Card, { tone: "muted", className: "mb-8 space-y-4", children: _jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { className: "flex flex-1 flex-col gap-3 md:flex-row md:items-center", children: [_jsxs("div", { className: "relative w-full md:w-72", children: [_jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate/60" }), _jsx(Input, { className: "pl-9", value: searchTerm, onChange: (event) => setSearchTerm(event.target.value), placeholder: "Search courses" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Filter, { className: "h-4 w-4 text-slate/60" }), _jsxs("select", { value: filterStatus, onChange: (event) => setFilterStatus(event.target.value), className: "rounded-lg border border-mist px-3 py-2 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-skyblue", children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "not-started", children: "Not started" }), _jsx("option", { value: "in-progress", children: "In progress" }), _jsx("option", { value: "completed", children: "Completed" })] })] })] }), _jsx(Button, { variant: "ghost", size: "sm", trailingIcon: _jsx(ArrowRight, { className: "h-4 w-4" }), onClick: () => navigate('/lms/dashboard'), children: "Open full learning hub" })] }) }), _jsx("div", { className: "grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3", children: filtered.map(({ course, snapshot, assignment, preferredLessonId }) => {
                    const progress = assignment?.progress ?? Math.round((snapshot.overallProgress || 0) * 100);
                    const status = assignment?.status || (snapshot.overallProgress >= 1 ? 'completed' : snapshot.overallProgress > 0 ? 'in-progress' : 'not-started');
                    return (_jsxs(Card, { className: "flex h-full flex-col gap-4", "data-test": "client-course-card", children: [_jsxs("div", { className: "relative overflow-hidden rounded-2xl", children: [_jsx("img", { src: course.thumbnail, alt: course.title, className: "h-44 w-full object-cover" }), _jsx(Badge, { tone: "info", className: "absolute left-4 top-4 bg-white/90 text-skyblue", children: status === 'completed' ? 'Completed' : status === 'in-progress' ? 'In progress' : 'Assigned' })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-heading text-xl font-semibold text-charcoal", children: course.title }), _jsx("p", { className: "mt-1 line-clamp-2 text-sm text-slate/80", children: course.description })] }), _jsx(ProgressBar, { value: progress, srLabel: `${course.title} progress` }), _jsxs("div", { className: "flex items-center gap-3 text-xs text-slate/70", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(BookOpen, { className: "h-4 w-4" }), (course.chapters || []).reduce((total, chapter) => total + chapter.lessons.length, 0), " lessons"] }), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Clock, { className: "h-4 w-4" }), " ", course.duration] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Button, { size: "sm", onClick: () => {
                                                    if (preferredLessonId) {
                                                        navigate(`/client/courses/${course.slug}/lessons/${preferredLessonId}`);
                                                    }
                                                    else {
                                                        navigate(`/client/courses/${course.slug}`);
                                                    }
                                                }, "data-test": "client-course-primary", children: status === 'not-started' ? 'Start course' : 'Continue' }), _jsx(Button, { variant: "ghost", size: "sm", asChild: true, children: _jsx(Link, { to: `/client/courses/${course.slug}`, children: "Details" }) })] })] })] }, course.id));
                }) }), filtered.length === 0 && (_jsxs(Card, { tone: "muted", className: "mt-6 text-center", padding: "lg", children: [_jsx("h3", { className: "font-heading text-lg font-semibold text-charcoal", children: "No courses match your filters." }), _jsx("p", { className: "mt-2 text-sm text-slate/80", children: "Clear the filters or explore the LMS dashboard for more content." })] }))] }));
};
export default ClientCourses;
