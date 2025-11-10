import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, BarChart3, BookOpen, CheckCircle2, Clock, Play, Search, Target, } from 'lucide-react';
import { courseStore } from '../store/courseStore';
import { normalizeCourse } from '../utils/courseNormalization';
import { syncCourseProgressWithRemote, buildLearnerProgressSnapshot, loadStoredCourseProgress, } from '../utils/courseProgress';
import { syncService } from '../dal/sync';
import { getAssignmentsForUser } from '../utils/assignmentStorage';
import SEO from '../components/SEO';
import { LoadingSpinner, CourseCardSkeleton } from '../components/LoadingComponents';
import { LazyImage, ImageSkeleton, useDebounce } from '../components/PerformanceComponents';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import ProgressBar from '../components/ui/ProgressBar';
import { useUserProfile } from '../hooks/useUserProfile';
const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'not-started', label: 'Not Started' },
    { value: 'completed', label: 'Completed' },
];
const LearnerDashboard = () => {
    const navigate = useNavigate();
    const [enrolledCourses, setEnrolledCourses] = useState([]);
    const [progressData, setProgressData] = useState(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const debouncedSearchQuery = useDebounce(searchQuery, 250);
    const [assignments, setAssignments] = useState([]);
    const [progressRefreshToken, setProgressRefreshToken] = useState(0);
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
    useEffect(() => {
        let isMounted = true;
        const run = async () => {
            setIsLoading(true);
            try {
                if (courseStore.getAllCourses().length === 0 && typeof courseStore.init === 'function') {
                    await courseStore.init();
                }
                const storedCourses = courseStore.getAllCourses();
                const normalizedCourses = storedCourses
                    .map((course) => normalizeCourse(course))
                    .filter((course) => course.status === 'published');
                const assignmentRecords = await getAssignmentsForUser(learnerId);
                const mergedCourses = [...normalizedCourses];
                assignmentRecords.forEach((record) => {
                    if (!mergedCourses.some((course) => course.id === record.courseId)) {
                        const fromStore = courseStore.getCourse(record.courseId);
                        if (fromStore) {
                            mergedCourses.push(normalizeCourse(fromStore));
                        }
                    }
                });
                if (!isMounted)
                    return;
                setAssignments(assignmentRecords);
                setEnrolledCourses(mergedCourses);
                const progressMap = new Map();
                mergedCourses.forEach((course) => {
                    const normalized = normalizeCourse(course);
                    const storedProgress = loadStoredCourseProgress(normalized.slug);
                    const completedSet = new Set(storedProgress.completedLessonIds);
                    const snapshot = buildLearnerProgressSnapshot(normalized, completedSet, storedProgress.lessonProgress || {});
                    progressMap.set(normalized.id, snapshot);
                });
                setProgressData(progressMap);
            }
            catch (error) {
                console.error('Failed to load learner courses:', error);
                if (isMounted) {
                    setEnrolledCourses([]);
                    setProgressData(new Map());
                }
            }
            finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };
        void run();
        return () => {
            isMounted = false;
        };
    }, [learnerId]);
    useEffect(() => {
        let isMounted = true;
        const loadAssignments = async () => {
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
        void loadAssignments();
        return () => {
            isMounted = false;
        };
    }, [learnerId]);
    useEffect(() => {
        const refreshAssignments = async () => {
            try {
                const records = await getAssignmentsForUser(learnerId);
                setAssignments(records);
            }
            catch (error) {
                console.error('Failed to refresh assignments:', error);
            }
        };
        const unsubAssignCreate = syncService.subscribe('assignment_created', () => {
            void refreshAssignments();
        });
        const unsubAssignUpdate = syncService.subscribe('assignment_updated', () => {
            void refreshAssignments();
        });
        const unsubProgress = syncService.subscribe('user_progress', (event) => {
            const targetId = event?.userId || event?.data?.userId;
            if (targetId?.toLowerCase?.() === learnerId) {
                void refreshAssignments();
            }
        });
        const unsubComplete = syncService.subscribe('user_completed', (event) => {
            const targetId = event?.userId || event?.data?.userId;
            if (targetId?.toLowerCase?.() === learnerId) {
                void refreshAssignments();
            }
        });
        return () => {
            unsubAssignCreate?.();
            unsubAssignUpdate?.();
            unsubProgress?.();
            unsubComplete?.();
        };
    }, [learnerId]);
    useEffect(() => {
        let isMounted = true;
        const syncProgress = async () => {
            if (!enrolledCourses.length)
                return;
            const results = await Promise.all(enrolledCourses.map(async (course) => {
                const normalized = normalizeCourse(course);
                const lessonIds = normalized.chapters?.flatMap((chapter) => chapter.lessons?.map((lesson) => lesson.id) ?? []) ?? [];
                if (!lessonIds.length)
                    return null;
                return syncCourseProgressWithRemote({
                    courseSlug: normalized.slug,
                    courseId: normalized.id,
                    userId: learnerId,
                    lessonIds,
                });
            }));
            if (!isMounted)
                return;
            if (results.some((entry) => entry)) {
                setProgressRefreshToken((token) => token + 1);
                const progressMap = new Map();
                enrolledCourses.forEach((course) => {
                    const normalized = normalizeCourse(course);
                    const storedProgress = loadStoredCourseProgress(normalized.slug);
                    const completedSet = new Set(storedProgress.completedLessonIds);
                    const snapshot = buildLearnerProgressSnapshot(normalized, completedSet, storedProgress.lessonProgress || {});
                    progressMap.set(normalized.id, snapshot);
                });
                setProgressData(progressMap);
            }
        };
        void syncProgress();
        return () => {
            isMounted = false;
        };
    }, [enrolledCourses, learnerId]);
    const filteredCourses = useMemo(() => {
        let courses = [...enrolledCourses];
        if (debouncedSearchQuery) {
            const query = debouncedSearchQuery.toLowerCase();
            courses = courses.filter((course) => {
                const titleMatch = course.title.toLowerCase().includes(query);
                const descriptionMatch = (course.description || '').toLowerCase().includes(query);
                const categoryMatch = course.category?.toLowerCase().includes(query);
                return titleMatch || descriptionMatch || categoryMatch;
            });
        }
        if (filterStatus !== 'all') {
            courses = courses.filter((course) => {
                const progress = progressData.get(course.id);
                switch (filterStatus) {
                    case 'in-progress':
                        return progress && progress.overallProgress > 0 && progress.overallProgress < 1;
                    case 'completed':
                        return progress?.overallProgress === 1;
                    case 'not-started':
                        return !progress || progress.overallProgress === 0;
                    default:
                        return true;
                }
            });
        }
        return courses;
    }, [enrolledCourses, debouncedSearchQuery, filterStatus, progressData, progressRefreshToken]);
    const handleCourseClick = (course) => {
        navigate(`/lms/course/${course.slug || course.id}`);
    };
    const handleContinueCourse = (course) => {
        const progress = progressData.get(course.id);
        if (progress && progress.lessonProgress.length > 0) {
            const nextLesson = progress.lessonProgress.find((p) => !p.isCompleted);
            if (nextLesson) {
                navigate(`/lms/course/${course.slug || course.id}/lesson/${nextLesson.lessonId}`);
                return;
            }
        }
        const storedProgress = loadStoredCourseProgress(course.slug);
        if (storedProgress.lastLessonId) {
            navigate(`/lms/course/${course.slug || course.id}/lesson/${storedProgress.lastLessonId}`);
            return;
        }
        const firstLesson = course.chapters?.[0]?.lessons?.[0] || course.modules?.[0]?.lessons?.[0];
        if (firstLesson) {
            navigate(`/lms/course/${course.slug || course.id}/lesson/${firstLesson.id}`);
            return;
        }
        navigate(`/lms/course/${course.slug || course.id}`);
    };
    const getCourseStats = (course) => {
        const progress = progressData.get(course.id);
        const assignment = assignments.find((record) => record.courseId === course.id);
        const assignmentProgress = assignment ? assignment.progress / 100 : 0;
        const overallProgress = Math.max(progress?.overallProgress || 0, assignmentProgress);
        const totalLessons = (course.chapters || []).reduce((total, chapter) => total + chapter.lessons.length, 0);
        const completedLessons = overallProgress >= 1
            ? totalLessons
            : progress?.lessonProgress.filter((lp) => lp.isCompleted).length || 0;
        return {
            progress: overallProgress,
            completedLessons,
            totalLessons,
            timeSpent: progress?.timeSpent || 0,
            isCompleted: overallProgress >= 1 || assignment?.status === 'completed',
        };
    };
    const activeCourses = filteredCourses.filter((course) => {
        const stats = getCourseStats(course);
        return stats.progress > 0 && !stats.isCompleted;
    });
    const notStartedCourses = filteredCourses.filter((course) => getCourseStats(course).progress === 0);
    const progressValues = filteredCourses.map((course) => getCourseStats(course).progress);
    const completedCount = progressValues.filter((value) => value >= 1).length;
    const inProgressCount = progressValues.filter((value) => value > 0 && value < 1).length;
    const snapshotValues = Array.from(progressData.values());
    const totalSeconds = snapshotValues.reduce((sum, item) => sum + (item.timeSpent || 0), 0);
    const completedLessonAggregate = snapshotValues.reduce((sum, item) => sum + (item.lessonProgress?.filter((lesson) => lesson.isCompleted).length || 0), 0);
    const hoursSpent = Math.floor(totalSeconds / 3600);
    const averageCompletion = progressValues.length
        ? Math.round((progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length) *
            100)
        : 0;
    const recommendedCourses = notStartedCourses.length > 0 ? notStartedCourses : filteredCourses;
    if (isLoading) {
        return (_jsxs("div", { className: "min-h-screen bg-softwhite", children: [_jsx(SEO, { title: "My Learning Dashboard", description: "Track your learning progress, continue courses, and discover new educational opportunities.", keywords: "learning dashboard, course progress, online education, skills development" }), _jsxs("div", { className: "mx-auto max-w-7xl px-6 py-12 lg:px-12", children: [_jsx(LoadingSpinner, { size: "lg", text: "Loading your courses...", className: "py-20" }), _jsx("div", { className: "mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3", children: [1, 2, 3, 4, 5, 6].map((i) => (_jsx(CourseCardSkeleton, {}, i))) })] })] }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-softwhite pb-20", children: [_jsx(SEO, { title: "My Learning Dashboard", description: "Track your learning progress, continue courses, and discover new educational opportunities.", keywords: "learning dashboard, course progress, online education, skills development" }), _jsxs("div", { className: "mx-auto max-w-7xl px-6 py-10 lg:px-12", children: [_jsxs("div", { className: "grid gap-6 lg:grid-cols-[2fr,1fr]", children: [_jsxs(Card, { tone: "gradient", withBorder: false, className: "overflow-hidden", children: [_jsxs("div", { className: "relative z-10 flex flex-col gap-5 text-charcoal", children: [_jsx(Badge, { tone: "info", className: "w-max bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-skyblue", children: "My Learning Journey" }), _jsx("h1", { className: "font-heading text-3xl font-bold md:text-4xl", children: "Welcome back, continue building inclusive leadership skills." }), _jsx("p", { className: "max-w-2xl text-base text-slate/80", children: "Review your progress, pick up the next lesson, or explore new courses designed to spark belonging across your teams." }), _jsxs("div", { className: "grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]", children: [_jsxs("div", { className: "relative flex items-center", children: [_jsx(Search, { className: "pointer-events-none absolute left-4 h-5 w-5 text-slate/60" }), _jsx(Input, { value: searchQuery, onChange: (event) => setSearchQuery(event.target.value), placeholder: "Search your courses", className: "w-full rounded-full border-none bg-white/90 pl-12 pr-6 text-sm shadow-card-sm", "aria-label": "Search courses" })] }), _jsx("div", { className: "hidden rounded-full bg-white/80 p-1 text-sm font-semibold text-slate/70 md:flex", children: filterOptions.map((option) => (_jsx("button", { type: "button", onClick: () => setFilterStatus(option.value), className: `flex-1 rounded-full px-4 py-2 transition ${filterStatus === option.value
                                                                ? 'bg-sunrise text-white shadow-card-sm'
                                                                : 'text-slate/70 hover:text-charcoal'}`, children: option.label }, option.value))) })] }), _jsxs("div", { className: "flex flex-wrap gap-4 pt-2", children: [_jsx(HeroStat, { icon: _jsx(Play, { className: "h-4 w-4" }), label: "Active Courses", value: inProgressCount }), _jsx(HeroStat, { icon: _jsx(CheckCircle2, { className: "h-4 w-4" }), label: "Completion", value: `${averageCompletion}%` }), _jsx(HeroStat, { icon: _jsx(Clock, { className: "h-4 w-4" }), label: "Hours Learned", value: hoursSpent })] })] }), _jsx("div", { className: "pointer-events-none absolute inset-y-0 right-0 hidden w-64 translate-x-10 rounded-full bg-gradient-to-br from-sunrise/30 via-skyblue/20 to-forest/20 blur-3xl md:block" })] }), _jsxs(Card, { tone: "muted", padding: "lg", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Learning snapshot" }), _jsx("p", { className: "mt-1 text-sm text-slate/80", children: "A quick look at your momentum this week." })] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigate('/lms/progress'), trailingIcon: _jsx(ArrowUpRight, { className: "h-4 w-4" }), children: "View report" })] }), _jsxs("div", { className: "mt-6 space-y-4", children: [_jsx(SnapshotRow, { icon: _jsx(BarChart3, { className: "h-5 w-5 text-skyblue" }), label: "Completed courses", value: `${completedCount}`, helper: "All time" }), _jsx(SnapshotRow, { icon: _jsx(Target, { className: "h-5 w-5 text-forest" }), label: "Goals in focus", value: `${Math.max(inProgressCount, 1)}`, helper: "Active this month" }), _jsx(SnapshotRow, { icon: _jsx(BookOpen, { className: "h-5 w-5 text-sunrise" }), label: "Lessons completed", value: `${completedLessonAggregate}`, helper: "Across all courses" })] })] })] }), _jsx("div", { className: "mt-6 md:hidden", children: _jsx("div", { className: "flex gap-2", children: filterOptions.map((option) => (_jsx("button", { type: "button", onClick: () => setFilterStatus(option.value), className: `flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition ${filterStatus === option.value
                                    ? 'border-sunrise bg-sunrise/10 text-sunrise'
                                    : 'border-mist text-slate/80'}`, children: option.label }, option.value))) }) }), _jsxs("section", { className: "mt-12 space-y-14", children: [_jsxs("div", { children: [_jsx(SectionHeading, { title: "Continue learning", description: "Pick up where you left off in courses that are already underway.", badgeValue: activeCourses.length, actionLabel: "Browse all courses", onAction: () => navigate('/lms/courses') }), activeCourses.length === 0 ? (_jsx(EmptyState, { title: "You're all caught up", description: "Start a new course to keep building your practice of inclusive leadership.", actionLabel: "Explore catalog", onAction: () => navigate('/lms/courses') })) : (_jsx(CourseGrid, { children: activeCourses.map((course) => (_jsx(CourseTile, { course: course, stats: getCourseStats(course), assignment: assignments.find((record) => record.courseId === course.id), onPrimaryAction: () => handleContinueCourse(course), onSecondaryAction: () => handleCourseClick(course) }, course.id))) }))] }), _jsxs("div", { children: [_jsx(SectionHeading, { title: "Recommended for you", description: "Curated programs to deepen your inclusive leadership toolkit.", badgeValue: recommendedCourses.length, actionLabel: "View recommendations", onAction: () => navigate('/lms/courses') }), recommendedCourses.length === 0 ? (_jsx(EmptyState, { title: "No matches just yet", description: "Adjust your search or filters to discover tailored content.", actionLabel: "Reset filters", onAction: () => {
                                            setSearchQuery('');
                                            setFilterStatus('all');
                                        } })) : (_jsx(CourseGrid, { children: recommendedCourses.map((course) => (_jsx(CourseTile, { course: course, stats: getCourseStats(course), assignment: assignments.find((record) => record.courseId === course.id), isRecommended: true, onPrimaryAction: () => handleCourseClick(course), onSecondaryAction: () => handleCourseClick(course) }, course.id))) }))] })] })] })] }));
};
const HeroStat = ({ icon, label, value }) => (_jsxs("div", { className: "inline-flex min-w-[130px] items-center gap-3 rounded-xl bg-white/70 px-4 py-3 shadow-card-sm", children: [_jsx("span", { className: "flex h-9 w-9 items-center justify-center rounded-lg bg-skyblue/12 text-skyblue", children: icon }), _jsxs("div", { children: [_jsx("div", { className: "font-heading text-lg font-bold text-charcoal", children: value }), _jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-slate/70", children: label })] })] }));
const SnapshotRow = ({ icon, label, value, helper }) => (_jsxs("div", { className: "flex items-start gap-3 rounded-xl border border-mist/60 bg-white/70 p-4", children: [_jsx("span", { className: "mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-cloud text-slate", children: icon }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "font-heading text-base font-semibold text-charcoal", children: label }), _jsx("span", { className: "font-heading text-lg font-bold text-charcoal", children: value })] }), _jsx("p", { className: "text-xs text-slate/70", children: helper })] })] }));
const SectionHeading = ({ title, description, badgeValue, actionLabel, onAction }) => (_jsxs("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("h2", { className: "font-heading text-2xl font-bold text-charcoal", children: title }), _jsx(Badge, { tone: "info", className: "bg-skyblue/10 text-skyblue", children: badgeValue })] }), _jsx("p", { className: "mt-1 text-sm text-slate/80", children: description })] }), _jsx(Button, { variant: "ghost", size: "sm", trailingIcon: _jsx(ArrowUpRight, { className: "h-4 w-4" }), onClick: onAction, children: actionLabel })] }));
const CourseGrid = ({ children }) => (_jsx("div", { className: "mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3", children: children }));
const CourseTile = ({ course, stats, assignment, onPrimaryAction, onSecondaryAction, isRecommended, }) => {
    const progressPercent = Math.round((stats.progress || 0) * 100);
    const statusLabel = assignment?.status === 'completed' || stats.isCompleted
        ? 'Completed'
        : progressPercent > 0
            ? `${progressPercent}% complete`
            : assignment
                ? 'Assigned'
                : 'Ready to start';
    const dueDateLabel = assignment?.dueDate
        ? new Date(assignment.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : null;
    return (_jsxs(Card, { className: "flex h-full flex-col gap-4", children: [_jsxs("div", { className: "relative overflow-hidden rounded-2xl", children: [_jsx(LazyImage, { src: course.thumbnail, alt: course.title, className: "h-44 w-full object-cover", placeholder: _jsx(ImageSkeleton, { className: "h-44 w-full rounded-2xl" }), fallbackSrc: "/placeholder-course.jpg" }), isRecommended && (_jsx(Badge, { tone: "info", className: "absolute left-4 top-4 bg-white/90 text-skyblue", children: "Recommended" })), assignment && (_jsx(Badge, { tone: "info", className: "absolute right-4 top-4 bg-white/90 text-sunrise", children: assignment.status === 'completed' ? 'Completed' : 'Assigned' }))] }), _jsxs("div", { className: "flex flex-1 flex-col gap-4", children: [_jsx("div", { className: "flex items-start justify-between gap-4", children: _jsxs("div", { children: [_jsx("h3", { className: "font-heading text-xl font-semibold text-charcoal", children: course.title }), _jsx("p", { className: "mt-2 line-clamp-2 text-sm text-slate/80", children: course.description })] }) }), _jsxs("div", { className: "flex items-center gap-4 text-sm text-slate/80", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(BookOpen, { className: "h-4 w-4" }), (course.chapters || []).reduce((total, chapter) => total + chapter.lessons.length, 0), " lessons"] }), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Clock, { className: "h-4 w-4" }), course.estimatedDuration || 0, " min"] })] }), dueDateLabel && (_jsxs("div", { className: "text-xs font-semibold uppercase tracking-wide text-slate/70", children: ["Due ", dueDateLabel] })), _jsxs("div", { children: [_jsx(ProgressBar, { value: progressPercent, srLabel: `${course.title} completion` }), _jsx("div", { className: "mt-2 text-xs font-semibold uppercase tracking-wide text-slate/70", children: statusLabel })] }), _jsxs("div", { className: "mt-auto flex items-center justify-between gap-3", children: [_jsx(Button, { onClick: onPrimaryAction, className: "flex-1", size: "sm", children: stats.isCompleted ? 'Review course' : progressPercent > 0 ? 'Continue' : 'Start course' }), _jsx(Button, { variant: "ghost", size: "sm", onClick: onSecondaryAction, children: "Details" })] })] })] }));
};
const EmptyState = ({ title, description, actionLabel, onAction }) => (_jsxs(Card, { tone: "muted", className: "mt-6 flex flex-col items-center gap-4 text-center", padding: "lg", children: [_jsx("div", { className: "flex h-14 w-14 items-center justify-center rounded-2xl bg-sunrise/10 text-sunrise", children: _jsx(Target, { className: "h-6 w-6" }) }), _jsx("h3", { className: "font-heading text-xl font-semibold text-charcoal", children: title }), _jsx("p", { className: "max-w-md text-sm text-slate/80", children: description }), _jsx(Button, { onClick: onAction, trailingIcon: _jsx(ArrowUpRight, { className: "h-4 w-4" }), children: actionLabel })] }));
export default LearnerDashboard;
