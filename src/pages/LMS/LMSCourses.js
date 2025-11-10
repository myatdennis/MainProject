import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Clock, Filter, Layers3, Search, Sparkle, } from 'lucide-react';
import { courseStore } from '../../store/courseStore';
import { normalizeCourse } from '../../utils/courseNormalization';
import { syncCourseProgressWithRemote, loadStoredCourseProgress, } from '../../utils/courseProgress';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import ProgressBar from '../../components/ui/ProgressBar';
import { LazyImage, ImageSkeleton } from '../../components/PerformanceComponents';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { useUserProfile } from '../../hooks/useUserProfile';
const statusFilters = [
    { value: 'all', label: 'All' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'not-started', label: 'Not Started' },
    { value: 'completed', label: 'Completed' },
];
const LMSCourses = () => {
    const { user } = useUserProfile();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [progressRefreshToken, setProgressRefreshToken] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
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
    const publishedCourses = useMemo(() => {
        return courseStore
            .getAllCourses()
            .filter((course) => course.status === 'published')
            .map((course) => {
            const normalized = normalizeCourse(course);
            const storedProgress = loadStoredCourseProgress(normalized.slug);
            const completedLessonCount = storedProgress.completedLessonIds.length;
            const progressPercent = normalized.lessons > 0
                ? Math.round((completedLessonCount / normalized.lessons) * 100)
                : 0;
            return {
                ...normalized,
                progress: progressPercent,
            };
        });
    }, [progressRefreshToken]);
    // Ensure course store refreshes on landing (always fetch & merge latest)
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                if (typeof courseStore.init === 'function') {
                    setIsSyncing(true);
                    await courseStore.init();
                    if (!active)
                        return;
                    // Trigger recompute
                    setProgressRefreshToken((t) => t + 1);
                }
            }
            catch (err) {
                console.warn('[LMSCourses] Failed to initialize course store:', err);
            }
            finally {
                if (active)
                    setIsSyncing(false);
            }
        })();
        return () => {
            active = false;
        };
    }, []);
    useEffect(() => {
        let isMounted = true;
        const syncProgress = async () => {
            setIsSyncing(true);
            const results = await Promise.all(publishedCourses.map(async (course) => {
                const lessonIds = course.chapters?.flatMap((chapter) => chapter.lessons?.map((lesson) => lesson.id) ?? []) ?? [];
                if (!lessonIds.length)
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
            setIsSyncing(false);
        };
        void syncProgress();
        return () => {
            isMounted = false;
        };
    }, [publishedCourses, learnerId]);
    const filteredCourses = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return publishedCourses.filter((course) => {
            const matchesSearch = !query ||
                course.title.toLowerCase().includes(query) ||
                (course.description || '').toLowerCase().includes(query) ||
                course.category?.toLowerCase().includes(query);
            if (!matchesSearch)
                return false;
            if (filterStatus === 'all')
                return true;
            if (filterStatus === 'completed')
                return course.progress >= 100;
            if (filterStatus === 'in-progress')
                return course.progress > 0 && course.progress < 100;
            if (filterStatus === 'not-started')
                return course.progress === 0;
            return true;
        });
    }, [publishedCourses, searchTerm, filterStatus]);
    return (_jsx("div", { className: "min-h-screen bg-softwhite", children: _jsxs("div", { className: "container-page section", children: [_jsx(Breadcrumbs, { items: [{ label: 'Courses', to: '/lms/courses' }] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[2fr,1fr]", children: [_jsxs(Card, { tone: "gradient", withBorder: false, className: "overflow-hidden", children: [_jsxs("div", { className: "relative z-10 flex flex-col gap-4 text-charcoal", children: [_jsx(Badge, { tone: "info", className: "w-max bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-skyblue", children: "Learning Catalog" }), _jsx("h1", { className: "font-heading text-3xl font-bold md:text-4xl", children: "Explore courses crafted for inclusive leaders" }), _jsx("p", { className: "max-w-2xl text-sm text-slate/80", children: "Browse The Huddle Co. collection to build habits of belonging, courage, and cultural fluency across your organization." }), _jsxs("div", { className: "grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]", children: [_jsxs("div", { className: "relative flex items-center", children: [_jsx(Search, { className: "pointer-events-none absolute left-4 h-5 w-5 text-slate/60" }), _jsx(Input, { value: searchTerm, onChange: (event) => setSearchTerm(event.target.value), placeholder: "Search courses by title, skill, or keyword", className: "w-full rounded-full border-none bg-white/90 pl-12 pr-6 text-sm shadow-card-sm", "aria-label": "Search courses" })] }), _jsx("div", { className: "hidden items-center gap-2 rounded-full bg-white/80 p-1 text-xs font-semibold uppercase tracking-wide text-slate/70 md:flex", children: statusFilters.map((option) => (_jsx("button", { type: "button", onClick: () => setFilterStatus(option.value), className: `rounded-full px-4 py-2 transition ${filterStatus === option.value
                                                            ? 'bg-skyblue text-white shadow-card-sm'
                                                            : 'text-slate/80 hover:text-charcoal'}`, children: option.label }, option.value))) })] }), _jsxs("div", { className: "flex flex-wrap gap-4 pt-2 text-sm text-slate/80", children: [_jsxs("span", { className: "inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-card-sm", children: [_jsx(Layers3, { className: "h-4 w-4 text-sunrise" }), publishedCourses.length, " courses available"] }), _jsxs("span", { className: "inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 shadow-card-sm", children: [_jsx(Sparkle, { className: "h-4 w-4 text-forest" }), "Curated for DEI impact"] })] })] }), _jsx("div", { className: "pointer-events-none absolute inset-y-0 right-0 hidden w-72 translate-x-12 rounded-full bg-gradient-to-br from-sunrise/25 via-skyblue/18 to-forest/18 blur-3xl md:block" })] }), _jsxs(Card, { tone: "muted", padding: "lg", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-lg font-semibold text-charcoal", children: "Filter courses" }), _jsx("p", { className: "mt-1 text-sm text-slate/80", children: "Find the next program for you or your team." })] }), _jsx(Button, { variant: "ghost", size: "sm", leadingIcon: _jsx(Filter, { className: "h-4 w-4" }), onClick: () => {
                                                setFilterStatus('all');
                                                setSearchTerm('');
                                            }, children: "Reset" })] }), _jsx("div", { className: "mt-6 grid gap-2 text-sm font-semibold text-slate/80", children: statusFilters.map((option) => (_jsxs("label", { className: `flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition ${filterStatus === option.value ? 'border-skyblue bg-skyblue/8 text-skyblue' : 'border-mist bg-white'}`, children: [_jsxs("div", { children: [_jsx("p", { children: option.label }), _jsx("p", { className: "text-xs font-normal text-slate/70", children: getFilterHelper(option.value, publishedCourses) })] }), _jsx("input", { type: "radio", name: "course-filter", value: option.value, checked: filterStatus === option.value, onChange: () => setFilterStatus(option.value), className: "h-4 w-4 accent-skyblue", "aria-label": `Filter ${option.label}` })] }, option.value))) })] })] }), _jsx("div", { className: "mt-6 md:hidden", children: _jsx("div", { className: "flex gap-2", children: statusFilters.map((option) => (_jsx("button", { type: "button", onClick: () => setFilterStatus(option.value), className: `flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition ${filterStatus === option.value
                                ? 'border-skyblue bg-skyblue/10 text-skyblue'
                                : 'border-mist text-slate/80'}`, children: option.label }, option.value))) }) }), _jsx(SectionHeading, { title: "Available courses", helper: `${filteredCourses.length} of ${publishedCourses.length} courses`, actionLabel: "View learning plan", onAction: () => { } }), isSyncing ? (_jsx("div", { className: "mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3", "aria-label": "Loading courses", children: Array.from({ length: 6 }).map((_, i) => (_jsxs(Card, { className: "flex h-full flex-col", children: [_jsx(Skeleton, { className: "h-44 w-full rounded-2xl" }), _jsxs("div", { className: "mt-4 flex flex-1 flex-col gap-4", children: [_jsx(Skeleton, { variant: "text", className: "h-6 w-3/4" }), _jsx(Skeleton, { variant: "text", className: "h-4 w-full" }), _jsxs("div", { className: "mt-2", children: [_jsx(Skeleton, { className: "h-2 w-full rounded-full" }), _jsx(Skeleton, { variant: "text", className: "mt-2 h-3 w-24" })] }), _jsxs("div", { className: "mt-auto flex items-center justify-between gap-3", children: [_jsx(Skeleton, { className: "h-9 w-28 rounded-lg" }), _jsx(Skeleton, { className: "h-9 w-20 rounded-lg" })] })] })] }, i))) })) : filteredCourses.length === 0 ? (_jsx("div", { className: "mt-8", children: _jsx(EmptyState, { title: "No courses match that search", description: "Try a different keyword or reset your filters to rediscover The Huddle Co. catalog.", action: (_jsx(Button, { onClick: () => { setSearchTerm(''); setFilterStatus('all'); }, trailingIcon: _jsx(ArrowUpRight, { className: "h-4 w-4" }), children: "Reset search" })) }) })) : (_jsx("div", { className: "mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3", children: filteredCourses.map((course) => (_jsx(CourseCard, { course: course }, course.id))) }))] }) }));
};
const getFilterHelper = (filter, courses) => {
    const count = courses.filter((course) => {
        if (filter === 'all')
            return true;
        if (filter === 'completed')
            return course.progress >= 100;
        if (filter === 'in-progress')
            return course.progress > 0 && course.progress < 100;
        if (filter === 'not-started')
            return course.progress === 0;
        return true;
    }).length;
    switch (filter) {
        case 'completed':
            return `${count} finished`;
        case 'in-progress':
            return `${count} underway`;
        case 'not-started':
            return `${count} ready to begin`;
        default:
            return `${count} total`;
    }
};
const SectionHeading = ({ title, helper, actionLabel, onAction }) => (_jsxs("div", { className: "mt-12 flex flex-col gap-4 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-heading text-2xl font-bold text-charcoal", children: title }), _jsx("p", { className: "mt-1 text-sm text-slate/80", children: helper })] }), _jsx(Button, { variant: "ghost", size: "sm", trailingIcon: _jsx(ArrowUpRight, { className: "h-4 w-4" }), onClick: onAction, children: actionLabel })] }));
const CourseCard = ({ course }) => {
    const progressLabel = course.progress >= 100
        ? 'Completed'
        : course.progress > 0
            ? `${course.progress}% complete`
            : 'Ready to start';
    return (_jsxs(Card, { className: "flex h-full flex-col", children: [_jsxs("div", { className: "relative overflow-hidden rounded-2xl", children: [_jsx(LazyImage, { src: course.thumbnail, alt: course.title, className: "h-44 w-full object-cover", placeholder: _jsx(ImageSkeleton, { className: "h-44 w-full rounded-2xl" }), fallbackSrc: "/placeholder-course.jpg" }), _jsxs("div", { className: "absolute top-4 left-4 flex gap-2", children: [_jsx(Badge, { tone: "info", className: "bg-white/90 text-skyblue", children: course.difficulty }), _jsx(Badge, { tone: course.progress >= 100 ? 'positive' : course.progress > 0 ? 'info' : 'neutral', className: "bg-white/90", children: progressLabel })] })] }), _jsxs("div", { className: "mt-4 flex flex-1 flex-col gap-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-heading text-xl font-semibold text-charcoal", children: course.title }), _jsx("p", { className: "mt-2 line-clamp-2 text-sm text-slate/80", children: course.description })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-4 text-sm text-slate/80", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Clock, { className: "h-4 w-4" }), course.duration] }), _jsxs("span", { className: "flex items-center gap-1", children: [_jsx(BookOpen, { className: "h-4 w-4" }), course.lessons, " lessons"] })] }), _jsxs("div", { children: [_jsx(ProgressBar, { value: course.progress, srLabel: `${course.title} completion` }), _jsx("span", { className: "mt-2 block text-xs font-semibold uppercase tracking-wide text-slate/70", children: progressLabel })] }), _jsxs("div", { className: "mt-auto flex items-center justify-between gap-3", children: [_jsx(Button, { size: "sm", className: "flex-1", asChild: true, children: _jsx(Link, { to: `/lms/course/${course.slug || course.id}`, children: course.progress >= 100 ? 'Review course' : course.progress > 0 ? 'Continue' : 'Start course' }) }), _jsx(Button, { variant: "ghost", size: "sm", asChild: true, children: _jsx(Link, { to: `/lms/course/${course.slug || course.id}`, children: "Details" }) })] })] })] }));
};
export default LMSCourses;
